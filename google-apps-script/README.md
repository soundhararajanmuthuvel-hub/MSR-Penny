# MSR Penny — Google Apps Script Backend

This directory contains the Google Apps Script (`Code.gs`) source code that powers the serverless Google Sheets integration for **MSR Penny**.

---

## 1. Architectural Overview

Google Sheets serves as the persistent, audit-trailed database and single source of truth for MSR Penny. Google Apps Script provides the serverless HTTP interface (Web App) handling bidirectional data synchronization, atomic transactions, account balance computations, and family settlement records.

```
┌─────────────────────────────────┐
│     MSR Penny Client (PWA)      │
│     React 19 + TypeScript       │
└────────────────┬────────────────┘
                 │
                 ▼ HTTPS (JSON payload)
┌─────────────────────────────────┐
│     Vercel Serverless / Lambda  │
│     /api/data  (Consolidated)   │
└────────────────┬────────────────┘
                 │
                 ▼ HTTPS Webhook (doGet / doPost)
┌─────────────────────────────────┐
│     Google Apps Script Web App  │
│     (Code.gs)                   │
└────────────────┬────────────────┘
                 │
                 ▼ Google Spreadsheet API
┌─────────────────────────────────┐
│     Google Sheets               │
│     - Transactions              │
│     - Accounts                  │
│     - Transfers                 │
│     - Family Contacts           │
│     - Freelance Projects        │
│     - Savings Goals             │
│     - Settlement Archive        │
│     - Audit Logs                │
└─────────────────────────────────┘
```

---

## 2. Security & Privacy Architecture

### Production vs Demo Separation
- **Private Personal Spreadsheet**: Your real financial data (actual bank balances, family contact numbers, personal expenses) resides in your private personal Google Sheet. Its Web App URL is strictly stored in **server-side environment variables** (`GOOGLE_APPS_SCRIPT_URL` in Vercel) and is **never committed to Git**.
- **Public Demonstration Mode**: For IT industry showcases, code reviews, and public demonstrations, the frontend runs with mock/demo seed data or connects to a dedicated, sanitized demo spreadsheet with fictional records.

### Authentication & Token Protection
- HTTP endpoints accept optional Bearer authentication or `X-Secret-Token` header verification matching `SHORTCUT_SECRET_TOKEN`.
- Automated brute-force prevention and input sanitization protect against invalid rows and script injection.

---

## 3. Deployment Instructions

### Step 1: Create a Google Sheet
1. Open [Google Sheets](https://sheets.new) and create a new spreadsheet.
2. Name the spreadsheet: `MSR Penny Database (Demo)` or `MSR Penny Database`.

### Step 2: Open Apps Script Editor
1. In the Google Sheets menu, click **Extensions** > **Apps Script**.
2. Replace all code in the script editor with the contents of [`Code.gs`](./Code.gs).

### Step 3: Deploy as Web App
1. Click **Deploy** > **New deployment**.
2. Select type: **Web app**.
3. Set description: `MSR Penny Production v3`.
4. Set **Execute as**: `Me (your Google account)`.
5. Set **Who has access**: `Anyone`.
6. Click **Deploy** and authorize the required permissions for Google Drive & Google Sheets.
7. Copy the generated **Web App URL** (format: `https://script.google.com/macros/s/.../exec`).

### Step 4: Configure Environment Variables
Set the URL in your local development or Vercel environment:

```env
# In Vercel Project Settings -> Environment Variables:
GOOGLE_APPS_SCRIPT_URL="https://script.google.com/macros/s/.../exec"
```

---

## 4. Supported Endpoints & Actions

| Method | Action (`?action=...`) | Description |
| :--- | :--- | :--- |
| `GET` | `get_all_data` | Atomically retrieves all accounts, transactions, contacts, freelance jobs, and settings. |
| `GET` | `health` | Performs data integrity audits (detects orphaned references, pre-opening dates, deficits). |
| `POST` | `sync_all` | Two-way batch sync merging offline transactions into the sheet without data loss. |
| `POST` | `add_transaction` | Appends a single validated transaction row and recalculates ledger metrics. |
| `POST` | `update_accounts` | Updates account metadata and opening balances (SBI, IOB, Cash). |
| `POST` | `record_repayment` | Records family reimbursement inflow and updates FIFO settlement status. |
| `POST` | `archive_settled` | Safely archives fully settled records into `Settled Archive` sheet preserving net balance invariants. |
| `POST` | `reconcile_balance` | Logs bank-statement reconciliation adjustments. |

---

## 5. Maintenance & Disaster Recovery

- **Atomic Sheet Backups**: The script supports automatic snapshots before destructive migrations.
- **Rollback Capabilities**: Any archived settlement batch can be restored seamlessly via `restore_archive_batch`.
- **Local Fallback**: If the Google Apps Script endpoint is temporarily unreachable or offline, MSR Penny automatically falls back to client-side indexed storage to queue transactions for background synchronization.
