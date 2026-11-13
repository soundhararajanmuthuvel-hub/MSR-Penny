/**
 * MSR Penny — Google Apps Script Web App (Production Bundle)
 * Automatically concatenated from modular source files in google-apps-script/src/
 * Version: 3.1.0
 */

// ==============================================================================
// MODULE: config.gs
// ==============================================================================

/**
 * MSR Penny — Google Apps Script Configuration
 * File: config.gs
 */

var CONFIG = {
  APP_NAME: "MSR Penny",
  VERSION: "3.1.0",
  BRAND_COLOR: "#006948",
  BRAND_TEXT_COLOR: "#ffffff",
  TIMEZONE: "Asia/Kolkata",
  LOCK_TIMEOUT_READ_MS: 15000,
  LOCK_TIMEOUT_WRITE_MS: 30000,

  SHEETS: {
    TRANSACTIONS: "Transactions",
    ACCOUNTS: "Accounts",
    TRANSFERS: "Transfers",
    FAMILY_CONTACTS: "Family_Contacts",
    APPA_LEDGER: "Appa_Ledger",
    FREELANCE: "Freelance_Projects",
    SAVINGS: "Savings_Goals",
    SUMMARY: "Summary",
    SETTLED_ARCHIVE: "Settled_Archive",
    RECONCILIATIONS: "Reconciliations",
    AUDIT_LOG: "Audit_Log",
    PUSH_SUBSCRIPTIONS: "Push_Subscriptions"
  }
};

/**
 * Returns default accounts configuration.
 */
function getDefaultAccounts() {
  return [
    { id: 'acc-sbi', name: 'SBI (Main)', type: 'bank', openingBalance: 10000, openingDate: '2026-01-01', active: true },
    { id: 'acc-iob', name: 'IOB (Second)', type: 'bank', openingBalance: 2000, openingDate: '2026-01-01', active: true },
    { id: 'acc-cash', name: 'Cash', type: 'cash', openingBalance: 500, openingDate: '2026-01-01', active: true }
  ];
}

/**
 * Returns default family contacts configuration.
 */
function getDefaultFamilyContacts() {
  return [
    { id: 'family-appa', name: 'Appa', phoneNumber: '+919876543210', active: true, relationship: 'Father' },
    { id: 'family-amma', name: 'Amma', phoneNumber: '', active: true, relationship: 'Mother' },
    { id: 'family-chinna-akka', name: 'Chinna Akka', phoneNumber: '', active: true, relationship: 'Sister' },
    { id: 'family-periya-akka', name: 'Periya Akka', phoneNumber: '', active: true, relationship: 'Sister' }
  ];
}

/**
 * Resolves target spreadsheet safely:
 * 1. Explicit spreadsheetId in payload/parameters
 * 2. Script Properties SPREADSHEET_ID
 * 3. Active bound Spreadsheet
 */
function getTargetSpreadsheet(payload) {
  var explicitId = payload && (payload.spreadsheetId || payload.sheetId);
  if (explicitId) {
    try {
      return SpreadsheetApp.openById(explicitId);
    } catch (e) {
      Logger.log("Failed to open explicit spreadsheet ID: " + e);
    }
  }

  var scriptProps = PropertiesService.getScriptProperties();
  var savedId = scriptProps.getProperty("SPREADSHEET_ID");
  if (savedId) {
    try {
      return SpreadsheetApp.openById(savedId);
    } catch (e) {
      Logger.log("Failed to open spreadsheet by SPREADSHEET_ID property: " + e);
    }
  }

  try {
    return SpreadsheetApp.getActiveSpreadsheet();
  } catch (e) {
    throw new Error("No active Google Spreadsheet found. Set SPREADSHEET_ID in Script Properties or pass spreadsheetId in the request.");
  }
}


// ==============================================================================
// MODULE: responseUtils.gs
// ==============================================================================

/**
 * MSR Penny — Google Apps Script Response Utilities
 * File: responseUtils.gs
 */

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function successResponse(message, data) {
  var payload = {
    success: true,
    message: message || "Operation completed successfully",
    data: data || {},
    timestamp: new Date().toISOString()
  };
  return jsonResponse(payload);
}

function errorResponse(errorMessage, statusCode) {
  var payload = {
    success: false,
    error: errorMessage || "An unexpected error occurred",
    statusCode: statusCode || 500,
    timestamp: new Date().toISOString()
  };
  return jsonResponse(payload);
}


// ==============================================================================
// MODULE: security.gs
// ==============================================================================

/**
 * MSR Penny — Google Apps Script Security & Sanitization
 * File: security.gs
 */

/**
 * Sanitizes input string to prevent formula injection in Google Sheets.
 * If a cell string starts with '=', '+', '-', or '@', prepends a single quote.
 */
function sanitizeCellInput(val) {
  if (val === null || val === undefined) return "";
  if (typeof val === "string") {
    var trimmed = val.trim();
    if (trimmed.length > 0) {
      var firstChar = trimmed.charAt(0);
      if (firstChar === "=" || firstChar === "+" || firstChar === "-" || firstChar === "@") {
        return "'" + trimmed;
      }
    }
    return trimmed;
  }
  return val;
}

/**
 * Validates request authentication token if a secret token is configured in Script Properties.
 */
function verifyAuthToken(requestToken) {
  var configuredToken = PropertiesService.getScriptProperties().getProperty("SHORTCUT_SECRET_TOKEN");
  if (!configuredToken) return true; // Token check optional if not configured in Script Properties
  return requestToken === configuredToken;
}

