# MSR Penny — Local Development Guide

**Developer:** Soundhararajan Muthuvel (MSR)  
**Project:** MSR Penny  

---

## 1. Prerequisites

Before setting up MSR Penny locally, ensure your environment meets the following requirements:
- **Node.js**: `v20.x` or `v22.x` (LTS recommended)
- **Package Manager**: `npm v10+`
- **Git**: `v2.40+`
- **Modern Web Browser**: Chrome, Safari, Edge, or Firefox (with Service Worker support)

---

## 2. Quickstart Installation

```bash
# 1. Clone repository
git clone https://github.com/soundhararajanmuthuvel-hub/MSR-Penny.git
cd MSR-Penny

# 2. Install dependencies
npm install

# 3. Create local environment configuration
cp .env.example .env.local

# 4. Start full-stack development server
npm run dev
```

The application will start at `http://localhost:3000`.

---

## 3. Available NPM Scripts

| Command | Action | Notes |
| :--- | :--- | :--- |
| `npm run dev` | Starts Express backend and mounts Vite middleware | Live reload, API mocking, and local persistent SQLite/JSON database |
| `npm run build` | Compiles TypeScript and runs Vite production build | Emits optimized bundle and PWA service workers in `dist/` |
| `npm run lint` | Runs `tsc --noEmit` across client and server | Enforces strict type safety and zero compiler errors |
| `npm test` | Runs the full automated verification test suite | Executes 8 test suites testing pure calculation, FIFO, sync, and security |
| `npm run preview` | Previews the compiled production build locally | Tests production PWA service worker caching behavior |

---

## 4. Test Suite Architecture

MSR Penny includes a comprehensive, dependency-free automated test harness located in [`scripts/`](../scripts/):

```
scripts/
├── test-balance-calculator.ts    # 40 assertions verifying mathematical balance invariants
├── test-family-settlements.ts    # Tests multi-contact calculations and phone normalization
├── test-two-way-sync.ts          # Tests offline reconciliation, deduplication, and remote merge
├── test-freelance-flow.ts        # Tests milestone billing, project expenses, and payments
├── test-shortcut-endpoint.ts     # Tests Siri/Apple Shortcuts auth and payload validation
├── test-push-and-cron.ts         # Tests daily reminder scheduling and VAPID push payload
├── test-fifo-and-archive.ts      # Tests First-In-First-Out repayment allocation and cold storage
└── test-opening-balance-flow.ts  # Tests opening balance edits and "Match My Real Balance" math
```

To run all test suites:
```bash
npm test
```

---

## 5. Coding Standards & Git Conventions

### TypeScript Safety
- Explicit typing is required on all models, utility functions, and API responses.
- Avoid `any` unless required for generic low-level serialization.
- Ensure all components pass `npm run lint` with 0 warnings/errors.

### Git Commit Guidelines
Follow the Conventional Commits specification:
- `feat(module): add new functionality`
- `fix(module): resolve identified bug or mismatch`
- `docs(module): update technical documentation`
- `security(module): enhance authentication or privacy controls`
- `chore(module): maintenance and dependency updates`

### Privacy & Confidentiality Rule
**Never commit real financial data, real phone numbers, or private Google Sheets URLs.** All local seed data and automated tests must use fictional mock records.
