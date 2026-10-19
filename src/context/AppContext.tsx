import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode, useCallback } from 'react';
import {
  Transaction,
  FreelanceJob,
  SavingsState,
  AppSettings,
  AppState,
  PaymentMethod,
  FamilyContact,
  FamilyContactBalance,
} from '../types';
import { initialSeedData } from '../data/initialData';
import {
  DEFAULT_FAMILY_CONTACTS,
  migrateAppaTransactions,
  calculateFamilyBalances,
} from '../utils/familyMigration';

interface AddTransactionResult {
  success: boolean;
  error?: string;
  previousBalance: number;
  updatedBalance: number;
  transaction?: Transaction;
  contactId?: string;
  contactName?: string;
  previousAppaBalance?: number;
  updatedAppaBalance?: number;
}

interface AppContextType {
  state: AppState;
  loading: boolean;
  error: string | null;
  syncError: string | null;
  isSyncing: boolean;

  // Computed Financial Metrics
  totalIncome: number;
  incomeCount: number;
  currentMonthSpent: number;
  availableBalance: number;
  monthlyBudget: number;
  budgetUsedPercent: number;
  budgetRemaining: number;
  daysRemainingInMonth: number;
  pendingFreelanceTotal: number;
  receivedFreelanceTotal: number;

  // Family Settlements Metrics
  familyBalances: Record<string, FamilyContactBalance>;
  totalFamilyExpensesWaiting: number;
  totalFamilyRepaid: number;
  totalFamilyOutstanding: number;
  familyContacts: FamilyContact[];

  // Appa Compatibility Metrics
  totalAppaPaidByMe: number;
  totalAppaRepaid: number;
  appaOwesMe: number;
  totalPendingAppaItemsCount: number;
  migrationStatus: { migratedCount: number; needsReviewCount: number };

  // Actions
  addTransaction: (tx: Omit<Transaction, 'id' | 'createdAt'>) => Promise<AddTransactionResult>;
  updateTransaction: (tx: Transaction) => Promise<boolean>;
  deleteTransaction: (id: string) => Promise<boolean>;
  recordFamilyRepayment: (
    contactId: string,
    amount: number,
    paymentMethod: PaymentMethod,
    note?: string
  ) => Promise<AddTransactionResult>;

  // Family Contacts Management
  addFamilyContact: (name: string, phoneNumber?: string) => Promise<FamilyContact>;
  updateFamilyContact: (contact: FamilyContact) => Promise<boolean>;
  deactivateFamilyContact: (id: string) => Promise<boolean>;

  // Freelance Actions
  addFreelanceJob: (job: Omit<FreelanceJob, 'id' | 'createdAt'>) => Promise<boolean>;
  updateFreelanceJob: (job: FreelanceJob) => Promise<boolean>;
  deleteFreelanceJob: (id: string) => Promise<boolean>;
  recordMilestonePayment: (jobId: string, milestoneId: string) => Promise<boolean>;
  recordCustomFreelancePayment: (
    jobId: string,
    amount: number,
    paymentMethod: PaymentMethod,
    note?: string,
    milestoneId?: string
  ) => Promise<boolean>;

  // Savings Actions
  updateEmergencyFund: (current: number, target: number) => Promise<boolean>;
  addSavingsGoal: (goal: { title: string; target: number; current: number; icon: string; deadline?: string }) => Promise<boolean>;
  updateSavingsGoal: (goal: any) => Promise<boolean>;
  deleteSavingsGoal: (id: string) => Promise<boolean>;

  // Settings & Sync Actions
  updateSettings: (settings: Partial<AppSettings>) => Promise<boolean>;
  refreshFromGoogleSheets: () => Promise<{ success: boolean; message: string; count?: number }>;
  syncWithGoogleSheets: (url?: string) => Promise<{ success: boolean; message: string; count?: number }>;
  resetToSampleData: () => Promise<boolean>;
  clearDemoData: (wipeRemoteSheet?: boolean) => Promise<boolean>;
  isDemoDataLoaded: boolean;
}

const getEffectiveEnvSettings = () => {
  const envUrl = typeof import.meta !== 'undefined' ? (import.meta.env?.VITE_GOOGLE_APPS_SCRIPT_URL || '') : '';
  const envPhone = typeof import.meta !== 'undefined' ? (import.meta.env?.VITE_APPA_WHATSAPP_NUMBER || '') : '';
  return {
    googleAppsScriptUrl: envUrl.trim(),
    appaPhoneNumber: envPhone.trim() || '+919876543210',
  };
};

