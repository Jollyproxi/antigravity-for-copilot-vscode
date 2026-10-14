import { ModelSpec } from '../api/models';
import { GeminiRequest } from './types';

export const TOOL_GUIDANCE_REVISION = 'efficient-v1';

// Stable across turns to avoid growing history or changing the prompt prefix each step.
const GUIDANCE = [
	'Tool-use guidance: follow the user\'s requested scope, host and project instructions, tool requirements, and required validation. Apply these efficiency preferences when consistent with those requirements:',
	'Choose the smallest evidence-gathering plan that fully answers the request.',
	'For general documentation or web research, use available search or page-retrieval tools and relevant primary sources. Inspect local files when the user requests it or when necessary to answer, such as a supplied configuration, local behavior, or required project instructions. Keep a general lookup focused on its question.',
	'For repository changes, inspect the relevant code and instructions and complete the necessary validation.',
	'Reuse results already in the conversation. Narrow searches and file reads to unresolved questions. Repeat unchanged reads or searches only when earlier results were incomplete, failed, or new evidence warrants checking again.',
	'When supported by the available tools and host, group independent read-only tool calls in one response. Keep dependent actions and mutations in the required order and respect approvals.',
	'Once the evidence and required checks are sufficient, answer directly. If an available, authorized tool cannot resolve a remaining uncertainty, explain that limitation instead of repeating unproductive exploration. Never invent evidence or skip necessary work to reduce tool calls.',
].join('\n');

/** Adds advisory guidance without changing messages, tool schemas, or tool-call mode. */
export function applyToolGuidance(request: GeminiRequest, model: ModelSpec, enabled: boolean): boolean {
	if (!enabled || model.family !== 'gemini' || model.thinkingStyle !== 'model-id-tier' ||
		!request.tools?.some(tool => tool.functionDeclarations?.length)) {
		return false;
	}
	const parts = request.systemInstruction?.parts ?? [];
	if (!parts.some(part => part.text === GUIDANCE)) {
		request.systemInstruction = { ...request.systemInstruction, parts: [...parts, { text: GUIDANCE }] };
	}
	return true;
}
