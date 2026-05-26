// Stamps the demuri / ბოლოზარი logo onto every captured photo, client-side,
// before upload — so the watermark is baked into what lands in R2.
//
// Uses HTMLImageElement + a regular <canvas> + toBlob (not OffscreenCanvas /
// createImageBitmap) so it works on iOS Safari, the primary capture device.

let logoPromise: Promise<HTMLImageElement> | null = null;

/** Load the logo once, then reuse the decoded <img> across captures. */
function loadLogo(): Promise<HTMLImageElement> {
	if (!logoPromise) {
		logoPromise = new Promise((resolve, reject) => {
			const img = new Image();
			img.onload = () => resolve(img);
			img.onerror = () => reject(new Error('logo failed to load'));
			img.src = '/demuri-logo.png';
		});
	}
	return logoPromise;
}

/** Decode a photo blob into an <img> via a temporary object URL. */
function loadBlob(blob: Blob): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const url = URL.createObjectURL(blob);
		const img = new Image();
		img.onload = () => {
			URL.revokeObjectURL(url);
			resolve(img);
		};
		img.onerror = () => {
			URL.revokeObjectURL(url);
			reject(new Error('photo failed to load'));
		};
		img.src = url;
	});
}

/**
 * Draw the logo as a watermark in the bottom-right corner of `blob`, sized
 * relative to the photo with a soft shadow so it stays legible over bright
 * areas. Best-effort: any failure returns the original blob untouched so a
 * watermark hiccup never blocks the upload.
 */
export async function watermark(blob: Blob, quality = 0.82): Promise<Blob> {
	let photo: HTMLImageElement;
	let logo: HTMLImageElement;
	try {
		[photo, logo] = await Promise.all([loadBlob(blob), loadLogo()]);
	} catch {
		return blob;
	}

	const w = photo.naturalWidth;
	const h = photo.naturalHeight;
	if (!w || !h) return blob;

	const canvas = document.createElement('canvas');
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext('2d');
	if (!ctx) return blob;

	ctx.drawImage(photo, 0, 0);

	// Logo at ~32% of the photo width, 4% margin from the edges.
	const margin = Math.round(w * 0.04);
	const logoW = Math.round(w * 0.32);
	const logoH = Math.round((logo.naturalHeight / logo.naturalWidth) * logoW);
	const x = w - logoW - margin;
	const y = h - logoH - margin;

	ctx.save();
	ctx.globalAlpha = 0.92;
	ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
	ctx.shadowBlur = Math.max(2, Math.round(logoW * 0.04));
	ctx.shadowOffsetY = 2;
	ctx.drawImage(logo, x, y, logoW, logoH);
	ctx.restore();

	return new Promise((resolve) => {
		canvas.toBlob((out) => resolve(out ?? blob), 'image/jpeg', quality);
	});
}
