import React, { useEffect } from 'react';
import { Header } from '../components/common/Header';
import { BottomNav, TabType } from '../components/navigation/BottomNav';
import { getTelegramWebApp } from '../telegram/webapp';
import { motion, AnimatePresence } from 'motion/react';

interface AppLayoutProps {
  children: React.ReactNode;
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  title?: string;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  children,
  activeTab,
  setActiveTab,
  title
}) => {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeTab]);

  return (
    <div
      style={{
        backgroundColor: 'var(--tg-bg-color, #030712)',
        color: 'var(--tg-text-color, #f8fafc)',
        minHeight: 'var(--tg-viewport-height)'
      }}
      className="flex flex-col font-sans transition-colors duration-300 relative select-none bg-mesh-gradient overflow-x-hidden"
    >
      {/* Background ambient lighting */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-lg md:max-w-2xl h-96 bg-sky-600/10 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="fixed bottom-0 right-0 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none -z-10" />

      <Header title={title} setActiveTab={setActiveTab} />
      
      {/* Spacer for fixed header */}
      <div 
        style={{ 
          height: 'calc(var(--tg-safe-area-inset-top, env(safe-area-inset-top, 0px)) + 64px)' 
        }} 
        className="w-full shrink-0" 
      />
      
      <main className="flex-1 w-full max-w-7xl mx-auto px-3.5 sm:px-6 pt-3 pb-28 md:pb-32 relative flex flex-col">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="flex-1 w-full space-y-4 md:space-y-6"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
};

