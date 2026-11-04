/**
 * Automated Test Suite for MSR Penny Pure Calculation Module (Section 4.3 & 4.4)
 * 
 * Verifies:
 * 1. Worked example from Section 4.4 step-by-step
 * 2. Final expected balances (SBI: 8700, IOB: 3000, Cash: 1100, Available: 12800, Receivable: 600, Worth: 13400)
 * 3. Repayments increase account balance and decrease receivable, NEVER appearing in income
 * 4. Transfers are strictly neutral to total available money
 * 5. Pending freelance amounts do not alter bank balances
 * 6. Overdrawing detection
 * 7. Transactions dated before opening date ignore/warning behaviour
 */

import {
  calculateFinancialOverview,
  wouldOverdrawAccount,
  isBeforeOpeningDate,
} from '../src/utils/balanceCalculator';
import { Account, Transaction, Transfer, FamilyContact, FreelanceJob } from '../src/types';

let passed = 0;
let total = 0;

function assert(condition: boolean, testName: string, detail: string = '') {
  total++;
  if (condition) {
    passed++;
    console.log(`  ✓ PASSED: ${testName}`);
  } else {
    console.error(`  ✗ FAILED: ${testName}`);
    if (detail) console.error(`    Detail: ${detail}`);
    throw new Error(`Assertion failed: ${testName}`);
  }
}

console.log('======================================================');
console.log('  MSR PENNY — PURE CALCULATION MODULE VERIFICATION    ');
console.log('======================================================\n');

// -----------------------------------------------------------------------------
// Test Suite 1: Exact Section 4.4 Worked Example
// -----------------------------------------------------------------------------
console.log('Suite 1: Worked Example (Section 4.4)');

