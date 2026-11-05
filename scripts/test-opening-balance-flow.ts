/**
 * MSR Penny — Opening Balance Flow & Real Balance Helper Test Suite
 * Strictly verifies all mathematical invariants, edge cases, input validation,
 * and safety guarantees specified in the Master Prompt.
 */

import {
  calculateFinancialOverview,
  validateOpeningBalanceInput,
  computeMatchRealOpening,
  detectPotentialAtmWithdrawal,
  getPreOpeningTransactions,
  DEFAULT_ACCOUNTS,
} from '../src/utils/balanceCalculator';
import { Account, Transaction, Transfer, FamilyContact } from '../src/types';

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, message: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASSED: ${message}`);
  } else {
    console.error(`  ❌ FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log('======================================================');
console.log('  MSR PENNY — OPENING BALANCE & REAL HELPER TESTS     ');
console.log('======================================================\n');

// -----------------------------------------------------------------------------
// Suite 1: Changing Opening Balance Delta Isolation Invariant
// -----------------------------------------------------------------------------
console.log('Suite 1: Changing Opening Balance Changes ONLY That Account by Delta');

const baseAccounts: Account[] = [
  { id: 'acc-sbi', name: 'SBI (Main)', type: 'bank', openingBalance: 10000, openingDate: '2026-10-01', active: true, createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z' },
  { id: 'acc-iob', name: 'IOB (Second)', type: 'bank', openingBalance: 2000, openingDate: '2026-10-01', active: true, createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z' },
  { id: 'acc-cash', name: 'Cash', type: 'cash', openingBalance: 0, openingDate: '2026-10-01', active: true, createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z' },
];

const testTransactions: Transaction[] = [
  { id: 'tx-1', type: 'expense', title: 'Groceries', amount: 500, category: 'Food', date: '2026-10-15', accountId: 'acc-sbi', createdAt: '2026-10-15T00:00:00Z' },
  { id: 'tx-2', type: 'expense', title: 'Auto Fare', amount: 68, category: 'Travel', date: '2026-10-16', accountId: 'acc-cash', createdAt: '2026-10-16T00:00:00Z' },
  { id: 'tx-3', type: 'income', title: 'Freelance Design', amount: 1500, category: 'Freelance', date: '2026-10-18', accountId: 'acc-iob', createdAt: '2026-10-18T00:00:00Z' },
  { id: 'tx-4', type: 'expense', title: 'Appa Bus Ticket', amount: 100, category: 'Travel', date: '2026-10-20', accountId: 'acc-sbi', familyContactId: 'family-appa', isFamilyReimbursable: true, createdAt: '2026-10-20T00:00:00Z' },
];

const familyContacts: FamilyContact[] = [
  { id: 'family-appa', name: 'Appa', phoneNumber: '+919876543210', active: true, relationship: 'Father' },
];

// Baseline calculation
const initialOverview = calculateFinancialOverview({
  accounts: baseAccounts,
  transactions: testTransactions,
  familyContacts,
});

assert(initialOverview.sbiBalance === 9400, 'Initial SBI balance is ₹9,400 (10000 - 500 - 100)');
assert(initialOverview.iobBalance === 3500, 'Initial IOB balance is ₹3,500 (2000 + 1500)');
assert(initialOverview.cashBalance === -68, 'Initial Cash balance is -₹68 (0 - 68, reproducing current symptom)');
assert(initialOverview.totalAvailableMoney === 12832, 'Initial Total Available Money is ₹12,832 (9400 + 3500 - 68)');
assert(initialOverview.totalReceivable === 100, 'Initial Total Receivable is ₹100');
assert(initialOverview.overallWorth === 12932, 'Initial Overall Worth is ₹12,932 (12832 + 100)');

// Test: Adjust Cash opening balance by +₹500 (from 0 to 500)
const updatedAccountsCash: Account[] = baseAccounts.map((a) =>
  a.id === 'acc-cash' ? { ...a, openingBalance: 500 } : a
);

const overviewAfterCashFix = calculateFinancialOverview({
  accounts: updatedAccountsCash,
  transactions: testTransactions,
  familyContacts,
});

assert(overviewAfterCashFix.cashBalance === 432, 'Cash balance increased by exactly ₹500 to ₹432 (-68 + 500)');
assert(overviewAfterCashFix.sbiBalance === 9400, 'SBI balance remained completely unchanged at ₹9,400');
assert(overviewAfterCashFix.iobBalance === 3500, 'IOB balance remained completely unchanged at ₹3,500');
assert(overviewAfterCashFix.totalAvailableMoney === 13332, 'Total Available Money increased by exactly ₹500 to ₹13,332');
assert(overviewAfterCashFix.totalReceivable === 100, 'Receivable remained unchanged at ₹100');
assert(overviewAfterCashFix.overallWorth === 13432, 'Overall Worth increased by exactly ₹500 to ₹13,432');

// -----------------------------------------------------------------------------
// Suite 2: Opening Balance Never Counted As Income Or Expense
// -----------------------------------------------------------------------------
console.log('\nSuite 2: Opening Balance Is Not Income And Not Expense');

assert(
  overviewAfterCashFix.totalIncomeReceived === initialOverview.totalIncomeReceived,
  'Total Income Received is strictly identical (₹1,500) before and after opening change'
);
assert(
  overviewAfterCashFix.totalExpensesPaid === initialOverview.totalExpensesPaid,
  'Total Expenses Paid is strictly identical (₹668) before and after opening change'
);
assert(
  overviewAfterCashFix.freelanceReceivedTotal === initialOverview.freelanceReceivedTotal,
  'Freelance Received is completely untouched by opening balance changes'
);

// -----------------------------------------------------------------------------
// Suite 3: Pre-Opening Date Exclusion Invariant
// -----------------------------------------------------------------------------
console.log('\nSuite 3: Records Dated Before Opening Date Are Excluded');

const historicalTxs: Transaction[] = [
  { id: 'tx-old-1', type: 'expense', title: 'Pre-Opening Bus', amount: 40, category: 'Travel', date: '2026-09-15', accountId: 'acc-cash', createdAt: '2026-09-15T00:00:00Z' },
  { id: 'tx-old-2', type: 'income', title: 'Pre-Opening Gift', amount: 500, category: 'Other', date: '2026-09-20', accountId: 'acc-cash', createdAt: '2026-09-20T00:00:00Z' },
  { id: 'tx-curr-1', type: 'expense', title: 'Post-Opening Snack', amount: 50, category: 'Food', date: '2026-10-02', accountId: 'acc-cash', createdAt: '2026-10-02T00:00:00Z' },
];

const preOpeningOverview = calculateFinancialOverview({
  accounts: [
    { id: 'acc-cash', name: 'Cash', type: 'cash', openingBalance: 200, openingDate: '2026-10-01', active: true, createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z' },
  ],
  transactions: historicalTxs,
});

assert(
  preOpeningOverview.cashBalance === 150,
  'Cash balance is exactly ₹150 (200 opening - 50 snack; September transactions did not affect balance)'
);
assert(
  preOpeningOverview.datedBeforeOpeningWarnings === 2,
  'Correctly identified 2 pre-opening warning transactions'
);

const preOpeningList = getPreOpeningTransactions(historicalTxs, { 'acc-cash': '2026-10-01' });
assert(preOpeningList.length === 2, 'getPreOpeningTransactions returned exactly the 2 pre-opening transactions');
assert(preOpeningList[0].id === 'tx-old-1', 'First pre-opening transaction identified correctly');
assert(preOpeningList[1].id === 'tx-old-2', 'Second pre-opening transaction identified correctly');

// -----------------------------------------------------------------------------
// Suite 4: "Match My Real Balance" Math
// -----------------------------------------------------------------------------
console.log('\nSuite 4: "Match My Real Balance" Helper Math');

// Scenario: Cash computed is -68, current opening is 0, user actually has ₹150 in physical cash
const cashMatch = computeMatchRealOpening(0, -68, 150);
assert(cashMatch.difference === 218, 'Difference is ₹218 (150 - (-68))');
assert(cashMatch.suggestedOpening === 218, 'Suggested new opening is ₹218 (0 + 218)');
assert(!cashMatch.isNegative, 'Suggested opening is non-negative');

// Applying suggested opening results in computed balance matching real balance exactly
const testCashAccount: Account[] = [
  { id: 'acc-cash', name: 'Cash', type: 'cash', openingBalance: cashMatch.suggestedOpening, openingDate: '2026-10-01', active: true, createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z' },
];
const appliedCashOverview = calculateFinancialOverview({
  accounts: testCashAccount,
  transactions: [{ id: 'tx-c1', type: 'expense', title: 'Auto', amount: 68, category: 'Travel', date: '2026-10-15', accountId: 'acc-cash', createdAt: '2026-10-15T00:00:00Z' }],
});
assert(appliedCashOverview.cashBalance === 150, 'After applying suggested opening, computed balance exactly equals real balance (₹150)');

// Scenario: User has SBI computed 9400, real 9000 (spent 400 without record), current opening 10000
const sbiMatch = computeMatchRealOpening(10000, 9400, 9000);
assert(sbiMatch.difference === -400, 'SBI difference is -₹400 (9000 - 9400)');
assert(sbiMatch.suggestedOpening === 9600, 'Suggested new opening is ₹9,600 (10000 - 400)');

// -----------------------------------------------------------------------------
// Suite 5: Potential ATM Withdrawal Heuristic
// -----------------------------------------------------------------------------
console.log('\nSuite 5: ATM Withdrawal Detection Heuristic');

const atmDeficit = detectPotentialAtmWithdrawal({
  sbiBalance: 9400,
  cashBalance: -68,
});
assert(atmDeficit.isDetected, 'Detected negative cash balance as potential unrecorded ATM withdrawal');
assert(atmDeficit.suggestedAmount === 100, 'Suggested round ATM withdrawal amount is ₹100');

const atmMismatch = detectPotentialAtmWithdrawal({
  sbiDifference: -500,
  cashDifference: 500,
  sbiBalance: 8900,
  cashBalance: 432,
});
assert(atmMismatch.isDetected, 'Detected corresponding surplus cash and deficit SBI as ATM withdrawal');
assert(atmMismatch.suggestedAmount === 500, 'Suggested ATM transfer amount is ₹500');

// -----------------------------------------------------------------------------
// Suite 6: Input Validation Rules
// -----------------------------------------------------------------------------
console.log('\nSuite 6: Strict Input Validation Rules');

assert(!validateOpeningBalanceInput('').isValid, 'Rejects empty input string');
assert(!validateOpeningBalanceInput('   ').isValid, 'Rejects whitespace string');
assert(!validateOpeningBalanceInput('abc').isValid, 'Rejects alphabetic text');
assert(!validateOpeningBalanceInput('-50').isValid, 'Rejects negative opening balance (-50)');
assert(!validateOpeningBalanceInput('100.555').isValid, 'Rejects more than 2 decimal places (100.555)');
assert(validateOpeningBalanceInput('0').isValid && validateOpeningBalanceInput('0').amount === 0, 'Accepts 0');
assert(validateOpeningBalanceInput('10500').isValid && validateOpeningBalanceInput('10500').amount === 10500, 'Accepts 10500');
assert(validateOpeningBalanceInput('1,500.50').isValid && validateOpeningBalanceInput('1,500.50').amount === 1500.5, 'Accepts formatted 1,500.50');

// -----------------------------------------------------------------------------
// Suite 7: Financial Data Integrity Invariant (Transactions Untouched)
// -----------------------------------------------------------------------------
console.log('\nSuite 7: Zero Financial Records Modified Invariant');

const initialTxCount = testTransactions.length;
const initialTxSum = testTransactions.reduce((s, t) => s + t.amount, 0);

// Run multiple calculations with altered opening balances
calculateFinancialOverview({ accounts: updatedAccountsCash, transactions: testTransactions });

assert(testTransactions.length === initialTxCount, 'Transaction array count remained strictly identical');
assert(
  testTransactions.reduce((s, t) => s + t.amount, 0) === initialTxSum,
  'Transaction sum remained strictly identical'
);

console.log('\n======================================================');
console.log(`TEST RESULTS: ${passedTests} / ${totalTests} PASSED`);
console.log('OPENING BALANCE FLOW & INVARIANTS 100% VERIFIED! ✓');
console.log('======================================================\n');
