/**
 * MSR Penny — Google Apps Script Web App (Code.gs)
 * 
 * Features:
 * 1. Dual-sync with MSR Penny PWA (React / Vite / Vercel / Express).
 * 2. Automated sheets creation & schema management:
 *    - "Transactions": Complete personal, college & family transactions ledger.
 *    - "Family_Contacts": Configured family members (Appa, Amma, Chinna Akka, Periya Akka).
 *    - "Appa_Ledger": Dedicated Appa reimbursement running balance ledger.
 *    - "Freelance_Projects": Client design jobs, fees, and milestone payouts.
 *    - "Savings_Goals": Emergency fund & student savings goals.
 *    - "Summary": High-level monthly and all-time financial dashboard.
 * 3. Duplicate protection (idempotency by transaction ID).
 * 4. Deterministic multi-contact family balance calculations.
 * 5. Safe non-destructive data synchronization (never wipes database on empty sync).
 * 6. Supports both doGet (read state) and doPost (sync/save).
 * 7. Built-in Google Sheets UI menu ('🪙 MSR Penny') for instant 1-click actions!
 * 
 * 🟢 DEPLOYMENT INSTRUCTIONS:
 * 1. Open your Google Sheet, click "Extensions" -> "Apps Script".
 * 2. Paste this complete Code.gs file and save (Ctrl+S or Cmd+S).
 * 3. Click "Deploy" (top right) -> "New deployment".
 * 4. Click the gear icon next to "Select type" -> select "Web app".
 * 5. Fill in:
 *    - Description: "MSR Penny Family Settlements & Dual Sync"
 *    - Execute as: "Me" (your Google account)
 *    - Who has access: "Anyone" (CRITICAL: Must be "Anyone" so MSR Penny can push data)
 * 6. Click "Deploy", authorize permissions, and copy the "Web app URL" (ends in /exec).
 * 7. Paste this URL into MSR Penny's Sync settings.
 */

// Helper to return standardized JSON response
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
      .addItem('🔄 Recalculate Family Settlements & Appa Ledger', 'menuRecalculateAll')
      .addItem('👥 Ensure Family Contacts Sheet', 'ensureFamilyContactsSheet')
      .addSeparator()
      .addItem('📥 Import / Seed Demo Data', 'seedSampleData')
      .addItem('🗑️ Clear All Demo Data (Keep Clean Headers)', 'clearAllDataKeepHeaders')
      .addSeparator()
      .addItem('ℹ️ Webhook URL & Deployment Guide', 'showWebhookHelp')
      .addToUi();
  } catch (e) {
    // Suppress if running in headless web context
  }
}

/**
 * Safe spreadsheet resolver:
 * Prioritizes:
 * 1. Container-bound spreadsheet (SpreadsheetApp.getActiveSpreadsheet())
 * 2. Validated SPREADSHEET_ID stored in Script Properties
 * 3. Payload spreadsheetId / spreadsheetUrl (validated against script properties if set)
 */
