import React from 'react';

interface HeaderProps {
  title: string;
  onBack?: () => void;
  showBack?: boolean;
  onAvatarClick?: () => void;
  onNotificationsClick?: () => void;
  userName?: string;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  onBack,
  showBack = false,
  onAvatarClick,
  onNotificationsClick,
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
          <button
            aria-label="Notifications"
            onClick={onNotificationsClick}
            className="w-10 h-10 flex items-center justify-center rounded-full text-[#3e4942] hover:text-[#121c2a] hover:bg-[#dfe9fc]/40 transition-colors relative cursor-pointer"
          >
            <span className="material-symbols-outlined text-[22px]">notifications_none</span>
            <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-[#006948]" />
          </button>

          <button
            aria-label="User Profile"
            onClick={onAvatarClick}
            className="w-8 h-8 rounded-full bg-[#006948] flex items-center justify-center shrink-0 cursor-pointer shadow-sm active:scale-95 transition-transform"
          >
            <span className="material-symbols-outlined text-white text-[18px]">person</span>
          </button>
        </div>
      </div>
    </header>
  );
};
