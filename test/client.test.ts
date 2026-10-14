import { afterEach, describe, expect, it, vi } from 'vitest';
import { GatewayClient, summarizeRequest } from '../src/api/client';
import { httpFetch } from '../src/api/http';
import { RequestTiming } from '../src/timing';
import { log } from '../src/log';

vi.mock('../src/api/http', () => ({ httpFetch: vi.fn() }));

describe('summarizeRequest', () => {
	it('counts calls and how many carry an id', () => {
		const shape = summarizeRequest({
			request: {
				contents: [
					{ role: 'user', parts: [{ text: 'read it' }] },
					{
						role: 'model',
						parts: [{ functionCall: { name: 'read_file', args: { path: 'a.ts' }, id: 'call-1' } }],
					},
					{ role: 'user', parts: [{ functionResponse: { name: 'read_file', response: { output: 'x' }, id: 'call-1' } }] },
				],
			},
		})!;

		expect(shape.calls).toBe('1');
		expect(shape.callIds).toBe('1');
		expect(shape.responses).toBe('1');
		expect(shape.responseIds).toBe('1');
		expect(shape.b0).toBe('user:text');
		expect(shape.b1).toBe('model:call');
		expect(shape.b2).toBe('user:result');
	});

	it('never includes prompt text, tool names, arguments, or results', () => {
		const shape = summarizeRequest({
			request: {
				contents: [
					{
						role: 'model',
						parts: [
							{ functionCall: { name: 'read_file', args: { secret: 'TOP_SECRET_ARG' }, id: 'call-1' } },
						],
					},
				],
			},
		})!;

		expect(JSON.stringify(shape)).not.toContain('TOP_SECRET_ARG');
		expect(JSON.stringify(shape)).not.toContain('read_file');
	});

	it('counts every block but lists only the most recent ones', () => {
		const contents = Array.from({ length: 40 }, (_, i) => ({
			role: i % 2 === 0 ? 'user' : 'model',
			parts: [{ text: 'x' }],
		}));
		const shape = summarizeRequest({ request: { contents } })!;

		expect(shape.blocks).toBe('40');
		expect(shape.b0).toBeUndefined();
		expect(shape.b27).toBeUndefined();
		expect(shape.b28).toBe('user:text');
		expect(shape.b39).toBe('model:text');
	});

	it('counts only non-empty string ids', () => {
		const shape = summarizeRequest({
			request: {
				contents: [
					{
						role: 'model',
						parts: [
							{ functionCall: { name: 'a', id: 'c1' } },
							{ functionCall: { name: 'a', id: '' } },
							{ functionCall: { name: 'a', id: 0 } },
							{ functionCall: { name: 'a' } },
						],
					},
					{
						role: 'user',
						parts: [
							{ functionResponse: { name: 'a', id: 'c1' } },
							{ functionResponse: { name: 'a', id: false } },
						],
					},
				],
			},
		})!;

		expect(shape.calls).toBe('4');
		expect(shape.callIds).toBe('1');
		expect(shape.responses).toBe('2');
		expect(shape.responseIds).toBe('1');
	});

	it('tolerates malformed contents without throwing', () => {
		const shape = summarizeRequest({
			request: { contents: [null, 'x', { role: 'user', parts: 'nope' }, { parts: [null, { text: 'hi' }] }] },
		})!;

		expect(shape.b0).toBe('user:empty');
		expect(shape.b1).toBe('?:text');
		expect(shape.calls).toBe('0');
	});

	it('returns undefined for a body with no conversation contents', () => {
		expect(summarizeRequest({})).toBeUndefined();
		expect(summarizeRequest({ request: { contents: [] } })).toBeUndefined();
	});
});

