'use client';

import { useState } from 'react';
import { useStore, VideoSkeleton } from '@/store/useStore';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Loader2, PlayCircle, CheckCircle2, Circle, Sparkles } from 'lucide-react';
import { llmClient } from '@/lib/llm/client';
import { toast } from 'sonner';
import { PromptFactory } from '@/lib/prompts';
import { extractJSON } from '@/lib/utils';
import { getResolution } from '@/lib/utils/aspect-ratio';

export function EpisodeList() {
  const { 
    episodes, 
    setEpisodes, 
    seriesBible, 
    currentEpisodeId, 
    setCurrentEpisodeId, 
    setSkeleton,
    episodeSkeletons,
    updateEpisodeSkeleton,
    aspectRatio
  } = useStore();
  
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  const handleSelectEpisode = (episodeId: string) => {
    setCurrentEpisodeId(episodeId);
    
    // If we have a skeleton for this episode, load it
    if (episodeSkeletons[episodeId]) {
      setSkeleton(episodeSkeletons[episodeId]);
    } else {
      setSkeleton(null);
    }
  };

  const handleGenerateEpisode = async (episodeId: string) => {
    const episode = episodes.find(e => e.id === episodeId);
    if (!episode || !seriesBible) {
      toast.error('无法生成：缺少剧集信息或系列设定');
      return;
    }

    setGeneratingId(episodeId);
    setCurrentEpisodeId(episodeId);
    setSkeleton(null); // Clear current view
    
    const toastId = toast.loading('正在生成分镜，这可能需要一分钟左右...');

    try {
      // Step 1: Generate Script Outline (Macro)
      const input = JSON.stringify({
        index: episode.index,
        title: episode.title,
        summary: episode.summary,
        bible: {
          artStyle: seriesBible.artStyle,
          characters: seriesBible.characters,
          sceneDesigns: seriesBible.sceneDesigns
        }
      });
      
      const prompt = PromptFactory.getPrompt('generate_episode_script', input);
      
      const response = await llmClient.chat([
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user }
      ]);

      console.log('Script Outline Response Length:', response.content.length);

      let scriptData: any;
      try {
        scriptData = extractJSON<any>(response.content);
      } catch (parseError) {
        console.error('Script Parse Error:', parseError);
        throw new Error('分镜大纲解析失败');
      }

      // Initial Skeleton Construction
      // We fill in missing visual/audio details with placeholders for now
      const initialScenes = scriptData.scenes.map((s: any) => ({
        ...s,
        visualDescription: s.action, // Temporary fallback
        cameraDesign: 'Medium Shot',
        audioDesign: 'Ambient sound',
        voiceActor: '',
        imageUrl: '',
        videoUrl: '',
        audioUrl: ''
      }));

      // Initialize Tracks
      let elapsed = 0;
      const initialTracks = [{
         id: 'main-track',
         name: 'Track 1',
         clips: initialScenes.map((s: any) => {
            // Default to 5s for preview if duration is smart (-1)
            const dur = (s.duration && s.duration > 0) ? s.duration : 5;
            const clip = {
               id: `v-${s.id}`,
               type: 'video' as const,
               startTime: elapsed,
               duration: dur,
               content: s.visualDescription,
               sceneId: s.id,
               imageUrl: ''
            };
            elapsed += dur;
            return clip;
         })
      }];

      const skeletonData: VideoSkeleton = {
        theme: scriptData.theme,
        storyOverview: scriptData.storyOverview,
        artStyle: seriesBible.artStyle,
        aspectRatio: aspectRatio,
        characters: seriesBible.characters,
        sceneDesigns: seriesBible.sceneDesigns,
        scenes: initialScenes,
        tracks: initialTracks
      };

      // Immediate Update to UI (One-click feedback)
      updateEpisodeSkeleton(episodeId, skeletonData);
      setSkeleton(skeletonData);
      setEpisodes(episodes.map(e => 
        e.id === episodeId ? { ...e, status: 'generated', skeletonId: episodeId } : e
      ));
      
      toast.success('大纲生成完成，正在补充视觉细节...', { id: toastId });

      // Step 2: Auto-fill Details (Micro) - Batch Process
      // We process scenes in batches of 5 to avoid token limits
      const BATCH_SIZE = 5;
      const scenes = [...initialScenes];
      
      for (let i = 0; i < scenes.length; i += BATCH_SIZE) {
        const batch = scenes.slice(i, i + BATCH_SIZE);
        const batchInput = JSON.stringify({
          bible: { artStyle: seriesBible.artStyle },
          scenes: batch,
          previousScene: i > 0 ? scenes[i - 1] : undefined
        });
        
        try {
          const detailPrompt = PromptFactory.getPrompt('generate_scene_details', batchInput);
          const detailResponse = await llmClient.chat([
            { role: 'system', content: detailPrompt.system },
            { role: 'user', content: detailPrompt.user }
          ]);
          
          const updatedBatch = extractJSON<any[]>(detailResponse.content);
          
          if (Array.isArray(updatedBatch)) {
            // Update scenes array
            updatedBatch.forEach((updatedScene, idx) => {
              if (i + idx < scenes.length) {
                scenes[i + idx] = { ...scenes[i + idx], ...updatedScene };
              }
            });
            
            // Incremental Update to Store
            const currentSkeleton = { ...skeletonData, scenes: [...scenes] };
            updateEpisodeSkeleton(episodeId, currentSkeleton);
            setSkeleton(currentSkeleton); // Update view if currently selected
          }
        } catch (e) {
          console.error(`Batch ${i/BATCH_SIZE + 1} details generation failed`, e);
          // Continue to next batch even if one fails
        }
      }

      // Step 3: Generate Images for Scenes
      toast.message('正在生成分镜画面...', { id: toastId });

      const scenesWithImages = [...scenes];
      const imageConcurrency = 3;
      const scenesQueue = scenesWithImages
        .map((s, i) => ({ scene: s, index: i }))
        .filter(({ scene }) => !scene.imageUrl);

      const processImageGeneration = async () => {
        if (scenesQueue.length === 0) return;

        const item = scenesQueue.shift();
        if (!item) return;
        const { scene, index } = item;
        if (scene.imageUrl) {
          if (scenesQueue.length > 0) {
            await processImageGeneration();
          }
          return;
        }

        try {
          // Construct prompt
          const sceneCharacters = seriesBible.characters.filter(c => scene.characterIds?.includes(c.id));
          const sceneBaseDesign = seriesBible.sceneDesigns.find(sd => sd.id === scene.sceneId);

          const referenceImages = [
            ...sceneCharacters.map(c => c.imageUrl).filter((url): url is string => !!url),
            ...(sceneBaseDesign?.imageUrl ? [sceneBaseDesign.imageUrl] : [])
          ];

          let prompt = `艺术风格：${seriesBible.artStyle}。`;
          prompt += `画面描述：${scene.visualDescription}。`;
          if (scene.cameraDesign) prompt += ` 镜头语言：${scene.cameraDesign}。`;
          prompt += ` 高质量，电影感，8k分辨率。`;

          // Generate Image
          const response = await llmClient.generateImage(prompt, getResolution(aspectRatio), referenceImages);

          // Update local array
          scenesWithImages[index] = { ...scenesWithImages[index], imageUrl: response.url };

          // Rebuild tracks to include new image
          let currentElapsed = 0;
          const newTracks = [{
             id: 'main-track',
             name: 'Track 1',
             clips: scenesWithImages.map((s) => {
                const dur = s.duration || 3;
                const clip = {
                   id: `v-${s.id}`,
                   type: 'video' as const,
                   startTime: currentElapsed,
                   duration: dur,
                   content: s.visualDescription,
                   sceneId: s.id,
                   imageUrl: s.imageUrl
                };
                currentElapsed += dur;
                return clip;
             })
          }];

          // Update Store
          const currentSkeleton = { ...skeletonData, scenes: [...scenesWithImages], tracks: newTracks };
          updateEpisodeSkeleton(episodeId, currentSkeleton);

          // Update view if this episode is currently selected
          if (useStore.getState().currentEpisodeId === episodeId) {
            setSkeleton(currentSkeleton);
          }

        } catch (error) {
          console.error(`Failed to generate image for scene ${index}`, error);
        }

        if (scenesQueue.length > 0) {
          await processImageGeneration();
        }
      };

      await Promise.all(Array(imageConcurrency).fill(null).map(() => processImageGeneration()));

      toast.success('分镜生成完成', { id: toastId });

    } catch (error: any) {
      console.error('Failed to generate episode:', error);
      toast.error('生成失败: ' + (error.message || '未知错误'), { id: toastId });
    } finally {
      setGeneratingId(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-6 py-4 border-b border-black/[0.04] shrink-0 bg-zinc-50/50">
        <h3 className="text-xs font-medium uppercase tracking-widest text-black/40">剧集列表</h3>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {episodes.map((episode) => {
          const isActive = currentEpisodeId === episode.id;
          const isGenerated = episode.status === 'generated';
          const isGenerating = generatingId === episode.id;
          
          return (
            <div
              key={episode.id}
              onClick={() => !isGenerating && handleSelectEpisode(episode.id)}
              className={cn(
                "group relative p-4 rounded-xl border transition-all cursor-pointer",
                isActive 
                  ? "bg-white border-black shadow-sm" 
                  : "bg-white border-transparent hover:border-black/10 hover:shadow-sm"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-black/[0.04] shrink-0 text-[10px] font-mono font-medium text-black/60">
                  {episode.index}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className={cn(
                    "font-medium text-sm truncate",
                    isActive ? "text-black" : "text-black/80"
                  )}>
                    {episode.title}
                  </h4>
                  <p className="text-xs text-black/40 line-clamp-2 mt-1 leading-relaxed">
                    {episode.summary}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isGenerated ? (
                    <span className="flex items-center text-[10px] text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      已生成
                    </span>
                  ) : isGenerating ? (
                    <span className="flex items-center text-[10px] text-blue-600 font-medium bg-blue-50 px-2 py-0.5 rounded-full">
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      生成中...
                    </span>
                  ) : (
                    <span className="flex items-center text-[10px] text-black/40 font-medium bg-black/[0.04] px-2 py-0.5 rounded-full">
                      <Circle className="w-3 h-3 mr-1" />
                      待生成
                    </span>
                  )}
                </div>

                {!isGenerated && !isGenerating && isActive && (
                  <Button
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleGenerateEpisode(episode.id);
                    }}
                    className="h-7 text-[10px] rounded-full px-3 bg-black hover:bg-black/80 text-white"
                  >
                    <Sparkles className="w-3 h-3 mr-1" />
                    生成分镜
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
