/**
 * MSR Penny — Google Apps Script Web App (Code.gs)
 * 
 * Features:
 * 1. Dual-sync with MSR Penny PWA (React / Vite / Vercel / Express).
 * 2. Automated sheets creation:
 *    - "Transactions": Complete ledger of all personal & college transactions.
 *    - "Appa_Ledger": Dedicated family reimbursement ledger with real-time balance calculations.
 *    - "Freelance_Projects": Client design jobs, fees, and milestone payouts.
 *    - "Savings_Goals": Emergency fund & student savings goals.
 *    - "Summary": High-level monthly and all-time financial dashboard.
 * 3. Duplicate protection (idempotency by transaction ID).
 * 4. Real-time balance calculations for Appa reimbursable expenses & repayments.
 * 5. Supports both doGet (read state) and doPost (sync/save).
 * 6. Built-in Google Sheets UI menu ('🪙 MSR Penny') for instant 1-click actions!
 * 
 * 🟢 DEPLOYMENT INSTRUCTIONS:
 * 1. Open your Google Sheet, click "Extensions" -> "Apps Script".
 * 2. Paste this complete Code.gs file and save (Ctrl+S or Cmd+S).
 * 3. Click "Deploy" (top right) -> "New deployment".
 * 4. Click the gear icon next to "Select type" -> select "Web app".
 * 5. Fill in:
 *    - Description: "MSR Penny Dual Sync"
 *    - Execute as: "Me" (your Google account)
 *    - Who has access: "Anyone" (CRITICAL: Must be "Anyone" so MSR Penny can push data)
 * 6. Click "Deploy", authorize permissions, and copy the "Web app URL" (ends in /exec).
 * 7. Paste this URL into MSR Penny's Sync settings.
 */

// Helper to return standardized JSON response with CORS headers
function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Custom Menu inside Google Sheets
 * Appears automatically when opening the Google Sheet!
 */
function onOpen() {
  try {
    var ui = SpreadsheetApp.getUi();
    ui.createMenu('🪙 MSR Penny')
      .addItem('🚀 Setup All Sheets (Emerald Headers)', 'setupInitialSheets')
      .addItem('📥 Import / Seed Demo Data', 'seedSampleData')
      .addItem('🗑️ Clear All Demo Data (Keep Clean Headers)', 'clearAllDataKeepHeaders')
      .addItem('🔄 Recalculate Appa Ledger & Balance', 'menuRebuildAppaLedger')
      .addSeparator()
      .addItem('ℹ️ Webhook URL & Deployment Guide', 'showWebhookHelp')
      .addToUi();
  } catch (e) {
    // Suppress if running in headless web context
  }
}

/**
 * Safe spreadsheet resolver:
 * Works whether container-bound to a sheet, or standalone with SPREADSHEET_ID.
 */
function getTargetSpreadsheet(payload) {
  var ss = null;
  try {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  } catch (e) {}

  if (!ss && payload) {
    if (payload.spreadsheetId) {
      try {
        ss = SpreadsheetApp.openById(payload.spreadsheetId);
      } catch (e) {}
    } else if (payload.spreadsheetUrl) {
      try {
        ss = SpreadsheetApp.openByUrl(payload.spreadsheetUrl);
      } catch (e) {}
    }
  }

  if (!ss) {
    try {
      var propId = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
      if (propId) {
        ss = SpreadsheetApp.openById(propId);
      }
    } catch (e) {}
  }

  return ss;
}

/**
 * 🟢 INITIALIZE ALL SHEETS IMMEDIATELY!
 * Can be run from the Apps Script toolbar or the 'MSR Penny' menu inside Google Sheets.
 */
