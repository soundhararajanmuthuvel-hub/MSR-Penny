export type TransactionType = 'expense' | 'income' | 'repayment';

export type PaymentMethod = 'upi' | 'cash';

export type TransactionCategory =
  | 'Travel'
  | 'Food'
  | 'College'
  | 'Shopping'
  | 'Freelance'
  | 'Academics'
  | 'Family'
  | 'Other';

export interface Transaction {
  id: string;
  type: TransactionType;
  title: string;
  amount: number;
  category: TransactionCategory;
  date: string; // YYYY-MM-DD
  paymentMethod: PaymentMethod;
  isAppaReimbursable: boolean;
  appaSettled: boolean;
  freelanceJobId?: string;
  milestoneTitle?: string;
  notes?: string;
  createdAt: string;
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
}

export interface AppaNotificationData {
  type: 'expense' | 'repayment';
  title: string;
  amount: number;
  date: string;
  previousBalance: number;
  updatedBalance: number;
  paymentMethod?: string;
}

export interface AppState {
  transactions: Transaction[];
  freelanceJobs: FreelanceJob[];
  savings: SavingsState;
  settings: AppSettings;
}