/**
 * Acquires script lock for concurrency safety.
 */
function acquireScriptLock(timeoutMs) {
  var lock = LockService.getScriptLock();
  lock.waitLock(timeoutMs || CONFIG.LOCK_TIMEOUT_WRITE_MS);
  return lock;
}

/**
 * Releases script lock safely.
 */
function releaseScriptLock(lock) {
  if (lock) {
    try {
      lock.releaseLock();
    } catch (e) {
      Logger.log("Error releasing lock: " + e);
    }
  }
}


// ==============================================================================
// MODULE: validationService.gs
// ==============================================================================

/**
 * MSR Penny — Google Apps Script Validation Service
 * File: validationService.gs
 */

function validateTransaction(tx) {
  if (!tx || typeof tx !== 'object') {
    return { valid: false, error: 'Transaction payload must be an object' };
  }
  if (!tx.id || String(tx.id).trim() === '') {
    return { valid: false, error: 'Transaction ID is required' };
  }
  if (!tx.title || String(tx.title).trim() === '') {
    return { valid: false, error: 'Transaction title is required' };
  }
  var amt = Number(tx.amount);
  if (isNaN(amt) || amt < 0) {
    return { valid: false, error: 'Transaction amount must be a non-negative number' };
  }
  if (!tx.date || !/^\d{4}-\d{2}-\d{2}/.test(String(tx.date))) {
    return { valid: false, error: 'Transaction date must be in YYYY-MM-DD format' };
  }
  return { valid: true };
}

function validateAccount(acc) {
  if (!acc || typeof acc !== 'object') {
    return { valid: false, error: 'Account payload must be an object' };
  }
  if (!acc.id || String(acc.id).trim() === '') {
    return { valid: false, error: 'Account ID is required' };
  }
  if (!acc.name || String(acc.name).trim() === '') {
    return { valid: false, error: 'Account name is required' };
  }
  var bal = Number(acc.openingBalance);
  if (isNaN(bal) || bal < 0) {
    return { valid: false, error: 'Account opening balance must be a non-negative number' };
  }
  return { valid: true };
}

function validateTransfer(tr) {
  if (!tr || typeof tr !== 'object') {
    return { valid: false, error: 'Transfer payload must be an object' };
  }
  if (!tr.id || String(tr.id).trim() === '') {
    return { valid: false, error: 'Transfer ID is required' };
  }
  var amt = Number(tr.amount);
  if (isNaN(amt) || amt <= 0) {
    return { valid: false, error: 'Transfer amount must be greater than zero' };
  }
  if (!tr.fromAccountId || !tr.toAccountId) {
    return { valid: false, error: 'Source and destination accounts are required' };
  }
  if (tr.fromAccountId === tr.toAccountId) {
    return { valid: false, error: 'Source and destination accounts cannot be the same' };
  }
  return { valid: true };
}


// ==============================================================================
// MODULE: spreadsheetService.gs
// ==============================================================================

/**
 * MSR Penny — Google Apps Script Spreadsheet Service
 * File: spreadsheetService.gs
 */

function formatHeaderRow(sheet, numCols) {
  var headerRange = sheet.getRange(1, 1, 1, numCols);
  headerRange.setBackground(CONFIG.BRAND_COLOR);
  headerRange.setFontColor(CONFIG.BRAND_TEXT_COLOR);
  headerRange.setFontWeight("bold");
  headerRange.setFontSize(10);
  headerRange.setHorizontalAlignment("center");
  sheet.setFrozenRows(1);
}

function getOrCreateSheet(ss, sheetName, headerArray) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(headerArray);
    formatHeaderRow(sheet, headerArray.length);
  } else {
    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    if (lastRow === 0 || lastCol === 0) {
      sheet.appendRow(headerArray);
      formatHeaderRow(sheet, headerArray.length);
    }
  }
  return sheet;
}

function getTransactionsHeader() {
  return [
    "ID", "Date", "Title", "Amount (₹)", "Type", "Category",
    "Payment Method", "Account ID", "Account Name",
    "Is Appa Reimbursable", "Is Family Reimbursable", "Family Contact ID", "Family Contact Name",
    "Appa Settled", "Settlement Status",
    "Freelance Job ID", "Milestone Title", "Notes", "Created At"
  ];
}

function ensureTransactionsSheet(ss) {
  return getOrCreateSheet(ss, CONFIG.SHEETS.TRANSACTIONS, getTransactionsHeader());
}

function getAccountsHeader() {
  return ["Account ID", "Account Name", "Type", "Opening Balance", "Opening Date", "Active", "Created At", "Updated At"];
}

function ensureAccountsSheet(ss) {
  var sheet = getOrCreateSheet(ss, CONFIG.SHEETS.ACCOUNTS, getAccountsHeader());
  if (sheet.getLastRow() <= 1) {
    var defaults = getDefaultAccounts();
    var nowIso = new Date().toISOString();
    defaults.forEach(function(a) {
      sheet.appendRow([a.id, a.name, a.type, a.openingBalance, a.openingDate, a.active ? "TRUE" : "FALSE", nowIso, nowIso]);
    });
  }
  return sheet;
}

function getTransfersHeader() {
  return ["Transfer ID", "Date", "Amount (₹)", "From Account ID", "From Account Name", "To Account ID", "To Account Name", "Fee (₹)", "Notes", "Created At"];
}

