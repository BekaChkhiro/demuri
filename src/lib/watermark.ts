// Stamps the demuri / ბოლოზარი logo onto every captured photo, client-side,
// before upload — so the watermark is baked into what lands in R2.

let logoPromise: Promise<ImageBitmap> | null = null;

/** Fetch + decode the logo once, then reuse the bitmap across captures. */
function loadLogo(): Promise<ImageBitmap> {
	if (!logoPromise) {
		logoPromise = fetch('/demuri-logo.png')
			.then((r) => r.blob())
			.then((b) => createImageBitmap(b));
	}
	return logoPromise;
}

/**
 * Draw the logo as a watermark in the bottom-right corner of `blob`, sized
 * relative to the photo with a soft shadow so it stays legible over bright
 * areas. Best-effort: any failure returns the original blob untouched so a
 * watermark hiccup never blocks the upload.
 */
export async function watermark(blob: Blob, quality = 0.82): Promise<Blob> {
	let photo: ImageBitmap;
	let logo: ImageBitmap;
	try {
		[photo, logo] = await Promise.all([createImageBitmap(blob), loadLogo()]);
	} catch {
		return blob;
	}

	const canvas = new OffscreenCanvas(photo.width, photo.height);
	const ctx = canvas.getContext('2d');
	if (!ctx) {
		photo.close();
		return blob;
	}

	ctx.drawImage(photo, 0, 0);

	// Logo at ~26% of the photo width, 4% margin from the edges.
	const margin = Math.round(photo.width * 0.04);
	const logoW = Math.round(photo.width * 0.26);
	const logoH = Math.round((logo.height / logo.width) * logoW);
	const x = photo.width - logoW - margin;
	const y = photo.height - logoH - margin;

	ctx.save();
	ctx.globalAlpha = 0.92;
	ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
	ctx.shadowBlur = Math.max(2, Math.round(logoW * 0.04));
	ctx.shadowOffsetY = 2;
	ctx.drawImage(logo, x, y, logoW, logoH);
	ctx.restore();

	photo.close();
	// logo bitmap is cached for reuse — do not close it.

	return canvas.convertToBlob({ type: 'image/jpeg', quality });
}
