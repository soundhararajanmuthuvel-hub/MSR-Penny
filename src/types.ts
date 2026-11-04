export type TransactionType = 'expense' | 'income' | 'repayment' | 'reconciliation';

export type PaymentMethod = 'upi' | 'cash';

export type TransactionCategory =
  | 'Travel'
  | 'Food'
  | 'College'
  | 'Shopping'
  | 'Freelance'
  | 'Academics'
  | 'Family'
  | 'Reconciliation'
  | 'Other';

export type AccountType = 'bank' | 'cash';

export interface Account {
  id: string; // 'acc-sbi' | 'acc-iob' | 'acc-cash'
  name: string;
  type: AccountType;
  openingBalance: number;
  openingDate: string; // YYYY-MM-DD
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Transfer {
  id: string;
  date: string; // YYYY-MM-DD
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  deleted?: boolean;
}

export interface FamilyContact {
  id: string;
  name: string;
  phoneNumber?: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  title: string;
  amount: number;
  category: TransactionCategory;
  date: string; // YYYY-MM-DD
  paymentMethod: PaymentMethod;
  isAppaReimbursable: boolean; // Kept for 100% backward compatibility
  appaSettled: boolean;        // Kept for 100% backward compatibility
  freelanceJobId?: string;
  milestoneTitle?: string;
  notes?: string;
  createdAt: string;
  // Family settlements extensions
  isFamilyReimbursable?: boolean;
  familyContactId?: string;
  familyContactName?: string;
  settlementStatus?: 'pending' | 'settled';
  repaymentForContactId?: string;
  needsReview?: boolean;
  isPendingSync?: boolean;
  isPendingDeletion?: boolean;
  // Accounts extension (Section 4)
  accountId?: string; // 'acc-sbi' | 'acc-iob' | 'acc-cash' | 'unassigned'
  accountName?: string;
  // FIFO Allocation Fields (Section 5)
  paidOnBehalf?: number;
  repaidSoFar?: number;
  outstandingAmount?: number;
  allocationStatus?: 'open' | 'partially_repaid' | 'settled';
  linkedRepaymentIds?: string[];
  // Archive & Concurrency Control
  archived?: boolean;
  archivedAt?: string;
  archiveBatchId?: string;
  updatedAt?: string;
  deleted?: boolean;
  deletedAt?: string;
}

export interface SettledArchiveItem {
  id: string;
  originalTransactionId: string;
  date: string;
  title: string;
  type: 'expense' | 'repayment';
  amount: number;
  category: string;
  paymentMethod: PaymentMethod;
  accountId: string;
  accountName: string;
  familyContactId: string;
  familyContactName: string;
  archivedAt: string;
  archiveBatchId: string;
  notes?: string;
}

export interface ReconciliationAdjustment {
  id: string;
  date: string;
  accountId: string;
  accountName: string;
  realBalance: number;
  computedBalance: number;
  adjustmentAmount: number; // realBalance - computedBalance
  notes?: string;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'ARCHIVE' | 'RESTORE' | 'RECONCILE' | 'MIGRATE';
  entityType: 'transaction' | 'account' | 'transfer' | 'repayment' | 'archive' | 'reconciliation';
  entityId: string;
  summary: string;
  status: 'SUCCESS' | 'FAILED' | 'ROLLED_BACK';
}

export interface DataHealthIssue {
  id: string;
  severity: 'error' | 'warning' | 'info';
  category:
    | 'duplicate_id'
    | 'invalid_field'
    | 'overdraw'
    | 'orphan'
    | 'calculation_mismatch'
    | 'pre_opening_date';
  title: string;
  description: string;
  recordId?: string;
  proposedFix?: string;
}

export interface DataHealthReport {
  timestamp: string;
  totalIssuesCount: number;
  errorsCount: number;
  warningsCount: number;
  issues: DataHealthIssue[];
  isHealthy: boolean;
}

export interface Milestone {
  id: string;
  title: string;
  amount: number;
  paid: boolean;
  paidAt?: string;
}

export interface ProjectCost {
  id: string;
  title: string;
  amount: number;
  date: string;
}

export interface FreelanceJob {
  id: string;
  title: string;
  clientName: string;
  totalFee: number;
  paidAmount: number;
  pendingAmount: number;
  status: 'in_progress' | 'completed' | 'awaiting_payment';
  dueDate: string;
  milestones: Milestone[];
  costs: ProjectCost[];
  createdAt: string;
  designType?: string;
  notes?: string;
}

export interface EmergencyFund {
  target: number;
  current: number;
  title: string;
  subtitle: string;
}

export interface SavingsGoal {
  id: string;
  title: string;
  target: number;
  current: number;
  icon: string;
  deadline?: string;
}

export interface SavingsState {
  emergencyFund: EmergencyFund;
  goals: SavingsGoal[];
}

export interface AppSettings {
  monthlyBudget: number;
  userName: string;
  appaPhoneNumber: string;
  googleAppsScriptUrl: string;
  googleSheetId: string;
  lastSyncedAt: string | null;
  syncEnabled: boolean;
  currency: string;
  familyContacts?: FamilyContact[];
  accountsConfigured?: boolean;
  reminderEnabled?: boolean;
  reminderTime?: string;
  skipReminderIfExpenseLogged?: boolean;
  pinLockEnabled?: boolean;
  pinHash?: string;
  autoArchiveSettledConfirmed?: boolean;
}

export interface FamilyNotificationData {
  type: 'expense' | 'repayment';
  title: string;
  amount: number;
  date: string;
  contactId: string;
  contactName: string;
  phoneNumber?: string;
  previousBalance: number;
  updatedBalance: number;
  paymentMethod?: string;
  accountId?: string;
  accountName?: string;
}

// Backward-compatible alias
export type AppaNotificationData = FamilyNotificationData;

export interface FamilyContactBalance {
  contact: FamilyContact;
  totalReimbursable: number;
  totalRepaid: number;
  outstandingBalance: number;
  pendingCount: number;
  lastSettlementDate?: string;
}

export interface AppState {
  transactions: Transaction[];
  freelanceJobs: FreelanceJob[];
  savings: SavingsState;
  settings: AppSettings;
  familyContacts?: FamilyContact[];
  accounts?: Account[];
  transfers?: Transfer[];
  settledArchive?: SettledArchiveItem[];
  reconciliations?: ReconciliationAdjustment[];
  auditLogs?: AuditLogEntry[];
}
