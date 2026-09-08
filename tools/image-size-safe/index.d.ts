export type ImageSizeResult = {
  height: number;
  images?: ImageSizeResult[];
  orientation?: number;
  type?: string;
  width: number;
};

export declare function imageSize(input: Uint8Array | string): ImageSizeResult;
export declare function imageSize(input: string, callback: (error: Error | null, result?: ImageSizeResult) => void): void;
export default imageSize;
export declare const disableFS: (value: boolean) => void;
export declare const disableTypes: (types: string[]) => void;
export declare const setConcurrency: (concurrency: number) => void;
export declare const types: string[];
