import { Account } from '../auth/store';
import { GatewayClient } from './client';
import { bootstrapMetadata, DISCOVERY_ENDPOINTS } from './constants';
import { awaitWithSignal } from './cancellation';
import { log, newOperationId } from '../log';

export interface AccountPlan {
	label?: string;
	/** Google One AI credit balance as a decimal integer, not a quota percentage. */
	aiCredits?: string;
}

function record(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | undefined {
	if (typeof value !== 'string') return undefined;
	const clean = value.replace(/[\x00-\x1f\x7f]/g, ' ').trim();
	return clean && clean.length <= 80 ? clean : undefined;
}

function creditBalance(value: unknown): string | undefined {
	if (!Array.isArray(value)) return undefined;
	const credits = value.filter(entry => record(entry) && entry.creditType === 'GOOGLE_ONE_AI');
	if (!credits.length) return undefined;
	let total = 0n;
	for (const entry of credits) {
		// int64 is a JSON string. Missing/invalid amounts are unknown, never zero.
		const amount = entry.creditAmount;
		if (typeof amount !== 'string' || !/^\d{1,19}$/.test(amount)) return undefined;
		const parsed = BigInt(amount);
		if (parsed > 9223372036854775807n) return undefined;
		total += parsed;
	}
	return total.toString();
}

/** Read actual account entitlements, never upgrade offers or inferred quota/model access. */
export function parseAccountPlan(response: unknown): AccountPlan {
	if (!record(response)) return {};
	const labels = new Map([
		['g1-pro-tier', 'Pro'], ['g1-ultra-tier', 'Ultra'], ['free-tier', 'Free'],
		['standard-tier', 'Standard'], ['legacy-tier', 'Legacy'],
	]);
	for (const tier of [response.paidTier, response.currentTier]) {
		if (!record(tier)) continue;
		const id = text(tier.id);
		const name = text(tier.name);
		const aiCredits = creditBalance(tier.availableCredits);
		// Preserve unfamiliar backend names; "standard-tier" alone never means Pro.
		const label = id === 'g1-pro-tier' || id === 'g1-ultra-tier' ? labels.get(id) : name ?? (id ? labels.get(id) : undefined);
		if (id || name || Array.isArray(tier.availableCredits)) {
			return { ...(label ? { label } : {}), ...(aiCredits !== undefined ? { aiCredits } : {}) };
		}
	}
	return {};
}

/** Background UI metadata: per-account cache, shared in-flight lookup, bounded wait. */
export class AccountPlanService {
	private readonly cache = new Map<string, { plan: AccountPlan; until: number }>();
	private readonly pending = new Map<string, { controller: AbortController; promise: Promise<AccountPlan> }>();
	private generation = 0;

	constructor(private readonly client: GatewayClient) {}

	peek(email: string): AccountPlan | undefined {
		const entry = this.cache.get(email);
		return entry && entry.until > Date.now() ? entry.plan : undefined;
	}

	get(account: Account): Promise<AccountPlan> {
		const cached = this.peek(account.email);
		if (cached) return Promise.resolve(cached);
		const existing = this.pending.get(account.email);
		if (existing) return existing.promise;
		const generation = this.generation;
		const controller = new AbortController();
		const op = newOperationId();
		const timeout = setTimeout(() => controller.abort(), 5000);
		const promise = awaitWithSignal(() => this.client.postJson<unknown>({
			op, action: 'loadCodeAssist', endpoints: DISCOVERY_ENDPOINTS,
			body: { metadata: bootstrapMetadata() }, account, signal: controller.signal,
		}), controller.signal).then(parseAccountPlan).catch((): AccountPlan => {
			log.debug(op, 'account plan unavailable');
			return {};
		}).then(plan => {
			if (this.generation === generation) {
				this.cache.set(account.email, { plan, until: Date.now() + (plan.label || plan.aiCredits !== undefined ? 300_000 : 30_000) });
			}
			return plan;
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