function setupInitialSheets() {
  var ss = getTargetSpreadsheet();
  if (!ss) {
    throw new Error("No active Google Sheet linked! Please create this script via Google Sheets > Extensions > Apps Script.");
  }
  
  // 1. Create Transactions tab
  getOrCreateSheet(ss, "Transactions", getTransactionsHeader());
  
  // 2. Create Appa Ledger tab
  getOrCreateSheet(ss, "Appa_Ledger", [
    "Date", "Transaction ID", "Description", "Type", "Claimed Expense (₹)", "Repaid by Appa (₹)", "Running Balance (₹)", "Settled"
  ]);
  
  // 3. Create Freelance Projects tab
  getOrCreateSheet(ss, "Freelance_Projects", [
    "Job ID", "Project Title", "Client Name", "Total Fee (₹)", "Paid Amount (₹)", "Pending (₹)", "Status", "Due Date", "Milestones"
  ]);
  
  // 4. Create Savings & Goals tab
  getOrCreateSheet(ss, "Savings_Goals", [
    "Category", "Goal Title", "Current (₹)", "Target (₹)", "Progress %", "Target Date / Notes"
  ]);
  
  // 5. Create Summary Dashboard tab
  updateSummaryDashboard(ss, [], { monthlyBudget: 4000 });
  
  // Remove default blank "Sheet1" if it exists and other sheets are set up
  var defaultSheet = ss.getSheetByName("Sheet1");
  if (defaultSheet && ss.getSheets().length > 1) {
    try {
      ss.deleteSheet(defaultSheet);
    } catch (e) {
      // If Sheet1 cannot be deleted, ignore
    }
  }
  
  Logger.log("✅ Success! All 5 MSR Penny sheets created with emerald green headers.");
}

/**
 * 📥 Populates the sheet with initial sample / demo data
 */
function seedSampleData() {
  var ss = getTargetSpreadsheet();
  if (!ss) {
    throw new Error("No Google Sheet linked.");
  }
  setupInitialSheets();
  
  var sampleTransactions = [
    { id: "tx-1", date: "2026-10-24", title: "Metro Recharge", type: "expense", amount: 100, category: "Travel", paymentMethod: "upi", isAppaReimbursable: false, appaSettled: false, notes: "Station kiosk topup" },
    { id: "tx-2", date: "2026-10-23", title: "Bus Pass (Appa)", type: "expense", amount: 40, category: "Travel", paymentMethod: "cash", isAppaReimbursable: true, appaSettled: false, notes: "Claimed to Appa - Daily bus pass ticket" },
    { id: "tx-3", date: "2026-10-22", title: "Poster Design Client", type: "income", amount: 800, category: "Freelance", paymentMethod: "upi", isAppaReimbursable: false, appaSettled: false, notes: "Tech Fest poster first draft approval" },
    { id: "tx-4", date: "2026-10-21", title: "Canteen Lunch", type: "expense", amount: 65, category: "Food", paymentMethod: "upi", isAppaReimbursable: false, appaSettled: false, notes: "College campus meals" },
    { id: "tx-5", date: "2026-10-20", title: "Printouts", type: "expense", amount: 45, category: "College", paymentMethod: "cash", isAppaReimbursable: false, appaSettled: false, notes: "CAD assignment prints" },
    { id: "tx-6", date: "2026-10-22", title: "College Bus Pass", type: "expense", amount: 100, category: "Travel", paymentMethod: "upi", isAppaReimbursable: true, appaSettled: false, notes: "Monthly route 14 for Appa" },
    { id: "tx-7", date: "2026-10-19", title: "Train Semester Ticket", type: "expense", amount: 60, category: "Travel", paymentMethod: "upi", isAppaReimbursable: true, appaSettled: false, notes: "Suburban railway for family visit" },
    { id: "tx-8", date: "2026-10-16", title: "Engineering Printouts", type: "expense", amount: 40, category: "College", paymentMethod: "cash", isAppaReimbursable: true, appaSettled: false, notes: "CAD design sheets for home plan" },
    { id: "tx-9", date: "2026-10-18", title: "Cash from Appa", type: "repayment", amount: 300, category: "Family", paymentMethod: "cash", isAppaReimbursable: false, appaSettled: true, notes: "Handover morning settlement" },
    { id: "tx-10", date: "2026-10-05", title: "UPI from Appa", type: "repayment", amount: 300, category: "Family", paymentMethod: "upi", isAppaReimbursable: false, appaSettled: true, notes: "Direct bank credit" }
  ];

  var sampleJobs = [
    { id: "job-1", title: "College Fest Brand Poster", clientName: "Rohan Tech Fest", totalFee: 1600, paidAmount: 800, pendingAmount: 800, status: "in_progress", dueDate: "2026-10-28", milestones: [{ title: "Concept Sketches", amount: 800, paid: true }, { title: "Final Vector Delivery", amount: 800, paid: false }] }
  ];

  var sampleSavings = {
    emergencyFund: { current: 900, target: 3000, title: "Emergency Fund", subtitle: "Target: 1 Month Living Buffer" },
    goals: [{ title: "Drawing Tablet for Freelance", current: 4500, target: 12000, deadline: "2026-12-31" }]
  };

  syncAllData(ss, {
    transactions: sampleTransactions,
    freelanceJobs: sampleJobs,
    savings: sampleSavings,
    settings: { monthlyBudget: 4000 }
  });

  Logger.log("✅ Sample data populated successfully!");
}

