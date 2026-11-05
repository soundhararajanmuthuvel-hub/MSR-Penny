import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Account, Transaction } from '../types';
import {
  calculateFinancialOverview,
  validateOpeningBalanceInput,
  computeMatchRealOpening,
  detectPotentialAtmWithdrawal,
  getPreOpeningTransactions,
} from '../utils/balanceCalculator';

interface AccountSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenReconcileModal?: () => void;
  onOpenTransferModal?: () => void;
}

type ActiveTab = 'edit' | 'helper' | 'backups';

export const AccountSettingsModal: React.FC<AccountSettingsModalProps> = ({
  isOpen,
  onClose,
  onOpenReconcileModal,
  onOpenTransferModal,
}) => {
  const {
    accounts,
    sbiBalance,
    iobBalance,
    cashBalance,
    totalAvailableMoney,
    overallWorth,
    totalReceivable,
    state,
    saveAccounts,
    restoreAccountsBackup,
    fetchAccountsBackups,
  } = useApp();

  const [activeTab, setActiveTab] = useState<ActiveTab>('edit');

  // Editable Account state
  const [editableAccounts, setEditableAccounts] = useState<Account[]>(() => {
    return accounts.map((a) => ({ ...a }));
  });

  // String input buffers for decimal precision and user typing
  const [balanceInputs, setBalanceInputs] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    accounts.forEach((a) => {
      map[a.id] = String(a.openingBalance ?? 0);
    });
    return map;
  });

  // Shared common date toggle
  const [useCommonDate, setUseCommonDate] = useState(false);
  const [commonDate, setCommonDate] = useState('2026-10-01');

  // Extra confirmation for pre-opening transactions
  const [confirmPreOpeningAcknowledged, setConfirmPreOpeningAcknowledged] = useState(false);

  // Match Real Balance Helper inputs
  const [realSbiInput, setRealSbiInput] = useState<string>('');
  const [realIobInput, setRealIobInput] = useState<string>('');
  const [realCashInput, setRealCashInput] = useState<string>('');

  // Status & loading states
  const [isSaving, setIsSaving] = useState(false);
  const [statusNotice, setStatusNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Backups state
  const [availableBackups, setAvailableBackups] = useState<string[]>([]);
  const [isLoadingBackups, setIsLoadingBackups] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  // Sync internal state whenever accounts update or modal opens
  useEffect(() => {
    if (isOpen) {
      setEditableAccounts(accounts.map((a) => ({ ...a })));
      const map: Record<string, string> = {};
      accounts.forEach((a) => {
        map[a.id] = String(a.openingBalance ?? 0);
      });
      setBalanceInputs(map);
      setStatusNotice(null);
      setConfirmPreOpeningAcknowledged(false);

      if (accounts[0]?.openingDate) {
        setCommonDate(accounts[0].openingDate);
      }
    }
  }, [isOpen, accounts]);

  // Load backups when switching to backups tab
  useEffect(() => {
    if (activeTab === 'backups' && isOpen) {
      setIsLoadingBackups(true);
      fetchAccountsBackups()
        .then((b) => setAvailableBackups(b))
        .finally(() => setIsLoadingBackups(false));
    }
  }, [activeTab, isOpen, fetchAccountsBackups]);

  // Derived Preview calculation
  const previewOverview = useMemo(() => {
    const tempAccounts = editableAccounts.map((a) => {
      const parsed = validateOpeningBalanceInput(balanceInputs[a.id] ?? '0');
      const opDate = useCommonDate ? commonDate : a.openingDate;
      return {
        ...a,
        openingBalance: parsed.isValid ? parsed.amount : a.openingBalance,
        openingDate: opDate,
      };
    });

    return calculateFinancialOverview({
      accounts: tempAccounts,
      transactions: state.transactions,
      transfers: state.transfers,
      familyContacts: state.familyContacts,
      freelanceJobs: state.freelanceJobs,
      settledArchive: state.settledArchive,
      reconciliations: state.reconciliations,
    });
  }, [editableAccounts, balanceInputs, useCommonDate, commonDate, state]);

  // Pre-opening transactions detection
  const preOpeningImpact = useMemo(() => {
    const datesMap: Record<string, string> = {};
    editableAccounts.forEach((a) => {
      datesMap[a.id] = useCommonDate ? commonDate : a.openingDate;
    });
    return getPreOpeningTransactions(state.transactions || [], datesMap);
  }, [editableAccounts, useCommonDate, commonDate, state.transactions]);

  // Negative balance warnings
  const negativeBalanceAccounts = useMemo(() => {
    const list: { name: string; balance: number }[] = [];
    if (previewOverview.sbiBalance < 0) list.push({ name: 'SBI (Main)', balance: previewOverview.sbiBalance });
    if (previewOverview.iobBalance < 0) list.push({ name: 'IOB (Second)', balance: previewOverview.iobBalance });
    if (previewOverview.cashBalance < 0) list.push({ name: 'Cash', balance: previewOverview.cashBalance });
    return list;
  }, [previewOverview]);

  // Real Balance Helper calculations
  const helperDiffs = useMemo(() => {
    const numSbi = parseFloat(realSbiInput);
    const numIob = parseFloat(realIobInput);
    const numCash = parseFloat(realCashInput);

    const hasSbi = !isNaN(numSbi) && realSbiInput.trim() !== '';
    const hasIob = !isNaN(numIob) && realIobInput.trim() !== '';
    const hasCash = !isNaN(numCash) && realCashInput.trim() !== '';

    const sbiDiff = hasSbi ? Math.round((numSbi - sbiBalance) * 100) / 100 : 0;
    const iobDiff = hasIob ? Math.round((numIob - iobBalance) * 100) / 100 : 0;
    const cashDiff = hasCash ? Math.round((numCash - cashBalance) * 100) / 100 : 0;

    const sbiAccount = accounts.find((a) => a.id === 'acc-sbi');
    const iobAccount = accounts.find((a) => a.id === 'acc-iob');
    const cashAccount = accounts.find((a) => a.id === 'acc-cash');

    const sbiMatch = computeMatchRealOpening(sbiAccount?.openingBalance || 0, sbiBalance, hasSbi ? numSbi : sbiBalance);
    const iobMatch = computeMatchRealOpening(iobAccount?.openingBalance || 0, iobBalance, hasIob ? numIob : iobBalance);
    const cashMatch = computeMatchRealOpening(cashAccount?.openingBalance || 0, cashBalance, hasCash ? numCash : cashBalance);

    const atmCheck = detectPotentialAtmWithdrawal({
      sbiBalance,
      cashBalance,
      sbiDifference: hasSbi ? sbiDiff : 0,
      cashDifference: hasCash ? cashDiff : 0,
      realSbi: hasSbi ? numSbi : undefined,
      realCash: hasCash ? numCash : undefined,
    });

    return {
      hasAnyInput: hasSbi || hasIob || hasCash,
      hasSbi,
      hasIob,
      hasCash,
      numSbi: hasSbi ? numSbi : sbiBalance,
      numIob: hasIob ? numIob : iobBalance,
      numCash: hasCash ? numCash : cashBalance,
      sbiDiff,
      iobDiff,
      cashDiff,
      sbiMatch,
      iobMatch,
      cashMatch,
      atmCheck,
    };
  }, [realSbiInput, realIobInput, realCashInput, accounts, sbiBalance, iobBalance, cashBalance]);

  if (!isOpen) return null;

  // Validation check before save
  const validationErrors = Object.entries(balanceInputs).map(([accId, val]) => {
    const res = validateOpeningBalanceInput(val);
    if (!res.isValid) {
      const acc = accounts.find((a) => a.id === accId);
      return `${acc?.name || accId}: ${res.error}`;
    }
    return null;
  }).filter(Boolean) as string[];

  const hasValidationErrors = validationErrors.length > 0;
  const requiresPreOpeningConfirm = preOpeningImpact.length > 0 && !confirmPreOpeningAcknowledged;

  const handleBalanceInputChange = (id: string, text: string) => {
    setBalanceInputs((prev) => ({ ...prev, [id]: text }));
  };

  const handleDateChange = (id: string, dateStr: string) => {
    setEditableAccounts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, openingDate: dateStr } : a))
    );
  };

  const handleApplyHelperAdjustments = () => {
    const newInputs = { ...balanceInputs };
    if (helperDiffs.hasSbi) newInputs['acc-sbi'] = String(helperDiffs.sbiMatch.suggestedOpening);
    if (helperDiffs.hasIob) newInputs['acc-iob'] = String(helperDiffs.iobMatch.suggestedOpening);
    if (helperDiffs.hasCash) newInputs['acc-cash'] = String(helperDiffs.cashMatch.suggestedOpening);

    setBalanceInputs(newInputs);
    setActiveTab('edit');
    setStatusNotice({
      type: 'success',
      message: 'Suggested opening balances applied to Preview below. Review and click Save.',
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (hasValidationErrors) {
      setStatusNotice({ type: 'error', message: validationErrors[0] });
      return;
    }

    if (requiresPreOpeningConfirm) {
      setStatusNotice({
        type: 'error',
        message: 'Please acknowledge that pre-opening transactions will stop counting before saving.',
      });
      return;
    }

    const confirmText =
      'This changes your starting balances and every balance calculated from them. Your transactions are not changed. Proceed?';
    if (!window.confirm(confirmText)) return;

    setIsSaving(true);
    setStatusNotice(null);

    const sanitizedAccounts: Account[] = editableAccounts.map((a) => {
      const parsed = validateOpeningBalanceInput(balanceInputs[a.id]);
      const opDate = useCommonDate ? commonDate : a.openingDate;
      return {
        ...a,
        openingBalance: parsed.amount,
        openingDate: opDate,
      };
    });

    const result = await saveAccounts(sanitizedAccounts);
    setIsSaving(false);

    if (result.success) {
      setStatusNotice({
        type: 'success',
        message: `Saved & verified with Google Sheets! ${result.backupName ? `(Backup: ${result.backupName})` : ''}`,
      });
      setTimeout(() => {
        onClose();
      }, 1500);
    } else {
      setStatusNotice({
        type: 'error',
        message: result.error || 'Failed to save to Google Sheets.',
      });
    }
  };

  const handleRestore = async (backupName: string) => {
    if (!window.confirm(`Restore opening balances from ${backupName}? This will safely update the Accounts tab.`)) {
      return;
    }

    setIsRestoring(true);
    setStatusNotice(null);

    const result = await restoreAccountsBackup(backupName);
    setIsRestoring(false);

    if (result.success) {
      setStatusNotice({
        type: 'success',
        message: `Restored successfully from ${backupName}!`,
      });
      setTimeout(() => {
        onClose();
      }, 1500);
    } else {
      setStatusNotice({
        type: 'error',
        message: result.error || 'Failed to restore backup.',
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white w-full max-w-lg rounded-3xl p-5 sm:p-6 shadow-2xl border border-[#dfe9fc]/80 flex flex-col gap-4 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-1 border-b border-[#dfe9fc]/60">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#88f8c4]/40 flex items-center justify-center text-[#006948] shrink-0">
              <span className="material-symbols-outlined text-[22px]">account_balance</span>
            </div>
            <div>
              <h3 className="text-[17px] font-bold text-[#121c2a]">Accounts & Opening Balances</h3>
              <p className="text-[11px] text-[#3e4942]">Google Sheets is the persistent source of truth</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full bg-[#f8f9ff] text-[#3e4942] hover:text-[#121c2a] flex items-center justify-center transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex p-1 bg-[#f8f9ff] rounded-2xl border border-[#dfe9fc]/80 text-[12px] font-semibold text-[#3e4942]">
          <button
            type="button"
            onClick={() => setActiveTab('edit')}
            className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'edit'
                ? 'bg-white text-[#006948] shadow-xs font-bold'
                : 'hover:text-[#121c2a]'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">tune</span>
            <span>Edit Opening</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('helper')}
            className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'helper'
                ? 'bg-white text-[#006948] shadow-xs font-bold'
                : 'hover:text-[#121c2a]'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">sync_alt</span>
            <span>Match Real Helper</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('backups')}
            className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'backups'
                ? 'bg-white text-[#006948] shadow-xs font-bold'
                : 'hover:text-[#121c2a]'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">history</span>
            <span>Backups</span>
          </button>
        </div>

        {/* Global Alert / Notice */}
        {statusNotice && (
          <div
            className={`p-3 rounded-2xl text-[12px] font-semibold flex items-start gap-2.5 ${
              statusNotice.type === 'success'
                ? 'bg-[#88f8c4]/30 text-[#006948] border border-[#88f8c4]'
                : 'bg-[#ffebee] text-[#b71c1c] border border-[#ffcdd2]'
            }`}
          >
            <span className="material-symbols-outlined text-[18px] shrink-0">
              {statusNotice.type === 'success' ? 'check_circle' : 'error'}
            </span>
            <span>{statusNotice.message}</span>
          </div>
        )}

        {/* TAB 1: EDIT OPENING BALANCES */}
        {activeTab === 'edit' && (
          <form onSubmit={handleSave} className="flex flex-col gap-4">
            {/* Common Date Option */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-[#eff3ff]/70 border border-[#dfe9fc]">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="commonDateToggle"
                  checked={useCommonDate}
                  onChange={(e) => setUseCommonDate(e.target.checked)}
                  className="rounded text-[#006948] focus:ring-[#006948] h-4 w-4"
                />
                <label htmlFor="commonDateToggle" className="text-[12px] font-semibold text-[#121c2a] cursor-pointer">
                  Use one shared Opening Date for all accounts
                </label>
              </div>
              {useCommonDate && (
                <input
                  type="date"
                  value={commonDate}
                  onChange={(e) => setCommonDate(e.target.value)}
                  className="text-[12px] font-bold text-[#006948] bg-white px-2.5 py-1 rounded-xl border border-[#dfe9fc] focus:outline-none"
                />
              )}
            </div>

            {/* Account Input Cards */}
            <div className="flex flex-col gap-3">
              {editableAccounts.map((acc) => {
                const rawVal = balanceInputs[acc.id] ?? '0';
                const valValidation = validateOpeningBalanceInput(rawVal);
                const currentComputed =
                  acc.id === 'acc-sbi' ? sbiBalance : acc.id === 'acc-iob' ? iobBalance : cashBalance;

                return (
                  <div
                    key={acc.id}
                    className="p-3.5 rounded-2xl bg-white border border-[#dfe9fc] shadow-2xs flex flex-col gap-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[19px] text-[#006948]">
                          {acc.type === 'cash' ? 'payments' : 'account_balance'}
                        </span>
                        <span className="font-bold text-[14px] text-[#121c2a]">{acc.name}</span>
                      </div>
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-[#eff3ff] text-[#006948] border border-[#dfe9fc]">
                        Current: ₹{currentComputed.toLocaleString('en-IN')}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-0.5">
                      <div>
                        <span className="text-[10px] text-[#3e4942] font-semibold uppercase tracking-wider block">
                          OPENING BALANCE
                        </span>
                        <div
                          className={`flex items-center gap-1 mt-1 p-2 rounded-xl bg-[#f8f9ff] border ${
                            valValidation.isValid ? 'border-[#dfe9fc]' : 'border-red-400 bg-red-50/40'
                          }`}
                        >
                          <span className="text-[13px] font-bold text-[#121c2a]">₹</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={rawVal}
                            onChange={(e) => handleBalanceInputChange(acc.id, e.target.value)}
                            placeholder="0"
                            className="w-full bg-transparent text-[13px] font-bold text-[#121c2a] focus:outline-none tabular-nums"
                          />
                        </div>
                        {!valValidation.isValid && (
                          <span className="text-[10px] text-red-600 font-medium block mt-0.5">
                            {valValidation.error}
                          </span>
                        )}
                      </div>

                      <div>
                        <span className="text-[10px] text-[#3e4942] font-semibold uppercase tracking-wider block">
                          OPENING DATE
                        </span>
                        <div className="mt-1 p-2 rounded-xl bg-[#f8f9ff] border border-[#dfe9fc]">
                          <input
                            type="date"
                            disabled={useCommonDate}
                            value={useCommonDate ? commonDate : acc.openingDate}
                            onChange={(e) => handleDateChange(acc.id, e.target.value)}
                            className="w-full bg-transparent text-[12px] text-[#121c2a] font-medium focus:outline-none disabled:opacity-60"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* PREVIEW CARD */}
            <div className="p-4 rounded-2xl bg-[#eff3ff] border border-[#dfe9fc] flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-[#dfe9fc] pb-2">
                <span className="text-[11px] font-bold text-[#006948] uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">visibility</span>
                  <span>Impact Preview (Before → After)</span>
                </span>
                <span className="text-[10px] text-[#3e4942]">Calculated from records</span>
              </div>

              {/* Account by Account Comparison Table */}
              <div className="space-y-1.5 text-[12px]">
                {editableAccounts.map((acc) => {
                  const oldOpen = acc.openingBalance || 0;
                  const newOpen = validateOpeningBalanceInput(balanceInputs[acc.id] ?? '0').amount;
                  const oldComp =
                    acc.id === 'acc-sbi' ? sbiBalance : acc.id === 'acc-iob' ? iobBalance : cashBalance;
                  const newComp =
                    acc.id === 'acc-sbi'
                      ? previewOverview.sbiBalance
                      : acc.id === 'acc-iob'
                      ? previewOverview.iobBalance
                      : previewOverview.cashBalance;

                  return (
                    <div
                      key={acc.id}
                      className="flex items-center justify-between p-2 rounded-xl bg-white border border-[#dfe9fc]/60 text-[11px]"
                    >
                      <span className="font-semibold text-[#121c2a]">{acc.name}</span>
                      <div className="flex items-center gap-3 tabular-nums">
                        <span className="text-[#3e4942]">
                          Opening: ₹{oldOpen} → <strong className="text-[#121c2a]">₹{newOpen}</strong>
                        </span>
                        <span className="text-[#006948] font-bold">
                          Balance: ₹{oldComp} →{' '}
                          <strong className={newComp < 0 ? 'text-red-600' : 'text-[#006948]'}>
                            ₹{newComp}
                          </strong>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Total Summary */}
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#dfe9fc]">
                <div className="p-2.5 rounded-xl bg-white/80 border border-[#dfe9fc]/60">
                  <span className="text-[10px] text-[#3e4942] uppercase font-bold block">TOTAL AVAILABLE</span>
                  <p className="text-[15px] font-bold text-[#006948] tabular-nums">
                    ₹{totalAvailableMoney.toLocaleString('en-IN')} → ₹{previewOverview.totalAvailableMoney.toLocaleString('en-IN')}
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-white/80 border border-[#dfe9fc]/60">
                  <span className="text-[10px] text-[#3e4942] uppercase font-bold block">OVERALL WORTH</span>
                  <p className="text-[15px] font-bold text-[#006948] tabular-nums">
                    ₹{overallWorth.toLocaleString('en-IN')} → ₹{previewOverview.overallWorth.toLocaleString('en-IN')}
                  </p>
                </div>
              </div>
            </div>

            {/* PRE-OPENING WARNINGS (IF ANY) */}
            {preOpeningImpact.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-[#fff2db] border border-[#ffdcc0] flex flex-col gap-2">
                <div className="flex items-start gap-2 text-[#894d00]">
                  <span className="material-symbols-outlined text-[18px] shrink-0">warning</span>
                  <div>
                    <h5 className="text-[12px] font-bold">
                      {preOpeningImpact.length} transaction(s) dated before the new opening date
                    </h5>
                    <p className="text-[11px] leading-relaxed mt-0.5">
                      These records fall strictly before the chosen opening date and will stop counting towards current balances.
                    </p>
                  </div>
                </div>

                <div className="max-h-24 overflow-y-auto bg-white/70 p-2 rounded-xl text-[10px] text-[#3e4942] space-y-1">
                  {preOpeningImpact.slice(0, 4).map((tx) => (
                    <div key={tx.id} className="flex justify-between">
                      <span>{tx.date} — {tx.title}</span>
                      <strong className="text-[#894d00]">₹{tx.amount}</strong>
                    </div>
                  ))}
                  {preOpeningImpact.length > 4 && (
                    <span className="text-right block italic text-[9px]">
                      + {preOpeningImpact.length - 4} more transactions...
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="ackPreOpening"
                    checked={confirmPreOpeningAcknowledged}
                    onChange={(e) => setConfirmPreOpeningAcknowledged(e.target.checked)}
                    className="rounded text-[#006948] focus:ring-[#006948] h-4 w-4"
                  />
                  <label htmlFor="ackPreOpening" className="text-[11px] font-semibold text-[#894d00] cursor-pointer">
                    I confirm that these historical transactions should be excluded from current balance.
                  </label>
                </div>
              </div>
            )}

            {/* NEGATIVE BALANCE WARNING */}
            {negativeBalanceAccounts.length > 0 && (
              <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-red-700 flex items-start gap-2 text-[11px]">
                <span className="material-symbols-outlined text-[18px] shrink-0">report_problem</span>
                <div>
                  <span className="font-bold">Notice:</span> The following accounts will remain in deficit:
                  <ul className="list-disc list-inside mt-0.5 font-semibold">
                    {negativeBalanceAccounts.map((a) => (
                      <li key={a.name}>{a.name}: ₹{a.balance.toLocaleString('en-IN')}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Confirmation Statement */}
            <p className="text-[11px] text-[#3e4942] leading-snug px-1 text-center">
              This changes your starting balances and every balance calculated from them. Your transactions and family records are never changed.
            </p>

            {/* Action Buttons */}
            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 rounded-full bg-[#f8f9ff] text-[#3e4942] font-semibold text-[13px] hover:bg-[#dfe9fc] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving || hasValidationErrors || requiresPreOpeningConfirm}
                className="flex-1 py-3 rounded-full bg-[#006948] text-white font-semibold text-[13px] shadow-sm hover:bg-[#00855d] active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Saving to Sheets...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">verified</span>
                    <span>Save & Recalculate</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* TAB 2: MATCH MY REAL BALANCE HELPER */}
        {activeTab === 'helper' && (
          <div className="flex flex-col gap-4">
            <div className="p-3.5 rounded-2xl bg-[#eff3ff] border border-[#dfe9fc]">
              <h4 className="text-[13px] font-bold text-[#006948] flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px]">account_balance_wallet</span>
                <span>Match My Real Balance Today</span>
              </h4>
              <p className="text-[11px] text-[#3e4942] mt-0.5 leading-relaxed">
                Enter your real cash in hand and live bank balances (from SBI / IOB apps). The system will compute exact differences and suggest the safest solution.
              </p>
            </div>

            {/* Real Balance Inputs */}
            <div className="space-y-3">
              {/* SBI */}
              <div className="p-3 rounded-2xl bg-white border border-[#dfe9fc]">
                <div className="flex justify-between items-center text-[12px] mb-1">
                  <span className="font-bold text-[#121c2a]">SBI Main (App Balance)</span>
                  <span className="text-[11px] text-[#3e4942]">App Computed: <strong>₹{sbiBalance}</strong></span>
                </div>
                <div className="flex items-center gap-1 p-2 rounded-xl bg-[#f8f9ff] border border-[#dfe9fc]">
                  <span className="font-bold text-[#121c2a] text-[13px]">₹</span>
                  <input
                    type="number"
                    value={realSbiInput}
                    onChange={(e) => setRealSbiInput(e.target.value)}
                    placeholder={String(sbiBalance)}
                    className="w-full bg-transparent text-[13px] font-bold text-[#121c2a] focus:outline-none tabular-nums"
                  />
                </div>
                {helperDiffs.hasSbi && (
                  <span className={`text-[11px] font-semibold mt-1 block ${helperDiffs.sbiDiff === 0 ? 'text-[#006948]' : 'text-[#894d00]'}`}>
                    Difference: {helperDiffs.sbiDiff > 0 ? `+₹${helperDiffs.sbiDiff}` : `₹${helperDiffs.sbiDiff}`}
                  </span>
                )}
              </div>

              {/* IOB */}
              <div className="p-3 rounded-2xl bg-white border border-[#dfe9fc]">
                <div className="flex justify-between items-center text-[12px] mb-1">
                  <span className="font-bold text-[#121c2a]">IOB Second (App Balance)</span>
                  <span className="text-[11px] text-[#3e4942]">App Computed: <strong>₹{iobBalance}</strong></span>
                </div>
                <div className="flex items-center gap-1 p-2 rounded-xl bg-[#f8f9ff] border border-[#dfe9fc]">
                  <span className="font-bold text-[#121c2a] text-[13px]">₹</span>
                  <input
                    type="number"
                    value={realIobInput}
                    onChange={(e) => setRealIobInput(e.target.value)}
                    placeholder={String(iobBalance)}
                    className="w-full bg-transparent text-[13px] font-bold text-[#121c2a] focus:outline-none tabular-nums"
                  />
                </div>
                {helperDiffs.hasIob && (
                  <span className={`text-[11px] font-semibold mt-1 block ${helperDiffs.iobDiff === 0 ? 'text-[#006948]' : 'text-[#894d00]'}`}>
                    Difference: {helperDiffs.iobDiff > 0 ? `+₹${helperDiffs.iobDiff}` : `₹${helperDiffs.iobDiff}`}
                  </span>
                )}
              </div>

              {/* Cash */}
              <div className="p-3 rounded-2xl bg-white border border-[#dfe9fc]">
                <div className="flex justify-between items-center text-[12px] mb-1">
                  <span className="font-bold text-[#121c2a]">Cash in Hand (Physical Wallet)</span>
                  <span className="text-[11px] text-[#3e4942]">App Computed: <strong>₹{cashBalance}</strong></span>
                </div>
                <div className="flex items-center gap-1 p-2 rounded-xl bg-[#f8f9ff] border border-[#dfe9fc]">
                  <span className="font-bold text-[#121c2a] text-[13px]">₹</span>
                  <input
                    type="number"
                    value={realCashInput}
                    onChange={(e) => setRealCashInput(e.target.value)}
                    placeholder={String(cashBalance)}
                    className="w-full bg-transparent text-[13px] font-bold text-[#121c2a] focus:outline-none tabular-nums"
                  />
                </div>
                {helperDiffs.hasCash && (
                  <span className={`text-[11px] font-semibold mt-1 block ${helperDiffs.cashDiff === 0 ? 'text-[#006948]' : 'text-[#894d00]'}`}>
                    Difference: {helperDiffs.cashDiff > 0 ? `+₹${helperDiffs.cashDiff}` : `₹${helperDiffs.cashDiff}`}
                  </span>
                )}
              </div>
            </div>

            {/* ATM WITHDRAWAL HEURISTIC DETECTION */}
            {helperDiffs.atmCheck.isDetected && (
              <div className="p-3.5 rounded-2xl bg-[#eff3ff] border border-[#006948]/30 flex flex-col gap-2">
                <div className="flex items-center gap-1.5 text-[#006948] font-bold text-[12px]">
                  <span className="material-symbols-outlined text-[18px]">local_atm</span>
                  <span>Missing ATM Withdrawal Detected</span>
                </div>
                <p className="text-[11px] text-[#3e4942] leading-relaxed">
                  {helperDiffs.atmCheck.explanation}
                </p>
                {onOpenTransferModal && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenTransferModal();
                    }}
                    className="py-2.5 px-4 rounded-xl bg-[#006948] text-white text-[12px] font-bold hover:bg-[#00855d] transition-all flex items-center justify-center gap-1.5 cursor-pointer mt-1"
                  >
                    <span className="material-symbols-outlined text-[16px]">sync_alt</span>
                    <span>Record Transfer (SBI → Cash: ₹{helperDiffs.atmCheck.suggestedAmount})</span>
                  </button>
                )}
              </div>
            )}

            {/* TWO OPTIONS */}
            {helperDiffs.hasAnyInput && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {/* Option A: Adjust Opening Balance */}
                <div className="p-3.5 rounded-2xl bg-white border border-[#dfe9fc] flex flex-col justify-between gap-2 shadow-2xs">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#006948] block">OPTION A</span>
                    <h5 className="font-bold text-[13px] text-[#121c2a] mt-0.5">Adjust Opening Balance</h5>
                    <p className="text-[11px] text-[#3e4942] leading-relaxed mt-1">
                      Adjusts your starting balance so that computed balances match your real apps. Assumes past records are complete.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleApplyHelperAdjustments}
                    className="w-full py-2.5 rounded-xl bg-[#eff3ff] text-[#006948] font-bold text-[12px] border border-[#dfe9fc] hover:bg-[#dfe9fc] transition-all cursor-pointer flex items-center justify-center gap-1"
                  >
                    <span>Apply to Preview</span>
                    <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
                  </button>
                </div>

                {/* Option B: Record Reconciliation */}
                <div className="p-3.5 rounded-2xl bg-white border border-[#dfe9fc] flex flex-col justify-between gap-2 shadow-2xs">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#894d00] block">OPTION B</span>
                    <h5 className="font-bold text-[13px] text-[#121c2a] mt-0.5">Reconciliation Adjustment</h5>
                    <p className="text-[11px] text-[#3e4942] leading-relaxed mt-1">
                      Leaves opening balance unchanged and records a dated adjustment for today. Best for untracked expenses or fees.
                    </p>
                  </div>
                  {onOpenReconcileModal ? (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenReconcileModal();
                      }}
                      className="w-full py-2.5 rounded-xl bg-[#fff2db] text-[#894d00] font-bold text-[12px] border border-[#ffdcc0] hover:bg-[#ffdcc0] transition-all cursor-pointer flex items-center justify-center gap-1"
                    >
                      <span>Open Reconciliation</span>
                      <span className="material-symbols-outlined text-[15px]">open_in_new</span>
                    </button>
                  ) : (
                    <span className="text-[10px] text-[#3e4942] italic">Available in Settings → Reconciliation</span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: BACKUPS & RESTORE */}
        {activeTab === 'backups' && (
          <div className="flex flex-col gap-3">
            <div className="p-3 rounded-2xl bg-[#eff3ff] border border-[#dfe9fc] text-[11px] text-[#3e4942] leading-relaxed">
              Before modifying your opening balances, a dated backup of your Accounts sheet is automatically preserved in Google Sheets. You can safely restore any previous version below.
            </div>

            {isLoadingBackups ? (
              <div className="py-8 flex flex-col items-center justify-center text-[#3e4942] gap-2">
                <span className="w-5 h-5 border-2 border-[#006948]/30 border-t-[#006948] rounded-full animate-spin" />
                <span className="text-[12px]">Loading backups from Sheets...</span>
              </div>
            ) : availableBackups.length === 0 ? (
              <div className="py-8 text-center text-[#3e4942] text-[12px]">
                No previous Accounts backups found yet. Backups are automatically created on your first save.
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {availableBackups.map((bName) => (
                  <div
                    key={bName}
                    className="p-3 rounded-2xl bg-white border border-[#dfe9fc] flex items-center justify-between shadow-2xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-[#006948]">history</span>
                      <span className="font-semibold text-[12px] text-[#121c2a] font-mono">{bName}</span>
                    </div>
                    <button
                      type="button"
                      disabled={isRestoring}
                      onClick={() => handleRestore(bName)}
                      className="px-3 py-1.5 rounded-xl bg-[#f8f9ff] text-[#006948] border border-[#dfe9fc] font-bold text-[11px] hover:bg-[#88f8c4]/30 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isRestoring ? 'Restoring...' : 'Restore'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
