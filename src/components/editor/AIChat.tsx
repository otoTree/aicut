'use client';

import { useState } from 'react';
import { useStore } from '@/store/useStore';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { Sparkles, Send, Loader2, Image as ImageIcon } from 'lucide-react';

import { PromptFactory } from '@/lib/prompts';
import { llmClient } from '@/lib/llm/client';
import { extractJSON } from '@/lib/utils';

export function AIChat() {
  const { messages, addMessage, skeleton, setSkeleton } = useStore();
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // 辅助函数：根据场景更新轨道信息
  const updateTracksFromScenes = (scenes: any[]) => {
    let elapsed = 0;
    const videoClips = scenes.map(scene => {
      const clip = {
        id: `v-${scene.id}`,
        type: 'video' as const,
        startTime: elapsed,
        duration: scene.duration || 3,
        content: scene.visualDescription,
        imageUrl: scene.imageUrl,
        videoUrl: scene.videoUrl,
        title: `Scene ${scene.id.slice(0, 4)}`
      };
      elapsed += scene.duration || 3;
      return clip;
    });

    elapsed = 0;
    const audioClips = scenes.filter(s => s.audioDesign).map(scene => {
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
    const textClips = scenes.filter(s => s.dialogueContent).map(scene => {
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

    return [
      { id: 'track-1', name: 'Track 1', clips: videoClips },
      { id: 'track-2', name: 'Track 2', clips: audioClips },
      { id: 'track-3', name: 'Track 3', clips: textClips }
    ];
  };

  const startVideoGeneration = async () => {
    if (!skeleton || skeleton.scenes.length === 0) return;

    addMessage({
      role: 'assistant',
      content: '正在为您生成视频，请稍候。我们将逐个镜头生成并实时更新预览。'
    });

    // 逐个镜头生成视频
    const scenes = skeleton.scenes;
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      if (!scene.imageUrl) {
        console.warn(`Scene ${i} has no image, skipping video generation.`);
        continue;
      }

      try {
        console.log(`Starting video generation for scene ${i}...`);
        const { id: taskId } = await llmClient.generateVideo(scene.visualDescription, scene.imageUrl);
        
        // 轮询状态
        let attempts = 0;
        const maxAttempts = 60; // 5 minutes with 5s interval
        
        while (attempts < maxAttempts) {
          const { status, video_url } = await llmClient.queryVideoStatus(taskId);
          
          if (status === 'succeeded' && video_url) {
            console.log(`Video generation succeeded for scene ${i}:`, video_url);
            
            // 更新 Store 中的场景视频 URL
            setSkeleton(prev => {
              if (!prev) return null;
              const newScenes = [...prev.scenes];
              newScenes[i] = { ...newScenes[i], videoUrl: video_url };
              
              // 同时更新 Tracks
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
            throw new Error(`Video generation failed for scene ${i}`);
          }
          
          await new Promise(resolve => setTimeout(resolve, 5000));
          attempts++;
        }
      } catch (error) {
        console.error(`Error generating video for scene ${i}:`, error);
        addMessage({
          role: 'assistant',
          content: `抱歉，第 ${i + 1} 个镜头的视频生成失败了。`
        });
      }
    }

    addMessage({
      role: 'assistant',
      content: '所有视频生成完毕！您可以在预览区查看完整效果。'
    });
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    
    const userMessage = { role: 'user' as const, content: input };
    addMessage(userMessage);
    const currentInput = input;
    setInput('');
    setIsLoading(true);
    
    try {
      if (currentInput.startsWith('/image ')) {
        const prompt = currentInput.slice(7).trim();
        const response = await llmClient.generateImage(prompt);
        addMessage({ 
          role: 'assistant', 
          content: `已为您生成图片：${prompt}`,
          imageUrl: response.url
        });
      } else {
        const prompt = PromptFactory.getPrompt('chat_refine', currentInput);
        const systemPrompt = prompt.system + (skeleton ? `\n\n当前视频骨架信息：\n${JSON.stringify(skeleton, null, 2)}` : '');
        
        const response = await llmClient.chat([
          { role: 'system', content: systemPrompt },
          ...messages.map(m => ({ role: m.role, content: m.content })),
          userMessage,
        ]);

        // 尝试从回复中提取 JSON
        try {
          const updatedSkeleton = extractJSON<any>(response.content);
          if (updatedSkeleton && typeof updatedSkeleton === 'object' && updatedSkeleton.theme) {
            // 如果提取到了有效的骨架 JSON，更新 Store
            const tracks = updateTracksFromScenes(updatedSkeleton.scenes || []);
            setSkeleton({
              ...updatedSkeleton,
              tracks
            });
            
            addMessage({ 
              role: 'assistant', 
              content: response.content 
            });
          } else {
            // 如果没有 JSON，则视为普通对话
            addMessage({ 
              role: 'assistant', 
              content: response.content 
            });
          }
        } catch (e) {
          // 解析 JSON 出错，说明回复中可能不包含 JSON，或者是格式不正确
          addMessage({ 
            role: 'assistant', 
            content: response.content 
          });
        }
      }
    } catch (error) {
      console.error('Chat failed:', error);
      addMessage({ 
        role: 'assistant', 
        content: '抱歉，我现在无法处理您的请求。请稍后再试。' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-black/[0.04] flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-black/40" />
        <span className="text-[10px] uppercase tracking-[0.2em] font-medium text-black/60">AI 助手</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        <div className="space-y-6">
          {messages.length === 0 && (
            <div className="py-8 text-center space-y-2">
              <p className="text-xs text-black/30 font-light">
                我是您的视频创作助手。<br />
                我可以帮您完善故事概述、艺术风格、<br />
                角色设计、场景设计以及分镜头脚本。
              </p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <Avatar className="w-6 h-6 shrink-0 border border-black/5 bg-white flex items-center justify-center">
                {msg.role === 'assistant' ? (
                  <Sparkles className="w-3 h-3" />
                ) : (
                  <span className="text-[8px] font-mono">YOU</span>
                )}
              </Avatar>
              <div className={`
                max-w-[80%] rounded-2xl px-4 py-2 text-sm font-light leading-relaxed
                ${msg.role === 'user' 
                  ? 'bg-black text-white' 
                  : 'bg-white border border-black/[0.04] text-black/80'}
              `}>
                {msg.content}
                {msg.imageUrl && (
                  <div className="mt-2 rounded-lg overflow-hidden border border-black/5">
                    <img src={msg.imageUrl} alt="Generated image" className="w-full h-auto object-cover" />
                  </div>
                )}
                {msg.type === 'action_request' && msg.actionType === 'start_video_generation' && (
                  <div className="mt-4">
                    <Button 
                      onClick={() => {
                        startVideoGeneration();
                        // 移除当前消息的 action_request 状态，避免重复点击
                        msg.type = 'text'; 
                      }}
                      className="w-full bg-black text-white hover:bg-black/80 rounded-xl py-6 flex items-center justify-center gap-2"
                    >
                      <Sparkles className="w-4 h-4" />
                      开始生成视频
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 border-t border-black/[0.04] bg-white">
        <div className="relative">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="与 AI 交流... (输入 /image 生成图片)"
            className="pr-20 bg-black/[0.02] border-none focus-visible:ring-0 text-sm h-11 rounded-xl"
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          />
          <div className="absolute right-1 top-1 flex items-center gap-0.5">
            <Button 
              size="icon" 
              variant="ghost"
              onClick={() => {
                if (!input.startsWith('/image ')) {
                  setInput('/image ' + input);
                }
              }}
              disabled={isLoading}
              className="h-9 w-9 hover:bg-transparent text-black/20 hover:text-black transition-colors disabled:opacity-50"
              title="生成图片"
            >
              <ImageIcon className="w-4 h-4" />
            </Button>
            <Button 
              size="icon" 
              variant="ghost"
              onClick={handleSend}
              disabled={isLoading}
              className="h-9 w-9 hover:bg-transparent text-black/20 hover:text-black transition-colors disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
