'use client';

import { useState, useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { motion } from 'framer-motion';
import { ChevronLeft, Book, Users, Film, LayoutList, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { NovelInput } from '@/components/series/NovelInput';
import { BibleReview } from '@/components/series/BibleReview';
import { EpisodeList } from '@/components/series/EpisodeList';
import { SkeletonEditor } from '@/components/editor/SkeletonEditor';
import { VideoPreview } from '@/components/editor/VideoPreview';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function SeriesLayout() {
  const { 
    setView, 
    seriesBible, 
    episodes, 
    currentEpisodeId, 
    setMode, 
    skeleton, 
    updateEpisodeSkeleton,
    outputLanguage,
    setOutputLanguage
  } = useStore();
  const [activeTab, setActiveTab] = useState<'novel' | 'bible' | 'episodes'>('novel');

  // Auto-switch tabs based on progress
  if (activeTab === 'novel' && seriesBible) {
    setActiveTab('bible');
  }
  if (activeTab === 'bible' && episodes.length > 0) {
    setActiveTab('episodes');
  }

  // Sync skeleton changes to episodeSkeletons
  useEffect(() => {
    if (currentEpisodeId && skeleton) {
      updateEpisodeSkeleton(currentEpisodeId, skeleton);
    }
  }, [skeleton, currentEpisodeId, updateEpisodeSkeleton]);

  const getLanguageLabel = (lang: 'zh' | 'en' | 'ja') => {
    switch (lang) {
      case 'zh': return '中文';
      case 'en': return 'English';
      case 'ja': return '日本語';
    }
  };

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Header */}
      <header className="h-14 border-b border-black/[0.04] flex items-center justify-between px-4 shrink-0 bg-white z-10">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => {
              setMode('single');
              setView('home');
            }}
            className="hover:bg-black/5 rounded-full"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="h-4 w-[1px] bg-black/10" />
          <h2 className="font-serif text-sm tracking-widest uppercase opacity-60">
            {seriesBible?.name || '新系列项目'}
          </h2>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Language Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="text-xs font-medium text-black/60 hover:text-black hover:bg-black/5">
                <Globe className="w-4 h-4 mr-2" />
                {getLanguageLabel(outputLanguage)}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setOutputLanguage('zh')}>中文</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setOutputLanguage('en')}>English</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setOutputLanguage('ja')}>日本語</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="h-4 w-[1px] bg-black/10 mx-2" />

          <Button
            variant="ghost"
            onClick={() => setActiveTab('novel')}
            className={activeTab === 'novel' ? 'bg-black/5' : ''}
          >
            <Book className="w-4 h-4 mr-2" />
            小说
          </Button>
          <Button
            variant="ghost"
            onClick={() => setActiveTab('bible')}
            disabled={!seriesBible}
            className={activeTab === 'bible' ? 'bg-black/5' : ''}
          >
            <Users className="w-4 h-4 mr-2" />
            圣经
          </Button>
          <Button
            variant="ghost"
            onClick={() => setActiveTab('episodes')}
            disabled={episodes.length === 0}
            className={activeTab === 'episodes' ? 'bg-black/5' : ''}
          >
            <LayoutList className="w-4 h-4 mr-2" />
            分集
          </Button>
        </div>
      </header>


      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        {activeTab === 'novel' && <NovelInput onNext={() => setActiveTab('bible')} />}
        {activeTab === 'bible' && <BibleReview onNext={() => setActiveTab('episodes')} />}
        {activeTab === 'episodes' && (
          <div className="flex-1 flex overflow-hidden">
            {/* Sidebar */}
            <aside className="w-80 border-r border-black/[0.04] bg-zinc-50/50 flex flex-col">
              <EpisodeList />
            </aside>
            
            {/* Editor Area */}
            <div className="flex-1 flex flex-col min-w-0 bg-white">
              {currentEpisodeId ? (
                <Tabs defaultValue="text" className="flex-1 flex flex-col min-h-0">
                  <div className="px-6 py-4 flex items-center justify-between shrink-0 border-b border-black/[0.04]">
                    <TabsList className="bg-black/[0.02] border border-black/[0.04] p-1 h-9">
                      <TabsTrigger value="text" className="text-xs px-6">骨架</TabsTrigger>
                      <TabsTrigger value="video" className="text-xs px-6">视频预览</TabsTrigger>
                    </TabsList>
                  </div>
                  
                  <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                    <TabsContent value="text" className="flex-1 m-0 data-[state=active]:flex flex-col overflow-hidden min-h-0">
                      <SkeletonEditor />
                    </TabsContent>
                    <TabsContent value="video" className="flex-1 m-0 data-[state=active]:flex flex-col overflow-hidden min-h-0">
                      <div className="flex-1 flex flex-col min-h-0 max-w-[1400px] mx-auto w-full">
                        <VideoPreview />
                      </div>
                    </TabsContent>
                  </div>
                </Tabs>
              ) : (
                <div className="flex-1 flex items-center justify-center text-black/20">
                  <div className="text-center">
                    <Film className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>请选择一个剧集开始编辑</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