function getTargetSpreadsheet(payload) {
  var ss = null;
  try {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  } catch (e) {}

  var scriptProp = null;
  try {
    scriptProp = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
  } catch (e) {}

  if (!ss && scriptProp) {
    try {
      ss = SpreadsheetApp.openById(scriptProp);
    } catch (e) {
      Logger.log("Failed to open spreadsheet by SPREADSHEET_ID property: " + e);
    }
  }

  if (!ss && payload) {
    if (payload.spreadsheetId) {
      if (!scriptProp || scriptProp === payload.spreadsheetId) {
        try {
          ss = SpreadsheetApp.openById(payload.spreadsheetId);
          if (!scriptProp) {
            PropertiesService.getScriptProperties().setProperty("SPREADSHEET_ID", payload.spreadsheetId);
          }
        } catch (e) {}
      }
    } else if (payload.spreadsheetUrl) {
      try {
        ss = SpreadsheetApp.openByUrl(payload.spreadsheetUrl);
      } catch (e) {}
    }
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
  
  // 1. Create or update Transactions tab
  ensureTransactionsSheet(ss);
  
  // 2. Create Family Contacts tab
  ensureFamilyContactsSheet(ss);
  
  // 3. Create Appa Ledger tab
  getOrCreateSheet(ss, "Appa_Ledger", [
    "Date", "Transaction ID", "Description", "Type", "Claimed Expense (₹)", "Repaid by Appa (₹)", "Running Balance (₹)", "Settled"
  ]);
  
  // 4. Create Freelance Projects tab
  getOrCreateSheet(ss, "Freelance_Projects", [
    "Job ID", "Project Title", "Client Name", "Total Fee (₹)", "Paid Amount (₹)", "Pending (₹)", "Status", "Due Date", "Milestones"
  ]);
  
  // 5. Create Savings & Goals tab
  getOrCreateSheet(ss, "Savings_Goals", [
    "Category", "Goal Title", "Current (₹)", "Target (₹)", "Progress %", "Target Date / Notes"
  ]);
  
  // 6. Create Summary Dashboard tab
  updateSummaryDashboard(ss, [], { monthlyBudget: 4000 });
  
  // Remove default blank "Sheet1" if user created a fresh spreadsheet
  var defaultSheet = ss.getSheetByName("Sheet1");
  if (defaultSheet && ss.getSheets().length > 1) {
    try {
      ss.deleteSheet(defaultSheet);
    } catch (e) {}
  }
  
  Logger.log("✅ Success! All MSR Penny sheets created with emerald green headers.");
}

/**
 * Default family contacts list
 */
function getDefaultFamilyContacts() {
  return [
    { id: "family-appa", name: "Appa", phoneNumber: "+919876543210", active: true },
    { id: "family-amma", name: "Amma", phoneNumber: "", active: true },
    { id: "family-chinna-akka", name: "Chinna Akka", phoneNumber: "", active: true },
    { id: "family-periya-akka", name: "Periya Akka", phoneNumber: "", active: true }
  ];
}

/**
 * Transactions Header Schema
 */
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
    "Timestamp",
    "Family Contact ID",
    "Family Contact Name",
    "Settlement Status"
  ];
}

/**
 * Ensure Transactions sheet exists and has all 14 columns without losing existing rows.
 */
function ensureTransactionsSheet(ss) {
  var header = getTransactionsHeader();
  var sheet = ss.getSheetByName("Transactions");
  if (!sheet) {
    sheet = ss.insertSheet("Transactions");
    sheet.appendRow(header);
    formatHeaderRow(sheet, header.length);
    return sheet;
  }

  // If sheet exists, check header columns
  var lastCol = sheet.getLastColumn();
  if (lastCol === 0) {
    sheet.appendRow(header);
    formatHeaderRow(sheet, header.length);
  } else if (lastCol < header.length) {
    // Append the missing headers safely in row 1
    var missingHeaders = header.slice(lastCol);
    sheet.getRange(1, lastCol + 1, 1, missingHeaders.length).setValues([missingHeaders]);
    formatHeaderRow(sheet, header.length);
  }
  return sheet;
}

/**
 * Ensure Family_Contacts sheet exists with default members.
 */
function ensureFamilyContactsSheet(ss) {
  if (!ss) ss = getTargetSpreadsheet();
  if (!ss) return;

  var header = ["Contact ID", "Contact Name", "WhatsApp Number", "Active", "Created At", "Updated At"];
  var sheet = getOrCreateSheet(ss, "Family_Contacts", header);

  if (sheet.getLastRow() <= 1) {
    var defaults = getDefaultFamilyContacts();
    var now = new Date().toISOString();
    var rows = defaults.map(function(c) {
      return [c.id, c.name, c.phoneNumber || "", c.active ? "YES" : "NO", now, now];
    });
    sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  }
  return sheet;
}

/**
 * Format headers with emerald green branding
 */
function formatHeaderRow(sheet, numCols) {
  try {
    var headerRange = sheet.getRange(1, 1, 1, numCols);
    headerRange.setFontWeight("bold");
    headerRange.setBackground("#059669"); // Emerald Green matching MSR Penny
    headerRange.setFontColor("#FFFFFF");
    sheet.setFrozenRows(1);
  } catch (e) {}
}

