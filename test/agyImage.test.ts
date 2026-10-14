import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	buildAgyImagePrompt,
	detectImageMime,
	findRecentRasterFiles,
	isTrustedAgyArtifactPath,
	imageReferencePath,
	parseAgyImageStream,
	imageRunFailure,
	materializeImages,
} from '../src/agyImage';
import { createImageToolResult } from '../src/imageGeneration';
import * as vscode from 'vscode';

vi.mock('node:os', async importOriginal => {
	const actual = await importOriginal<typeof import('node:os')>();
	return { ...actual, homedir: vi.fn(actual.homedir) };
});

afterEach(() => { vi.mocked(os.homedir).mockReset(); });

const PNG_HEADER = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe('agy image bridge', () => {
	it('builds a confined single-tool image prompt', () => {
		const prompt = buildAgyImagePrompt({ prompt: 'A red fox in a snowy forest', aspectRatio: '16:9' });
		expect(prompt).toContain('use the built-in generate_image tool exactly once.');
		expect(prompt).toContain('image-generator subagent');
		expect(prompt).toContain('one generation attempt');
		expect(prompt).toContain('<image_prompt>\nA red fox in a snowy forest\n</image_prompt>');
		expect(prompt).toContain('set its AspectRatio argument to "16:9".');
		expect(prompt).toContain('Do not use any other tool');
	});

	it('extracts the observed generateImage outputPath shape', () => {
		const result = parseAgyImageStream([
			JSON.stringify({
				event: 'step_update',
				step_update: {
					step_type: 'tool',
					tool_name: 'generate_image',
					tool_info: {
						name: 'generate_image',
						result: {
							generateImage: {
								outputPath: 'file:///C:/Users/test/.gemini/antigravity-cli/brain/c1/cat.jpg',
							},
						},
					},
				},
			}),
			JSON.stringify({ event: 'result', result: { status: 'SUCCESS', response: 'Done.' } }),
		]);

		expect(result.sawGenerateImage).toBe(true);
		expect(result.imagePaths).toEqual(['file:///C:/Users/test/.gemini/antigravity-cli/brain/c1/cat.jpg']);
		expect(result.status).toBe('SUCCESS');
	});

	it('captures the CLI conversation id from the init event', () => {
		const result = parseAgyImageStream([
			JSON.stringify({ event: 'init', conversation_id: '6d52a886-dcb6-4714-955f-dd6a27af3630', init: { tools: ['generate_image'] } }),
		]);

		expect(result.conversationId).toBe('6d52a886-dcb6-4714-955f-dd6a27af3630');
	});

	it('accepts camelCase proto-derived stream keys', () => {
		const result = parseAgyImageStream([
			JSON.stringify({
				event: 'step_update',
				stepUpdate: {
					stepType: 'generateImage',
					generateImage: {
						outputPath: 'file:///C:/Users/test/.gemini/antigravity/brain/c1/cat.jpg',
					},
				},
			}),
		]);

		expect(result.sawGenerateImage).toBe(true);
		expect(result.imagePaths).toEqual(['file:///C:/Users/test/.gemini/antigravity/brain/c1/cat.jpg']);
	});

	it('parses a JSON-encoded artifact payload', () => {
		const result = parseAgyImageStream([
			JSON.stringify({
				event: 'step_update',
				step_update: {
					step_type: 'tool',
					tool_name: 'generate_image',
					tool_info: {
						name: 'generate_image',
						result: JSON.stringify({ outputPath: 'file:///C:/image.jpg' }),
					},
				},
			}),
		]);

		expect(result.imagePaths).toEqual(['file:///C:/image.jpg']);
	});

	it('parses the documented tool_info.output field', () => {
		const result = parseAgyImageStream([
			JSON.stringify({
				event: 'step_update',
				step_update: {
					step_type: 'tool',
					tool_name: 'generate_image',
					tool_info: {
						name: 'generate_image',
						parameters: { Prompt: 'a cat' },
						output: JSON.stringify({ image_name: 'cat', aspect_ratio: '1:1', output_path: 'C:/Users/test/.gemini/antigravity-cli/brain/cat.jpg' }),
					},
				},
			}),
		]);

		expect(result.imagePaths).toEqual(['C:/Users/test/.gemini/antigravity-cli/brain/cat.jpg']);
	});

	it('finds a platform path with spaces in plain tool output', () => {
		const result = parseAgyImageStream([
			JSON.stringify({
				event: 'step_update',
				step_update: {
					step_type: 'tool',
					tool_name: 'generate_image',
					tool_info: {
						name: 'generate_image',
						output: 'Saved to C:\\Users\\test user\\.gemini\\antigravity-cli\\brain\\cat image.jpg.',
					},
				},
			}),
		]);

		expect(result.imagePaths).toEqual(['C:\\Users\\test user\\.gemini\\antigravity-cli\\brain\\cat image.jpg']);
	});

	it('collects artifacts when the terminal result carries the image payload', () => {
		const result = parseAgyImageStream([
			JSON.stringify({
				event: 'step_update',
				step_update: { step_type: 'tool', tool_name: 'generate_image' },
			}),
			JSON.stringify({
				event: 'result',
				result: {
					status: 'SUCCESS',
					generateImage: { image_paths: ['file:///C:/image.jpg'] },
				},
			}),
		]);

		expect(result.imagePaths).toEqual(['file:///C:/image.jpg']);
	});

	it('extracts imagePaths arrays and validated inline image data', () => {
		const encoded = Buffer.from(PNG_HEADER).toString('base64');
		const result = parseAgyImageStream([
			JSON.stringify({
				event: 'step_update',
				step_update: {
					step_type: 'tool',
					tool_info: {
						name: 'generate_image',
						output: { imagePaths: ['/tmp/not-used.png'], image: { data: `data:image/png;base64,${encoded}` } },
					},
				},
			}),
		]);

		expect(result.imagePaths).toEqual(['/tmp/not-used.png']);
		expect(result.inlineImages).toHaveLength(1);
		expect(result.inlineImages[0]).toEqual(PNG_HEADER);
	});

	it('does not collect input image paths from tool parameters', () => {
		const result = parseAgyImageStream([
			JSON.stringify({
				event: 'step_update',
				step_update: {
					step_type: 'tool',
					tool_name: 'generate_image',
					tool_info: {
						name: 'generate_image',
						parameters: { imagePaths: ['C:/private/secret.png'] },
					},
				},
			}),
		]);

		expect(result.sawGenerateImage).toBe(true);
		expect(result.imagePaths).toEqual([]);
	});

	it('does not treat native action input image_paths as generated output', () => {
		const result = parseAgyImageStream([
			JSON.stringify({
				event: 'step_update',
				step_update: {
					step_type: 'tool',
					generate_image: {
						image_paths: ['C:/Users/test/.gemini/antigravity-cli/brain/input.png'],
						output_path: 'C:/Users/test/.gemini/antigravity-cli/brain/output.jpg',
					},
				},
			}),
		]);

		expect(result.imagePaths).toEqual(['C:/Users/test/.gemini/antigravity-cli/brain/output.jpg']);
	});

	it('rejects an image turn that attempted another tool', () => {
		const result = parseAgyImageStream([
			JSON.stringify({
				event: 'step_update',
				step_update: { step_type: 'tool', tool_name: 'run_command' },
			}),
			JSON.stringify({
				event: 'step_update',
				step_update: { step_type: 'tool', tool_name: 'generate_image', tool_info: { name: 'generate_image' } },
			}),
		]);

		expect(result.unexpectedTools).toEqual(['run_command']);
		expect(result.sawGenerateImage).toBe(true);
	});

	it('captures native tool errors even when the terminal result says success', () => {
		const result = parseAgyImageStream([
			JSON.stringify({
				event: 'step_update',
				step_update: {
					step_type: 'tool',
					tool_name: 'generate_image',
					tool_info: { name: 'generate_image', error: { message: '503 Service Unavailable' } },
				},
			}),
			JSON.stringify({ event: 'result', result: { status: 'SUCCESS', response: 'Done.' } }),
		]);

		expect(result.toolError).toBe('503 Service Unavailable');
	});

	it('retains a terminal error even when its status is incorrectly success', () => {
		const result = parseAgyImageStream([
			JSON.stringify({
				event: 'step_update',
				step_update: { step_type: 'tool', tool_name: 'generate_image' },
			}),
			JSON.stringify({
				event: 'result',
				result: { status: 'SUCCESS', error: { message: 'generation failed' } },
			}),
		]);

		expect(result.error).toBe('generation failed');
	});

	it('recognizes safe raster signatures only', () => {
		expect(detectImageMime(PNG_HEADER)).toBe('image/png');
		expect(detectImageMime(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
		expect(detectImageMime(Uint8Array.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]))).toBe('image/gif');
		expect(detectImageMime(Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]))).toBe('image/webp');
		expect(detectImageMime(Uint8Array.from([0x3c, 0x73, 0x76, 0x67]))).toBeUndefined();
	});

	it('rejects relative artifact references', () => {
		expect(imageReferencePath('relative/cat.png')).toBeUndefined();
		expect(imageReferencePath('')).toBeUndefined();
		expect(imageReferencePath('file:///C:/Users/test/cat.png')).toMatch(/cat\.png$/i);
		expect(imageReferencePath('/Users/test/.gemini/antigravity/brain/cat.png')).toMatch(/cat\.png$/i);
		expect(imageReferencePath('~/cat.png')).toMatch(/cat\.png$/i);
	});

	it('limits artifact reads to Antigravity brain directories', () => {
		expect(isTrustedAgyArtifactPath('C:/Users/test/.gemini/antigravity-cli/brain/run/cat.png')).toBe(false);
		expect(isTrustedAgyArtifactPath('relative/.gemini/antigravity-cli/brain/cat.png')).toBe(false);
	});

	it('returns text plus inline VS Code image parts', () => {
		const result = createImageToolResult({
			response: 'Generated successfully.',
			images: [{ data: PNG_HEADER, mimeType: 'image/png' }],
		});

		expect(result.content).toHaveLength(2);
		expect(result.content[0]).toBeInstanceOf(vscode.LanguageModelTextPart);
		expect(result.content[1]).toBeInstanceOf(vscode.LanguageModelDataPart);
		expect((result.content[1] as vscode.LanguageModelDataPart).mimeType).toBe('image/png');
	});

	it('finds a recent raster artifact when the stream omits output_path', async () => {
		const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'agy-image-test-'));
		try {
			const imagePath = path.join(directory, 'antigravity_copilot_image_1.jpg');
			await fs.writeFile(imagePath, Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]));
			await fs.writeFile(path.join(directory, 'notes.txt'), 'not an image');
			const found = await findRecentRasterFiles(directory, Date.now() - 5_000, [directory]);

			expect(found).toEqual([imagePath]);
		} finally {
			await fs.rm(directory, { recursive: true, force: true });
		}
	});
});

