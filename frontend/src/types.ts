export interface VideoFormat {
  id: string;
  label: string;
  directUrl: string;
  mimeType: string;
  hasAudio: boolean;
  hasVideo: boolean;
  hls: boolean;
  source: string;
  bandwidth: number;
  width: number;
  height: number;
  fps: number;
  ext: string;
  audioCodec: string;
  videoCodec: string;
  container: string;
  note: string;
}

export interface VideoMetaLike {
  author?: string;
  duration?: string | number;
  viewCount?: number;
  source?: string;
}

export interface VideoSummary {
  id: string;
  title: string;
  description?: string;
  thumbnail: string;
  author: string;
  channelId: string;
  duration: string | number;
  viewCount: number;
  publishedText?: string;
  url: string;
  source: string;
  hlsAvailable: boolean;
  formats: VideoFormat[];
}

export interface SearchResponse {
  source: string;
  results: VideoSummary[];
  error?: string;
  fallbackErrors?: Array<{ source: string; error: string }>;
}

export interface RelatedVideo {
  id: string;
  title: string;
  thumbnail: string;
  url: string;
  author?: string;
  duration?: string | number;
  source?: string;
  viewCount?: number;
}

export interface WatchResponse {
  source: string;
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  author: string;
  channelId: string;
  duration: string | number;
  viewCount: number;
  availability: string;
  ageLimit: number;
  isLive: boolean;
  drm: boolean;
  formats: VideoFormat[];
  hlsAvailable: boolean;
  hlsUrl: string;
  directUrl: string;
  relatedVideos: RelatedVideo[];
  selectedFormat?: VideoFormat | null;
  proxyPlayback?: boolean;
  proxyWarnings?: string[];
  directMode?: boolean;
  error?: string;
  fallbackErrors?: Array<{ source: string; error: string }>;
}

export interface HomeResponse {
  source: string;
  results: VideoSummary[];
  error?: string;
  fallbackErrors?: Array<{ source: string; error: string }>;
}

export interface ApiErrorPayload {
  error?: string;
  message?: string;
}

export interface RouteState {
  path: string;
  query: URLSearchParams;
  id: string;
  isHome: boolean;
  isSearch: boolean;
  isWatch: boolean;
}

export type RoutePayload = HomeResponse | SearchResponse | WatchResponse;
