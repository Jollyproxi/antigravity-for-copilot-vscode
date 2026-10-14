import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccountPlanService, parseAccountPlan } from '../src/api/accountPlan';

const account = { email: 'test@example.invalid', refreshToken: 'synthetic' };
afterEach(() => vi.useRealTimers());

describe('account plan metadata', () => {
	it('sums only Google One AI credit entries without rounding int64 balances', () => {
		expect(parseAccountPlan({ paidTier: { id: 'g1-pro-tier', availableCredits: [
			{ creditType: 'GOOGLE_ONE_AI', creditAmount: '9007199254740993' },
			{ creditType: 'GOOGLE_ONE_AI', creditAmount: '7' },
			{ creditType: 'OTHER', creditAmount: '1000' },
		] } })).toEqual({ label: 'Pro', aiCredits: '9007199254741000' });
	});

	it('preserves an explicit zero balance and supports credits without a recognized plan', () => {
		expect(parseAccountPlan({ currentTier: { availableCredits: [
			{ creditType: 'GOOGLE_ONE_AI', creditAmount: '0' },
		] } })).toEqual({ aiCredits: '0' });
	});

	it.each([undefined, null, '', '-1', '1.5', '12credits', '1e3', '9223372036854775808', 12, {}])(
		'keeps a missing or invalid credit amount unknown: %j', creditAmount => {
			expect(parseAccountPlan({ paidTier: { id: 'g1-pro-tier', availableCredits: [
				{ creditType: 'GOOGLE_ONE_AI', creditAmount: '50' },
				{ creditType: 'GOOGLE_ONE_AI', creditAmount },
			] } })).toEqual({ label: 'Pro' });
		},
	);

	it('does not borrow credits from offers or a different tier when paid tier has no balance', () => {
		const credited = { id: 'free-tier', availableCredits: [{ creditType: 'GOOGLE_ONE_AI', creditAmount: '1000' }] };
		expect(parseAccountPlan({ paidTier: { id: 'g1-pro-tier' }, currentTier: credited, allowedTiers: [credited] })).toEqual({ label: 'Pro' });
		expect(parseAccountPlan({ allowedTiers: [credited] })).toEqual({});
		expect(parseAccountPlan({ paidTier: { availableCredits: [{ creditType: 'OTHER', creditAmount: '1000' }] } })).toEqual({});
		expect(parseAccountPlan({ paidTier: { availableCredits: [] } })).toEqual({});
	});

	it('refreshes cached credits for the captured account without adding another endpoint', async () => {
		const response = (amount: string) => ({ paidTier: { id: 'g1-pro-tier', availableCredits: [
			{ creditType: 'GOOGLE_ONE_AI', creditAmount: amount },
		] } });
		const client = { postJson: vi.fn().mockResolvedValueOnce(response('1250')).mockResolvedValueOnce(response('0')) };
		const plans = new AccountPlanService(client as any);
		expect(await plans.get(account)).toEqual({ label: 'Pro', aiCredits: '1250' });
		expect((await plans.get(account)).aiCredits).toBe('1250');
		expect(client.postJson).toHaveBeenCalledOnce();
		plans.invalidate();
		expect((await plans.get(account)).aiCredits).toBe('0');
		expect(client.postJson).toHaveBeenCalledTimes(2);
		expect(client.postJson.mock.calls.every(([request]) => request.action === 'loadCodeAssist' && request.account === account)).toBe(true);
		plans.dispose();
	});

	it.each([
		[{ paidTier: { id: 'g1-pro-tier' }, currentTier: { id: 'standard-tier' } }, 'Pro'],
		[{ paidTier: { id: 'g1-ultra-tier' }, currentTier: { id: 'free-tier' } }, 'Ultra'],
		[{ currentTier: { id: 'free-tier' } }, 'Free'],
		[{ currentTier: { id: 'standard-tier' } }, 'Standard'],
		[{ currentTier: { id: 'new-id', name: 'Reported Enterprise Plan' } }, 'Reported Enterprise Plan'],
	])('reads the active plan from %j', (response, label) => {
		expect(parseAccountPlan(response)).toEqual({ label });
	});
	it.each([null, {}, { allowedTiers: [{ id: 'g1-ultra-tier' }] }, { currentTier: { id: '__proto__' } },
		{ paidTier: { id: 'unknown-paid' }, currentTier: { id: 'free-tier' } },
		{ currentTier: { name: 'x'.repeat(81) } }])('does not invent a plan for %j', response => {
		expect(parseAccountPlan(response)).toEqual({});
	});

	it('single-flights concurrent requests and reuses a per-account cache', async () => {
		const client = { postJson: vi.fn().mockResolvedValue({ paidTier: { id: 'g1-pro-tier' } }) };
		const plans = new AccountPlanService(client as any);
		const values = await Promise.all(Array.from({ length: 5 }, () => plans.get(account)));
		expect(values).toEqual(Array(5).fill({ label: 'Pro' }));
		await plans.get(account);
		expect(client.postJson).toHaveBeenCalledOnce();
		expect(client.postJson.mock.calls[0][0]).toMatchObject({ action: 'loadCodeAssist', body: { metadata: { ideType: 'ANTIGRAVITY' } }, account });
		await plans.get({ email: 'second@example.invalid', refreshToken: 'other' });
		expect(client.postJson).toHaveBeenCalledTimes(2);
		plans.dispose();
	});

	it('expires cached known plans after five minutes and refresh invalidates immediately', async () => {
		vi.useFakeTimers();
		const client = { postJson: vi.fn().mockResolvedValue({ paidTier: { id: 'g1-pro-tier' } }) };
		const plans = new AccountPlanService(client as any);
		await plans.get(account);
		await vi.advanceTimersByTimeAsync(300001);
		await plans.get(account);
		expect(client.postJson).toHaveBeenCalledTimes(2);
		plans.invalidate();
		await plans.get(account);
		expect(client.postJson).toHaveBeenCalledTimes(3);
		plans.dispose();
	});

	it('bounds a stalled lookup at five seconds and caches failure briefly', async () => {
		vi.useFakeTimers();
		const client = { postJson: vi.fn(() => new Promise(() => {})) };
		const plans = new AccountPlanService(client as any);
		const pending = plans.get(account);
		await vi.advanceTimersByTimeAsync(5000);
		expect(await pending).toEqual({});
		expect(client.postJson.mock.calls[0][0].signal.aborted).toBe(true);
		await plans.get(account);
		expect(client.postJson).toHaveBeenCalledOnce();
		await vi.advanceTimersByTimeAsync(30001);
		const retry = plans.get(account);
		expect(client.postJson).toHaveBeenCalledTimes(2);
		plans.dispose();
		await retry;
	});

	it('does not restore stale plan cache when an invalidated lookup finishes late', async () => {
		let finish!: (value: unknown) => void;
		const client = { postJson: vi.fn(() => new Promise(resolve => { finish = resolve; })) };
		const plans = new AccountPlanService(client as any);
		const pending = plans.get(account);
		plans.invalidate();
		finish({ paidTier: { id: 'g1-ultra-tier' } });
		await pending;
		expect(plans.peek(account.email)).toBeUndefined();
	});
});
