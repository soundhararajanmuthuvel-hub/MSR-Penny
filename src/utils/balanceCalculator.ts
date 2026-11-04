import {
  Account,
  Transfer,
  Transaction,
  FamilyContact,
  FreelanceJob,
  SettledArchiveItem,
  ReconciliationAdjustment,
} from '../types';

export const DEFAULT_ACCOUNTS: Account[] = [
  {
    id: 'acc-sbi',
    name: 'SBI (Main)',
    type: 'bank',
    openingBalance: 0,
    openingDate: '2026-10-01',
    active: true,
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  },
  {
    id: 'acc-iob',
    name: 'IOB (Second)',
    type: 'bank',
    openingBalance: 0,
    openingDate: '2026-10-01',
    active: true,
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  },
  {
    id: 'acc-cash',
    name: 'Cash',
    type: 'cash',
    openingBalance: 0,
    openingDate: '2026-10-01',
    active: true,
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  },
];

export interface AccountBalanceDetail {
  account: Account;
  balance: number;
  openingBalance: number;
  totalIncome: number;
  totalExpenses: number;
  totalRepaymentsIn: number;
  totalTransfersIn: number;
  totalTransfersOut: number;
  totalReconciliationAdjustments: number;
}

export interface FamilyReceivableDetail {
  contactId: string;
  contactName: string;
  totalPaidForThem: number;
  totalRepaidByThem: number;
  outstandingBalance: number;
}

export interface FinancialOverview {
  // Accounts
  accountBalances: Record<string, AccountBalanceDetail>;
  sbiBalance: number;
  iobBalance: number;
  cashBalance: number;
  totalAvailableMoney: number;

  // Family settlements
  familyReceivables: Record<string, FamilyReceivableDetail>;
  totalReceivable: number;

  // Overall worth
  overallWorth: number;

  // Income & Expenses
  totalIncomeReceived: number;
  totalExpensesPaid: number;
  freelanceReceivedTotal: number;
  freelancePendingTotal: number;

  // Audit / Migration tracking
  unassignedTransactionsCount: number;
  unassignedTransactionsAmount: number;
  datedBeforeOpeningWarnings: number;
}

export interface CalculateBalancesParams {
  accounts?: Account[];
  transactions?: Transaction[];
  transfers?: Transfer[];
  familyContacts?: FamilyContact[];
  freelanceJobs?: FreelanceJob[];
  settledArchive?: SettledArchiveItem[];
  reconciliations?: ReconciliationAdjustment[];
}

/**
 * Normalizes date string into comparable timestamp or ISO date.
 */
function toDateTimestamp(dateStr?: string): number {
  if (!dateStr) return 0;
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])).getTime();
  }
  return new Date(dateStr).getTime();
}

/**
 * Checks if a transaction date falls strictly before the opening balance date.
 */
export function isBeforeOpeningDate(txDate: string, openingDate?: string): boolean {
  if (!openingDate || !txDate) return false;
  return toDateTimestamp(txDate) < toDateTimestamp(openingDate);
}

/**
 * Pure, deterministic calculation function for MSR Penny v3.
 * Strictly adheres to Section 4.3 balance formulas:
 *
 * Account Balance =
 *   Opening Balance
 *   + Income received into this account
 *   + Family repayments received into this account (active + archived)
 *   + Transfers IN
 *   - Expenses paid from this account (personal AND family-paid, active + archived)
 *   - Transfers OUT
 *   (+/- explicit reconciliation adjustments)
 *
 * Total Available Money = SBI + IOB + Cash
 * Total Receivable = sum of family outstanding amounts (unsettled)
 * Overall Worth = Total Available Money + Total Receivable
 *
 * Safety Invariant:
 * Archived items remain 100% counted in account balances so archiving settled items
 * NEVER changes account balances or overall worth!
 */
