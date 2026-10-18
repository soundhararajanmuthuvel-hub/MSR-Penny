import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { Transaction, FreelanceJob, SavingsState, AppSettings, AppState, PaymentMethod } from '../types';
import { initialSeedData } from '../data/initialData';

interface AppContextType {
  state: AppState;
  loading: boolean;
  error: string | null;
  // Computed Financial Metrics
  totalIncome: number;
  incomeCount: number;
  currentMonthSpent: number;
  totalAppaPaidByMe: number;
  totalAppaRepaid: number;
  appaOwesMe: number;
  availableBalance: number;
  monthlyBudget: number;
  budgetUsedPercent: number;
  budgetRemaining: number;
  daysRemainingInMonth: number;
  pendingFreelanceTotal: number;
  receivedFreelanceTotal: number;
  totalPendingAppaItemsCount: number;
  // Actions
  addTransaction: (tx: Omit<Transaction, 'id' | 'createdAt'>) => Promise<{
    success: boolean;
    error?: string;
    previousBalance: number;
    updatedBalance: number;
    transaction?: Transaction;
  }>;
  updateTransaction: (tx: Transaction) => Promise<boolean>;
  deleteTransaction: (id: string) => Promise<boolean>;
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
  updateEmergencyFund: (current: number, target: number) => Promise<boolean>;
  addSavingsGoal: (goal: { title: string; target: number; current: number; icon: string; deadline?: string }) => Promise<boolean>;
  updateSavingsGoal: (goal: any) => Promise<boolean>;
  deleteSavingsGoal: (id: string) => Promise<boolean>;
  updateSettings: (settings: Partial<AppSettings>) => Promise<boolean>;
  syncWithGoogleSheets: (url?: string) => Promise<{ success: boolean; message: string }>;
  resetToSampleData: () => Promise<boolean>;
}