/**
 * 🗑️ Wipes all data rows but keeps the emerald green headers clean!
 * Run this when starting fresh with your own real personal expenses.
 */
function clearAllDataKeepHeaders() {
  var ss = getTargetSpreadsheet();
  if (!ss) return;

  var sheetNames = ["Transactions", "Appa_Ledger", "Freelance_Projects", "Savings_Goals"];
  sheetNames.forEach(function(name) {
    var sheet = ss.getSheetByName(name);
    if (sheet && sheet.getLastRow() > 1) {
      sheet.getRange(2, 1, sheet.getLastRow() - 1, Math.max(1, sheet.getLastColumn())).clearContent();
    }
  });

  updateSummaryDashboard(ss, [], { monthlyBudget: 4000 });
  Logger.log("✅ All demo data wiped clean! Headers preserved.");
}

function menuRebuildAppaLedger() {
  var ss = getTargetSpreadsheet();
  if (ss) {
    rebuildAppaLedger(ss);
    updateSummaryDashboard(ss, [], {});
  }
}

function showWebhookHelp() {
  var html = HtmlService.createHtmlOutput(
    '<div style="font-family:sans-serif;padding:16px;line-height:1.6;">' +
    '<h3 style="color:#006948;margin-top:0;">🪙 MSR Penny Webhook Deployment</h3>' +
    '<p>To connect your MSR Penny web app to this Google Sheet:</p>' +
    '<ol>' +
    '<li>Click <b>Deploy</b> (top right) &gt; <b>New deployment</b>.</li>' +
    '<li>Select type: <b>Web app</b>.</li>' +
    '<li>Execute as: <b>Me</b>.</li>' +
    '<li>Who has access: <b style="color:#ba1a1a;">Anyone</b> (required).</li>' +
    '<li>Click <b>Deploy</b> and copy the Web app URL ending in <code>/exec</code>.</li>' +
    '<li>Open MSR Penny and paste it in the Sync modal.</li>' +
    '</ol>' +
    '</div>'
  ).setWidth(450).setHeight(320);
  SpreadsheetApp.getUi().showModalDialog(html, 'MSR Penny Webhook Setup');
}

/**
 * GET Handler
 * Used for live health check and balance queries.
 */
