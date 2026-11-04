import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';

interface PinLockModalProps {
  isLocked?: boolean;
  isOpen?: boolean;
  savedPinHash?: string;
  onUnlock: () => void;
  onResetPin?: () => void;
}

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

  useEffect(() => {
    if (activeLocked) {
      setEnteredPin('');
      setErrorNotice(null);
    }
  }, [activeLocked]);

  if (!activeLocked) return null;

  const handleKeyPress = (num: string) => {
    if (enteredPin.length >= 4) return;
    const nextPin = enteredPin + num;
    setEnteredPin(nextPin);
    setErrorNotice(null);

    if (nextPin.length === 4) {
      // Validate PIN
      const inputHash = hashPin(nextPin);
      if (inputHash === targetHash) {
        onUnlock();
      } else {
        setShake(true);
        setErrorNotice('Incorrect PIN. Please try again.');
        setTimeout(() => {
          setEnteredPin('');
          setShake(false);
        }, 600);
      }
    }
  };

  const handleDelete = () => {
    setEnteredPin((prev) => prev.slice(0, -1));
    setErrorNotice(null);
  };

  const handleClear = () => {
    setEnteredPin('');
    setErrorNotice(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#121c2a] flex flex-col items-center justify-between p-6 select-none animate-fade-in text-white">
      {/* Brand Header */}
      <div className="flex flex-col items-center gap-2 pt-12">
        <div className="w-16 h-16 rounded-2xl bg-[#006948] flex items-center justify-center shadow-lg border border-[#88f8c4]/30">
          <span className="material-symbols-outlined text-[32px] text-white">lock</span>
        </div>
        <h1 className="text-[22px] font-bold tracking-tight text-white mt-2">MSR Penny</h1>
        <p className="text-[13px] text-[#bdcac0] font-medium">Owner Passcode Required</p>
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
          <p className="text-[12px] text-rose-400 font-semibold animate-shake">
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
            onClick={() => handleKeyPress(digit)}
            className="h-16 rounded-2xl bg-[#1e293b]/70 hover:bg-[#334155] active:scale-95 text-[24px] font-bold text-white flex items-center justify-center transition-all cursor-pointer shadow-xs border border-white/5"
          >
            {digit}
          </button>
        ))}

        <button
          type="button"
          onClick={handleClear}
          className="h-16 rounded-2xl bg-transparent hover:bg-white/5 active:scale-95 text-[12px] font-semibold text-[#bdcac0] flex items-center justify-center transition-all cursor-pointer"
        >
          Clear
        </button>

        <button
          type="button"
          onClick={() => handleKeyPress('0')}
          className="h-16 rounded-2xl bg-[#1e293b]/70 hover:bg-[#334155] active:scale-95 text-[24px] font-bold text-white flex items-center justify-center transition-all cursor-pointer shadow-xs border border-white/5"
        >
          0
        </button>

        <button
          type="button"
          onClick={handleDelete}
          className="h-16 rounded-2xl bg-transparent hover:bg-white/5 active:scale-95 text-white flex items-center justify-center transition-all cursor-pointer"
        >
          <span className="material-symbols-outlined text-[24px]">backspace</span>
        </button>
      </div>
    </div>
  );
};
