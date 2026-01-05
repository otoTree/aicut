import { create } from 'zustand';

export interface Scene {
  id: string;
  visualDescription: string;
  characterIds?: string[];
  sceneId?: string;
  cameraDesign: string;
  audioDesign: string;
  voiceActor: string;
  dialogueContent: string;
  duration: number;
  imageUrl?: string;
  videoUrl?: string;
}

export interface Character {
  id: string;
  prototype: string;
  description: string;
  imageUrl?: string;
}

export interface SceneDesign {
  id: string;
  prototype: string;
  description: string;
  imageUrl?: string;
}

export type ClipType = 'video' | 'audio' | 'text';

export interface Clip {
  id: string;
  type: ClipType;
  startTime: number;
  duration: number;
  content: string;
  imageUrl?: string;
  videoUrl?: string;
  title?: string;
}

export interface Track {
  id: string;
  name: string;
  clips: Clip[];
}

export interface VideoSkeleton {
  theme: string;
  storyOverview: string;
  artStyle: string;
  characters: Character[];
  sceneDesigns: SceneDesign[];
  scenes: Scene[];
  tracks?: Track[];
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  imageUrl?: string;
  type?: 'text' | 'action_request';
  actionType?: 'start_video_generation';
}

export interface AppState {
  view: 'home' | 'editor';
  prompt: string;
  skeleton: VideoSkeleton | null;
  currentStep: number;
  messages: Message[];
  isGenerating: boolean;
  isSkeletonComplete: boolean;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  setView: (view: 'home' | 'editor') => void;
  setPrompt: (prompt: string) => void;
  setSkeleton: (skeleton: VideoSkeleton | null | ((prev: VideoSkeleton | null) => VideoSkeleton | null)) => void;
  setCurrentStep: (step: number) => void;
  addMessage: (message: Message) => void;
  setIsGenerating: (isGenerating: boolean) => void;
  setIsSkeletonComplete: (isComplete: boolean) => void;
  setCurrentTime: (time: number | ((prev: number) => number)) => void;
  setDuration: (duration: number) => void;
  setIsPlaying: (isPlaying: boolean) => void;
}

export const useStore = create<AppState>((set) => ({
  view: 'home',
  prompt: '',
  skeleton: null,
  currentStep: 0,
  messages: [],
  isGenerating: false,
  isSkeletonComplete: false,
  currentTime: 0,
  duration: 0,
  isPlaying: false,
  setView: (view) => set({ view }),
  setPrompt: (prompt) => set({ prompt }),
  setSkeleton: (skeleton) => set((state) => ({ 
    skeleton: typeof skeleton === 'function' ? skeleton(state.skeleton) : skeleton 
  })),
  setCurrentStep: (currentStep) => set({ currentStep }),
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  setIsGenerating: (isGenerating) => set({ isGenerating }),
  setIsSkeletonComplete: (isSkeletonComplete) => set({ isSkeletonComplete }),
  setCurrentTime: (currentTime) => set((state) => ({ 
    currentTime: typeof currentTime === 'function' ? currentTime(state.currentTime) : currentTime 
  })),
  setDuration: (duration) => set({ duration }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
}));
