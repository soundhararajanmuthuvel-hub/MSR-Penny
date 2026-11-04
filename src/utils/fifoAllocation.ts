/**
 * FIFO Repayment Allocation & Settlement Engine for MSR Penny
 *
 * Implements Section 5 of the Master Specification:
 * - Allocates family repayments to the contact's oldest unsettled expenses first (FIFO).
 * - Tracks PaidOnBehalf, RepaidSoFar, Outstanding, and Allocation Status per expense.
 * - Detects when a contact's total outstanding balance reaches EXACTLY ₹0.
 * - Manages atomic, reversible, idempotent auto-archive grouping.
 */

import { Transaction, FamilyContact, SettledArchiveItem } from '../types';

export interface FifoAllocationResult {
  allocatedTransactions: Transaction[];
  contactBalances: Record<
    string,
    {
      contactId: string;
      contactName: string;
      totalPaidOnBehalf: number;
      totalRepaid: number;
      outstandingBalance: number;
      isFullySettled: boolean;
      settledExpenseIds: string[];
      linkedRepaymentIds: string[];
    }
  >;
  totalFamilyOutstanding: number;
  fullySettledContactIds: string[];
}

/**
 * Pure function: Runs FIFO repayment allocation across all active transactions
 */
export function runFifoRepaymentAllocation(
  transactions: Transaction[],
  contacts: FamilyContact[]
): FifoAllocationResult {
  const resultTxMap = new Map<string, Transaction>();
  transactions.forEach((tx) => {
    resultTxMap.set(tx.id, { ...tx });
  });

  const contactBalances: FifoAllocationResult['contactBalances'] = {};
  const fullySettledContactIds: string[] = [];
  let totalFamilyOutstanding = 0;

  for (const contact of contacts) {
    const contactId = contact.id;

    // 1. Identify all eligible family expenses for this contact (exclude soft-deleted)
    const memberExpenses = transactions
      .filter((t) => {
        if (t.deleted) return false;
        if (t.type !== 'expense') return false;
        if (t.familyContactId === contactId) return true;
        if (contactId === 'family-appa' && !t.familyContactId && t.isAppaReimbursable) return true;
        return false;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // 2. Identify all repayments for this contact
    const memberRepayments = transactions
      .filter((t) => {
        if (t.deleted) return false;
        if (t.type !== 'repayment') return false;
        if (t.familyContactId === contactId) return true;
        if (contactId === 'family-appa' && !t.familyContactId && t.isAppaReimbursable) return true;
        return false;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let totalPaidOnBehalf = 0;
    memberExpenses.forEach((exp) => {
      totalPaidOnBehalf += Number(exp.amount) || 0;
    });

    let totalRepaid = 0;
    memberRepayments.forEach((rep) => {
      totalRepaid += Number(rep.amount) || 0;
    });

    // 3. Initialize FIFO state for expenses
    const expenseState = memberExpenses.map((exp) => ({
      txId: exp.id,
      paidOnBehalf: Number(exp.amount) || 0,
      repaidSoFar: 0,
      outstanding: Number(exp.amount) || 0,
      linkedRepaymentIds: [] as string[],
    }));

    // 4. Sequentially allocate repayments oldest-first
    for (const repayment of memberRepayments) {
      let unallocatedRepayment = Number(repayment.amount) || 0;

      for (const exp of expenseState) {
        if (unallocatedRepayment <= 0) break;
        if (exp.outstanding <= 0) continue;

        const payable = Math.min(exp.outstanding, unallocatedRepayment);
        exp.repaidSoFar += payable;
        exp.outstanding -= payable;
        unallocatedRepayment -= payable;
        if (!exp.linkedRepaymentIds.includes(repayment.id)) {
          exp.linkedRepaymentIds.push(repayment.id);
        }
      }
    }

    // 5. Update transaction objects in result map
    const settledExpenseIds: string[] = [];
    expenseState.forEach((state) => {
      const existing = resultTxMap.get(state.txId);
      if (existing) {
        const isSettled = state.outstanding === 0;
        const isPartiallyRepaid = state.repaidSoFar > 0 && state.outstanding > 0;
        const allocationStatus: 'open' | 'partially_repaid' | 'settled' = isSettled
          ? 'settled'
          : isPartiallyRepaid
          ? 'partially_repaid'
          : 'open';

        if (isSettled) {
          settledExpenseIds.push(state.txId);
        }

        resultTxMap.set(state.txId, {
          ...existing,
          paidOnBehalf: state.paidOnBehalf,
          repaidSoFar: state.repaidSoFar,
          outstandingAmount: state.outstanding,
          allocationStatus,
          linkedRepaymentIds: state.linkedRepaymentIds,
          settlementStatus: isSettled ? 'settled' : 'pending',
          appaSettled: isSettled,
        });
      }
    });

    const outstandingBalance = Math.max(0, totalPaidOnBehalf - totalRepaid);
    totalFamilyOutstanding += outstandingBalance;

    // Contact is fully settled if they had expenses and outstanding is exactly ₹0
    const isFullySettled = totalPaidOnBehalf > 0 && outstandingBalance === 0;
    if (isFullySettled) {
      fullySettledContactIds.push(contactId);
    }

    contactBalances[contactId] = {
      contactId,
      contactName: contact.name,
      totalPaidOnBehalf,
      totalRepaid,
      outstandingBalance,
      isFullySettled,
      settledExpenseIds,
      linkedRepaymentIds: memberRepayments.map((r) => r.id),
    };
  }

  return {
    allocatedTransactions: Array.from(resultTxMap.values()),
    contactBalances,
    totalFamilyOutstanding,
    fullySettledContactIds,
  };
}

/**
 * Creates atomic archive items for a fully settled contact batch
 */
export function createSettledArchiveBatch(
  contactId: string,
  transactions: Transaction[]
): {
  archiveItems: SettledArchiveItem[];
  activeTransactionsToKeep: Transaction[];
  batchId: string;
} {
  const batchId = `arch-batch-${Date.now()}`;
  const now = new Date().toISOString();

  const archiveItems: SettledArchiveItem[] = [];
  const activeTransactionsToKeep: Transaction[] = [];

  transactions.forEach((tx) => {
    const isContactItem =
      tx.familyContactId === contactId ||
      (contactId === 'family-appa' && !tx.familyContactId && tx.isAppaReimbursable);

    const isSettledExpense =
      isContactItem && tx.type === 'expense' && (tx.outstandingAmount === 0 || tx.settlementStatus === 'settled');
    const isSettledRepayment = isContactItem && tx.type === 'repayment';

    if (isSettledExpense || isSettledRepayment) {
      archiveItems.push({
        id: `arch-${tx.id}`,
        originalTransactionId: tx.id,
        date: tx.date,
        title: tx.title,
        type: tx.type === 'expense' ? 'expense' : 'repayment',
        amount: Number(tx.amount) || 0,
        category: tx.category,
        paymentMethod: tx.paymentMethod,
        accountId: tx.accountId || 'acc-sbi',
        accountName: tx.accountName || 'SBI (Main)',
        familyContactId: contactId,
        familyContactName: tx.familyContactName || 'Family Member',
        archivedAt: now,
        archiveBatchId: batchId,
        notes: tx.notes,
      });
    } else {
      activeTransactionsToKeep.push(tx);
    }
  });

  return {
    archiveItems,
    activeTransactionsToKeep,
    batchId,
  };
}

/**
 * Reversibly restores an archived batch back into active transactions
 */
export function restoreArchivedBatch(
  batchId: string,
  activeTransactions: Transaction[],
  archiveItems: SettledArchiveItem[]
): {
  restoredTransactions: Transaction[];
  remainingArchiveItems: SettledArchiveItem[];
} {
  const itemsToRestore = archiveItems.filter((item) => item.archiveBatchId === batchId);
  const remainingArchiveItems = archiveItems.filter((item) => item.archiveBatchId !== batchId);

  const restoredTxList: Transaction[] = itemsToRestore.map((item) => ({
    id: item.originalTransactionId,
    date: item.date,
    title: item.title,
    type: item.type,
    amount: item.amount,
    category: item.category as any,
    paymentMethod: item.paymentMethod,
    accountId: item.accountId,
    accountName: item.accountName,
    familyContactId: item.familyContactId,
    familyContactName: item.familyContactName,
    isFamilyReimbursable: true,
    isAppaReimbursable: item.familyContactId === 'family-appa',
    appaSettled: true,
    settlementStatus: 'settled',
    archived: false,
    createdAt: item.archivedAt,
    notes: item.notes,
  }));

  return {
    restoredTransactions: [...activeTransactions, ...restoredTxList],
    remainingArchiveItems,
  };
}

