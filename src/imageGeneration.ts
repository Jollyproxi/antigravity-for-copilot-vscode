import * as vscode from 'vscode';
import { AgyImageRequest, runAgyImage } from './agyImage';
import { ImageArtifactReference, ImageArtifactStore, imageReferenceMarkdown } from './imageArtifacts';

export const ANTIGRAVITY_IMAGE_GENERATION_TOOL_NAME = 'antigravity_generate_image';

type ImageGenerationInput = AgyImageRequest;

/** Converts validated sidecar output into the VS Code tool-result parts. */
export function createImageToolResult(result: Awaited<ReturnType<typeof runAgyImage>>, references: readonly ImageArtifactReference[] = []): vscode.LanguageModelToolResult {
	const summary = `Generated ${result.images.length === 1 ? 'an image' : `${result.images.length} images`} with Antigravity.`;
	const display = references.length > 0
		? '\n\nDisplay these generated images in the final answer using the exact Markdown below, including the Open image links. Keep the file URIs unchanged. Do not regenerate or copy the images merely to display them.\n\n' + references.map(imageReferenceMarkdown).join('\n\n')
		: '\n\nThe image bytes are attached to this tool result. A local preview link could not be saved; use the tool output to view the image.';
	const parts: Array<vscode.LanguageModelTextPart | vscode.LanguageModelDataPart> = [
		new vscode.LanguageModelTextPart(summary + display),
	];
	for (const image of result.images) {
		parts.push(vscode.LanguageModelDataPart.image(image.data, image.mimeType));
	}
	return new vscode.LanguageModelToolResult(parts);
}

/** Registers the Antigravity-native image generator as a Copilot tool. */
export function registerAntigravityImageGenerationTool(artifacts: ImageArtifactStore): vscode.Disposable {
	return vscode.lm.registerTool<ImageGenerationInput>(ANTIGRAVITY_IMAGE_GENERATION_TOOL_NAME, {
		prepareInvocation: () => ({
			invocationMessage: 'Generating an image with Antigravity backend…',
			confirmationMessages: {
				title: 'Generate an image with Antigravity?',
				message: 'This uses your Antigravity account and may consume image-generation quota.',
			},
		}),
		invoke: async (options, token) => {
			try {
				const result = await runAgyImage(options.input, token);
				let references: ImageArtifactReference[] = [];
				try { references = await artifacts.save(result.images); } catch {
					// Preserve successful generation even if preview storage is unavailable.
				}
				return createImageToolResult(result, references);
			} catch (error) {
				if (error instanceof vscode.CancellationError) {
					throw error;
				}
				const message = error instanceof Error ? error.message : 'Unknown image-generation error.';
				return new vscode.LanguageModelToolResult([
					new vscode.LanguageModelTextPart(`Antigravity image generation failed: ${message}`),
				]);
			}
		},
	});
}
