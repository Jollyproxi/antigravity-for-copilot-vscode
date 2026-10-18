import { Account } from '../auth/store';
import { GatewayClient } from './client';
import { DISCOVERY_ENDPOINTS } from './constants';
import { awaitWithSignal } from './cancellation';
import { log, newOperationId } from '../log';

export interface QuotaWindow {
	remainingFraction?: number;
	resetTime?: string;
}

export interface GeminiQuota {
	fiveHour?: QuotaWindow;
	weekly?: QuotaWindow;
	updatedAt?: number;
}

function record(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Verified retrieveUserQuotaSummary buckets, not guesses from model names or reset dates. */
export function parseGeminiQuota(response: unknown): GeminiQuota {
	if (!record(response) || !Array.isArray(response.groups)) return {};
	const quota: GeminiQuota = {};
	for (const group of response.groups) {
		if (!record(group) || group.displayName !== 'Gemini Models' || !Array.isArray(group.buckets)) continue;
		for (const bucket of group.buckets) {
			if (!record(bucket) || (bucket.disabled !== undefined && bucket.disabled !== false)) continue;
			const period = bucket.bucketId === 'gemini-5h' && bucket.window === '5h' ? 'fiveHour'
				: bucket.bucketId === 'gemini-weekly' && bucket.window === 'weekly' ? 'weekly' : undefined;
			if (!period) continue;
			const fraction = bucket.remainingFraction;
			const remainingFraction = typeof fraction === 'number' && Number.isFinite(fraction)
				? Math.max(0, Math.min(1, fraction)) : undefined;
			const resetTime = typeof bucket.resetTime === 'string' && Number.isFinite(Date.parse(bucket.resetTime))
				? bucket.resetTime : undefined;
			// A missing oneof fraction (e.g. remainingAmount) is unknown, never a full or exhausted quota.
			const next = { remainingFraction, resetTime };
			const previous = quota[period];
			if (!previous || (remainingFraction !== undefined &&
				(previous.remainingFraction === undefined || remainingFraction < previous.remainingFraction))) {
				// Keep a percentage paired with its own reset, including duplicate/partial buckets.
				quota[period] = next;
			}
		}
	}
	return quota;
}

/** Optional, account-bound UI metadata; never blocks model discovery or invokes the CLI. */
export class GeminiQuotaService {
	private readonly cache = new Map<string, { quota: GeminiQuota; until: number }>();
	private readonly pending = new Map<string, { controller: AbortController; promise: Promise<GeminiQuota> }>();
	private generation = 0;

	constructor(private readonly client: GatewayClient) {}

	peek(email: string): GeminiQuota | undefined {
		const entry = this.cache.get(email);
		return entry && entry.until > Date.now() ? entry.quota : undefined;
	}

	get(account: Account): Promise<GeminiQuota> {
		const cached = this.peek(account.email);
		if (cached) return Promise.resolve(cached);
		const existing = this.pending.get(account.email);
		if (existing) return existing.promise;
		const generation = this.generation;
		const controller = new AbortController();
		const op = newOperationId();
		const timeout = setTimeout(() => controller.abort(), 5000);
		const promise = awaitWithSignal(() => this.client.postJson<unknown>({
			op, action: 'retrieveUserQuotaSummary', endpoints: DISCOVERY_ENDPOINTS,
			body: {}, account, signal: controller.signal,
		}), controller.signal).then(parseGeminiQuota).catch((): GeminiQuota => {
			log.debug(op, 'Gemini quota summary unavailable');
			return {};
		}).then(quota => {
			const reported = !!(quota.fiveHour || quota.weekly);
			if (reported) quota = { ...quota, updatedAt: Date.now() };
			if (this.generation === generation) {
				this.cache.set(account.email, { quota, until: Date.now() + (reported ? 60_000 : 30_000) });
			}
			return quota;
		}).finally(() => {
			clearTimeout(timeout);
			if (this.pending.get(account.email)?.controller === controller) this.pending.delete(account.email);
		});
		this.pending.set(account.email, { controller, promise });
		return promise;
	}

	invalidate(): void {
		this.generation++;
		this.cache.clear();
		for (const entry of this.pending.values()) entry.controller.abort();
		this.pending.clear();
	}

	dispose(): void { this.invalidate(); }
}
