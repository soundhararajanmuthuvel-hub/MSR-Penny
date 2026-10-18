import React, { useState } from 'react';
import { useApp } from '../context/AppContext';

interface SyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToSettings: () => void;
}

export const SyncModal: React.FC<SyncModalProps> = ({
  isOpen,
  onClose,
  onNavigateToSettings,
}) => {
  const { state, syncWithGoogleSheets } = useApp();
  const [isSyncing, setIsSyncing] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSyncNow = async () => {
    setIsSyncing(true);
    setFeedback('Synchronizing transactions to Google Sheets...');
    const res = await syncWithGoogleSheets();
    setIsSyncing(false);
    setFeedback(res.message);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl p-5 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#006948] animate-pulse" />
            <h3 className="text-[16px] font-bold text-[#121c2a]">Live Dual-Sync Status</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-[#3e4942] hover:bg-[#eff3ff]"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <div className="bg-[#eff3ff] p-3.5 rounded-xl border border-[#dfe9fc]/60 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-[#3e4942]">Offline Local Storage</span>
            <span className="text-[11px] font-bold text-[#006948] bg-[#88f8c4]/40 px-2 py-0.5 rounded-full">
              Active & Saved
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[12px] text-[#3e4942]">Cloud Server Persistence</span>
            <span className="text-[11px] font-bold text-[#006948] bg-[#88f8c4]/40 px-2 py-0.5 rounded-full">
              Connected
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[12px] text-[#3e4942]">Google Sheets Webhook</span>
            <span className="text-[11px] font-bold text-[#121c2a]">
              {state.settings.googleAppsScriptUrl ? 'Configured' : 'Not configured'}
            </span>
          </div>
        </div>

        <p className="text-[12px] text-[#3e4942] leading-relaxed">
          All financial calculations happen instantly and stay persisted across devices. You can also stream rows to your Google Sheet automatically.
        </p>

        {state.settings.lastSyncedAt && (
          <p className="text-[11px] text-[#3e4942]">
            Last Synced: <strong>{new Date(state.settings.lastSyncedAt).toLocaleString()}</strong>
          </p>
        )}

        {feedback && (
          <div className="text-[11px] font-medium bg-[#88f8c4]/30 text-[#006948] p-2.5 rounded-xl text-center">
            {feedback}
          </div>
        )}

        <div className="pt-1 flex gap-2">
          <button
            onClick={() => {
              onClose();
              onNavigateToSettings();
            }}
            className="flex-1 py-2.5 rounded-xl border border-[#dfe9fc] text-[12px] font-semibold text-[#121c2a] hover:bg-[#eff3ff]"
          >
            Settings
          </button>

          <button
            onClick={handleSyncNow}
            disabled={isSyncing}
            className="flex-1 py-2.5 rounded-xl bg-[#006948] hover:bg-[#00855d] text-white text-[12px] font-semibold flex items-center justify-center gap-1 shadow-xs"
          >
            {isSyncing ? (
              <span className="material-symbols-outlined text-[16px] animate-spin">refresh</span>
            ) : (
              <span className="material-symbols-outlined text-[16px]">sync</span>
            )}
            <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
