'use client';

import { useStore } from '@/store/useStore';
import Image from 'next/image';
import { Play, Pause, RotateCcw, Volume2, VolumeX, Maximize2, Sparkles, Loader2, Download, Film } from 'lucide-react';
import { Timeline } from './Timeline';
import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { llmClient } from '@/lib/llm/client';
import { db } from '@/lib/db-client';
import { useVideoExporter } from '@/lib/useVideoExporter';

function BackgroundVideo({ 
  url, 
  isActive, 
  isPlaying, 
  isMuted,
  onDurationLoaded 
}: { 
  url: string, 
  isActive: boolean, 
  isPlaying: boolean, 
  isMuted: boolean,
  onDurationLoaded?: (duration: number) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (isActive && videoRef.current) {
      videoRef.current.currentTime = 0;
    }
  }, [isActive]);

  useEffect(() => {
    if (!videoRef.current) return;
    
    // Sync mute state
    videoRef.current.muted = isMuted;

    if (isActive && isPlaying) {
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {});
      }
    } else {
      videoRef.current.pause();
    }
  }, [isActive, isPlaying, isMuted]);

  return (
    <video 
      ref={videoRef}
      src={url} 
      muted={isMuted}
      loop 
      preload="auto"
      onLoadedMetadata={(e) => {
        const duration = e.currentTarget.duration;
        if (duration && duration !== Infinity) {
          onDurationLoaded?.(duration);
        }
      }}
      className={cn(
        "absolute inset-0 w-full h-full object-cover transition-opacity duration-300",
        isActive ? "opacity-100 z-10" : "opacity-0 z-0"
      )}
    />
  );
}

function BackgroundAudio({ url, isActive, isPlaying, currentTime, startTime, isMuted }: { url: string, isActive: boolean, isPlaying: boolean, currentTime: number, startTime: number, isMuted: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (!audioRef.current) return;
    
    audioRef.current.muted = isMuted;

    if (isActive) {
      // Sync time if needed (allow 0.5s drift)
      const expectedTime = Math.max(0, currentTime - startTime);
      if (Math.abs(audioRef.current.currentTime - expectedTime) > 0.5) {
        audioRef.current.currentTime = expectedTime;
      }

      if (isPlaying) {
        audioRef.current.play().catch(() => {});
      } else {
        audioRef.current.pause();
      }
    } else {
      audioRef.current.pause();
      // audioRef.current.currentTime = 0; // Optional: reset
    }
  }, [isActive, isPlaying, currentTime, startTime, isMuted]);

  return <audio ref={audioRef} src={url} />;
}

