import React, { useState } from 'react';
import { useApp } from '../context/AppContext';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose }) => {
  const { state, updateSettings, resetToSampleData, clearDemoData, syncWithGoogleSheets } = useApp();
  const [userName, setUserName] = useState(state.settings.userName || 'Soundhar');
  const [appaPhone, setAppaPhone] = useState(state.settings.appaPhoneNumber || '+919876543210');
  const [scriptUrl, setScriptUrl] = useState(state.settings.googleAppsScriptUrl || '');
  const [isResetting, setIsResetting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSave = async () => {
    await updateSettings({
      userName,
      appaPhoneNumber: appaPhone.trim(),
      googleAppsScriptUrl: scriptUrl.trim(),
    });
    setMessage('Profile & Settings updated!');
    setTimeout(() => {
      setMessage(null);
      onClose();
    }, 1000);
  };

  const handleSyncFromProfile = async () => {
    setIsSyncing(true);
    const target = scriptUrl.trim() || state.settings.googleAppsScriptUrl;
    if (scriptUrl.trim() && scriptUrl.trim() !== state.settings.googleAppsScriptUrl) {
      await updateSettings({ googleAppsScriptUrl: scriptUrl.trim() });
    }
    const res = await syncWithGoogleSheets(target);
    setIsSyncing(false);
    setMessage(res.message);
    setTimeout(() => setMessage(null), 3500);
  };

  const handleClearDemo = async () => {
    if (window.confirm('Clear all sample/demo data to start fresh? Your Google Sheet Webhook and WhatsApp number will stay saved.')) {
      setIsClearing(true);
      await clearDemoData(true);
      setIsClearing(false);
      setMessage('Demo data removed! Ledger is fresh.');
      setTimeout(() => {
        setMessage(null);
        onClose();
      }, 1200);
    }
  };

  const handleReset = async () => {
    setIsResetting(true);
    await resetToSampleData();
    setIsResetting(false);
    setMessage('Reset to reference sample data!');
    setTimeout(() => {
      setMessage(null);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl p-5 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-[#006948] flex items-center justify-center text-white">
              <span className="material-symbols-outlined text-[20px]">person</span>
            </div>
            <div>
              <h3 className="text-[16px] font-bold text-[#121c2a]">MSR Penny Profile</h3>
              <p className="text-[11px] text-[#3e4942]">Single-user private finance PWA</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-[#3e4942] hover:bg-[#eff3ff]"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-semibold text-[#3e4942] uppercase tracking-wider block mb-1">
              Your Name
            </label>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              className="w-full px-3 py-2 bg-[#f8f9ff] border border-[#dfe9fc] rounded-xl text-[13px] text-[#121c2a] focus:outline-none focus:border-[#006948]"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-[#3e4942] uppercase tracking-wider block mb-1">
              Appa's WhatsApp Phone Number
            </label>
            <input
              type="tel"
              value={appaPhone}
              onChange={(e) => setAppaPhone(e.target.value)}
              placeholder="+919876543210"
              className="w-full px-3 py-2 bg-[#f8f9ff] border border-[#dfe9fc] rounded-xl text-[13px] text-[#121c2a] focus:outline-none focus:border-[#006948]"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-[#3e4942] uppercase tracking-wider block mb-1">
              Google Apps Script Web App URL
            </label>
            <input
              type="url"
              value={scriptUrl}
              onChange={(e) => setScriptUrl(e.target.value)}
              placeholder="https://script.google.com/macros/s/.../exec"
              className="w-full px-3 py-2 bg-[#f8f9ff] border border-[#dfe9fc] rounded-xl text-[12px] font-mono text-[#121c2a] focus:outline-none focus:border-[#006948]"
            />
          </div>

          <div className="bg-[#eff3ff] p-3 rounded-xl border border-[#dfe9fc]/50 text-[11px] text-[#3e4942] space-y-1">
            <div className="flex items-center justify-between">
              <span><strong>Google Sheets:</strong></span>
              <span className={`font-bold ${scriptUrl ? 'text-[#006948]' : 'text-[#b7791f]'}`}>
                {scriptUrl ? 'Connected' : 'Not configured'}
              </span>
            </div>
            <p><strong>App Identity:</strong> MSR Penny PWA</p>
            <p><strong>Email:</strong> soundhararajanmuthuvel@gmail.com</p>
          </div>

          {message && (
            <p className="text-[11px] text-[#006948] font-semibold text-center bg-[#88f8c4]/30 py-2 rounded-lg">
              {message}
            </p>
          )}

          <div className="pt-2 flex flex-col gap-2">
            <button
              type="button"
              onClick={handleSyncFromProfile}
              disabled={isSyncing}
              className="w-full py-2.5 rounded-xl bg-[#006948] hover:bg-[#00855d] text-white text-[13px] font-semibold flex items-center justify-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-60"
            >
              <span className={`material-symbols-outlined text-[17px] ${isSyncing ? 'animate-spin' : ''}`}>
                {isSyncing ? 'refresh' : 'sync'}
              </span>
              <span>{isSyncing ? 'Syncing to Google Sheets...' : 'Sync Now'}</span>
            </button>
            <button
              onClick={handleSave}
              className="w-full py-2.5 rounded-xl bg-[#006948] hover:bg-[#00855d] text-white text-[13px] font-semibold shadow-xs"
            >
              Save Profile
            </button>

            <button
              type="button"
              onClick={handleClearDemo}
              disabled={isClearing}
              className="w-full py-2.5 rounded-xl bg-[#ffdad6]/60 hover:bg-[#ffdad6] border border-[#ffb4ab] text-[#ba1a1a] text-[12px] font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[17px]">delete_sweep</span>
              <span>{isClearing ? 'Clearing Demo Records...' : 'Clear Demo Data (Start Fresh)'}</span>
            </button>

            <button
              onClick={handleReset}
              disabled={isResetting}
              className="w-full py-2.5 rounded-xl border border-[#dfe9fc] hover:bg-[#eff3ff] text-[#3e4942] text-[12px] font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[17px]">restart_alt</span>
              <span>{isResetting ? 'Restoring...' : 'Restore Screenshot Sample Data'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
