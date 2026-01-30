'use client';

import { useStore } from '@/store/useStore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SkeletonEditor } from '@/components/editor/SkeletonEditor';
import { VideoPreview } from '@/components/editor/VideoPreview';
import { AIChat } from '@/components/editor/AIChat';
import { motion } from 'framer-motion';
import { ChevronLeft, Loader2, FileJson, Film } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useVideoExporter } from '@/lib/useVideoExporter';

export function EditorLayout() {
  const { setView, skeleton } = useStore();
  const { exportVideo, isExporting, progress } = useVideoExporter();

  const handleExportJson = () => {
    if (!skeleton) return;
    try {
      const blob = new Blob([JSON.stringify(skeleton, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${skeleton.theme || 'project'}-export.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col h-screen bg-white"
    >
      {/* Header */}
      <header className="h-14 border-b border-black/[0.04] flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setView('home')}
            className="hover:bg-black/5 rounded-full"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="h-4 w-[1px] bg-black/10" />
          <h2 className="font-serif text-sm tracking-widest uppercase opacity-60">
            {skeleton?.theme || '新项目'}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            className="text-sm font-light hover:bg-black/5"
            onClick={handleExportJson}
            disabled={!skeleton}
            title="导出项目文件 (JSON)"
          >
            <FileJson className="w-4 h-4 mr-2" />
            项目
          </Button>
          <Button 
            variant="ghost" 
            className="text-sm font-light hover:bg-black/5 min-w-[100px]"
            onClick={() => exportVideo(skeleton!)}
            disabled={!skeleton || isExporting}
            title="导出合成视频 (MP4)"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {progress}%
              </>
            ) : (
              <>
                <Film className="w-4 h-4 mr-2" />
                视频
              </>
            )}
          </Button>
          <div className="h-4 w-[1px] bg-black/10 mx-2" />
          <Button className="bg-black text-white hover:bg-black/80 text-sm font-light rounded-full px-6">
            发布
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left Side: Editor/Preview */}
        <div className="flex-1 flex flex-col border-r border-black/[0.04] min-h-0 min-w-0">
          <Tabs defaultValue="text" className="flex-1 flex flex-col min-h-0">
            <div className="px-6 py-4 flex items-center justify-between shrink-0">
              <TabsList className="bg-black/[0.02] border border-black/[0.04] p-1 h-9">
                <TabsTrigger value="text" className="text-xs px-6 data-[state=active]:bg-white data-[state=active]:shadow-sm">骨架</TabsTrigger>
                <TabsTrigger value="video" className="text-xs px-6 data-[state=active]:bg-white data-[state=active]:shadow-sm">视频预览</TabsTrigger>
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
        </div>

        {/* Right Side: AI Chat */}
        <aside className="w-[400px] shrink-0 bg-zinc-50/50">
          <AIChat />
        </aside>
      </main>
    </motion.div>
  );
}