function getOrCreateSheet(ss, sheetName, headerArray) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  if (sheet.getLastRow() === 0 && headerArray && headerArray.length > 0) {
    sheet.appendRow(headerArray);
    formatHeaderRow(sheet, headerArray.length);
  }
  return sheet;
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
    { id: "tx-1", date: "2026-10-24", title: "Metro Recharge", type: "expense", amount: 100, category: "Travel", paymentMethod: "upi", isAppaReimbursable: false, isFamilyReimbursable: false, appaSettled: false, notes: "Station kiosk topup" },
    { id: "tx-2", date: "2026-10-23", title: "Bus Pass (Appa)", type: "expense", amount: 40, category: "Travel", paymentMethod: "cash", isAppaReimbursable: true, isFamilyReimbursable: true, familyContactId: "family-appa", familyContactName: "Appa", appaSettled: false, settlementStatus: "pending", notes: "Claimed to Appa - Daily bus pass ticket" },
    { id: "tx-3", date: "2026-10-22", title: "Poster Design Client", type: "income", amount: 800, category: "Freelance", paymentMethod: "upi", isAppaReimbursable: false, isFamilyReimbursable: false, appaSettled: false, notes: "Tech Fest poster first draft approval" },
    { id: "tx-4", date: "2026-10-21", title: "Canteen Lunch", type: "expense", amount: 65, category: "Food", paymentMethod: "upi", isAppaReimbursable: false, isFamilyReimbursable: false, appaSettled: false, notes: "College campus meals" },
    { id: "tx-5", date: "2026-10-20", title: "Printouts", type: "expense", amount: 45, category: "College", paymentMethod: "cash", isAppaReimbursable: false, isFamilyReimbursable: false, appaSettled: false, notes: "CAD assignment prints" },
    { id: "tx-6", date: "2026-10-22", title: "College Bus Pass", type: "expense", amount: 100, category: "Travel", paymentMethod: "upi", isAppaReimbursable: true, isFamilyReimbursable: true, familyContactId: "family-appa", familyContactName: "Appa", appaSettled: false, settlementStatus: "pending", notes: "Monthly route 14 for Appa" },
    { id: "tx-7", date: "2026-10-19", title: "Train Semester Ticket", type: "expense", amount: 60, category: "Travel", paymentMethod: "upi", isAppaReimbursable: true, isFamilyReimbursable: true, familyContactId: "family-appa", familyContactName: "Appa", appaSettled: false, settlementStatus: "pending", notes: "Suburban railway for family visit" },
    { id: "tx-8", date: "2026-10-16", title: "Engineering Printouts", type: "expense", amount: 40, category: "College", paymentMethod: "cash", isAppaReimbursable: true, isFamilyReimbursable: true, familyContactId: "family-appa", familyContactName: "Appa", appaSettled: false, settlementStatus: "pending", notes: "CAD design sheets for home plan" },
    { id: "tx-9", date: "2026-10-18", title: "Cash from Appa", type: "repayment", amount: 300, category: "Family", paymentMethod: "cash", isAppaReimbursable: false, isFamilyReimbursable: false, familyContactId: "family-appa", familyContactName: "Appa", appaSettled: true, settlementStatus: "settled", notes: "Handover morning settlement" },
    { id: "tx-10", date: "2026-10-05", title: "UPI from Appa", type: "repayment", amount: 300, category: "Family", paymentMethod: "upi", isAppaReimbursable: false, isFamilyReimbursable: false, familyContactId: "family-appa", familyContactName: "Appa", appaSettled: true, settlementStatus: "settled", notes: "Direct bank credit" }
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
    familyContacts: getDefaultFamilyContacts(),
    freelanceJobs: sampleJobs,
    savings: sampleSavings,
    settings: { monthlyBudget: 4000 }
  });

  Logger.log("✅ Sample data populated successfully!");
}

/**
 * 🗑️ Wipes all data rows but keeps emerald green headers clean!
 * Only runs on explicit user command.
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

function menuRecalculateAll() {
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
 * Reads family contacts from Family_Contacts sheet
 */
