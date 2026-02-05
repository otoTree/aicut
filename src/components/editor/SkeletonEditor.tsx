'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useStore, Scene, Character, SceneDesign, Clip, VideoSkeleton } from '@/store/useStore';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Plus, GripVertical, Trash2, Image as ImageIcon, User, Map, Film, BookOpen, Palette, Sparkles, Volume2, Mic } from 'lucide-react';
import { VOICES, getVoiceName, getVoiceId } from '@/lib/tts/voices';
import { cn } from '@/lib/utils';
import { getResolution } from '@/lib/utils/aspect-ratio';
import { llmClient } from '@/lib/llm/client';
import { db } from '@/lib/db-client';

const STEPS = [
  { id: 0, label: '故事概述', icon: BookOpen },
  { id: 1, label: '艺术风格', icon: Palette },
  { id: 2, label: '角色设计', icon: User },
  { id: 3, label: '场景设计', icon: Map },
  { id: 4, label: '分镜头脚本', icon: Film },
];

export function SkeletonEditor() {
  const { skeleton, isGenerating, setSkeleton, currentStep, setCurrentStep, aspectRatio } = useStore();
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());
  const [generatingVideoIds, setGeneratingVideoIds] = useState<Set<string>>(new Set());
  const [generatingAudioIds, setGeneratingAudioIds] = useState<Set<string>>(new Set());
  const audioRestored = useRef(false);

  // Restore audio blobs on mount
  useEffect(() => {
    const restoreAudio = async () => {
      if (!skeleton) {
        audioRestored.current = false;
        return;
      }

      if (audioRestored.current) return;
      
      const updates = await Promise.all(skeleton.scenes.map(async (scene) => {
        // If we have an ID but no blob URL (or an invalid one which we can't easily check, 
        // but typically on refresh the blob URL is revoked so we can just blindly restore if we find it in DB)
        // Actually, we should check DB for any assets related to this scene
        const asset = await db.assets.get(scene.id);
        if (asset && asset.type === 'audio') {
          return { id: scene.id, url: URL.createObjectURL(asset.blob) };
        }
        return null;
      }));

      const validUpdates = updates.filter(u => u !== null) as { id: string, url: string }[];
      
      if (validUpdates.length > 0) {
        setSkeleton(prev => {
          if (!prev) return null;
          let newScenes = [...prev.scenes];
          let changed = false;
          
          validUpdates.forEach(update => {
            const idx = newScenes.findIndex(s => s.id === update.id);
            if (idx > -1 && newScenes[idx].audioUrl !== update.url) {
              newScenes[idx] = { ...newScenes[idx], audioUrl: update.url };
              changed = true;
            }
          });

          if (!changed) return prev;
          
          // We also need to update tracks if we restored audio URLs
          const newTracks = prev.tracks ? [...prev.tracks] : [];
          if (newTracks.length > 0) {
            newTracks.forEach((track, trackIndex) => {
              const newClips = [...track.clips];
              let trackChanged = false;
              validUpdates.forEach(update => {
                const clipIndex = newClips.findIndex(c => c.id === `a-${update.id}`);
                if (clipIndex > -1 && newClips[clipIndex].audioUrl !== update.url) {
                  newClips[clipIndex] = { ...newClips[clipIndex], audioUrl: update.url };
                  trackChanged = true;
                }
              });
              if (trackChanged) {
                newTracks[trackIndex] = { ...track, clips: newClips };
              }
            });
          }
          
          return { ...prev, scenes: newScenes, tracks: newTracks };
        });
      }
      
      audioRestored.current = true;
    };
    
    restoreAudio();
  }, [skeleton, setSkeleton]); // Run when skeleton loads or changes

  useEffect(() => {
    if (skeleton && !skeleton.aspectRatio && aspectRatio) {
      setSkeleton(prev => prev ? { ...prev, aspectRatio } : prev);
    }
  }, [skeleton, aspectRatio, setSkeleton]);

  if (isGenerating && !skeleton) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-8 h-8 animate-spin opacity-20" />
        <p className="text-black/30 font-serif italic text-sm">正在构建骨架...</p>
      </div>
    );
  }

  if (!skeleton) return null;

  const handleGenerateImage = async (id: string, description: string, type: 'characters' | 'sceneDesigns' | 'scenes') => {
    if (generatingIds.has(id)) return;
    
    setGeneratingIds(prev => new Set(prev).add(id));
    try {
      const artStyle = skeleton.artStyle;
      let finalPrompt = '';
      let size = '2K';
      let referenceImages: string[] = [];

      const effectiveAspectRatio = skeleton.aspectRatio ?? aspectRatio;

      if (type === 'characters') {
        finalPrompt = `艺术风格：${artStyle}。角色描述：${description}。画面要求：全身站立，无动作，纯白背景，无背景，仅角色，高质量，杰作，原创设计。Safe for work, avoid copyright.`;
        size = '1728x2304';
      } else if (type === 'sceneDesigns') {
        finalPrompt = `艺术风格：${artStyle}。场景描述：${description}。画面要求：无角色，空场景，仅背景，高质量，杰作，原创设计。Safe for work, avoid copyright.`;
        size = getResolution(effectiveAspectRatio);
      } else if (type === 'scenes') {
        const scene = skeleton.scenes.find(s => s.id === id);
        if (scene) {
          const sceneCharacters = skeleton.characters.filter(c => scene.characterIds?.includes(c.id));
          const sceneBaseDesign = skeleton.sceneDesigns.find(sd => sd.id === scene.sceneId);
          
          referenceImages = [
            ...sceneCharacters.map(c => c.imageUrl).filter((url): url is string => !!url),
            ...(sceneBaseDesign?.imageUrl ? [sceneBaseDesign.imageUrl] : [])
          ];

          // Construct prompt with image references
          let imageRefPrompts = '';
          let currentImgIdx = 1;
          
          sceneCharacters.forEach(c => {
            if (c.imageUrl) {
              imageRefPrompts += `[图${currentImgIdx}]是角色"${c.prototype}"的原型图，描述为：${c.description}。`;
              currentImgIdx++;
            }
          });
          
          if (sceneBaseDesign?.imageUrl) {
            imageRefPrompts += `[图${currentImgIdx}]是场景"${sceneBaseDesign.prototype}"的底图，描述为：${sceneBaseDesign.description}。`;
          }

          finalPrompt = `艺术风格：${artStyle}。
${imageRefPrompts}
当前镜头视觉描述：${description}。
镜头设计：${scene.cameraDesign}。
要求：请参考上述角色原型图和场景底图，将它们完美融合到当前镜头中。保持角色特征和场景氛围的一致性。
注意：高质量、杰作、专业影视构图、原创设计、规避任何版权角色或标志、严禁色情、暴力或任何违规内容 (Safe for work, No NSFW, No copyright infringement)。`;
          size = getResolution(effectiveAspectRatio);
        }
      }
      
      const response = await llmClient.generateImage(finalPrompt, size, referenceImages.length > 0 ? referenceImages : undefined);
      
      setSkeleton(prev => {
        if (!prev) return null;
        const items = [...prev[type]] as any[];
        const index = items.findIndex(item => item.id === id);
        if (index > -1) {
          items[index] = { ...items[index], imageUrl: response.url };
        }
        return { ...prev, [type]: items };
      });
    } catch (error) {
      console.error('Failed to generate image:', error);
    } finally {
      setGeneratingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleGenerateVideo = async (sceneId: string) => {
    if (generatingVideoIds.has(sceneId)) return;
    
    const scene = skeleton?.scenes.find(s => s.id === sceneId);
    if (!scene || !scene.imageUrl) return;

    setGeneratingVideoIds(prev => new Set(prev).add(sceneId));
    try {
      // Construct prompt with dialogue for lip-sync
      let finalPrompt = scene.visualDescription;
      if (scene.dialogueContent) {
        // According to Seedance 1.5 Pro docs, putting dialogue in quotes helps generate matching audio/lip-sync
        finalPrompt = `${scene.visualDescription} Character says: "${scene.dialogueContent}"`;
      }

      // Determine lastImageUrl
      let lastImageUrl = undefined;
      if (skeleton && skeleton.scenes) {
        const index = skeleton.scenes.findIndex(s => s.id === sceneId);
        if (index > -1 && index < skeleton.scenes.length - 1) {
          const nextScene = skeleton.scenes[index + 1];
          if (nextScene && nextScene.imageUrl) {
            lastImageUrl = nextScene.imageUrl;
          }
        }
      }

      const effectiveAspectRatio = skeleton?.aspectRatio ?? aspectRatio;
      const { id: taskId } = await llmClient.generateVideo(finalPrompt, scene.imageUrl, scene.duration, effectiveAspectRatio, lastImageUrl);
      
      let attempts = 0;
      const maxAttempts = 60;
      
      while (attempts < maxAttempts) {
        const { status, video_url } = await llmClient.queryVideoStatus(taskId);
        
        if (status === 'succeeded' && video_url) {
          setSkeleton(prev => {
            if (!prev) return null;
            const newScenes = [...prev.scenes];
            const index = newScenes.findIndex(s => s.id === sceneId);
            if (index > -1) {
              newScenes[index] = { ...newScenes[index], videoUrl: video_url };
              
              // 同时更新 Tracks
              const newTracks = prev.tracks ? [...prev.tracks] : [];
              if (newTracks.length > 0) {
                const videoTrackIndex = newTracks.findIndex(t => t.name === 'Track 1');
                if (videoTrackIndex > -1) {
                  const newClips = [...newTracks[videoTrackIndex].clips];
                  const clipIndex = newClips.findIndex(c => c.id === `v-${sceneId}`);
                  if (clipIndex > -1) {
                    newClips[clipIndex] = { ...newClips[clipIndex], videoUrl: video_url };
                    newTracks[videoTrackIndex] = { ...newTracks[videoTrackIndex], clips: newClips };
                  }
                }
              }
              return { ...prev, scenes: newScenes, tracks: newTracks };
            }
            return prev;
          });

          // 保存单镜头更新到历史记录
          try {
            const finalSkeleton = useStore.getState().skeleton;
            if (finalSkeleton) {
              await db.history.add({
                timestamp: Date.now(),
                prompt: finalSkeleton.theme || 'Untitled',
                skeleton: finalSkeleton,
                thumbnail: finalSkeleton.scenes.find(s => s.id === sceneId)?.imageUrl
              });
              console.log('Saved single scene update to history');
            }
          } catch (error) {
            console.error('Failed to save history:', error);
          }

          break;
        } else if (status === 'failed') {
          throw new Error('Video generation failed');
        }
        
        await new Promise(resolve => setTimeout(resolve, 5000));
        attempts++;
      }
    } catch (error) {
      console.error('Failed to generate video:', error);
    } finally {
      setGeneratingVideoIds(prev => {
        const next = new Set(prev);
        next.delete(sceneId);
        return next;
      });
    }
  };

  const updateField = (field: keyof VideoSkeleton, value: any) => {
    setSkeleton(prev => prev ? { ...prev, [field]: value } : null);
  };

  const rebuildTracksFromScenes = (scenes: Scene[]) => {
    let elapsed = 0;
    const videoClips: Clip[] = [];
    const audioClips: Clip[] = [];
    const textClips: Clip[] = [];

    scenes.forEach(scene => {
      const duration = scene.duration || 3;
      
      // Video
      videoClips.push({
        id: `v-${scene.id}`,
        type: 'video',
        startTime: elapsed,
        duration: duration,
        content: scene.visualDescription,
        videoUrl: scene.videoUrl,
        imageUrl: scene.imageUrl
      });

      // Audio
      if (scene.audioDesign || scene.audioUrl) {
          audioClips.push({
              id: `a-${scene.id}`,
              type: 'audio',
              startTime: elapsed,
              duration: duration,
              content: scene.audioUrl || scene.audioDesign,
              audioUrl: scene.audioUrl
          });
      }

      // Text
      if (scene.dialogueContent) {
          textClips.push({
              id: `t-${scene.id}`,
              type: 'text',
              startTime: elapsed,
              duration: duration,
              content: scene.dialogueContent
          });
      }
      
      elapsed += duration;
    });

    return [
      { id: 'track-1', name: 'Track 1', clips: videoClips },
      { id: 'track-2', name: 'Track 2', clips: audioClips },
      { id: 'track-3', name: 'Track 3', clips: textClips }
    ];
  };

  const updateScene = (id: string, updates: Partial<Scene>) => {
    setSkeleton(prev => {
      if (!prev) return null;
      
      const newScenes = prev.scenes.map(s => s.id === id ? { ...s, ...updates } : s);
      
      // If duration changed, we must rebuild tracks to ensure timeline is consistent
      if (updates.duration !== undefined) {
        const newTracks = rebuildTracksFromScenes(newScenes);
        return { ...prev, scenes: newScenes, tracks: newTracks };
      } else {
        return { ...prev, scenes: newScenes };
      }
    });
  };

  const addScene = () => {
    setSkeleton(prev => {
      if (!prev) return null;
      const newId = Math.random().toString(36).substr(2, 9);
      const newScenes = [...prev.scenes, { 
        id: newId, 
        visualDescription: '', 
        cameraDesign: '', 
        audioDesign: '', 
        voiceActor: '', 
        dialogueContent: '', 
        duration: 3 
      }];
      return { ...prev, scenes: newScenes };
    });
  };

  const removeScene = (id: string) => {
    setSkeleton(prev => {
      if (!prev) return null;
      return { ...prev, scenes: prev.scenes.filter(s => s.id !== id) };
    });
  };

  const addCharacter = () => {
    setSkeleton(prev => {
      if (!prev) return null;
      return {
        ...prev,
        characters: [...prev.characters, { id: Math.random().toString(36).substr(2, 9), prototype: '', description: '' }]
      };
    });
  };

  const updateCharacter = (id: string, updates: Partial<Character>) => {
    setSkeleton(prev => {
      if (!prev) return null;
      return {
        ...prev,
        characters: prev.characters.map(c => c.id === id ? { ...c, ...updates } : c)
      };
    });
  };

  const removeCharacter = (id: string) => {
    setSkeleton(prev => {
      if (!prev) return null;
      return {
        ...prev,
        characters: prev.characters.filter(c => c.id !== id)
      };
    });
  };

  const addSceneDesign = () => {
    setSkeleton(prev => {
      if (!prev) return null;
      return {
        ...prev,
        sceneDesigns: [...prev.sceneDesigns, { id: Math.random().toString(36).substr(2, 9), prototype: '', description: '' }]
      };
    });
  };

  const updateSceneDesign = (id: string, updates: Partial<SceneDesign>) => {
    setSkeleton(prev => {
      if (!prev) return null;
      return {
        ...prev,
        sceneDesigns: prev.sceneDesigns.map(s => s.id === id ? { ...s, ...updates } : s)
      };
    });
  };

  const removeSceneDesign = (id: string) => {
    setSkeleton(prev => {
      if (!prev) return null;
      return {
        ...prev,
        sceneDesigns: prev.sceneDesigns.filter(s => s.id !== id)
      };
    });
  };

  const handleGenerateAudio = async (sceneId: string) => {
    const scene = skeleton?.scenes.find(s => s.id === sceneId);
    if (!scene || !scene.dialogueContent) return;

    setGeneratingAudioIds(prev => new Set(prev).add(sceneId));
    
    try {
      const voiceId = getVoiceId(scene.voiceActor);
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: scene.dialogueContent,
          voice_type: voiceId || 'zh_female_vv_uranus_bigtts',
          speed_ratio: 1.0,
        }),
      });

      if (!response.ok) throw new Error('Failed to generate audio');

      const blob = await response.blob();
      
      // Save blob to DB
      await db.assets.put({
        id: sceneId,
        type: 'audio',
        blob: blob,
        createdAt: Date.now()
      });

      const audioUrl = URL.createObjectURL(blob);
      
      // Get audio duration
      const audio = new Audio(audioUrl);
      const duration = await new Promise<number>((resolve) => {
        audio.onloadedmetadata = () => {
          resolve(audio.duration);
        };
        // Fallback if metadata fails to load quickly
        setTimeout(() => resolve(scene.duration || 3), 3000);
      });

      const newDuration = Math.ceil(duration);

      setSkeleton(prev => {
        if (!prev) return null;
        
        // Update Scenes
        const newScenes = prev.scenes.map(s => s.id === sceneId ? { 
          ...s, 
          audioUrl,
          duration: newDuration // Update duration to match audio
        } : s);
        
        // Rebuild tracks to ensure timeline is consistent with new duration
        const newTracks = rebuildTracksFromScenes(newScenes);

        return { ...prev, scenes: newScenes, tracks: newTracks };
      });
    } catch (error) {
      console.error('Failed to generate audio:', error);
      // You might want to show a toast error here
    } finally {
      setGeneratingAudioIds(prev => {
        const next = new Set(prev);
        next.delete(sceneId);
        return next;
      });
    }
  };

  const handleGenerateAllAudio = async () => {
    if (!skeleton) return;
    
    // Find all scenes with dialogue but no audio
    const scenesToGenerate = skeleton.scenes.filter(s => s.dialogueContent && !s.audioUrl && !generatingAudioIds.has(s.id));
    
    if (scenesToGenerate.length === 0) return;

    // Process sequentially to avoid overwhelming the server/browser
    for (const scene of scenesToGenerate) {
      await handleGenerateAudio(scene.id);
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  };

  const handleGenerateAllImages = async () => {
    if (!skeleton) return;
    
    // Find all scenes without image
    const scenesToGenerate = skeleton.scenes.filter(s => !s.imageUrl && !generatingIds.has(s.id));
    
    if (scenesToGenerate.length === 0) return;

    // Process sequentially
    for (const scene of scenesToGenerate) {
      await handleGenerateImage(scene.id, scene.visualDescription, 'scenes');
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0: // Story Overview
        return (
          <div className="space-y-6">
            <label className="text-[10px] uppercase tracking-[0.2em] text-black/40 font-medium">故事核心概述</label>
            <Textarea
              value={skeleton.storyOverview}
              onChange={(e) => updateField('storyOverview', e.target.value)}
              placeholder="描述故事的整体脉络..."
              className="min-h-[300px] border-none bg-black/[0.02] focus-visible:ring-0 text-lg leading-relaxed p-8 resize-none rounded-2xl font-serif"
            />
          </div>
        );
      case 1: // Art Style
        return (
          <div className="space-y-6">
            <label className="text-[10px] uppercase tracking-[0.2em] text-black/40 font-medium">视觉艺术风格</label>
            <Textarea
              value={skeleton.artStyle}
              onChange={(e) => updateField('artStyle', e.target.value)}
              placeholder="描述视觉风格、色调、构图等..."
              className="min-h-[200px] border-none bg-black/[0.02] focus-visible:ring-0 text-lg leading-relaxed p-8 resize-none rounded-2xl font-serif"
            />
          </div>
        );
      case 2: // Character Design
        return (
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <label className="text-[10px] uppercase tracking-[0.2em] text-black/40 font-medium">关键角色设计</label>
              <button 
                onClick={addCharacter}
                className="p-1 hover:bg-black/5 rounded transition-colors text-black/40 hover:text-black"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-8">
              {skeleton.characters.map((char, idx) => (
                <div key={char.id} className="group relative flex gap-8 p-6 bg-black/[0.02] rounded-2xl border border-transparent hover:border-black/5 transition-all">
                  <div className="w-24 h-32 shrink-0 bg-black/5 rounded-xl flex items-center justify-center overflow-hidden relative group/img">
                    {char.imageUrl ? (
                      <Image src={char.imageUrl} alt={char.prototype} fill className="object-cover" />
                    ) : generatingIds.has(char.id) ? (
                      <Loader2 className="w-6 h-6 text-black/20 animate-spin" />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-black/10" />
                    )}
                    
                    {/* Action Overlay */}
                    {!generatingIds.has(char.id) && (
                      <div className={cn(
                        "absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity",
                        !char.imageUrl && "opacity-100 bg-transparent hover:bg-black/5"
                      )}>
                        <button
                          onClick={() => handleGenerateImage(char.id, char.description, 'characters')}
                          className="bg-white/90 px-3 py-1.5 rounded-full shadow-lg flex items-center gap-2 transform scale-90 hover:scale-100 transition-all"
                        >
                          <Sparkles className="w-3 h-3 text-black" />
                          <span className="text-[10px] font-medium text-black">
                            {char.imageUrl ? '重新生成' : '生成图片'}
                          </span>
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 space-y-4">
                    <input
                      value={char.prototype}
                      onChange={(e) => updateCharacter(char.id, { prototype: e.target.value })}
                      placeholder="角色原型 (如: 孤独的旅者)"
                      className="bg-transparent border-none focus:outline-none text-xl font-serif w-full"
                    />
                    <Textarea
                      value={char.description}
                      onChange={(e) => updateCharacter(char.id, { description: e.target.value })}
                      placeholder="详细描述角色外观、性格等..."
                      className="min-h-[80px] border-none bg-transparent focus-visible:ring-0 text-sm leading-relaxed p-0 resize-none"
                    />
                  </div>
                  <button 
                    onClick={() => removeCharacter(char.id)}
                    className="absolute top-4 right-4 p-2 opacity-0 group-hover:opacity-100 transition-opacity text-black/20 hover:text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      case 3: // Scene Design
        return (
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <label className="text-[10px] uppercase tracking-[0.2em] text-black/40 font-medium">核心场景设计</label>
              <button 
                onClick={addSceneDesign}
                className="p-1 hover:bg-black/5 rounded transition-colors text-black/40 hover:text-black"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-8">
              {skeleton.sceneDesigns.map((scene, idx) => (
                <div key={scene.id} className="group relative flex gap-8 p-6 bg-black/[0.02] rounded-2xl border border-transparent hover:border-black/5 transition-all">
                  <div className="w-56 h-32 shrink-0 bg-black/5 rounded-xl flex items-center justify-center overflow-hidden relative group/img">
                    {scene.imageUrl ? (
                      <Image src={scene.imageUrl} alt={scene.prototype} fill className="object-cover" />
                    ) : generatingIds.has(scene.id) ? (
                      <Loader2 className="w-6 h-6 text-black/20 animate-spin" />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-black/10" />
                    )}

                    {/* Action Overlay */}
                    {!generatingIds.has(scene.id) && (
                      <div className={cn(
                        "absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity",
                        !scene.imageUrl && "opacity-100 bg-transparent hover:bg-black/5"
                      )}>
                        <button
                          onClick={() => handleGenerateImage(scene.id, scene.description, 'sceneDesigns')}
                          className="bg-white/90 px-3 py-1.5 rounded-full shadow-lg flex items-center gap-2 transform scale-90 hover:scale-100 transition-all"
                        >
                          <Sparkles className="w-3 h-3 text-black" />
                          <span className="text-[10px] font-medium text-black">
                            {scene.imageUrl ? '重新生成' : '生成图片'}
                          </span>
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 space-y-4">
                    <input
                      value={scene.prototype}
                      onChange={(e) => updateSceneDesign(scene.id, { prototype: e.target.value })}
                      placeholder="场景原型 (如: 赛博朋克风格的雨夜街头)"
                      className="bg-transparent border-none focus:outline-none text-xl font-serif w-full"
                    />
                    <Textarea
                      value={scene.description}
                      onChange={(e) => updateSceneDesign(scene.id, { description: e.target.value })}
                      placeholder="描述场景的氛围、灯光、构图细节..."
                      className="min-h-[80px] border-none bg-transparent focus-visible:ring-0 text-sm leading-relaxed p-0 resize-none"
                    />
                  </div>
                  <button 
                    onClick={() => removeSceneDesign(scene.id)}
                    className="absolute top-4 right-4 p-2 opacity-0 group-hover:opacity-100 transition-opacity text-black/20 hover:text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      case 4: // Storyboard
        if (skeleton.scenes.length === 0) {
          return (
            <div className="flex-1 flex flex-col items-center justify-center space-y-4 py-20">
              <Loader2 className="w-8 h-8 animate-spin opacity-20" />
              <p className="text-black/30 font-serif italic text-sm">正在细化分镜头脚本...</p>
            </div>
          );
        }
        return (
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <label className="text-[10px] uppercase tracking-[0.2em] text-black/40 font-medium">分镜头脚本</label>
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleGenerateAllAudio}
                  disabled={generatingAudioIds.size > 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/[0.04] hover:bg-black/[0.08] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {generatingAudioIds.size > 0 ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Volume2 className="w-3 h-3" />
                  )}
                  <span className="text-[10px] font-medium">一键生成音频</span>
                </button>
                <button 
                  onClick={handleGenerateAllImages}
                  disabled={generatingIds.size > 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/[0.04] hover:bg-black/[0.08] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {generatingIds.size > 0 ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Sparkles className="w-3 h-3" />
                  )}
                  <span className="text-[10px] font-medium">一键生成图片</span>
                </button>
                <button 
                  onClick={addScene}
                  className="p-1 hover:bg-black/5 rounded transition-colors text-black/40 hover:text-black"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-6">
              <AnimatePresence initial={false}>
                {skeleton.scenes.map((scene, index) => (
                  <motion.div
                    key={scene.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="group relative flex gap-6"
                  >
                    <div className="flex flex-col items-center shrink-0 pt-2">
                      <span className="text-[10px] font-mono text-black/20 group-hover:text-black/60 transition-colors">
                        {(index + 1).toString().padStart(2, '0')}
                      </span>
                      <div className="w-[1px] flex-1 bg-black/[0.04] my-2" />
                    </div>
                    
                    <div className="flex-1 space-y-4">
                      <div className="flex items-start gap-6">
                        {/* Scene Image Preview */}
                        <div className="w-48 h-28 shrink-0 bg-black/5 rounded-xl flex flex-col items-center justify-center overflow-hidden relative group/img">
                          {scene.videoUrl ? (
                            <video src={scene.videoUrl} className="w-full h-full object-cover" autoPlay muted loop />
                          ) : scene.imageUrl ? (
                            <Image src={scene.imageUrl} alt={`Scene ${index + 1}`} fill className="object-cover" />
                          ) : generatingIds.has(scene.id) || generatingVideoIds.has(scene.id) ? (
                            <Loader2 className="w-6 h-6 text-black/20 animate-spin" />
                          ) : (
                            <ImageIcon className="w-6 h-6 text-black/10" />
                          )}

                          {/* Action Overlay */}
                          <div className={cn(
                            "absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-2 opacity-0 group-hover/img:opacity-100 transition-opacity",
                            (!scene.imageUrl && !generatingIds.has(scene.id)) && "opacity-100 bg-transparent hover:bg-black/5"
                          )}>
                            {!generatingIds.has(scene.id) && !generatingVideoIds.has(scene.id) && (
                              <>
                                <button
                                  onClick={() => handleGenerateImage(scene.id, scene.visualDescription, 'scenes')}
                                  className="bg-white/90 px-3 py-1.5 rounded-full shadow-lg flex items-center gap-2 transform scale-90 hover:scale-100 transition-all group/btn"
                                >
                                  <Sparkles className="w-3 h-3 text-black" />
                                  <span className="text-[10px] font-medium text-black">
                                    {scene.imageUrl ? '重新生成图片' : '生成图片'}
                                  </span>
                                </button>
                                
                                {scene.imageUrl && (
                                  <button
                                    onClick={() => handleGenerateVideo(scene.id)}
                                    className="bg-white/90 px-3 py-1.5 rounded-full shadow-lg flex items-center gap-2 transform scale-90 hover:scale-100 transition-all"
                                  >
                                    <Film className="w-3 h-3 text-black" />
                                    <span className="text-[10px] font-medium text-black">
                                      {scene.videoUrl ? '重新生成视频' : '生成视频'}
                                    </span>
                                  </button>
                                )}
                              </>
                            )}
                            {(generatingIds.has(scene.id) || generatingVideoIds.has(scene.id)) && (
                              <div className="bg-white/90 px-3 py-1.5 rounded-full shadow-lg flex items-center gap-2">
                                <Loader2 className="w-3 h-3 animate-spin text-black" />
                                <span className="text-[10px] font-medium text-black">生成中...</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex-1 space-y-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1 space-y-4">
                              <div className="space-y-2">
                                <label className="text-[10px] uppercase tracking-[0.2em] text-black/40 font-medium">视觉描述</label>
                                <Textarea
                                  value={scene.visualDescription}
                                  onChange={(e) => updateScene(scene.id, { visualDescription: e.target.value })}
                                  placeholder="Visual Description: Masked Thief in dark charcoal clay bodysuit..."
                                  className="min-h-[80px] border-none bg-black/[0.02] focus-visible:ring-0 text-sm leading-relaxed p-4 resize-none rounded-lg"
                                />
                              </div>
                              
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <label className="text-[10px] uppercase tracking-[0.2em] text-black/40 font-medium">镜头设计</label>
                                  <input
                                    value={scene.cameraDesign}
                                    onChange={(e) => updateScene(scene.id, { cameraDesign: e.target.value })}
                                    placeholder="Camera Design: Wide Shot / Pan Right..."
                                    className="w-full bg-black/[0.02] border-none rounded-lg px-4 py-2 text-xs focus:outline-none"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-[10px] uppercase tracking-[0.2em] text-black/40 font-medium">音频设计</label>
                                  <input
                                    value={scene.audioDesign}
                                    onChange={(e) => updateScene(scene.id, { audioDesign: e.target.value })}
                                    placeholder="Audio Design: Rapid footsteps on clay tiles"
                                    className="w-full bg-black/[0.02] border-none rounded-lg px-4 py-2 text-xs focus:outline-none"
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <label className="text-[10px] uppercase tracking-[0.2em] text-black/40 font-medium">配音角色</label>
                                  <select
                                    value={scene.voiceActor}
                                    onChange={(e) => updateScene(scene.id, { voiceActor: e.target.value })}
                                    className="w-full bg-black/[0.02] border-none rounded-lg px-4 py-2 text-xs focus:outline-none appearance-none"
                                  >
                                    <option value="">选择音色...</option>
                                    {VOICES.map(voice => (
                                      <option key={voice.id} value={voice.id}>
                                        {voice.name}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div className="space-y-2">
                                  <label className="text-[10px] uppercase tracking-[0.2em] text-black/40 font-medium">时长 (秒)</label>
                                  <input
                                    type="number"
                                    value={scene.duration}
                                    onChange={(e) => updateScene(scene.id, { duration: Number(e.target.value) })}
                                    className="w-full bg-black/[0.02] border-none rounded-lg px-4 py-2 text-xs focus:outline-none"
                                  />
                                </div>
                              </div>

                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <label className="text-[10px] uppercase tracking-[0.2em] text-black/40 font-medium">对白内容</label>
                                  <div className="flex items-center gap-2">
                                    {scene.audioUrl && (
                                      <audio controls src={scene.audioUrl} className="h-6 w-32" />
                                    )}
                                    <button
                                      onClick={() => handleGenerateAudio(scene.id)}
                                      disabled={generatingAudioIds.has(scene.id) || !scene.dialogueContent}
                                      className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-black/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                      title="生成语音"
                                    >
                                      {generatingAudioIds.has(scene.id) ? (
                                        <Loader2 className="w-3 h-3 animate-spin text-black/60" />
                                      ) : (
                                        <Mic className="w-3 h-3 text-black/60" />
                                      )}
                                      <span className="text-[10px] text-black/60">
                                        {scene.audioUrl ? '重新生成' : '生成语音'}
                                      </span>
                                    </button>
                                  </div>
                                </div>
                                <Textarea
                                  value={scene.dialogueContent}
                                  onChange={(e) => updateScene(scene.id, { dialogueContent: e.target.value })}
                                  placeholder="Dialogue Content: 'Under the crimson moon...'"
                                  className="min-h-[60px] border-none bg-black/[0.02] focus-visible:ring-0 text-sm leading-relaxed p-4 resize-none rounded-lg"
                                />
                              </div>
                            </div>
                            <button 
                              onClick={() => removeScene(scene.id)}
                              className="p-2 opacity-0 group-hover:opacity-100 transition-opacity text-black/20 hover:text-red-400 shrink-0 ml-4"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-[10px] text-black/30 px-1">
                        <span className="flex items-center gap-1.5">
                          <GripVertical className="w-3 h-3" />
                          拖拽排序
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-white min-h-0 overflow-hidden relative">
      {/* Step Navigation */}
      <div className="px-12 py-6 border-b border-black/[0.04] flex items-center justify-between shrink-0 bg-white z-10">
        <div className="flex items-center gap-8">
          {STEPS.map((step) => {
            const Icon = step.icon;
            const isActive = currentStep === step.id;
            
            return (
              <button
                key={step.id}
                onClick={() => setCurrentStep(step.id)}
                className={cn(
                  "flex items-center gap-2 transition-all duration-300 relative py-2",
                  isActive ? "text-black" : "text-black/20 hover:text-black/40"
                )}
              >
                <Icon className={cn("w-4 h-4", isActive && "text-black")} />
                <span className="text-[10px] uppercase tracking-[0.2em] font-medium">
                  {step.label}
                </span>
                {isActive && (
                  <motion.div 
                    layoutId="step-underline"
                    className="absolute bottom-0 left-0 right-0 h-[1px] bg-black"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 relative min-h-0">
        <div className="absolute inset-0 overflow-y-auto custom-scrollbar">
          <div className="max-w-4xl mx-auto px-12 py-12">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="pb-24"
              >
                {renderStepContent()}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Footer Navigation */}
      <div className="px-12 py-6 border-t border-black/[0.04] flex items-center justify-between bg-white shrink-0">
        <button
          onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
          disabled={currentStep === 0}
          className="text-[10px] uppercase tracking-[0.2em] font-medium text-black/40 hover:text-black disabled:opacity-0 transition-all"
        >
          上一步
        </button>
        <div className="flex items-center gap-2">
          {STEPS.map((step) => (
            <div 
              key={step.id}
              className={cn(
                "w-1 h-1 rounded-full transition-all duration-300",
                currentStep === step.id ? "bg-black w-4" : "bg-black/10"
              )}
            />
          ))}
        </div>
        <button
          onClick={() => setCurrentStep(Math.min(STEPS.length - 1, currentStep + 1))}
          disabled={currentStep === STEPS.length - 1}
          className="text-[10px] uppercase tracking-[0.2em] font-medium text-black/40 hover:text-black disabled:opacity-0 transition-all"
        >
          下一步
        </button>
      </div>
    </div>
  );
}
