# MSR Penny — System Architecture

**Developer:** Soundhararajan Muthuvel (MSR)  
**Platform:** Mobile-First Progressive Web Application (React 19 + Vite + TypeScript)  
**Deployment:** Vercel Edge/Serverless Infrastructure  
**Authoritative Persistence:** Google Sheets via Google Apps Script Web App  

---

## 1. Executive Summary & Core Principles

**MSR Penny** is an enterprise-grade, single-owner personal finance architecture tailored for real-world cash flow tracking, multi-party family debt settlements, and freelance project lifecycle management.

### Foundational Design Invariants
1. **Zero Running Balances**: Balances are never statically stored in databases or UI state. Every balance (SBI, IOB, Cash, Total Available, Receivable, Net Worth) is purely computed on-the-fly from immutable transaction and transfer event streams starting from verified account opening balances.
2. **Authoritative Source of Truth**: Google Sheets remains the primary ledger. Local client state (`localStorage`) acts strictly as a low-latency read cache and offline optimistic queue.
3. **Additive, Non-Destructive Migrations**: Financial schemas evolve additively. No migration ever deletes or resets historical transaction data.
4. **FIFO Family Settlements**: Reimbursements and partial repayments allocate strictly First-In, First-Out across historical reimbursable expenses.

---

## 2. System Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER (PWA)                              │
│                                                                        │
│   ┌───────────────────┐    ┌──────────────────┐    ┌───────────────┐   │
│   │  React 19 UI      │◄──►│  AppContext      │◄──►│ ServiceWorker │   │
│   │  Tailwind CSS v4  │    │  (State Store)   │    │ (PWA Offline) │   │
│   └─────────┬─────────┘    └────────┬─────────┘    └───────────────┘   │
└─────────────┼───────────────────────┼──────────────────────────────────┘
              │                       │
              │                       ▼
              │              ┌──────────────────┐
              │              │ Pure Ledger Math │
              │              │ - Balance Calc   │
              │              │ - FIFO Allocation│
              │              │ - Phone Format   │
              │              └──────────────────┘
              ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     SERVERLESS / API LAYER (Vercel)                    │
│                                                                        │
│   ┌──────────────────┐    ┌──────────────────┐    ┌───────────────┐   │
│   │  /api/data       │    │  /api/shortcut   │    │  /api/push    │   │
│   │  (Consolidated   │    │  (Apple Shortcut │    │  & /api/cron  │   │
│   │   Data Router)   │    │   Webhook)       │    │  (Reminders)  │   │
│   └─────────┬────────┘    └────────┬─────────┘    └───────────────┘   │
└─────────────┼──────────────────────┼──────────────────────────────────┘
              │                      │
              ▼                      ▼ HTTPS (doGet / doPost)
┌────────────────────────────────────────────────────────────────────────┐
│                    PERSISTENCE LAYER (Google Apps Script)              │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │  Google Apps Script Web App (Code.gs)                           │   │
│   │  - Atomic Read/Write Locking (LockService)                     │   │
│   │  - Schema Validation & Data Sanitization                       │   │
│   │  - Automated Sheet Backups                                     │   │
│   └────────────────────────────────┬───────────────────────────────┘   │
│                                    ▼                                   │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │  Google Sheets Spreadsheet (Authoritative Database)            │   │
│   │  Tabs: Accounts | Transactions | Transfers | FamilyContacts    │   │
│   │        FreelanceJobs | Savings | SettledArchive | AuditLogs    │   │
│   └────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Frontend Architecture

### 3.1 Technology Stack
- **Framework:** React 19 (`react`, `react-dom`)
- **Language:** TypeScript 7 with strict type checking
- **Bundler:** Vite 8.3
- **Styling:** Tailwind CSS 4 with Glassmorphic UI utilities
- **Icons:** Google Material Symbols Outlined & Lucide Icons
- **PWA Engine:** `vite-plugin-pwa` with auto-updating Workbox service worker