describe('agy image-generator delegation', () => {
	function delegated(children: unknown[] = [{ type_name: 'image-generator', conversation_id: 'image-child' }]) {
		return JSON.stringify({ event: 'step_update', step_update: {
			step_index: 2, step_type: 'subagent', tool_name: 'invoke_subagent', state: 'DONE',
			subagent_info: { subagents: children },
		} });
	}
	const success = JSON.stringify({ event: 'result', result: { status: 'SUCCESS' } });
	const init = JSON.stringify({ event: 'init', conversation_id: 'image-parent', init: { tools: ['invoke_subagent'] } });

	it('recognizes observed ACTIVE parameters then DONE subagent metadata without counting two invocations', () => {
		const active = JSON.stringify({ event: 'step_update', step_update: {
			step_index: 2, step_type: 'tool', tool_name: 'invoke_subagent', state: 'ACTIVE',
			tool_info: { name: 'invoke_subagent', parameters: { Subagents: [{ TypeName: 'image-generator', Prompt: 'synthetic', Role: 'image' }] } },
		} });
		const result = parseAgyImageStream([init, active, delegated(), success]);
		expect(result.sawGenerateImage).toBe(false);
		expect(result.sawImageGenerator).toBe(true);
		expect(result.imageGeneratorConversationIds).toEqual(['image-child']);
		expect(result.unexpectedTools).toEqual([]);
		expect(imageRunFailure(result, 0)).toBeUndefined();
	});

	it('allows identity metadata to arrive after an incomplete ACTIVE event', () => {
		const result = parseAgyImageStream([init, JSON.stringify({ event: 'step_update', step_update: {
			step_index: 2, tool_name: 'invoke_subagent', state: 'ACTIVE', step_type: 'tool',
		} }), delegated(), success]);
		expect(imageRunFailure(result, 0)).toBeUndefined();
	});

	it.each([
		[{ type_name: 'other-agent', conversation_id: 'other' }],
		[{ type_name: 'image-generator', conversation_id: '../outside' }],
		[{ type_name: 'image-generator', conversation_id: 'C:\\outside' }],
		[{ role: 'image-generator', conversation_id: 'other' }],
		[{ type_name: 'image-generator', conversation_id: 'one' }, { type_name: 'image-generator', conversation_id: 'two' }],
	])('rejects foreign, malformed or multiple delegates: %j', children => {
		const result = parseAgyImageStream([init, delegated(children), success]);
		expect(imageRunFailure(result, 0)).toMatch(/unexpected/);
		expect(result.imageGeneratorConversationIds).toEqual([]);
	});

	it('rejects two independently indexed delegate invocations', () => {
		const second = JSON.parse(delegated([{ type_name: 'image-generator', conversation_id: 'second-child' }]));
		second.step_update.step_index = 4;
		const result = parseAgyImageStream([init, delegated(), JSON.stringify(second), success]);
		expect(imageRunFailure(result, 0)).toMatch(/unexpected/);
	});

	it('rejects unidentified invocations and unrelated parent tools', () => {
		const unnamed = JSON.stringify({ event: 'step_update', step_update: { step_index: 2, tool_name: 'invoke_subagent', step_type: 'tool' } });
		expect(imageRunFailure(parseAgyImageStream([init, unnamed, success]), 0)).toMatch(/unexpected/);
		const shell = JSON.stringify({ event: 'step_update', step_update: { step_index: 3, tool_name: 'run_command', step_type: 'tool' } });
		expect(imageRunFailure(parseAgyImageStream([init, delegated(), shell, success]), 0)).toMatch(/unexpected/);
	});

	it('requires a linked child session, not only a requested agent name', () => {
		const result = parseAgyImageStream([init, delegated([{ type_name: 'image-generator' }]), success]);
		expect(imageRunFailure(result, 0)).toMatch(/verifiable child artifact session/);
	});

	it('does not let image-shaped metadata disguise an unrelated parent tool', () => {
		const disguised = JSON.parse(delegated());
		disguised.step_update.tool_name = 'run_command';
		expect(imageRunFailure(parseAgyImageStream([init, JSON.stringify(disguised), success]), 0)).toMatch(/unexpected/);
		const direct = JSON.stringify({ event: 'step_update', step_update: {
			step_type: 'tool', tool_name: 'run_command', generate_image: { output_path: '/tmp/image.png' },
		} });
		const parsed = parseAgyImageStream([direct, success]);
		expect(parsed.sawGenerateImage).toBe(false);
		expect(imageRunFailure(parsed, 0)).toMatch(/unexpected/);
	});

	it('reports terminal errors before missing tool evidence and scrubs credentials', () => {
		const result = parseAgyImageStream([JSON.stringify({ event: 'result', result: { status: 'ERROR', error: 'Authentication required ya29.fake-secret' } })]);
		expect(imageRunFailure(result, 1)).toContain('Authentication required');
		expect(imageRunFailure(result, 1)).not.toContain('fake-secret');
	});

	it('distinguishes no action, permission waits and unsuccessful process exit', () => {
		expect(imageRunFailure(parseAgyImageStream([success]), 0)).toContain('does not mean the CLI is missing');
		expect(imageRunFailure(parseAgyImageStream([JSON.stringify({ event: 'result', result: { status: 'WAITING' } })]), 0)).toContain('permission');
		expect(imageRunFailure(parseAgyImageStream([init, delegated(), success]), 1)).toContain('exit 1');
	});

	it('recovers an image from only the explicitly linked image-generator session', async () => {
		const home = await fs.mkdtemp(path.join(os.tmpdir(), 'agy-delegate-test-'));
		vi.mocked(os.homedir).mockReturnValue(home);
		try {
			const brain = path.join(home, '.gemini', 'antigravity-cli', 'brain');
			const childDir = path.join(brain, 'image-child');
			const otherDir = path.join(brain, 'unrelated-session');
			await fs.mkdir(childDir, { recursive: true });
			await fs.mkdir(otherDir, { recursive: true });
			await fs.writeFile(path.join(childDir, 'generated.png'), PNG_HEADER);
			await fs.writeFile(path.join(otherDir, 'private.png'), PNG_HEADER);
			const result = parseAgyImageStream([init, delegated(), success]);
			result.imagePaths.push(path.join(otherDir, 'private.png'));
			const images = await materializeImages(result, Date.now() - 1000);
			expect(images).toHaveLength(1);
			expect(images[0].mimeType).toBe('image/png');
			expect(images[0].sourcePath).toBe(path.join(childDir, 'generated.png'));
		} finally { await fs.rm(home, { recursive: true, force: true }); }
	});

	it('does not use an unlinked raster when the image-generator produced none', async () => {
		const home = await fs.mkdtemp(path.join(os.tmpdir(), 'agy-no-image-test-'));
		vi.mocked(os.homedir).mockReturnValue(home);
		try {
			const elsewhere = path.join(home, '.gemini', 'antigravity-cli', 'brain', 'other');
			await fs.mkdir(elsewhere, { recursive: true });
			await fs.writeFile(path.join(elsewhere, 'image.png'), PNG_HEADER);
			const result = parseAgyImageStream([init, delegated(), success]);
			result.imagePaths.push(path.join(elsewhere, 'image.png'));
			expect(await materializeImages(result, Date.now() - 1000)).toEqual([]);
		} finally { await fs.rm(home, { recursive: true, force: true }); }
	});
});