function doGet(e) {
  try {
    var ss = getTargetSpreadsheet();
    if (!ss) {
      return jsonResponse({
        status: "error",
        app: "MSR Penny Backend",
        message: "No active Google Sheet linked. Open your Google Sheet, click Extensions > Apps Script, and paste Code.gs there.",
        timestamp: new Date().toISOString()
      });
    }

    var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : 'status';
    
    if (action === 'get_balance' || action === 'get_appa_balance') {
      var balanceData = calculateAppaBalanceFromSheet(ss);
      return jsonResponse({
        success: true,
        appaBalance: balanceData.balance,
        totalEligible: balanceData.totalEligible,
        totalRepaid: balanceData.totalRepaid,
        itemCount: balanceData.itemCount,
        timestamp: new Date().toISOString()
      });
    }

    if (action === 'get_transactions') {
      var txSheet = getOrCreateSheet(ss, "Transactions", getTransactionsHeader());
      var data = txSheet.getDataRange().getValues();
      var transactions = [];
      if (data.length > 1) {
        for (var i = 1; i < data.length; i++) {
          var row = data[i];
          transactions.push({
            id: row[0],
            date: row[1],
            title: row[2],
            type: row[3],
            amount: Number(row[4]) || 0,
            category: row[5],
            paymentMethod: row[6],
            isAppaReimbursable: String(row[7]).toUpperCase() === 'YES',
            appaSettled: String(row[8]).toUpperCase() === 'YES',
            notes: row[9],
            createdAt: row[10]
          });
        }
      }
      return jsonResponse({
        success: true,
        count: transactions.length,
        transactions: transactions
      });
    }

    // Default status info
    var currentBalance = calculateAppaBalanceFromSheet(ss);
    return jsonResponse({
      status: "online",
      app: "MSR Penny Backend",
      version: "1.3.0",
      activeSpreadsheet: ss.getName(),
      sheetUrl: ss.getUrl(),
      appaBalance: currentBalance.balance,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    return jsonResponse({
      success: false,
      error: err.toString()
    });
  }
}

/**
 * POST Handler
 * Receives synchronization data or single transactions from MSR Penny.
 */
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(15000);

  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ success: false, error: "Empty request body received." });
    }

    var payload;
    try {
      payload = JSON.parse(e.postData.contents);
    } catch (parseError) {
      return jsonResponse({ success: false, error: "Invalid JSON format: " + parseError.toString() });
    }

    var ss = getTargetSpreadsheet(payload);
    if (!ss) {
      return jsonResponse({
        success: false,
        error: "No Google Sheet linked! Please open your Google Sheet, click Extensions > Apps Script, and paste Code.gs there."
      });
    }

    var action = payload.action || 'sync_all';

    // 1. Wipe / Clear Demo Data action
    if (action === 'clear_data') {
      clearAllDataKeepHeaders();
      return jsonResponse({
        success: true,
        message: "Google Sheet demo data wiped clean! Headers preserved.",
        timestamp: new Date().toISOString()
      });
    }

    // 2. Single Transaction Add / Upsert (Idempotent with duplicate prevention)
    if (action === 'add_transaction' || (payload.transaction && !payload.transactions)) {
      var tx = payload.transaction || payload;
      var result = saveSingleTransaction(ss, tx);
      return jsonResponse(result);
    }

    // 3. Full State Sync (or sync with empty transactions when user cleared demo data)
    if (action === 'sync_all' || Array.isArray(payload.transactions)) {
      var syncResult = syncAllData(ss, payload);
      return jsonResponse(syncResult);
    }

    return jsonResponse({ success: false, error: "Unknown action: " + action });
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  } finally {
    lock.releaseLock();
  }
}

/**
 * Sync entire application state into organized sheets
 */
function syncAllData(ss, payload) {
  var txList = payload.transactions || [];
  var jobsList = payload.freelanceJobs || [];
  var savingsData = payload.savings || {};
  var settingsData = payload.settings || {};

  // 1. Transactions Sheet
  var txSheet = getOrCreateSheet(ss, "Transactions", getTransactionsHeader());
  if (txSheet.getLastRow() > 1) {
    var lastCol = Math.max(1, txSheet.getLastColumn());
    txSheet.getRange(2, 1, txSheet.getLastRow() - 1, lastCol).clearContent();
  }

  if (txList.length > 0) {
    var txRows = txList.map(function(t) {
      return [
        t.id || "",
        formatDateForSheet(t.date),
        t.title || "",
        t.type || "expense",
        Number(t.amount) || 0,
        t.category || "General",
        t.paymentMethod || "upi",
        t.isAppaReimbursable ? "YES" : "NO",
        t.appaSettled ? "YES" : "NO",
        t.notes || "",
        t.createdAt || new Date().toISOString()
      ];
    });
    txSheet.getRange(2, 1, txRows.length, txRows[0].length).setValues(txRows);
    formatCurrencyColumn(txSheet, 5, 2, txRows.length);
  }

  // 2. Appa Ledger Sheet (Reimbursable expenses + repayments + running balance)
  syncAppaLedgerSheet(ss, txList);

  // 3. Freelance Projects Sheet
  syncFreelanceSheet(ss, jobsList);

  // 4. Savings & Goals Sheet
  if (savingsData) {
    syncSavingsSheet(ss, savingsData);
  }

  // 5. Dashboard Summary Sheet
  updateSummaryDashboard(ss, txList, settingsData);

  // Remove default blank "Sheet1" if user created a fresh spreadsheet
  var defaultSheet = ss.getSheetByName("Sheet1");
  if (defaultSheet && ss.getSheets().length > 1) {
    try {
      ss.deleteSheet(defaultSheet);
    } catch (e) {}
  }

  var balanceInfo = calculateAppaBalanceFromSheet(ss);

  return {
    success: true,
    message: "MSR Penny successfully synced with Google Sheets",
    syncedTransactions: txList.length,
    appaBalance: balanceInfo.balance,
    timestamp: new Date().toISOString()
  };
}

