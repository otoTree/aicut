'use client';

import { useState } from 'react';
import { useStore, VideoSkeleton } from '@/store/useStore';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight } from 'lucide-react';

import { PromptFactory } from '@/lib/prompts';
import { llmClient } from '@/lib/llm/client';
import { extractJSON, parsePartialJson } from '@/lib/utils';
import { HistoryList } from './HistoryList';
import { db } from '@/lib/db-client';
import { getVoiceId } from '@/lib/tts/voices';

export function Hero() {
  const { setPrompt, setView, setIsGenerating, setSkeleton, addMessage, setIsSkeletonComplete, reset } = useStore();
  const [inputValue, setInputValue] = useState('');

  const handleGenerate = async () => {
    if (!inputValue.trim()) return;
    
    reset();
    setPrompt(inputValue);
    setView('editor');
    setIsGenerating(true);
    
    try {
      // 1. 生成基础骨架 (流式)
      const prompt = PromptFactory.getPrompt('generate_skeleton', inputValue);
      let fullContent = '';
      
      await llmClient.chatStream([
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ], (chunk) => {
        fullContent += chunk;
        const partialData = parsePartialJson<VideoSkeleton>(fullContent);
        if (Object.keys(partialData).length > 0) {
          setSkeleton((prev) => ({
            theme: '',
            storyOverview: '',
            artStyle: '',
            characters: [],
            sceneDesigns: [],
            scenes: [],
            ...prev,
            ...partialData,
          } as VideoSkeleton));
        }
      }, true);

      const skeletonData = extractJSON<VideoSkeleton>(fullContent);
      skeletonData.scenes = []; // 确保 scenes 为空，后续单独生成
      setSkeleton(skeletonData);
      setIsGenerating(false);

      // 2. 分步生成：生成分镜头脚本 (流式)
      const storyboardPrompt = PromptFactory.getPrompt('generate_storyboard', JSON.stringify({
        theme: skeletonData.theme,
        storyOverview: skeletonData.storyOverview,
        artStyle: skeletonData.artStyle,
        characters: skeletonData.characters,
        sceneDesigns: skeletonData.sceneDesigns,
      }));

      let storyboardContent = '';
      await llmClient.chatStream([
        { role: 'system', content: storyboardPrompt.system },
        { role: 'user', content: storyboardPrompt.user },
      ], (chunk) => {
        storyboardContent += chunk;
        try {
          // 尝试解析已有的场景数组
          const partialScenes = parsePartialJson<any[]>(storyboardContent);
          if (Array.isArray(partialScenes)) {
            const formattedScenes = partialScenes.map((scene) => ({
              id: scene.id || Math.random().toString(36).substr(2, 9),
              ...scene,
            }));
            setSkeleton((prev: VideoSkeleton | null) => {
              if (!prev) return null;
              return { ...prev, scenes: formattedScenes };
            });
          }
        } catch (e) {
          // 忽略流式解析错误
        }
      }, true);

      const finalScenes = extractJSON<any[]>(storyboardContent);
      const formattedFinalScenes = finalScenes.map((scene) => ({
        id: Math.random().toString(36).substr(2, 9),
        ...scene,
        voiceActor: getVoiceId(scene.voiceActor) || scene.voiceActor || '',
        duration: typeof scene.duration === 'number' ? scene.duration : (parseInt(scene.duration) || 3),
      }));

      // 初始化轨道
      let elapsed = 0;
      const videoClips = formattedFinalScenes.map(scene => {
        const clip = {
          id: `v-${scene.id}`,
          type: 'video' as const,
          startTime: elapsed,
          duration: scene.duration || 3,
          content: scene.visualDescription,
          title: `Scene ${scene.id.slice(0, 4)}`
        };
        elapsed += scene.duration || 3;
        return clip;
      });

      elapsed = 0;
      const audioClips = formattedFinalScenes.filter(s => s.audioDesign).map(scene => {
        const clip = {
          id: `a-${scene.id}`,
          type: 'audio' as const,
          startTime: elapsed,
          duration: scene.duration || 3,
          content: scene.audioDesign,
          title: scene.audioDesign.slice(0, 20)
        };
        elapsed += scene.duration || 3;
        return clip;
      });

      elapsed = 0;
      const textClips = formattedFinalScenes.filter(s => s.dialogueContent).map(scene => {
        const clip = {
          id: `t-${scene.id}`,
          type: 'text' as const,
          startTime: elapsed,
          duration: scene.duration || 3,
          content: scene.dialogueContent,
          title: scene.dialogueContent.slice(0, 20)
        };
        elapsed += scene.duration || 3;
        return clip;
      });

      const fullSkeleton = { 
        ...skeletonData, 
        scenes: formattedFinalScenes,
        tracks: [
          { id: 'track-1', name: 'Track 1', clips: videoClips },
          { id: 'track-2', name: 'Track 2', clips: audioClips },
          { id: 'track-3', name: 'Track 3', clips: textClips }
        ]
      };

      setSkeleton(fullSkeleton);

      // 保存骨架到历史记录
      let historyId: number | undefined;
      try {
        historyId = await db.history.add({
          timestamp: Date.now(),
          prompt: inputValue,
          skeleton: fullSkeleton,
          thumbnail: undefined
        });
        console.log('Saved initial skeleton to history', historyId);
      } catch (error) {
        console.error('Failed to save history:', error);
      }

      // 3. 异步生成图片补充
      const generateImages = async () => {
        const { artStyle, characters, sceneDesigns } = skeletonData;
        const totalImages = characters.length + sceneDesigns.length + formattedFinalScenes.length;
        let finishedCount = 0;
        
        // 本地缓存生成的图片 URL，确保分镜生成时能立即获取
        const imageUrls: Record<string, string> = {};

        const checkFinished = async () => {
          finishedCount++;
          console.log(`[Hero] Image generation progress: ${finishedCount}/${totalImages}`);

          if (finishedCount === totalImages) {
            setIsSkeletonComplete(true);
            
            // 给状态更新一点时间，确保所有 setSkeleton 都已生效
            await new Promise(resolve => setTimeout(resolve, 500));

            // 更新历史记录中的图片
            try {
              if (historyId) {
                const finalSkeleton = useStore.getState().skeleton;
                if (finalSkeleton) {
                  // 统计已生成的图片数量用于调试
                  const imageCount = [
                    ...(finalSkeleton.characters || []),
                    ...(finalSkeleton.sceneDesigns || []),
                    ...(finalSkeleton.scenes || [])
                  ].filter(item => item.imageUrl).length;
                  
                  console.log(`[Hero] Updating history ${historyId}. Images found: ${imageCount}/${totalImages}`);

                  await db.history.update(historyId, {
                    skeleton: finalSkeleton,
                    thumbnail: finalSkeleton.scenes[0]?.imageUrl
                  });
                  console.log('[Hero] Updated history with images successfully');
                }
              }
            } catch (error) {
              console.error('Failed to update history:', error);
            }

            addMessage({
              role: 'assistant',
              content: '骨架生成完成，分镜头脚本与预览图已就绪。是否开始生成视频？',
              type: 'action_request',
              actionType: 'start_video_generation'
            });
          }
        };

        // 1. 并行生成角色和场景设计图片 (作为基础素材)
        const resourcePromises = [
          // 生成角色图片
          ...characters.map(async (char: any, index: number) => {
            try {
              const charPrompt = `艺术风格：${artStyle}。角色描述：${char.description}。画面要求：全身站立，无动作，纯白背景，无背景，仅角色，高质量，杰作，原创设计。Safe for work, avoid copyright.`;
              const response = await llmClient.generateImage(charPrompt, '1728x2304');
              imageUrls[char.id] = response.url;
              
              setSkeleton((prev: VideoSkeleton | null) => {
                if (!prev) return null;
                const newCharacters = [...prev.characters];
                newCharacters[index] = { ...newCharacters[index], imageUrl: response.url };
                return { ...prev, characters: newCharacters };
              });
            } catch (error) {
              console.error(`Failed to generate image for character ${char.prototype}:`, error);
            } finally {
              checkFinished();
            }
          }),
          
          // 生成场景设计图片
          ...sceneDesigns.map(async (sd: any, index: number) => {
            try {
              const scenePrompt = `艺术风格：${artStyle}。场景描述：${sd.description}。画面要求：无角色，空场景，仅背景，高质量，杰作，原创设计。Safe for work, avoid copyright.`;
              const response = await llmClient.generateImage(scenePrompt, '2560x1440');
              imageUrls[sd.id] = response.url;

              setSkeleton((prev: VideoSkeleton | null) => {
                if (!prev) return null;
                const newSceneDesigns = [...prev.sceneDesigns];
                newSceneDesigns[index] = { ...newSceneDesigns[index], imageUrl: response.url };
                return { ...prev, sceneDesigns: newSceneDesigns };
              });
            } catch (error) {
              console.error(`Failed to generate image for scene design ${sd.prototype}:`, error);
            } finally {
              checkFinished();
            }
          })
        ];

        // 等待基础素材生成完成 (不管成功失败都继续，尽力而为)
        await Promise.all(resourcePromises);

        // 2. 并行生成分镜头图片 (引用已生成的素材)
        formattedFinalScenes.forEach(async (scene: any, index: number) => {
          try {
            const sceneCharacters = characters.filter((c: any) => scene.characterIds?.includes(c.id));
            const sceneBaseDesign = sceneDesigns.find((sd: any) => sd.id === scene.sceneId);
            
            // 使用本地缓存的 URL 构建参考图列表
            const referenceImages = [
              ...sceneCharacters.map((c: any) => imageUrls[c.id]).filter((url: string | undefined): url is string => !!url),
              ...(sceneBaseDesign && imageUrls[sceneBaseDesign.id] ? [imageUrls[sceneBaseDesign.id]] : [])
            ];

            let imageRefPrompts = '';
            let currentImgIdx = 1;
            
            sceneCharacters.forEach((c: any) => {
              if (imageUrls[c.id]) {
                imageRefPrompts += `[图${currentImgIdx}]是角色"${c.prototype}"的原型图，描述为：${c.description}。`;
                currentImgIdx++;
              }
            });
            
            if (sceneBaseDesign && imageUrls[sceneBaseDesign.id]) {
              imageRefPrompts += `[图${currentImgIdx}]是场景"${sceneBaseDesign.prototype}"的底图，描述为：${sceneBaseDesign.description}。`;
            }

            const finalPrompt = `艺术风格：${artStyle}。
${imageRefPrompts}
当前镜头视觉描述：${scene.visualDescription}。
镜头设计：${scene.cameraDesign}。
要求：请参考上述角色原型图和场景底图，将它们完美融合到当前镜头中。保持角色特征和场景氛围的一致性。
注意：高质量、杰作、专业影视构图、原创设计、规避任何版权角色或标志、严禁色情、暴力或任何违规内容 (Safe for work, No NSFW, No copyright infringement)。`;

            const response = await llmClient.generateImage(finalPrompt, '2560x1440', referenceImages.length > 0 ? referenceImages : undefined);
            
            setSkeleton((prev: VideoSkeleton | null) => {
              if (!prev) return null;
              const newScenes = [...prev.scenes];
              newScenes[index] = { ...newScenes[index], imageUrl: response.url };

              // 同时更新 Tracks
              const newTracks = prev.tracks ? [...prev.tracks] : [];
              if (newTracks.length > 0) {
                const videoTrackIndex = newTracks.findIndex(t => t.name === 'Track 1');
                if (videoTrackIndex > -1) {
                  const newClips = [...newTracks[videoTrackIndex].clips];
                  const clipIndex = newClips.findIndex(c => c.id === `v-${newScenes[index].id}`);
                  if (clipIndex > -1) {
                    newClips[clipIndex] = { ...newClips[clipIndex], imageUrl: response.url };
                    newTracks[videoTrackIndex] = { ...newTracks[videoTrackIndex], clips: newClips };
                  }
                }
              }

              return { ...prev, scenes: newScenes, tracks: newTracks };
            });
          } catch (error) {
            console.error(`Failed to generate image for storyboard scene ${index}:`, error);
          } finally {
            checkFinished();
          }
        });
      };

      // 开始后台生成图片，不阻塞 UI 切换
      generateImages();
      
    } catch (error: any) {
      console.error('Generation failed:', error);
      alert(`生成失败: ${error.message || '未知错误'}`);
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      {/* Title Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="text-center space-y-6 max-w-3xl mb-12"
      >
        <h1 className="text-5xl md:text-6xl font-serif font-light tracking-tight text-black">
          意到，影成
        </h1>
        <p className="text-black/50 text-lg font-light tracking-wide">
          输入一句话，AI 为您构建骨架与分镜头
        </p>
      </motion.div>

      {/* Input Section */}
      <div className="w-full max-w-2xl mx-auto px-6 relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.8 }}
          className="relative group"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-blue-100 via-purple-100 to-pink-100 rounded-full blur-xl opacity-20 group-hover:opacity-30 transition-opacity duration-500" />
          <div className="relative bg-white/80 backdrop-blur-xl border border-white/40 shadow-xl rounded-full p-2 pl-6 flex items-center gap-4 transition-all duration-300 group-hover:shadow-2xl group-hover:scale-[1.01]">
            <Sparkles className="w-5 h-5 text-blue-500/50 animate-pulse" />
            <Input 
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="描述你想要生成的视频故事..." 
              className="flex-1 border-none bg-transparent shadow-none focus-visible:ring-0 text-lg placeholder:text-black/20 font-light h-12"
              onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
            />
            <Button 
              onClick={handleGenerate}
              className="rounded-full px-6 py-6 bg-black text-white hover:bg-black/80 transition-all duration-300 group-hover:translate-x-1"
            >
              <ArrowRight className="w-5 h-5" />
            </Button>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 1 }}
          className="mt-8 flex justify-center gap-4 text-xs text-black/30 font-light tracking-wide"
        >
          <span>科幻短片</span>
          <span>•</span>
          <span>古风MV</span>
          <span>•</span>
          <span>产品广告</span>
          <span>•</span>
          <span>教育科普</span>
        </motion.div>
      </div>


      {/* History List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.0, duration: 0.8 }}
      >
        <HistoryList />
      </motion.div>
    </div>
  );
}
