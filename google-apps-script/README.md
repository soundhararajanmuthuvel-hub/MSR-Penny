# MSR Penny — Modular Google Apps Script Project

**Developer:** Soundhararajan Muthuvel (MSR)  
**Version:** 3.1.0  
**Target Runtime:** Google Apps Script V8 Engine  

---

## 1. Project Directory Structure

```
google-apps-script/
├── appsscript.json            # Google Apps Script project manifest
├── README.md                  # Comprehensive deployment and architecture manual
│
├── src/                       # Modular Google Apps Script Source Files
│   ├── Code.gs                # Main entry point (doGet, doPost, onOpen, routing)
│   ├── config.gs              # Sheet names, constants, and target spreadsheet resolver
│   ├── spreadsheetService.gs  # Low-level spreadsheet schema and range formatting
│   ├── transactionService.gs  # Transaction CRUD, deduplication, and batch sync
│   ├── settlementService.gs   # Family settlements, FIFO repayment allocation, and archive
│   ├── freelanceService.gs    # Freelance projects, accounts, transfers, and health check
│   ├── validationService.gs   # Payload, date, amount, and account schema validation
│   ├── responseUtils.gs       # Standardized JSON response helpers
│   └── security.gs            # Formula injection sanitization and script lock management
│
└── tests/
    └── testData.gs            # Realistic, fictional demo data seeder & clear utility
```

---

## 2. Deployment Workflows

You can deploy this project using either **Google Clasp CLI** (recommended for professional development) or the **Google Apps Script Web Editor** (for quick 1-click deployment).

### Option A: Professional Deployment via Google Clasp (CLI)
1. Install `@google/clasp` globally:
   ```bash
   npm install -g @google/clasp
   ```
2. Log in with your Google account:
   ```bash
   clasp login
   ```
3. Create or clone your Apps Script project linked to your Google Sheet:
   ```bash
   clasp clone "YOUR_SCRIPT_ID" --rootDir google-apps-script
   ```
4. Push all modular files to Google Apps Script:
   ```bash
   cd google-apps-script
   clasp push
   ```
5. Deploy a new version:
   ```bash
   clasp deploy --description "MSR Penny v3.1.0 Production"
   ```

---

### Option B: 1-Click Copy via Web Editor Bundle
For developers who prefer using the web editor at `script.google.com`:
1. Run the local bundler script:
   ```bash
   npm run bundle:gas
   # Or: npx tsx scripts/bundle-apps-script.ts
   ```
2. This compiles the modular files in `google-apps-script/src/` into a single, production-tested [`Code.gs`](../Code.gs).
3. Open your Google Sheet > **Extensions** > **Apps Script**.
4. Paste the contents of `Code.gs` and click **Save**.
5. Click **Deploy** > **New deployment** > select **Web app** > set **Who has access** to **Anyone**.

---

## 3. Security & Anti-Formula Injection Safeguards

- **Formula Injection Defense:** Any cell string starting with `=`, `+`, `-`, or `@` is automatically prefixed with a single quote (`'`) in `security.gs` to prevent CSV/Formula execution.
- **Concurrency Locking:** All `doGet` and `doPost` requests acquire a `LockService.getScriptLock()` with automatic timeouts to prevent dirty reads and race conditions during concurrent syncs.
- **Strict Separation of Demo Data:** The project comes pre-configured with safe, fictional demo records in `testData.gs`. Never connect public test environments to your personal production spreadsheet.