const accounts: Account[] = [
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

const familyContacts: FamilyContact[] = [
  { id: 'family-appa', name: 'Appa', active: true },
  { id: 'family-amma', name: 'Amma', active: true },
  { id: 'family-chinna-akka', name: 'Chinna Akka', active: true },
  { id: 'family-periya-akka', name: 'Periya Akka', active: true },
];

// Initial state verification
{
  const initial = calculateFinancialOverview({ accounts, familyContacts });
  assert(initial.sbiBalance === 10000, 'Initial SBI balance is ₹10,000');
  assert(initial.iobBalance === 2000, 'Initial IOB balance is ₹2,000');
  assert(initial.cashBalance === 500, 'Initial Cash balance is ₹500');
  assert(initial.totalAvailableMoney === 12500, 'Initial Total Available Money is ₹12,500');
  assert(initial.totalReceivable === 0, 'Initial Receivable is ₹0');
  assert(initial.overallWorth === 12500, 'Initial Overall Worth is ₹12,500');
}

// Step 1: Pay ₹500 for Appa via SBI UPI
const tx1: Transaction = {
  id: 'step-1',
  type: 'expense',
  title: 'Bus Pass for Appa',
  amount: 500,
  category: 'Travel',
  date: '2026-10-05',
  paymentMethod: 'upi',
  accountId: 'acc-sbi',
  isFamilyReimbursable: true,
  familyContactId: 'family-appa',
  familyContactName: 'Appa',
  isAppaReimbursable: true,
  appaSettled: false,
  createdAt: '2026-10-05T10:00:00Z',
};

{
  const s1 = calculateFinancialOverview({ accounts, transactions: [tx1], familyContacts });
  assert(s1.sbiBalance === 9500, 'Step 1: SBI balance decreased to ₹9,500');
  assert(s1.familyReceivables['family-appa']?.outstandingBalance === 500, 'Step 1: Appa outstanding is ₹500');
  assert(s1.totalAvailableMoney === 12000, 'Step 1: Total Available is ₹12,000');
  assert(s1.totalReceivable === 500, 'Step 1: Total Receivable is ₹500');
  assert(s1.overallWorth === 12500, 'Step 1: Overall worth remains ₹12,500');
}

// Step 2: Pay ₹300 for Amma in Cash
const tx2: Transaction = {
  id: 'step-2',
  type: 'expense',
  title: 'Medicines for Amma',
  amount: 300,
  category: 'Family',
  date: '2026-10-06',
  paymentMethod: 'cash',
  accountId: 'acc-cash',
  isFamilyReimbursable: true,
  familyContactId: 'family-amma',
  familyContactName: 'Amma',
  isAppaReimbursable: false,
  appaSettled: false,
  createdAt: '2026-10-06T11:00:00Z',
};

{
  const s2 = calculateFinancialOverview({ accounts, transactions: [tx1, tx2], familyContacts });
  assert(s2.cashBalance === 200, 'Step 2: Cash balance decreased to ₹200 (500 - 300)');
  assert(s2.familyReceivables['family-amma']?.outstandingBalance === 300, 'Step 2: Amma outstanding is ₹300');
  assert(s2.totalReceivable === 800, 'Step 2: Total Receivable is ₹800 (500 Appa + 300 Amma)');
}

// Step 3: Appa repays ₹200 into SBI
const tx3: Transaction = {
  id: 'step-3',
  type: 'repayment',
  title: 'UPI from Appa',
  amount: 200,
  category: 'Family',
  date: '2026-10-07',
  paymentMethod: 'upi',
  accountId: 'acc-sbi',
  familyContactId: 'family-appa',
  familyContactName: 'Appa',
  isAppaReimbursable: true,
  appaSettled: true,
  settlementStatus: 'settled',
  createdAt: '2026-10-07T12:00:00Z',
};

{
  const s3 = calculateFinancialOverview({ accounts, transactions: [tx1, tx2, tx3], familyContacts });
  assert(s3.sbiBalance === 9700, 'Step 3: SBI balance increases to ₹9,700 (9500 + 200)');
  assert(s3.familyReceivables['family-appa']?.outstandingBalance === 300, 'Step 3: Appa outstanding reduced to ₹300 (500 - 200)');
  assert(s3.totalIncomeReceived === 0, 'Step 3: Repayment is NOT counted as income (totalIncomeReceived is 0)');
}

// Step 4: Freelance job ₹1,000 marked Paid via UPI into IOB
const tx4: Transaction = {
  id: 'step-4',
  type: 'income',
  title: 'Poster Design Milestone 1',
  amount: 1000,
  category: 'Freelance',
  date: '2026-10-08',
  paymentMethod: 'upi',
  accountId: 'acc-iob',
  isAppaReimbursable: false,
  appaSettled: false,
  freelanceJobId: 'job-1',
  createdAt: '2026-10-08T14:00:00Z',
};

const job1: FreelanceJob = {
  id: 'job-1',
  title: 'Poster Project',
  clientName: 'College Fest',
  totalFee: 1500,
  paidAmount: 1000,
  pendingAmount: 500,
  status: 'in_progress',
  dueDate: '2026-10-30',
  milestones: [
    { id: 'm1', title: 'Draft', amount: 1000, paid: true },
    { id: 'm2', title: 'Final', amount: 500, paid: false },
  ],
  costs: [],
  createdAt: '2026-10-01T00:00:00Z',
};

{
  const s4 = calculateFinancialOverview({
    accounts,
    transactions: [tx1, tx2, tx3, tx4],
    familyContacts,
    freelanceJobs: [job1],
  });
  assert(s4.iobBalance === 3000, 'Step 4: IOB balance increased to ₹3,000 (2000 + 1000)');
  assert(s4.totalIncomeReceived === 1000, 'Step 4: Total income received is ₹1,000');
  assert(s4.freelanceReceivedTotal === 1000, 'Step 4: Freelance received total is ₹1,000');
}

// Step 5: Freelance job ₹500 Pending -> NO balance change
{
  const s5 = calculateFinancialOverview({
    accounts,
    transactions: [tx1, tx2, tx3, tx4],
    familyContacts,
    freelanceJobs: [job1],
  });
  assert(s5.iobBalance === 3000, 'Step 5: Pending ₹500 does NOT affect IOB balance (remains ₹3,000)');
  assert(s5.freelancePendingTotal === 500, 'Step 5: Freelance pending total is recorded as ₹500');
}

// Step 6: Transfer ₹1,000 SBI -> Cash (ATM withdrawal)
const tr1: Transfer = {
  id: 'tr-1',
  date: '2026-10-09',
  fromAccountId: 'acc-sbi',
  toAccountId: 'acc-cash',
  amount: 1000,
  notes: 'ATM Withdrawal',
  createdAt: '2026-10-09T16:00:00Z',
};

{
  const s6 = calculateFinancialOverview({
    accounts,
    transactions: [tx1, tx2, tx3, tx4],
    transfers: [tr1],
    familyContacts,
    freelanceJobs: [job1],
  });
  assert(s6.sbiBalance === 8700, 'Step 6: SBI balance decreased to ₹8,700 (9700 - 1000)');
  assert(s6.cashBalance === 1200, 'Step 6: Cash balance increased to ₹1,200 (200 + 1000)');
  assert(s6.totalAvailableMoney === 12900, 'Step 6: Available money is 8700 + 3000 + 1200 = ₹12,900');
}

// Step 7: Personal expense ₹100 Cash
const tx7: Transaction = {
  id: 'step-7',
  type: 'expense',
  title: 'Snacks & Tea',
  amount: 100,
  category: 'Food',
  date: '2026-10-10',
  paymentMethod: 'cash',
  accountId: 'acc-cash',
  isFamilyReimbursable: false,
  isAppaReimbursable: false,
  appaSettled: false,
  createdAt: '2026-10-10T17:00:00Z',
};

const allTransactions = [tx1, tx2, tx3, tx4, tx7];
const allTransfers = [tr1];
const finalOverview = calculateFinancialOverview({
  accounts,
  transactions: allTransactions,
  transfers: allTransfers,
  familyContacts,
  freelanceJobs: [job1],
});

console.log('\nFinal Expected Verification (Section 4.4):');
assert(finalOverview.sbiBalance === 8700, 'FINAL: SBI balance is exactly ₹8,700');
assert(finalOverview.iobBalance === 3000, 'FINAL: IOB balance is exactly ₹3,000');
assert(finalOverview.cashBalance === 1100, 'FINAL: Cash balance is exactly ₹1,100 (1200 - 100)');
assert(finalOverview.totalAvailableMoney === 12800, 'FINAL: Total available is exactly ₹12,800 (8700 + 3000 + 1100)');
assert(finalOverview.totalReceivable === 600, 'FINAL: Total receivable is exactly ₹600 (Appa 300 + Amma 300)');
assert(finalOverview.overallWorth === 13400, 'FINAL: Overall worth is exactly ₹13,400 (12800 + 600)');
assert(finalOverview.totalIncomeReceived === 1000, 'FINAL: Freelance income received is ₹1,000');

// -----------------------------------------------------------------------------
// Test Suite 2: Safeguards & Edge Cases
// -----------------------------------------------------------------------------
console.log('\nSuite 2: Safeguards, Warnings & Overdraw Checks');

// Overdraw prevention
assert(wouldOverdrawAccount(1000, 500) === false, '₹500 expense with ₹1,000 balance does not overdraw');
assert(wouldOverdrawAccount(1000, 1000) === false, 'Exact balance expense leaves ₹0, does not overdraw');
assert(wouldOverdrawAccount(1000, 1001) === true, 'Expense exceeding balance triggers overdraw warning');

// Opening date warning
assert(isBeforeOpeningDate('2026-09-25', '2026-10-01') === true, 'Transaction dated before opening date detected');
assert(isBeforeOpeningDate('2026-10-01', '2026-10-01') === false, 'Transaction on opening date is valid');
assert(isBeforeOpeningDate('2026-10-05', '2026-10-01') === false, 'Transaction after opening date is valid');

// Pre-opening transaction ignored in balance calculation
const preOpeningTx: Transaction = {
  id: 'pre-opening-tx',
  type: 'expense',
  title: 'Old September item',
  amount: 250,
  category: 'Food',
  date: '2026-09-20',
  paymentMethod: 'cash',
  accountId: 'acc-cash',
  isFamilyReimbursable: false,
  isAppaReimbursable: false,
  appaSettled: false,
  createdAt: '2026-09-20T10:00:00Z',
};

{
  const withPreOpening = calculateFinancialOverview({
    accounts,
    transactions: [...allTransactions, preOpeningTx],
    transfers: allTransfers,
    familyContacts,
  });
  assert(withPreOpening.cashBalance === 1100, 'Pre-opening transaction did NOT decrease current Cash balance');
  assert(withPreOpening.datedBeforeOpeningWarnings === 1, 'Warning counter recorded the 1 pre-opening transaction');
}

console.log('\n======================================================');
console.log(`TEST RESULTS: ${passed} / ${total} PASSED`);
console.log('PURE CALCULATION MODULE VERIFIED 100% ACCURATELY! ✓');
console.log('======================================================');

