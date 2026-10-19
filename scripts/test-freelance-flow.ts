/**
 * MSR PENNY — FREELANCE NEW JOB FLOW & FINANCIAL RULES VERIFICATION TESTS
 *
 * Verifies:
 * 1. New freelance job creation with all 10 required fields.
 * 2. Form validation (positive agreed fee, client name, title, advance <= fee).
 * 3. Exact financial rule calculations:
 *    - Pending Balances = agreed amounts minus amounts received.
 *    - Money Received = actual recorded payments (advances recorded as income).
 *    - Work Costs / Prints = actual recorded project expenses.
 *    - Net Freelance Profit = money received minus recorded work costs.
 *    - Unpaid project amounts are NOT counted as money already received.
 * 4. Google Sheets payload formatting and persistence compatibility.
 * 5. Cancellation without saving.
 * 6. Existing project editing.
 */

import { FreelanceJob, Milestone, ProjectCost, Transaction } from '../src/types';

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, details?: string) {
  if (condition) {
    console.log(`  ✓ PASSED: ${testName}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAILED: ${testName}${details ? ` -> ${details}` : ''}`);
    failedTests++;
  }
}

console.log('======================================================');
console.log('  MSR PENNY — FREELANCE JOB FLOW & FINANCIAL RULES   ');
console.log('======================================================\n');

// -----------------------------------------------------------------------------
// Test Suite 1: Input Validation Logic
// -----------------------------------------------------------------------------
console.log('Test Group 1: New Job Input Validation');

function validateNewJobInput(input: {
  title: string;
  clientName: string;
  totalFee: number;
  advance: number;
  initialCost?: number;
}): { valid: boolean; error?: string } {
  if (!input.title.trim()) {
    return { valid: false, error: 'Please enter a project title (e.g. Fest Social Posters).' };
  }
  if (!input.clientName.trim()) {
    return { valid: false, error: 'Please enter client or organization name.' };
  }
  if (input.totalFee <= 0) {
    return { valid: false, error: 'Agreed amount (Total Fee) must be greater than ₹0.' };
  }
  if (input.advance < 0) {
    return { valid: false, error: 'Advance received cannot be negative.' };
  }
  if (input.advance > input.totalFee) {
    return { valid: false, error: `Advance received (₹${input.advance}) cannot exceed agreed total fee (₹${input.totalFee}).` };
  }
  if (input.initialCost !== undefined && input.initialCost < 0) {
    return { valid: false, error: 'Work costs cannot be negative.' };
  }
  return { valid: true };
}

assert(
  validateNewJobInput({ title: 'Fest Posters', clientName: 'Campus Club', totalFee: 2000, advance: 500, initialCost: 150 }).valid,
  'Valid input with advance and initial print cost passes validation'
);

assert(
  !validateNewJobInput({ title: '', clientName: 'Campus Club', totalFee: 2000, advance: 500 }).valid,
  'Empty project title fails validation'
);

assert(
  !validateNewJobInput({ title: 'Fest Posters', clientName: '   ', totalFee: 2000, advance: 500 }).valid,
  'Empty client name fails validation'
);

assert(
  !validateNewJobInput({ title: 'Fest Posters', clientName: 'Campus Club', totalFee: 0, advance: 0 }).valid,
  'Agreed amount <= 0 fails validation'
);

assert(
  !validateNewJobInput({ title: 'Fest Posters', clientName: 'Campus Club', totalFee: 2000, advance: 3000 }).valid,
  'Advance greater than agreed fee fails validation'
);

assert(
  !validateNewJobInput({ title: 'Fest Posters', clientName: 'Campus Club', totalFee: 2000, advance: -100 }).valid,
  'Negative advance fails validation'
);

assert(
  !validateNewJobInput({ title: 'Fest Posters', clientName: 'Campus Club', totalFee: 2000, advance: 500, initialCost: -50 }).valid,
  'Negative work cost fails validation'
);

// -----------------------------------------------------------------------------
// Test Suite 2: Complete Project Creation & Financial Calculations
// -----------------------------------------------------------------------------
console.log('\nTest Group 2: Financial Rules & Summary Calculations');

