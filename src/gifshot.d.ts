declare module 'gifshot' {
  interface GIFOptions {
    video?: string[];
    images?: string[] | { src: string }[];
    gifWidth?: number;
    gifHeight?: number;
    interval?: number;
    numFrames?: number;
    frameDuration?: number;
    fontWeight?: string;
    fontSize?: string;
    fontFamily?: string;
    fontColor?: string;
    textAlign?: string;
    textBaseline?: string;
    text?: string;
    showProgressBar?: boolean;
    progressCallback?: (captureProgress: number) => void;
    sampleInterval?: number;
    numWorkers?: number;
    filter?: string;
  }

  interface GIFResult {
    error: boolean;
    errorCode?: string;
    errorMessage?: string;
    image: string; // Base64 data URL
  }

  export function createGIF(
    options: GIFOptions,
    callback: (result: GIFResult) => void
  ): void;

  export function isSupported(): boolean;
  export function isWebCamGIFSupported(): boolean;
}
