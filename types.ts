export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
}

export interface AnalysisResult {
  text: string;
  groundingChunks: GroundingChunk[];
}

export enum AppState {
  HOME = 'HOME',
  CAMERA = 'CAMERA',
  PREVIEW = 'PREVIEW',
  ANALYZING = 'ANALYZING',
  RESULT = 'RESULT',
  ERROR = 'ERROR',
}

export interface ImageFile {
  data: string; // Base64 string
  mimeType: string;
}