function ensureTransfersSheet(ss) {
  return getOrCreateSheet(ss, CONFIG.SHEETS.TRANSFERS, getTransfersHeader());
}

function getFamilyContactsHeader() {
  return ["Contact ID", "Name", "Relationship", "Phone Number", "Active", "Created At", "Updated At"];
}

function ensureFamilyContactsSheet(ss) {
  var sheet = getOrCreateSheet(ss, CONFIG.SHEETS.FAMILY_CONTACTS, getFamilyContactsHeader());
  if (sheet.getLastRow() <= 1) {
    var defaults = getDefaultFamilyContacts();
    var nowIso = new Date().toISOString();
    defaults.forEach(function(c) {
      sheet.appendRow([c.id, c.name, c.relationship, c.phoneNumber, c.active ? "TRUE" : "FALSE", nowIso, nowIso]);
    });
  }
  return sheet;
}

function getSettledArchiveHeader() {
  return [
    "Archive ID", "Batch ID", "Archived At", "Original Transaction ID", "Date", "Title",
    "Amount (₹)", "Type", "Category", "Payment Method", "Account ID", "Account Name",
    "Family Contact ID", "Family Contact Name", "Settlement Status", "Notes", "Original Created At"
  ];
}

function ensureSettledArchiveSheet(ss) {
  return getOrCreateSheet(ss, CONFIG.SHEETS.SETTLED_ARCHIVE, getSettledArchiveHeader());
}

function getReconciliationsHeader() {
  return [
    "Reconciliation ID", "Reconciled At", "Account ID", "Account Name", "Passbook Balance (₹)",
    "Computed Balance (₹)", "Adjustment Amount (₹)", "Notes", "Created At"
  ];
}

function ensureReconciliationsSheet(ss) {
  return getOrCreateSheet(ss, CONFIG.SHEETS.RECONCILIATIONS, getReconciliationsHeader());
}

function getAuditLogHeader() {
  return ["Log ID", "Timestamp", "Action", "Entity Type", "Entity ID", "Summary", "Status"];
}

function ensureAuditLogSheet(ss) {
  return getOrCreateSheet(ss, CONFIG.SHEETS.AUDIT_LOG, getAuditLogHeader());
}

function logAuditEvent(ss, action, entityType, entityId, summary, status) {
  try {
    var sheet = ensureAuditLogSheet(ss);
    var logId = "log-" + new Date().getTime();
    sheet.appendRow([logId, new Date().toISOString(), action, entityType, entityId, summary, status || "SUCCESS"]);
  } catch (err) {
    Logger.log("Failed to log audit event: " + err);
  }
}

function formatDateForSheet(dateStr) {
  if (!dateStr) return "";
  try {
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return Utilities.formatDate(d, CONFIG.TIMEZONE, "yyyy-MM-dd");
  } catch (e) {
    return dateStr;
  }
}

function formatCurrencyColumn(sheet, colIndex, startRow, numRows) {
  if (numRows <= 0) return;
  sheet.getRange(startRow, colIndex, numRows, 1).setNumberFormat("₹#,##0.00");
}


// ==============================================================================
// MODULE: transactionService.gs
// ==============================================================================

/**
 * MSR Penny — Google Apps Script Transaction Service
 * File: transactionService.gs
 */

function readTransactionsFromSheet(ss) {
  var sheet = ensureTransactionsSheet(ss);
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  var data = sheet.getRange(2, 1, lastRow - 1, 19).getValues();
  var transactions = [];

  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var id = String(row[0]).trim();
    if (!id) continue;

    var dateVal = row[1];
    var formattedDate = "";
    if (dateVal instanceof Date) {
      formattedDate = Utilities.formatDate(dateVal, CONFIG.TIMEZONE, "yyyy-MM-dd");
    } else {
      formattedDate = formatDateForSheet(String(dateVal));
    }

    var tx = {
      id: id,
      date: formattedDate,
      title: String(row[2]),
      amount: Number(row[3]) || 0,
      type: String(row[4]).toLowerCase() || "expense",
      category: String(row[5]) || "Other",
      paymentMethod: String(row[6]).toLowerCase() || "upi",
      accountId: String(row[7] || ""),
      accountName: String(row[8] || ""),
      isAppaReimbursable: String(row[9]).toUpperCase() === "TRUE",
      isFamilyReimbursable: String(row[10]).toUpperCase() === "TRUE",
      familyContactId: String(row[11] || ""),
      familyContactName: String(row[12] || ""),
      appaSettled: String(row[13]).toUpperCase() === "TRUE",
      settlementStatus: String(row[14] || "pending"),
      freelanceJobId: String(row[15] || ""),
      milestoneTitle: String(row[16] || ""),
      notes: String(row[17] || ""),
      createdAt: row[18] ? (row[18] instanceof Date ? row[18].toISOString() : String(row[18])) : new Date().toISOString()
    };
    transactions.push(tx);
  }

  transactions.sort(function(a, b) {
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  return transactions;
}

function saveSingleTransaction(ss, tx) {
  var validation = validateTransaction(tx);
  if (!validation.valid) {
    return errorResponse(validation.error, 400);
  }

  var sheet = ensureTransactionsSheet(ss);
  var lastRow = sheet.getLastRow();
  var targetRow = -1;

  if (lastRow > 1) {
    var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0]).trim() === tx.id) {
        targetRow = i + 2;
        break;
      }
    }
  }

  var rowData = [
    sanitizeCellInput(tx.id),
    formatDateForSheet(tx.date),
    sanitizeCellInput(tx.title),
    Number(tx.amount) || 0,
    sanitizeCellInput(tx.type || "expense"),
    sanitizeCellInput(tx.category || "Other"),
    sanitizeCellInput(tx.paymentMethod || "upi"),
    sanitizeCellInput(tx.accountId || ""),
    sanitizeCellInput(tx.accountName || ""),
    tx.isAppaReimbursable ? "TRUE" : "FALSE",
    tx.isFamilyReimbursable ? "TRUE" : "FALSE",
    sanitizeCellInput(tx.familyContactId || ""),
    sanitizeCellInput(tx.familyContactName || ""),
    tx.appaSettled ? "TRUE" : "FALSE",
    sanitizeCellInput(tx.settlementStatus || "pending"),
    sanitizeCellInput(tx.freelanceJobId || ""),
    sanitizeCellInput(tx.milestoneTitle || ""),
    sanitizeCellInput(tx.notes || ""),
    tx.createdAt ? formatDateForSheet(tx.createdAt) : new Date().toISOString()
  ];

  if (targetRow > 0) {
    sheet.getRange(targetRow, 1, 1, rowData.length).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }

  return successResponse("Transaction saved successfully", { transaction: tx });
}

