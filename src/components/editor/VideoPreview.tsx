'use client';

import { useStore } from '@/store/useStore';
import { Play, Pause, RotateCcw, Volume2, Maximize2, Sparkles, Loader2 } from 'lucide-react';
import { Timeline } from './Timeline';
import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { llmClient } from '@/lib/llm/client';

export function VideoPreview() {
  const { 
    skeleton, 
    setSkeleton,
    currentTime, 
    setCurrentTime, 
    isPlaying, 
    setIsPlaying,
    setDuration,
    addMessage
  } = useStore();

  const [isRegeneratingAll, setIsRegeneratingAll] = useState(false);

  const handleRegenerateAll = async () => {
    if (isRegeneratingAll || !skeleton || skeleton.scenes.length === 0) return;

    setIsRegeneratingAll(true);
    addMessage({
      role: 'assistant',
      content: '开始为您重新生成所有镜头的视频...'
    });

    const scenes = skeleton.scenes;
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      if (!scene.imageUrl) continue;

      try {
        const { id: taskId } = await llmClient.generateVideo(scene.visualDescription, scene.imageUrl);
        
        let attempts = 0;
        const maxAttempts = 60;
        
        while (attempts < maxAttempts) {
          const { status, video_url } = await llmClient.queryVideoStatus(taskId);
          
          if (status === 'succeeded' && video_url) {
            setSkeleton(prev => {
              if (!prev) return null;
              const newScenes = [...prev.scenes];
              newScenes[i] = { ...newScenes[i], videoUrl: video_url };
              
              const newTracks = prev.tracks ? [...prev.tracks] : [];
              if (newTracks.length > 0) {
                const videoTrackIndex = newTracks.findIndex(t => t.name === 'Track 1');
                if (videoTrackIndex > -1) {
                  const newClips = [...newTracks[videoTrackIndex].clips];
                  const clipIndex = newClips.findIndex(c => c.id === `v-${scene.id}`);
                  if (clipIndex > -1) {
                    newClips[clipIndex] = { ...newClips[clipIndex], videoUrl: video_url };
                    newTracks[videoTrackIndex] = { ...newTracks[videoTrackIndex], clips: newClips };
                  }
                }
              }
              return { ...prev, scenes: newScenes, tracks: newTracks };
            });
            break;
          } else if (status === 'failed') {
            throw new Error(`Scene ${i+1} video generation failed`);
          }
          await new Promise(resolve => setTimeout(resolve, 5000));
          attempts++;
        }
      } catch (error) {
        console.error(`Error regenerating video for scene ${i}:`, error);
      }
    }

    setIsRegeneratingAll(false);
    addMessage({
      role: 'assistant',
      content: '所有视频重新生成完毕！'
    });
  };

  const scenes = skeleton?.scenes || [];
  const tracks = skeleton?.tracks || [];

  const totalDuration = useMemo(() => {
    if (tracks.length > 0) {
      return Math.max(...tracks.flatMap(t => t.clips.map(c => c.startTime + c.duration)), 0);
    }
    return scenes.reduce((acc, scene) => acc + (scene.duration || 0), 0);
  }, [scenes, tracks]);

  useEffect(() => {
    setDuration(totalDuration);
  }, [totalDuration, setDuration]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentTime((prev) => {
          if (prev >= totalDuration) {
            setIsPlaying(false);
            return totalDuration;
          }
          return prev + 0.1;
        });
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isPlaying, totalDuration, setCurrentTime, setIsPlaying]);

  // Find active clips at currentTime
  const activeClips = useMemo(() => {
    const active = {
      video: null as any,
      audio: [] as any[],
      text: null as any
    };

    tracks.forEach(track => {
      track.clips.forEach(clip => {
        if (currentTime >= clip.startTime && currentTime < clip.startTime + clip.duration) {
          if (clip.type === 'video') active.video = clip;
          if (clip.type === 'audio') active.audio.push(clip);
          if (clip.type === 'text') active.text = clip;
        }
      });
    });

    // Fallback to scenes if tracks not initialized
    if (!active.video && scenes.length > 0) {
      let elapsed = 0;
      for (const scene of scenes) {
        if (currentTime >= elapsed && currentTime < elapsed + (scene.duration || 0)) {
          active.video = { 
            content: scene.visualDescription, 
            imageUrl: scene.imageUrl,
            videoUrl: scene.videoUrl 
          };
          active.text = { content: scene.dialogueContent };
          break;
        }
        elapsed += (scene.duration || 0);
      }
    }

    return active;
  }, [tracks, scenes, currentTime]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden">
      {/* Video Player Section */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-zinc-50/30 relative">
        {/* Regenerate All Button */}
        <div className="absolute top-8 right-8 z-20">
          <button
            onClick={handleRegenerateAll}
            disabled={isRegeneratingAll || !skeleton}
            className={cn(
              "flex items-center gap-2 px-4 py-2 bg-white/90 backdrop-blur-md border border-black/5 rounded-full shadow-sm hover:bg-white transition-all text-[10px] uppercase tracking-widest font-medium disabled:opacity-50 disabled:cursor-not-allowed",
              isRegeneratingAll && "animate-pulse"
            )}
          >
            {isRegeneratingAll ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                正在重新生成...
              </>
            ) : (
              <>
                <Sparkles className="w-3 h-3" />
                全部重新生成视频
              </>
            )}
          </button>
        </div>

        <div className="w-full max-w-4xl aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl relative group">
          {/* Mock Video Placeholder / Video Player */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {activeClips.video?.videoUrl ? (
              <video 
                key={activeClips.video.videoUrl}
                src={activeClips.video.videoUrl} 
                autoPlay 
                muted 
                loop 
                className="w-full h-full object-cover transition-opacity duration-300"
              />
            ) : activeClips.video?.imageUrl ? (
              <img 
                src={activeClips.video.imageUrl} 
                alt="Preview" 
                className="w-full h-full object-cover transition-opacity duration-300"
              />
            ) : (
              <div className="flex flex-col items-center space-y-4">
                <div 
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 group-hover:scale-110 transition-transform cursor-pointer"
                >
                  {isPlaying ? (
                    <Pause className="w-6 h-6 text-white fill-current" />
                  ) : (
                    <Play className="w-6 h-6 text-white fill-current" />
                  )}
                </div>
                <p className="text-white/40 font-serif italic text-sm tracking-widest px-12 text-center">
                  {activeClips.video?.content || skeleton?.theme || '预览生成中...'}
                </p>
              </div>
            )}
          </div>

          {/* Subtitles Overlay */}
          {activeClips.text?.content && (
            <div className="absolute bottom-16 inset-x-0 flex justify-center px-12 pointer-events-none">
              <p className="bg-black/40 backdrop-blur-md text-white px-4 py-2 rounded text-sm font-light tracking-wide text-center">
                {activeClips.text.content}
              </p>
            </div>
          )}

          {/* Video Controls Overlay */}
          <div className="absolute bottom-0 inset-x-0 p-6 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <button onClick={() => setIsPlaying(!isPlaying)}>
                  {isPlaying ? (
                    <Pause className="w-4 h-4 text-white cursor-pointer" />
                  ) : (
                    <Play className="w-4 h-4 text-white cursor-pointer" />
                  )}
                </button>
                <div className="h-1 w-48 bg-white/20 rounded-full overflow-hidden relative cursor-pointer">
                  <div 
                    className="h-full bg-white transition-all duration-100" 
                    style={{ width: `${(currentTime / totalDuration) * 100}%` }}
                  />
                </div>
                <span className="text-[10px] font-mono text-white/60">
                  {formatTime(currentTime)} / {formatTime(totalDuration)}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <Volume2 className="w-4 h-4 text-white cursor-pointer" />
                <RotateCcw 
                  className="w-4 h-4 text-white cursor-pointer" 
                  onClick={() => {
                    setCurrentTime(0);
                    setIsPlaying(false);
                  }}
                />
                <Maximize2 className="w-4 h-4 text-white cursor-pointer" />
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-8 text-center">
          <p className="text-black/30 text-[10px] uppercase tracking-[0.2em] font-medium">
            实时画面预览
          </p>
        </div>
      </div>

      {/* Timeline Section */}
      <Timeline />
    </div>
  );
}