### 3.2 State Management (`src/context/AppContext.tsx`)
The client leverages React Context API with optimistic UI updates:
1. **Initial Mount:** Hydrates immediately from `localStorage` cache for instant sub-second render.
2. **Background Reconciliation:** Dispatches a non-blocking fetch to `/api/state` or directly to Google Apps Script. Confirmed remote records reconcile atomically without discarding pending offline creations.
3. **Mutation Pipeline:**
   - Client generates UUID (`tx-timestamp-random`).
   - Pure calculation engine recomputes projected account balances.
   - Overdraw / deficit warnings trigger if an account or cash would drop below zero.
   - Mutation commits to local state and asynchronous queue dispatches to the server.

### 3.3 Pure Mathematical Ledger (`src/utils/`)
- `balanceCalculator.ts`:
  $$\text{Account Balance} = \text{Opening Balance} + \sum \text{Inflows} + \sum \text{Repayments Received} + \sum \text{Transfers In} - \sum \text{Expenses} - \sum \text{Transfers Out} \pm \text{Reconciliation Adjustments}$$
  *Rule:* Records dated prior to the account opening date are strictly excluded from balances and flagged as audit warnings.
- `fifoAllocation.ts`: Allocates repayments to historical reimbursable expenses in strict chronological order, computing partial repayment states (`open`, `partially_repaid`, `settled`).
- `familyMigration.ts`: Provides zero-loss schema migration from legacy single-contact fields (`isAppaReimbursable`) to relational multi-contact models (`familyContactId`).

---

## 4. Serverless API Architecture (`/api`)

To comply with the Vercel Hobby plan limit of **maximum 12 serverless functions**, MSR Penny implements the **Consolidated Serverless Router Pattern**:

```
api/
├── data.ts          # Consolidated router handling /api/state, /api/transactions,
│                    # /api/accounts, /api/transfers, /api/health, /api/archive, etc.
├── shortcut.ts      # Dedicated high-speed endpoint for Apple Shortcuts & iOS Siri
├── push.ts          # Web Push VAPID subscription and push dispatch
├── cron.ts          # Scheduled cron endpoint for daily reminder dispatch
└── tsconfig.json    # Isolated TypeScript configuration for lambda compilation
```

### URL Rewriting (`vercel.json`)
Incoming requests to `/api/*` are rewritten transparently to `/api/data?route=*`, preserving standard REST semantics for client callers while keeping serverless footprint at **exactly 4 functions**.

---

## 5. Google Sheets Persistence Architecture

The Google Sheets database structure is divided into dedicated relational worksheets:

1. **`Accounts`**: Account ID, Name, Type (`bank` \| `cash`), Opening Balance, Opening Date, Active status.
2. **`Transactions`**: Transaction ID, Date, Amount, Type (`income` \| `expense` \| `repayment`), Category, Payment Method, Account ID, Reimbursable flags, Family Contact ID, Freelance Job ID, Notes.
3. **`Transfers`**: Transfer ID, Date, Amount, Source Account ID, Destination Account ID, Fee, Notes.
4. **`FamilyContacts`**: Contact ID, Name, Relationship, Phone Number, Active status.
5. **`FreelanceJobs`**: Job ID, Client Name, Project Title, Total Amount, Received, Status, Milestones.
6. **`Savings`**: Emergency Fund allocation and custom savings goals with deadlines.
7. **`SettledArchive`**: Cold-storage sheet for fully settled historical family batches, preserving balance invariants while keeping active queries lean.
8. **`AuditLogs`**: Timestamped logs of automated migrations, reconciliation adjustments, and manual backups.

---

## 6. Offline & PWA Architecture

1. **Service Worker (`vite-plugin-pwa`)**: Caches static assets, stylesheets, fonts, and application shell using a Cache-First strategy.
2. **Offline Mutation Queue**: If network connectivity drops, transactions are stored in `localStorage` flagged with `isPendingSync: true`. When connectivity is restored, the client initiates a background batch synchronization via `sync_all`.
3. **Platform Installation**: Compliant with W3C Web App Manifest specifications, offering standalone installation on iOS (Safari Add to Home Screen) and Android (Chrome WebAPK).
