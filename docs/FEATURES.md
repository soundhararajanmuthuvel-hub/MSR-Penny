# MSR Penny — Features Specification

**Application Name:** MSR Penny  
**Tagline:** Smart Financial Tracking. Clearer Decisions.  
**Developer:** Soundhararajan Muthuvel (MSR)  
**Target Platform:** Mobile-First Responsive PWA (iOS, Android, Desktop)  

---

## 1. Feature Matrix Overview

| Module | Core Capabilities | Real-World Value |
| :--- | :--- | :--- |
| **Executive Dashboard** | Real-time liquid balances, net worth, monthly budget utilization, emergency buffer indicator | High-level situational financial awareness at a glance |
| **Transaction Management** | Incomes, expenses, account transfers, multi-criteria filters, search, cash deficit warnings | Accurate, friction-free daily expense tracking |
| **Family Settlements** | Multi-contact ledger (Appa, Amma, Sisters), FIFO debt allocation, WhatsApp reminders, auto-archiving | Transparent reimbursable family expense accounting |
| **Freelance Billing** | Client milestones, advance payments, project expense association, receivables tracker | Designed specifically for student/freelance designers |
| **Financial Reports** | Category breakdown, payment method distribution, month-by-month trends, data health scanner | Actionable insights into personal spending habits |
| **Security & Privacy** | 4-digit PIN lock with brute-force lockout, local demo mode, zero secret exposure | Enterprise-grade personal privacy protection |

---

## 2. Detailed Module Breakdown

### 2.1 Executive Dashboard
- **Total Available Money**: Authoritatively calculated as the sum of liquid balances across active accounts (e.g. SBI Main + IOB Second + Cash Wallet).
- **Receivables & Net Worth**: Displays outstanding family reimbursable amounts owed to the user alongside overall net worth ($\text{Available} + \text{Receivables}$).
- **Monthly Spending vs Budget**: Real-time progress bar computing percentage of monthly budget spent based on `Asia/Kolkata` calendar month.
- **Emergency Fund Buffer**: Displays progress toward a 1-month living buffer (configurable target).
- **Recent Activity Feed**: Chronological list of latest transactions with instant detail inspection modal.

### 2.2 Transaction Lifecycle & Accounts
- **Additive Expense & Income Logging**:
  - Amount in INR (₹) with decimal formatting.
  - Category assignment (Food, Travel, Education, Design Tools, Freelance, Bills, Entertainment).
  - Payment method tagging (`UPI`, `Cash`, `NetBanking`, `Card`).
  - Source account selection (`acc-sbi`, `acc-iob`, `acc-cash`).
- **Account-to-Account Transfers**:
  - Allows moving money between bank accounts or recording ATM cash withdrawals (SBI → Cash) with zero net impact on overall worth.
- **Deficit & Overdraft Safeguards**:
  - **Physical Cash Deficit Warning**: Alerts when a cash transaction exceeds physical cash in hand, suggesting an ATM withdrawal transfer before proceeding.
  - **Bank Overdraw Warning**: Warns when an expense exceeds current available balance.
- **Search & Multi-Filter Engine**: Real-time substring search by title/notes, category filtering, and payment method chips.

### 2.3 Family Settlements Ledger
- **Multi-Contact Support**: Tracks reimbursable family expenses for Appa (Father), Amma (Mother), Chinna Akka, and Periya Akka.
- **Strict FIFO Debt Allocation**: When a family member repays part of what is owed, the repayment is automatically allocated to the oldest pending reimbursable expenses first.
- **Collapsible Settled Section**: Family members with ₹0 outstanding balance are neatly grouped into a collapsible "Settled Members" accordion, keeping pending balances prominently visible.
- **WhatsApp Direct Reminders**: Formats a polite, clear settlement summary in simple English and opens a pre-filled `wa.me` chat link with the contact.
- **Settlement Archiving**: Option to archive fully settled historical batches to cold storage, reducing active UI clutter while maintaining net balance integrity.

### 2.4 Freelance Project Management
- **Client & Project Tracking**: Designed for creative professionals to track design contracts (e.g., posters, branding, social media assets).
- **Milestone Billing**: Add multiple milestones (e.g., "50% Advance", "Final Delivery Approval").
- **Payment Linking**: Associate received client payments with specific invoices/milestones, automatically updating client outstanding balance and recording income in the ledger.

### 2.5 Reports & Data Health Scanner
- **This Month Net Metric**: Computes inflows minus personal expenses (excluding family pass-throughs) for clear monthly savings insights.
- **Family Outflow Visibility**: Separates personal expenditures from family reimbursable outflows (e.g., "₹0 personal spent + ₹757 for family").
- **Category & Payment Method Distribution**: Interactive percentage visualizations of spending patterns.
- **Automated Data Health Scanner**:
  - Scans entire ledger for orphaned records, missing account mappings, and pre-opening date transactions.
  - One-click diagnosis with clear severity levels (Errors, Warnings, Info).

### 2.6 Settings, Accounts & Security
- **Audited Opening Balances Editor**: Edit opening balances and baseline opening dates for SBI, IOB, and Cash directly within the app without altering transaction history.
- **Balance Reconciliation Helper**: Computes discrepancy between computed balance and actual bank passbook balance, providing a suggested opening balance correction.
- **Owner 4-Digit PIN Lock**:
  - Client-side cryptographic hash verification.
  - Brute-force protection: 5 consecutive failed attempts trigger an automated lockout with cooldown timer.
- **Bidirectional Google Sheets Sync**: One-tap manual sync, background automatic sync, and conflict resolution ensuring Google Sheets remains authoritative.
- **Interactive Demo Mode**: Seamless toggle allowing reviewers and recruiters to explore the application with rich fictional data without requiring their own Google Apps Script deployment.
