'use client';

import { useStore } from '@/store/useStore';
import { Hero } from '@/components/home/Hero';
import { Cases } from '@/components/home/Cases';
import { EditorLayout } from '@/components/editor/EditorLayout';
import { AnimatePresence, motion } from 'framer-motion';

export default function Home() {
  const { view } = useStore();

  return (
    <main className="min-h-screen bg-white">
      <AnimatePresence mode="wait">
        {view === 'home' ? (
          <motion.div
            key="home"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col"
          >
            <Hero />
            <Cases />
          </motion.div>
        ) : (
          <motion.div
            key="editor"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-screen overflow-hidden"
          >
            <EditorLayout />
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