describe('GatewayClient cancellation and phase timings', () => {
	afterEach(() => { vi.restoreAllMocks(); vi.mocked(httpFetch).mockReset(); });
	const options = () => ({ op: 'synthetic', action: 'streamGenerateContent', stream: true, body: { request: { contents: [{ role: 'user', parts: [{ text: 'PRIVATE_世界' }] }] } }, endpoints: ['https://synthetic.invalid'] });

	it('does not look up tokens or fetch when already cancelled', async () => {
		const tokens = { accessToken: vi.fn() };
		const controller = new AbortController(); controller.abort();
		await expect(new GatewayClient(tokens as any).post({ ...options(), signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
		expect(tokens.accessToken).not.toHaveBeenCalled();
		expect(httpFetch).not.toHaveBeenCalled();
	});

	it.each(['resolve', 'reject'])('cancels a token wait without fetching after its late %s', async completion => {
		let resolve!: (token: string) => void;
		let reject!: (error: Error) => void;
		const sharedToken = new Promise<string>((yes, no) => { resolve = yes; reject = no; });
		const tokens = { accessToken: vi.fn().mockReturnValue(sharedToken) };
		const controller = new AbortController();
		const run = new GatewayClient(tokens as any).post({ ...options(), signal: controller.signal });
		const rejected = expect(run).rejects.toMatchObject({ name: 'AbortError' });
		controller.abort();
		await rejected; // Shared token work is still pending.
		if (completion === 'resolve') resolve('synthetic-token'); else reject(new Error('refresh failed'));
		await Promise.resolve();
		expect(httpFetch).not.toHaveBeenCalled();
	});

	it('leaves a shared token lookup usable for another consumer', async () => {
		let resolve!: (token: string) => void;
		const shared = new Promise<string>(yes => { resolve = yes; });
		const tokens = { accessToken: () => shared };
		const client = new GatewayClient(tokens as any);
		const controller = new AbortController();
		const cancelled = client.post({ ...options(), signal: controller.signal });
		const rejected = expect(cancelled).rejects.toMatchObject({ name: 'AbortError' });
		const active = client.post(options());
		controller.abort();
		await rejected;
		vi.mocked(httpFetch).mockResolvedValue(new Response('{}'));
		resolve('synthetic-token');
		await active;
		expect(httpFetch).toHaveBeenCalledOnce();
	});

	it('stops a forced-refresh wait without retrying or using the next endpoint', async () => {
		let entered!: () => void;
		const invalidating = new Promise<void>(resolve => { entered = resolve; });
		let release!: () => void;
		const gate = new Promise<void>(resolve => { release = resolve; });
		const tokens = { accessToken: vi.fn().mockResolvedValue('synthetic-token'), invalidateActive: vi.fn(() => { entered(); return gate; }) };
		vi.mocked(httpFetch).mockResolvedValue(new Response('{}', { status: 401 }));
		const controller = new AbortController();
		const run = new GatewayClient(tokens as any).post({ ...options(), endpoints: ['https://first.invalid', 'https://second.invalid'], signal: controller.signal });
		const rejected = expect(run).rejects.toMatchObject({ name: 'AbortError' });
		await invalidating;
		controller.abort();
		await rejected;
		release();
		await Promise.resolve();
		expect(httpFetch).toHaveBeenCalledOnce();
		expect(tokens.accessToken).toHaveBeenCalledOnce();
	});

	it('logs attempt phases and UTF-8 byte counts through fallback without content', async () => {
		const debug = vi.spyOn(log, 'debug');
		const tokens = { accessToken: vi.fn().mockResolvedValue('PRIVATE_TOKEN') };
		vi.mocked(httpFetch).mockResolvedValueOnce(new Response('{}', { status: 503 })).mockResolvedValueOnce(new Response('{}'));
		const opts = { ...options(), endpoints: ['https://first.invalid', 'https://second.invalid'], timing: new RequestTiming('synthetic') };
		await new GatewayClient(tokens as any).post(opts);
		const phases = debug.mock.calls.filter(([, message]) => message === 'chat phase').map(([op, , data]) => ({ op, ...data }));
		expect(phases.map(p => [p.phase, p.attempt])).toEqual([
			['tokenStart', 1], ['tokenEnd', 1], ['httpStart', 1], ['headers', 1],
			['tokenStart', 2], ['tokenEnd', 2], ['httpStart', 2], ['headers', 2],
		]);
		expect(phases.every(p => p.op === 'synthetic')).toBe(true);
		expect(phases.filter(p => p.phase === 'headers').map(p => p.status)).toEqual([503, 200]);
		expect(phases.filter(p => p.phase === 'httpStart').map(p => p.bytes)).toEqual(Array(2).fill(Buffer.byteLength(JSON.stringify(opts.body), 'utf8')));
		expect(JSON.stringify(debug.mock.calls)).not.toContain('PRIVATE_');
	});

	it('still refreshes once and retries the same endpoint after a 401', async () => {
		const tokens = { accessToken: vi.fn().mockResolvedValue('synthetic-token'), invalidateActive: vi.fn().mockResolvedValue(undefined) };
		vi.mocked(httpFetch).mockResolvedValueOnce(new Response('{}', { status: 401 })).mockResolvedValueOnce(new Response('{}'));
		await new GatewayClient(tokens as any).post({ ...options(), endpoints: ['https://first.invalid', 'https://second.invalid'] });
		expect(tokens.invalidateActive).toHaveBeenCalledOnce();
		expect(tokens.accessToken).toHaveBeenCalledTimes(2);
		expect(vi.mocked(httpFetch).mock.calls.map(([url]) => url)).toEqual(Array(2).fill('https://first.invalid/v1internal:streamGenerateContent?alt=sse'));
	});

	it('keeps account metadata and its 401 retry bound to the captured account', async () => {
		const account = { email: 'captured@example.invalid', refreshToken: 'PRIVATE_REFRESH' };
		const tokens = {
			accessTokenFor: vi.fn().mockResolvedValue('PRIVATE_TOKEN'), accessToken: vi.fn(),
			invalidate: vi.fn(), invalidateActive: vi.fn(),
		};
		const debug = vi.spyOn(log, 'debug');
		vi.mocked(httpFetch).mockResolvedValueOnce(new Response('{}', { status: 401 })).mockResolvedValueOnce(new Response('{}'));
		await new GatewayClient(tokens as any).postJson({
			op: 'synthetic', action: 'loadCodeAssist', body: {}, endpoints: ['https://synthetic.invalid'], account,
		});
		expect(tokens.accessTokenFor.mock.calls).toEqual([[account], [account]]);
		expect(tokens.invalidate).toHaveBeenCalledExactlyOnceWith(account.email);
		expect(tokens.accessToken).not.toHaveBeenCalled();
		expect(tokens.invalidateActive).not.toHaveBeenCalled();
		for (const [, init] of vi.mocked(httpFetch).mock.calls) expect(init?.body).toBe('{}');
		expect(JSON.stringify(debug.mock.calls)).not.toContain('PRIVATE_');
		expect(JSON.stringify(debug.mock.calls)).not.toContain(account.email);
	});
});