/**
 * Save or update a single transaction with backend duplicate protection.
 */
function saveSingleTransaction(ss, tx) {
  if (!tx || !tx.amount || Number(tx.amount) <= 0) {
    return { success: false, error: "Invalid transaction: positive amount required." };
  }

  var prevBalanceData = calculateAppaBalanceFromSheet(ss);
  var previousAppaBalance = prevBalanceData.balance;

  var txSheet = getOrCreateSheet(ss, "Transactions", getTransactionsHeader());
  var txId = tx.id || ('tx-' + Date.now());
  var isAppa = !!tx.isAppaReimbursable;
  var isRepayment = tx.type === 'repayment';

  var rowValues = [
    txId,
    formatDateForSheet(tx.date),
    tx.title || (isRepayment ? "Received from Appa" : "Expense"),
    tx.type || "expense",
    Number(tx.amount) || 0,
    tx.category || (isRepayment ? "Family" : "General"),
    tx.paymentMethod || "upi",
    isAppa ? "YES" : "NO",
    tx.appaSettled ? "YES" : "NO",
    tx.notes || "",
    tx.createdAt || new Date().toISOString()
  ];

  // Check for existing ID (Duplicate Protection / Idempotency)
  var data = txSheet.getDataRange().getValues();
  var existingRowIndex = -1;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(txId)) {
      existingRowIndex = i + 1; // 1-indexed for SpreadsheetApp
      break;
    }
  }

  if (existingRowIndex > 0) {
    txSheet.getRange(existingRowIndex, 1, 1, rowValues.length).setValues([rowValues]);
  } else {
    txSheet.appendRow(rowValues);
    formatCurrencyColumn(txSheet, 5, txSheet.getLastRow(), 1);
  }

  // Refresh Appa Ledger & Summary
  var updatedBalanceData = calculateAppaBalanceFromSheet(ss);
  var updatedAppaBalance = updatedBalanceData.balance;

  rebuildAppaLedger(ss);

  return {
    success: true,
    transactionId: txId,
    previousAppaBalance: previousAppaBalance,
    updatedAppaBalance: updatedAppaBalance,
    message: existingRowIndex > 0 ? "Transaction updated" : "Transaction saved successfully",
    timestamp: new Date().toISOString()
  };
}

/**
 * Calculates current Appa balance directly from the persisted records in Google Sheets
 */
function calculateAppaBalanceFromSheet(ss) {
  var txSheet = ss.getSheetByName("Transactions");
  if (!txSheet || txSheet.getLastRow() <= 1) {
    return { balance: 0, totalEligible: 0, totalRepaid: 0, itemCount: 0 };
  }

  var data = txSheet.getDataRange().getValues();
  var totalEligible = 0;
  var totalRepaid = 0;
  var itemCount = 0;

  for (var i = 1; i < data.length; i++) {
    var type = String(data[i][3]).toLowerCase();
    var amount = Number(data[i][4]) || 0;
    var isAppaReimbursable = String(data[i][7]).toUpperCase() === 'YES';

    if (isAppaReimbursable && type === 'expense') {
      totalEligible += amount;
      itemCount++;
    } else if (type === 'repayment') {
      totalRepaid += amount;
    }
  }

  var balance = Math.max(0, totalEligible - totalRepaid);
  return {
    balance: balance,
    totalEligible: totalEligible,
    totalRepaid: totalRepaid,
    itemCount: itemCount
  };
}

/**
 * Dedicated Appa Ledger Sheet: shows only reimbursable expenses, repayments, and running balance
 */
