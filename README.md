# MSR Penny 🪙

[![React](https://img.shields.io/badge/React-19.0-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-7.0-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.3-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.0-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Node.js](https://img.shields.io/badge/Node.js-22.x-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.21-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![Google Apps Script](https://img.shields.io/badge/Google_Apps_Script-Cloud-4285F4?logo=google&logoColor=white)](https://developers.google.com/apps-script)
[![PWA Ready](https://img.shields.io/badge/PWA-Installable-FF6F00?logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

> **Smart Financial Tracking. Clearer Decisions.**  
> A modern personal finance and expense management platform designed to simplify financial tracking, family settlements, freelance income, and financial reporting.

**Developer:** Soundhararajan Muthuvel (MSR)  
**Live Application:** [https://msr-penny.vercel.app](https://msr-penny.vercel.app)  
**GitHub Repository:** [https://github.com/soundhararajanmuthuvel-hub/MSR-Penny](https://github.com/soundhararajanmuthuvel-hub/MSR-Penny)  

---

## 1. Project Overview

**MSR Penny** is a production-grade, single-owner personal finance Progressive Web Application (PWA) built to solve real-world cash flow tracking, student-life budget discipline, freelance client invoicing, and family debt settlements.

Unlike generic budgeting apps that enforce rigid multi-tenant SaaS structures, MSR Penny is engineered around a **zero-running-balance mathematical ledger** paired with a serverless **Google Sheets** persistence bridge. Google Sheets acts as the user's private, auditable, and perpetual source of truth, while the React 19 PWA provides an offline-first, native-feeling mobile experience.

### Key Value Propositions
- 📱 **Mobile-First Progressive Web App (PWA)**: Installable on iOS (Safari Add to Home Screen) and Android (WebAPK) with offline caching and background sync.
- 🧮 **Pure Mathematical Ledger**: Balances are never statically stored; they are computed dynamically from verified opening balances, income streams, expenses, transfers, and reconciliation adjustments.
- 👨‍👩‍👧‍👦 **Multi-Contact Family Settlement Ledger**: Manages reimbursable family expenses for Appa, Amma, and Sisters using strict First-In, First-Out (FIFO) repayment allocation and pre-formatted WhatsApp settlement links.
- 💼 **Freelance Design Lifecycle Manager**: Tracks freelance design milestones, client advances, outstanding receivables, and direct expense logging.
- 🔒 **Enterprise-Grade Privacy & Security**: 4-digit cryptographic PIN lock with brute-force lockout, server-side credential isolation, and isolated public demonstration mode.

---

## 2. System Architecture

```
┌────────────────────────────────────────────────────────┐
│               MSR Penny Client (PWA)                   │
│         React 19 • TypeScript • Tailwind CSS 4         │
└───────────────────────────┬────────────────────────────┘
                            │
               HTTPS JSON   ▼   Service Worker Cache
┌────────────────────────────────────────────────────────┐
│            Vercel Serverless Function Layer            │
│                 /api/data (Consolidated)               │
│        /api/shortcut  •  /api/push  •  /api/cron       │
└───────────────────────────┬────────────────────────────┘
                            │
              HTTPS Webhook ▼ (doGet / doPost)
┌────────────────────────────────────────────────────────┐
│             Google Apps Script (Code.gs)               │
│        LockService Concurrency • Data Validation       │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼ Spreadsheet API
┌────────────────────────────────────────────────────────┐
│               Google Sheets Database                   │
│   Accounts • Transactions • Transfers • FamilyContacts │
│     FreelanceJobs • Savings • SettledArchive • Logs    │
└────────────────────────────────────────────────────────┘
```

For complete technical specifications, see [System Architecture Documentation](docs/ARCHITECTURE.md).

---

## 3. Core Features

### 3.1 Executive Financial Dashboard
- **Total Available Money**: Authoritatively aggregated across active liquid accounts (e.g. SBI Main + IOB Second + Physical Cash).
- **Receivables & Net Worth**: Displays outstanding family reimbursables alongside total personal net worth ($\text{Available} + \text{Receivables}$).
- **Monthly Budget Burn Rate**: Tracks spending velocity and remaining days in the `Asia/Kolkata` billing cycle.
- **Emergency Fund Buffer**: Visual progress bar tracking progress toward living buffer goals.

### 3.2 Transaction Management & Safeguards
- **Cash Deficit Safeguard**: Detects if an expense exceeds physical cash in hand, warning the user and suggesting an ATM withdrawal transfer (SBI → Cash) before balance corruption can occur.
- **Bank Overdraw Warning**: Instant warning dialog when an expense exceeds account balance.
- **Multi-Criteria Search & Filter**: Real-time filtering by text, category, payment method (UPI, Cash, Card, NetBanking), and date.

### 3.3 Family Settlement Engine
- **Dedicated Multi-Contact Ledger**: Appa, Amma, Chinna Akka, and Periya Akka.
- **Strict FIFO Allocation**: Repayments automatically extinguish the oldest unsettled expenses first.
- **Collapsible Settled Section**: Members with ₹0 balance are organized into a clean collapsible accordion, preventing visual clutter while preserving full history.
- **Instant WhatsApp Settlements**: Generates formatted, polite summary messages with click-to-chat links (`wa.me`).

### 3.4 Freelance Project Tracker
- Milestone billing (Advance, Iteration 1, Final Approval).
- Tracks client receivables, project costs, and automatic income recognition upon payment.

### 3.5 Reports, Analytics & Data Health Scanner
- **This Month Net**: Calculates inflows minus personal expenses, cleanly displaying pass-through family expenditures as a separate metric.
- **Category & Payment Distribution**: Visual spending breakdown charts.
- **Automated Data Health Scanner**: Runs one-click diagnostic checks for orphaned transactions, pre-opening dates, and account imbalances.

### 3.6 Settings, Accounts & Security
- **Audited Opening Balances Editor**: Edit baseline opening balances and dates directly from the UI.
- **Balance Reconciliation Assistant**: Passbook mismatch calculator suggesting exact opening balance adjustments.
- **4-Digit PIN Lock**: Salted client-side PIN hashing with 5-attempt automated lockout protection.
- **Public Demo Mode**: Reviewers can explore the app instantly with fictional data without requiring a Google account or touching private sheets.

For an exhaustive feature inventory, see [Features Specification](docs/FEATURES.md).

---

## 4. Technology Stack

| Domain | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Frontend Framework** | React | `19.0.1` | Concurrent UI rendering and component hierarchy |
| **Language** | TypeScript | `7.0.2` | Full-stack static type safety and contract enforcement |
| **Build Tooling** | Vite | `8.3.4` | Ultra-fast HMR and optimized production bundling |
| **Styling** | Tailwind CSS | `4.3.3` | Utility-first responsive styling and glassmorphism |
| **Icons & Typography** | Google Fonts | Inter / Material Symbols | Clean, professional typography and iconography |
| **PWA & Offline** | Workbox (`vite-plugin-pwa`) | `2.0.0` | Service worker precaching, offline fallback, and install manifest |
| **Serverless API** | Vercel Edge / Serverless | Node 20+ | Low-latency API routing and Apple Shortcuts webhook |
| **Backend & Dev Server**| Express | `4.21.2` | Local development API server and middleware mount |
| **Database / Ledger** | Google Sheets | Cloud | Relational, auditable persistent source of truth |
| **Database Scripting** | Google Apps Script | V8 Runtime | Serverless spreadsheet mutation engine and web app |

---

## 5. Project Structure

```
MSR-Penny/
├── .env.example               # Template for environment configuration
├── .gitignore                 # Excludes secrets, node_modules, and build artifacts
├── Code.gs                    # Root Google Apps Script engine
├── index.html                 # Application entry point with PWA metadata
├── package.json               # Dependencies, scripts, and project metadata
├── README.md                  # Executive portfolio documentation
├── server.ts                  # Local Express development server
├── tsconfig.json              # TypeScript root configuration
├── vercel.json                # Vercel serverless routing, crons, and headers
├── vite.config.ts             # Vite bundler, Tailwind, and PWA plugin setup
│
├── api/                       # Vercel Serverless Functions (Max 4 functions)
│   ├── cron.ts                # Scheduled daily reminder cron
│   ├── data.ts                # Consolidated data router (state, txs, accounts)
│   ├── push.ts                # Web Push VAPID subscription handler
│   ├── shortcut.ts            # High-speed Apple Shortcuts / Siri webhook
│   └── tsconfig.json          # Isolated TypeScript configuration for lambdas
│
├── docs/                      # Professional Technical Documentation
│   ├── ARCHITECTURE.md        # Comprehensive system architecture and diagrams
│   ├── DEPLOYMENT.md          # Production Vercel deployment and rollback guide
│   ├── DEVELOPMENT.md         # Local setup, testing, and contribution manual
│   ├── FEATURES.md            # Complete feature matrix and functional specs
│   └── SECURITY.md            # Threat model, PII protection, and authentication
│
├── google-apps-script/        # Dedicated Google Apps Script Workspace
│   ├── Code.gs                # Authoritative Google Apps Script Web App code
│   └── README.md              # Setup and deployment manual for Google Sheets
│
├── public/                    # Static assets, web manifest, and PWA icons
│   ├── apple-touch-icon.png   # iOS home screen touch icon
│   ├── favicon-32x32.png      # Browser favicon
│   ├── msr-penny-logo.png     # Official branding logo
│   ├── pwa-192x192.png        # Android standard PWA icon
│   └── pwa-512x512.png        # Android high-res & splash icon
│
├── scripts/                   # Automated Verification Test Harness (8 Test Suites)
│   ├── test-balance-calculator.ts
│   ├── test-family-settlements.ts
│   ├── test-fifo-and-archive.ts
│   ├── test-freelance-flow.ts
│   ├── test-opening-balance-flow.ts
│   ├── test-push-and-cron.ts
│   ├── test-shortcut-endpoint.ts
│   └── test-two-way-sync.ts
│
└── src/                       # Application Source Code
    ├── App.tsx                # Top-level view routing and modal coordination
    ├── main.tsx               # React application bootstrapping
    ├── types.ts               # Core domain models and interface contracts
    ├── components/            # Modular UI components and modal dialogs
    │   ├── AccountSettingsModal.tsx
    │   ├── AccountTransferModal.tsx
    │   ├── AddTransactionModal.tsx
    │   ├── AppaSettlementScreen.tsx
    │   ├── BalanceReconciliationModal.tsx
    │   ├── BottomNav.tsx
    │   ├── DataHealthModal.tsx
    │   ├── FreelanceScreen.tsx
    │   ├── Header.tsx
    │   ├── HistoryScreen.tsx
    │   ├── HomeScreen.tsx
    │   ├── PinLockModal.tsx
    │   ├── PinSetupModal.tsx
    │   ├── ProfileModal.tsx
    │   ├── PWAInstallBanner.tsx
    │   ├── ReportsScreen.tsx
    │   ├── SavingsScreen.tsx
    │   └── TransactionDetailModal.tsx
    ├── context/               # Global state management
    │   └── AppContext.tsx     # Unified state provider and sync orchestrator
    ├── data/                  # Fictional seed data and defaults
    │   └── initialData.ts
    └── utils/                 # Pure mathematical utility modules
        ├── balanceCalculator.ts
        ├── categoryIcons.ts
        ├── familyMigration.ts
        ├── fifoAllocation.ts
        └── phoneNormalizer.ts
```

---

## 6. Local Development Quickstart

### Prerequisites
- Node.js `v20.x` or `v22.x`
- npm `v10+`
- Git

### 1. Clone & Install
```bash
git clone https://github.com/soundhararajanmuthuvel-hub/MSR-Penny.git
cd MSR-Penny
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env.local
```

### 3. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 7. Automated Test Suite

MSR Penny includes a comprehensive, dependency-free automated test harness executing **8 test suites** that verify mathematical invariants, balance formulas, and data synchronization:

```bash
npm test
```

### Verified Test Suites:
1. `test-balance-calculator.ts` — 40 assertions verifying mathematical balance calculations.
2. `test-family-settlements.ts` — Multi-contact calculations, phone normalization, and WhatsApp messaging.
3. `test-two-way-sync.ts` — Bidirectional sync, offline queue, and deduplication.
4. `test-freelance-flow.ts` — Milestone billing, client payments, and income recognition.
5. `test-shortcut-endpoint.ts` — Secret token authorization and Apple Shortcuts payloads.
6. `test-push-and-cron.ts` — VAPID web push notifications and daily reminder scheduling.
7. `test-fifo-and-archive.ts` — First-In, First-Out debt allocation and cold storage archiving.
8. `test-opening-balance-flow.ts` — Opening balance editing, real passbook matching, and ATM detection.

---

## 8. Security & Privacy Highlights

- **Zero PII Exposure**: No real personal phone numbers, bank account numbers, or private addresses are stored in the codebase. All demo data uses standard mock entries (e.g. `+919876543210`).
- **Demo Mode Isolation**: Recruiters and evaluators can explore the live application at [https://msr-penny.vercel.app](https://msr-penny.vercel.app) in Demo Mode with zero risk to production data.
- **Client-Side PIN Protection**: 4-digit PIN lock with an automated 5-minute cooldown timer triggered after 5 consecutive incorrect attempts.
- **Serverless Secrets**: Privileged credentials (`GOOGLE_APPS_SCRIPT_URL`, `SHORTCUT_SECRET_TOKEN`, `CRON_SECRET`) are strictly maintained within serverless environment variables and are never baked into client-side code.

For complete security specifications, see [Security Architecture](docs/SECURITY.md).

---

## 9. Future Roadmap

- [ ] **Multi-Currency Support**: Dynamic currency switching for international freelance clients (USD, EUR, GBP).
- [ ] **OCR Receipt Scanner**: Client-side image receipt scanning using on-device WebAssembly OCR.
- [ ] **Automated Bank Statement CSV Importer**: Drag-and-drop CSV parser with intelligent transaction categorization.
- [ ] **Dark Mode / Spatial Theme**: Full system-preferred dark theme supporting OLED battery savings.

---

## 10. Developer & Contact

**Soundhararajan Muthuvel (MSR)**  
*Full-Stack Developer & Freelance Designer*  

- **GitHub:** [@soundhararajanmuthuvel-hub](https://github.com/soundhararajanmuthuvel-hub)
- **Live Demo:** [msr-penny.vercel.app](https://msr-penny.vercel.app)
- **Email:** [soundhararajanmuthuvel@gmail.com](mailto:soundhararajanmuthuvel@gmail.com)

---

## 11. License

This project is open-source and available under the terms of the [MIT License](./LICENSE).  
Copyright © 2026 Soundhararajan Muthuvel (MSR).
