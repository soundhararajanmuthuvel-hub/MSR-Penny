import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';

interface PinLockModalProps {
  isLocked?: boolean;
  isOpen?: boolean;
  savedPinHash?: string;
  onUnlock: () => void;
  onResetPin?: () => void;
}

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutes

// Simple hash for PIN comparison
export function hashPin(pin: string): string {
  let hash = 0;
  for (let i = 0; i < pin.length; i++) {
    const char = pin.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return 'pin_' + Math.abs(hash).toString(36);
}

export const PinLockModal: React.FC<PinLockModalProps> = ({
  isLocked,
  isOpen,
  savedPinHash,
  onUnlock,
}) => {
  const { state } = useApp();
  const activeLocked = isLocked ?? isOpen ?? false;
  const targetHash = savedPinHash || state.settings?.pinHash || '';

  const [enteredPin, setEnteredPin] = useState<string>('');
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [shake, setShake] = useState<boolean>(false);
  const [lockoutRemainingSec, setLockoutRemainingSec] = useState<number>(0);

  // Check lockout on mount and activeLocked
  useEffect(() => {
    if (!activeLocked) return;

    setEnteredPin('');
    setErrorNotice(null);

    const checkLockout = () => {
      try {
        const lockoutUntilStr = localStorage.getItem('msr_penny_pin_lockout_until');
        if (lockoutUntilStr) {
          const lockoutUntil = parseInt(lockoutUntilStr, 10);
          const remaining = Math.max(0, Math.ceil((lockoutUntil - Date.now()) / 1000));
          setLockoutRemainingSec(remaining);
          if (remaining > 0) {
            setErrorNotice(`Too many failed attempts. Try again in ${remaining}s.`);
          }
        }
      } catch {}
    };

    checkLockout();
    const interval = setInterval(checkLockout, 1000);
    return () => clearInterval(interval);
  }, [activeLocked]);

  if (!activeLocked) return null;

  const isCurrentlyLockedOut = lockoutRemainingSec > 0;

  const handleKeyPress = (num: string) => {
    if (isCurrentlyLockedOut) return;
    if (enteredPin.length >= 4) return;
    const nextPin = enteredPin + num;
    setEnteredPin(nextPin);
    setErrorNotice(null);

    if (nextPin.length === 4) {
      // Validate PIN
      const inputHash = hashPin(nextPin);
      if (inputHash === targetHash) {
        // Clear failed attempts upon success
        try {
          localStorage.removeItem('msr_penny_pin_failed_attempts');
          localStorage.removeItem('msr_penny_pin_lockout_until');
        } catch {}
        setEnteredPin('');
        setErrorNotice(null);
        onUnlock();
      } else {
        setShake(true);
        let failedCount = 1;
        try {
          const stored = parseInt(localStorage.getItem('msr_penny_pin_failed_attempts') || '0', 10);
          failedCount = stored + 1;
          localStorage.setItem('msr_penny_pin_failed_attempts', String(failedCount));

          if (failedCount >= MAX_FAILED_ATTEMPTS) {
            const lockoutUntil = Date.now() + LOCKOUT_DURATION_MS;
            localStorage.setItem('msr_penny_pin_lockout_until', String(lockoutUntil));
            setLockoutRemainingSec(Math.ceil(LOCKOUT_DURATION_MS / 1000));
            setErrorNotice(`Maximum attempts reached. Locked for 5 minutes.`);
          } else {
            const left = MAX_FAILED_ATTEMPTS - failedCount;
            setErrorNotice(`Incorrect PIN. ${left} attempt(s) remaining.`);
          }
        } catch {
          setErrorNotice('Incorrect PIN. Please try again.');
        }

        setTimeout(() => {
          setEnteredPin('');
          setShake(false);
        }, 600);
      }
    }
  };

  const handleDelete = () => {
    if (isCurrentlyLockedOut) return;
    setEnteredPin((prev) => prev.slice(0, -1));
    setErrorNotice(null);
  };

  const handleClear = () => {
    if (isCurrentlyLockedOut) return;
    setEnteredPin('');
    setErrorNotice(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#121c2a] flex flex-col items-center justify-between p-6 select-none animate-fade-in text-white">
      {/* Brand Header */}
      <div className="flex flex-col items-center gap-2 pt-12">
        <div
          className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg border transition-all ${
            isCurrentlyLockedOut
              ? 'bg-rose-900 border-rose-500/40 text-rose-300'
              : 'bg-[#006948] border-[#88f8c4]/30 text-white'
          }`}
        >
          <span className="material-symbols-outlined text-[32px]">
            {isCurrentlyLockedOut ? 'lock_clock' : 'lock'}
          </span>
        </div>
        <h1 className="text-[22px] font-bold tracking-tight text-white mt-2">MSR Penny</h1>
        <p className="text-[13px] text-[#bdcac0] font-medium">
          {isCurrentlyLockedOut ? 'Device Temporarily Locked' : 'Owner Passcode Required'}
        </p>
      </div>

      {/* 4 Dot Indicators */}
      <div className="flex flex-col items-center gap-3 my-4">
        <div className={`flex items-center gap-4 ${shake ? 'animate-shake' : ''}`}>
          {[0, 1, 2, 3].map((idx) => {
            const isFilled = idx < enteredPin.length;
            return (
              <div
                key={idx}
                className={`w-4 h-4 rounded-full transition-all duration-200 border-2 ${
                  isFilled
                    ? 'bg-[#88f8c4] border-[#88f8c4] scale-110 shadow-[0_0_12px_rgba(136,248,196,0.6)]'
                    : 'border-[#3e4942] bg-transparent'
                }`}
              />
            );
          })}
        </div>

        {errorNotice ? (
          <p className="text-[12px] text-rose-400 font-semibold text-center animate-shake px-4">
            {errorNotice}
          </p>
        ) : (
          <p className="text-[11px] text-[#86948a]">Enter your 4-digit PIN</p>
        )}
      </div>

      {/* Numeric Keypad (Touch friendly, 3 columns) */}
      <div className="w-full max-w-xs grid grid-cols-3 gap-4 pb-8">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
          <button
            key={digit}
            type="button"
            disabled={isCurrentlyLockedOut}
            onClick={() => handleKeyPress(digit)}
            className="h-16 rounded-2xl bg-[#1e293b]/70 hover:bg-[#334155] active:scale-95 disabled:opacity-30 disabled:pointer-events-none text-[24px] font-bold text-white flex items-center justify-center transition-all cursor-pointer shadow-xs border border-white/5"
          >
            {digit}
          </button>
        ))}

        <button
          type="button"
          disabled={isCurrentlyLockedOut}
          onClick={handleClear}
          className="h-16 rounded-2xl bg-transparent hover:bg-white/5 active:scale-95 disabled:opacity-30 disabled:pointer-events-none text-[12px] font-semibold text-[#bdcac0] flex items-center justify-center transition-all cursor-pointer"
        >
          Clear
        </button>

        <button
          type="button"
          disabled={isCurrentlyLockedOut}
          onClick={() => handleKeyPress('0')}
          className="h-16 rounded-2xl bg-[#1e293b]/70 hover:bg-[#334155] active:scale-95 disabled:opacity-30 disabled:pointer-events-none text-[24px] font-bold text-white flex items-center justify-center transition-all cursor-pointer shadow-xs border border-white/5"
        >
          0
        </button>

        <button
          type="button"
          disabled={isCurrentlyLockedOut}
          onClick={handleDelete}
          className="h-16 rounded-2xl bg-transparent hover:bg-white/5 active:scale-95 disabled:opacity-30 disabled:pointer-events-none text-white flex items-center justify-center transition-all cursor-pointer"
        >
          <span className="material-symbols-outlined text-[24px]">backspace</span>
        </button>
      </div>
    </div>
  );
};
