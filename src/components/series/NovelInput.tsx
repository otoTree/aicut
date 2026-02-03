'use client';

import { useState } from 'react';
import { useStore, SeriesBible } from '@/store/useStore';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles } from 'lucide-react';
import { llmClient } from '@/lib/llm/client';
import { PromptFactory } from '@/lib/prompts';

interface NovelInputProps {
  onNext: () => void;
}

export function NovelInput({ onNext }: NovelInputProps) {
  const { novelContent, setNovelContent, setSeriesBible } = useStore();
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleAnalyze = async () => {
    if (!novelContent.trim()) return;

    setIsAnalyzing(true);
    try {
      const prompt = PromptFactory.getPrompt('analyze_series_bible', novelContent);
      
      const response = await llmClient.chat([
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user }
      ]);

      let jsonContent = response.content;
      // Extract JSON if wrapped in code blocks
      const match = jsonContent.match(/```json\n([\s\S]*?)\n```/);
      if (match) {
        jsonContent = match[1];
      }

      const bible = JSON.parse(jsonContent) as SeriesBible;
      // Ensure ID is set
      if (!bible.id) bible.id = Math.random().toString(36).substr(2, 9);
      
      setSeriesBible(bible);
      onNext();
    } catch (error) {
      console.error('Failed to analyze novel:', error);
      // TODO: Show toast error
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-12 bg-white">
      <div className="max-w-3xl w-full space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-serif font-medium">输入小说内容</h1>
          <p className="text-black/40 text-sm">我们将分析小说内容，提取“剧集圣经”（角色与场景），并自动规划分集。</p>
        </div>

        <div className="relative">
          <Textarea
            value={novelContent}
            onChange={(e) => setNovelContent(e.target.value)}
            placeholder="在此粘贴小说正文..."
            className="min-h-[400px] border-black/[0.1] bg-black/[0.02] focus-visible:ring-1 focus-visible:ring-black/20 text-lg leading-relaxed p-8 resize-none rounded-2xl font-serif"
          />
          <div className="absolute bottom-4 right-4 text-xs text-black/20">
            {novelContent.length} 字
          </div>
        </div>

        <div className="flex justify-center">
          <Button
            onClick={handleAnalyze}
            disabled={!novelContent.trim() || isAnalyzing}
            className="bg-black text-white hover:bg-black/80 rounded-full px-8 py-6 text-base shadow-xl disabled:opacity-50"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                正在分析小说...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 mr-2" />
                生成剧集圣经
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