function deleteSingleTransaction(ss, txId) {
  if (!txId) return errorResponse("Transaction ID is required", 400);

  var sheet = ensureTransactionsSheet(ss);
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return errorResponse("Transaction not found", 404);

  var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]).trim() === txId) {
      sheet.deleteRow(i + 2);
      return successResponse("Transaction deleted successfully", { id: txId });
    }
  }
  return errorResponse("Transaction not found", 404);
}


// ==============================================================================
// MODULE: settlementService.gs
// ==============================================================================

/**
 * MSR Penny — Google Apps Script Settlement Service
 * File: settlementService.gs
 */

function readFamilyContactsFromSheet(ss) {
  var sheet = ensureFamilyContactsSheet(ss);
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return getDefaultFamilyContacts();

  var data = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
  var contacts = [];

  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var id = String(row[0]).trim();
    if (!id) continue;

    contacts.push({
      id: id,
      name: String(row[1] || ""),
      relationship: String(row[2] || ""),
      phoneNumber: String(row[3] || ""),
      active: String(row[4]).toUpperCase() === "TRUE",
      createdAt: row[5] ? String(row[5]) : new Date().toISOString(),
      updatedAt: row[6] ? String(row[6]) : new Date().toISOString()
    });
  }

  return contacts.length > 0 ? contacts : getDefaultFamilyContacts();
}

function syncFamilyContactsSheet(ss, contacts) {
  if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
    return;
  }
  var sheet = ensureFamilyContactsSheet(ss);
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, 7).clearContent();
  }

  var rows = [];
  var nowIso = new Date().toISOString();
  contacts.forEach(function(c) {
    rows.push([
      sanitizeCellInput(c.id),
      sanitizeCellInput(c.name),
      sanitizeCellInput(c.relationship || ""),
      sanitizeCellInput(c.phoneNumber || ""),
      c.active !== false ? "TRUE" : "FALSE",
      c.createdAt || nowIso,
      nowIso
    ]);
  });

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, 7).setValues(rows);
  }
}

function calculateFamilyBalancesFromSheet(ss) {
  var txs = readTransactionsFromSheet(ss);
  var contacts = readFamilyContactsFromSheet(ss);

  var balances = {};
  contacts.forEach(function(c) {
    balances[c.id] = {
      contact: c,
      totalReimbursable: 0,
      totalRepaid: 0,
      outstandingBalance: 0,
      pendingCount: 0
    };
  });

  txs.forEach(function(t) {
    var contactId = t.familyContactId;
    if (!contactId && (t.isAppaReimbursable || t.type === 'repayment')) {
      contactId = 'family-appa';
    }
    if (!contactId || !balances[contactId]) return;

    var amt = Number(t.amount) || 0;
    if (t.type === 'repayment') {
      balances[contactId].totalRepaid += amt;
    } else if (t.type === 'expense' && (t.isAppaReimbursable || t.isFamilyReimbursable)) {
      balances[contactId].totalReimbursable += amt;
      if (!t.appaSettled && t.settlementStatus !== 'settled') {
        balances[contactId].pendingCount += 1;
      }
    }
  });

  var totalOutstanding = 0;
  Object.keys(balances).forEach(function(k) {
    var bal = balances[k];
    bal.outstandingBalance = Math.max(0, bal.totalReimbursable - bal.totalRepaid);
    if (bal.outstandingBalance <= 0) {
      bal.pendingCount = 0;
    }
    totalOutstanding += bal.outstandingBalance;
  });

  return { balances: balances, totalOutstanding: totalOutstanding };
}

