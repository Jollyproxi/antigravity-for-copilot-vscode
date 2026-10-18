import { afterEach, describe, expect, it, vi } from 'vitest';
import { GeminiQuotaService, parseGeminiQuota } from '../src/api/geminiQuota';
import { DISCOVERY_ENDPOINTS } from '../src/api/constants';

const account = { email: 'test@example.invalid', refreshToken: 'synthetic' };
const fiveHourReset = '2026-10-18T18:00:00Z';
const weeklyReset = '2026-10-24T04:00:00Z';
function response(buckets: unknown[] = [
	{ bucketId: 'gemini-weekly', window: 'weekly', remainingFraction: .95, resetTime: weeklyReset },
	{ bucketId: 'gemini-5h', window: '5h', remainingFraction: .97, resetTime: fiveHourReset },
]) {
	return { groups: [{ displayName: 'Gemini Models', buckets }] };
}
afterEach(() => vi.useRealTimers());

describe('Gemini quota summary parsing', () => {
	it('keeps verified five-hour and weekly percentages paired with their own resets', () => {
		expect(parseGeminiQuota(response())).toEqual({
			fiveHour: { remainingFraction: .97, resetTime: fiveHourReset },
			weekly: { remainingFraction: .95, resetTime: weeklyReset },
		});
	});

	it('ignores Argon, third-party and unknown groups even when their buckets look like Gemini', () => {
		const buckets = (response().groups[0]).buckets;
		for (const displayName of ['Gemini 4 Argon', 'Claude and GPT models', 'Unrecognized Models']) {
			expect(parseGeminiQuota({ groups: [{ displayName, buckets }] })).toEqual({});
		}
	});

	it('does not guess periods from display labels, fractions, or reset duration', () => {
		expect(parseGeminiQuota(response([
			{ bucketId: 'argon-weekly', window: 'weekly', remainingFraction: 0 },
			{ bucketId: 'gemini-5h', window: 'weekly', remainingFraction: 0 },
			{ displayName: 'Five Hour Limit Remaining', remainingFraction: 1, resetTime: fiveHourReset },
			{ bucketId: 'gemini-weekly', window: 'monthly', remainingFraction: 0 },
		]))).toEqual({});
	});

	it('preserves exhausted zero and leaves an absent weekly bucket unreported', () => {
		const parsed = parseGeminiQuota(response([{ bucketId: 'gemini-5h', window: '5h', remainingFraction: 0 }]));
		expect(parsed.fiveHour?.remainingFraction).toBe(0);
		expect(parsed.weekly).toBeUndefined();
	});

	it('skips disabled and malformed buckets rather than inventing available quota', () => {
		expect(parseGeminiQuota(response([
			null, [], 'bad',
			{ bucketId: 'gemini-5h', window: '5h', disabled: true, remainingFraction: 1 },
			{ bucketId: 'gemini-weekly', window: 'weekly', disabled: 'false', remainingFraction: 1 },
		]))).toEqual({});
	});

	it.each([undefined, null, '0.8', false, NaN, Infinity])('keeps invalid/missing fractions unknown: %s', remainingFraction => {
		const parsed = parseGeminiQuota(response([
			{ bucketId: 'gemini-5h', window: '5h', remainingFraction, remainingAmount: '100', resetTime: 'invalid' },
		]));
		expect(parsed.fiveHour).toEqual({ remainingFraction: undefined, resetTime: undefined });
	});

	it('clamps numeric fractions and keeps the reset belonging to the tightest duplicate', () => {
		const parsed = parseGeminiQuota(response([
			{ bucketId: 'gemini-5h', window: '5h', remainingFraction: 2, resetTime: fiveHourReset },
			{ bucketId: 'gemini-5h', window: '5h', remainingFraction: -.1, resetTime: weeklyReset },
			{ bucketId: 'gemini-5h', window: '5h', resetTime: fiveHourReset },
		]));
		expect(parsed.fiveHour).toEqual({ remainingFraction: 0, resetTime: weeklyReset });
	});

	it.each([null, [], {}, { groups: {} }, { groups: [null, {}, { buckets: [] }] }])('tolerates malformed/empty responses: %j', value => {
		expect(parseGeminiQuota(value)).toEqual({});
	});
});

describe('GeminiQuotaService', () => {
	it('single-flights, caches per account, and sends only the verified empty body to the gateway', async () => {
		const client = { postJson: vi.fn().mockResolvedValue(response()) };
		const service = new GeminiQuotaService(client as any);
		const results = await Promise.all(Array.from({ length: 5 }, () => service.get(account)));
		expect(results.every(result => result.fiveHour?.remainingFraction === .97)).toBe(true);
		expect(service.peek(account.email)?.updatedAt).toEqual(expect.any(Number));
		await service.get(account);
		expect(client.postJson).toHaveBeenCalledOnce();
		expect(client.postJson).toHaveBeenCalledWith(expect.objectContaining({
			action: 'retrieveUserQuotaSummary', endpoints: DISCOVERY_ENDPOINTS, body: {}, account,
		}));
		await service.get({ ...account, email: 'second@example.invalid' });
		expect(client.postJson).toHaveBeenCalledTimes(2);
		service.dispose();
	});

	it('expires quota after one minute and invalidates immediately on refresh', async () => {
		vi.useFakeTimers();
		const client = { postJson: vi.fn().mockResolvedValue(response()) };
		const service = new GeminiQuotaService(client as any);
		await service.get(account);
		await vi.advanceTimersByTimeAsync(60_001);
		expect(service.peek(account.email)).toBeUndefined();
		await service.get(account);
		expect(client.postJson).toHaveBeenCalledTimes(2);
		service.invalidate();
		expect(service.peek(account.email)).toBeUndefined();
		await service.get(account);
		expect(client.postJson).toHaveBeenCalledTimes(3);
		service.dispose();
	});

	it('bounds stalled lookups at five seconds and briefly caches unavailable data without percentages', async () => {
		vi.useFakeTimers();
		const client = { postJson: vi.fn(() => new Promise(() => {})) };
		const service = new GeminiQuotaService(client as any);
		const pending = service.get(account);
		await vi.advanceTimersByTimeAsync(5000);
		expect(await pending).toEqual({});
		expect(client.postJson.mock.calls[0][0].signal.aborted).toBe(true);
		await service.get(account);
		expect(client.postJson).toHaveBeenCalledOnce();
		await vi.advanceTimersByTimeAsync(30_001);
		const retry = service.get(account);
		expect(client.postJson).toHaveBeenCalledTimes(2);
		service.dispose();
		await retry;
	});

	it('treats denied or unsupported endpoints as unavailable, without guessing either limit', async () => {
		const service = new GeminiQuotaService({ postJson: vi.fn().mockRejectedValue(new Error('403')) } as any);
		expect(await service.get(account)).toEqual({});
		service.dispose();
	});

	it('does not restore stale cache or clear a newer lookup when an invalidated request finishes', async () => {
		const finishes: ((value: unknown) => void)[] = [];
		const client = { postJson: vi.fn(() => new Promise(resolve => { finishes.push(resolve); })) };
		const service = new GeminiQuotaService(client as any);
		const old = service.get(account);
		service.invalidate();
		const current = service.get(account);
		finishes[0](response());
		await old;
		expect(service.peek(account.email)).toBeUndefined();
		expect(service.get(account)).toBe(current);
		finishes[1](response([{ bucketId: 'gemini-5h', window: '5h', remainingFraction: 0 }]));
		expect((await current).fiveHour?.remainingFraction).toBe(0);
		service.dispose();
	});
});