const defaultInitialState: AppState = initialSeedData;

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AppState>(() => {
    const cached = localStorage.getItem('my_money_app_state');
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        return defaultInitialState;
      }
    }
    return defaultInitialState;
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sync state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('my_money_app_state', JSON.stringify(state));
  }, [state]);

  // Fetch initial state from Express backend
  const fetchState = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/state');
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setState(json.data);
          setError(null);
        }
      }
    } catch (err: any) {
      console.warn('Backend not available yet, using local state cache:', err);
      // Fallback to local cache is already set
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchState();
  }, []);

  // Financial Calculations
  const calculations = useMemo(() => {
    const transactions = state.transactions || [];
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

    // 1. Total Income (Inflows) for current month
    const incomeTxs = currentMonthTxs.filter((t) => t.type === 'income');
    const totalIncome = incomeTxs.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const incomeCount = incomeTxs.length;

    // 2. Personal Spent (current month) - excludes Appa reimbursable expenses!
    const personalExpenses = currentMonthTxs.filter(
      (t) => t.type === 'expense' && !t.isAppaReimbursable
    );
    const currentMonthSpent = personalExpenses.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    // 3. Appa Settlements (All Time Ledger for family accountability)
    // All expenses flagged as "Appa will pay me back"
    const appaExpenses = transactions.filter((t) => t.isAppaReimbursable);
    const totalAppaPaidByMe = appaExpenses.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    // All repayments received from Appa (strictly NOT counted as income)
    const appaRepayments = transactions.filter((t) => t.type === 'repayment');
    const totalAppaRepaid = appaRepayments.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    // Outstanding amount Appa owes me
    const appaOwesMe = Math.max(0, totalAppaPaidByMe - totalAppaRepaid);
    const pendingAppaExpenses = appaExpenses.filter((t) => !t.appaSettled);
    const totalPendingAppaItemsCount = pendingAppaExpenses.length;

    // 4. Available Balance
    // Available Balance = Income minus Personal Spent
    // (If personal spent is 1250 and income is 4500 -> 3250)
    const availableBalance = Math.max(0, totalIncome - currentMonthSpent);

    // 5. Budget Progress
    const monthlyBudget = state.settings.monthlyBudget || 4000;
    const budgetUsedPercent = Math.min(100, Math.round((currentMonthSpent / monthlyBudget) * 100));
    const budgetRemaining = Math.max(0, monthlyBudget - currentMonthSpent);

    // 6. Freelance Totals
    const freelanceJobs = state.freelanceJobs || [];
    let pendingFreelanceTotal = 0;
    let receivedFreelanceTotal = 0;

    freelanceJobs.forEach((job) => {
      pendingFreelanceTotal += Number(job.pendingAmount) || 0;
      receivedFreelanceTotal += Number(job.paidAmount) || 0;
    });

    return {
      totalIncome,
      incomeCount,
      currentMonthSpent,
      totalAppaPaidByMe,
      totalAppaRepaid,
      appaOwesMe,
      availableBalance,
      monthlyBudget,
      budgetUsedPercent,
      budgetRemaining,
      daysRemainingInMonth,
      pendingFreelanceTotal,
      receivedFreelanceTotal,
      totalPendingAppaItemsCount,
    };
  }, [state]);

  // Actions
  const addTransaction = async (txData: Omit<Transaction, 'id' | 'createdAt'>) => {
    // Current Appa balance before adding
    const eligibleExpenses = (state.transactions || []).filter((t) => t.isAppaReimbursable);
    const totalPaidByMe = eligibleExpenses.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const repayments = (state.transactions || []).filter((t) => t.type === 'repayment');
    const totalRepaid = repayments.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const previousBalance = Math.max(0, totalPaidByMe - totalRepaid);

    let updatedBalance = previousBalance;
    if (txData.isAppaReimbursable) {
      updatedBalance = previousBalance + Number(txData.amount);
    } else if (txData.type === 'repayment') {
      updatedBalance = Math.max(0, previousBalance - Number(txData.amount));
    }

    if (!txData.amount || Number(txData.amount) <= 0) {
      return {
        success: false,
        error: 'Amount must be greater than zero.',
        previousBalance,
        updatedBalance,
      };
    }

    const newTx: Transaction = {
      ...txData,
      id: 'tx-' + Date.now(),
      createdAt: new Date().toISOString(),
    };

    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTx),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        return {
          success: false,
          error: errJson.error || 'Server rejected transaction save.',
          previousBalance,
          updatedBalance,
        };
      }

      const json = await res.json();
      if (json.data) {
        setState(json.data);
      } else {
        setState((prev) => ({
          ...prev,
          transactions: [newTx, ...prev.transactions],
        }));
      }

      return {
        success: true,
        transaction: json.transaction || newTx,
        previousBalance: json.previousAppaBalance !== undefined ? json.previousAppaBalance : previousBalance,
        updatedBalance: json.updatedAppaBalance !== undefined ? json.updatedAppaBalance : updatedBalance,
      };
    } catch (err: any) {
      console.warn('Backend save error, updating local state:', err);
      setState((prev) => ({
        ...prev,
        transactions: [newTx, ...prev.transactions],
      }));
      return {
        success: true,
        transaction: newTx,
        previousBalance,
        updatedBalance,
      };
    }
  };

  const updateTransaction = async (tx: Transaction) => {
    setState((prev) => ({
      ...prev,
      transactions: prev.transactions.map((t) => (t.id === tx.id ? tx : t)),
    }));

    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tx),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.data) setState(json.data);
      }
      return true;
    } catch {
      return true;
    }
  };

  const deleteTransaction = async (id: string) => {
    setState((prev) => ({
      ...prev,
      transactions: prev.transactions.filter((t) => t.id !== id),
    }));

    try {
      const res = await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
      if (res.ok) {
        const json = await res.json();
        if (json.data) setState(json.data);
      }
      return true;
    } catch {
      return true;
    }
  };

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
      const res = await fetch('/api/freelance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newJob),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.data) setState(json.data);
      }
      return true;
    } catch {
      return true;
    }
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
      const res = await fetch('/api/freelance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(recalculatedJob),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.data) setState(json.data);
      }
      return true;
    } catch {
      return true;
    }
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
      return true;
    } catch {
      return true;
    }
  };

  const deleteFreelanceJob = async (id: string) => {
    setState((prev) => ({
      ...prev,
      freelanceJobs: prev.freelanceJobs.filter((j) => j.id !== id),
    }));

    try {
      const res = await fetch(`/api/freelance/${id}`, { method: 'DELETE' });
      if (res.ok) {
        const json = await res.json();
        if (json.data) setState(json.data);
      }
      return true;
    } catch {
      return true;
    }
  };

  const recordMilestonePayment = async (jobId: string, milestoneId: string) => {
    const job = state.freelanceJobs.find((j) => j.id === jobId);
    if (!job) return false;

    const milestone = job.milestones.find((m) => m.id === milestoneId);
    if (!milestone || milestone.paid) return false;

    const updatedMilestones = job.milestones.map((m) =>
      m.id === milestoneId ? { ...m, paid: true, paidAt: new Date().toISOString().split('T')[0] } : m
    );

    const paidAmount = job.paidAmount + milestone.amount;
    const pendingAmount = Math.max(0, job.totalFee - paidAmount);
    const status = pendingAmount === 0 ? 'completed' : 'in_progress';

    const updatedJob: FreelanceJob = {
      ...job,
      paidAmount,
      pendingAmount,
      status,
      milestones: updatedMilestones,
    };

    // Also automatically create an Income transaction
    const newTx: Transaction = {
      id: 'tx-' + Date.now(),
      type: 'income',
      title: `${job.title} - ${milestone.title}`,
      amount: milestone.amount,
      category: 'Freelance',
      date: new Date().toISOString().split('T')[0],
      paymentMethod: 'upi',
      isAppaReimbursable: false,
      appaSettled: false,
      freelanceJobId: job.id,
      milestoneTitle: milestone.title,
      notes: `Milestone payment from ${job.clientName}`,
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
      return true;
    } catch {
      return true;
    }
  };

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
      return true;
    } catch {
      return true;
    }
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
      return true;
    } catch {
      return true;
    }
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
      return true;
    } catch {
      return true;
    }
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
      return true;
    } catch {
      return true;
    }
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
      return true;
    } catch {
      return true;
    }
  };

  const syncWithGoogleSheets = async (url?: string) => {
    const targetUrl = url || state.settings.googleAppsScriptUrl;
    if (!targetUrl) {
      return { success: false, message: 'Please provide a Google Apps Script Webhook URL in Settings.' };
    }

    try {
      const res = await fetch('/api/sync/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          const syncedAt = json.syncedAt || new Date().toISOString();
          setState((prev) => ({
            ...prev,
            settings: { ...prev.settings, lastSyncedAt: syncedAt, syncEnabled: true },
          }));
          return { success: true, message: 'Dual-sync completed successfully to Google Sheets!' };
        } else {
          return { success: false, message: json.error || 'Failed to sync with Google Apps Script.' };
        }
      }
      throw new Error(`Backend returned status ${res.status}`);
    } catch (err: any) {
      // Direct client-side push fallback for frontend-only / Vercel deployments
      try {
        const payload = {
          action: 'sync_all',
          timestamp: new Date().toISOString(),
          transactions: state.transactions,
          freelanceJobs: state.freelanceJobs,
          savings: state.savings,
          settings: state.settings,
        };

        // Standard Apps Script web app endpoint accepts POST with no-cors or JSON
        await fetch(targetUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify(payload),
        });

        const syncedAt = new Date().toISOString();
        setState((prev) => ({
          ...prev,
          settings: { ...prev.settings, lastSyncedAt: syncedAt, syncEnabled: true },
        }));
        return { success: true, message: 'Dual-sync payload dispatched to Google Sheets!' };
      } catch (clientErr: any) {
        return { success: false, message: clientErr.message || 'Network error while attempting sync.' };
      }
    }
  };

  const resetToSampleData = async () => {
    try {
      const res = await fetch('/api/reset-data', { method: 'POST' });
      if (res.ok) {
        const json = await res.json();
        if (json.data) setState(json.data);
        return true;
      }
    } catch {
      setState(defaultInitialState);
    }
    return true;
  };

  return (
    <AppContext.Provider
      value={{
        state,
        loading,
        error,
        ...calculations,
        addTransaction,
        updateTransaction,
        deleteTransaction,
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
        syncWithGoogleSheets,
        resetToSampleData,
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
