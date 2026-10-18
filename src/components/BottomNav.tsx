import React from 'react';

export type NavTab = 'home' | 'history' | 'freelance' | 'reports';

interface BottomNavProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  onOpenAdd: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  onTabChange,
  onOpenAdd,
}) => {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 pb-safe bg-white/95 backdrop-blur-xl border-t border-[#dfe9fc]/60 shadow-[0_-2px_12px_rgba(0,0,0,0.04)]">
      <div className="max-w-md mx-auto flex items-center justify-around h-16 px-1">
        {/* Home */}
        <button
          onClick={() => onTabChange('home')}
          className={`flex flex-col items-center justify-center min-w-[56px] h-14 transition-colors cursor-pointer ${
            currentTab === 'home'
              ? 'text-[#006948] font-semibold'
              : 'text-[#6d7a72] hover:text-[#121c2a]'
          }`}
        >
          <span
            className="material-symbols-outlined text-[24px]"
            style={currentTab === 'home' ? { fontVariationSettings: "'FILL' 1" } : {}}
          >
            home
          </span>
          <span className="text-[10px] font-medium tracking-wide mt-0.5">Home</span>
        </button>

        {/* History */}
        <button
          onClick={() => onTabChange('history')}
          className={`flex flex-col items-center justify-center min-w-[56px] h-14 transition-colors cursor-pointer ${
            currentTab === 'history'
              ? 'text-[#006948] font-semibold'
              : 'text-[#6d7a72] hover:text-[#121c2a]'
          }`}
        >
          <span
            className="material-symbols-outlined text-[24px]"
            style={currentTab === 'history' ? { fontVariationSettings: "'FILL' 1" } : {}}
          >
            receipt_long
          </span>
          <span className="text-[10px] font-medium tracking-wide mt-0.5">History</span>
        </button>

        {/* Floating Center Add Button */}
        <div className="relative flex items-center justify-center px-1">
          <button
            aria-label="Add Transaction"
            onClick={onOpenAdd}
            className="w-12 h-12 -mt-5 rounded-full bg-[#006948] text-white flex items-center justify-center shadow-[0_4px_14px_rgba(0,105,72,0.35)] active:scale-90 hover:bg-[#00855d] transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[26px]">add</span>
          </button>
        </div>

        {/* Freelance */}
        <button
          onClick={() => onTabChange('freelance')}
          className={`flex flex-col items-center justify-center min-w-[56px] h-14 transition-colors cursor-pointer ${
            currentTab === 'freelance'
              ? 'text-[#006948] font-semibold'
              : 'text-[#6d7a72] hover:text-[#121c2a]'
          }`}
        >
          <span
            className="material-symbols-outlined text-[24px]"
            style={currentTab === 'freelance' ? { fontVariationSettings: "'FILL' 1" } : {}}
          >
            work_outline
          </span>
          <span className="text-[10px] font-medium tracking-wide mt-0.5">Freelance</span>
        </button>

        {/* Reports */}
        <button
          onClick={() => onTabChange('reports')}
          className={`flex flex-col items-center justify-center min-w-[56px] h-14 transition-colors cursor-pointer ${
            currentTab === 'reports'
              ? 'text-[#006948] font-semibold'
              : 'text-[#6d7a72] hover:text-[#121c2a]'
          }`}
        >
          <span
            className="material-symbols-outlined text-[24px]"
            style={currentTab === 'reports' ? { fontVariationSettings: "'FILL' 1" } : {}}
          >
            bar_chart
          </span>
          <span className="text-[10px] font-medium tracking-wide mt-0.5">Reports</span>
        </button>
      </div>
    </nav>
  );
};