function archiveSettledTransactions(ss, batchId, contactId, txIds) {
  if (!batchId || !contactId || !txIds || !Array.isArray(txIds) || txIds.length === 0) {
    return errorResponse("Missing required parameters for archive (batchId, contactId, txIds)", 400);
  }

  var txSheet = ensureTransactionsSheet(ss);
  var archiveSheet = ensureSettledArchiveSheet(ss);
  var lastRow = txSheet.getLastRow();
  if (lastRow <= 1) return errorResponse("Transactions sheet is empty", 400);

  var txData = txSheet.getRange(2, 1, lastRow - 1, 19).getValues();
  var idSet = {};
  txIds.forEach(function(id) { idSet[id] = true; });

  var rowsToArchive = [];
  var rowsToDeleteIndices = [];
  var nowIso = new Date().toISOString();

  for (var i = 0; i < txData.length; i++) {
    var row = txData[i];
    var id = String(row[0]).trim();
    if (idSet[id]) {
      var archiveId = "arch-" + id;
      rowsToArchive.push([
        archiveId, batchId, nowIso, id, row[1], row[2],
        row[3], row[4], row[5], row[6], row[7], row[8],
        row[11], row[12], "archived", row[17], row[18]
      ]);
      rowsToDeleteIndices.push(i + 2);
    }
  }

  if (rowsToArchive.length === 0) {
    return errorResponse("None of the specified transactions were found in the active sheet", 404);
  }

  // Append to archive sheet
  for (var a = 0; a < rowsToArchive.length; a++) {
    archiveSheet.appendRow(rowsToArchive[a]);
  }

  // Delete from active transactions in reverse order
  rowsToDeleteIndices.sort(function(x, y) { return y - x; });
  for (var d = 0; d < rowsToDeleteIndices.length; d++) {
    txSheet.deleteRow(rowsToDeleteIndices[d]);
  }

  logAuditEvent(ss, "ARCHIVE", "archive", batchId, "Archived " + rowsToArchive.length + " items for contact " + contactId, "SUCCESS");
  return successResponse("Archived " + rowsToArchive.length + " transactions successfully", { batchId: batchId, count: rowsToArchive.length });
}

function restoreArchivedTransactions(ss, batchId) {
  if (!batchId) return errorResponse("Batch ID is required for restore", 400);

  var archiveSheet = ensureSettledArchiveSheet(ss);
  var txSheet = ensureTransactionsSheet(ss);
  var lastRow = archiveSheet.getLastRow();
  if (lastRow <= 1) return errorResponse("Archive sheet is empty", 404);

  var data = archiveSheet.getRange(2, 1, lastRow - 1, 17).getValues();
  var rowsToRestore = [];
  var rowsToDeleteIndices = [];

  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    if (String(row[1]).trim() === batchId) {
      rowsToRestore.push([
        row[3], row[4], row[5], row[6], row[7], row[8],
        row[9], row[10], row[11],
        row[12] === 'family-appa' ? "TRUE" : "FALSE",
        "TRUE", row[12], row[13],
        "TRUE", "settled", "", "", row[15], row[16]
      ]);
      rowsToDeleteIndices.push(i + 2);
    }
  }

  if (rowsToRestore.length === 0) {
    return errorResponse("No archived records found for batch ID: " + batchId, 404);
  }

  for (var r = 0; r < rowsToRestore.length; r++) {
    txSheet.appendRow(rowsToRestore[r]);
  }

  rowsToDeleteIndices.sort(function(x, y) { return y - x; });
  for (var d = 0; d < rowsToDeleteIndices.length; d++) {
    archiveSheet.deleteRow(rowsToDeleteIndices[d]);
  }

  logAuditEvent(ss, "RESTORE", "archive", batchId, "Restored " + rowsToRestore.length + " items to active Transactions", "SUCCESS");
  return successResponse("Restored " + rowsToRestore.length + " transactions successfully", { batchId: batchId, count: rowsToRestore.length });
}

function readSettledArchiveFromSheet(ss) {
  var sheet = ensureSettledArchiveSheet(ss);
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  var data = sheet.getRange(2, 1, lastRow - 1, 17).getValues();
  var items = [];
  for (var i = 0; i < data.length; i++) {
    var r = data[i];
    items.push({
      id: String(r[0]),
      batchId: String(r[1]),
      archivedAt: String(r[2]),
      originalTxId: String(r[3]),
      date: formatDateForSheet(String(r[4])),
      title: String(r[5]),
      amount: Number(r[6]) || 0,
      type: String(r[7]),
      category: String(r[8]),
      paymentMethod: String(r[9]),
      accountId: String(r[10]),
      accountName: String(r[11]),
      familyContactId: String(r[12]),
      familyContactName: String(r[13]),
      settlementStatus: String(r[14]),
      notes: String(r[15]),
      originalCreatedAt: String(r[16])
    });
  }
  return items;
}


// ==============================================================================
// MODULE: freelanceService.gs
// ==============================================================================

/**
 * MSR Penny — Google Apps Script Freelance, Accounts & Health Service
 * File: freelanceService.gs
 */

function readFreelanceProjectsFromSheet(ss) {
  var sheet = ss.getSheetByName(CONFIG.SHEETS.FREELANCE);
  if (!sheet) return [];
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  var data = sheet.getRange(2, 1, lastRow - 1, 8).getValues();
  var jobs = [];

  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var id = String(row[0]).trim();
    if (!id) continue;

    var milestones = [];
    try {
      if (row[7]) milestones = JSON.parse(String(row[7]));
    } catch (e) {
      milestones = [];
    }

    jobs.push({
      id: id,
      clientName: String(row[1] || ""),
      projectTitle: String(row[2] || ""),
      totalAmount: Number(row[3]) || 0,
      receivedAmount: Number(row[4]) || 0,
      status: String(row[5] || "in_progress"),
      notes: String(row[6] || ""),
      milestones: milestones
    });
  }
  return jobs;
}

