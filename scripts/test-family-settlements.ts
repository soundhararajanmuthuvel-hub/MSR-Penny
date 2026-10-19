/**
 * Automated Test Suite for MSR Penny:
 * - Multi-contact family settlement calculations
 * - Idempotency & duplicate protection
 * - Historical Appa record migration
 * - WhatsApp URL generation & message formats
 * - Indian phone number normalization
 * - Safe data synchronization & merge logic
 */

import {
  DEFAULT_FAMILY_CONTACTS,
  migrateAppaTransactions,
  calculateFamilyBalances,
  buildExpenseWhatsAppMessage,
  buildRepaymentWhatsAppMessage,
  generateWhatsAppUrl,
} from '../src/utils/familyMigration';
import { normalizeWhatsAppNumber, isValidWhatsAppNumber, formatPhoneNumberDisplay } from '../src/utils/phoneNormalizer';
import { Transaction, FamilyContact } from '../src/types';

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string, detail: string = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASSED: ${testName}`);
  } else {
    console.error(`  ✗ FAILED: ${testName}`);
    if (detail) console.error(`    Detail: ${detail}`);
  }
}

console.log('======================================================');
console.log('  MSR PENNY — FAMILY SETTLEMENTS & DATA VERIFICATION  ');
console.log('======================================================\n');

// -----------------------------------------------------------------------------
// 1. PHONE NORMALIZATION & WHATSAPP
// -----------------------------------------------------------------------------
console.log('Test Group 1: Phone Normalization & WhatsApp Links');

assert(
  normalizeWhatsAppNumber('9876543210') === '919876543210',
  '10-digit Indian number prepends 91'
);

assert(
  normalizeWhatsAppNumber('09876543210') === '919876543210',
  '11-digit Indian number with leading 0 strips 0 and prepends 91'
);

assert(
  normalizeWhatsAppNumber('+91 98765 43210') === '919876543210',
  'Number with +91 and spaces normalizes to 919876543210'
);

assert(
  normalizeWhatsAppNumber('') === '',
  'Empty phone number returns empty string gracefully'
);

assert(
  normalizeWhatsAppNumber('12345') === '',
  'Too short phone number returns empty string without error'
);

assert(
  isValidWhatsAppNumber('+919876543210') === true,
  'Valid phone number passes validation'
);

assert(
  isValidWhatsAppNumber('123') === false,
  'Invalid phone number fails validation'
);

// WhatsApp Expense message format (Section 18)
const expenseMsg = buildExpenseWhatsAppMessage({
  contactName: 'Appa',
  description: 'Semester Exam Fee',
  date: '24 Oct 2026',
  amount: 500,
  previousBalance: 200,
  updatedBalance: 700,
});

assert(
  expenseMsg.includes('Hi Appa 👋') &&
  expenseMsg.includes('Expense: Semester Exam Fee') &&
  expenseMsg.includes('Amount paid: ₹500') &&
  expenseMsg.includes('Previous balance: ₹200') &&
  expenseMsg.includes('New expense: ₹500') &&
  expenseMsg.includes('Total amount to repay: ₹700') &&
  expenseMsg.includes('— MSR Penny'),
  'Expense WhatsApp message conforms strictly to Section 18 format'
);

// WhatsApp Repayment message format (Section 19)
const repaymentMsg = buildRepaymentWhatsAppMessage({
  contactName: 'Amma',
  repaymentAmount: 300,
  previousBalance: 500,
  updatedBalance: 200,
});

assert(
  repaymentMsg.includes('Hi Amma 👋') &&
  repaymentMsg.includes('I have updated our settlement record.') &&
  repaymentMsg.includes('Amount received: ₹300') &&
  repaymentMsg.includes('Previous outstanding balance: ₹500') &&
  repaymentMsg.includes('Remaining balance: ₹200') &&
  repaymentMsg.includes('— MSR Penny'),
  'Repayment WhatsApp message conforms strictly to Section 19 format'
);

const waUrl = generateWhatsAppUrl('+919876543210', repaymentMsg);
assert(
  waUrl.startsWith('https://wa.me/919876543210?text=') &&
  waUrl.includes(encodeURIComponent('Hi Amma 👋')),
  'wa.me link includes normalized phone number and URL-encoded message'
);

// -----------------------------------------------------------------------------
// 2. MULTI-CONTACT FAMILY BALANCE CALCULATIONS
// -----------------------------------------------------------------------------
console.log('\nTest Group 2: Multi-Contact Family Balance Calculations');

const contacts: FamilyContact[] = [
  { id: 'family-appa', name: 'Appa', active: true },
  { id: 'family-amma', name: 'Amma', active: true },
  { id: 'family-chinna-akka', name: 'Chinna Akka', active: true },
  { id: 'family-periya-akka', name: 'Periya Akka', active: true },
];

const testTxs: Transaction[] = [
  // Appa: 500 expense, 200 repayment -> 300 balance
  {
    id: 't-1',
    type: 'expense',
    title: 'Bus Pass',
    amount: 500,
    category: 'Travel',
    date: '2026-10-01',
    paymentMethod: 'upi',
    isAppaReimbursable: true,
    isFamilyReimbursable: true,
    familyContactId: 'family-appa',
    familyContactName: 'Appa',
    appaSettled: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: 't-2',
    type: 'repayment',
    title: 'UPI from Appa',
    amount: 200,
    category: 'Family',
    date: '2026-10-05',
    paymentMethod: 'upi',
    isAppaReimbursable: false,
    isFamilyReimbursable: false,
    familyContactId: 'family-appa',
    familyContactName: 'Appa',
    appaSettled: true,
    createdAt: new Date().toISOString(),
  },
  // Amma: 300 expense, 100 repayment -> 200 balance
  {
    id: 't-3',
    type: 'expense',
    title: 'Medicines for Amma',
    amount: 300,
    category: 'Food',
    date: '2026-10-06',
    paymentMethod: 'cash',
    isAppaReimbursable: false,
    isFamilyReimbursable: true,
    familyContactId: 'family-amma',
    familyContactName: 'Amma',
    appaSettled: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: 't-4',
    type: 'repayment',
    title: 'Cash from Amma',
    amount: 100,
    category: 'Family',
    date: '2026-10-08',
    paymentMethod: 'cash',
    isAppaReimbursable: false,
    isFamilyReimbursable: false,
    familyContactId: 'family-amma',
    familyContactName: 'Amma',
    appaSettled: false,
    createdAt: new Date().toISOString(),
  },
  // Chinna Akka: 150 expense, 0 repayment -> 150 balance
  {
    id: 't-5',
    type: 'expense',
    title: 'Gift wrap for Chinna Akka',
    amount: 150,
    category: 'Shopping',
    date: '2026-10-10',
    paymentMethod: 'upi',
    isAppaReimbursable: false,
    isFamilyReimbursable: true,
    familyContactId: 'family-chinna-akka',
    familyContactName: 'Chinna Akka',
    appaSettled: false,
    createdAt: new Date().toISOString(),
  },
  // Personal Expense: 450 -> does NOT affect any family member!
  {
    id: 't-6',
    type: 'expense',
    title: 'Campus Canteen Lunch',
    amount: 450,
    category: 'Food',
    date: '2026-10-12',
    paymentMethod: 'upi',
    isAppaReimbursable: false,
    isFamilyReimbursable: false,
    appaSettled: false,
    createdAt: new Date().toISOString(),
  },
  // Freelance Income: 2000 -> does NOT affect family balances!
  {
    id: 't-7',
    type: 'income',
    title: 'Logo Design Project',
    amount: 2000,
    category: 'Freelance',
    date: '2026-10-15',
    paymentMethod: 'upi',
    isAppaReimbursable: false,
    isFamilyReimbursable: false,
    appaSettled: false,
    createdAt: new Date().toISOString(),
  },
];

const balances = calculateFamilyBalances(testTxs, contacts);

assert(
  balances.contactBalances['family-appa'].outstandingBalance === 300,
  'Appa balance is exactly ₹300 (₹500 eligible - ₹200 repaid)'
);

assert(
  balances.contactBalances['family-amma'].outstandingBalance === 200,
  'Amma balance is exactly ₹200 (₹300 eligible - ₹100 repaid)'
);

assert(
  balances.contactBalances['family-chinna-akka'].outstandingBalance === 150,
  'Chinna Akka balance is exactly ₹150 (₹150 eligible - ₹0 repaid)'
);

assert(
  balances.contactBalances['family-periya-akka'].outstandingBalance === 0,
  'Periya Akka balance is exactly ₹0 (no expenses or repayments)'
);

assert(
  balances.totalFamilyOutstanding === 650,
  'Total family outstanding is ₹650 (300 + 200 + 150 + 0)'
);

assert(
  balances.totalFamilyExpenses === 950,
  'Total family eligible expenses sum to ₹950 (500 + 300 + 150)'
);

assert(
  balances.totalFamilyRepayments === 300,
  'Total family repayments sum to ₹300 (200 + 100)'
);

// -----------------------------------------------------------------------------
// 3. IDEMPOTENT MIGRATION OF HISTORICAL APPA RECORDS
// -----------------------------------------------------------------------------
console.log('\nTest Group 3: Historical Appa Records Safe Migration');

const legacySampleTxs: Transaction[] = [
  {
    id: 'tx-1',
    type: 'expense',
    title: 'Metro Recharge',
    amount: 100,
    category: 'Travel',
    date: '2026-10-24',
    paymentMethod: 'upi',
    isAppaReimbursable: false,
    appaSettled: false,
    createdAt: '2026-10-24T09:30:00Z',
  },
  {
    id: 'tx-2',
    type: 'expense',
    title: 'Bus Pass (Appa)',
    amount: 40,
    category: 'Travel',
    date: '2026-10-23',
    paymentMethod: 'cash',
    isAppaReimbursable: true,
    appaSettled: false,
    createdAt: '2026-10-23T14:15:00Z',
  },
  {
    id: 'tx-9',
    type: 'repayment',
    title: 'Cash from Appa',
    amount: 300,
    category: 'Family',
    date: '2026-10-18',
    paymentMethod: 'cash',
    isAppaReimbursable: false,
    appaSettled: true,
    createdAt: '2026-10-18T09:00:00Z',
  },
  {
    id: 'tx-legacy-unknown',
    type: 'repayment',
    title: 'Settlement cash received',
    amount: 100,
    category: 'Family',
    date: '2026-10-17',
    paymentMethod: 'cash',
    isAppaReimbursable: false,
    appaSettled: false,
    createdAt: '2026-10-17T09:00:00Z',
  },
];

const migration = migrateAppaTransactions(legacySampleTxs, DEFAULT_FAMILY_CONTACTS);

assert(
  migration.migratedTransactions.length === legacySampleTxs.length,
  'Migration preserves total transaction count'
);

const migratedTx2 = migration.migratedTransactions.find((t) => t.id === 'tx-2');
assert(
  migratedTx2?.familyContactId === 'family-appa' &&
  migratedTx2?.familyContactName === 'Appa' &&
  migratedTx2?.isFamilyReimbursable === true &&
  migratedTx2?.isAppaReimbursable === true,
  'tx-2 (Bus Pass) assigned to Appa while preserving isAppaReimbursable'
);

const migratedTx9 = migration.migratedTransactions.find((t) => t.id === 'tx-9');
assert(
  migratedTx9?.familyContactId === 'family-appa' &&
  migratedTx9?.familyContactName === 'Appa' &&
  migratedTx9?.settlementStatus === 'settled',
  'tx-9 (Cash from Appa) confirmed and assigned to Appa'
);

const migratedUnknown = migration.migratedTransactions.find((t) => t.id === 'tx-legacy-unknown');
assert(
  migratedUnknown?.needsReview === true &&
  migratedUnknown?.familyContactId === undefined,
  'Unknown legacy repayment is flagged for manual review without being assigned to Amma or sisters'
);

// Idempotency check: running migration twice produces identical result
const migration2 = migrateAppaTransactions(migration.migratedTransactions, DEFAULT_FAMILY_CONTACTS);
assert(
  migration2.migratedCount === 0 &&
  migration2.migratedTransactions.length === migration.migratedTransactions.length,
  'Migration is idempotent and can be run repeatedly without duplicating transactions'
);

// -----------------------------------------------------------------------------
// 4. DUPLICATE PROTECTION & TRANSACTION MERGE LOGIC
// -----------------------------------------------------------------------------
console.log('\nTest Group 4: Duplicate Protection & Merge Logic');

// Simulate spreadsheet merge logic from Code.gs / AppContext
function mergeTransactions(remoteTxs: Transaction[], incomingTxs: Transaction[]): Transaction[] {
  const map = new Map<string, Transaction>();
  remoteTxs.forEach((t) => map.set(t.id, t));
  incomingTxs.forEach((t) => map.set(t.id, t));
  return Array.from(map.values());
}

const remoteDb: Transaction[] = [
  { id: 'tx-1', title: 'Metro Recharge', type: 'expense', amount: 100, category: 'Travel', date: '2026-10-24', paymentMethod: 'upi', isAppaReimbursable: false, appaSettled: false, createdAt: '' },
  { id: 'tx-2', title: 'Bus Pass (Appa)', type: 'expense', amount: 40, category: 'Travel', date: '2026-10-23', paymentMethod: 'cash', isAppaReimbursable: true, appaSettled: false, createdAt: '' },
  { id: 'tx-3', title: 'Poster Design', type: 'income', amount: 800, category: 'Freelance', date: '2026-10-22', paymentMethod: 'upi', isAppaReimbursable: false, appaSettled: false, createdAt: '' },
];

// Empty local state merge MUST NOT erase remote transactions
const emptySyncResult = mergeTransactions(remoteDb, []);
assert(
  emptySyncResult.length === 3 &&
  emptySyncResult.some((t) => t.id === 'tx-1') &&
  emptySyncResult.some((t) => t.id === 'tx-2') &&
  emptySyncResult.some((t) => t.id === 'tx-3'),
  'Empty local state merge NEVER erases remote database'
);

// Submitting duplicate ID updates existing transaction, never appends a duplicate row
const duplicateIncoming: Transaction[] = [
  { id: 'tx-1', title: 'Metro Recharge (Topup)', type: 'expense', amount: 120, category: 'Travel', date: '2026-10-24', paymentMethod: 'upi', isAppaReimbursable: false, appaSettled: false, createdAt: '' },
];

const duplicateMerged = mergeTransactions(remoteDb, duplicateIncoming);
assert(
  duplicateMerged.length === 3 &&
  duplicateMerged.find((t) => t.id === 'tx-1')?.amount === 120,
  'Duplicate transaction ID updates existing record without duplicating rows'
);

// -----------------------------------------------------------------------------
// TEST SUMMARY
// -----------------------------------------------------------------------------
console.log('\n======================================================');
console.log(`TEST RESULTS: ${passedTests} / ${totalTests} PASSED`);
if (passedTests === totalTests) {
  console.log('ALL VERIFICATION TESTS COMPLETED SUCCESSFULLY! ✓');
} else {
  console.error(`FAILED: ${totalTests - passedTests} tests failed.`);
  process.exit(1);
}
console.log('======================================================\n');
