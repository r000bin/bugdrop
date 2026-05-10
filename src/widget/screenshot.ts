import * as htmlToImage from 'html-to-image';

const CAPTURE_TIMEOUT_MS = 15_000;
const DOM_COMPLEXITY_THRESHOLD = 3_000;
export const FULL_PAGE_DISABLE_THRESHOLD = 10_000;

type DisplayMediaOptionsWithCurrentTab = DisplayMediaStreamOptions & {
  preferCurrentTab?: boolean;
};

type VideoElementWithFrameCallback = HTMLVideoElement & {
  requestVideoFrameCallback?: (callback: () => void) => number;
};

declare global {
  interface Window {
    __bugdropMockViewportCapture?: () => Promise<string>;
  }
}

export function getDomNodeCount(): number {
  return document.body.querySelectorAll('*').length;
}

export function isFullPageDisabled(): boolean {
  return getDomNodeCount() >= FULL_PAGE_DISABLE_THRESHOLD;
}

export function getPixelRatio(isFullPage: boolean, screenshotScale?: number): number {
  if (isFullPage && getDomNodeCount() > DOM_COMPLEXITY_THRESHOLD) {
    return 1;
  }
  const minScale = screenshotScale ?? 2;
  return Math.max(window.devicePixelRatio || 1, minScale);
}

export function canCaptureViewportNatively(): boolean {
  const isSecureOrigin =
    window.isSecureContext ||
    location.protocol === 'https:' ||
    location.hostname === 'localhost' ||
    location.hostname === '127.0.0.1';
  const hasCaptureApi =
    typeof window.__bugdropMockViewportCapture === 'function' ||
    typeof navigator.mediaDevices?.getDisplayMedia === 'function';

  return isSecureOrigin && hasCaptureApi;
}

export function beginViewportCapture(): Promise<string> {
  if (window.__bugdropMockViewportCapture) {
    return window.__bugdropMockViewportCapture();
  }

  if (!navigator.mediaDevices?.getDisplayMedia) {
    return Promise.reject(new Error('Screen Capture API is not available'));
  }

  const displayMediaOptions: DisplayMediaOptionsWithCurrentTab = {
    video: { displaySurface: 'browser' },
    audio: false,
    preferCurrentTab: true,
  };

  return withCaptureTimeout(
    navigator.mediaDevices.getDisplayMedia(displayMediaOptions).then(stream => {
      return captureVideoFrame(stream);
    })
  );
}

async function captureVideoFrame(stream: MediaStream): Promise<string> {
  validateBrowserSurface(stream);

  const video = document.createElement('video') as VideoElementWithFrameCallback;
  video.muted = true;
  video.playsInline = true;

  try {
    await waitForVideoFrame(video, stream);

    const width = video.videoWidth || window.innerWidth;
    const height = video.videoHeight || window.innerHeight;
    if (!width || !height) {
      throw new Error('Screen capture stream did not provide a video frame');
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    ctx.drawImage(video, 0, 0, width, height);
    return canvas.toDataURL('image/png');
  } finally {
    for (const track of stream.getTracks()) {
      track.stop();
    }
    video.srcObject = null;
  }
}

function validateBrowserSurface(stream: MediaStream): void {
  const [track] = stream.getVideoTracks();
  const displaySurface = track?.getSettings().displaySurface;
  if (displaySurface && displaySurface !== 'browser') {
    for (const streamTrack of stream.getTracks()) {
      streamTrack.stop();
    }
    throw new Error('Please choose the current browser tab for viewport capture');
  }
}

async function waitForVideoFrame(
  video: VideoElementWithFrameCallback,
  stream: MediaStream
): Promise<void> {
  video.srcObject = stream;
  await video.play().catch(() => {
    // Some browsers expose the first frame after metadata without requiring play().
  });

  if (video.requestVideoFrameCallback) {
    await Promise.race([
      new Promise<void>(resolve => video.requestVideoFrameCallback?.(() => resolve())),
      delay(250),
    ]);
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      return;
    }
  }

  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    return;
  }

  await Promise.race([
    new Promise<void>((resolve, reject) => {
      const onReady = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new Error('Failed to load screen capture stream'));
      };
      const cleanup = () => {
        video.removeEventListener('loadeddata', onReady);
        video.removeEventListener('canplay', onReady);
        video.removeEventListener('error', onError);
      };

      video.addEventListener('loadeddata', onReady);
      video.addEventListener('canplay', onReady);
      video.addEventListener('error', onError);
    }),
    delay(250),
  ]);
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function withCaptureTimeout<T>(capturePromise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error('Screenshot capture timed out — the page may be too complex')),
      CAPTURE_TIMEOUT_MS
    );
  });

  return Promise.race([capturePromise, timeoutPromise]).finally(() => clearTimeout(timer!));
}

export async function captureScreenshot(
  element?: Element,
  screenshotScale?: number
): Promise<string> {
  const target = element || document.body;
  const isFullPage = !element;

  const pixelRatio = getPixelRatio(isFullPage, screenshotScale);

  const toPng =
    (window as unknown as { __bugdropMockToPng?: typeof htmlToImage.toPng }).__bugdropMockToPng ??
    htmlToImage.toPng;

  const opts = {
    cacheBust: true,
    pixelRatio,
    filter: (node: HTMLElement) => node.id !== 'bugdrop-host',
  };

  const capturePromise = toPng(target as HTMLElement, opts);

  return withCaptureTimeout(capturePromise);
}

export async function cropScreenshot(
  imageDataUrl: string,
  rect: DOMRect,
  pixelRatio: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const cropW = Math.round(rect.width * pixelRatio);
      const cropH = Math.round(rect.height * pixelRatio);
      canvas.width = cropW;
      canvas.height = cropH;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      ctx.drawImage(
        img,
        Math.round(rect.x * pixelRatio),
        Math.round(rect.y * pixelRatio),
        cropW,
        cropH,
        0,
        0,
        cropW,
        cropH
      );

      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('Failed to load image for cropping'));
    img.src = imageDataUrl;
  });
}
