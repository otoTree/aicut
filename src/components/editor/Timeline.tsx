'use client';

import { useStore } from '@/store/useStore';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { Video, Music, Type, GripVertical, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const PIXELS_PER_SECOND = 40;
const TRACK_HEIGHT = 48;

export function Timeline() {
  const { skeleton, setSkeleton, currentTime, setCurrentTime, isPlaying, setIsPlaying } = useStore();
  const timelineRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const tracks = skeleton?.tracks || [];
  const totalDuration = Math.max(...tracks.flatMap(t => t.clips.map(c => c.startTime + c.duration)), 0);

  const handleTimelineClick = (e: React.MouseEvent) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = x / PIXELS_PER_SECOND;
    setCurrentTime(Math.max(0, Math.min(time, totalDuration)));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    handleTimelineClick(e);
  };

  const addTrack = () => {
    setSkeleton(prev => {
      if (!prev) return prev;
      const newTrack = {
        id: `track-${Date.now()}`,
        name: `Track ${ (prev.tracks?.length || 0) + 1}`,
        clips: []
      };
      return {
        ...prev,
        tracks: [...(prev.tracks || []), newTrack]
      };
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && timelineRef.current) {
        const rect = timelineRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const time = x / PIXELS_PER_SECOND;
        setCurrentTime(Math.max(0, Math.min(time, totalDuration)));
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, totalDuration, setCurrentTime]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full flex flex-col bg-white border-t border-black/[0.04] select-none h-[300px]">
      {/* Timeline Toolbar */}
      <div className="flex items-center justify-between px-6 py-2 border-b border-black/[0.04] bg-zinc-50/50">
        <div className="flex items-center gap-4">
          <span className="text-[10px] font-mono text-black/40">
            {formatTime(currentTime)} / {formatTime(totalDuration)}
          </span>
          <button 
            onClick={addTrack}
            className="text-[10px] uppercase tracking-widest text-black/40 hover:text-black transition-colors flex items-center gap-1"
          >
            <Plus className="w-3 h-3" />
            添加轨道
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col relative">
        <div className="flex-1 overflow-auto custom-scrollbar relative" ref={timelineRef} onMouseDown={handleMouseDown}>
          <div 
            className="relative" 
            style={{ width: `${Math.max((totalDuration + 10) * PIXELS_PER_SECOND + 128, 1000)}px`, minHeight: '100%' }}
          >
            {/* Ruler */}
            <div 
              className="h-8 border-b border-black/[0.04] relative bg-zinc-50/30 sticky top-0 z-20" 
              onClick={handleTimelineClick}
            >
              <div className="absolute inset-0 ml-32">
                {Array.from({ length: Math.ceil(totalDuration) + 10 }).map((_, i) => (
                  <div
                    key={i}
                    className="absolute top-0 flex flex-col items-center"
                    style={{ left: i * PIXELS_PER_SECOND }}
                  >
                    <div className={cn(
                      "w-[1px] bg-black/10",
                      i % 5 === 0 ? "h-4" : "h-2 mt-2"
                    )} />
                    {i % 5 === 0 && (
                      <span className="text-[8px] font-mono text-black/20 mt-1">{i}s</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Tracks Area */}
            <div className="relative">
              {/* Tracks Background Grid */}
              <div className="absolute inset-0 pointer-events-none ml-32">
                {Array.from({ length: Math.ceil(totalDuration) + 10 }).map((_, i) => (
                  <div
                    key={i}
                    className="absolute top-0 bottom-0 w-[1px] bg-black/[0.02]"
                    style={{ left: i * PIXELS_PER_SECOND }}
                  />
                ))}
              </div>

              {tracks.map((track) => (
                <TrackRow 
                  key={track.id} 
                  icon={<GripVertical className="w-3 h-3" />} 
                  label={track.name}
                >
                  {track.clips.map((clip) => (
                    <TrackItem
                      key={clip.id}
                      id={clip.id}
                      trackId={track.id}
                      startTime={clip.startTime}
                      duration={clip.duration}
                      color={
                        clip.type === 'video' ? 'bg-zinc-100' : 
                        clip.type === 'audio' ? 'bg-emerald-50' : 
                        'bg-blue-50'
                      }
                      label={clip.content}
                      imageUrl={clip.imageUrl}
                      variant={clip.type}
                    />
                  ))}
                </TrackRow>
              ))}

              {/* Playhead */}
              <div
                className="absolute top-0 bottom-0 w-[2px] bg-red-500 z-50 pointer-events-none ml-32"
                style={{ left: currentTime * PIXELS_PER_SECOND }}
              >
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-3 bg-red-500 rotate-45 -translate-y-1/2" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TrackRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex group border-b border-black/[0.02] last:border-none min-w-full">
      <div className="w-32 shrink-0 flex items-center gap-2 px-4 bg-white border-r border-black/[0.04] sticky left-0 z-10">
        <span className="text-black/40">{icon}</span>
        <span className="text-[10px] font-medium uppercase tracking-wider text-black/40 truncate">{label}</span>
      </div>
      <div className="flex-1 h-12 relative">
        {children}
      </div>
    </div>
  );
}

function TrackItem({ 
  id,
  trackId,
  startTime, 
  duration, 
  color, 
  label, 
  imageUrl,
  variant = 'video'
}: { 
  id: string;
  trackId: string;
  startTime: number; 
  duration: number; 
  color: string; 
  label: string;
  imageUrl?: string;
  variant?: 'video' | 'audio' | 'text';
}) {
  const { setSkeleton } = useStore();

  const handleResize = (e: React.MouseEvent, side: 'left' | 'right') => {
    e.stopPropagation();
    const startX = e.clientX;
    const initialDuration = duration;
    const initialStartTime = startTime;
    
    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaTime = deltaX / PIXELS_PER_SECOND;
      
      setSkeleton((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          tracks: prev.tracks?.map(t => t.id === trackId ? {
            ...t,
            clips: t.clips.map(c => {
              if (c.id !== id) return c;
              if (side === 'right') {
                return { ...c, duration: Math.max(0.5, initialDuration + deltaTime) };
              } else {
                const newStartTime = Math.max(0, initialStartTime + deltaTime);
                const newDuration = Math.max(0.5, initialDuration - (newStartTime - initialStartTime));
                return { ...c, startTime: newStartTime, duration: newDuration };
              }
            })
          } : t)
        };
      });
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const Icon = variant === 'video' ? Video : variant === 'audio' ? Music : Type;

  return (
    <div
      className={cn(
        "absolute top-1 bottom-1 rounded-md border border-black/5 overflow-hidden group/item cursor-pointer hover:ring-1 hover:ring-black/20 transition-shadow",
        color
      )}
      style={{
        left: startTime * PIXELS_PER_SECOND,
        width: duration * PIXELS_PER_SECOND,
      }}
    >
      <div className="flex h-full items-center px-2 gap-2">
        <Icon className="w-3 h-3 text-black/20 shrink-0" />
        {imageUrl && variant === 'video' && (
          <Image src={imageUrl} alt="" width={32} height={18} className="h-4 w-auto aspect-video object-cover rounded-sm" />
        )}
        <span className="text-[9px] truncate font-light text-black/60">
          {label}
        </span>
      </div>
      
      {/* Resizers */}
      <div 
        className="absolute left-0 top-0 bottom-0 w-1 bg-black/10 opacity-0 group-hover/item:opacity-100 cursor-ew-resize hover:bg-black/30 transition-colors"
        onMouseDown={(e) => handleResize(e, 'left')}
      />
      <div 
        className="absolute right-0 top-0 bottom-0 w-1 bg-black/10 opacity-0 group-hover/item:opacity-100 cursor-ew-resize hover:bg-black/30 transition-colors"
        onMouseDown={(e) => handleResize(e, 'right')}
      />
    </div>
  );
}
