import { performance } from 'node:perf_hooks';
import { log } from './log';

type Phase = 'providerStart' | 'translationDone' | 'projectStart' | 'projectEnd'
	| 'tokenStart' | 'tokenEnd' | 'httpStart' | 'headers'
	| 'firstSse' | 'firstThought' | 'firstAnswer' | 'firstTool';

/** Only fixed phase names and numeric metadata can enter latency diagnostics. */
export class RequestTiming {
	private readonly started = performance.now();
	private readonly first: Partial<Record<Phase, number>> = {};

	constructor(private readonly op: string) {}

	mark(phase: Phase, details: { attempt?: number; status?: number; bytes?: number } = {}): void {
		const elapsedMs = this.elapsed();
		this.first[phase] ??= elapsedMs;
		log.debug(this.op, 'chat phase', { phase, elapsedMs, ...details });
	}

	once(phase: Phase): void {
		if (this.first[phase] === undefined) this.mark(phase);
	}

	finish(outcome: 'complete' | 'cancelled' | 'failed'): void {
		const phases = Object.fromEntries(Object.entries(this.first).map(([key, value]) => [`${key}Ms`, value]));
		log.info(this.op, 'chat timing', { outcome, totalMs: this.elapsed(), ...phases });
	}

	private elapsed(): number {
		return Math.round((performance.now() - this.started) * 1000) / 1000;
	}
}
