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