function syncFreelanceSheet(ss, jobs) {
  if (!jobs || !Array.isArray(jobs)) return;
  var headers = ["Job ID", "Client Name", "Project Title", "Total Amount (₹)", "Received Amount (₹)", "Status", "Notes", "Milestones (JSON)"];
  var sheet = getOrCreateSheet(ss, CONFIG.SHEETS.FREELANCE, headers);

  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, 8).clearContent();
  }

  var rows = [];
  jobs.forEach(function(j) {
    rows.push([
      sanitizeCellInput(j.id),
      sanitizeCellInput(j.clientName),
      sanitizeCellInput(j.projectTitle),
      Number(j.totalAmount) || 0,
      Number(j.receivedAmount) || 0,
      sanitizeCellInput(j.status || "in_progress"),
      sanitizeCellInput(j.notes || ""),
      JSON.stringify(j.milestones || [])
    ]);
  });

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, 8).setValues(rows);
  }
}

function readAccountsFromSheet(ss) {
  var sheet = ensureAccountsSheet(ss);
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return getDefaultAccounts();

  var data = sheet.getRange(2, 1, lastRow - 1, 8).getValues();
  var accounts = [];

  for (var i = 0; i < data.length; i++) {
    var r = data[i];
    var id = String(r[0]).trim();
    if (!id) continue;

    accounts.push({
      id: id,
      name: String(r[1] || ""),
      type: String(r[2] || "bank"),
      openingBalance: Number(r[3]) || 0,
      openingDate: formatDateForSheet(String(r[4] || "2026-01-01")),
      active: String(r[5]).toUpperCase() === "TRUE",
      createdAt: r[6] ? String(r[6]) : new Date().toISOString(),
      updatedAt: r[7] ? String(r[7]) : new Date().toISOString()
    });
  }
  return accounts.length > 0 ? accounts : getDefaultAccounts();
}

function saveAccountsWithAuditAndBackup(ss, accounts) {
  if (!accounts || !Array.isArray(accounts) || accounts.length === 0) {
    return errorResponse("Accounts array must not be empty", 400);
  }

  var sheet = ensureAccountsSheet(ss);
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, 8).clearContent();
  }

  var rows = [];
  var nowIso = new Date().toISOString();
  accounts.forEach(function(a) {
    rows.push([
      sanitizeCellInput(a.id),
      sanitizeCellInput(a.name),
      sanitizeCellInput(a.type || "bank"),
      Number(a.openingBalance) || 0,
      formatDateForSheet(a.openingDate || "2026-01-01"),
      a.active !== false ? "TRUE" : "FALSE",
      a.createdAt || nowIso,
      nowIso
    ]);
  });

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, 8).setValues(rows);
  }

  logAuditEvent(ss, "UPDATE_ACCOUNTS", "accounts", "all", "Updated " + accounts.length + " accounts opening balances", "SUCCESS");
  return successResponse("Accounts updated successfully", { accounts: accounts });
}

function readTransfersFromSheet(ss) {
  var sheet = ensureTransfersSheet(ss);
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  var data = sheet.getRange(2, 1, lastRow - 1, 10).getValues();
  var transfers = [];

  for (var i = 0; i < data.length; i++) {
    var r = data[i];
    var id = String(r[0]).trim();
    if (!id) continue;

    transfers.push({
      id: id,
      date: formatDateForSheet(String(r[1])),
      amount: Number(r[2]) || 0,
      fromAccountId: String(r[3] || ""),
      fromAccountName: String(r[4] || ""),
      toAccountId: String(r[5] || ""),
      toAccountName: String(r[6] || ""),
      fee: Number(r[7]) || 0,
      notes: String(r[8] || ""),
      createdAt: r[9] ? String(r[9]) : new Date().toISOString()
    });
  }
  return transfers;
}

function saveSingleTransfer(ss, tr) {
  var validation = validateTransfer(tr);
  if (!validation.valid) {
    return errorResponse(validation.error, 400);
  }

  var sheet = ensureTransfersSheet(ss);
  var rowData = [
    sanitizeCellInput(tr.id),
    formatDateForSheet(tr.date),
    Number(tr.amount) || 0,
    sanitizeCellInput(tr.fromAccountId),
    sanitizeCellInput(tr.fromAccountName || ""),
    sanitizeCellInput(tr.toAccountId),
    sanitizeCellInput(tr.toAccountName || ""),
    Number(tr.fee) || 0,
    sanitizeCellInput(tr.notes || ""),
    tr.createdAt ? formatDateForSheet(tr.createdAt) : new Date().toISOString()
  ];

  sheet.appendRow(rowData);
  logAuditEvent(ss, "CREATE_TRANSFER", "transfer", tr.id, "Recorded transfer of ₹" + tr.amount, "SUCCESS");
  return successResponse("Transfer recorded successfully", { transfer: tr });
}

function deleteSingleTransfer(ss, trId) {
  if (!trId) return errorResponse("Transfer ID is required", 400);
  var sheet = ensureTransfersSheet(ss);
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return errorResponse("Transfer not found", 404);

  var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]).trim() === trId) {
      sheet.deleteRow(i + 2);
      logAuditEvent(ss, "DELETE_TRANSFER", "transfer", trId, "Deleted transfer " + trId, "SUCCESS");
      return successResponse("Transfer deleted successfully", { id: trId });
    }
  }
  return errorResponse("Transfer not found", 404);
}

