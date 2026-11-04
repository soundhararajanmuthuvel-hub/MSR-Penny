import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Account } from '../types';

interface AccountSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AccountSettingsModal: React.FC<AccountSettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { accounts, saveAccounts, datedBeforeOpeningWarnings } = useApp();

  const [editableAccounts, setEditableAccounts] = useState<Account[]>(() => {
    return accounts.map((a) => ({ ...a }));
  });

  const [isSaving, setIsSaving] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleBalanceChange = (id: string, val: string) => {
    const num = parseInt(val.replace(/[^0-9]/g, ''), 10) || 0;
    setEditableAccounts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, openingBalance: num } : a))
    );
  };

  const handleNameChange = (id: string, name: string) => {
    setEditableAccounts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, name } : a))
    );
  };

  const handleDateChange = (id: string, openingDate: string) => {
    setEditableAccounts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, openingDate } : a))
    );
  };

  const totalStartingWorth = editableAccounts.reduce(
    (sum, a) => sum + (Number(a.openingBalance) || 0),
    0
  );

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    const confirmed = window.confirm(
      'Recalculate balances from these opening balances? Changing an opening balance recalculates all subsequent transactions from records.'
    );
    if (!confirmed) return;

    setIsSaving(true);
    await saveAccounts(editableAccounts);
    setIsSaving(false);
    setSuccessNotice('Account settings & opening balances saved!');
    setTimeout(() => {
      setSuccessNotice(null);
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl border border-[#dfe9fc]/80 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-[#88f8c4]/40 flex items-center justify-center text-[#006948]">
              <span className="material-symbols-outlined text-[20px]">account_balance</span>
            </div>
            <div>
              <h3 className="text-[17px] font-bold text-[#121c2a]">Accounts & Opening Balances</h3>
              <p className="text-[11px] text-[#3e4942]">Fixed 3 accounts: SBI, IOB, Cash</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#f8f9ff] text-[#3e4942] hover:text-[#121c2a] flex items-center justify-center transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {successNotice && (
          <div className="p-3 rounded-xl bg-[#88f8c4]/30 text-[#006948] text-[12px] font-semibold flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">check_circle</span>
            <span>{successNotice}</span>
          </div>
        )}

        {datedBeforeOpeningWarnings > 0 && (
          <div className="p-3 rounded-xl bg-[#fff2db] border border-[#ffdcc0] text-[#894d00] text-[11px] font-medium flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px] shrink-0">info</span>
            <span>
              {datedBeforeOpeningWarnings} transaction(s) dated before opening balance date are safely excluded from current balance.
            </span>
          </div>
        )}

        {/* Total Opening Balance Card */}
        <div className="p-4 rounded-2xl bg-[#eff3ff] border border-[#dfe9fc]/80 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-[#3e4942] uppercase tracking-wider">
              TOTAL STARTING BALANCE
            </span>
            <p className="text-[22px] font-bold text-[#006948] tracking-tight tabular-nums">
              ₹{totalStartingWorth.toLocaleString('en-IN')}
            </p>
          </div>
          <span className="text-[11px] text-[#3e4942] max-w-[130px] text-right">
            Starting point for all account records
          </span>
        </div>

        {/* Accounts List */}
        <form onSubmit={handleSave} className="flex flex-col gap-3">
          {editableAccounts.map((acc) => (
            <div
              key={acc.id}
              className="p-4 rounded-2xl bg-white border border-[#dfe9fc] shadow-2xs flex flex-col gap-2.5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-[#006948]">
                    {acc.type === 'cash' ? 'payments' : 'account_balance'}
                  </span>
                  <input
                    type="text"
                    value={acc.name}
                    onChange={(e) => handleNameChange(acc.id, e.target.value)}
                    className="font-bold text-[14px] text-[#121c2a] bg-transparent border-b border-dashed border-[#dfe9fc] focus:outline-none focus:border-[#006948]"
                  />
                </div>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-[#dfe9fc] text-[#121c2a]">
                  {acc.type}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <span className="text-[10px] text-[#3e4942] font-medium block">
                    OPENING BALANCE
                  </span>
                  <div className="flex items-center gap-1 mt-0.5 p-2 rounded-xl bg-[#f8f9ff] border border-[#dfe9fc]/60">
                    <span className="text-[13px] font-bold text-[#121c2a]">₹</span>
                    <input
                      type="tel"
                      inputMode="numeric"
                      value={acc.openingBalance}
                      onChange={(e) => handleBalanceChange(acc.id, e.target.value)}
                      className="w-full bg-transparent text-[13px] font-bold text-[#121c2a] focus:outline-none tabular-nums"
                    />
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-[#3e4942] font-medium block">
                    STARTING DATE
                  </span>
                  <div className="p-2 rounded-xl bg-[#f8f9ff] border border-[#dfe9fc]/60 mt-0.5">
                    <input
                      type="date"
                      value={acc.openingDate}
                      onChange={(e) => handleDateChange(acc.id, e.target.value)}
                      className="w-full bg-transparent text-[12px] text-[#121c2a] font-medium focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}

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
              disabled={isSaving}
              className="flex-1 py-3 rounded-full bg-[#006948] text-white font-semibold text-[13px] shadow-sm hover:bg-[#00855d] active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Recalculating...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">save</span>
                  <span>Save & Recalculate</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

