/**
 * Unit Test Suite for Phase 3:
 * - FIFO Repayment Allocation Engine
 * - Exact ₹0 Auto-Archive Trigger
 * - Archive Safety Invariant: Account balances & overall worth remain identical after archiving!
 * - Reversible Restore from Archive
 * - Balance Reconciliation Adjustments
 */

import {
  runFifoRepaymentAllocation,
  createSettledArchiveBatch,
  restoreArchivedBatch,
} from '../src/utils/fifoAllocation';
import {
  calculateFinancialOverview,
  DEFAULT_ACCOUNTS,
} from '../src/utils/balanceCalculator';
import { Transaction, FamilyContact, Account } from '../src/types';

let passed = 0;
let total = 0;

function assert(cond: boolean, name: string, detail?: string) {
  total++;
  if (cond) {
    passed++;
    console.log(`  ✓ PASSED: ${name}`);
  } else {
    console.error(`  ✗ FAILED: ${name}`);
    if (detail) console.error(`    Detail: ${detail}`);
  }
}

const testAccounts: Account[] = [
  {
    id: 'acc-sbi',
    name: 'SBI (Main)',
    type: 'bank',
    openingBalance: 10000,
    openingDate: '2026-10-01',
    active: true,
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  },
  {
    id: 'acc-iob',
    name: 'IOB (Second)',
    type: 'bank',
    openingBalance: 2000,
    openingDate: '2026-10-01',
    active: true,
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  },
  {
    id: 'acc-cash',
    name: 'Cash',
    type: 'cash',
    openingBalance: 500,
    openingDate: '2026-10-01',
    active: true,
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  },
];

const testContacts: FamilyContact[] = [
  { id: 'family-appa', name: 'Appa', active: true },
  { id: 'family-amma', name: 'Amma', active: true },
];

console.log('======================================================');
console.log('  MSR PENNY — FIFO ALLOCATION & ARCHIVE TEST SUITE    ');
console.log('======================================================\n');

// -------------------------------------------------------------
// Suite 1: FIFO Repayment Allocation
// -------------------------------------------------------------
console.log('Suite 1: FIFO Repayment Allocation (Oldest Expenses First)');

const tx1: Transaction = {
  id: 'tx-1',
  date: '2026-10-05',
  title: 'Bus Pass for Appa',
  type: 'expense',
  amount: 500,
  category: 'Travel',
  paymentMethod: 'upi',
  accountId: 'acc-sbi',
  familyContactId: 'family-appa',
  familyContactName: 'Appa',
  isFamilyReimbursable: true,
  isAppaReimbursable: true,
  appaSettled: false,
  createdAt: '2026-10-05T10:00:00Z',
};

const tx2: Transaction = {
  id: 'tx-2',
  date: '2026-10-08',
  title: 'Medicine for Appa',
  type: 'expense',
  amount: 300,
  category: 'Family',
  paymentMethod: 'upi',
  accountId: 'acc-sbi',
  familyContactId: 'family-appa',
  familyContactName: 'Appa',
  isFamilyReimbursable: true,
  isAppaReimbursable: true,
  appaSettled: false,
  createdAt: '2026-10-08T10:00:00Z',
};

const tx3: Transaction = {
  id: 'tx-3',
  date: '2026-10-10',
  title: 'Grocery for Appa',
  type: 'expense',
  amount: 200,
  category: 'Shopping',
  paymentMethod: 'cash',
  accountId: 'acc-cash',
  familyContactId: 'family-appa',
  familyContactName: 'Appa',
  isFamilyReimbursable: true,
  isAppaReimbursable: true,
  appaSettled: false,
  createdAt: '2026-10-10T10:00:00Z',
};

