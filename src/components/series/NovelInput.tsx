'use client';

import { useState } from 'react';
import { useStore, SeriesBible, EpisodeSummary } from '@/store/useStore';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles, FileJson } from 'lucide-react';
import { llmClient } from '@/lib/llm/client';
import { PromptFactory } from '@/lib/prompts';

interface NovelInputProps {
  onNext: () => void;
}

export function NovelInput({ onNext }: NovelInputProps) {
  const { novelContent, setNovelContent, setSeriesBible, setEpisodes } = useStore();
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleImportJSON = async (json: any) => {
    try {
        // 1. Construct minimal Bible
        // Parse characters string: "Name: Description\nName2: Desc2"
        const characters = [];
        if (json.analysis && json.analysis.characters) {
            const characterLines = json.analysis.characters.split('\n');
            for (const line of characterLines) {
                if (!line.trim()) continue;
                const parts = line.split(/[:：]/); // Support both colons
                if (parts.length >= 2) {
                    characters.push({
                        id: Math.random().toString(36).substr(2, 9),
                        prototype: parts[0].trim(),
                        description: parts.slice(1).join(':').trim()
                    });
                }
            }
        }
        
        // Auto-detect scene designs from script
        const sceneDesigns: any[] = [];
        const scriptContent = json.scripts.chinese || json.scripts.english || '';
        const sceneRegex = /\*\*(?:场景|Scene)\s*\d+\s*[:：]\s*(.*?)\*\*/g;
        const seenLocations = new Set<string>();
        let match;

        while ((match = sceneRegex.exec(scriptContent)) !== null) {
            const fullLocation = match[1].trim();
            // Split by " - " to separate location from time
            // e.g. "Tokyo Hotel Room - Night" -> "Tokyo Hotel Room"
            const parts = fullLocation.split(/\s+-\s+/);
            const locationName = parts[0].trim();

            if (locationName && !seenLocations.has(locationName)) {
                seenLocations.add(locationName);
                sceneDesigns.push({
                    id: Math.random().toString(36).substr(2, 9),
                    prototype: locationName,
                    description: fullLocation // Use full location + time as initial description
                });
            }
        }

        const bible: SeriesBible = {
            id: Math.random().toString(36).substr(2, 9),
            name: `Episode ${json.episode_number} Project`,
            artStyle: "Cinematic, Photorealistic, 8k", // Default high quality
            characters: characters,
            sceneDesigns: sceneDesigns
        };
        
        // Check if we need to auto-complete scene designs or refine characters
        // We can do this silently in the background or just let it be minimal

        setSeriesBible(bible);

        // 2. Create Episode Summary
        const episode: EpisodeSummary = {
            id: `ep_${json.episode_number}`,
            index: json.episode_number,
            title: `Episode ${json.episode_number}`,
            summary: json.analysis.conflict || 'No summary',
            status: 'pending',
            scriptContent: json.scripts.chinese || json.scripts.english
        };

        setEpisodes([episode]);
        
        // Trigger navigation is automatic via effect in parent
        
    } catch (error) {
        console.error('Failed to import JSON:', error);
        // toast.error('JSON 格式错误');
    }
  };

  const handleAnalyze = async () => {
    if (!novelContent.trim()) return;

    // Check if input is JSON
    if (novelContent.trim().startsWith('{')) {
        try {
            const json = JSON.parse(novelContent);
            if (json.episode_number && json.scripts) {
                setIsAnalyzing(true);
                // Simulate a small delay for better UX
                await new Promise(resolve => setTimeout(resolve, 800));
                await handleImportJSON(json);
                setIsAnalyzing(false);
                return;
            }
        } catch (e) {
            // Not valid JSON, ignore and proceed to analyze
        }
    }

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

  const isJSONInput = novelContent.trim().startsWith('{');

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-12 bg-white">
      <div className="max-w-3xl w-full space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-serif font-medium">输入小说内容</h1>
          <p className="text-black/40 text-sm">支持直接输入小说文本进行分析，或粘贴单集脚本 JSON 直接导入。</p>
        </div>

        <div className="relative">
          <Textarea
            value={novelContent}
            onChange={(e) => setNovelContent(e.target.value)}
            placeholder="在此粘贴小说正文 或 脚本 JSON..."
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
                正在处理...
              </>
            ) : isJSONInput ? (
              <>
                <FileJson className="w-5 h-5 mr-2" />
                导入单集脚本
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