const defaultInitialState: AppState = {
  ...initialSeedData,
  familyContacts: DEFAULT_FAMILY_CONTACTS,
  settings: {
    ...initialSeedData.settings,
    googleAppsScriptUrl: getEffectiveEnvSettings().googleAppsScriptUrl || initialSeedData.settings.googleAppsScriptUrl || '',
    appaPhoneNumber: getEffectiveEnvSettings().appaPhoneNumber || initialSeedData.settings.appaPhoneNumber || '+919876543210',
    familyContacts: DEFAULT_FAMILY_CONTACTS,
  },
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AppState>(() => {
    const envDefaults = getEffectiveEnvSettings();
    const cached = localStorage.getItem('my_money_app_state');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        const contacts = parsed.familyContacts && parsed.familyContacts.length > 0
          ? parsed.familyContacts
          : (parsed.settings?.familyContacts && parsed.settings.familyContacts.length > 0
              ? parsed.settings.familyContacts
              : DEFAULT_FAMILY_CONTACTS);

        const { migratedTransactions } = migrateAppaTransactions(parsed.transactions || [], contacts);

        return {
          ...parsed,
          transactions: migratedTransactions,
          familyContacts: contacts,
          settings: {
            ...parsed.settings,
            googleAppsScriptUrl: (parsed.settings?.googleAppsScriptUrl || envDefaults.googleAppsScriptUrl || '').trim(),
            appaPhoneNumber: (parsed.settings?.appaPhoneNumber || envDefaults.appaPhoneNumber || '+919876543210').trim(),
            familyContacts: contacts,
          },
        };
      } catch {
        return defaultInitialState;
      }
    }
    return defaultInitialState;
  });

  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Sync state to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('my_money_app_state', JSON.stringify(state));
    } catch (e) {
      console.warn('Failed to cache state to localStorage:', e);
    }
  }, [state]);

  // Reconcile authoritative remote transactions with local state:
  // - Remote transactions are authoritative for confirmed records.
  // - Any local confirmed transaction absent from remote transactions is REMOVED (deleted remotely).
  // - Genuinely pending offline creations (isPendingSync: true) and pending deletions are respected.
  const reconcileRemoteTransactions = useCallback((remoteTxs: Transaction[], existingTxs: Transaction[]): Transaction[] => {
    // Collect pending offline operations from existing local transactions
    const pendingCreations = existingTxs.filter((t) => t && t.isPendingSync && !t.isPendingDeletion);
    const pendingDeletionIds = new Set(existingTxs.filter((t) => t && t.isPendingDeletion).map((t) => t.id));

    // Filter remote transactions to exclude any pending offline deletion
    const confirmedFromRemote = remoteTxs.filter((t) => t && t.id && !pendingDeletionIds.has(t.id));

    // Combine authoritative remote with pending offline creations
    const combined = [...confirmedFromRemote, ...pendingCreations];

    // Deduplicate by ID
    const map = new Map<string, Transaction>();
    combined.forEach((t) => {
      if (t && t.id) map.set(t.id, t);
    });

    // Return chronological descending (newest first)
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, []);

  // Fetch initial state: checks /api/state or directly queries configured Google Apps Script
  const fetchState = useCallback(async () => {
    setLoading(true);
    setSyncError(null);

    const envDefaults = getEffectiveEnvSettings();
    const scriptUrl = (state.settings?.googleAppsScriptUrl || envDefaults.googleAppsScriptUrl || '').trim();

    // 1. Try serverless backend route (/api/state)
    let loadedFromBackend = false;
    try {
      const res = await fetch('/api/state');
      const cType = res.headers.get('content-type') || '';
      if (res.ok && cType.includes('application/json')) {
        const json = await res.json();
        if (json.success && json.data) {
          const remoteContacts = json.data.familyContacts && json.data.familyContacts.length > 0
            ? json.data.familyContacts
            : (state.familyContacts && state.familyContacts.length > 0 ? state.familyContacts : DEFAULT_FAMILY_CONTACTS);

          const { migratedTransactions } = migrateAppaTransactions(json.data.transactions || [], remoteContacts);
          const reconciled = reconcileRemoteTransactions(migratedTransactions, state.transactions);

          setState((prev) => ({
            ...prev,
            ...json.data,
            transactions: reconciled,
            familyContacts: remoteContacts,
            settings: {
              ...json.data.settings,
              googleAppsScriptUrl: (json.data.settings?.googleAppsScriptUrl || scriptUrl).trim(),
              familyContacts: remoteContacts,
            },
          }));
          loadedFromBackend = true;
          setError(null);
        }
      }
    } catch {
      // Backend route not available
    }

    // 2. Direct client fetch to Google Apps Script if scriptUrl is configured and not yet loaded from backend
    if (!loadedFromBackend && scriptUrl) {
      try {
        const fetchUrl = `${scriptUrl}${scriptUrl.includes('?') ? '&' : '?'}action=get_all_data`;
        const res = await fetch(fetchUrl, { method: 'GET', mode: 'cors' });
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.transactions)) {
            const remoteContacts = json.familyContacts && json.familyContacts.length > 0
              ? json.familyContacts
              : (state.familyContacts && state.familyContacts.length > 0 ? state.familyContacts : DEFAULT_FAMILY_CONTACTS);

            const { migratedTransactions } = migrateAppaTransactions(json.transactions, remoteContacts);
            const reconciled = reconcileRemoteTransactions(migratedTransactions, state.transactions);

            setState((prev) => ({
              ...prev,
              transactions: reconciled,
              familyContacts: remoteContacts,
              settings: {
                ...prev.settings,
                lastSyncedAt: new Date().toISOString(),
                syncEnabled: true,
              },
            }));
            setError(null);
          }
        }
      } catch (err: any) {
        console.warn('Google Sheets initial fetch notice:', err.message);
        setSyncError('Could not reach Google Sheets. Displaying cached records.');
      }
    }

    setLoading(false);
  }, [state.settings?.googleAppsScriptUrl, state.familyContacts, state.transactions, reconcileRemoteTransactions]);

  useEffect(() => {
    fetchState();
  }, []);

  // Financial Calculations & Family Balances
  const calculations = useMemo(() => {
    const transactions = state.transactions || [];
    const contacts = state.familyContacts && state.familyContacts.length > 0
      ? state.familyContacts
      : DEFAULT_FAMILY_CONTACTS;

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed

    // Calculate days remaining in current month
    const totalDaysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const currentDay = now.getDate();
    const daysRemainingInMonth = Math.max(0, totalDaysInMonth - currentDay);

    // Filter transactions for current month
    const currentMonthTxs = transactions.filter((t) => {
      const d = new Date(t.date);
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
    });

    // 1. Total Income (Inflows) for current month - strictly ordinary income, NOT family repayments!
    const incomeTxs = currentMonthTxs.filter((t) => t.type === 'income');
    const totalIncome = incomeTxs.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const incomeCount = incomeTxs.length;

    // 2. Personal Spent (current month) - strictly excludes family and Appa reimbursable expenses!
    const personalExpenses = currentMonthTxs.filter(
      (t) => t.type === 'expense' && !t.isAppaReimbursable && !t.isFamilyReimbursable
    );
    const currentMonthSpent = personalExpenses.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    // 3. Available Balance = Income minus Personal Spent
    const availableBalance = Math.max(0, totalIncome - currentMonthSpent);

    // 4. Budget Progress
    const monthlyBudget = state.settings?.monthlyBudget || 4000;
    const budgetUsedPercent = Math.min(100, Math.round((currentMonthSpent / monthlyBudget) * 100));
    const budgetRemaining = Math.max(0, monthlyBudget - currentMonthSpent);

    // 5. Freelance Totals
    const freelanceJobs = state.freelanceJobs || [];
    let pendingFreelanceTotal = 0;
    let receivedFreelanceTotal = 0;
    freelanceJobs.forEach((job) => {
      pendingFreelanceTotal += Number(job.pendingAmount) || 0;
      receivedFreelanceTotal += Number(job.paidAmount) || 0;
    });

    // 6. Family Balances (Deterministic calculations per contact)
    const {
      contactBalances,
      totalFamilyExpenses,
      totalFamilyRepayments,
      totalFamilyOutstanding,
    } = calculateFamilyBalances(transactions, contacts);

    // 7. Appa specific backwards-compatible balance
    const appaBalInfo = contactBalances['family-appa'] || {
      totalReimbursable: 0,
      totalRepaid: 0,
      outstandingBalance: 0,
      pendingCount: 0,
    };

    const totalAppaPaidByMe = appaBalInfo.totalReimbursable;
    const totalAppaRepaid = appaBalInfo.totalRepaid;
    const appaOwesMe = appaBalInfo.outstandingBalance;
    const totalPendingAppaItemsCount = appaBalInfo.pendingCount;

    // 8. Migration status check
    const { migratedCount, needsReviewCount } = migrateAppaTransactions(transactions, contacts);

    return {
      totalIncome,
      incomeCount,
      currentMonthSpent,
      availableBalance,
      monthlyBudget,
      budgetUsedPercent,
      budgetRemaining,
      daysRemainingInMonth,
      pendingFreelanceTotal,
      receivedFreelanceTotal,
      familyBalances: contactBalances,
      totalFamilyExpensesWaiting: totalFamilyExpenses,
      totalFamilyRepaid: totalFamilyRepayments,
      totalFamilyOutstanding,
      familyContacts: contacts,
      totalAppaPaidByMe,
      totalAppaRepaid,
      appaOwesMe,
      totalPendingAppaItemsCount,
      migrationStatus: { migratedCount, needsReviewCount },
    };
  }, [state.transactions, state.familyContacts, state.settings?.monthlyBudget]);

  // Add Transaction with verified Google Sheets persistence
  const addTransaction = async (txData: Omit<Transaction, 'id' | 'createdAt'>): Promise<AddTransactionResult> => {
    const amt = Number(txData.amount);
    if (!amt || amt <= 0) {
      return {
        success: false,
        error: 'Amount must be greater than zero.',
        previousBalance: 0,
        updatedBalance: 0,
      };
    }

    // Determine target family contact
    let contactId = txData.familyContactId;
    let contactName = txData.familyContactName;

    if (txData.isFamilyReimbursable && !contactId) {
      contactId = 'family-appa';
      contactName = 'Appa';
    } else if (txData.isAppaReimbursable && !contactId) {
      contactId = 'family-appa';
      contactName = 'Appa';
    }

    const contacts = state.familyContacts && state.familyContacts.length > 0
      ? state.familyContacts
      : DEFAULT_FAMILY_CONTACTS;

    if (contactId && !contactName) {
      const match = contacts.find((c) => c.id === contactId);
      if (match) contactName = match.name;
    }

    // Previous and updated balances for the affected contact
    const previousBalances = calculateFamilyBalances(state.transactions || [], contacts);
    const prevContactBal = contactId && previousBalances.contactBalances[contactId]
      ? previousBalances.contactBalances[contactId].outstandingBalance
      : previousBalances.contactBalances['family-appa']?.outstandingBalance || 0;

    let updatedContactBal = prevContactBal;
    if (txData.isFamilyReimbursable || txData.isAppaReimbursable) {
      updatedContactBal = prevContactBal + amt;
    } else if (txData.type === 'repayment') {
      updatedContactBal = Math.max(0, prevContactBal - amt);
    }

    const newTx: Transaction = {
      ...txData,
      id: 'tx-' + Date.now(),
      amount: amt,
      category: txData.type === 'repayment' ? 'Family' : txData.category,
      isAppaReimbursable: contactId === 'family-appa' && txData.type === 'expense' ? Boolean(txData.isFamilyReimbursable || txData.isAppaReimbursable) : false,
      appaSettled: txData.type === 'repayment' ? true : Boolean(txData.appaSettled),
      isFamilyReimbursable: Boolean(txData.isFamilyReimbursable),
      familyContactId: contactId,
      familyContactName: contactName,
      settlementStatus: txData.type === 'repayment' ? 'settled' : (txData.settlementStatus || 'pending'),
      createdAt: new Date().toISOString(),
    };

    // Update local React state immediately (optimistic UI)
    setState((prev) => ({
      ...prev,
      transactions: [newTx, ...prev.transactions],
    }));

    // Persist to Google Sheets / Backend
    const envDefaults = getEffectiveEnvSettings();
    const scriptUrl = (state.settings?.googleAppsScriptUrl || envDefaults.googleAppsScriptUrl || '').trim();

    let remotePersisted = false;
    let remoteError: string | null = null;
    let remotePrevBal = prevContactBal;
    let remoteUpdatedBal = updatedContactBal;

    // 1. Try serverless backend proxy (/api/transactions)
    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTx),
      });

      const cType = res.headers.get('content-type') || '';
      if (res.ok && cType.includes('application/json')) {
        const json = await res.json();
        if (json.success) {
          remotePersisted = true;
          if (json.previousBalance !== undefined) remotePrevBal = json.previousBalance;
          if (json.updatedBalance !== undefined) remoteUpdatedBal = json.updatedBalance;
        } else {
          remoteError = json.error || 'Server rejected transaction save.';
        }
      }
    } catch {
      // Backend proxy not reachable
    }

    // 2. If backend proxy was not used or failed and direct scriptUrl is configured
    if (!remotePersisted && scriptUrl) {
      try {
        const res = await fetch(scriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'add_transaction',
            transaction: newTx,
          }),
        });

        if (res.ok) {
          const json = await res.json();
          if (json.success) {
            remotePersisted = true;
            if (json.previousBalance !== undefined) remotePrevBal = json.previousBalance;
            if (json.updatedBalance !== undefined) remoteUpdatedBal = json.updatedBalance;
          } else {
            remoteError = json.error || 'Google Apps Script reported an error saving transaction.';
          }
        }
      } catch (directErr: any) {
        console.warn('Direct Google Apps Script save notice:', directErr.message);
      }
    }

    if (remoteError) {
      setSyncError(remoteError);
    }

    return {
      success: true,
      transaction: newTx,
      previousBalance: remotePrevBal,
      updatedBalance: remoteUpdatedBal,
      contactId,
      contactName,
      previousAppaBalance: remotePrevBal,
      updatedAppaBalance: remoteUpdatedBal,
    };
  };

  const updateTransaction = async (tx: Transaction) => {
    setState((prev) => ({
      ...prev,
      transactions: prev.transactions.map((t) => (t.id === tx.id ? tx : t)),
    }));

    try {
      await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tx),
      });
    } catch {}

    const scriptUrl = (state.settings?.googleAppsScriptUrl || getEffectiveEnvSettings().googleAppsScriptUrl || '').trim();
    if (scriptUrl) {
      try {
        fetch(scriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'add_transaction',
            transaction: tx,
          }),
        }).catch(() => {});
      } catch {}
    }
    return true;
  };

  const deleteTransaction = async (id: string): Promise<boolean> => {
    const existingTx = state.transactions.find((t) => t.id === id);
    if (!existingTx) return false;

    const envDefaults = getEffectiveEnvSettings();
    const scriptUrl = (state.settings?.googleAppsScriptUrl || envDefaults.googleAppsScriptUrl || '').trim();

    // 1. If transaction was only created offline and never synced, remove it immediately
    if (existingTx.isPendingSync) {
      setState((prev) => ({
        ...prev,
        transactions: prev.transactions.filter((t) => t.id !== id),
      }));
      return true;
    }

    // 2. Verified backend deletion
    let deletionVerified = false;
    let failureReason = '';

    // Direct Google Apps Script dispatch
    if (scriptUrl) {
      try {
        const res = await fetch(scriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'delete_transaction',
            transactionId: id,
          }),
        });

        if (res.ok) {
          const json = await res.json().catch(() => null);
          if (json && (json.success || json.notFound)) {
            deletionVerified = true;
          } else if (json && json.error) {
            failureReason = json.error;
          }
        }
      } catch (err: any) {
        console.warn('Direct Apps Script deletion notice:', err.message);
      }
    }

    // Proxy API (/api/transactions)
    if (!deletionVerified) {
      try {
        const proxyRes = await fetch(`/api/transactions?id=${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'delete_transaction',
            transactionId: id,
            googleAppsScriptUrl: scriptUrl,
          }),
        });

        if (proxyRes.ok) {
          const pJson = await proxyRes.json().catch(() => null);
          if (pJson && (pJson.success || pJson.notFound)) {
            deletionVerified = true;
          } else if (pJson && pJson.error) {
            failureReason = pJson.error;
          }
        }
      } catch (pErr: any) {
        console.warn('Proxy deletion notice:', pErr.message);
      }
    }

    // If Google Sheets is not configured, allow local deletion
    if (!scriptUrl) {
      deletionVerified = true;
    }

    // If verified, remove from React state
    if (deletionVerified) {
      setState((prev) => ({
        ...prev,
        transactions: prev.transactions.filter((t) => t.id !== id),
      }));
      return true;
    }

    // If offline, mark as pending deletion for later synchronization
    if (!navigator.onLine) {
      setState((prev) => ({
        ...prev,
        transactions: prev.transactions.map((t) => (t.id === id ? { ...t, isPendingDeletion: true } : t)),
      }));
      return true;
    }

    throw new Error(failureReason || 'Failed to delete transaction from Google Sheets. Record preserved.');
  };

  // Record full or partial repayment specifically allocated to a family contact
  const recordFamilyRepayment = async (
    contactId: string,
    amount: number,
    paymentMethod: PaymentMethod = 'upi',
    note?: string
  ): Promise<AddTransactionResult> => {
    const contacts = state.familyContacts && state.familyContacts.length > 0
      ? state.familyContacts
      : DEFAULT_FAMILY_CONTACTS;

    const contact = contacts.find((c) => c.id === contactId) || {
      id: contactId,
      name: 'Family Member',
      active: true,
    };

    const methodLabel = paymentMethod === 'cash' ? 'Cash' : 'UPI';
    const title = `${methodLabel} from ${contact.name}`;

    return addTransaction({
      type: 'repayment',
      title,
      amount,
      category: 'Family',
      date: new Date().toISOString().split('T')[0],
      paymentMethod,
      isAppaReimbursable: contactId === 'family-appa',
      appaSettled: true,
      isFamilyReimbursable: false,
      familyContactId: contactId,
      familyContactName: contact.name,
      settlementStatus: 'settled',
      notes: note || `Repayment received from ${contact.name}`,
    });
  };

  // Family Contacts Management
  const addFamilyContact = async (name: string, phoneNumber?: string): Promise<FamilyContact> => {
    const newContact: FamilyContact = {
      id: 'family-' + Date.now(),
      name: name.trim(),
      phoneNumber: phoneNumber?.trim() || '',
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updatedContacts = [...(state.familyContacts || DEFAULT_FAMILY_CONTACTS), newContact];

    setState((prev) => ({
      ...prev,
      familyContacts: updatedContacts,
      settings: {
        ...prev.settings,
        familyContacts: updatedContacts,
      },
    }));

    try {
      await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newContact),
      });
    } catch {}

    return newContact;
  };

  const updateFamilyContact = async (contact: FamilyContact): Promise<boolean> => {
    const contacts = state.familyContacts || DEFAULT_FAMILY_CONTACTS;
    const updatedContacts = contacts.map((c) => (c.id === contact.id ? { ...contact, updatedAt: new Date().toISOString() } : c));

    setState((prev) => ({
      ...prev,
      familyContacts: updatedContacts,
      settings: {
        ...prev.settings,
        familyContacts: updatedContacts,
      },
    }));

    try {
      await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contact),
      });
    } catch {}

    return true;
  };

  const deactivateFamilyContact = async (id: string): Promise<boolean> => {
    const contacts = state.familyContacts || DEFAULT_FAMILY_CONTACTS;
    const updatedContacts = contacts.map((c) => (c.id === id ? { ...c, active: false, updatedAt: new Date().toISOString() } : c));

    setState((prev) => ({
      ...prev,
      familyContacts: updatedContacts,
      settings: {
        ...prev.settings,
        familyContacts: updatedContacts,
      },
    }));
    return true;
  };

  // Freelance Actions
  const addFreelanceJob = async (jobData: Omit<FreelanceJob, 'id' | 'createdAt'>) => {
    const newJob: FreelanceJob = {
      ...jobData,
      id: 'job-' + Date.now(),
      createdAt: new Date().toISOString(),
    };

    setState((prev) => ({
      ...prev,
      freelanceJobs: [newJob, ...prev.freelanceJobs],
    }));

    try {
      await fetch('/api/freelance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newJob),
      });
    } catch {}
    return true;
  };

  const updateFreelanceJob = async (job: FreelanceJob) => {
    const pendingAmount = Math.max(0, job.totalFee - job.paidAmount);
    const status = pendingAmount === 0 ? 'completed' : (job.paidAmount > 0 ? 'in_progress' : job.status || 'in_progress');
    const recalculatedJob = { ...job, pendingAmount, status };

    setState((prev) => ({
      ...prev,
      freelanceJobs: prev.freelanceJobs.map((j) => (j.id === job.id ? recalculatedJob : j)),
    }));

    try {
      await fetch('/api/freelance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(recalculatedJob),
      });
    } catch {}
    return true;
  };

  const recordCustomFreelancePayment = async (
    jobId: string,
    amount: number,
    paymentMethod: PaymentMethod = 'upi',
    note?: string,
    milestoneId?: string
  ) => {
    const job = state.freelanceJobs.find((j) => j.id === jobId);
    if (!job) return false;

    let updatedMilestones = [...job.milestones];
    let milestoneTitle = '';

    if (milestoneId) {
      const milestone = job.milestones.find((m) => m.id === milestoneId);
      if (milestone) {
        milestoneTitle = milestone.title;
        updatedMilestones = job.milestones.map((m) =>
          m.id === milestoneId ? { ...m, paid: true, paidAt: new Date().toISOString().split('T')[0] } : m
        );
      }
    }

    const paidAmount = job.paidAmount + amount;
    const pendingAmount = Math.max(0, job.totalFee - paidAmount);
    const status = pendingAmount === 0 ? 'completed' : 'in_progress';

    const updatedJob: FreelanceJob = {
      ...job,
      paidAmount,
      pendingAmount,
      status,
      milestones: updatedMilestones,
    };

    const newTx: Transaction = {
      id: 'tx-' + Date.now(),
      type: 'income',
      title: milestoneTitle ? `${job.title} - ${milestoneTitle}` : `${job.title} - Payment`,
      amount,
      category: 'Freelance',
      date: new Date().toISOString().split('T')[0],
      paymentMethod,
      isAppaReimbursable: false,
      isFamilyReimbursable: false,
      appaSettled: false,
      freelanceJobId: job.id,
      milestoneTitle: milestoneTitle || 'Custom Payment',
      notes: note || `Payment received from ${job.clientName}`,
      createdAt: new Date().toISOString(),
    };

    setState((prev) => ({
      ...prev,
      freelanceJobs: prev.freelanceJobs.map((j) => (j.id === jobId ? updatedJob : j)),
      transactions: [newTx, ...prev.transactions],
    }));

    try {
      await Promise.all([
        fetch('/api/freelance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedJob),
        }),
        fetch('/api/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newTx),
        }),
      ]);
    } catch {}
    return true;
  };

  const recordMilestonePayment = async (jobId: string, milestoneId: string) => {
    const job = state.freelanceJobs.find((j) => j.id === jobId);
    if (!job) return false;

    const milestone = job.milestones.find((m) => m.id === milestoneId);
    if (!milestone || milestone.paid) return false;

    return recordCustomFreelancePayment(jobId, milestone.amount, 'upi', undefined, milestoneId);
  };

  const deleteFreelanceJob = async (id: string) => {
    setState((prev) => ({
      ...prev,
      freelanceJobs: prev.freelanceJobs.filter((j) => j.id !== id),
    }));

    try {
      await fetch(`/api/freelance?id=${id}`, { method: 'DELETE' });
    } catch {}
    return true;
  };

  // Savings Actions
  const updateEmergencyFund = async (current: number, target: number) => {
    const updated = {
      ...state.savings,
      emergencyFund: {
        ...state.savings.emergencyFund,
        current,
        target,
      },
    };

    setState((prev) => ({ ...prev, savings: updated }));

    try {
      await fetch('/api/savings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
    } catch {}
    return true;
  };

  const addSavingsGoal = async (goal: {
    title: string;
    target: number;
    current: number;
    icon: string;
    deadline?: string;
  }) => {
    const newGoal = {
      ...goal,
      id: 'goal-' + Date.now(),
    };

    const updated = {
      ...state.savings,
      goals: [...state.savings.goals, newGoal],
    };

    setState((prev) => ({ ...prev, savings: updated }));

    try {
      await fetch('/api/savings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
    } catch {}
    return true;
  };

  const updateSavingsGoal = async (goal: any) => {
    const updated = {
      ...state.savings,
      goals: state.savings.goals.map((g) => (g.id === goal.id ? goal : g)),
    };

    setState((prev) => ({ ...prev, savings: updated }));

    try {
      await fetch('/api/savings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
    } catch {}
    return true;
  };

  const deleteSavingsGoal = async (id: string) => {
    const updated = {
      ...state.savings,
      goals: state.savings.goals.filter((g) => g.id !== id),
    };

    setState((prev) => ({ ...prev, savings: updated }));

    try {
      await fetch('/api/savings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
    } catch {}
    return true;
  };

  const updateSettings = async (settingsUpdate: Partial<AppSettings>) => {
    const updated = {
      ...state.settings,
      ...settingsUpdate,
    };

    setState((prev) => ({ ...prev, settings: updated }));

    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
    } catch {}
    return true;
  };

  // Refresh from Google Sheets (Pull Latest Records)
  const refreshFromGoogleSheets = async () => {
    const envDefaults = getEffectiveEnvSettings();
    const targetUrl = (state.settings?.googleAppsScriptUrl || envDefaults.googleAppsScriptUrl || '').trim();

    if (!targetUrl) {
      return {
        success: false,
        message: 'Google Apps Script URL is not configured. Please paste your Web App URL in Sync settings.',
      };
    }

    setIsSyncing(true);
    setSyncError(null);

    try {
      const fetchUrl = `${targetUrl}${targetUrl.includes('?') ? '&' : '?'}action=get_all_data`;
      const res = await fetch(fetchUrl, { method: 'GET', mode: 'cors' });

      if (!res.ok) {
        throw new Error(`Google Apps Script returned status ${res.status}`);
      }

      const json = await res.json();
      if (!json.success || !Array.isArray(json.transactions)) {
        throw new Error(json.error || 'Failed to parse transactions from Google Sheets');
      }

      const remoteContacts = json.familyContacts && json.familyContacts.length > 0
        ? json.familyContacts
        : (state.familyContacts && state.familyContacts.length > 0 ? state.familyContacts : DEFAULT_FAMILY_CONTACTS);

      const { migratedTransactions } = migrateAppaTransactions(json.transactions, remoteContacts);
      const reconciled = reconcileRemoteTransactions(migratedTransactions, state.transactions);

      const syncedAt = new Date().toISOString();
      const updatedSettings = {
        ...state.settings,
        lastSyncedAt: syncedAt,
        syncEnabled: true,
      };

      setState((prev) => ({
        ...prev,
        transactions: reconciled,
        familyContacts: remoteContacts,
        settings: updatedSettings,
      }));

      setIsSyncing(false);
      return {
        success: true,
        message: `Successfully refreshed! ${reconciled.length} transactions loaded from Google Sheets.`,
        count: reconciled.length,
      };
    } catch (err: any) {
      setIsSyncing(false);
      setSyncError(err.message || 'Connection to Google Sheets failed.');
      return {
        success: false,
        message: `Refresh failed: ${err.message || 'Unable to fetch records. Local records preserved.'}`,
      };
    }
  };

  // Full Two-Way Synchronization (Flush Pending Offline Operations + Pull Authoritative Remote)
  const syncWithGoogleSheets = async (url?: string) => {
    const envDefaults = getEffectiveEnvSettings();
    let targetUrl = (url || state.settings?.googleAppsScriptUrl || envDefaults.googleAppsScriptUrl || '').trim();
    targetUrl = targetUrl.replace(/^["']|["']$/g, '').trim();

    if (!targetUrl) {
      return {
        success: false,
        message: 'Google Apps Script Web App URL is missing. Tap "Connect" to paste your Web App URL.',
      };
    }

    if (targetUrl.includes('docs.google.com/spreadsheets')) {
      return {
        success: false,
        message: 'This is a Google Sheet link, not a Web App URL! In your Sheet, click Extensions > Apps Script > Deploy > New deployment > Web app. Set "Who has access" to "Anyone", then copy the Web app URL ending in /exec.',
      };
    }

    if (targetUrl.endsWith('/edit') || targetUrl.includes('/edit#')) {
      return {
        success: false,
        message: 'This is the Apps Script editor URL (/edit). Please click Deploy > New deployment > Web app, and copy the Web App URL that ends in /exec.',
      };
    }

    setIsSyncing(true);
    setSyncError(null);

    // 1. Flush any pending offline deletions first
    const pendingDeletions = state.transactions.filter((t) => t.isPendingDeletion);
    for (const delTx of pendingDeletions) {
      try {
        await fetch(targetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'delete_transaction',
            transactionId: delTx.id,
          }),
        });
      } catch (e) {
        console.warn('Pending deletion flush notice:', e);
      }
    }

    // 2. Flush any pending offline creations
    const pendingCreations = state.transactions.filter((t) => t.isPendingSync && !t.isPendingDeletion);
    for (const addTx of pendingCreations) {
      try {
        await fetch(targetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'add_transaction',
            transaction: { ...addTx, isPendingSync: false },
          }),
        });
      } catch (e) {
        console.warn('Pending creation flush notice:', e);
      }
    }

    // 3. Sync family contacts, freelance jobs, savings to Google Sheets
    try {
      await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'sync_all',
          familyContacts: state.familyContacts || DEFAULT_FAMILY_CONTACTS,
          freelanceJobs: state.freelanceJobs,
          savings: state.savings,
          settings: {
            ...state.settings,
            googleAppsScriptUrl: targetUrl,
          },
        }),
      });
    } catch {}

    // 4. Now pull the authoritative remote snapshot from Google Sheets
    const refreshResult = await refreshFromGoogleSheets();
    setIsSyncing(false);
    return refreshResult;
  };

  const resetToSampleData = async () => {
    try {
      const res = await fetch('/api/reset-data', { method: 'POST' });
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          setState(json.data);
          return true;
        }
      }
    } catch {}
    setState(defaultInitialState);
    return true;
  };

  const clearDemoData = async (wipeRemoteSheet: boolean = true) => {
    const envDefaults = getEffectiveEnvSettings();
    const currentScriptUrl = (state.settings?.googleAppsScriptUrl || envDefaults.googleAppsScriptUrl || '').trim();

    const emptyState: AppState = {
      transactions: [],
      familyContacts: state.familyContacts || DEFAULT_FAMILY_CONTACTS,
      freelanceJobs: [],
      savings: {
        emergencyFund: {
          current: 0,
          target: 3000,
          title: 'Emergency Fund',
          subtitle: 'Target: 1 Month Living Buffer',
        },
        goals: [],
      },
      settings: {
        ...state.settings,
        googleAppsScriptUrl: currentScriptUrl,
        lastSyncedAt: null,
      },
    };

    setState(emptyState);

    try {
      localStorage.setItem('my_money_app_state', JSON.stringify(emptyState));
    } catch {}

    try {
      await fetch('/api/clear-data', { method: 'POST' });
    } catch {}

    // Explicit remote wipe command only
    if (wipeRemoteSheet && currentScriptUrl) {
      try {
        await fetch(currentScriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'clear_data',
            timestamp: new Date().toISOString(),
          }),
        });
      } catch (err) {
        console.warn('Google Sheet remote wipe notice:', err);
      }
    }

    return true;
  };

  const isDemoDataLoaded = useMemo(() => {
    const txs = state.transactions || [];
    return txs.some(
      (t) =>
        t.id === 'tx-1' ||
        t.id === 'tx-2' ||
        t.title === 'Metro Recharge' ||
        t.title === 'Bus Pass (Appa)'
    );
  }, [state.transactions]);

  return (
    <AppContext.Provider
      value={{
        state,
        loading,
        error,
        syncError,
        isSyncing,
        ...calculations,
        addTransaction,
        updateTransaction,
        deleteTransaction,
        recordFamilyRepayment,
        addFamilyContact,
        updateFamilyContact,
        deactivateFamilyContact,
        addFreelanceJob,
        updateFreelanceJob,
        deleteFreelanceJob,
        recordMilestonePayment,
        recordCustomFreelancePayment,
        updateEmergencyFund,
        addSavingsGoal,
        updateSavingsGoal,
        deleteSavingsGoal,
        updateSettings,
        refreshFromGoogleSheets,
        syncWithGoogleSheets,
        resetToSampleData,
        clearDemoData,
        isDemoDataLoaded,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