function readFamilyContactsFromSheet(ss) {
  var contactsSheet = ss.getSheetByName("Family_Contacts");
  if (!contactsSheet || contactsSheet.getLastRow() <= 1) {
    return getDefaultFamilyContacts();
  }

  var data = contactsSheet.getDataRange().getValues();
  var contacts = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (row[0]) {
      contacts.push({
        id: String(row[0]),
        name: String(row[1] || row[0]),
        phoneNumber: String(row[2] || ""),
        active: String(row[3]).toUpperCase() !== "NO",
        createdAt: row[4] ? String(row[4]) : new Date().toISOString(),
        updatedAt: row[5] ? String(row[5]) : new Date().toISOString()
      });
    }
  }
  return contacts.length > 0 ? contacts : getDefaultFamilyContacts();
}

/**
 * GET Handler
 * Used for live health check, full database queries, transactions, and balances.
 */
function doGet(e) {
  try {
    var ss = getTargetSpreadsheet();
    if (!ss) {
      return jsonResponse({
        success: false,
        status: "error",
        app: "MSR Penny Backend",
        message: "Unable to access the configured spreadsheet. Please ensure the Apps Script is container-bound or set SPREADSHEET_ID in Script Properties.",
        timestamp: new Date().toISOString()
      });
    }

    var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : 'status';
    
    // 1. Get Transactions
    if (action === 'get_transactions') {
      var txSheet = ensureTransactionsSheet(ss);
      var data = txSheet.getDataRange().getValues();
      var transactions = [];
      if (data.length > 1) {
        for (var i = 1; i < data.length; i++) {
          var row = data[i];
          if (!row[0]) continue; // Skip blank rows
          
          var isAppaReimbursable = String(row[7]).toUpperCase() === 'YES';
          var appaSettled = String(row[8]).toUpperCase() === 'YES';
          var familyContactId = row[11] ? String(row[11]) : (isAppaReimbursable ? 'family-appa' : '');
          var familyContactName = row[12] ? String(row[12]) : (isAppaReimbursable ? 'Appa' : '');
          var settlementStatus = row[13] ? String(row[13]).toLowerCase() : (appaSettled ? 'settled' : 'pending');

          var txType = String(row[3] || 'expense').toLowerCase();
          // Normalize legacy repayments
          if (txType === 'repayment' && !familyContactId) {
            var desc = String(row[2] || '').toLowerCase();
            var nts = String(row[9] || '').toLowerCase();
            if (desc.includes('appa') || nts.includes('appa') || appaSettled) {
              familyContactId = 'family-appa';
              familyContactName = 'Appa';
            }
          }

          transactions.push({
            id: String(row[0]),
            date: formatDateForSheet(row[1]),
            title: String(row[2] || ''),
            type: txType,
            amount: Number(row[4]) || 0,
            category: String(row[5] || 'Other'),
            paymentMethod: String(row[6] || 'upi').toLowerCase(),
            isAppaReimbursable: isAppaReimbursable,
            appaSettled: appaSettled,
            notes: String(row[9] || ''),
            createdAt: row[10] ? String(row[10]) : new Date().toISOString(),
            isFamilyReimbursable: Boolean(familyContactId && isAppaReimbursable),
            familyContactId: familyContactId,
            familyContactName: familyContactName,
            settlementStatus: settlementStatus
          });
        }
      }
      return jsonResponse({
        success: true,
        count: transactions.length,
        transactions: transactions
      });
    }

    // 2. Get Contacts
    if (action === 'get_contacts' || action === 'get_family_contacts') {
      var contacts = readFamilyContactsFromSheet(ss);
      return jsonResponse({
        success: true,
        count: contacts.length,
        contacts: contacts
      });
    }

    // 3. Get Balances
    if (action === 'get_balance' || action === 'get_appa_balance' || action === 'get_family_balance') {
      var balanceData = calculateFamilyBalancesFromSheet(ss);
      return jsonResponse({
        success: true,
        appaBalance: balanceData.appaBalance,
        totalFamilyOutstanding: balanceData.totalFamilyOutstanding,
        contacts: balanceData.balancesByContact,
        timestamp: new Date().toISOString()
      });
    }

    // 4. Get All Data (Comprehensive reliable initial fetch)
    if (action === 'get_all_data') {
      var txSheet = ensureTransactionsSheet(ss);
      var data = txSheet.getDataRange().getValues();
      var transactions = [];
      if (data.length > 1) {
        for (var i = 1; i < data.length; i++) {
          var row = data[i];
          if (!row[0]) continue;
          var isAppa = String(row[7]).toUpperCase() === 'YES';
          var settled = String(row[8]).toUpperCase() === 'YES';
          var fId = row[11] ? String(row[11]) : (isAppa ? 'family-appa' : '');
          var fName = row[12] ? String(row[12]) : (isAppa ? 'Appa' : '');
          var sStatus = row[13] ? String(row[13]).toLowerCase() : (settled ? 'settled' : 'pending');

          var tType = String(row[3] || 'expense').toLowerCase();
          if (tType === 'repayment' && !fId) {
            var d = String(row[2] || '').toLowerCase();
            if (d.includes('appa') || settled) {
              fId = 'family-appa';
              fName = 'Appa';
            }
          }

          transactions.push({
            id: String(row[0]),
            date: formatDateForSheet(row[1]),
            title: String(row[2] || ''),
            type: tType,
            amount: Number(row[4]) || 0,
            category: String(row[5] || 'Other'),
            paymentMethod: String(row[6] || 'upi').toLowerCase(),
            isAppaReimbursable: isAppa,
            appaSettled: settled,
            notes: String(row[9] || ''),
            createdAt: row[10] ? String(row[10]) : new Date().toISOString(),
            isFamilyReimbursable: Boolean(fId && isAppa),
            familyContactId: fId,
            familyContactName: fName,
            settlementStatus: sStatus
          });
        }
      }

      var contacts = readFamilyContactsFromSheet(ss);
      var balanceInfo = calculateFamilyBalancesFromSheet(ss);

      return jsonResponse({
        success: true,
        transactions: transactions,
        familyContacts: contacts,
        appaBalance: balanceInfo.appaBalance,
        totalFamilyOutstanding: balanceInfo.totalFamilyOutstanding,
        balancesByContact: balanceInfo.balancesByContact,
        timestamp: new Date().toISOString()
      });
    }

    // Default status info
    var currentBalances = calculateFamilyBalancesFromSheet(ss);
    return jsonResponse({
      status: "online",
      app: "MSR Penny Backend",
      version: "2.0.0",
      activeSpreadsheet: ss.getName(),
      sheetUrl: ss.getUrl(),
      appaBalance: currentBalances.appaBalance,
      totalFamilyOutstanding: currentBalances.totalFamilyOutstanding,
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
  var hasLock = false;
  try {
    hasLock = lock.tryLock(15000);
  } catch (lockErr) {}

  if (!hasLock) {
    return jsonResponse({
      success: false,
      error: "Database lock timeout: another update is in progress. Please retry in a moment."
    });
  }

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
        error: "Unable to access configured Google Sheet. Please check your spreadsheet ID or link the script via Google Sheets > Extensions > Apps Script."
      });
    }

    var action = payload.action || 'sync_all';

    // 1. Wipe / Clear Demo Data action (Explicit only)
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

    // 3. Full State Sync with Safe Merge
    if (action === 'sync_all' || Array.isArray(payload.transactions)) {
      var syncResult = syncAllData(ss, payload);
      return jsonResponse(syncResult);
    }

    // 4. Save Contacts action
    if (action === 'save_contacts' && Array.isArray(payload.contacts)) {
      syncFamilyContactsSheet(ss, payload.contacts);
      return jsonResponse({
        success: true,
        message: "Family contacts saved successfully.",
        contacts: payload.contacts
      });
    }

    return jsonResponse({ success: false, error: "Unknown action: " + action });
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  } finally {
    try {
      lock.releaseLock();
    } catch (e) {}
  }
}

