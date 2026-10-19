import React from 'react';

interface HeaderProps {
  title: string;
  onBack?: () => void;
  showBack?: boolean;
  onAvatarClick?: () => void;
  onNotificationsClick?: () => void;
  onSyncClick?: () => void;
  isSheetConnected?: boolean;
  userName?: string;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  onBack,
  showBack = false,
  onAvatarClick,
  onNotificationsClick,
  onSyncClick,
  isSheetConnected = false,
}) => {
  return (
    <header className="fixed top-0 inset-x-0 z-40 bg-[#f8f9ff]/85 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.03)] pt-safe">
      <div className="h-16 max-w-md mx-auto px-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {showBack && onBack ? (
            <button
              aria-label="Go back"
              onClick={onBack}
              className="w-10 h-10 -ml-1 flex items-center justify-center rounded-full text-[#121c2a] hover:bg-[#dfe9fc]/50 transition-colors active:scale-95 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[22px]">arrow_back</span>
            </button>
          ) : null}
          <h1 className="font-semibold text-[20px] text-[#121c2a] tracking-tight">
            {title}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Google Sheets Sync Button */}
          <button
            aria-label="Google Sheets Sync"
            onClick={onSyncClick || onNotificationsClick}
            className="h-9 px-2.5 flex items-center gap-1.5 rounded-full text-[#121c2a] bg-[#eff3ff] hover:bg-[#dfe9fc] transition-colors relative cursor-pointer active:scale-95 border border-[#dfe9fc]/80"
            title={isSheetConnected ? "Google Sheets Connected • Tap to Sync" : "Connect Google Sheets"}
          >
            <span className="material-symbols-outlined text-[19px] text-[#006948]">cloud_sync</span>
            <span className="text-[11px] font-semibold text-[#006948]">Sync</span>
            <span className={`w-2 h-2 rounded-full ${isSheetConnected ? 'bg-[#006948] animate-pulse' : 'bg-[#e07f00]'}`} />
          </button>

          <button
            aria-label="User Profile"
            onClick={onAvatarClick}
            className="w-9 h-9 rounded-full overflow-hidden border border-[#006948]/30 flex items-center justify-center shrink-0 cursor-pointer shadow-xs active:scale-95 transition-transform"
          >
            <img src="/pwa-192x192.png" alt="MSR Penny" className="w-full h-full object-cover" />
          </button>
        </div>
      </div>
    </header>
  );
};
