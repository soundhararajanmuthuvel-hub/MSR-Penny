# MSR Penny 🪙

**MSR Penny** is a modern, single-user Personal Finance Progressive Web App (PWA) tailored for student life, freelance design projects, and family settlement tracking.

Built with **React 19**, **TypeScript**, **Tailwind CSS**, and **Vite**, with offline caching, home-screen installation on iPhone/Android, and optional dual-sync to **Google Sheets**.

---

## ✨ Features

- 📱 **Installable iPhone & Android PWA**: Fullscreen standalone experience with custom Apple touch icons and web manifest.
- 💰 **Home Dashboard**: Real-time calculated balances — available cash/bank balance, monthly budget burn rate, income, and emergency fund status.
- 👨‍👦 **Appa Settlement Ledger**: Dedicated tracking for family reimbursements (bus passes, semester train passes, academic printouts) separate from personal expenses.
- 💬 **WhatsApp Notification Engine**: Formatted click-to-chat links for both new reimbursable expenses and repayment acknowledgments with previous & updated balances.
- 🎨 **Freelance Design Tracker**: Milestone-based tracking for poster design and client projects with client balances, project costs, and automatic income logging.
- 📊 **Reports & History**: Filter by category, payment method (UPI / Cash), and date range with monthly breakdown charts.
- 🔄 **Google Sheets Dual-Sync**: Cloud backup and spreadsheet reconciliation via Google Apps Script webhooks.

---

## 🚀 Quick Start (Local Development)

```bash
# 1. Install dependencies
npm install

# 2. Start the development server (runs full-stack Express + Vite)
npm run dev

# 3. Open in browser
http://localhost:3000
```

---

## 📦 Production Build

```bash
# Type check and build optimized static assets to /dist
npm run build

# Preview production build locally
npm run preview
```

---

## 🐙 Push to GitHub Repository (`msr-penny`)

Follow these steps to initialize and push your code to your GitHub account:

1. **Create a new repository on GitHub**:
   - Go to [github.com/new](https://github.com/new)
   - Repository name: `msr-penny`
   - Set visibility to **Private** (recommended for personal finance) or **Public**
   - **Do not** initialize with a README, .gitignore, or license (these are already configured in this project).

2. **Run these terminal commands in your project folder**:

```bash
# Initialize git if not already initialized
git init

# Add all files (respects .gitignore: excludes node_modules, build output, data, and secret .env files)
git add .

# Create the initial commit
git commit -m "feat: initial commit of MSR Penny frontend & PWA"

# Set default branch to main
git branch -M main

# Link your GitHub repository (replace YOUR_GITHUB_USERNAME)
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/msr-penny.git

# Push to GitHub
git push -u origin main
```

---

## ⚡ Deploy to Vercel

### Step 1: Import Repository
1. Log in to [vercel.com](https://vercel.com).
2. Click **"Add New..."** → **"Project"**.
3. Select your GitHub repository: `msr-penny`.

### Step 2: Configure Project Settings
Vercel automatically detects the Vite framework using `vercel.json`:
- **Framework Preset**: `Vite`
- **Root Directory**: `./`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

### Step 3: Environment Variables (Optional)
In Vercel's **Environment Variables** settings, you can optionally configure:
- `VITE_APP_NAME`: `MSR Penny`
- `VITE_APPA_WHATSAPP_NUMBER`: e.g. `+919876543210` (Default number for Appa WhatsApp notifications)
- `VITE_GOOGLE_APPS_SCRIPT_URL`: URL to your Google Apps Script Web App for automatic sync.

*(Note: These can also be edited anytime directly in the app under Settings.)*

### Step 4: Click Deploy!
Your PWA will be live on your custom `*.vercel.app` domain with instant HTTPS and service worker support.

---

## 📊 Google Sheets Sync Setup (Optional)

To connect MSR Penny to your own Google Sheet:

1. Create a new Google Sheet in Google Drive.
2. In the sheet menu, open **Extensions** → **Apps Script**.
3. Replace the code in the script editor with:

```javascript
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Transactions Sheet
    var sheet = ss.getSheetByName("Transactions") || ss.insertSheet("Transactions");
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(["ID", "Date", "Title", "Type", "Amount", "Category", "Payment Method", "Appa Reimbursable", "Notes", "Created At"]);
    }
    
    if (data.transactions && data.transactions.length > 0) {
      // Clear old rows except header and overwrite with latest synced transactions
      if (sheet.getLastRow() > 1) {
        sheet.getRange(2, 1, sheet.getLastRow() - 1, 10).clearContent();
      }
      var rows = data.transactions.map(function(t) {
        return [
          t.id,
          t.date,
          t.title,
          t.type,
          t.amount,
          t.category,
          t.paymentMethod,
          t.isAppaReimbursable ? "YES" : "NO",
          t.notes || "",
          t.createdAt
        ];
      });
      sheet.getRange(2, 1, rows.length, 10).setValues(rows);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ success: true, count: data.transactions.length }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

4. Click **Deploy** → **New Deployment**:
   - Select type: **Web App**
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Copy the generated Web App URL and paste it into **Settings** → **Google Apps Script Webhook URL** inside MSR Penny.

---

## 🔒 Privacy & Security

- **No Secrets in Frontend**: Zero private credentials or API keys are bundled into client code.
- **Git Hygiene**: `.gitignore` strictly protects `.env*`, `data/`, `node_modules/`, and temporary build outputs from being committed to GitHub.
- **Client Storage**: All data is securely retained in browser `localStorage` and synchronized dynamically.