/**
 * Save or update a single transaction with backend duplicate protection and balance return.
 */
function saveSingleTransaction(ss, tx) {
  if (!tx || !tx.amount || Number(tx.amount) <= 0) {
    return { success: false, error: "Invalid transaction: positive amount required." };
  }

  var prevBalanceData = calculateFamilyBalancesFromSheet(ss);
  
  var txSheet = ensureTransactionsSheet(ss);
  var txId = tx.id || ('tx-' + Date.now());
  
  var isAppa = Boolean(tx.isAppaReimbursable);
  var isFamily = Boolean(tx.isFamilyReimbursable || tx.familyContactId);
  var contactId = tx.familyContactId || (isAppa ? 'family-appa' : '');
  var contactName = tx.familyContactName || (contactId === 'family-appa' ? 'Appa' : '');
  var isRepayment = tx.type === 'repayment';

  // If claimed to Appa, ensure Appa Reimbursable flag is set
  if (contactId === 'family-appa' && !isRepayment) {
    isAppa = true;
  }

  var rowValues = [
    txId,
    formatDateForSheet(tx.date),
    tx.title || (isRepayment ? ("Received from " + (contactName || "Family")) : "Expense"),
    tx.type || "expense",
    Number(tx.amount) || 0,
    tx.category || (isRepayment ? "Family" : "General"),
    (tx.paymentMethod || "upi").toLowerCase(),
    isAppa ? "YES" : "NO",
    tx.appaSettled ? "YES" : "NO",
    tx.notes || "",
    tx.createdAt || new Date().toISOString(),
    contactId,
    contactName,
    tx.settlementStatus || (tx.appaSettled ? "settled" : "pending")
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
  rebuildAppaLedger(ss);
  var updatedBalanceData = calculateFamilyBalancesFromSheet(ss);

  var previousContactBal = (contactId && prevBalanceData.balancesByContact[contactId])
    ? prevBalanceData.balancesByContact[contactId].outstandingBalance
    : prevBalanceData.appaBalance;

  var updatedContactBal = (contactId && updatedBalanceData.balancesByContact[contactId])
    ? updatedBalanceData.balancesByContact[contactId].outstandingBalance
    : updatedBalanceData.appaBalance;

  return {
    success: true,
    transactionId: txId,
    previousAppaBalance: prevBalanceData.appaBalance,
    updatedAppaBalance: updatedBalanceData.appaBalance,
    previousBalance: previousContactBal,
    updatedBalance: updatedContactBal,
    contactId: contactId,
    contactName: contactName,
    message: existingRowIndex > 0 ? "Transaction updated" : "Transaction saved successfully",
    timestamp: new Date().toISOString()
  };
}

/**
 * Sync entire application state into organized sheets with merge protection.
 */
function syncAllData(ss, payload) {
  var txList = payload.transactions;
  var contactsList = payload.familyContacts || [];
  var jobsList = payload.freelanceJobs || [];
  var savingsData = payload.savings || {};
  var settingsData = payload.settings || {};

  // 1. Transactions Sheet (Merge Protection)
  var txSheet = ensureTransactionsSheet(ss);
  var existingData = txSheet.getDataRange().getValues();
  
  // Build map of existing transactions
  var txMap = {};
  var existingIdsOrder = [];
  if (existingData.length > 1) {
    for (var i = 1; i < existingData.length; i++) {
      var row = existingData[i];
      var id = String(row[0]);
      if (!id) continue;
      txMap[id] = row;
      existingIdsOrder.push(id);
    }
  }

  // Merge incoming transactions
  if (Array.isArray(txList) && txList.length > 0) {
    txList.forEach(function(t) {
      if (!t || !t.id) return;
      var isAppa = Boolean(t.isAppaReimbursable);
      var contactId = t.familyContactId || (isAppa ? 'family-appa' : '');
      var contactName = t.familyContactName || (contactId === 'family-appa' ? 'Appa' : '');
      if (contactId === 'family-appa' && t.type !== 'repayment') {
        isAppa = true;
      }

      var rowValues = [
        t.id,
        formatDateForSheet(t.date),
        t.title || "",
        t.type || "expense",
        Number(t.amount) || 0,
        t.category || "General",
        (t.paymentMethod || "upi").toLowerCase(),
        isAppa ? "YES" : "NO",
        t.appaSettled ? "YES" : "NO",
        t.notes || "",
        t.createdAt || new Date().toISOString(),
        contactId,
        contactName,
        t.settlementStatus || (t.appaSettled ? "settled" : "pending")
      ];

      if (!txMap[t.id]) {
        existingIdsOrder.push(t.id);
      }
      txMap[t.id] = rowValues;
    });

    // Write merged list
    if (existingIdsOrder.length > 0) {
      var mergedRows = existingIdsOrder.map(function(id) {
        return txMap[id];
      });

      if (txSheet.getLastRow() > 1) {
        txSheet.getRange(2, 1, txSheet.getLastRow() - 1, Math.max(1, txSheet.getLastColumn())).clearContent();
      }
      txSheet.getRange(2, 1, mergedRows.length, mergedRows[0].length).setValues(mergedRows);
      formatCurrencyColumn(txSheet, 5, 2, mergedRows.length);
    }
  }

  // 2. Family Contacts Sheet
  if (contactsList.length > 0) {
    syncFamilyContactsSheet(ss, contactsList);
  } else {
    ensureFamilyContactsSheet(ss);
  }

  // 3. Appa Ledger Sheet
  rebuildAppaLedger(ss);

  // 4. Freelance Projects Sheet
  if (jobsList && jobsList.length > 0) {
    syncFreelanceSheet(ss, jobsList);
  }

  // 5. Savings & Goals Sheet
  if (savingsData) {
    syncSavingsSheet(ss, savingsData);
  }

  // 6. Dashboard Summary Sheet
  updateSummaryDashboard(ss, txList || [], settingsData);

  var balanceInfo = calculateFamilyBalancesFromSheet(ss);

  return {
    success: true,
    message: "MSR Penny successfully synced with Google Sheets",
    syncedTransactions: existingIdsOrder.length,
    appaBalance: balanceInfo.appaBalance,
    totalFamilyOutstanding: balanceInfo.totalFamilyOutstanding,
    balancesByContact: balanceInfo.balancesByContact,
    timestamp: new Date().toISOString()
  };
}

/**
 * Updates Family_Contacts sheet
 */
function syncFamilyContactsSheet(ss, contacts) {
  var sheet = getOrCreateSheet(ss, "Family_Contacts", [
    "Contact ID", "Contact Name", "WhatsApp Number", "Active", "Created At", "Updated At"
  ]);

  if (!contacts || contacts.length === 0) return;

  var now = new Date().toISOString();
  var rows = contacts.map(function(c) {
    return [
      c.id,
      c.name,
      c.phoneNumber || "",
      c.active !== false ? "YES" : "NO",
      c.createdAt || now,
      now
    ];
  });

  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, Math.max(1, sheet.getLastColumn())).clearContent();
  }
  sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
}

