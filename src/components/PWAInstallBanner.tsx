import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallBanner: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  if (isInstalled || isDismissed) return null;

  return (
    <>
      {/* Chromium / Android install prompt */}
      {isInstallable && (
        <div className="bg-[#eff3ff] border border-[#dfe9fc] p-3 rounded-2xl flex items-center justify-between shadow-xs mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#006948] flex items-center justify-center text-white shrink-0">
              <span className="material-symbols-outlined text-[18px]">install_mobile</span>
            </div>
            <div>
              <p className="text-[12px] font-semibold text-[#121c2a]">Install MSR Penny App</p>
              <p className="text-[10px] text-[#3e4942]">Fast, offline personal finance PWA</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={install}
              className="px-3 py-1.5 bg-[#006948] hover:bg-[#00855d] text-white text-[11px] font-semibold rounded-lg shadow-xs cursor-pointer active:scale-95 transition-transform"
            >
              Install
            </button>
            <button
              onClick={() => setIsDismissed(true)}
              className="w-6 h-6 flex items-center justify-center text-[#6d7a72] hover:text-[#121c2a]"
            >
              <span className="material-symbols-outlined text-[14px]">close</span>
            </button>
          </div>
        </div>
      )}

      {/* iOS Safari banner */}
      {isIOS && !isInstallable && (
        <div className="bg-[#eff3ff] border border-[#dfe9fc] p-3 rounded-2xl flex items-center justify-between shadow-xs mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#006948] flex items-center justify-center text-white shrink-0">
              <span className="material-symbols-outlined text-[18px]">phone_iphone</span>
            </div>
            <div>
              <p className="text-[12px] font-semibold text-[#121c2a]">Add to iPhone Home Screen</p>
              <p className="text-[10px] text-[#3e4942]">Launch full-screen like a native app</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowIOSGuide(true)}
              className="px-3 py-1.5 bg-[#006948] hover:bg-[#00855d] text-white text-[11px] font-semibold rounded-lg shadow-xs cursor-pointer active:scale-95 transition-transform"
            >
              How to
            </button>
            <button
              onClick={() => setIsDismissed(true)}
              className="w-6 h-6 flex items-center justify-center text-[#6d7a72] hover:text-[#121c2a]"
            >
              <span className="material-symbols-outlined text-[14px]">close</span>
            </button>
          </div>
        </div>
      )}

      {/* iOS Guide Modal */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#006948] text-[22px]">apple</span>
                <h3 className="text-[16px] font-bold text-[#121c2a]">Install on iPhone / iPad</h3>
              </div>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-[#6d7a72] hover:bg-[#eff3ff]"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="space-y-3 text-[13px] text-[#3e4942]">
              <div className="flex items-start gap-3 bg-[#f8f9ff] p-3 rounded-xl border border-[#dfe9fc]/60">
                <span className="w-6 h-6 rounded-full bg-[#006948] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                  1
                </span>
                <p>
                  In Safari, tap the <strong>Share</strong> icon{' '}
                  <span className="material-symbols-outlined text-[16px] inline align-text-bottom">
                    ios_share
                  </span>{' '}
                  in the browser bottom bar.
                </p>
              </div>

              <div className="flex items-start gap-3 bg-[#f8f9ff] p-3 rounded-xl border border-[#dfe9fc]/60">
                <span className="w-6 h-6 rounded-full bg-[#006948] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                  2
                </span>
                <p>
                  Scroll down the share sheet and tap <strong>Add to Home Screen</strong>{' '}
                  <span className="material-symbols-outlined text-[16px] inline align-text-bottom">
                    add_box
                  </span>
                  .
                </p>
              </div>

              <div className="flex items-start gap-3 bg-[#f8f9ff] p-3 rounded-xl border border-[#dfe9fc]/60">
                <span className="w-6 h-6 rounded-full bg-[#006948] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                  3
                </span>
                <p>
                  Tap <strong>Add</strong> in the top-right corner. "MSR Penny" will now launch directly from your home screen!
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowIOSGuide(false)}
              className="w-full py-2.5 rounded-xl bg-[#006948] text-white text-[13px] font-semibold"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};
