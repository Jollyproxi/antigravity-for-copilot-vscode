import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { AgyGeneratedImage, detectImageMime } from './agyImage';

export interface ImageArtifactReference {
	uri: string;
}

const EXTENSIONS: Record<string, string> = {
	'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp',
};

/** Persist only returned raster bytes, never a path or URI supplied by the model. */
export class ImageArtifactStore {
	private readonly references = new Map<string, ImageArtifactReference>();

	constructor(private readonly storageDirectory: string) {}

	async save(images: readonly AgyGeneratedImage[]): Promise<ImageArtifactReference[]> {
		if (images.length < 1 || images.length > 4) throw new Error('Invalid image count.');
		let total = 0;
		for (const image of images) {
			total += image.data.length;
			if (image.data.length === 0 || image.data.length > 20 * 1024 * 1024 ||
				detectImageMime(image.data) !== image.mimeType || !EXTENSIONS[image.mimeType]) {
				throw new Error('Invalid raster image.');
			}
		}
		if (total > 32 * 1024 * 1024) throw new Error('Image output exceeds the total size limit.');
		await fs.mkdir(this.storageDirectory, { recursive: true });
		const storage = await fs.realpath(this.storageDirectory);
		const directory = path.join(storage, 'generated-images');
		await fs.mkdir(directory, { recursive: true });
		if (await fs.realpath(directory) !== directory) throw new Error('Image storage must not redirect to another directory.');
		const created: string[] = [];
		const references: ImageArtifactReference[] = [];
		try {
			for (const image of images) {
				const file = path.join(directory, `${randomUUID()}.${EXTENSIONS[image.mimeType]}`);
				// Exclusive creation avoids overwriting another artifact or following a file symlink.
				const handle = await fs.open(file, 'wx');
				created.push(file);
				try { await handle.writeFile(image.data); } finally { await handle.close(); }
				const uri = pathToFileURL(file).href.replace(/[()]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
				references.push({ uri });
			}
		} catch (error) {
			await Promise.all(created.map(file => fs.unlink(file).catch(() => {})));
			throw error;
		}
		for (const reference of references) {
			this.references.set(reference.uri, reference);
			if (this.references.size > 64) this.references.delete(this.references.keys().next().value!);
		}
		return references;
	}

	/** Match only references created in this extension session; never accept arbitrary URIs. */
	findInText(text: string): ImageArtifactReference[] {
		return [...this.references.values()].filter(reference => text.includes(reference.uri));
	}
}

export function imageReferenceMarkdown(reference: ImageArtifactReference, index: number): string {
	return `![Generated image ${index + 1}](${reference.uri})\n\n[Open image ${index + 1}](${reference.uri})`;
}

export function missingImagePreviews(references: readonly ImageArtifactReference[], answer: string): string {
	return references.map((reference, index) => {
		const escaped = reference.uri.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const alreadyEmbedded = new RegExp(`!\\[[^\\]]*\\]\\(\\s*<?${escaped}>?(?:\\s+"[^"\\n]*")?\\s*\\)`).test(answer);
		return alreadyEmbedded ? '' : imageReferenceMarkdown(reference, index);
	}).filter(Boolean).join('\n\n');
}
