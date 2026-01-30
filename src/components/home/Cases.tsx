'use client';

import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import Image from 'next/image';
import { Play } from 'lucide-react';

const cases = [
  {
    title: '山水诗意',
    description: '通过水墨画风格展现江南水乡的宁静与美好',
    image: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&q=80',
  },
  {
    title: '都市律动',
    description: '快节奏剪辑，展现现代都市的繁华与活力',
    image: 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=800&q=80',
  },
  {
    title: '匠心传承',
    description: '特写镜头记录传统手工艺的制作过程',
    image: 'https://images.unsplash.com/photo-1513519245088-0e12902e35ca?w=800&q=80',
  }
];

export function Cases() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-20">
      <div className="flex items-center justify-between mb-12">
        <h2 className="text-2xl font-serif font-light">灵感案例</h2>
        <div className="h-[1px] flex-1 bg-black/5 mx-8" />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {cases.map((item, index) => (
          <motion.div
            key={item.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.1, duration: 0.8 }}
          >
            <Card className="group overflow-hidden border-none bg-transparent cursor-pointer">
              <div className="relative aspect-video rounded-lg overflow-hidden bg-zinc-100">
                <Image 
                  src={item.image} 
                  alt={item.title}
                  fill
                  className="object-cover grayscale hover:grayscale-0 transition-all duration-700 scale-105 group-hover:scale-100"
                />
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
                    <Play className="w-5 h-5 text-white fill-current" />
                  </div>
                </div>
              </div>
              <div className="mt-4 space-y-1">
                <h3 className="font-serif text-lg">{item.title}</h3>
                <p className="text-black/40 text-sm font-light leading-relaxed">
                  {item.description}
                </p>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