function readReconciliationsFromSheet(ss) {
  var sheet = ensureReconciliationsSheet(ss);
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  var data = sheet.getRange(2, 1, lastRow - 1, 9).getValues();
  var recs = [];
  for (var i = 0; i < data.length; i++) {
    var r = data[i];
    recs.push({
      id: String(r[0]),
      reconciledAt: String(r[1]),
      accountId: String(r[2]),
      accountName: String(r[3]),
      passbookBalance: Number(r[4]) || 0,
      computedBalance: Number(r[5]) || 0,
      adjustmentAmount: Number(r[6]) || 0,
      notes: String(r[7] || ""),
      createdAt: String(r[8] || "")
    });
  }
  return recs;
}

function saveReconciliationAdjustment(ss, rec) {
  if (!rec || !rec.accountId) return errorResponse("Account ID is required", 400);
  var sheet = ensureReconciliationsSheet(ss);
  var recId = "rec-" + new Date().getTime();
  var nowIso = new Date().toISOString();

  var row = [
    recId,
    rec.reconciledAt || nowIso,
    sanitizeCellInput(rec.accountId),
    sanitizeCellInput(rec.accountName || ""),
    Number(rec.passbookBalance) || 0,
    Number(rec.computedBalance) || 0,
    Number(rec.adjustmentAmount) || 0,
    sanitizeCellInput(rec.notes || ""),
    nowIso
  ];
  sheet.appendRow(row);
  logAuditEvent(ss, "RECONCILE", "account", rec.accountId, "Recorded reconciliation adjustment of ₹" + rec.adjustmentAmount, "SUCCESS");
  return successResponse("Reconciliation adjustment saved", { reconciliationId: recId });
}

function runDataHealthCheck(ss) {
  var txs = readTransactionsFromSheet(ss);
  var accounts = readAccountsFromSheet(ss);
  var transfers = readTransfersFromSheet(ss);

  var issues = [];
  var accountMap = {};
  accounts.forEach(function(a) { accountMap[a.id] = a; });

  txs.forEach(function(t) {
    if (t.accountId && !accountMap[t.accountId]) {
      issues.push({
        type: "MISSING_ACCOUNT",
        severity: "WARNING",
        entityId: t.id,
        message: "Transaction references non-existent account: " + t.accountId
      });
    }
  });

  return successResponse("Health check completed", {
    isHealthy: issues.length === 0,
    issuesCount: issues.length,
    issues: issues,
    stats: {
      transactionsCount: txs.length,
      accountsCount: accounts.length,
      transfersCount: transfers.length
    }
  });
}


// ==============================================================================
// MODULE: Code.gs
// ==============================================================================

/**
 * MSR Penny — Google Apps Script Web App Main Entry Point
 * File: Code.gs
 * Version: 3.1.0
 */

function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('🪙 MSR Penny')
    .addItem('⚡ Setup / Verify All Sheets', 'setupInitialSheets')
    .addItem('🏦 Setup Accounts & Transfers', 'ensureAccountsSheet')
    .addItem('🔄 Recalculate Family Balances', 'calculateFamilyBalancesFromSheet')
    .addSeparator()
    .addItem('🧪 Seed Sample Demo Data', 'seedSampleData')
    .addItem('🧹 Clear Demo Data (Keep Headers)', 'clearAllDataKeepHeaders')
    .addToUi();
}

function setupInitialSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureTransactionsSheet(ss);
  ensureAccountsSheet(ss);
  ensureTransfersSheet(ss);
  ensureFamilyContactsSheet(ss);
  ensureSettledArchiveSheet(ss);
  ensureReconciliationsSheet(ss);
  ensureAuditLogSheet(ss);
  SpreadsheetApp.getUi().alert("✅ All MSR Penny sheets created and verified with emerald branding!");
}

/**
 * Handles HTTP GET requests.
 */
function doGet(e) {
  var lock = null;
  try {
    lock = acquireScriptLock(CONFIG.LOCK_TIMEOUT_READ_MS);
  } catch (err) {
    return errorResponse("Database busy, please retry in a moment.", 503);
  }

  try {
    var ss = getTargetSpreadsheet(e ? e.parameter : null);
    var action = (e && e.parameter && e.parameter.action) ? String(e.parameter.action).toLowerCase() : "get_all_data";

    if (action === "health" || action === "ping") {
      return runDataHealthCheck(ss);
    }

    if (action === "get_all_data" || action === "state") {
      ensureTransactionsSheet(ss);
      ensureFamilyContactsSheet(ss);
      ensureAccountsSheet(ss);
      ensureTransfersSheet(ss);

      var txs = readTransactionsFromSheet(ss);
      var contacts = readFamilyContactsFromSheet(ss);
      var balanceInfo = calculateFamilyBalancesFromSheet(ss);
      var freelanceJobs = readFreelanceProjectsFromSheet(ss);
      var accounts = readAccountsFromSheet(ss);
      var transfers = readTransfersFromSheet(ss);
      var settledArchive = readSettledArchiveFromSheet(ss);
      var reconciliations = readReconciliationsFromSheet(ss);

      return successResponse("Data retrieved successfully", {
        transactions: txs,
        familyContacts: contacts,
        familyBalances: balanceInfo.balances,
        freelanceJobs: freelanceJobs,
        accounts: accounts,
        transfers: transfers,
        settledArchive: settledArchive,
        reconciliations: reconciliations
      });
    }

    if (action === "accounts") {
      return successResponse("Accounts retrieved", { accounts: readAccountsFromSheet(ss) });
    }

    if (action === "contacts") {
      return successResponse("Contacts retrieved", { contacts: readFamilyContactsFromSheet(ss) });
    }

    if (action === "transfers") {
      return successResponse("Transfers retrieved", { transfers: readTransfersFromSheet(ss) });
    }

    return errorResponse("Unknown GET action: " + action, 404);
  } catch (err) {
    return errorResponse("Server error: " + err.toString(), 500);
  } finally {
    releaseScriptLock(lock);
  }
}

