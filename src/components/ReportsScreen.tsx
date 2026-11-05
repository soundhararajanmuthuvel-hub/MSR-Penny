import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { formatPhoneNumberDisplay, normalizeWhatsAppNumber } from '../utils/phoneNormalizer';
import {
  subscribeToPushNotifications,
  sendTestNotification,
  isPushNotificationSupported,
  getNotificationPermission,
} from '../utils/webPush';

interface ReportsScreenProps {
  onOpenHealthModal?: () => void;
  onOpenReconcileModal?: () => void;
  onOpenAccountSettings?: () => void;
}

export const ReportsScreen: React.FC<ReportsScreenProps> = ({
  onOpenHealthModal,
  onOpenReconcileModal,
  onOpenAccountSettings,
}) => {
  const {
    state,
    totalIncome,
    currentMonthSpent,
    currentMonthFamilySpent,
    totalFamilyOutstanding,
    totalFamilyExpensesWaiting,
    totalFamilyRepaid,
    familyBalances,
    familyContacts,
    availableBalance,
    monthlyBudget,
    sbiBalance,
    iobBalance,
    cashBalance,
    totalAvailableMoney,
    totalReceivable,
    overallWorth,
    updateSettings,
    updateFamilyContact,
    syncWithGoogleSheets,
    refreshFromGoogleSheets,
  } = useApp();

  const [scriptUrlInput, setScriptUrlInput] = useState(
    state.settings?.googleAppsScriptUrl || ''
  );
  const [budgetInput, setBudgetInput] = useState(String(state.settings?.monthlyBudget || 4000));
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [showScriptModal, setShowScriptModal] = useState<boolean>(false);

  // Editing contact phone numbers
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [phoneInput, setPhoneInput] = useState<string>('');

  // Daily Reminder Notification State
  const [reminderEnabled, setReminderEnabled] = useState<boolean>(
    Boolean(state.settings?.reminderEnabled ?? true)
  );
  const [reminderTime, setReminderTime] = useState<string>(
    state.settings?.reminderTime || '21:00'
  );
  const [skipIfExpenseLogged, setSkipIfExpenseLogged] = useState<boolean>(
    Boolean(state.settings?.skipReminderIfExpenseLogged ?? true)
  );
  const [pushPermission, setPushPermission] = useState<NotificationPermission>(() => {
    return typeof window !== 'undefined' ? getNotificationPermission() : 'default';
  });
  const [isEnablingPush, setIsEnablingPush] = useState<boolean>(false);
  const [isSendingTestPush, setIsSendingTestPush] = useState<boolean>(false);
  const [pushNotice, setPushNotice] = useState<string | null>(null);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  // Freelance Income for current month
  const freelanceIncome = useMemo(() => {
    return state.transactions
      .filter((t) => {
        const d = new Date(t.date);
        return (
          d.getFullYear() === currentYear &&
          d.getMonth() === currentMonth &&
          t.type === 'income' &&
          (t.category === 'Freelance' || Boolean(t.freelanceJobId))
        );
      })
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  }, [state.transactions, currentYear, currentMonth]);

  // Category breakdown calculation (strictly personal expenses)
  const categoryBreakdown = useMemo(() => {
    const expenses = state.transactions.filter((t) => {
      const d = new Date(t.date);
      return (
        d.getFullYear() === currentYear &&
        d.getMonth() === currentMonth &&
        t.type === 'expense' &&
        !t.isFamilyReimbursable &&
        !t.isAppaReimbursable
      );
    });

    const totals: Record<string, number> = {};
    let grandTotal = 0;

    expenses.forEach((t) => {
      totals[t.category] = (totals[t.category] || 0) + Number(t.amount);
      grandTotal += Number(t.amount);
    });

    const categories = Object.entries(totals).map(([category, amount]) => ({
      category,
      amount,
      percentage: grandTotal > 0 ? Math.round((amount / grandTotal) * 100) : 0,
    }));

    return categories.sort((a, b) => b.amount - a.amount);
  }, [state.transactions, currentYear, currentMonth]);

  // Payment Method Breakdown
  const paymentMethodBreakdown = useMemo(() => {
    let upiTotal = 0;
    let cashTotal = 0;
    state.transactions.forEach((t) => {
      if (t.type === 'expense') {
        if (t.paymentMethod === 'upi') upiTotal += Number(t.amount);
        else cashTotal += Number(t.amount);
      }
    });
    const total = upiTotal + cashTotal || 1;
    return {
      upiTotal,
      cashTotal,
      upiPercent: Math.round((upiTotal / total) * 100),
      cashPercent: Math.round((cashTotal / total) * 100),
    };
  }, [state.transactions]);

  const handleEnablePush = async () => {
    setIsEnablingPush(true);
    setPushNotice(null);
    const res = await subscribeToPushNotifications();
    setIsEnablingPush(false);
    setPushPermission(getNotificationPermission());
    if (res.success) {
      setPushNotice('Push notifications enabled for this device!');
      await updateSettings({ reminderEnabled: true });
      setReminderEnabled(true);
    } else {
      setPushNotice(res.error || 'Failed to enable notifications');
    }
    setTimeout(() => setPushNotice(null), 4000);
  };

  const handleSendTestPush = async () => {
    setIsSendingTestPush(true);
    setPushNotice(null);
    const res = await sendTestNotification();
    setIsSendingTestPush(false);
    setPushNotice(res.message);
    setTimeout(() => setPushNotice(null), 4000);
  };

  const handleToggleReminder = async (enabled: boolean) => {
    setReminderEnabled(enabled);
    await updateSettings({ reminderEnabled: enabled });
  };

  const handleSaveReminderTime = async (time: string) => {
    setReminderTime(time);
    await updateSettings({ reminderTime: time });
  };

  const handleToggleSmartSkip = async (skip: boolean) => {
    setSkipIfExpenseLogged(skip);
    await updateSettings({ skipReminderIfExpenseLogged: skip });
  };

  const handleSaveBudget = async () => {
    const b = parseInt(budgetInput, 10);
    if (b > 0) {
      await updateSettings({ monthlyBudget: b });
      setSyncStatus('Monthly budget updated!');
      setTimeout(() => setSyncStatus(null), 2500);
    }
  };

  const handleSaveSyncUrl = async () => {
    await updateSettings({ googleAppsScriptUrl: scriptUrlInput.trim() });
    setSyncStatus('Google Apps Script URL saved!');
    setTimeout(() => setSyncStatus(null), 2500);
  };

  const handleTriggerSync = async () => {
    setIsSyncing(true);
    setSyncStatus('Syncing with Google Sheets...');
    await refreshFromGoogleSheets().catch(() => {});
    const result = await syncWithGoogleSheets(scriptUrlInput.trim());
    setIsSyncing(false);
    setSyncStatus(result.message);
    setTimeout(() => setSyncStatus(null), 4000);
  };

  const handleSaveContactPhone = async (contactId: string) => {
    const contact = familyContacts.find((c) => c.id === contactId);
    if (!contact) return;

    await updateFamilyContact({
      ...contact,
      phoneNumber: phoneInput.trim(),
    });
    setEditingContactId(null);
    setSyncStatus(`${contact.name}'s WhatsApp number updated!`);
    setTimeout(() => setSyncStatus(null), 2500);
  };

  const handleExportCSV = () => {
    const headers = [
      'Transaction ID',
      'Date',
      'Type',
      'Description',
      'Amount',
      'Category',
      'Payment Method',
      'Family Contact',
      'Settlement Status',
      'Notes',
    ];

    const rows = state.transactions.map((t) => [
      t.id,
      t.date,
      t.type,
      `"${t.title.replace(/"/g, '""')}"`,
      t.amount,
      t.category,
      t.paymentMethod,
      t.familyContactName || (t.isAppaReimbursable ? 'Appa' : '-'),
      t.settlementStatus || (t.appaSettled ? 'settled' : 'pending'),
      `"${(t.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `msr_penny_export_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportJSON = () => {
    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify(state, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute(
      'download',
      `msr_penny_backup_${new Date().toISOString().split('T')[0]}.json`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="flex flex-col w-full gap-4 pb-28">
      {/* Top Banner */}
      <div className="flex items-center justify-between bg-white px-4 py-3 rounded-2xl border border-[#dfe9fc]/60 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#006948]/10 flex items-center justify-center text-[#006948]">
            <span className="material-symbols-outlined text-[22px]">insights</span>
          </div>
          <div>
            <h2 className="text-[16px] font-bold text-[#121c2a]">Financial Reports & Settings</h2>
            <p className="text-[11px] text-[#3e4942]">Monthly statistics, family settlements & cloud sync</p>
          </div>
        </div>
      </div>

      {/* Accounts & Liquid Net Worth Breakdown */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#dfe9fc]/60 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-[#3e4942] uppercase tracking-wider block">
            Accounts & Worth
          </span>
          <span className="text-[12px] font-bold text-[#006948]">
            Worth: ₹{overallWorth.toLocaleString('en-IN')}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="bg-[#eff3ff] p-2.5 rounded-xl border border-[#dfe9fc]/60 text-center">
            <span className="text-[10px] text-[#3e4942] block">SBI Main</span>
            <span className={`text-[15px] font-bold block mt-0.5 tabular-nums ${sbiBalance < 0 ? 'text-[#ba1a1a]' : 'text-[#121c2a]'}`}>
              ₹{sbiBalance.toLocaleString('en-IN')}
            </span>
          </div>

          <div className="bg-[#eff3ff] p-2.5 rounded-xl border border-[#dfe9fc]/60 text-center">
            <span className="text-[10px] text-[#3e4942] block">IOB Secondary</span>
            <span className={`text-[15px] font-bold block mt-0.5 tabular-nums ${iobBalance < 0 ? 'text-[#ba1a1a]' : 'text-[#121c2a]'}`}>
              ₹{iobBalance.toLocaleString('en-IN')}
            </span>
          </div>

          <div className="bg-[#eff3ff] p-2.5 rounded-xl border border-[#dfe9fc]/60 text-center">
            <span className="text-[10px] text-[#3e4942] block">Cash Wallet</span>
            <span className={`text-[15px] font-bold block mt-0.5 tabular-nums ${cashBalance < 0 ? 'text-[#ba1a1a]' : 'text-[#121c2a]'}`}>
              ₹{cashBalance.toLocaleString('en-IN')}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-[#dfe9fc]/50 text-[11px] text-[#3e4942]">
          <span>Total Available: <strong className="text-[#121c2a]">₹{totalAvailableMoney.toLocaleString('en-IN')}</strong></span>
          <span>Family Receivable: <strong className="text-[#ac6200]">₹{totalReceivable.toLocaleString('en-IN')}</strong></span>
        </div>
      </div>

      {/* Monthly Financial Health Summary */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#dfe9fc]/60 space-y-3">
        <span className="text-[11px] font-semibold text-[#3e4942] uppercase tracking-wider block">
          Current Month Breakdown
        </span>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="bg-[#eff3ff] p-3 rounded-xl border border-[#dfe9fc]/50">
            <span className="text-[10px] text-[#3e4942] block">Total Inflows</span>
            <span className="text-[18px] font-bold text-[#006948] tabular-nums">
              ₹{totalIncome.toLocaleString('en-IN')}
            </span>
            <span className="text-[9px] text-[#3e4942] block mt-0.5">Freelance: ₹{freelanceIncome.toLocaleString('en-IN')}</span>
          </div>

          <div className="bg-[#eff3ff] p-3 rounded-xl border border-[#dfe9fc]/50">
            <span className="text-[10px] text-[#3e4942] block">Personal Spent</span>
            <span className="text-[18px] font-bold text-[#ba1a1a] tabular-nums">
              ₹{currentMonthSpent.toLocaleString('en-IN')}
            </span>
            <span className="text-[9px] text-[#3e4942] block mt-0.5">
              {currentMonthFamilySpent > 0 ? `+ ₹${currentMonthFamilySpent.toLocaleString('en-IN')} family outflows` : 'Excludes family split'}
            </span>
          </div>

          <div className="bg-[#eff3ff] p-3 rounded-xl border border-[#dfe9fc]/50">
            <span className="text-[10px] text-[#3e4942] block">Family Outstanding</span>
            <span className="text-[18px] font-bold text-[#894d00] tabular-nums">
              ₹{totalFamilyOutstanding.toLocaleString('en-IN')}
            </span>
            <span className="text-[9px] text-[#3e4942] block mt-0.5">Across all contacts</span>
          </div>

          <div className="bg-[#eff3ff] p-3 rounded-xl border border-[#dfe9fc]/50">
            <span className="text-[10px] text-[#3e4942] block">This Month Net</span>
            <span className="text-[18px] font-bold text-[#121c2a] tabular-nums">
              ₹{(totalIncome - currentMonthSpent).toLocaleString('en-IN')}
            </span>
            <span className="text-[9px] text-[#3e4942] block mt-0.5">Inflows − personal spent (this month)</span>
          </div>
        </div>
      </div>

      {/* Family Settlements by Contact Table */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#dfe9fc]/60 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-bold text-[#121c2a]">Family Settlements Summary</span>
          <span className="text-[11px] text-[#006948] font-bold">
            Total Owed: ₹{totalFamilyOutstanding.toLocaleString('en-IN')}
          </span>
        </div>

        <div className="divide-y divide-[#dfe9fc]/60 text-[12px]">
          {familyContacts.map((contact) => {
            const bal = familyBalances[contact.id] || {
              totalReimbursable: 0,
              totalRepaid: 0,
              outstandingBalance: 0,
              pendingCount: 0,
            };

            return (
              <div key={contact.id} className="py-2.5 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <strong className="text-[#121c2a]">{contact.name}</strong>
                    {bal.outstandingBalance === 0 && (
                      <span className="text-[9px] bg-[#88f8c4]/40 text-[#006948] px-1.5 py-0.2 rounded-md font-bold">
                        Settled
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-[#3e4942]">
                    Paid: ₹{bal.totalReimbursable} • Repaid: ₹{bal.totalRepaid}
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-[14px] font-bold text-[#006948] tabular-nums">
                    ₹{bal.outstandingBalance.toLocaleString('en-IN')}
                  </span>
                  <span className="text-[10px] text-[#3e4942] block">
                    {bal.pendingCount} pending items
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Spending by Category */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#dfe9fc]/60 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-bold text-[#121c2a]">Spending by Category</span>
          <span className="text-[11px] text-[#3e4942]">
            Total ₹{currentMonthSpent.toLocaleString('en-IN')}
          </span>
        </div>

        <div className="space-y-2.5">
          {categoryBreakdown.map((item) => (
            <div key={item.category} className="space-y-1">
              <div className="flex items-center justify-between text-[12px]">
                <span className="font-medium text-[#121c2a]">{item.category}</span>
                <span className="text-[#3e4942] font-semibold tabular-nums">
                  ₹{item.amount.toLocaleString('en-IN')} ({item.percentage}%)
                </span>
              </div>
              <div className="w-full bg-[#e6eeff] rounded-full h-2 overflow-hidden">
                <div
                  className="bg-[#006948] h-2 rounded-full transition-all"
                  style={{ width: `${Math.min(100, Math.max(4, item.percentage))}%` }}
                />
              </div>
            </div>
          ))}

          {categoryBreakdown.length === 0 && (
            <p className="text-[12px] text-[#6d7a72] py-2 text-center">No personal expenses recorded this month.</p>
          )}
        </div>
      </div>

      {/* Payment Modes Distribution */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#dfe9fc]/60 space-y-3">
        <span className="text-[13px] font-bold text-[#121c2a]">Payment Method Breakdown</span>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="bg-[#eff3ff] p-3 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#006948] text-[20px]">
                account_balance
              </span>
              <div>
                <span className="text-[11px] text-[#3e4942] block">UPI / Bank</span>
                <span className="text-[14px] font-bold text-[#121c2a] tabular-nums">
                  ₹{paymentMethodBreakdown.upiTotal}
                </span>
              </div>
            </div>
            <span className="text-[11px] font-bold text-[#006948]">
              {paymentMethodBreakdown.upiPercent}%
            </span>
          </div>

          <div className="bg-[#eff3ff] p-3 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#894d00] text-[20px]">payments</span>
              <div>
                <span className="text-[11px] text-[#3e4942] block">Cash</span>
                <span className="text-[14px] font-bold text-[#121c2a] tabular-nums">
                  ₹{paymentMethodBreakdown.cashTotal}
                </span>
              </div>
            </div>
            <span className="text-[11px] font-bold text-[#894d00]">
              {paymentMethodBreakdown.cashPercent}%
            </span>
          </div>
        </div>
      </div>

      {/* Family Contacts & WhatsApp Configuration */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#dfe9fc]/60 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-[#ffdcc0] flex items-center justify-center text-[#894d00]">
            <span className="material-symbols-outlined text-[18px]">contacts</span>
          </div>
          <div>
            <span className="text-[13px] font-bold text-[#121c2a]">Family WhatsApp Contacts</span>
            <p className="text-[11px] text-[#3e4942]">Configured recipients for WhatsApp settlement sharing</p>
          </div>
        </div>

        <div className="space-y-2">
          {familyContacts.map((contact) => {
            const isEditing = editingContactId === contact.id;
            return (
              <div
                key={contact.id}
                className="p-3 bg-[#f8f9ff] border border-[#dfe9fc]/70 rounded-xl space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[13px] font-bold text-[#121c2a]">{contact.name}</span>
                    <span className="text-[11px] text-[#3e4942] block">
                      {formatPhoneNumberDisplay(contact.phoneNumber)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (isEditing) {
                        setEditingContactId(null);
                      } else {
                        setEditingContactId(contact.id);
                        setPhoneInput(contact.phoneNumber || '');
                      }
                    }}
                    className="text-[11px] text-[#006948] font-semibold hover:underline cursor-pointer"
                  >
                    {isEditing ? 'Cancel' : 'Edit Number'}
                  </button>
                </div>

                {isEditing && (
                  <div className="flex gap-2 pt-1">
                    <input
                      type="tel"
                      value={phoneInput}
                      onChange={(e) => setPhoneInput(e.target.value)}
                      placeholder="+919876543210"
                      className="flex-1 px-3 py-1.5 bg-white border border-[#dfe9fc] rounded-lg text-[12px] text-[#121c2a] focus:outline-none focus:border-[#006948]"
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveContactPhone(contact.id)}
                      className="px-3 py-1.5 bg-[#006948] text-white text-[11px] font-semibold rounded-lg cursor-pointer"
                    >
                      Save
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Budget Configuration */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#dfe9fc]/60 space-y-3">
        <span className="text-[13px] font-bold text-[#121c2a]">Monthly Budget Goal</span>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={budgetInput}
            onChange={(e) => setBudgetInput(e.target.value)}
            className="flex-1 px-3 py-2 bg-[#f8f9ff] border border-[#dfe9fc] rounded-xl text-[14px] font-bold text-[#121c2a] focus:outline-none focus:border-[#006948]"
          />
          <button
            onClick={handleSaveBudget}
            className="px-4 py-2 bg-[#006948] hover:bg-[#00855d] text-white text-[12px] font-semibold rounded-xl cursor-pointer"
          >
            Save
          </button>
        </div>
      </div>

      {/* Daily Expense Reminder Notification Card (Section 7) */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#dfe9fc]/60 space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#006948] text-[20px]">notifications_active</span>
            <div>
              <span className="text-[13px] font-bold text-[#121c2a]">Daily Expense Reminder</span>
              <p className="text-[11px] text-[#3e4942]">Web Push alerts via Vercel Cron (9:00 PM IST)</p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={reminderEnabled}
              onChange={(e) => handleToggleReminder(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-10 h-5 bg-[#dfe9fc] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#006948]"></div>
          </label>
        </div>

        {/* Time Selector & Status */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[11px] font-semibold text-[#3e4942] uppercase tracking-wider block mb-1">
              Reminder Time (IST)
            </label>
            <input
              type="time"
              value={reminderTime}
              onChange={(e) => handleSaveReminderTime(e.target.value)}
              className="w-full px-3 py-2 bg-[#f8f9ff] border border-[#dfe9fc] rounded-xl text-[13px] font-semibold text-[#121c2a] focus:outline-none focus:border-[#006948]"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-[#3e4942] uppercase tracking-wider block mb-1">
              Browser Permission
            </label>
            <div className="h-[38px] px-3 bg-[#f8f9ff] border border-[#dfe9fc] rounded-xl flex items-center justify-between">
              <span className="text-[12px] font-semibold capitalize text-[#121c2a]">
                {pushPermission === 'granted' ? 'Allowed' : pushPermission}
              </span>
              <span className={`w-2 h-2 rounded-full ${pushPermission === 'granted' ? 'bg-[#006948]' : 'bg-[#e07f00]'}`} />
            </div>
          </div>
        </div>

        {/* Smart Skip Toggle */}
        <div className="bg-[#eff3ff] p-3 rounded-xl border border-[#dfe9fc]/60 flex items-start gap-2.5">
          <input
            type="checkbox"
            id="smartSkipToggle"
            checked={skipIfExpenseLogged}
            onChange={(e) => handleToggleSmartSkip(e.target.checked)}
            className="mt-0.5 w-4 h-4 text-[#006948] rounded border-gray-300 focus:ring-[#006948]"
          />
          <label htmlFor="smartSkipToggle" className="text-[11px] text-[#3e4942] leading-tight cursor-pointer">
            <strong>Smart Skip:</strong> Don't remind me if I have already recorded today's expenses.
          </label>
        </div>

        {/* Action Buttons: Enable Notification & Send Test */}
        <div className="flex gap-2">
          {pushPermission !== 'granted' ? (
            <button
              type="button"
              onClick={handleEnablePush}
              disabled={isEnablingPush}
              className="flex-1 py-2 bg-[#006948] hover:bg-[#00855d] text-white text-[12px] font-semibold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[16px]">notifications</span>
              <span>{isEnablingPush ? 'Requesting...' : 'Enable Device Notifications'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSendTestPush}
              disabled={isSendingTestPush}
              className="flex-1 py-2 bg-[#eff3ff] hover:bg-[#dfe9fc] text-[#006948] text-[12px] font-semibold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-colors disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[16px]">send</span>
              <span>{isSendingTestPush ? 'Sending Test...' : 'Send Test Notification'}</span>
            </button>
          )}
        </div>

        {pushNotice && (
          <p className="text-[11px] text-[#006948] font-semibold text-center bg-[#88f8c4]/30 py-1.5 rounded-lg border border-[#006948]/20">
            {pushNotice}
          </p>
        )}
      </div>

      {/* Google Sheets Dual-Sync Integration */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#dfe9fc]/60 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#006948] text-[20px]">sync</span>
            <span className="text-[13px] font-bold text-[#121c2a]">Google Sheets Dual-Sync</span>
          </div>

          <button
            onClick={() => setShowScriptModal(true)}
            className="text-[11px] text-[#006948] font-semibold hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[14px]">code</span>
            <span>View Apps Script</span>
          </button>
        </div>

        <p className="text-[11px] text-[#3e4942] leading-relaxed">
          Keep your transactions in your private Google Sheets spreadsheet via Google Apps Script Webhook. All credentials stay securely on the backend.
        </p>

        <div className="space-y-2">
          <label className="text-[11px] font-semibold text-[#3e4942] uppercase tracking-wider block">
            Apps Script Webhook URL
          </label>
          <input
            type="url"
            value={scriptUrlInput}
            onChange={(e) => setScriptUrlInput(e.target.value)}
            placeholder="https://script.google.com/macros/s/.../exec"
            className="w-full px-3 py-2 bg-[#f8f9ff] border border-[#dfe9fc] rounded-xl text-[12px] text-[#121c2a] focus:outline-none focus:border-[#006948]"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleSaveSyncUrl}
            className="flex-1 py-2 bg-[#eff3ff] hover:bg-[#dfe9fc] text-[#121c2a] text-[12px] font-semibold rounded-xl cursor-pointer transition-colors"
          >
            Save URL
          </button>

          <button
            onClick={handleTriggerSync}
            disabled={isSyncing}
            className="flex-1 py-2 bg-[#006948] hover:bg-[#00855d] text-white text-[12px] font-semibold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer disabled:bg-[#bdcac0]"
          >
            {isSyncing ? (
              <span className="material-symbols-outlined text-[16px] animate-spin">refresh</span>
            ) : (
              <span className="material-symbols-outlined text-[16px]">cloud_sync</span>
            )}
            <span>{isSyncing ? 'Syncing...' : 'Sync to Sheets'}</span>
          </button>
        </div>

        {state.settings?.lastSyncedAt && (
          <p className="text-[10px] text-[#006948] font-medium text-center">
            Last dual-synced: {new Date(state.settings.lastSyncedAt).toLocaleString()}
          </p>
        )}

        {syncStatus && (
          <p className="text-[11px] text-[#006948] font-semibold text-center bg-[#88f8c4]/20 py-1 rounded-lg">
            {syncStatus}
          </p>
        )}
      </div>

      {/* Integrity, Diagnostics & Reconciliation Section */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#dfe9fc]/60 space-y-3">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[#006948] text-[20px]">verified_user</span>
          <span className="text-[13px] font-bold text-[#121c2a]">Data Integrity & Reconciliation</span>
        </div>
        <p className="text-[11px] text-[#3e4942]">
          Verify zero balance drift, inspect LockService health, and reconcile bank SMS/cash discrepancies transparently.
        </p>

        <div className="grid grid-cols-2 gap-2">
          {onOpenHealthModal && (
            <button
              type="button"
              onClick={onOpenHealthModal}
              className="py-2.5 bg-[#eff3ff] hover:bg-[#dfe9fc] text-[#006948] text-[12px] font-semibold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">health_and_safety</span>
              <span>Health Diagnostic</span>
            </button>
          )}

          {onOpenReconcileModal && (
            <button
              type="button"
              onClick={onOpenReconcileModal}
              className="py-2.5 bg-[#eff3ff] hover:bg-[#dfe9fc] text-[#121c2a] text-[12px] font-semibold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
            >
              <span className="material-symbols-outlined text-[16px] text-[#006948]">tune</span>
              <span>Reconcile Balance</span>
            </button>
          )}
        </div>
      </div>

      {/* Export & Data Backup */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#dfe9fc]/60 space-y-3">
        <span className="text-[13px] font-bold text-[#121c2a]">Backup & Data Export</span>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleExportCSV}
            className="py-2.5 bg-[#eff3ff] hover:bg-[#dfe9fc] text-[#121c2a] text-[12px] font-semibold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
          >
            <span className="material-symbols-outlined text-[16px] text-[#006948]">table_view</span>
            <span>Export CSV</span>
          </button>

          <button
            onClick={handleExportJSON}
            className="py-2.5 bg-[#eff3ff] hover:bg-[#dfe9fc] text-[#121c2a] text-[12px] font-semibold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
          >
            <span className="material-symbols-outlined text-[16px] text-[#4648d4]">download</span>
            <span>JSON Backup</span>
          </button>
        </div>
      </div>
    </div>
  );
};
