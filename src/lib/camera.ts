export type FacingMode = 'environment' | 'user';

export type CameraErrorKind = 'permission-denied' | 'no-camera' | 'unknown';

export class CameraError extends Error {
	kind: CameraErrorKind;
	constructor(kind: CameraErrorKind, message: string) {
		super(message);
		this.kind = kind;
		this.name = 'CameraError';
	}
}

export async function startStream(facingMode: FacingMode): Promise<MediaStream> {
	// Ask for the highest practical resolution; `ideal` lets the browser fall
	// back gracefully to whatever the camera actually supports.
	const constraints: MediaStreamConstraints = {
		video: {
			facingMode,
			width: { ideal: 3840 },
			height: { ideal: 2160 }
		}
	};
	try {
		return await navigator.mediaDevices.getUserMedia(constraints);
	} catch (e) {
		if (e instanceof DOMException) {
			if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
				throw new CameraError('permission-denied', 'Camera permission was denied.');
			}
			if (e.name === 'NotFoundError' || e.name === 'DevicesNotFoundError') {
				throw new CameraError('no-camera', 'No camera was found on this device.');
			}
		}
		throw new CameraError('unknown', 'Could not start the camera.');
	}
}

export function stopStream(stream: MediaStream): void {
	for (const track of stream.getTracks()) {
		track.stop();
	}
}

export function captureFrame(video: HTMLVideoElement): Promise<Blob> {
	return new Promise((resolve, reject) => {
		const canvas = document.createElement('canvas');
		canvas.width = video.videoWidth;
		canvas.height = video.videoHeight;
		const ctx = canvas.getContext('2d');
		if (!ctx) return reject(new Error('Could not get canvas 2D context.'));
		ctx.drawImage(video, 0, 0);
		canvas.toBlob(
			(blob) => {
				if (blob) resolve(blob);
				else reject(new Error('canvas.toBlob returned null.'));
			},
			'image/jpeg',
			0.95
		);
	});
}
