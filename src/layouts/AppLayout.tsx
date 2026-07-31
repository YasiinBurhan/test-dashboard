import React, { useEffect, useState } from 'react';
import { Header } from '../components/common/Header';
import { BottomNav, TabType } from '../components/navigation/BottomNav';
import { Sidebar } from '../components/navigation/Sidebar';
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
  const [isLowEnd, setIsLowEnd] = useState<boolean>(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);

  useEffect(() => {
    // Detect low-end mobile device on mount
    const checkLowEnd = () => {
      if (document.body.classList.contains('low-end')) return true;
      if (typeof navigator !== 'undefined') {
        const memory = (navigator as any).deviceMemory;
        const cores = navigator.hardwareConcurrency;
        const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
        return Boolean((memory && memory <= 4) || (cores && cores <= 4) || (isMobile && window.innerWidth < 768));
      }
      return false;
    };
    setIsLowEnd(checkLowEnd());
  }, []);

  useEffect(() => {
    // Scroll instantly to top on tab change to avoid jarring scroll jumps during page transition
    window.scrollTo(0, 0);
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
      {!isLowEnd && (
        <>
          <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-lg md:max-w-2xl h-96 bg-sky-600/10 rounded-full blur-3xl pointer-events-none -z-10" />
          <div className="fixed bottom-0 right-0 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none -z-10" />
        </>
      )}

      {/* Responsive Sidebar */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
      />

      {/* Main Layout Container (Offset by sidebar width on desktop) */}
      <div className="flex-1 flex flex-col lg:pl-72 transition-all duration-300">
        <Header 
          title={title} 
          setActiveTab={setActiveTab} 
          onMenuClick={() => setIsSidebarOpen(true)} 
        />
        
        {/* Spacer for fixed header */}
        <div 
          style={{ 
            height: 'calc(var(--tg-safe-area-inset-top, env(safe-area-inset-top, 0px)) + 76px)' 
          }} 
          className="w-full shrink-0" 
        />
        
        <main 
          style={{ 
            paddingBottom: 'calc(20px + var(--tg-safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)))' 
          }} 
          className="flex-1 w-full max-w-7xl mx-auto px-3.5 sm:px-6 pt-3 relative flex flex-col min-h-0"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: isLowEnd ? 0 : 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: isLowEnd ? 0 : -6 }}
              transition={{ duration: isLowEnd ? 0.08 : 0.15, ease: [0.16, 1, 0.3, 1] }}
              className="flex-1 w-full space-y-4 md:space-y-6"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
};

