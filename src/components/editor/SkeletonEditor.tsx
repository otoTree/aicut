'use client';

import { useState } from 'react';
import { useStore, Scene } from '@/store/useStore';
import { Textarea } from '@/components/ui/textarea';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Plus, GripVertical, Trash2, Image as ImageIcon, User, Map, Film, BookOpen, Palette, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { llmClient } from '@/lib/llm/client';

const STEPS = [
  { id: 0, label: '故事概述', icon: BookOpen },
  { id: 1, label: '艺术风格', icon: Palette },
  { id: 2, label: '角色设计', icon: User },
  { id: 3, label: '场景设计', icon: Map },
  { id: 4, label: '分镜头脚本', icon: Film },
];

export function SkeletonEditor() {
  const { skeleton, isGenerating, setSkeleton, currentStep, setCurrentStep } = useStore();
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());
  const [generatingVideoIds, setGeneratingVideoIds] = useState<Set<string>>(new Set());

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

      if (type === 'characters') {
        finalPrompt = `${artStyle}, ${description}, standing pose, full body visible, no action, isolated on white background, no background, character only, high quality, masterpiece, original character design, avoid copyright, safe for work`;
        size = '1728x2304';
      } else if (type === 'sceneDesigns') {
        finalPrompt = `${artStyle}, ${description}, no characters, empty scene, background only, high quality, masterpiece, original environment design, avoid copyright, safe for work`;
        size = '2560x1440';
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
          size = '2560x1440';
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
      const { id: taskId } = await llmClient.generateVideo(scene.visualDescription, scene.imageUrl);
      
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

  const updateField = (field: keyof typeof skeleton, value: any) => {
    setSkeleton({ ...skeleton, [field]: value });
  };

  const updateScene = (id: string, updates: Partial<Scene>) => {
    updateField('scenes', skeleton.scenes.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const addScene = () => {
    const newId = Math.random().toString(36).substr(2, 9);
    updateField('scenes', [...skeleton.scenes, { 
      id: newId, 
      visualDescription: '', 
      cameraDesign: '', 
      audioDesign: '', 
      voiceActor: '', 
      dialogueContent: '', 
      duration: 3 
    }]);
  };

  const removeScene = (id: string) => {
    updateField('scenes', skeleton.scenes.filter(s => s.id !== id));
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
                onClick={() => updateField('characters', [...skeleton.characters, { id: Math.random().toString(36).substr(2, 9), prototype: '', description: '' }])}
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
                      <img src={char.imageUrl} alt={char.prototype} className="w-full h-full object-cover" />
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
                      onChange={(e) => {
                        const newChars = [...skeleton.characters];
                        newChars[idx].prototype = e.target.value;
                        updateField('characters', newChars);
                      }}
                      placeholder="角色原型 (如: 孤独的旅者)"
                      className="bg-transparent border-none focus:outline-none text-xl font-serif w-full"
                    />
                    <Textarea
                      value={char.description}
                      onChange={(e) => {
                        const newChars = [...skeleton.characters];
                        newChars[idx].description = e.target.value;
                        updateField('characters', newChars);
                      }}
                      placeholder="详细描述角色外观、性格等..."
                      className="min-h-[80px] border-none bg-transparent focus-visible:ring-0 text-sm leading-relaxed p-0 resize-none"
                    />
                  </div>
                  <button 
                    onClick={() => updateField('characters', skeleton.characters.filter(c => c.id !== char.id))}
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
                onClick={() => updateField('sceneDesigns', [...skeleton.sceneDesigns, { id: Math.random().toString(36).substr(2, 9), prototype: '', description: '' }])}
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
                      <img src={scene.imageUrl} alt={scene.prototype} className="w-full h-full object-cover" />
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
                      onChange={(e) => {
                        const newScenes = [...skeleton.sceneDesigns];
                        newScenes[idx].prototype = e.target.value;
                        updateField('sceneDesigns', newScenes);
                      }}
                      placeholder="场景原型 (如: 赛博朋克风格的雨夜街头)"
                      className="bg-transparent border-none focus:outline-none text-xl font-serif w-full"
                    />
                    <Textarea
                      value={scene.description}
                      onChange={(e) => {
                        const newScenes = [...skeleton.sceneDesigns];
                        newScenes[idx].description = e.target.value;
                        updateField('sceneDesigns', newScenes);
                      }}
                      placeholder="描述场景的氛围、灯光、构图细节..."
                      className="min-h-[80px] border-none bg-transparent focus-visible:ring-0 text-sm leading-relaxed p-0 resize-none"
                    />
                  </div>
                  <button 
                    onClick={() => updateField('sceneDesigns', skeleton.sceneDesigns.filter(s => s.id !== scene.id))}
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
              <button 
                onClick={addScene}
                className="p-1 hover:bg-black/5 rounded transition-colors text-black/40 hover:text-black"
              >
                <Plus className="w-4 h-4" />
              </button>
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
                            <img src={scene.imageUrl} alt={`Scene ${index + 1}`} className="w-full h-full object-cover" />
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
                                  <input
                                    value={scene.voiceActor}
                                    onChange={(e) => updateScene(scene.id, { voiceActor: e.target.value })}
                                    placeholder="Voice Actor: Narrator"
                                    className="w-full bg-black/[0.02] border-none rounded-lg px-4 py-2 text-xs focus:outline-none"
                                  />
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
                                <label className="text-[10px] uppercase tracking-[0.2em] text-black/40 font-medium">对白内容</label>
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
