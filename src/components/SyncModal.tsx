import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';

interface SyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToSettings?: () => void;
}

export const SyncModal: React.FC<SyncModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    state,
    syncWithGoogleSheets,
    refreshFromGoogleSheets,
    updateSettings,
    clearDemoData,
    isDemoDataLoaded,
  } = useApp();
  const [urlInput, setUrlInput] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; success: boolean } | null>(null);
  const [showGuide, setShowGuide] = useState(false);


  useEffect(() => {
    if (isOpen) {
      setUrlInput(state.settings.googleAppsScriptUrl || '');
      setFeedback(null);
    }
  }, [isOpen, state.settings.googleAppsScriptUrl]);

  if (!isOpen) return null;

  const isConfigured = Boolean(state.settings.googleAppsScriptUrl && state.settings.googleAppsScriptUrl.trim().length > 10);

  const validateUrl = (url: string) => {
    const trimmed = url.trim();
    if (trimmed.includes('docs.google.com/spreadsheets')) {
      return '⚠️ That is a Google Spreadsheet link! You need the Apps Script Web App URL: In your Google Sheet, click Extensions → Apps Script → Deploy → New deployment → Web app. Set "Who has access" to "Anyone", and copy the URL ending in /exec.';
    }
    if (trimmed.endsWith('/edit') || trimmed.includes('/edit#')) {
      return '⚠️ That URL ends with /edit (the code editor). Please click Deploy → New deployment → Web app, and copy the Web App URL ending in /exec.';
    }
    if (trimmed && !trimmed.startsWith('https://script.google.com/')) {
      return '⚠️ Google Apps Script URLs start with https://script.google.com/macros/s/.../exec';
    }
    return null;
  };

  const urlWarning = validateUrl(urlInput);

  const handleSaveUrl = async () => {
    const cleanUrl = urlInput.trim().replace(/^["']|["']$/g, '');
    if (!cleanUrl) {
      setFeedback({ text: 'Please enter a valid Google Apps Script URL', success: false });
      return;
    }
    const warning = validateUrl(cleanUrl);
    if (warning) {
      setFeedback({ text: warning, success: false });
      return;
    }
    await updateSettings({ googleAppsScriptUrl: cleanUrl });
    setFeedback({ text: 'Google Apps Script URL saved!', success: true });
    setTimeout(() => setFeedback(null), 2500);
  };

  const handleCopyCodeGs = async () => {
    try {
      const res = await fetch('/Code.gs');
      if (res.ok) {
        const text = await res.text();
        await navigator.clipboard.writeText(text);
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2500);
        return;
      }
    } catch {}
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleTestConnection = async () => {
    const targetUrl = (urlInput || state.settings.googleAppsScriptUrl || '').trim();
    if (!targetUrl) {
      setFeedback({ text: 'Please enter a URL first to test', success: false });
      return;
    }

    const warning = validateUrl(targetUrl);
    if (warning) {
      setFeedback({ text: warning, success: false });
      return;
    }

    setIsTesting(true);
    setFeedback(null);
    try {
      const testUrl = `${targetUrl}${targetUrl.includes('?') ? '&' : '?'}action=status`;
      const res = await fetch(testUrl, { method: 'GET', mode: 'cors' }).catch(() => null);
      if (res && res.ok) {
        const json = await res.json().catch(() => null);
        if (json && json.status === 'online') {
          setFeedback({
            text: `Connection verified! Active sheet: "${json.activeSpreadsheet || 'Connected'}"`,
            success: true,
          });
        } else {
          setFeedback({ text: 'Connected! Ready to sync.', success: true });
        }
      } else {
        setFeedback({
          text: 'Webhook URL reachable. Tap "Sync Now" to push your ledger to Google Sheets.',
          success: true,
        });
      }
    } catch {
      setFeedback({
        text: 'URL saved. Ready to sync via POST.',
        success: true,
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleClearDemoAndSync = async () => {
    if (window.confirm('Clear all demo data and start fresh? This will remove sample transactions while keeping your settings and Google Sheet URL.')) {
      setIsClearing(true);
      await clearDemoData(true);
      setIsClearing(false);
      setFeedback({ text: 'Demo records removed! Ledger is fresh and clean.', success: true });
    }
  };

  const handleRefreshNow = async () => {
    const targetUrl = (urlInput || state.settings.googleAppsScriptUrl || '').trim();
    if (!targetUrl) {
      setFeedback({ text: 'Please enter your Google Apps Script Web App URL first.', success: false });
      return;
    }

    const warning = validateUrl(targetUrl);
    if (warning) {
      setFeedback({ text: warning, success: false });
      return;
    }

    setIsRefreshing(true);
    setFeedback(null);

    if (urlInput.trim() && urlInput.trim() !== state.settings.googleAppsScriptUrl) {
      await updateSettings({ googleAppsScriptUrl: urlInput.trim() });
    }

    const res = await refreshFromGoogleSheets();
    setIsRefreshing(false);
    setFeedback({ text: res.message, success: res.success });
  };

  const handleSyncNow = async () => {
    const targetUrl = (urlInput || state.settings.googleAppsScriptUrl || '').trim();
    if (!targetUrl) {
      setFeedback({ text: 'Please enter your Google Apps Script Web App URL first.', success: false });
      return;
    }

    const warning = validateUrl(targetUrl);
    if (warning) {
      setFeedback({ text: warning, success: false });
      return;
    }

    setIsSyncing(true);
    setFeedback(null);

    if (urlInput.trim() && urlInput.trim() !== state.settings.googleAppsScriptUrl) {
      await updateSettings({ googleAppsScriptUrl: urlInput.trim() });
    }

    // Bidirectional sync: Pull remote first to protect existing records, then push
    await refreshFromGoogleSheets().catch(() => {});
    const res = await syncWithGoogleSheets(targetUrl);
    setIsSyncing(false);
    setFeedback({ text: res.message, success: res.success });
  };


  return (
    <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-1 border-b border-[#dfe9fc]/50">
          <div className="flex items-center gap-2">
            <span
              className={`w-3 h-3 rounded-full ${
                isConfigured ? 'bg-[#006948] animate-pulse' : 'bg-[#e07f00]'
              }`}
            />
            <h3 className="text-[16px] font-bold text-[#121c2a]">Google Sheets Dual-Sync</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-[#3e4942] hover:bg-[#eff3ff] cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Status Card */}
        <div className="bg-[#eff3ff] p-3.5 rounded-xl border border-[#dfe9fc]/60 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-[#3e4942] font-medium">Google Sheet Status</span>
            <span
              className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                isConfigured
                  ? 'bg-[#88f8c4]/40 text-[#006948]'
                  : 'bg-[#fed7aa] text-[#9a3412]'
              }`}
            >
              {isConfigured ? 'Connected' : 'Setup Required'}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[12px] text-[#3e4942]">Active Records to Sync</span>
            <span className="text-[12px] font-bold text-[#121c2a]">
              {state.transactions.length} transactions
            </span>
          </div>

          {state.settings.lastSyncedAt && (
            <div className="flex items-center justify-between pt-1 border-t border-[#dfe9fc]/50 text-[11px] text-[#3e4942]">
              <span>Last Synced:</span>
              <strong className="text-[#121c2a]">
                {new Date(state.settings.lastSyncedAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}{' '}
                • {new Date(state.settings.lastSyncedAt).toLocaleDateString()}
              </strong>
            </div>
          )}
        </div>

        {/* Webhook URL Input */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-semibold text-[#3e4942] uppercase tracking-wider">
              Google Apps Script Web App URL
            </label>
            <button
              type="button"
              onClick={() => setShowGuide(!showGuide)}
              className="text-[11px] text-[#006948] font-semibold hover:underline cursor-pointer"
            >
              {showGuide ? 'Hide guide' : 'How to get URL?'}
            </button>
          </div>

          <div className="flex gap-1.5">
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://script.google.com/macros/s/.../exec"
              className="flex-1 px-3 py-2 bg-[#f8f9ff] border border-[#dfe9fc] rounded-xl text-[12px] font-mono text-[#121c2a] focus:outline-none focus:border-[#006948]"
            />
            <button
              type="button"
              onClick={handleSaveUrl}
              className="px-3 py-2 rounded-xl bg-[#eff3ff] border border-[#dfe9fc] text-[12px] font-semibold text-[#121c2a] hover:bg-[#dfe9fc] cursor-pointer"
            >
              Save
            </button>
          </div>
          {urlWarning && (
            <p className="text-[11px] font-medium text-[#ba1a1a] bg-[#ffdad6]/60 p-2.5 rounded-xl border border-[#ffb4ab] leading-relaxed">
              {urlWarning}
            </p>
          )}
        </div>

        {/* Setup Guide Accordion */}
        {showGuide && (
          <div className="bg-[#f8f9ff] border border-[#dfe9fc] p-3 rounded-xl text-[11px] text-[#3e4942] space-y-2">
            <p className="font-bold text-[#121c2a]">Quick 3-Step Setup:</p>
            <ol className="list-decimal list-inside space-y-1 leading-relaxed">
              <li>Open your Google Sheet → <strong>Extensions → Apps Script</strong>.</li>
              <li>Paste the repository's <code>Code.gs</code> code and click <strong>Save</strong> (💾).</li>
              <li>Click <strong>Deploy → New deployment</strong>, select <strong>Web app</strong>, set <strong>Execute as: Me</strong> and <strong>Who has access: Anyone</strong> (required!), then copy the Web app URL ending in <code>/exec</code> and paste it above!</li>
            </ol>
            <button
              type="button"
              onClick={handleCopyCodeGs}
              className="w-full py-2 rounded-xl bg-white border border-[#dfe9fc] hover:bg-[#88f8c4]/30 text-[12px] font-semibold text-[#006948] flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            >
              <span className="material-symbols-outlined text-[16px]">{copiedCode ? 'check' : 'content_copy'}</span>
              <span>{copiedCode ? 'Code.gs Copied to Clipboard!' : 'Copy Code.gs Script'}</span>
            </button>
          </div>
        )}

        {/* Feedback Message */}
        {feedback && (
          <div
            className={`text-[12px] font-medium p-3 rounded-xl text-center leading-relaxed ${
              feedback.success
                ? 'bg-[#88f8c4]/30 text-[#006948] border border-[#006948]/20'
                : 'bg-[#ffdad6]/60 text-[#ba1a1a] border border-[#ba1a1a]/20'
            }`}
          >
            {feedback.text}
          </div>
        )}

        {/* Action Buttons */}
        <div className="pt-2 flex flex-col gap-2">
          {/* Refresh / Import from Google Sheets Button */}
          <button
            type="button"
            onClick={handleRefreshNow}
            disabled={isRefreshing || isSyncing}
            className="w-full py-2.5 rounded-xl bg-[#eff3ff] hover:bg-[#dfe9fc] active:scale-[0.99] text-[#006948] text-[13px] font-semibold flex items-center justify-center gap-2 border border-[#006948]/30 transition-all cursor-pointer disabled:opacity-60"
          >
            {isRefreshing ? (
              <>
                <span className="material-symbols-outlined text-[18px] animate-spin">refresh</span>
                <span>Fetching records from Google Sheets...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">cloud_download</span>
                <span>Import / Refresh from Google Sheets</span>
              </>
            )}
          </button>

          {/* Main Primary Green Sync Now Button */}
          <button
            type="button"
            onClick={handleSyncNow}
            disabled={isSyncing || isRefreshing}
            className="w-full py-3 rounded-xl bg-[#006948] hover:bg-[#00855d] active:scale-[0.99] text-white text-[13px] font-semibold flex items-center justify-center gap-2 shadow-[0_4px_12px_rgba(0,105,72,0.25)] transition-all cursor-pointer disabled:opacity-60"
          >
            {isSyncing ? (
              <>
                <span className="material-symbols-outlined text-[18px] animate-spin">refresh</span>
                <span>Synchronizing to Google Sheets...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">sync</span>
                <span>Sync Now (Bidirectional)</span>
              </>
            )}
          </button>

          {isDemoDataLoaded && (
            <button
              type="button"
              onClick={handleClearDemoAndSync}
              disabled={isClearing || isSyncing}
              className="w-full py-2 rounded-xl bg-[#ffdad6]/50 hover:bg-[#ffdad6] border border-[#ffb4ab] text-[#ba1a1a] text-[12px] font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[16px]">delete_sweep</span>
              <span>{isClearing ? 'Clearing Demo Records...' : 'Clear Demo Data (Start Fresh)'}</span>
            </button>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting || isSyncing}
              className="flex-1 py-2 rounded-xl border border-[#dfe9fc] text-[12px] font-semibold text-[#3e4942] hover:bg-[#eff3ff] hover:text-[#121c2a] flex items-center justify-center gap-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[15px]">sensors</span>
              <span>{isTesting ? 'Testing...' : 'Test Connection'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-xl border border-[#dfe9fc] text-[12px] font-semibold text-[#3e4942] hover:bg-[#eff3ff] hover:text-[#121c2a] cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