// Partial repayment ₹600 from Appa into SBI
const rep1: Transaction = {
  id: 'rep-1',
  date: '2026-10-12',
  title: 'Repayment from Appa',
  type: 'repayment',
  amount: 600,
  category: 'Family',
  paymentMethod: 'upi',
  accountId: 'acc-sbi',
  familyContactId: 'family-appa',
  familyContactName: 'Appa',
  isFamilyReimbursable: false,
  isAppaReimbursable: false,
  appaSettled: true,
  createdAt: '2026-10-12T10:00:00Z',
};

const fifo1 = runFifoRepaymentAllocation([tx1, tx2, tx3, rep1], testContacts);
const appaAlloc = fifo1.allocatedTransactions;

const allocatedTx1 = appaAlloc.find((t) => t.id === 'tx-1')!;
const allocatedTx2 = appaAlloc.find((t) => t.id === 'tx-2')!;
const allocatedTx3 = appaAlloc.find((t) => t.id === 'tx-3')!;

assert(allocatedTx1.outstandingAmount === 0, 'Oldest expense (tx-1, ₹500) is fully settled');
assert(allocatedTx1.allocationStatus === 'settled', 'tx-1 allocationStatus is "settled"');
assert(allocatedTx2.repaidSoFar === 100, 'Second expense (tx-2, ₹300) received remainder ₹100');
assert(allocatedTx2.outstandingAmount === 200, 'tx-2 outstanding is ₹200');
assert(allocatedTx2.allocationStatus === 'partially_repaid', 'tx-2 allocationStatus is "partially_repaid"');
assert(allocatedTx3.outstandingAmount === 200, 'Third expense (tx-3, ₹200) untouched (outstanding is ₹200)');
assert(allocatedTx3.allocationStatus === 'open', 'tx-3 allocationStatus is "open"');
assert(fifo1.contactBalances['family-appa'].outstandingBalance === 400, 'Appa total outstanding is exactly ₹400');
assert(fifo1.fullySettledContactIds.length === 0, 'Partial repayment does NOT trigger auto-archive');

// -------------------------------------------------------------
// Suite 2: Full Settlement (Exact ₹0) & Auto-Archive Batch
// -------------------------------------------------------------
console.log('\nSuite 2: Full Settlement (Exact ₹0) & Auto-Archive Batch');

// Second repayment of ₹400 into Cash, bringing Appa debt to ₹0
const rep2: Transaction = {
  id: 'rep-2',
  date: '2026-10-15',
  title: 'Cash from Appa',
  type: 'repayment',
  amount: 400,
  category: 'Family',
  paymentMethod: 'cash',
  accountId: 'acc-cash',
  familyContactId: 'family-appa',
  familyContactName: 'Appa',
  isFamilyReimbursable: false,
  isAppaReimbursable: false,
  appaSettled: true,
  createdAt: '2026-10-15T10:00:00Z',
};

const allTxs = [tx1, tx2, tx3, rep1, rep2];
const fifo2 = runFifoRepaymentAllocation(allTxs, testContacts);

assert(fifo2.contactBalances['family-appa'].outstandingBalance === 0, 'Appa outstanding balance is exactly ₹0');
assert(fifo2.contactBalances['family-appa'].isFullySettled === true, 'Appa marked isFullySettled: true');
assert(fifo2.fullySettledContactIds.includes('family-appa'), 'Appa included in fullySettledContactIds');

const archiveBatch = createSettledArchiveBatch('family-appa', fifo2.allocatedTransactions);
assert(archiveBatch.archiveItems.length === 5, 'All 3 expenses and 2 repayments moved to archive batch');
assert(archiveBatch.activeTransactionsToKeep.length === 0, 'Active list cleaned of settled items');
assert(archiveBatch.batchId.startsWith('arch-batch-'), 'Generated stable batch ID for atomic tracking');

// -------------------------------------------------------------
// Suite 3: Safety Invariant — Archive Never Alters Balances
// -------------------------------------------------------------
console.log('\nSuite 3: Safety Invariant — Archive Never Alters Balances');

