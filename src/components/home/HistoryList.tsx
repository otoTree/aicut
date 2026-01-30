'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/store/useStore';
import { db, HistoryItem } from '@/lib/db-client';
import { useLiveQuery } from 'dexie-react-hooks';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { Clock, Trash2, ArrowRight, PlayCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import Image from 'next/image';

export function HistoryList() {
  const { setSkeleton, setView, addMessage, setIsGenerating } = useStore();
  const history = useLiveQuery(() => db.history.orderBy('timestamp').reverse().toArray());

  const handleRestore = (item: HistoryItem) => {
    setSkeleton(item.skeleton);
    setView('editor');
    setIsGenerating(false);
    addMessage({
      role: 'assistant',
      content: `已为您恢复历史记录：${item.prompt}`
    });
  };

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    await db.history.delete(id);
  };

  return (
    <div className="w-full max-w-5xl mx-auto mt-16 px-6">
      <div className="flex items-center gap-2 mb-6">
        <Clock className="w-4 h-4 text-black/40" />
        <h2 className="text-xs uppercase tracking-[0.2em] font-medium text-black/60">历史记录</h2>
      </div>

      {(!history || history.length === 0) ? (
        <div className="flex flex-col items-center justify-center py-16 border border-dashed border-black/5 rounded-xl bg-zinc-50/50">
          <Clock className="w-8 h-8 text-black/10 mb-3" />
          <p className="text-sm text-black/30 font-light">暂无历史记录</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {history.map((item) => (
            <div
              key={item.id}
            onClick={() => handleRestore(item)}
            className="group relative bg-white border border-black/5 rounded-xl overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer"
          >
            {/* Thumbnail */}
            <div className="aspect-video bg-zinc-50 relative overflow-hidden">
              {item.thumbnail ? (
                <Image
                  src={item.thumbnail}
                  alt={item.prompt}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-black/20">
                  <PlayCircle className="w-8 h-8" />
                </div>
              )}
              
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
              
              <button
                onClick={(e) => handleDelete(e, item.id!)}
                className="absolute top-2 right-2 p-2 bg-white/80 backdrop-blur-sm rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 hover:text-red-500"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-medium text-sm line-clamp-1 group-hover:text-blue-600 transition-colors">
                  {item.prompt}
                </h3>
                <ArrowRight className="w-4 h-4 text-black/20 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
              </div>
              
              <div className="flex items-center justify-between text-[10px] text-black/40">
                <span>{formatDistanceToNow(item.timestamp, { addSuffix: true, locale: zhCN })}</span>
                <span className="font-mono bg-zinc-50 px-1.5 py-0.5 rounded border border-black/5">
                  {item.skeleton.scenes.length} 镜头
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
      )}
    </div>
  );
}