/**
 * Calculates current family balances directly from saved records in Google Sheets
 */
function calculateFamilyBalancesFromSheet(ss) {
  var txSheet = ss.getSheetByName("Transactions");
  var contacts = readFamilyContactsFromSheet(ss);

  var balancesByContact = {};
  contacts.forEach(function(c) {
    balancesByContact[c.id] = {
      contact: c,
      totalReimbursable: 0,
      totalRepaid: 0,
      outstandingBalance: 0,
      pendingCount: 0
    };
  });

  if (!txSheet || txSheet.getLastRow() <= 1) {
    return { appaBalance: 0, totalFamilyOutstanding: 0, balancesByContact: balancesByContact };
  }

  var data = txSheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var type = String(row[3]).toLowerCase();
    var amount = Number(row[4]) || 0;
    var isAppa = String(row[7]).toUpperCase() === 'YES';
    var isSettled = String(row[8]).toUpperCase() === 'YES';
    var contactId = row[11] ? String(row[11]) : (isAppa ? 'family-appa' : '');

    // Map legacy repayments mentioning Appa
    if (type === 'repayment' && !contactId) {
      var d = String(row[2] || '').toLowerCase();
      if (d.includes('appa') || isSettled) {
        contactId = 'family-appa';
      }
    }

    if (!contactId) continue;

    if (!balancesByContact[contactId]) {
      balancesByContact[contactId] = {
        contact: { id: contactId, name: row[12] ? String(row[12]) : contactId, active: true },
        totalReimbursable: 0,
        totalRepaid: 0,
        outstandingBalance: 0,
        pendingCount: 0
      };
    }

    var b = balancesByContact[contactId];
    if (type === 'expense' && (isAppa || contactId)) {
      b.totalReimbursable += amount;
      if (!isSettled && String(row[13]).toLowerCase() !== 'settled') {
        b.pendingCount++;
      }
    } else if (type === 'repayment') {
      b.totalRepaid += amount;
    }
  }

  var totalFamilyOutstanding = 0;
  Object.keys(balancesByContact).forEach(function(id) {
    var b = balancesByContact[id];
    b.outstandingBalance = Math.max(0, b.totalReimbursable - b.totalRepaid);
    totalFamilyOutstanding += b.outstandingBalance;
  });

  var appaBal = balancesByContact['family-appa'] ? balancesByContact['family-appa'].outstandingBalance : 0;

  return {
    appaBalance: appaBal,
    totalFamilyOutstanding: totalFamilyOutstanding,
    balancesByContact: balancesByContact
  };
}