// Balance BEFORE archive
const overviewBeforeArchive = calculateFinancialOverview({
  accounts: testAccounts,
  transactions: allTxs,
  familyContacts: testContacts,
});

// Balance AFTER archive (transactions removed from active, placed into settledArchive)
const overviewAfterArchive = calculateFinancialOverview({
  accounts: testAccounts,
  transactions: archiveBatch.activeTransactionsToKeep,
  settledArchive: archiveBatch.archiveItems,
  familyContacts: testContacts,
});

assert(
  overviewBeforeArchive.sbiBalance === overviewAfterArchive.sbiBalance,
  `SBI balance invariant preserved: ₹${overviewBeforeArchive.sbiBalance} == ₹${overviewAfterArchive.sbiBalance}`
);
assert(
  overviewBeforeArchive.cashBalance === overviewAfterArchive.cashBalance,
  `Cash balance invariant preserved: ₹${overviewBeforeArchive.cashBalance} == ₹${overviewAfterArchive.cashBalance}`
);
assert(
  overviewBeforeArchive.totalAvailableMoney === overviewAfterArchive.totalAvailableMoney,
  `Total Available Money invariant preserved: ₹${overviewBeforeArchive.totalAvailableMoney} == ₹${overviewAfterArchive.totalAvailableMoney}`
);
assert(
  overviewBeforeArchive.totalReceivable === overviewAfterArchive.totalReceivable,
  `Total Receivable invariant preserved: ₹${overviewBeforeArchive.totalReceivable} == ₹${overviewAfterArchive.totalReceivable}`
);
assert(
  overviewBeforeArchive.overallWorth === overviewAfterArchive.overallWorth,
  `Overall Worth invariant preserved: ₹${overviewBeforeArchive.overallWorth} == ₹${overviewAfterArchive.overallWorth}`
);

// -------------------------------------------------------------
// Suite 4: Reversible Restore
// -------------------------------------------------------------
console.log('\nSuite 4: Reversible Restore from Archive');

const restored = restoreArchivedBatch(
  archiveBatch.batchId,
  archiveBatch.activeTransactionsToKeep,
  archiveBatch.archiveItems
);

assert(restored.restoredTransactions.length === 5, 'Restored all 5 transactions from batch');
assert(restored.remainingArchiveItems.length === 0, 'Archive items cleaned of restored batch');

const overviewAfterRestore = calculateFinancialOverview({
  accounts: testAccounts,
  transactions: restored.restoredTransactions,
  settledArchive: restored.remainingArchiveItems,
  familyContacts: testContacts,
});

assert(
  overviewAfterRestore.totalAvailableMoney === overviewBeforeArchive.totalAvailableMoney,
  'Available money identical after restore'
);

// -------------------------------------------------------------
// Suite 5: Balance Reconciliation Adjustments
// -------------------------------------------------------------
console.log('\nSuite 5: Balance Reconciliation Adjustments');

const overviewWithRecon = calculateFinancialOverview({
  accounts: testAccounts,
  transactions: allTxs,
  familyContacts: testContacts,
  reconciliations: [
    {
      id: 'rec-1',
      date: '2026-10-16',
      accountId: 'acc-sbi',
      accountName: 'SBI (Main)',
      realBalance: 10000,
      computedBalance: 9800,
      adjustmentAmount: 200,
      createdAt: '2026-10-16T12:00:00Z',
    },
  ],
});

assert(
  overviewWithRecon.sbiBalance === overviewBeforeArchive.sbiBalance + 200,
  'Reconciliation adjustment correctly added ₹200 to SBI balance'
);

console.log('\n======================================================');
console.log(`TEST RESULTS: ${passed} / ${total} PASSED`);
if (passed === total) {
  console.log('FIFO ALLOCATION & ARCHIVE MODULE VERIFIED 100%! ✓');
}
console.log('======================================================\n');

if (passed < total) process.exit(1);
