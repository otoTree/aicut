'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useStore, Character, SceneDesign, EpisodeSummary } from '@/store/useStore';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Plus, Trash2, Sparkles, ImageIcon, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { llmClient } from '@/lib/llm/client';
import { PromptFactory } from '@/lib/prompts';

interface BibleReviewProps {
  onNext: () => void;
}

export function BibleReview({ onNext }: BibleReviewProps) {
  const { seriesBible, setSeriesBible, setEpisodes, novelContent } = useStore();
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());
  const [isSegmenting, setIsSegmenting] = useState(false);

  if (!seriesBible) return null;

  const handleGenerateImage = async (id: string, description: string, type: 'characters' | 'sceneDesigns') => {
    if (generatingIds.has(id)) return;
    
    setGeneratingIds(prev => new Set(prev).add(id));
    try {
      const artStyle = seriesBible.artStyle;
      let finalPrompt = '';
      let size = '1024x1024'; // Square for prototypes might be better, or keeping portrait/landscape

      if (type === 'characters') {
        finalPrompt = `艺术风格：${artStyle}。角色描述：${description}。画面要求：全身站立，无动作，纯白背景，无背景，仅角色，高质量，杰作，原创设计。Safe for work, avoid copyright.`;
        size = '1728x2304';
      } else if (type === 'sceneDesigns') {
        finalPrompt = `艺术风格：${artStyle}。场景描述：${description}。画面要求：无角色，空场景，仅背景，高质量，杰作，原创设计。Safe for work, avoid copyright.`;
        size = '2560x1440';
      }
      
      const response = await llmClient.generateImage(finalPrompt, size);
      
      setSeriesBible({
        ...seriesBible,
        [type]: (seriesBible[type] as any[]).map((item: any) => 
          item.id === id ? { ...item, imageUrl: response.url } : item
        )
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

  const handleSegmentEpisodes = async () => {
    setIsSegmenting(true);
    try {
      const prompt = PromptFactory.getPrompt('segment_episodes', novelContent);
      
      const response = await llmClient.chat([
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user }
      ]);

      let jsonContent = response.content;
      const match = jsonContent.match(/```json\n([\s\S]*?)\n```/);
      if (match) {
        jsonContent = match[1];
      }

      const episodes = JSON.parse(jsonContent) as EpisodeSummary[];
      setEpisodes(episodes.map(e => ({ ...e, status: 'pending' })));
      onNext();
    } catch (error) {
      console.error('Failed to segment episodes:', error);
    } finally {
      setIsSegmenting(false);
    }
  };

  const updateCharacter = (id: string, updates: Partial<Character>) => {
    setSeriesBible({
      ...seriesBible,
      characters: seriesBible.characters.map(c => c.id === id ? { ...c, ...updates } : c)
    });
  };

  const updateSceneDesign = (id: string, updates: Partial<SceneDesign>) => {
    setSeriesBible({
      ...seriesBible,
      sceneDesigns: seriesBible.sceneDesigns.map(s => s.id === id ? { ...s, ...updates } : s)
    });
  };

  return (
    <div className="flex-1 overflow-y-auto bg-white p-12">
      <div className="max-w-5xl mx-auto space-y-12">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-serif font-medium">剧集圣经 (Series Bible)</h1>
            <p className="text-black/40 text-sm mt-2">确认全剧通用的角色和场景设定，确保系列一致性。</p>
          </div>
          <Button
            onClick={handleSegmentEpisodes}
            disabled={isSegmenting}
            className="bg-black text-white hover:bg-black/80 rounded-full px-6"
          >
            {isSegmenting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                正在规划剧集...
              </>
            ) : (
              <>
                确认并规划分集
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </div>

        {/* Art Style */}
        <div className="space-y-4">
          <label className="text-[10px] uppercase tracking-[0.2em] text-black/40 font-medium">全局艺术风格</label>
          <Textarea
            value={seriesBible.artStyle}
            onChange={(e) => setSeriesBible({ ...seriesBible, artStyle: e.target.value })}
            className="border-none bg-black/[0.02] rounded-xl resize-none p-6 font-serif text-lg"
          />
        </div>

        {/* Characters */}
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-black/[0.04] pb-4">
            <label className="text-[10px] uppercase tracking-[0.2em] text-black/40 font-medium">主要角色 ({seriesBible.characters.length})</label>
            <Button variant="ghost" size="sm" onClick={() => {
              setSeriesBible({
                ...seriesBible,
                characters: [...seriesBible.characters, { id: Math.random().toString(36).substr(2, 9), prototype: '', description: '' }]
              });
            }}>
              <Plus className="w-4 h-4 mr-2" />
              添加角色
            </Button>
          </div>
          
          <div className="grid grid-cols-2 gap-8">
            {seriesBible.characters.map((char) => (
              <div key={char.id} className="group relative flex gap-6 p-4 bg-black/[0.02] rounded-2xl hover:bg-black/[0.04] transition-colors">
                <div className="w-24 h-32 shrink-0 bg-white rounded-xl flex items-center justify-center overflow-hidden relative group/img">
                  {char.imageUrl ? (
                    <Image src={char.imageUrl} alt={char.prototype} fill className="object-cover" />
                  ) : generatingIds.has(char.id) ? (
                    <Loader2 className="w-6 h-6 text-black/20 animate-spin" />
                  ) : (
                    <ImageIcon className="w-6 h-6 text-black/10" />
                  )}
                  
                  <div className={cn(
                    "absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity",
                    !char.imageUrl && "opacity-100 bg-transparent hover:bg-black/5"
                  )}>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleGenerateImage(char.id, char.description, 'characters')}
                      className="rounded-full shadow-lg h-8 text-[10px]"
                    >
                      <Sparkles className="w-3 h-3 mr-1" />
                      {char.imageUrl ? '重绘' : '生成'}
                    </Button>
                  </div>
                </div>
                <div className="flex-1 space-y-2">
                  <input
                    value={char.prototype}
                    onChange={(e) => updateCharacter(char.id, { prototype: e.target.value })}
                    placeholder="角色名"
                    className="bg-transparent font-serif font-medium text-lg w-full focus:outline-none"
                  />
                  <Textarea
                    value={char.description}
                    onChange={(e) => updateCharacter(char.id, { description: e.target.value })}
                    placeholder="角色描述..."
                    className="min-h-[60px] text-xs bg-transparent border-none p-0 resize-none focus-visible:ring-0 text-black/60"
                  />
                </div>
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-black/20 hover:text-red-400"
                  onClick={() => {
                    setSeriesBible({
                      ...seriesBible,
                      characters: seriesBible.characters.filter(c => c.id !== char.id)
                    });
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* Scene Designs */}
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-black/[0.04] pb-4">
            <label className="text-[10px] uppercase tracking-[0.2em] text-black/40 font-medium">常驻场景 ({seriesBible.sceneDesigns.length})</label>
            <Button variant="ghost" size="sm" onClick={() => {
              setSeriesBible({
                ...seriesBible,
                sceneDesigns: [...seriesBible.sceneDesigns, { id: Math.random().toString(36).substr(2, 9), prototype: '', description: '' }]
              });
            }}>
              <Plus className="w-4 h-4 mr-2" />
              添加场景
            </Button>
          </div>
          
          <div className="grid grid-cols-2 gap-8">
            {seriesBible.sceneDesigns.map((scene) => (
              <div key={scene.id} className="group relative flex gap-6 p-4 bg-black/[0.02] rounded-2xl hover:bg-black/[0.04] transition-colors">
                <div className="w-32 h-24 shrink-0 bg-white rounded-xl flex items-center justify-center overflow-hidden relative group/img">
                  {scene.imageUrl ? (
                    <Image src={scene.imageUrl} alt={scene.prototype} fill className="object-cover" />
                  ) : generatingIds.has(scene.id) ? (
                    <Loader2 className="w-6 h-6 text-black/20 animate-spin" />
                  ) : (
                    <ImageIcon className="w-6 h-6 text-black/10" />
                  )}
                  
                  <div className={cn(
                    "absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity",
                    !scene.imageUrl && "opacity-100 bg-transparent hover:bg-black/5"
                  )}>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleGenerateImage(scene.id, scene.description, 'sceneDesigns')}
                      className="rounded-full shadow-lg h-8 text-[10px]"
                    >
                      <Sparkles className="w-3 h-3 mr-1" />
                      {scene.imageUrl ? '重绘' : '生成'}
                    </Button>
                  </div>
                </div>
                <div className="flex-1 space-y-2">
                  <input
                    value={scene.prototype}
                    onChange={(e) => updateSceneDesign(scene.id, { prototype: e.target.value })}
                    placeholder="场景名"
                    className="bg-transparent font-serif font-medium text-lg w-full focus:outline-none"
                  />
                  <Textarea
                    value={scene.description}
                    onChange={(e) => updateSceneDesign(scene.id, { description: e.target.value })}
                    placeholder="场景描述..."
                    className="min-h-[60px] text-xs bg-transparent border-none p-0 resize-none focus-visible:ring-0 text-black/60"
                  />
                </div>
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-black/20 hover:text-red-400"
                  onClick={() => {
                    setSeriesBible({
                      ...seriesBible,
                      sceneDesigns: seriesBible.sceneDesigns.filter(s => s.id !== scene.id)
                    });
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
