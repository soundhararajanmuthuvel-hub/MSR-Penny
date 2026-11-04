import React, { useState } from 'react';
import { hashPin } from './PinLockModal';
import { useApp } from '../context/AppContext';

interface PinSetupModalProps {
  isOpen: boolean;
  isPinCurrentlySet?: boolean;
  onClose: () => void;
  onSavePin?: (pinHash: string, enabled: boolean) => void;
  onDisablePin?: () => void;
}

export const PinSetupModal: React.FC<PinSetupModalProps> = ({
  isOpen,
  isPinCurrentlySet,
  onClose,
  onSavePin,
  onDisablePin,
}) => {
  const { state, updateSettings } = useApp();

  const isEnabled = isPinCurrentlySet ?? Boolean(state.settings?.pinLockEnabled && state.settings?.pinHash);

  const [pin, setPin] = useState<string>('');
  const [confirmPin, setConfirmPin] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      setError('PIN must be exactly 4 digits.');
      return;
    }
    if (pin !== confirmPin) {
      setError('PIN and confirmation PIN do not match.');
      return;
    }

    setIsSaving(true);
    const pinHash = hashPin(pin);

    try {
      if (onSavePin) {
        onSavePin(pinHash, true);
      } else {
        await updateSettings({
          pinLockEnabled: true,
          pinHash,
        });
      }
      onClose();
    } catch {
      setError('Failed to save PIN.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisable = async () => {
    setIsSaving(true);
    try {
      if (onDisablePin) {
        onDisablePin();
      } else {
        await updateSettings({
          pinLockEnabled: false,
          pinHash: '',
        });
      }
      onClose();
    } catch {
      setError('Failed to disable PIN.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl p-5 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#dfe9fc]/60 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#eff3ff] text-[#006948] flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">lock</span>
            </div>
            <div>
              <h3 className="text-[16px] font-bold text-[#121c2a]">App Passcode PIN</h3>
              <p className="text-[11px] text-[#3e4942]">Device privacy & app auto-lock</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#3e4942] hover:bg-[#eff3ff]"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Existing PIN Status */}
        {isEnabled && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-600 text-[18px]">verified_user</span>
              <span className="text-[12px] font-semibold text-emerald-900">PIN Protection Active</span>
            </div>
            <button
              type="button"
              disabled={isSaving}
              onClick={handleDisable}
              className="text-[11px] font-semibold text-rose-600 hover:text-rose-800 cursor-pointer"
            >
              Disable
            </button>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-3.5">
          <div>
            <label className="text-[11px] font-semibold text-[#3e4942] uppercase tracking-wider block mb-1">
              {isEnabled ? 'Change 4-Digit PIN' : 'Set New 4-Digit PIN'}
            </label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => {
                setPin(e.target.value.replace(/\D/g, ''));
                setError(null);
              }}
              placeholder="••••"
              className="w-full text-center tracking-[1em] px-3 py-2.5 bg-[#f8f9ff] border border-[#dfe9fc] rounded-xl text-[20px] font-bold text-[#121c2a] focus:outline-none focus:border-[#006948]"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-[#3e4942] uppercase tracking-wider block mb-1">
              Confirm 4-Digit PIN
            </label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={confirmPin}
              onChange={(e) => {
                setConfirmPin(e.target.value.replace(/\D/g, ''));
                setError(null);
              }}
              placeholder="••••"
              className="w-full text-center tracking-[1em] px-3 py-2.5 bg-[#f8f9ff] border border-[#dfe9fc] rounded-xl text-[20px] font-bold text-[#121c2a] focus:outline-none focus:border-[#006948]"
            />
          </div>

          {error && (
            <p className="text-[11px] text-rose-600 font-medium text-center">{error}</p>
          )}

          <div className="pt-2 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-[#dfe9fc] text-[12px] font-semibold text-[#3e4942] hover:bg-[#eff3ff]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || pin.length !== 4 || confirmPin.length !== 4}
              className="flex-1 py-2.5 rounded-xl bg-[#006948] hover:bg-[#00855d] disabled:opacity-50 text-white text-[12px] font-semibold shadow-xs flex items-center justify-center gap-1 cursor-pointer transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">check</span>
              <span>{isSaving ? 'Saving...' : isEnabled ? 'Update PIN' : 'Enable PIN'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
