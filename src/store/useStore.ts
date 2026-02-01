import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

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
  audioUrl?: string;
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
  audioUrl?: string;
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
  generatingSceneId: string | null;
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
  setGeneratingSceneId: (id: string | null) => void;
  setIsSkeletonComplete: (isComplete: boolean) => void;
  setCurrentTime: (time: number | ((prev: number) => number)) => void;
  setDuration: (duration: number) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  reset: () => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      view: 'home',
      prompt: '',
      skeleton: null,
      currentStep: 0,
      messages: [],
      isGenerating: false,
      generatingSceneId: null,
      isSkeletonComplete: false,
      currentTime: 0,
      duration: 0,
      isPlaying: false,
      setView: (view) => set({ view }),
      setPrompt: (prompt) => set({ prompt }),
      setSkeleton: (skeleton) => set((state) => ({ 
        skeleton: typeof skeleton === 'function' ? skeleton(state.skeleton) : skeleton 
      })),
      setCurrentStep: (step) => set({ currentStep: step }),
      addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
      setIsGenerating: (isGenerating) => set({ isGenerating }),
      setGeneratingSceneId: (generatingSceneId) => set({ generatingSceneId }),
      setIsSkeletonComplete: (isSkeletonComplete) => set({ isSkeletonComplete }),
      setCurrentTime: (time) => set((state) => ({ 
        currentTime: typeof time === 'function' ? time(state.currentTime) : time 
      })),
      setDuration: (duration) => set({ duration }),
      setIsPlaying: (isPlaying) => set({ isPlaying }),
      reset: () => set({
        prompt: '',
        skeleton: null,
        currentStep: 0,
        messages: [],
        isGenerating: false,
        generatingSceneId: null,
        isSkeletonComplete: false,
        currentTime: 0,
        duration: 0,
        isPlaying: false,
      }),
    }),
    {
      name: 'aicut-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ 
        skeleton: state.skeleton, 
        currentStep: state.currentStep,
        messages: state.messages,
        prompt: state.prompt
      }),
    }
  )
);
