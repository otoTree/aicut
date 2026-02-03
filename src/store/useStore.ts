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

export interface SeriesBible {
  id: string;
  name: string; // Novel Title
  artStyle: string;
  characters: Character[]; // Global Characters
  sceneDesigns: SceneDesign[]; // Global Recurring Scenes
}

export interface EpisodeSummary {
  id: string;
  index: number; // 1-10
  title: string;
  summary: string; // Plot for this episode
  status: 'pending' | 'generated';
  skeletonId?: string; // Link to the full VideoSkeleton
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
  mode: 'single' | 'series';
  outputLanguage: 'zh' | 'en' | 'ja'; // New global language setting
  prompt: string;
  skeleton: VideoSkeleton | null;
  
  // Series State
  novelContent: string;
  seriesBible: SeriesBible | null;
  episodes: EpisodeSummary[];
  episodeSkeletons: Record<string, VideoSkeleton>;
  currentEpisodeId: string | null;
  
  currentStep: number;
  messages: Message[];
  isGenerating: boolean;
  generatingSceneId: string | null;
  isSkeletonComplete: boolean;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  
  setView: (view: 'home' | 'editor') => void;
  setMode: (mode: 'single' | 'series') => void;
  setOutputLanguage: (lang: 'zh' | 'en' | 'ja') => void; // Setter
  setPrompt: (prompt: string) => void;
  setSkeleton: (skeleton: VideoSkeleton | null | ((prev: VideoSkeleton | null) => VideoSkeleton | null)) => void;
  
  // Series Actions
  setNovelContent: (content: string) => void;
  setSeriesBible: (bible: SeriesBible | null) => void;
  setEpisodes: (episodes: EpisodeSummary[]) => void;
  updateEpisodeSkeleton: (episodeId: string, skeleton: VideoSkeleton) => void;
  setCurrentEpisodeId: (id: string | null) => void;
  
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
      mode: 'single',
      outputLanguage: 'zh', // Default to Chinese
      prompt: '',
      skeleton: null,
      
      // Series Initial State
      novelContent: '',
      seriesBible: null,
      episodes: [],
      episodeSkeletons: {},
      currentEpisodeId: null,
      
      currentStep: 0,
      messages: [],
      isGenerating: false,
      generatingSceneId: null,
      isSkeletonComplete: false,
      currentTime: 0,
      duration: 0,
      isPlaying: false,
      
      setView: (view) => set({ view }),
      setMode: (mode) => set({ mode }),
      setOutputLanguage: (lang) => set({ outputLanguage: lang }),
      setPrompt: (prompt) => set({ prompt }),
      setSkeleton: (skeleton) => set((state) => ({ 
        skeleton: typeof skeleton === 'function' ? skeleton(state.skeleton) : skeleton 
      })),
      
      setNovelContent: (content) => set({ novelContent: content }),
      setSeriesBible: (bible) => set({ seriesBible: bible }),
      setEpisodes: (episodes) => set({ episodes }),
      updateEpisodeSkeleton: (episodeId, skeleton) => set((state) => ({
        episodeSkeletons: { ...state.episodeSkeletons, [episodeId]: skeleton }
      })),
      setCurrentEpisodeId: (id) => set({ currentEpisodeId: id }),
      
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
        mode: 'single',
        outputLanguage: 'zh',
        novelContent: '',
        seriesBible: null,
        episodes: [],
        episodeSkeletons: {},
        currentEpisodeId: null,
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
        prompt: state.prompt,
        mode: state.mode,
        outputLanguage: state.outputLanguage, // Persist language setting
        novelContent: state.novelContent,
        seriesBible: state.seriesBible,
        episodes: state.episodes,
        episodeSkeletons: state.episodeSkeletons,
        currentEpisodeId: state.currentEpisodeId
      }),
    }
  )
);