/**
 * Dedicated Appa Ledger Sheet: shows only Appa reimbursable expenses, repayments, and running balance
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
    var isAppa = t.isAppaReimbursable || t.familyContactId === 'family-appa';
    var isRepay = t.type === 'repayment' && (t.familyContactId === 'family-appa' || !t.familyContactId);
    return isAppa || isRepay;
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
    var isAppa = String(data[i][7]).toUpperCase() === 'YES' || String(data[i][11]) === 'family-appa';
    var type = String(data[i][3]).toLowerCase();
    var isRepay = type === 'repayment' && (String(data[i][11]) === 'family-appa' || !data[i][11]);
    
    if (isAppa || isRepay) {
      txList.push({
        id: data[i][0],
        date: data[i][1],
        title: data[i][2],
        type: type,
        amount: Number(data[i][4]) || 0,
        isAppaReimbursable: isAppa,
        familyContactId: data[i][11],
        appaSettled: String(data[i][8]).toUpperCase() === 'YES'
      });
    }
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

  var balanceInfo = calculateFamilyBalancesFromSheet(ss);
  var totalIncome = 0;
  var personalSpent = 0;

  var txSheet = ss.getSheetByName("Transactions");
  var allTxs = [];
  if (txSheet && txSheet.getLastRow() > 1) {
    var data = txSheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      allTxs.push({
        type: String(data[i][3]).toLowerCase(),
        amount: Number(data[i][4]) || 0,
        isReimbursable: String(data[i][7]).toUpperCase() === 'YES' || Boolean(data[i][11])
      });
    }
  } else {
    allTxs = transactions || [];
  }

  allTxs.forEach(function(t) {
    var amt = Number(t.amount) || 0;
    if (t.type === 'income') {
      totalIncome += amt;
    } else if (t.type === 'expense' && !t.isReimbursable && !t.isAppaReimbursable && !t.isFamilyReimbursable) {
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
    ["Family Settlements Outstanding", "₹" + balanceInfo.totalFamilyOutstanding, "Total amount owed across all family members"],
    ["Appa Outstanding Owed", "₹" + balanceInfo.appaBalance, "Amount Appa owes back to you"],
    ["Available Balance", "₹" + availableCash, "Total Income minus personal spent"],
    ["Total Personal Expenses", "₹" + personalSpent, "Excludes expenses claimed to family members"],
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

function formatDateForSheet(dateStr) {
  if (!dateStr) return new Date().toISOString().split('T')[0];
  if (dateStr instanceof Date) {
    return Utilities.formatDate(dateStr, "Asia/Kolkata", "yyyy-MM-dd");
  }
  try {
    var d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return Utilities.formatDate(d, "Asia/Kolkata", "yyyy-MM-dd");
    }
    return String(dateStr).split('T')[0];
  } catch (e) {
    return String(dateStr);
  }
}

function formatCurrencyColumn(sheet, colIndex, startRow, numRows) {
  try {
    if (numRows > 0) {
      sheet.getRange(startRow, colIndex, numRows, 1).setNumberFormat('₹#,##0.00');
    }
  } catch (e) {}
}