export function calculateFinancialOverview(params: CalculateBalancesParams): FinancialOverview {
  const accounts = params.accounts && params.accounts.length > 0 ? params.accounts : DEFAULT_ACCOUNTS;
  const rawTransactions = params.transactions || [];
  const transfers = params.transfers || [];
  const familyContacts = params.familyContacts || [];
  const freelanceJobs = params.freelanceJobs || [];
  const settledArchive = params.settledArchive || [];
  const reconciliations = params.reconciliations || [];

  // Convert settled archive items into transaction representation for balance calculation
  const archiveAsTxs: Transaction[] = settledArchive.map((arch) => ({
    id: arch.originalTransactionId || arch.id,
    date: arch.date,
    title: arch.title,
    type: arch.type,
    amount: arch.amount,
    category: arch.category as any,
    paymentMethod: arch.paymentMethod,
    accountId: arch.accountId,
    accountName: arch.accountName,
    familyContactId: arch.familyContactId,
    familyContactName: arch.familyContactName,
    isFamilyReimbursable: true,
    isAppaReimbursable: arch.familyContactId === 'family-appa',
    appaSettled: true,
    settlementStatus: 'settled',
    archived: true,
    createdAt: arch.archivedAt,
  }));

  // Deduplicate: If an item exists in both transactions and archive, keep only one
  const seenTxIds = new Set<string>();
  const allTransactions: Transaction[] = [];

  rawTransactions.forEach((t) => {
    if (!t.deleted && !seenTxIds.has(t.id)) {
      seenTxIds.add(t.id);
      allTransactions.push(t);
    }
  });

  archiveAsTxs.forEach((t) => {
    if (!seenTxIds.has(t.id)) {
      seenTxIds.add(t.id);
      allTransactions.push(t);
    }
  });

  // 1. Initialize Account Balances map
  const accountBalances: Record<string, AccountBalanceDetail> = {};
  accounts.forEach((acc) => {
    accountBalances[acc.id] = {
      account: acc,
      balance: Number(acc.openingBalance) || 0,
      openingBalance: Number(acc.openingBalance) || 0,
      totalIncome: 0,
      totalExpenses: 0,
      totalRepaymentsIn: 0,
      totalTransfersIn: 0,
      totalTransfersOut: 0,
      totalReconciliationAdjustments: 0,
    };
  });

  // 2. Initialize Family Receivables map
  const familyReceivables: Record<string, FamilyReceivableDetail> = {};
  familyContacts.forEach((contact) => {
    familyReceivables[contact.id] = {
      contactId: contact.id,
      contactName: contact.name,
      totalPaidForThem: 0,
      totalRepaidByThem: 0,
      outstandingBalance: 0,
    };
  });

  let totalIncomeReceived = 0;
  let totalExpensesPaid = 0;
  let unassignedTransactionsCount = 0;
  let unassignedTransactionsAmount = 0;
  let datedBeforeOpeningWarnings = 0;

  // 3. Process Transactions chronologically
  allTransactions.forEach((tx) => {
    const amt = Number(tx.amount) || 0;
    if (amt <= 0) return;

    // Resolve Account ID
    let targetAccId = tx.accountId;
    if (!targetAccId) {
      if (tx.paymentMethod === 'cash') {
        targetAccId = 'acc-cash';
      } else if (tx.paymentMethod === 'upi') {
        targetAccId = 'acc-sbi';
      } else {
        targetAccId = 'unassigned';
      }
    }

    if (targetAccId === 'unassigned' || !accountBalances[targetAccId]) {
      unassignedTransactionsCount++;
      unassignedTransactionsAmount += amt;
    }

    const accDetail = targetAccId && accountBalances[targetAccId] ? accountBalances[targetAccId] : null;

    // Check opening date warning
    if (accDetail && accDetail.account.openingDate) {
      if (isBeforeOpeningDate(tx.date, accDetail.account.openingDate)) {
        datedBeforeOpeningWarnings++;
        return;
      }
    }

    // Process by Transaction Type
    if (tx.type === 'income') {
      totalIncomeReceived += amt;
      if (accDetail) {
        accDetail.totalIncome += amt;
        accDetail.balance += amt;
      }
    } else if (tx.type === 'expense') {
      totalExpensesPaid += amt;
      if (accDetail) {
        accDetail.totalExpenses += amt;
        accDetail.balance -= amt;
      }

      // Family expense tracking: creates a receivable
      const isReimbursable = Boolean(tx.isFamilyReimbursable || tx.isAppaReimbursable);
      if (isReimbursable) {
        const contactId = tx.familyContactId || (tx.isAppaReimbursable ? 'family-appa' : '');
        if (contactId) {
          if (!familyReceivables[contactId]) {
            familyReceivables[contactId] = {
              contactId,
              contactName: tx.familyContactName || contactId,
              totalPaidForThem: 0,
              totalRepaidByThem: 0,
              outstandingBalance: 0,
            };
          }
          familyReceivables[contactId].totalPaidForThem += amt;
        }
      }
    } else if (tx.type === 'repayment') {
      // Repayment increases chosen account balance, NEVER income
      if (accDetail) {
        accDetail.totalRepaymentsIn += amt;
        accDetail.balance += amt;
      }

      // Decreases family member receivable
      let contactId = tx.familyContactId;
      if (!contactId) {
        const titleLower = (tx.title || '').toLowerCase();
        const notesLower = (tx.notes || '').toLowerCase();
        if (titleLower.includes('appa') || notesLower.includes('appa') || tx.isAppaReimbursable) {
          contactId = 'family-appa';
        }
      }

      if (contactId) {
        if (!familyReceivables[contactId]) {
          familyReceivables[contactId] = {
            contactId,
            contactName: tx.familyContactName || contactId,
            totalPaidForThem: 0,
            totalRepaidByThem: 0,
            outstandingBalance: 0,
          };
        }
        familyReceivables[contactId].totalRepaidByThem += amt;
      }
    } else if (tx.type === 'reconciliation') {
      // Reconciliation adjustment entry
      if (accDetail) {
        accDetail.totalReconciliationAdjustments += amt;
        accDetail.balance += amt;
      }
    }
  });

  // 4. Process Transfers (Between Accounts)
  transfers.forEach((tr) => {
    if (tr.deleted) return;
    const trAmt = Number(tr.amount) || 0;
    if (trAmt <= 0) return;

    const fromAcc = accountBalances[tr.fromAccountId];
    const toAcc = accountBalances[tr.toAccountId];

    if (fromAcc) {
      fromAcc.totalTransfersOut += trAmt;
      fromAcc.balance -= trAmt;
    }
    if (toAcc) {
      toAcc.totalTransfersIn += trAmt;
      toAcc.balance += trAmt;
    }
  });

  // 5. Process External Reconciliation Adjustments
  reconciliations.forEach((rec) => {
    const targetAcc = accountBalances[rec.accountId];
    if (targetAcc) {
      const adj = Number(rec.adjustmentAmount) || 0;
      targetAcc.totalReconciliationAdjustments += adj;
      targetAcc.balance += adj;
    }
  });

  // 6. Calculate Family Outstanding
  let totalReceivable = 0;
  Object.values(familyReceivables).forEach((rec) => {
    rec.outstandingBalance = Math.max(0, rec.totalPaidForThem - rec.totalRepaidByThem);
    totalReceivable += rec.outstandingBalance;
  });

  // 7. Account totals
  const sbiBalance = accountBalances['acc-sbi']?.balance || 0;
  const iobBalance = accountBalances['acc-iob']?.balance || 0;
  const cashBalance = accountBalances['acc-cash']?.balance || 0;

  let totalAvailableMoney = 0;
  Object.values(accountBalances).forEach((acc) => {
    totalAvailableMoney += acc.balance;
  });

  // 8. Overall Worth = Total Available Money + Total Receivable
  const overallWorth = totalAvailableMoney + totalReceivable;

  // 9. Freelance Job metrics
  let freelanceReceivedTotal = 0;
  let freelancePendingTotal = 0;
  freelanceJobs.forEach((job) => {
    freelanceReceivedTotal += Number(job.paidAmount) || 0;
    freelancePendingTotal += Number(job.pendingAmount) || 0;
  });

  return {
    accountBalances,
    sbiBalance,
    iobBalance,
    cashBalance,
    totalAvailableMoney,
    familyReceivables,
    totalReceivable,
    overallWorth,
    totalIncomeReceived,
    totalExpensesPaid,
    freelanceReceivedTotal,
    freelancePendingTotal,
    unassignedTransactionsCount,
    unassignedTransactionsAmount,
    datedBeforeOpeningWarnings,
  };
}

/**
 * Helper to check whether spending an amount would result in a negative account balance.
 */
export function wouldOverdrawAccount(currentBalance: number, spendAmount: number): boolean {
  return currentBalance - spendAmount < 0;
}
