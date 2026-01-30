import Dexie, { Table } from 'dexie';
import { VideoSkeleton } from '@/store/useStore';

export interface HistoryItem {
  id?: number;
  timestamp: number;
  prompt: string;
  skeleton: VideoSkeleton;
  thumbnail?: string;
}

export interface Asset {
  id: string; // usually sceneId or unique ID
  blob: Blob;
  type: 'audio' | 'video' | 'image';
  createdAt: number;
}

export class AICutDatabase extends Dexie {
  history!: Table<HistoryItem>;
  assets!: Table<Asset>;

  constructor() {
    super('AICutDatabase');
    this.version(1).stores({
      history: '++id, timestamp, prompt'
    });
    this.version(2).stores({
      history: '++id, timestamp, prompt',
      assets: 'id, type, createdAt'
    });
  }
}

export const db = new AICutDatabase();
