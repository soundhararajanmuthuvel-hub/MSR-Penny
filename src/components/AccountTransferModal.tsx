import React, { useState } from 'react';
import { useApp } from '../context/AppContext';

interface AccountTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AccountTransferModal: React.FC<AccountTransferModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { accounts, sbiBalance, iobBalance, cashBalance, saveTransfer } = useApp();

  const [fromAccountId, setFromAccountId] = useState<string>('acc-sbi');
  const [toAccountId, setToAccountId] = useState<string>('acc-cash');
  const [amountStr, setAmountStr] = useState<string>('500');
  const [date, setDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState<string>('ATM Withdrawal');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const getAccountBalance = (accId: string): number => {
    if (accId === 'acc-sbi') return sbiBalance;
    if (accId === 'acc-iob') return iobBalance;
    if (accId === 'acc-cash') return cashBalance;
    return 0;
  };

  const amount = parseInt(amountStr, 10) || 0;
  const fromBalance = getAccountBalance(fromAccountId);
  const isOverdraw = fromBalance - amount < 0;

  const handleSwap = () => {
    const temp = fromAccountId;
    setFromAccountId(toAccountId);
    setToAccountId(temp);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) {
      setError('Please enter an amount greater than zero.');
      return;
    }
    if (fromAccountId === toAccountId) {
      setError('Source and destination accounts must be different.');
      return;
    }
    if (isOverdraw) {
      const fromAcc = accounts.find((a) => a.id === fromAccountId);
      const proceed = window.confirm(
        `Warning: Transferring ₹${amount.toLocaleString('en-IN')} exceeds your current ${fromAcc?.name || 'account'} balance of ₹${fromBalance.toLocaleString('en-IN')}. Proceed anyway?`
      );
      if (!proceed) return;
    }

    setIsSubmitting(true);
    setError(null);

    const fromAcc = accounts.find((a) => a.id === fromAccountId);
    const toAcc = accounts.find((a) => a.id === toAccountId);

    const defaultNotes = notes.trim() || `Transfer from ${fromAcc?.name || 'Account'} to ${toAcc?.name || 'Account'}`;

    const res = await saveTransfer({
      date,
      fromAccountId,
      toAccountId,
      amount,
      notes: defaultNotes,
    });

    setIsSubmitting(false);

    if (!res.success) {
      setError(res.error || 'Failed to save transfer.');
      return;
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-[#dfe9fc]/80 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-[#e6eeff] flex items-center justify-center text-[#006948]">
              <span className="material-symbols-outlined text-[20px]">swap_horiz</span>
            </div>
            <div>
              <h3 className="text-[17px] font-bold text-[#121c2a]">Transfer Money</h3>
              <p className="text-[11px] text-[#3e4942]">Between your own accounts</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#f8f9ff] text-[#3e4942] hover:text-[#121c2a] flex items-center justify-center transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-[#ffdad6]/80 text-[#ba1a1a] text-[12px] font-medium flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px] shrink-0">error</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          {/* Amount input */}
          <div className="flex flex-col items-center justify-center py-2 bg-[#f8f9ff] rounded-2xl border border-[#dfe9fc]/60">
            <span className="text-[11px] font-semibold text-[#3e4942] uppercase tracking-wider mb-1">
              TRANSFER AMOUNT
            </span>
            <div className="flex items-center justify-center space-x-1">
              <span className="text-[32px] text-[#121c2a] font-bold">₹</span>
              <input
                type="tel"
                inputMode="numeric"
                value={amountStr}
                onChange={(e) => {
                  setAmountStr(e.target.value.replace(/[^0-9]/g, ''));
                  setError(null);
                }}
                placeholder="0"
                autoFocus
                className="bg-transparent text-[32px] text-[#121c2a] font-bold text-center w-36 focus:outline-none tracking-tight caret-[#006948] tabular-nums"
              />
            </div>
          </div>

          {/* From -> To selection with swap button */}
          <div className="relative flex flex-col gap-2">
            {/* From Account */}
            <div className="p-3 rounded-xl bg-white border border-[#dfe9fc]/80 shadow-2xs">
              <span className="text-[10px] text-[#3e4942] font-semibold uppercase tracking-wider">
                FROM (SOURCE)
              </span>
              <select
                value={fromAccountId}
                onChange={(e) => {
                  setFromAccountId(e.target.value);
                  setError(null);
                }}
                className="w-full mt-1 bg-transparent text-[14px] font-semibold text-[#121c2a] focus:outline-none"
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} (Bal: ₹{getAccountBalance(acc.id).toLocaleString('en-IN')})
                  </option>
                ))}
              </select>
            </div>

            {/* Swap Button */}
            <div className="flex justify-center -my-3 z-10">
              <button
                type="button"
                onClick={handleSwap}
                className="w-8 h-8 rounded-full bg-[#006948] text-white flex items-center justify-center shadow-md active:scale-90 hover:bg-[#00855d] transition-all cursor-pointer"
                title="Swap accounts"
              >
                <span className="material-symbols-outlined text-[16px]">swap_vert</span>
              </button>
            </div>

            {/* To Account */}
            <div className="p-3 rounded-xl bg-white border border-[#dfe9fc]/80 shadow-2xs">
              <span className="text-[10px] text-[#3e4942] font-semibold uppercase tracking-wider">
                TO (DESTINATION)
              </span>
              <select
                value={toAccountId}
                onChange={(e) => {
                  setToAccountId(e.target.value);
                  setError(null);
                }}
                className="w-full mt-1 bg-transparent text-[14px] font-semibold text-[#121c2a] focus:outline-none"
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} (Bal: ₹{getAccountBalance(acc.id).toLocaleString('en-IN')})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Overdraw Warning */}
          {isOverdraw && (
            <div className="p-2.5 rounded-xl bg-[#fff2db] border border-[#ffdcc0] text-[#894d00] text-[11px] font-medium flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] shrink-0">warning</span>
              <span>
                Source balance is ₹{fromBalance.toLocaleString('en-IN')}. Transfer will overdraft by ₹{(amount - fromBalance).toLocaleString('en-IN')}.
              </span>
            </div>
          )}

          {/* Date & Notes */}
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2.5 rounded-xl bg-[#f8f9ff] border border-[#dfe9fc]/60">
              <span className="text-[10px] text-[#3e4942] block font-medium">DATE</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-transparent text-[12px] text-[#121c2a] font-medium focus:outline-none mt-0.5"
              />
            </div>
            <div className="p-2.5 rounded-xl bg-[#f8f9ff] border border-[#dfe9fc]/60">
              <span className="text-[10px] text-[#3e4942] block font-medium">NOTE</span>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. ATM cash"
                className="w-full bg-transparent text-[12px] text-[#121c2a] focus:outline-none mt-0.5"
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-full bg-[#f8f9ff] text-[#3e4942] font-semibold text-[13px] hover:bg-[#dfe9fc] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3 rounded-full bg-[#006948] text-white font-semibold text-[13px] shadow-sm hover:bg-[#00855d] active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Transferring...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">check</span>
                  <span>Confirm Transfer</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