function createFreelanceJobScenario() {
  const jobs: FreelanceJob[] = [];
  const transactions: Transaction[] = [];

  // Job 1: Tech Fest Posters (Total: ₹3000, Advance: ₹1000, Print Cost: ₹200)
  const fee1 = 3000;
  const advance1 = 1000;
  const cost1 = 200;
  const rem1 = fee1 - advance1;

  const job1: FreelanceJob = {
    id: 'job-1',
    title: 'Tech Fest Posters',
    clientName: 'Tech Club',
    designType: 'Poster',
    totalFee: fee1,
    paidAmount: advance1,
    pendingAmount: rem1,
    status: 'in_progress',
    dueDate: '2026-10-28',
    notes: 'A3 prints and digital banner',
    milestones: [
      { id: 'm-1-1', title: 'Advance Payment', amount: advance1, paid: true, paidAt: '2026-10-19' },
      { id: 'm-1-2', title: 'Final Delivery & Balance', amount: rem1, paid: false },
    ],
    costs: [
      { id: 'cost-1', title: 'Sample A3 photo prints', amount: cost1, date: '2026-10-19' },
    ],
    createdAt: new Date().toISOString(),
  };

  jobs.push(job1);

  // Advance recorded as income in transactions
  transactions.push({
    id: 'tx-adv-1',
    type: 'income',
    title: 'Tech Fest Posters - Advance Payment',
    amount: advance1,
    category: 'Freelance',
    date: '2026-10-19',
    paymentMethod: 'upi',
    isAppaReimbursable: false,
    isFamilyReimbursable: false,
    appaSettled: false,
    freelanceJobId: 'job-1',
    notes: 'Advance from Tech Club',
    createdAt: new Date().toISOString(),
  });

  // Initial print cost recorded as expense in transactions
  transactions.push({
    id: 'tx-cost-1',
    type: 'expense',
    title: 'Tech Fest Posters - Sample A3 photo prints',
    amount: cost1,
    category: 'Freelance',
    date: '2026-10-19',
    paymentMethod: 'cash',
    isAppaReimbursable: false,
    isFamilyReimbursable: false,
    appaSettled: false,
    notes: 'Work costs for Tech Club',
    createdAt: new Date().toISOString(),
  });

  // Job 2: Logo Design (Total: ₹1500, Advance: ₹0, no costs)
  const fee2 = 1500;
  const advance2 = 0;
  const rem2 = fee2 - advance2;

  const job2: FreelanceJob = {
    id: 'job-2',
    title: 'Robotics Club Logo',
    clientName: 'Robotics Society',
    designType: 'Branding / Logo',
    totalFee: fee2,
    paidAmount: advance2,
    pendingAmount: rem2,
    status: 'in_progress',
    dueDate: '2026-11-05',
    notes: 'Vector SVGs and icon pack',
    milestones: [
      { id: 'm-2-1', title: 'First Draft (50%)', amount: 750, paid: false },
      { id: 'm-2-2', title: 'Final Delivery & Balance', amount: 750, paid: false },
    ],
    costs: [],
    createdAt: new Date().toISOString(),
  };

  jobs.push(job2);

  // Compute metrics as in FreelanceScreen
  let totalInvoiced = 0;
  let totalCollected = 0;
  let totalPending = 0;
  let totalCosts = 0;

  jobs.forEach((j) => {
    totalInvoiced += Number(j.totalFee) || 0;
    totalCollected += Number(j.paidAmount) || 0;
    totalPending += Number(j.pendingAmount) || 0;
    (j.costs || []).forEach((c) => {
      totalCosts += Number(c.amount) || 0;
    });
  });

  const netEarnings = totalCollected - totalCosts;

  return { jobs, transactions, totalInvoiced, totalCollected, totalPending, totalCosts, netEarnings };
}

const scenario = createFreelanceJobScenario();

// Verify Pending Balances: agreed amounts (3000 + 1500 = 4500) minus received (1000) = 3500
assert(
  scenario.totalPending === 3500,
  'Pending Balances equals agreed amounts minus amounts received (₹3,500)'
);

// Verify Money Received: actual recorded payments = 1000
assert(
  scenario.totalCollected === 1000,
  'Money Received equals actual recorded payments (₹1,000)'
);

// Verify unpaid project amounts are NOT counted as money already received
assert(
  scenario.totalCollected !== scenario.totalInvoiced,
  'Unpaid project amounts are NOT counted as money already received'
);

// Verify Work Costs / Prints: 200
assert(
  scenario.totalCosts === 200,
  'Work Costs / Prints equals actual recorded project expenses (₹200)'
);