function syncAppaLedgerSheet(ss, transactions) {
  var appaSheet = getOrCreateSheet(ss, "Appa_Ledger", [
    "Date", "Transaction ID", "Description", "Type", "Claimed Expense (₹)", "Repaid by Appa (₹)", "Running Balance (₹)", "Settled"
  ]);

  if (appaSheet.getLastRow() > 1) {
    var lastCol = Math.max(1, appaSheet.getLastColumn());
    appaSheet.getRange(2, 1, appaSheet.getLastRow() - 1, lastCol).clearContent();
  }

  var relevant = (transactions || []).filter(function(t) {
    return t.isAppaReimbursable || t.type === 'repayment';
  }).sort(function(a, b) {
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  if (relevant.length === 0) return;

  var runningBalance = 0;
  var rows = [];

  for (var i = 0; i < relevant.length; i++) {
    var item = relevant[i];
    var isRepay = item.type === 'repayment';
    var amt = Number(item.amount) || 0;
    var claimed = isRepay ? 0 : amt;
    var repaid = isRepay ? amt : 0;

    runningBalance = Math.max(0, runningBalance + claimed - repaid);

    rows.push([
      formatDateForSheet(item.date),
      item.id,
      item.title,
      isRepay ? "Repayment" : "College Expense",
      claimed > 0 ? claimed : "-",
      repaid > 0 ? repaid : "-",
      runningBalance,
      item.appaSettled ? "YES" : "PENDING"
    ]);
  }

  appaSheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  formatCurrencyColumn(appaSheet, 5, 2, rows.length);
  formatCurrencyColumn(appaSheet, 6, 2, rows.length);
  formatCurrencyColumn(appaSheet, 7, 2, rows.length);
}

function rebuildAppaLedger(ss) {
  var txSheet = ss.getSheetByName("Transactions");
  if (!txSheet || txSheet.getLastRow() <= 1) return;

  var data = txSheet.getDataRange().getValues();
  var txList = [];
  for (var i = 1; i < data.length; i++) {
    txList.push({
      id: data[i][0],
      date: data[i][1],
      title: data[i][2],
      type: data[i][3],
      amount: Number(data[i][4]) || 0,
      isAppaReimbursable: String(data[i][7]).toUpperCase() === 'YES',
      appaSettled: String(data[i][8]).toUpperCase() === 'YES'
    });
  }
  syncAppaLedgerSheet(ss, txList);
}

/**
 * Freelance Projects Sheet
 */
function syncFreelanceSheet(ss, jobs) {
  var sheet = getOrCreateSheet(ss, "Freelance_Projects", [
    "Job ID", "Project Title", "Client Name", "Total Fee (₹)", "Paid Amount (₹)", "Pending (₹)", "Status", "Due Date", "Milestones"
  ]);

  if (sheet.getLastRow() > 1) {
    var lastCol = Math.max(1, sheet.getLastColumn());
    sheet.getRange(2, 1, sheet.getLastRow() - 1, lastCol).clearContent();
  }

  if (!jobs || jobs.length === 0) return;

  var rows = jobs.map(function(j) {
    var milestonesSummary = (j.milestones || []).map(function(m) {
      return m.title + " (₹" + m.amount + (m.paid ? " - Paid" : " - Pending") + ")";
    }).join("; ");

    return [
      j.id,
      j.title,
      j.clientName,
      Number(j.totalFee) || 0,
      Number(j.paidAmount) || 0,
      Number(j.pendingAmount) || 0,
      j.status || "in_progress",
      j.dueDate || "",
      milestonesSummary
    ];
  });

  sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  formatCurrencyColumn(sheet, 4, 2, rows.length);
  formatCurrencyColumn(sheet, 5, 2, rows.length);
  formatCurrencyColumn(sheet, 6, 2, rows.length);
}

/**
 * Savings & Goals Sheet
 */
function syncSavingsSheet(ss, savings) {
  var sheet = getOrCreateSheet(ss, "Savings_Goals", [
    "Category", "Goal Title", "Current (₹)", "Target (₹)", "Progress %", "Target Date / Notes"
  ]);

  if (sheet.getLastRow() > 1) {
    var lastCol = Math.max(1, sheet.getLastColumn());
    sheet.getRange(2, 1, sheet.getLastRow() - 1, lastCol).clearContent();
  }

  var rows = [];

  if (savings.emergencyFund) {
    var ef = savings.emergencyFund;
    var efPercent = ef.target > 0 ? Math.round((ef.current / ef.target) * 100) : 0;
    rows.push([
      "Emergency Fund",
      ef.title || "Emergency Fund",
      Number(ef.current) || 0,
      Number(ef.target) || 0,
      efPercent + "%",
      ef.subtitle || "1 Month Living Buffer"
    ]);
  }

  if (savings.goals && savings.goals.length > 0) {
    savings.goals.forEach(function(g) {
      var pct = g.target > 0 ? Math.round((g.current / g.target) * 100) : 0;
      rows.push([
        "Personal Goal",
        g.title,
        Number(g.current) || 0,
        Number(g.target) || 0,
        pct + "%",
        g.deadline || "Ongoing"
      ]);
    });
  }

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
    formatCurrencyColumn(sheet, 3, 2, rows.length);
    formatCurrencyColumn(sheet, 4, 2, rows.length);
  }
}

/**
 * Summary KPI Dashboard Sheet
 */
function updateSummaryDashboard(ss, transactions, settings) {
  var sheet = getOrCreateSheet(ss, "Summary", [
    "Metric", "Value", "Notes"
  ]);

  var balanceInfo = calculateAppaBalanceFromSheet(ss);
  var totalIncome = 0;
  var personalSpent = 0;

  (transactions || []).forEach(function(t) {
    var amt = Number(t.amount) || 0;
    if (t.type === 'income') {
      totalIncome += amt;
    } else if (t.type === 'expense' && !t.isAppaReimbursable) {
      personalSpent += amt;
    }
  });

  var availableCash = Math.max(0, totalIncome - personalSpent);
  var monthlyBudget = (settings && Number(settings.monthlyBudget)) || 4000;

  var formattedTime = "";
  try {
    formattedTime = Utilities.formatDate(new Date(), "Asia/Kolkata", "dd MMM yyyy, hh:mm a");
  } catch (e) {
    formattedTime = new Date().toISOString();
  }

  var summaryData = [
    ["Appa Outstanding Owed", "₹" + balanceInfo.balance, "Amount Appa owes back to you"],
    ["Available Balance", "₹" + availableCash, "Total Income minus personal spent"],
    ["Total Personal Expenses", "₹" + personalSpent, "Excludes college expenses claimed to Appa"],
    ["Total Freelance & Inflows", "₹" + totalIncome, "Direct student & client income"],
    ["Monthly Budget Target", "₹" + monthlyBudget, "Configured in MSR Penny Settings"],
    ["Last Synced Timestamp", formattedTime, "Synced from MSR Penny App"]
  ];

  if (sheet.getLastRow() > 1) {
    var lastCol = Math.max(1, sheet.getLastColumn());
    sheet.getRange(2, 1, sheet.getLastRow() - 1, lastCol).clearContent();
  }

  sheet.getRange(2, 1, summaryData.length, summaryData[0].length).setValues(summaryData);
}

// Helpers
function getTransactionsHeader() {
  return [
    "Transaction ID",
    "Date",
    "Description",
    "Type",
    "Amount (₹)",
    "Category",
    "Payment Method",
    "Appa Reimbursable",
    "Appa Settled",
    "Notes",
    "Timestamp"
  ];
}

function getOrCreateSheet(ss, sheetName, headerArray) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  if (sheet.getLastRow() === 0 && headerArray && headerArray.length > 0) {
    sheet.appendRow(headerArray);
    var headerRange = sheet.getRange(1, 1, 1, headerArray.length);
    headerRange.setFontWeight("bold");
    headerRange.setBackground("#059669"); // Emerald Green matching MSR Penny
    headerRange.setFontColor("#FFFFFF");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function formatDateForSheet(dateStr) {
  if (!dateStr) return new Date().toISOString().split('T')[0];
  try {
    return new Date(dateStr).toISOString().split('T')[0];
  } catch (e) {
    return dateStr;
  }
}

function formatCurrencyColumn(sheet, colIndex, startRow, numRows) {
  try {
    if (numRows > 0) {
      sheet.getRange(startRow, colIndex, numRows, 1).setNumberFormat('₹#,##0.00');
    }
  } catch (e) {}
}
