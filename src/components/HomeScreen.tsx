import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { getTransactionIcon, formatDateLabel } from '../utils/categoryIcons';
import { Transaction } from '../types';

interface HomeScreenProps {
  onOpenAdd: (initialType?: 'expense' | 'income' | 'repayment') => void;
  onNavigateToAppa: () => void;
  onNavigateToHistory: () => void;
  onNavigateToSavings: () => void;
  onSelectTransaction: (tx: Transaction) => void;
  onOpenSyncModal: () => void;
  onOpenTransfer?: () => void;
  onOpenAccountSettings?: () => void;
  onOpenHealthModal?: () => void;
  onOpenReconcileModal?: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onOpenAdd,
  onNavigateToAppa,
  onNavigateToHistory,
  onNavigateToSavings,
  onSelectTransaction,
  onOpenSyncModal,
  onOpenTransfer,
  onOpenAccountSettings,
  onOpenHealthModal,
  onOpenReconcileModal,
}) => {
  const {
    state,
    totalIncome,
    incomeCount,
    currentMonthSpent,
    totalFamilyOutstanding,
    monthlyBudget,
    budgetUsedPercent,
    budgetRemaining,
    daysRemainingInMonth,
    syncWithGoogleSheets,
    refreshFromGoogleSheets,
    sbiBalance,
    iobBalance,
    cashBalance,
    totalAvailableMoney,
    totalReceivable,
    overallWorth,
  } = useApp();

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncNotice, setSyncNotice] = useState<{ text: string; success: boolean } | null>(null);

  const emergencyFund = state.savings.emergencyFund;
  const emergencyPercent = Math.min(
    100,
    Math.round((emergencyFund.current / (emergencyFund.target || 1)) * 100)
  );

  const recentTransactions = state.transactions.slice(0, 5);
  const currentMonthName = new Date().toLocaleString('en-US', { month: 'short' });

  const isSheetConfigured = Boolean(
    state.settings.googleAppsScriptUrl && state.settings.googleAppsScriptUrl.trim().length > 10
  );

  const handleQuickSync = async () => {
    setIsSyncing(true);
    setSyncNotice(null);
    // Bidirectional sync: pulls from Google Sheets first, then pushes
    const refreshRes = await refreshFromGoogleSheets();
    let res = refreshRes;
    if (refreshRes.success) {
      res = await syncWithGoogleSheets();
    }
    setIsSyncing(false);
    setSyncNotice({ text: res.message, success: res.success });
    setTimeout(() => {
      setSyncNotice(null);
    }, 5000);
  };

  return (
    <div className="flex flex-col w-full gap-4 pb-8">
      {/* Top Greeting & Live Dual-Sync */}
      <div className="flex items-center justify-between pt-1 pb-1">
        <div>
          <p className="text-[14px] text-[#3e4942] flex items-center gap-1.5 font-normal">
            Hi, welcome back <span>👋</span>
          </p>
          <div className="flex items-center gap-2">
            <img src="/pwa-192x192.png" alt="MSR Penny" className="w-6 h-6 rounded-full object-cover shadow-xs border border-[#006948]/20 shrink-0" />
            <p className="text-[20px] text-[#121c2a] font-semibold tracking-tight">
              MSR Penny
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {onOpenHealthModal && (
            <button
              onClick={onOpenHealthModal}
              className="w-8 h-8 rounded-full bg-[#eff3ff] hover:bg-[#dfe9fc] flex items-center justify-center text-[#006948] transition-colors cursor-pointer border border-[#dfe9fc]/60"
              title="Data Health Diagnostics"
            >
              <span className="material-symbols-outlined text-[18px]">health_and_safety</span>
            </button>
          )}

          <button
            onClick={onOpenSyncModal}
            className="flex items-center gap-1.5 bg-[#eff3ff] hover:bg-[#dfe9fc] px-3 py-1.5 rounded-full shadow-xs transition-colors cursor-pointer active:scale-95 border border-[#dfe9fc]/60"
            title="Click to check Google Sheets sync status"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isSheetConfigured ? 'bg-[#006948] animate-pulse' : 'bg-[#e07f00]'
              }`}
            />
            <span className="text-[10px] text-[#006948] font-bold uppercase tracking-wider">
              {isSheetConfigured ? 'Sheets Connected' : 'Connect Sheets'}
            </span>
          </button>
        </div>
      </div>

      {/* Hero Available Balance Card */}
      <div className="relative overflow-hidden bg-white rounded-2xl p-5 shadow-sm border border-[#dfe9fc]/60">
        <div className="absolute -right-6 -top-6 w-32 h-32 bg-[#006948]/5 rounded-full pointer-events-none" />
        <div className="relative z-10 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-[#3e4942] font-medium">Total Available Money</span>
            <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#dfe9fc] text-[#121c2a] font-semibold">
              Live Balance
            </span>
          </div>

          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-[36px] font-bold text-[#121c2a] tracking-tight tabular-nums">
              ₹{totalAvailableMoney.toLocaleString('en-IN')}
            </span>
          </div>

          <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-[#dfe9fc]/50 text-[#3e4942] text-[11px] justify-between">
            <div className="flex items-center gap-1">
              <span
                className="material-symbols-outlined text-[16px] text-[#006948]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                check_circle
              </span>
              <span>Receivable: ₹{totalReceivable.toLocaleString('en-IN')}</span>
            </div>
            <span className="font-semibold text-[#121c2a]">
              Overall Worth: ₹{overallWorth.toLocaleString('en-IN')}
            </span>
          </div>
        </div>
      </div>

      {/* Accounts & Balances Breakdown Card (SBI, IOB, Cash) */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#dfe9fc]/70 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#006948]/10 text-[#006948] flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">account_balance</span>
            </div>
            <div>
              <h3 className="text-[13px] font-bold text-[#121c2a]">Accounts & Balances</h3>
              <p className="text-[10px] text-[#3e4942]">Calculated from records • Zero balance drift</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {onOpenTransfer && (
              <button
                type="button"
                onClick={onOpenTransfer}
                className="px-2.5 py-1 rounded-lg bg-[#006948] hover:bg-[#00855d] text-white text-[11px] font-semibold flex items-center gap-1 shadow-xs cursor-pointer transition-colors"
                title="Transfer money between accounts"
              >
                <span className="material-symbols-outlined text-[14px]">swap_horiz</span>
                <span>Transfer</span>
              </button>
            )}
            {onOpenReconcileModal && (
              <button
                type="button"
                onClick={onOpenReconcileModal}
                className="h-7 px-2 rounded-lg border border-[#dfe9fc] hover:bg-[#eff3ff] text-[#006948] text-[11px] font-medium flex items-center gap-0.5 cursor-pointer transition-colors"
                title="Reconcile balance discrepancies"
              >
                <span className="material-symbols-outlined text-[14px]">tune</span>
                <span>Reconcile</span>
              </button>
            )}
            {onOpenAccountSettings && (
              <button
                type="button"
                onClick={onOpenAccountSettings}
                className="w-7 h-7 rounded-lg border border-[#dfe9fc] hover:bg-[#eff3ff] text-[#3e4942] flex items-center justify-center cursor-pointer transition-colors"
                title="Account Settings & Opening Balances"
              >
                <span className="material-symbols-outlined text-[15px]">settings</span>
              </button>
            )}
          </div>
        </div>

        {/* 3 Fixed Accounts */}
        <div className="grid grid-cols-3 gap-2">
          {/* SBI */}
          <div className="p-2.5 rounded-xl bg-[#f8f9ff] border border-[#dfe9fc]/60">
            <span className="text-[10px] font-bold text-[#3e4942] block uppercase tracking-wider truncate">
              SBI (Main)
            </span>
            <span className="text-[15px] font-bold text-[#121c2a] block tabular-nums mt-0.5">
              ₹{sbiBalance.toLocaleString('en-IN')}
            </span>
            <span className="text-[9px] text-[#006948] font-medium">Bank account</span>
          </div>

          {/* IOB */}
          <div className="p-2.5 rounded-xl bg-[#f8f9ff] border border-[#dfe9fc]/60">
            <span className="text-[10px] font-bold text-[#3e4942] block uppercase tracking-wider truncate">
              IOB (Second)
            </span>
            <span className="text-[15px] font-bold text-[#121c2a] block tabular-nums mt-0.5">
              ₹{iobBalance.toLocaleString('en-IN')}
            </span>
            <span className="text-[9px] text-[#006948] font-medium">Bank account</span>
          </div>

          {/* Cash */}
          <div className="p-2.5 rounded-xl bg-[#f8f9ff] border border-[#dfe9fc]/60">
            <span className="text-[10px] font-bold text-[#3e4942] block uppercase tracking-wider truncate">
              Cash (Wallet)
            </span>
            <span className="text-[15px] font-bold text-[#121c2a] block tabular-nums mt-0.5">
              ₹{cashBalance.toLocaleString('en-IN')}
            </span>
            <span className="text-[9px] text-[#006948] font-medium">Physical cash</span>
          </div>
        </div>
      </div>

      {/* 3-Column Compact Metric Row */}
      <div className="grid grid-cols-3 gap-2.5">
        {/* Spent Card */}
        <div className="bg-white rounded-xl p-3 flex flex-col justify-between shadow-sm border border-[#dfe9fc]/50">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-[#3e4942] font-medium">Spent</span>
            <div className="w-6 h-6 rounded-full bg-[#ffdad6]/60 flex items-center justify-center">
              <span className="material-symbols-outlined text-[14px] text-[#ba1a1a]">trending_down</span>
            </div>
          </div>
          <div className="mt-2">
            <p className="text-[17px] font-bold text-[#ba1a1a] tracking-tight tabular-nums">
              ₹{currentMonthSpent.toLocaleString('en-IN')}
            </p>
            <span className="text-[10px] text-[#3e4942]">{currentMonthName} spend</span>
          </div>
        </div>

        {/* Income Card */}
        <div className="bg-white rounded-xl p-3 flex flex-col justify-between shadow-sm border border-[#dfe9fc]/50">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-[#3e4942] font-medium">Income</span>
            <div className="w-6 h-6 rounded-full bg-[#88f8c4]/40 flex items-center justify-center">
              <span className="material-symbols-outlined text-[14px] text-[#006948]">trending_up</span>
            </div>
          </div>
          <div className="mt-2">
            <p className="text-[17px] font-bold text-[#006948] tracking-tight tabular-nums">
              ₹{totalIncome.toLocaleString('en-IN')}
            </p>
            <span className="text-[10px] text-[#3e4942]">{incomeCount} inflows</span>
          </div>
        </div>

        {/* Family Owes Card (Tappable to Family Settlements) */}
        <button
          onClick={onNavigateToAppa}
          className="bg-[#eff3ff] active:bg-[#e6eeff] rounded-xl p-3 flex flex-col justify-between shadow-sm border border-[#dfe9fc]/80 transition-all group text-left cursor-pointer"
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[11px] text-[#894d00] font-semibold truncate">Family Owes</span>
            <span className="material-symbols-outlined text-[16px] text-[#894d00] group-hover:translate-x-0.5 transition-transform">
              arrow_forward
            </span>
          </div>
          <div className="mt-2">
            <p className="text-[17px] font-bold text-[#ac6200] tracking-tight tabular-nums">
              ₹{totalFamilyOutstanding.toLocaleString('en-IN')}
            </p>
            <span className="text-[10px] text-[#3e4942]">Family settlements</span>
          </div>
        </button>
      </div>

      {/* Primary Action CTA Button */}
      <button
        type="button"
        onClick={() => onOpenAdd('expense')}
        className="w-full h-12 bg-[#006948] hover:bg-[#00855d] active:scale-[0.99] text-white rounded-xl text-[14px] font-semibold flex items-center justify-center gap-2 shadow-[0_4px_14px_rgba(0,105,72,0.28)] transition-all cursor-pointer"
      >
        <span className="material-symbols-outlined text-[20px]">add</span>
        <span>Add Expense</span>
      </button>

      {/* Google Sheets Dual-Sync Action Card */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#dfe9fc]/70 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                isSheetConfigured ? 'bg-[#88f8c4]/30 text-[#006948]' : 'bg-[#fff3cd] text-[#b7791f]'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">table_chart</span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-[13px] font-bold text-[#121c2a]">Google Sheets Dual-Sync</p>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    isSheetConfigured ? 'bg-[#88f8c4]/40 text-[#006948]' : 'bg-[#fed7aa] text-[#9a3412]'
                  }`}
                >
                  {isSheetConfigured ? 'Connected' : 'Setup Required'}
                </span>
              </div>
              <p className="text-[11px] text-[#3e4942]">
                {state.settings.lastSyncedAt
                  ? `Last synced: ${new Date(state.settings.lastSyncedAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })} • ${state.transactions.length} rows`
                  : isSheetConfigured
                  ? 'Ready to sync personal expenses & Appa ledger'
                  : 'Connect your Apps Script URL to sync'}
              </p>
            </div>
          </div>
        </div>

        {syncNotice && (
          <div
            className={`text-[12px] p-2.5 rounded-xl font-medium text-center ${
              syncNotice.success
                ? 'bg-[#88f8c4]/30 text-[#006948] border border-[#006948]/20'
                : 'bg-[#ffdad6]/60 text-[#ba1a1a] border border-[#ba1a1a]/20'
            }`}
          >
            {syncNotice.text}
          </div>
        )}

        <div className="flex items-center gap-2 pt-0.5">
          <button
            type="button"
            onClick={handleQuickSync}
            disabled={isSyncing}
            className="flex-1 h-10 rounded-xl bg-[#006948] hover:bg-[#00855d] active:scale-[0.99] text-white text-[12px] font-semibold flex items-center justify-center gap-1.5 shadow-[0_2px_8px_rgba(0,105,72,0.2)] transition-all cursor-pointer disabled:opacity-60"
          >
            {isSyncing ? (
              <>
                <span className="material-symbols-outlined text-[16px] animate-spin">refresh</span>
                <span>Syncing to Sheets...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[16px]">sync</span>
                <span>Sync Now</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onOpenSyncModal}
            className="h-10 px-3.5 rounded-xl border border-[#dfe9fc] hover:bg-[#eff3ff] text-[#121c2a] text-[12px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px] text-[#3e4942]">settings</span>
            <span>{isSheetConfigured ? 'Configure' : 'Connect'}</span>
          </button>
        </div>
      </div>

      {/* Dual Progress Section: Monthly Budget & Emergency Fund */}
      <div className="flex flex-col gap-3">
        {/* Monthly Spending Progress Bar */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-[#dfe9fc]/50 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#e6eeff] flex items-center justify-center text-[#006948]">
                <span className="material-symbols-outlined text-[16px]">pie_chart</span>
              </div>
              <div>
                <p className="text-[13px] font-semibold text-[#121c2a]">Monthly Budget</p>
                <p className="text-[11px] text-[#3e4942]">
                  ₹{currentMonthSpent.toLocaleString('en-IN')} of ₹{monthlyBudget.toLocaleString('en-IN')} used
                </p>
              </div>
            </div>
            <span className="text-[12px] font-bold text-[#006948] bg-[#88f8c4]/30 px-2.5 py-0.5 rounded-full">
              {budgetUsedPercent}%
            </span>
          </div>

          {/* Spacious Progress Bar */}
          <div className="w-full bg-[#e6eeff] rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-[#006948] h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(3, budgetUsedPercent))}%` }}
            />
          </div>

          <div className="flex items-center justify-between pt-0.5 text-[#3e4942] text-[11px]">
            <span>₹{budgetRemaining.toLocaleString('en-IN')} left to spend</span>
            <span>{daysRemainingInMonth} days remaining</span>
          </div>
        </div>

        {/* Savings Goal Card */}
        <div
          onClick={onNavigateToSavings}
          className="bg-white rounded-xl p-4 shadow-sm border border-[#dfe9fc]/50 flex flex-col gap-2.5 cursor-pointer hover:border-[#6063ee]/40 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#e1e0ff] flex items-center justify-center text-[#4648d4]">
                <span className="material-symbols-outlined text-[16px]">shield</span>
              </div>
              <div>
                <p className="text-[13px] font-semibold text-[#121c2a]">{emergencyFund.title}</p>
                <p className="text-[11px] text-[#3e4942]">
                  ₹{emergencyFund.current.toLocaleString('en-IN')} saved of ₹{emergencyFund.target.toLocaleString('en-IN')} goal
                </p>
              </div>
            </div>
            <span className="text-[12px] font-bold text-[#4648d4] bg-[#e1e0ff]/60 px-2.5 py-0.5 rounded-full">
              {emergencyPercent}%
            </span>
          </div>

          {/* Spacious Progress Bar */}
          <div className="w-full bg-[#e6eeff] rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-[#6063ee] h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(3, emergencyPercent))}%` }}
            />
          </div>

          <p className="text-[11px] text-[#3e4942]">
            {emergencyFund.subtitle}
          </p>
        </div>
      </div>

      {/* Recent Transactions Section */}
      <div className="flex flex-col gap-2.5 mt-1">
        <div className="flex items-center justify-between">
          <h2 className="text-[18px] font-semibold text-[#121c2a] tracking-tight">
            Recent Transactions
          </h2>
          <button
            onClick={onNavigateToHistory}
            className="text-[12px] text-[#006948] font-semibold hover:underline cursor-pointer"
          >
            View all ({state.transactions.length})
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {recentTransactions.map((tx) => {
            const visual = getTransactionIcon(tx);
            const isRepay = tx.type === 'repayment';
            const isIncome = tx.type === 'income';

            return (
              <div
                key={tx.id}
                onClick={() => onSelectTransaction(tx)}
                className="bg-white rounded-xl p-3 flex items-center justify-between shadow-xs border border-[#dfe9fc]/50 hover:border-[#006948]/30 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${visual.bgClass}`}>
                    <span className={`material-symbols-outlined text-[18px] ${visual.textClass}`}>
                      {visual.icon}
                    </span>
                  </div>

                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-[#121c2a] truncate">
                      {tx.title}
                    </p>
                    <p className="text-[11px] text-[#3e4942] truncate">
                      {formatDateLabel(tx.date)} • {tx.category}
                      {tx.accountName ? ` • ${tx.accountName}` : ''}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <p
                    className={`text-[14px] font-bold tabular-nums ${
                      isIncome || isRepay ? 'text-[#006948]' : 'text-[#121c2a]'
                    }`}
                  >
                    {isIncome || isRepay ? `+ ₹${tx.amount.toLocaleString('en-IN')}` : `₹${tx.amount.toLocaleString('en-IN')}`}
                  </p>
                  <span className="text-[9px] uppercase tracking-wider text-[#3e4942]">
                    {tx.type}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
