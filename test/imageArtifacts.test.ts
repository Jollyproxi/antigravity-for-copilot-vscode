import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import * as vscode from 'vscode';
import { ImageArtifactStore, imageReferenceMarkdown, missingImagePreviews } from '../src/imageArtifacts';
import { createImageToolResult } from '../src/imageGeneration';
import { AntigravityProvider, currentTurnImageReferences } from '../src/provider';
import { buildRequest } from '../src/translate/toGemini';
import { spec } from '../src/api/models';
import { SignatureCache } from '../src/translate/thinking';

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const image = { data: PNG, mimeType: 'image/png' };
const temporary: string[] = [];
async function storage() {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), 'antigravity-preview-'));
	temporary.push(root);
	return { root, store: new ImageArtifactStore(path.join(root, 'space (parent) # ü')) };
}
afterEach(async () => { await Promise.all(temporary.splice(0).map(root => fs.rm(root, { recursive: true, force: true }))); });
function message(role: number, ...content: unknown[]): any { return { role, content }; }

describe('generated image references', () => {
	it('persists exact raster bytes with encoded local URLs and keeps all images', async () => {
		const { store, root } = await storage();
		const refs = await store.save([image, image]);
		expect(refs).toHaveLength(2);
		expect(refs[0].uri).not.toBe(refs[1].uri);
		for (const ref of refs) {
			expect(ref.uri).toMatch(/^file:\/\/\//);
			expect(ref.uri).not.toMatch(/[\s()]/);
			expect(ref.uri).toContain('%23');
			expect(Buffer.from(await fs.readFile(fileURLToPath(ref.uri)))).toEqual(Buffer.from(PNG));
			expect(path.relative(root, fileURLToPath(ref.uri)).startsWith('..')).toBe(false);
		}
		const rendered = refs.map(imageReferenceMarkdown).join('\n\n');
		expect(store.findInText(rendered)).toEqual(refs);
		expect(store.findInText('file:///private/secret.png')).toEqual([]);
	});

	it('rejects non-raster data and mismatched MIME before writing anything', async () => {
		const { store } = await storage();
		await expect(store.save([{ data: Buffer.from('<svg/>'), mimeType: 'image/svg+xml' }])).rejects.toThrow('raster');
		await expect(store.save([{ data: PNG, mimeType: 'image/jpeg' }])).rejects.toThrow('raster');
		await expect(store.save([])).rejects.toThrow('count');
		await expect(store.save(Array(5).fill(image))).rejects.toThrow('count');
	});

	it('rejects a redirected artifact directory without touching its target', async () => {
		const { root } = await storage();
		const target = path.join(root, 'outside');
		const home = path.join(root, 'storage');
		await fs.mkdir(target); await fs.mkdir(home);
		await fs.symlink(target, path.join(home, 'generated-images'), process.platform === 'win32' ? 'junction' : 'dir');
		await expect(new ImageArtifactStore(home).save([image])).rejects.toThrow('redirect');
		expect(await fs.readdir(target)).toEqual([]);
	});

	it('returns bytes plus actionable image Markdown which survives tool-result translation', async () => {
		const { store } = await storage();
		const refs = await store.save([image]);
		const result = createImageToolResult({ images: [image], response: 'unverified path: file:///private/unrelated.png' }, refs);
		expect(result.content[1]).toBeInstanceOf(vscode.LanguageModelDataPart);
		const text = (result.content[0] as vscode.LanguageModelTextPart).value;
		expect(text).toContain(`![Generated image 1](${refs[0].uri})`);
		expect(text).toContain(`[Open image 1](${refs[0].uri})`);
		expect(text).not.toContain('unrelated');
		expect(text).not.toContain(Buffer.from(PNG).toString('base64'));
		const request = buildRequest({ model: spec('gemini-3.8-flash-high', 'Flash'),
			messages: [message(1, new vscode.LanguageModelTextPart('Generate an image')),
				message(2, new vscode.LanguageModelToolCallPart('image-call', 'antigravity_generate_image', {})),
				message(1, new vscode.LanguageModelToolResultPart('image-call', result.content))],
			toolMode: vscode.LanguageModelChatToolMode.Auto, reasoningEffort: 'high', sendToolCallIds: false, signatures: new SignatureCache(),
		}).request;
		expect(request.contents[2].parts[0].functionResponse?.response.output).toContain(refs[0].uri);
	});

	it('keeps successful image output usable without a saved preview link', () => {
		const result = createImageToolResult({ images: [image] });
		expect(result.content[1]).toBeInstanceOf(vscode.LanguageModelDataPart);
		expect((result.content[0] as vscode.LanguageModelTextPart).value).toContain('could not be saved');
	});

	it('does not duplicate an existing image embed, but adds one when the answer has only a link', async () => {
		const { store } = await storage();
		const refs = await store.save([image, image]);
		expect(missingImagePreviews(refs, refs.map(imageReferenceMarkdown).join('\n'))).toBe('');
		expect(missingImagePreviews([refs[0]], `[Open](${refs[0].uri})`)).toContain('![Generated image');
		expect(missingImagePreviews([refs[0]], `![Test](<${refs[0].uri}>)`)).toBe('');
	});

	it('finds only current-turn references and retains image order across follow-up tools', async () => {
		const { store } = await storage();
		const refs = await store.save([image, image]);
		const result = createImageToolResult({ images: [image, image] }, refs);
		const history = [message(1, new vscode.LanguageModelTextPart('Make images')),
			message(1, new vscode.LanguageModelToolResultPart('image-call', result.content)),
			message(2, new vscode.LanguageModelToolCallPart('check', 'check_result', {})),
			message(1, new vscode.LanguageModelToolResultPart('check', [new vscode.LanguageModelTextPart('Checked')]))];
		expect(currentTurnImageReferences(history, store)).toEqual(refs);
		expect(currentTurnImageReferences([...history, message(1, new vscode.LanguageModelTextPart('A different question'))], store)).toEqual([]);
	});

	it.each(['omitted', 'embedded', 'tool-call', 'cancelled', 'failed'])('provider final preview behavior: %s', async mode => {
		const { store } = await storage();
		const refs = await store.save([image]);
		const result = createImageToolResult({ images: [image] }, refs);
		const encoder = new TextEncoder();
		const text = mode === 'embedded' ? imageReferenceMarkdown(refs[0], 0) : 'The image is ready.';
		const payload = { response: { candidates: [{ content: { parts: mode === 'tool-call'
			? [{ functionCall: { name: 'check_result', args: {} } }] : [{ text }] } }] } };
		const client = { post: async () => {
			if (mode === 'failed') throw new Error('synthetic error');
			return new Response(new ReadableStream({ start(c) { c.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)); c.close(); } }));
		} };
		const provider = new AntigravityProvider({ subscriptions: [] } as any,
			{ onDidChange: () => ({ dispose() {} }) } as any, {} as any, client as any,
			{ resolve: async () => 'project' } as any, {} as any, store);
		const reports: unknown[] = [];
		const run = provider.provideLanguageModelChatResponse({ id: 'gemini-3.8-flash-high', name: 'Flash', maxOutputTokens: 65536 } as any,
			[message(1, new vscode.LanguageModelTextPart('Generate an image')),
				message(2, new vscode.LanguageModelToolCallPart('image-call', 'antigravity_generate_image', {})),
				message(1, new vscode.LanguageModelToolResultPart('image-call', result.content))],
			{ tools: [], modelOptions: {} } as any, { report: part => reports.push(part) },
			{ isCancellationRequested: mode === 'cancelled', onCancellationRequested: () => ({ dispose() {} }) });
		if (mode === 'failed') await expect(run).rejects.toThrow('synthetic'); else await run;
		const output = reports.filter((p): p is vscode.LanguageModelTextPart => p instanceof vscode.LanguageModelTextPart).map(p => p.value).join('');
		expect((output.match(/!\[Generated image/g) ?? []).length).toBe(['omitted', 'embedded'].includes(mode) ? 1 : 0);
	});
});
