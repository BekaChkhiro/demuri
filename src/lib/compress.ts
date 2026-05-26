export async function compressImage(
	blob: Blob,
	maxEdge = 1600,
	quality = 0.82
): Promise<Blob> {
	const bitmap = await createImageBitmap(blob);
	const { width, height } = bitmap;

	const longest = Math.max(width, height);
	if (longest <= maxEdge) {
		bitmap.close();
		return blob;
	}

	const scale = maxEdge / longest;
	const targetW = Math.round(width * scale);
	const targetH = Math.round(height * scale);

	const canvas = new OffscreenCanvas(targetW, targetH);
	const ctx = canvas.getContext('2d');
	if (!ctx) {
		bitmap.close();
		return blob;
	}

	ctx.drawImage(bitmap, 0, 0, targetW, targetH);
	bitmap.close();

	const compressed = await canvas.convertToBlob({ type: 'image/jpeg', quality });
	return compressed.size < blob.size ? compressed : blob;
}
