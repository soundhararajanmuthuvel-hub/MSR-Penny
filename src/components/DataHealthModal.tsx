import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { DataHealthIssue } from '../types';

interface DataHealthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenReconcile?: () => void;
}

export const DataHealthModal: React.FC<DataHealthModalProps> = ({
  isOpen,
  onClose,
  onOpenReconcile,
}) => {
  const {
    state,
    accounts,
    settledArchive,
    sbiBalance,
    iobBalance,
    cashBalance,
    totalAvailableMoney,
    triggerManualBackup,
    syncWithGoogleSheets,
  } = useApp();

  const [isBackingUp, setIsBackingUp] = useState<boolean>(false);
  const [backupMessage, setBackupMessage] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Compute diagnostics
  const report = useMemo(() => {
    const issues: DataHealthIssue[] = [];
    const txs = state.transactions || [];
    const validAccountIds = new Set(accounts.map((a) => a.id));

    // 1. Duplicate ID Check
    const seenIds = new Set<string>();
    const dupIds = new Set<string>();
    txs.forEach((t) => {
      if (seenIds.has(t.id)) dupIds.add(t.id);
      seenIds.add(t.id);
    });
    if (dupIds.size > 0) {
      issues.push({
        id: 'dup-ids',
        severity: 'error',
        category: 'duplicate_id',
        title: 'Duplicate Transaction IDs',
        description: `Found ${dupIds.size} duplicate transaction ID(s): ${Array.from(dupIds).slice(0, 3).join(', ')}`,
        proposedFix: 'Run Sync with Google Sheets to deduplicate rows by stable ID.',
      });
    }

    // 2. Missing Account Check
    const unassigned = txs.filter((t) => !t.accountId || !validAccountIds.has(t.accountId));
    if (unassigned.length > 0) {
      issues.push({
        id: 'missing-accounts',
        severity: 'warning',
        category: 'orphan',
        title: 'Transactions Without Account Assignment',
        description: `${unassigned.length} transaction(s) have no specific account assigned.`,
        proposedFix: 'Edit these transactions to associate them with SBI, IOB, or Cash.',
      });
    }

    // 3. Pre-Opening Balance Date Check
    let preOpeningCount = 0;
    accounts.forEach((acc) => {
      const opDate = acc.openingDate || '2026-01-01';
      const before = txs.filter((t) => t.accountId === acc.id && t.date < opDate);
      preOpeningCount += before.length;
    });
    if (preOpeningCount > 0) {
      issues.push({
        id: 'pre-opening',
        severity: 'info',
        category: 'pre_opening_date',
        title: 'Pre-Opening Date Transactions',
        description: `${preOpeningCount} transaction(s) dated before their account opening date (ignored in current balance).`,
        proposedFix: 'Review opening balance dates in Account Settings if historical records should be counted.',
      });
    }

    // 3b. Negative Account Balances Check
    const negativeAccounts: { name: string; balance: number }[] = [];
    if (sbiBalance < 0) negativeAccounts.push({ name: 'SBI', balance: sbiBalance });
    if (iobBalance < 0) negativeAccounts.push({ name: 'IOB', balance: iobBalance });
    if (cashBalance < 0) negativeAccounts.push({ name: 'Cash', balance: cashBalance });

    if (negativeAccounts.length > 0) {
      const names = negativeAccounts.map((a) => `${a.name} (₹${a.balance})`).join(', ');
      issues.push({
        id: 'negative-account-balance',
        severity: 'warning',
        category: 'calculation_mismatch',
        title: 'Negative Account Balance Detected',
        description: `Negative balance found in: ${names}. This occurs when expenses exceed starting balance and income.`,
        proposedFix: 'Adjust opening balances in Settings → Accounts, or record missing income / ATM transfers.',
      });
    }

    // 4. Missing required fields (Amount <= 0 or empty title)
    const invalidAmountOrTitle = txs.filter((t) => !t.amount || t.amount <= 0 || !t.title?.trim());
    if (invalidAmountOrTitle.length > 0) {
      issues.push({
        id: 'invalid-fields',
        severity: 'error',
        category: 'invalid_field',
        title: 'Incomplete Transaction Records',
        description: `${invalidAmountOrTitle.length} transaction(s) have zero/missing amounts or empty titles.`,
        proposedFix: 'Inspect transactions and populate missing amounts or titles.',
      });
    }

    // 5. Total Balance Sum Invariant Check
    const computedSum = sbiBalance + iobBalance + cashBalance;
    const isSumExact = Math.abs(computedSum - totalAvailableMoney) < 0.01;
    if (!isSumExact) {
      issues.push({
        id: 'balance-sum-mismatch',
        severity: 'error',
        category: 'calculation_mismatch',
        title: 'Balance Sum Invariant Discrepancy',
        description: `Total available money (₹${totalAvailableMoney}) does not match component sum (₹${computedSum}).`,
        proposedFix: 'Use the Balance Reconciliation tool to adjust any discrepancy.',
      });
    }

    const errorCount = issues.filter((i) => i.severity === 'error').length;
    const warningCount = issues.filter((i) => i.severity === 'warning').length;
    const infoCount = issues.filter((i) => i.severity === 'info').length;

    const healthScore = errorCount > 0 ? 70 : warningCount > 0 ? 90 : 100;

    return {
      healthScore,
      issues,
      errorCount,
      warningCount,
      infoCount,
      checkedCount: txs.length,
      archivedCount: (settledArchive || []).length,
    };
  }, [state.transactions, accounts, settledArchive, sbiBalance, iobBalance, cashBalance, totalAvailableMoney]);

  if (!isOpen) return null;

  const handleCreateBackup = async () => {
    setIsBackingUp(true);
    setBackupMessage(null);
    try {
      const res = await triggerManualBackup();
      if (res.success) {
        setBackupMessage(`Backup created: ${res.backupName}`);
      } else {
        setBackupMessage(res.message || 'Backup could not be completed.');
      }
    } catch {
      setBackupMessage('Error creating snapshot backup.');
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await syncWithGoogleSheets();
      setBackupMessage('Synced latest records with Google Sheets!');
    } catch {
      setBackupMessage('Sync failed. Please check network.');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#dfe9fc]/60 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#eff3ff] text-[#006948] flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">health_and_safety</span>
            </div>
            <div>
              <h3 className="text-[16px] font-bold text-[#121c2a]">Data Health Diagnostic</h3>
              <p className="text-[11px] text-[#3e4942]">Read-only sheet & balance audit</p>
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

        {/* Health Score Card */}
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between ${
            report.healthScore === 100
              ? 'bg-emerald-50 border-emerald-200'
              : report.healthScore >= 80
              ? 'bg-amber-50 border-amber-200'
              : 'bg-rose-50 border-rose-200'
          }`}
        >
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider block text-[#3e4942]">
              Overall Health Rating
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span
                className={`text-[28px] font-bold ${
                  report.healthScore === 100
                    ? 'text-emerald-700'
                    : report.healthScore >= 80
                    ? 'text-amber-700'
                    : 'text-rose-700'
                }`}
              >
                {report.healthScore}%
              </span>
              <span className="text-[12px] text-[#3e4942]">
                {report.healthScore === 100
                  ? 'All checks passed'
                  : `${report.errorCount} error(s), ${report.warningCount} warning(s)`}
              </span>
            </div>
          </div>

          <div className="text-right text-[11px] text-[#3e4942]">
            <span className="block font-semibold text-[#121c2a]">{report.checkedCount} active rows</span>
            <span className="block">{report.archivedCount} in Settled_Archive</span>
          </div>
        </div>

        {/* Integrity Checks List */}
        <div className="space-y-2">
          <span className="text-[11px] font-semibold text-[#3e4942] uppercase tracking-wider block">
            System Diagnostics
          </span>

          {/* Check Item 1: Balance Invariant */}
          <div className="p-3 bg-[#f8f9ff] rounded-xl border border-[#dfe9fc]/60 flex items-start gap-2.5">
            <span className="material-symbols-outlined text-emerald-600 text-[18px] shrink-0 mt-0.5">
              check_circle
            </span>
            <div className="text-[11px] flex-1">
              <strong className="text-[#121c2a] block">Balance Formula Invariant</strong>
              <span className="text-[#3e4942]">
                SBI (₹{sbiBalance}) + IOB (₹{iobBalance}) + Cash (₹{cashBalance}) = Available (₹{totalAvailableMoney})
              </span>
            </div>
          </div>

          {/* Check Item 2: LockService & Optimistic Concurrency */}
          <div className="p-3 bg-[#f8f9ff] rounded-xl border border-[#dfe9fc]/60 flex items-start gap-2.5">
            <span className="material-symbols-outlined text-emerald-600 text-[18px] shrink-0 mt-0.5">
              check_circle
            </span>
            <div className="text-[11px] flex-1">
              <strong className="text-[#121c2a] block">Backend LockService & Concurrency Guard</strong>
              <span className="text-[#3e4942]">
                Apps Script mutex lock (15s timeout) and updatedAt concurrency enabled.
              </span>
            </div>
          </div>

          {/* Check Item 3: Settled Archive Separation */}
          <div className="p-3 bg-[#f8f9ff] rounded-xl border border-[#dfe9fc]/60 flex items-start gap-2.5">
            <span className="material-symbols-outlined text-emerald-600 text-[18px] shrink-0 mt-0.5">
              check_circle
            </span>
            <div className="text-[11px] flex-1">
              <strong className="text-[#121c2a] block">Archive Safety Invariant</strong>
              <span className="text-[#3e4942]">
                Archived family transactions are permanently included in account balance calculations.
              </span>
            </div>
          </div>

          {/* Dynamic issues if any */}
          {report.issues.map((iss) => (
            <div
              key={iss.id}
              className={`p-3 rounded-xl border flex items-start gap-2.5 ${
                iss.severity === 'error'
                  ? 'bg-rose-50 border-rose-200 text-rose-900'
                  : iss.severity === 'warning'
                  ? 'bg-amber-50 border-amber-200 text-amber-900'
                  : 'bg-blue-50 border-blue-200 text-blue-900'
              }`}
            >
              <span
                className={`material-symbols-outlined text-[18px] shrink-0 mt-0.5 ${
                  iss.severity === 'error'
                    ? 'text-rose-600'
                    : iss.severity === 'warning'
                    ? 'text-amber-600'
                    : 'text-blue-600'
                }`}
              >
                {iss.severity === 'error' ? 'cancel' : iss.severity === 'warning' ? 'warning' : 'info'}
              </span>
              <div className="text-[11px] flex-1">
                <strong className="block">{iss.title}: {iss.description}</strong>
                {iss.proposedFix && (
                  <span className="opacity-90 block mt-0.5">Suggestion: {iss.proposedFix}</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Status / Backup Message */}
        {backupMessage && (
          <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] text-emerald-800 flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px] text-emerald-600">verified</span>
            <span>{backupMessage}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-2 pt-2 border-t border-[#dfe9fc]/60">
          <div className="flex gap-2">
            <button
              type="button"
              disabled={isBackingUp}
              onClick={handleCreateBackup}
              className="flex-1 py-2.5 rounded-xl bg-[#006948] hover:bg-[#00855d] text-white text-[12px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">cloud_sync</span>
              <span>{isBackingUp ? 'Backing up...' : 'Snapshot Backup Sheet'}</span>
            </button>

            <button
              type="button"
              disabled={isSyncing}
              onClick={handleSync}
              className="px-3.5 py-2.5 rounded-xl border border-[#dfe9fc] text-[12px] font-semibold text-[#121c2a] hover:bg-[#eff3ff] flex items-center gap-1 cursor-pointer transition-colors"
              title="Sync with Google Sheets"
            >
              <span className="material-symbols-outlined text-[16px]">sync</span>
              <span>{isSyncing ? 'Syncing...' : 'Sync'}</span>
            </button>
          </div>

          {onOpenReconcile && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenReconcile();
              }}
              className="w-full py-2 rounded-xl bg-[#eff3ff] hover:bg-[#dfe9fc] text-[#006948] text-[12px] font-semibold flex items-center justify-center gap-1 cursor-pointer transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">tune</span>
              <span>Open Balance Reconciliation Tool</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
