import Dexie, { Table } from 'dexie';
import { VideoSkeleton, SeriesBible, EpisodeSummary } from '@/store/useStore';

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

export interface SeriesData {
  novelContent: string;
  bible: SeriesBible;
  episodes: EpisodeSummary[];
  episodeSkeletons: Record<string, VideoSkeleton>;
}

export interface Project {
  id?: number;
  name: string;
  type: 'single' | 'series';
  data: VideoSkeleton | SeriesData;
  updatedAt: number;
  thumbnail?: string;
}

export class AICutDatabase extends Dexie {
  history!: Table<HistoryItem>;
  assets!: Table<Asset>;
  projects!: Table<Project>;

  constructor() {
    super('AICutDatabase');
    this.version(1).stores({
      history: '++id, timestamp, prompt'
    });
    this.version(2).stores({
      history: '++id, timestamp, prompt',
      assets: 'id, type, createdAt'
    });
    this.version(3).stores({
      history: '++id, timestamp, prompt',
      assets: 'id, type, createdAt',
      projects: '++id, name, type, updatedAt'
    });
  }
}

export const db = new AICutDatabase();
