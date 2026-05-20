export interface UploadItem {
  link: string;
  deletehash: string;
  tags: string[];
  title?: string;
  aiDescription?: string;
}

export interface ChromeStorage {
  uploadHistory: UploadItem[];
  imgurClientId: string;
  imgurTags: string[];
  currentFilterTag: string;
  geminiApiKey?: string;
  geminiModel?: string;
}

export const DEFAULT_TAGS = ['未分類'];