/**
 * Handles HTTP POST requests.
 */
function doPost(e) {
  var lock = null;
  try {
    lock = acquireScriptLock(CONFIG.LOCK_TIMEOUT_WRITE_MS);
  } catch (err) {
    return errorResponse("Concurrent write in progress, please retry.", 503);
  }

  try {
    var payload;
    try {
      payload = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      return errorResponse("Malformed JSON request body: " + parseErr.toString(), 400);
    }

    var ss = getTargetSpreadsheet(payload);
    var action = payload.action || "sync_all";

    if (action === "add_transaction") {
      return saveSingleTransaction(ss, payload.transaction);
    }
    if (action === "delete_transaction") {
      return deleteSingleTransaction(ss, payload.id || payload.transactionId);
    }
    if (action === "update_accounts") {
      return saveAccountsWithAuditAndBackup(ss, payload.accounts);
    }
    if (action === "save_transfer") {
      return saveSingleTransfer(ss, payload.transfer);
    }
    if (action === "delete_transfer") {
      return deleteSingleTransfer(ss, payload.id || payload.transferId);
    }
    if (action === "archive_settled") {
      return archiveSettledTransactions(ss, payload.batchId, payload.contactId, payload.txIds);
    }
    if (action === "restore_archive") {
      return restoreArchivedTransactions(ss, payload.batchId);
    }
    if (action === "reconcile_balance") {
      return saveReconciliationAdjustment(ss, payload.reconciliation);
    }
    if (action === "sync_all") {
      if (payload.transactions && Array.isArray(payload.transactions)) {
        payload.transactions.forEach(function(tx) {
          saveSingleTransaction(ss, tx);
        });
      }
      if (payload.accounts && Array.isArray(payload.accounts)) {
        saveAccountsWithAuditAndBackup(ss, payload.accounts);
      }
      if (payload.familyContacts && Array.isArray(payload.familyContacts)) {
        syncFamilyContactsSheet(ss, payload.familyContacts);
      }
      if (payload.freelanceJobs && Array.isArray(payload.freelanceJobs)) {
        syncFreelanceSheet(ss, payload.freelanceJobs);
      }
      return successResponse("Batch sync completed successfully", {
        syncedAt: new Date().toISOString()
      });
    }

    return errorResponse("Unknown POST action: " + action, 404);
  } catch (err) {
    return errorResponse("Execution error: " + err.toString(), 500);
  } finally {
    releaseScriptLock(lock);
  }
}


// ==============================================================================
// MODULE: testData.gs
// ==============================================================================

/**
 * MSR Penny — Google Apps Script Demo Data & Test Utilities
 * File: testData.gs
 */

function seedSampleData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var txSheet = ensureTransactionsSheet(ss);
  var contactsSheet = ensureFamilyContactsSheet(ss);
  var accountsSheet = ensureAccountsSheet(ss);

  var now = new Date();
  var todayStr = Utilities.formatDate(now, CONFIG.TIMEZONE, "yyyy-MM-dd");

  var demoTxs = [
    ["tx-demo-1", todayStr, "Metro Rail Smartcard Recharge", 200, "expense", "Travel", "upi", "acc-sbi", "SBI (Main)", "FALSE", "FALSE", "", "", "FALSE", "settled", "", "", "Campus commute recharge", now.toISOString()],
    ["tx-demo-2", todayStr, "Appa College Semester Bus Pass", 450, "expense", "Travel", "cash", "acc-cash", "Cash", "TRUE", "TRUE", "family-appa", "Appa", "FALSE", "pending", "", "", "Reimbursable student pass", now.toISOString()],
    ["tx-demo-3", todayStr, "Graphic Design Client Advance", 2500, "income", "Freelance", "upi", "acc-sbi", "SBI (Main)", "FALSE", "FALSE", "", "", "FALSE", "settled", "job-demo-1", "Advance 50%", "Acme Corp Tech Fest Poster", now.toISOString()],
    ["tx-demo-4", todayStr, "College Canteen Lunch", 80, "expense", "Food", "upi", "acc-iob", "IOB (Second)", "FALSE", "FALSE", "", "", "FALSE", "settled", "", "", "Campus meals", now.toISOString()],
    ["tx-demo-5", todayStr, "UPI Repayment from Appa", 450, "repayment", "Family", "upi", "acc-sbi", "SBI (Main)", "FALSE", "FALSE", "family-appa", "Appa", "TRUE", "settled", "", "", "Settlement for semester bus pass", now.toISOString()]
  ];

  demoTxs.forEach(function(r) {
    txSheet.appendRow(r);
  });

  SpreadsheetApp.getUi().alert("✅ Sample demo data populated successfully! 5 realistic demo records created.");
}

function clearAllDataKeepHeaders() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetNames = [CONFIG.SHEETS.TRANSACTIONS, CONFIG.SHEETS.TRANSFERS, CONFIG.SHEETS.SETTLED_ARCHIVE, CONFIG.SHEETS.RECONCILIATIONS];

  sheetNames.forEach(function(name) {
    var sheet = ss.getSheetByName(name);
    if (sheet && sheet.getLastRow() > 1) {
      sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
    }
  });

  SpreadsheetApp.getUi().alert("🧹 All transactional data cleared! Headers and accounts remain intact.");
}


