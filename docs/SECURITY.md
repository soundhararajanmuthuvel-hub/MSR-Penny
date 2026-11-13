# MSR Penny — Security & Privacy Architecture

**Developer:** Soundhararajan Muthuvel (MSR)  
**Security Posture:** Single-Owner Confidential Finance, Zero PII Exposure, Sanitized Demo Isolation  

---

## 1. Security Philosophy & Threat Model

MSR Penny is designed to protect personal financial data, bank balances, and family contact details while remaining verifiable, demonstrable, and auditable by technical leaders and recruiters.

### Threat Vectors & Mitigations

| Threat Vector | Potential Impact | MSR Penny Mitigation |
| :--- | :--- | :--- |
| **Accidental Secret Leak in Client Bundle** | Exposure of Google Apps Script webhooks or API tokens in JavaScript assets | Strict boundary between `VITE_` public variables and server-side environment variables. Serverless lambdas mediate upstream calls. |
| **Public Showcase Exposing Personal Data** | Exposure of actual bank balances or family phone numbers during seminar/demo | Complete isolation between **Private Production Spreadsheet** and **Public Demonstration Mode**. Zero personal PII hardcoded in repository. |
| **Unauthorized Webhook Triggering** | Malicious injection of fake expenses into Google Sheets | Shared secret token authentication (`SHORTCUT_SECRET_TOKEN`), payload structure validation, and server-side rate limits. |
| **Physical Device Theft / Shoulder Surfing** | Unauthorized reading of personal balances on unlocked phone | 4-Digit Owner PIN Lock with 5-attempt automated lockout protection and exponential backoff cooldown. |
| **Data Corruption via Incomplete Writes** | Inconsistent ledger balances caused by interrupted syncs | Atomic updates in Google Apps Script using `LockService` with automatic backup snapshotting. |

---

## 2. Environment Variables & Secrets Management

### Public vs Server-Side Separation
- **`VITE_` Prefixed Variables**: Variables prefixed with `VITE_` (such as `VITE_APP_NAME` or `VITE_VAPID_PUBLIC_KEY`) are baked directly into the client JavaScript bundle and are visible to any browser inspector. **No confidential keys or passwords are ever prefixed with `VITE_`.**
- **Server-Side Environment Variables**: Credentials like `SHORTCUT_SECRET_TOKEN`, `VAPID_PRIVATE_KEY`, and `CRON_SECRET` reside solely in Vercel's secure environment settings (or `.env.local` for local execution) and are accessible only to serverless functions in Node.js.

### Git Hygiene & Secrets Scanning
- `.gitignore` strictly excludes `.env`, `.env.local`, `.env.*.local`, credentials files, and temporary test databases.
- Automated secret scanning is enforced prior to every production commit.

---

## 3. Google Apps Script & Google Sheets Security

### Separation of Production & Demo Data Sources
1. **Private Production Sheet**: Linked exclusively to the developer's personal Google Account. The private Web App URL is configured exclusively in serverless environment variables (`GOOGLE_APPS_SCRIPT_URL`) on Vercel.
2. **Public Demo Mode**: For public code review, recruitment evaluation, or live demonstrations, MSR Penny operates in **Demo Mode**:
   - Uses realistic, fictional sample data (e.g. Acme Corp client, Metro recharge, dummy contacts).
   - Operates in-memory or in local client storage, completely decoupled from the developer's personal Google Drive.
   - Allows reviewers to test all features (adding transactions, filtering, reports, transfers) without creating accounts or risking real data alteration.

### Google Apps Script Web App Permissions
- Apps Script Web Apps deployed with access "Anyone" can be triggered via HTTP. `Code.gs` implements:
  - Input validation: Rejects malformed payloads or missing required fields.
  - Concurrency control: Uses Google Apps Script `LockService.getScriptLock()` to serialize concurrent writes and prevent race conditions.
  - Data sanitization: Trims strings, parses numbers, and validates dates to prevent formula injection (`=` prefix attacks) in Google Sheets cells.

---

## 4. Owner Authentication & Brute-Force Protection

### 4-Digit PIN Lock
- Protects financial screens from unauthorized physical access when the mobile PWA remains open.
- Stored using client-side salted hashing in persistent storage.
- **Lockout Safeguard**:
  - Consecutive failed attempts are tracked in secure storage.
  - Upon 5 consecutive failed attempts, the application triggers a **5-minute security lockout timer**.
  - Emergency PIN reset requires explicit verification against a security challenge question or full data reset confirmation.

---

## 5. Network & API Security

- **Enforced HTTPS**: All communication between the PWA, Vercel Serverless Functions, and Google Apps Script occurs exclusively over TLS 1.3 / HTTPS.
- **Content Security & CORS**: Vercel serverless routes restrict unauthorized HTTP verbs and validate incoming Content-Types.
- **Apple Shortcuts Endpoint**: The `/api/shortcut` endpoint mandates an `X-Secret-Token` header or valid bearer authorization matching `SHORTCUT_SECRET_TOKEN` before parsing Siri or iOS Shortcut payloads.
