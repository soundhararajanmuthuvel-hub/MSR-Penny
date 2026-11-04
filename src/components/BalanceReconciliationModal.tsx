import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { formatDateLabel } from '../utils/categoryIcons';

interface BalanceReconciliationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BalanceReconciliationModal: React.FC<BalanceReconciliationModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    accounts,
    sbiBalance,
    iobBalance,
    cashBalance,
    reconciliations,
    saveReconciliation,
  } = useApp();

  const [selectedAccountId, setSelectedAccountId] = useState<string>('acc-sbi');
  const [actualBalanceInput, setActualBalanceInput] = useState<string>('');
  const [reasonInput, setReasonInput] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedAccount = useMemo(() => {
    return accounts.find((a) => a.id === selectedAccountId) || accounts[0];
  }, [accounts, selectedAccountId]);

  const currentComputedBalance = useMemo(() => {
    if (selectedAccountId === 'acc-sbi') return sbiBalance;
    if (selectedAccountId === 'acc-iob') return iobBalance;
    if (selectedAccountId === 'acc-cash') return cashBalance;
    return 0;
  }, [selectedAccountId, sbiBalance, iobBalance, cashBalance]);

  const numericActual = parseFloat(actualBalanceInput);
  const hasValidInput = !isNaN(numericActual) && actualBalanceInput.trim() !== '';
  const difference = hasValidInput ? numericActual - currentComputedBalance : 0;

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasValidInput) {
      setErrorMessage('Please enter the actual physical or netbanking balance.');
      return;
    }

    if (Math.abs(difference) < 0.01) {
      setErrorMessage('Actual balance matches current computed balance. No adjustment needed.');
      return;
    }

    if (!reasonInput.trim()) {
      setErrorMessage('Please provide a reason (e.g. "SMS charges", "Pocket cash count adjustment").');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const today = new Date().toISOString().split('T')[0];
      const res = await saveReconciliation({
        date: today,
        accountId: selectedAccount.id,
        accountName: selectedAccount.name,
        realBalance: numericActual,
        computedBalance: currentComputedBalance,
        adjustmentAmount: difference,
        notes: reasonInput.trim(),
      });

      if (res.success) {
        setStatusMessage(`Saved adjustment of ₹${difference > 0 ? '+' : ''}${difference} for ${selectedAccount.name}!`);
        setActualBalanceInput('');
        setReasonInput('');
        setTimeout(() => {
          setStatusMessage(null);
        }, 3000);
      } else {
        setErrorMessage(res.message || 'Failed to save reconciliation adjustment.');
      }
    } catch {
      setErrorMessage('Error recording reconciliation.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#dfe9fc]/60 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#eff3ff] text-[#006948] flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">tune</span>
            </div>
            <div>
              <h3 className="text-[16px] font-bold text-[#121c2a]">Balance Reconciliation</h3>
              <p className="text-[11px] text-[#3e4942]">Transparent discrepancy adjustment</p>
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

        {/* Invariant Explanation Banner */}
        <div className="bg-[#eff3ff] border border-[#dfe9fc] rounded-xl p-3 flex items-start gap-2.5">
          <span className="material-symbols-outlined text-[#006948] text-[18px] shrink-0 mt-0.5">
            info
          </span>
          <p className="text-[11px] text-[#3e4942] leading-snug">
            <strong>Non-destructive adjustment:</strong> Reconciliations create a distinct adjustment record in Google Sheets (`Reconciliations`) without modifying or deleting any historical transactions.
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-3.5">
          {/* Account Selector */}
          <div>
            <label className="text-[11px] font-semibold text-[#3e4942] uppercase tracking-wider block mb-1">
              Select Account to Reconcile
            </label>
            <div className="grid grid-cols-3 gap-2">
              {accounts.map((acc) => {
                const isSelected = acc.id === selectedAccountId;
                const bal = acc.id === 'acc-sbi' ? sbiBalance : acc.id === 'acc-iob' ? iobBalance : cashBalance;
                return (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => {
                      setSelectedAccountId(acc.id);
                      setActualBalanceInput('');
                      setErrorMessage(null);
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[#006948] bg-[#006948]/5 text-[#006948]'
                        : 'border-[#dfe9fc] bg-[#f8f9ff] text-[#3e4942]'
                    }`}
                  >
                    <span className="text-[11px] font-bold block truncate">{acc.name}</span>
                    <span className="text-[13px] font-bold block tabular-nums mt-0.5">
                      ₹{bal.toLocaleString('en-IN')}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Current vs Actual Comparison Card */}
          <div className="bg-[#f8f9ff] p-3 rounded-xl border border-[#dfe9fc]/60 space-y-2">
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-[#3e4942]">Current Computed Balance:</span>
              <strong className="text-[#121c2a] tabular-nums">
                ₹{currentComputedBalance.toLocaleString('en-IN')}
              </strong>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-[#3e4942] uppercase tracking-wider block mb-1">
                Actual Real Balance (₹)
              </label>
              <input
                type="number"
                step="any"
                value={actualBalanceInput}
                onChange={(e) => {
                  setActualBalanceInput(e.target.value);
                  setErrorMessage(null);
                }}
                placeholder="Enter netbanking or cash balance"
                className="w-full px-3 py-2 bg-white border border-[#dfe9fc] rounded-xl text-[15px] font-bold text-[#121c2a] focus:outline-none focus:border-[#006948] tabular-nums"
              />
            </div>

            {hasValidInput && (
              <div
                className={`p-2 rounded-lg text-[11px] flex items-center justify-between font-semibold ${
                  difference === 0
                    ? 'bg-slate-100 text-slate-700'
                    : difference > 0
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                <span>Adjustment Required:</span>
                <span className="tabular-nums">
                  {difference > 0 ? `+ ₹${difference.toLocaleString('en-IN')}` : `₹${difference.toLocaleString('en-IN')}`}
                </span>
              </div>
            )}
          </div>

          {/* Reason Input */}
          <div>
            <label className="text-[11px] font-semibold text-[#3e4942] uppercase tracking-wider block mb-1">
              Reason / Explanation
            </label>
            <input
              type="text"
              value={reasonInput}
              onChange={(e) => setReasonInput(e.target.value)}
              placeholder="e.g. Bank SMS charge not recorded / ATM change discrepancy"
              className="w-full px-3 py-2 bg-[#f8f9ff] border border-[#dfe9fc] rounded-xl text-[12px] text-[#121c2a] focus:outline-none focus:border-[#006948]"
            />
          </div>

          {errorMessage && (
            <p className="text-[11px] text-rose-600 font-medium">{errorMessage}</p>
          )}

          {statusMessage && (
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] text-emerald-800 flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-emerald-600">check_circle</span>
              <span>{statusMessage}</span>
            </div>
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
              disabled={isSaving || !hasValidInput || Math.abs(difference) < 0.01}
              className="flex-1 py-2.5 rounded-xl bg-[#006948] hover:bg-[#00855d] disabled:opacity-50 text-white text-[12px] font-semibold shadow-xs flex items-center justify-center gap-1 cursor-pointer transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">check</span>
              <span>{isSaving ? 'Saving...' : 'Apply Adjustment'}</span>
            </button>
          </div>
        </form>

        {/* Previous Reconciliations List */}
        {(reconciliations || []).length > 0 && (
          <div className="space-y-2 pt-3 border-t border-[#dfe9fc]/60">
            <span className="text-[11px] font-semibold text-[#3e4942] uppercase tracking-wider block">
              Previous Adjustments ({(reconciliations || []).length})
            </span>
            <div className="divide-y divide-[#dfe9fc]/50 max-h-36 overflow-y-auto">
              {reconciliations.map((rec) => (
                <div key={rec.id} className="py-2 flex items-center justify-between text-[11px]">
                  <div>
                    <span className="font-semibold text-[#121c2a] block">
                      {rec.accountName}: {rec.notes || 'Reconciliation adjustment'}
                    </span>
                    <span className="text-[10px] text-[#3e4942]">
                      {formatDateLabel(rec.date)} • Real: ₹{rec.realBalance?.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <span
                    className={`font-bold tabular-nums ${
                      rec.adjustmentAmount >= 0 ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {rec.adjustmentAmount >= 0 ? `+ ₹${rec.adjustmentAmount}` : `₹${rec.adjustmentAmount}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
