import React from 'react';
import { Header } from '../components/common/Header';
import { BottomNav, TabType } from '../components/navigation/BottomNav';

interface MainLayoutProps {
  children: React.ReactNode;
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  title?: string;
}

export const MainLayout: React.FC<MainLayoutProps> = ({
  children,
  activeTab,
  setActiveTab,
  title
}) => {
  return (
    <div
      style={{
        backgroundColor: 'var(--tg-bg-color, #030712)',
        color: 'var(--tg-text-color, #f8fafc)'
      }}
      className="min-h-screen flex flex-col font-sans transition-colors duration-300 relative select-none bg-mesh-gradient overflow-x-hidden"
    >
      {/* Background ambient lighting */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-lg md:max-w-2xl h-96 bg-sky-600/10 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="fixed bottom-0 right-0 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none -z-10" />

      <Header title={title} />

      <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-6 pt-3 space-y-4 md:space-y-6">
        {children}
      </main>


      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
};