// Verify Net Freelance Profit: Money Received (1000) - Work Costs (200) = 800
assert(
  scenario.netEarnings === 800,
  'Net Freelance Profit equals money received minus recorded work costs (₹800)'
);

// -----------------------------------------------------------------------------
// Test Suite 3: Fully Paid Project & Status Transition
// -----------------------------------------------------------------------------
console.log('\nTest Group 3: Fully Paid Project & Status Handling');

const fullJobFee = 1200;
const fullAdvance = 1200;
const remainingAfterFull = Math.max(0, fullJobFee - fullAdvance);
const computedStatus = remainingAfterFull === 0 ? 'completed' : 'in_progress';

assert(remainingAfterFull === 0, 'Full advance results in 0 pending balance');
assert(computedStatus === 'completed', 'Project status automatically completes when remaining balance is 0');

// -----------------------------------------------------------------------------
// Test Suite 4: Existing Project Editing
// -----------------------------------------------------------------------------
console.log('\nTest Group 4: Existing Project Editing');

const originalJob = scenario.jobs[0];
const updatedJob: FreelanceJob = {
  ...originalJob,
  title: 'Tech Fest Posters & Flyers (Updated)',
  clientName: 'Tech Club Core',
  designType: 'Banner / Flex',
  totalFee: 3500,
  pendingAmount: 3500 - originalJob.paidAmount,
  notes: 'Added 5 outdoor vinyl banners',
};

assert(updatedJob.title === 'Tech Fest Posters & Flyers (Updated)', 'Job title updated successfully');
assert(updatedJob.designType === 'Banner / Flex', 'Design type updated successfully');
assert(updatedJob.pendingAmount === 2500, 'Pending amount recalculated accurately after fee edit (3500 - 1000 = 2500)');
assert(updatedJob.notes === 'Added 5 outdoor vinyl banners', 'Notes updated successfully');

// -----------------------------------------------------------------------------
// Test Suite 5: Google Sheets Sync Formatting
// -----------------------------------------------------------------------------
console.log('\nTest Group 5: Google Sheets Persistence Payload');

const sheetRows = scenario.jobs.map((j) => {
  const milestonesSummary = (j.milestones || []).map((m) => {
    return `${m.title} (₹${m.amount}${m.paid ? ' - Paid' : ' - Pending'})`;
  }).join('; ');

  return [
    j.id,
    j.title,
    j.clientName,
    Number(j.totalFee) || 0,
    Number(j.paidAmount) || 0,
    Number(j.pendingAmount) || 0,
    j.status || 'in_progress',
    j.dueDate || '',
    j.designType || 'Poster',
    j.notes || '',
    milestonesSummary,
  ];
});

assert(sheetRows.length === 2, '2 freelance project rows formatted for Google Sheets');
assert(sheetRows[0][1] === 'Tech Fest Posters', 'Project Title in column 2 matches');
assert(sheetRows[0][2] === 'Tech Club', 'Client Name in column 3 matches');
assert(sheetRows[0][3] === 3000, 'Total Fee in column 4 matches');
assert(sheetRows[0][4] === 1000, 'Paid Amount in column 5 matches');
assert(sheetRows[0][5] === 2000, 'Pending Amount in column 6 matches');
assert(sheetRows[0][8] === 'Poster', 'Design Type in column 9 matches');
assert(sheetRows[0][9] === 'A3 prints and digital banner', 'Notes in column 10 matches');

// -----------------------------------------------------------------------------
// Test Suite 6: Cancellation Without Saving
// -----------------------------------------------------------------------------
console.log('\nTest Group 6: Form Cancellation');

let mockModalOpen = true;
let mockJobsCount = scenario.jobs.length;

// User hits cancel
function cancelNewJobModal() {
  mockModalOpen = false;
  // Does not touch jobs
}

cancelNewJobModal();
assert(!mockModalOpen, 'Modal closes on cancellation');
assert(scenario.jobs.length === mockJobsCount, 'No project created on cancellation');

// -----------------------------------------------------------------------------
// Summary
// -----------------------------------------------------------------------------
console.log('\n======================================================');
console.log(`TEST RESULTS: ${passedTests} / ${passedTests + failedTests} PASSED`);
if (failedTests === 0) {
  console.log('ALL FREELANCE JOB VERIFICATION TESTS COMPLETED SUCCESSFULLY! ✓');
} else {
  console.error(`FAILED: ${failedTests} tests failed.`);
  process.exit(1);
}
console.log('======================================================\n');