export function VideoPreview() {
  const { 
    skeleton, 
    setSkeleton,
    currentTime, 
    setCurrentTime, 
    isPlaying, 
    setIsPlaying,
    setDuration,
    addMessage,
    generatingSceneId,
    setGeneratingSceneId,
    aspectRatio
  } = useStore();
  const [isMuted, setIsMuted] = useState(false);
  
  const effectiveAspectRatio = skeleton?.aspectRatio ?? aspectRatio;

  const [isRegeneratingAll, setIsRegeneratingAll] = useState(false);

  const { exportVideo, isExporting, progress: exportProgress } = useVideoExporter();

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

      setGeneratingSceneId(scene.id);
      
      try {
        // Construct prompt with dialogue for lip-sync
        let finalPrompt = scene.visualDescription;
        if (scene.dialogueContent) {
          finalPrompt = `${scene.visualDescription} Character says: "${scene.dialogueContent}"`;
        }

        // Determine lastImageUrl for continuity (use next scene's first frame as current scene's last frame)
        // Except for the last scene, which should not have a tail frame
        let lastImageUrl = undefined;
        if (i < scenes.length - 1) {
          const nextScene = scenes[i + 1];
          if (nextScene && nextScene.imageUrl) {
            lastImageUrl = nextScene.imageUrl;
          }
        }

        const effectiveAspectRatio = skeleton.aspectRatio ?? aspectRatio;
        const { id: taskId } = await llmClient.generateVideo(finalPrompt, scene.imageUrl, undefined, effectiveAspectRatio, lastImageUrl);
        
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

    setGeneratingSceneId(null);
    setIsRegeneratingAll(false);
    
    // 保存到历史记录
    try {
      const finalSkeleton = useStore.getState().skeleton;
      if (finalSkeleton) {
        await db.history.add({
          timestamp: Date.now(),
          prompt: finalSkeleton.theme || 'Untitled',
          skeleton: finalSkeleton,
          thumbnail: finalSkeleton.scenes[0]?.imageUrl
        });
        console.log('Saved regeneration to history');
      }
    } catch (error) {
      console.error('Failed to save history:', error);
    }

    addMessage({
      role: 'assistant',
      content: '所有视频重新生成完毕！已自动保存到历史记录。'
    });
  };

  const scenes = useMemo(() => skeleton?.scenes || [], [skeleton?.scenes]);
  const tracks = useMemo(() => skeleton?.tracks || [], [skeleton?.tracks]);

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

    if (tracks.length > 0) {
      tracks.forEach(track => {
        track.clips.forEach(clip => {
          if (currentTime >= clip.startTime && currentTime < clip.startTime + clip.duration) {
            if (clip.type === 'video') {
              active.video = clip;
              // Robustness check: if clip has no videoUrl but corresponding scene does, use scene's videoUrl
              if (!clip.videoUrl && scenes.length > 0 && clip.id.startsWith('v-')) {
                const sceneId = clip.id.substring(2);
                const scene = scenes.find(s => s.id === sceneId);
                if (scene?.videoUrl) {
                  console.log('VideoPreview: Recovered videoUrl from scene for clip', clip.id);
                  active.video = { ...clip, videoUrl: scene.videoUrl };
                }
              }
            }
            if (clip.type === 'audio') active.audio.push(clip);
            if (clip.type === 'text') active.text = clip;
          }
        });
      });
    }

    // Fallback to scenes if tracks not initialized or no video clip found
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
          if (scene.audioUrl) {
            active.audio.push({
              id: `a-${scene.id}`,
              type: 'audio',
              startTime: elapsed,
              duration: scene.duration || 3,
              content: scene.audioUrl, // Using audioUrl as content or add a new field
              audioUrl: scene.audioUrl
            });
          }
          break;
        }
        elapsed += (scene.duration || 0);
      }
    }
    
    // Debug logging for video status
    if (active.video?.videoUrl) {
      console.log('VideoPreview: Active video has URL', active.video.videoUrl);
    }

    return active;
  }, [tracks, scenes, currentTime]);

  const allVideoUrls = useMemo(() => {
    const urls = new Set<string>();
    scenes.forEach(s => {
      if (s.videoUrl) urls.add(s.videoUrl);
    });
    tracks.forEach(t => {
      t.clips.forEach(c => {
        if (c.type === 'video' && c.videoUrl) urls.add(c.videoUrl);
      });
    });
    return Array.from(urls);
  }, [scenes, tracks]);

  const allAudioUrls = useMemo(() => {
    const urls = new Set<string>();
    scenes.forEach(s => {
      if (s.audioUrl) urls.add(s.audioUrl);
    });
    tracks.forEach(t => {
      t.clips.forEach(c => {
        if (c.type === 'audio' && (c.audioUrl || (c.content && c.content.startsWith('blob:')))) {
           // check if content is a url (blob or http)
           const url = c.audioUrl || c.content;
           if (url && (url.startsWith('http') || url.startsWith('blob:'))) {
             urls.add(url);
           }
        }
      });
    });
    return Array.from(urls);
  }, [scenes, tracks]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  const generatingIndex = generatingSceneId ? scenes.findIndex(s => s.id === generatingSceneId) : -1;
  const generatingScene = generatingSceneId ? scenes.find(s => s.id === generatingSceneId) : null;

  const handleDurationLoaded = useCallback((url: string, duration: number) => {
    setSkeleton(prev => {
      if (!prev) return null;
      let hasChanges = false;
      
      // Update Scenes
      const newScenes = prev.scenes.map(scene => {
        if (scene.videoUrl === url && Math.abs((scene.duration || 0) - duration) > 0.1) {
          hasChanges = true;
          return { ...scene, duration };
        }
        return scene;
      });

      // Update Tracks
      const newTracks = prev.tracks?.map(track => {
        // Only process Track 1 (assuming it's the main video track)
        if (track.name === 'Track 1') {
           const newClips = [...track.clips];
           let trackChanged = false;
           
           for (let i = 0; i < newClips.length; i++) {
               const clip = newClips[i];
               if (clip.type === 'video' && clip.videoUrl === url) {
                   const oldDuration = clip.duration;
                   if (Math.abs(oldDuration - duration) > 0.1) {
                       // Update duration
                       newClips[i] = { ...clip, duration };
                       trackChanged = true;
                       hasChanges = true;
                       
                       // Ripple effect: shift all subsequent clips
                       const diff = duration - oldDuration;
                       for (let j = i + 1; j < newClips.length; j++) {
                           newClips[j] = { 
                               ...newClips[j], 
                               startTime: newClips[j].startTime + diff 
                           };
                       }
                   }
               }
           }
           return trackChanged ? { ...track, clips: newClips } : track;
        }
        return track;
      }) || [];

      if (!hasChanges) return prev;
      return { ...prev, scenes: newScenes, tracks: newTracks };
    });
  }, [setSkeleton]);

  const handleDownload = async () => {
    const videoUrl = activeClips.video?.videoUrl;
    if (!videoUrl) return;

    try {
      const response = await fetch(videoUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `scene-${activeClips.video?.id || 'video'}-${Date.now()}.mp4`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download failed:', error);
      window.open(videoUrl, '_blank');
    }
  };

  return (
    <div className="h-full flex flex-col bg-white overflow-y-auto">
      {/* Video Player Section */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-zinc-50/30 relative">
        {/* Top Controls */}
        <div className="absolute top-8 right-8 z-20 flex items-center gap-3">
          {/* Export Button */}
          <button
            onClick={() => skeleton && exportVideo(skeleton)}
            disabled={isExporting || !skeleton || skeleton.scenes.filter(s => s.videoUrl).length === 0}
            className={cn(
              "flex items-center gap-2 px-4 py-2 bg-black text-white rounded-full shadow-lg hover:bg-black/80 transition-all text-[10px] uppercase tracking-widest font-medium disabled:opacity-50 disabled:cursor-not-allowed",
              isExporting && "cursor-wait"
            )}
          >
            {isExporting ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                导出中 {exportProgress}%
              </>
            ) : (
              <>
                <Film className="w-3 h-3" />
                导出全片
              </>
            )}
          </button>

          {/* Regenerate All Button */}
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
                {generatingIndex !== -1 
                  ? `正在生成 (${generatingIndex + 1}/${scenes.length})...`
                  : '正在重新生成...'}
              </>
            ) : (
              <>
                <Sparkles className="w-3 h-3" />
                全部重新生成视频
              </>
            )}
          </button>
        </div>

        <div 
          className={cn(
            "bg-black rounded-2xl overflow-hidden shadow-2xl relative group mx-auto",
            (effectiveAspectRatio === '9:16' || effectiveAspectRatio === '3:4' || effectiveAspectRatio === '1:1') 
              ? "h-[70vh] w-auto" 
              : "w-full max-w-4xl"
          )}
          style={{ aspectRatio: effectiveAspectRatio.replace(':', '/') }}
        >
          {/* Mock Video Placeholder / Video Player */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {allVideoUrls.map((url) => (
              <BackgroundVideo 
                key={url}
                url={url}
                isActive={url === activeClips.video?.videoUrl}
                isPlaying={isPlaying}
                isMuted={isMuted}
                onDurationLoaded={(d) => handleDurationLoaded(url, d)}
              />
            ))}

            {allAudioUrls.map((url) => {
              const activeClip = activeClips.audio.find(clip => (clip.audioUrl === url || clip.content === url));
              return (
                <BackgroundAudio 
                  key={url}
                  url={url}
                  isActive={!!activeClip}
                  isPlaying={isPlaying}
                  currentTime={currentTime}
                  startTime={activeClip?.startTime || 0}
                  isMuted={isMuted}
                />
              );
            })}

            {!activeClips.video?.videoUrl && (
              activeClips.video?.imageUrl ? (
                <Image 
                  src={activeClips.video.imageUrl} 
                  alt="Preview" 
                  fill
                  className="object-cover transition-opacity duration-300"
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
              )
            )}
            
            {/* Generating Overlay */}
            {generatingSceneId && activeClips.video && (
               (activeClips.video.id === `v-${generatingSceneId}`) ||
               (activeClips.video.imageUrl === generatingScene?.imageUrl)
            ) && (
              <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center z-20">
                <Loader2 className="w-8 h-8 text-white animate-spin mb-2" />
                <p className="text-white text-xs tracking-widest">正在生成视频...</p>
              </div>
            )}
          </div>

          {/* Subtitles Overlay */}
          {activeClips.text?.content && (
            <div className="absolute bottom-16 inset-x-0 flex justify-center px-12 pointer-events-none z-20">
              <p className="bg-black/40 backdrop-blur-md text-white px-4 py-2 rounded text-sm font-light tracking-wide text-center">
                {activeClips.text.content}
              </p>
            </div>
          )}

          {/* Video Controls Overlay */}
          <div className="absolute bottom-0 inset-x-0 p-6 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity z-20">
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
                {activeClips.video?.videoUrl && (
                  <Download 
                    className="w-4 h-4 text-white cursor-pointer hover:scale-110 transition-transform" 
                    onClick={handleDownload}
                  />
                )}
                <button onClick={() => setIsMuted(!isMuted)}>
                  {isMuted ? (
                    <VolumeX className="w-4 h-4 text-white cursor-pointer" />
                  ) : (
                    <Volume2 className="w-4 h-4 text-white cursor-pointer" />
                  )}
                </button>
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
