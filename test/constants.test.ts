import { describe, expect, it } from 'vitest';
import { userAgent } from '../src/api/constants';

describe('Antigravity CLI fingerprint', () => {
	it('pins the CLI version to the officially released 1.4.0', () => {
		expect(userAgent()).toMatch(/^antigravity\/cli\/1\.4\.0 /);
	});
});
