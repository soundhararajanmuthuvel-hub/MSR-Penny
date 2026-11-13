/**
 * MSR Penny — Google Apps Script Web App (Production)
 * Single Source of Truth for MSR Penny Personal Finance PWA
 * Version: 3.1.0
 */

var BRAND_COLOR = "#006948";
var TIMEZONE = "Asia/Kolkata";

var SHEETS = {
  TRANSACTIONS: "Transactions",
  ACCOUNTS: "Accounts",
  TRANSFERS: "Transfers",
  FAMILY_CONTACTS: "Family_Contacts",
  FREELANCE: "Freelance_Projects",
  SETTLED_ARCHIVE: "Settled_Archive",
  RECONCILIATIONS: "Reconciliations",
  AUDIT_LOG: "Audit_Log"
};

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function success(msg, data) {
  return jsonResponse({ success: true, message: msg || "OK", data: data || {}, timestamp: new Date().toISOString() });
}

function error(msg, code) {
  return jsonResponse({ success: false, error: msg || "Error", statusCode: code || 500, timestamp: new Date().toISOString() });
}

function sanitize(val) {
  if (val === null || val === undefined) return "";
  if (typeof val === "string") {
    var s = val.trim();
    if (s.length > 0 && (s[0] === "=" || s[0] === "+" || s[0] === "-" || s[0] === "@")) {
      return "'" + s;
    }
    return s;
  }
  return val;
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  try {
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return Utilities.formatDate(d, TIMEZONE, "yyyy-MM-dd");
  } catch (e) {
    return String(dateStr);
  }
}

function getTargetSpreadsheet(p) {
  var id = p && (p.spreadsheetId || p.sheetId);
  if (id) {
    try { return SpreadsheetApp.openById(id); } catch (e) {}
  }
  var savedId = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
  if (savedId) {
    try { return SpreadsheetApp.openById(savedId); } catch (e) {}
  }
  try { return SpreadsheetApp.getActiveSpreadsheet(); } catch (e) {
    throw new Error("No active Google Spreadsheet found.");
  }
}

function formatHeader(sheet, numCols) {
  var r = sheet.getRange(1, 1, 1, numCols);
  r.setBackground(BRAND_COLOR);
  r.setFontColor("#ffffff");
  r.setFontWeight("bold");
  r.setFontSize(10);
  r.setHorizontalAlignment("center");
  sheet.setFrozenRows(1);
}

function getOrCreateSheet(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    formatHeader(sheet, headers.length);
  } else if (sheet.getLastRow() === 0 || sheet.getLastColumn() === 0) {
    sheet.appendRow(headers);
    formatHeader(sheet, headers.length);
  }
  return sheet;
}

function ensureAllSheets(ss) {
  getOrCreateSheet(ss, SHEETS.TRANSACTIONS, [
    "ID", "Date", "Title", "Amount (₹)", "Type", "Category", "Payment Method",
    "Account ID", "Account Name", "Is Appa Reimbursable", "Is Family Reimbursable",
    "Family Contact ID", "Family Contact Name", "Appa Settled", "Settlement Status",
    "Freelance Job ID", "Milestone Title", "Notes", "Created At"
  ]);

  var accSheet = getOrCreateSheet(ss, SHEETS.ACCOUNTS, [
    "Account ID", "Account Name", "Type", "Opening Balance", "Opening Date", "Active", "Created At", "Updated At"
  ]);
  if (accSheet.getLastRow() <= 1) {
    var nowIso = new Date().toISOString();
    accSheet.appendRow(["acc-sbi", "SBI (Main)", "bank", 10000, "2026-01-01", "TRUE", nowIso, nowIso]);
    accSheet.appendRow(["acc-iob", "IOB (Second)", "bank", 2000, "2026-01-01", "TRUE", nowIso, nowIso]);
    accSheet.appendRow(["acc-cash", "Cash", "cash", 500, "2026-01-01", "TRUE", nowIso, nowIso]);
  }

  getOrCreateSheet(ss, SHEETS.TRANSFERS, [
    "Transfer ID", "Date", "Amount (₹)", "From Account ID", "From Account Name",
    "To Account ID", "To Account Name", "Fee (₹)", "Notes", "Created At"
  ]);

  var contSheet = getOrCreateSheet(ss, SHEETS.FAMILY_CONTACTS, [
    "Contact ID", "Name", "Relationship", "Phone Number", "Active", "Created At", "Updated At"
  ]);
  if (contSheet.getLastRow() <= 1) {
    var nowIso2 = new Date().toISOString();
    contSheet.appendRow(["family-appa", "Appa", "Father", "+919876543210", "TRUE", nowIso2, nowIso2]);
    contSheet.appendRow(["family-amma", "Amma", "Mother", "", "TRUE", nowIso2, nowIso2]);
    contSheet.appendRow(["family-chinna-akka", "Chinna Akka", "Sister", "", "TRUE", nowIso2, nowIso2]);
    contSheet.appendRow(["family-periya-akka", "Periya Akka", "Sister", "", "TRUE", nowIso2, nowIso2]);
  }

  getOrCreateSheet(ss, SHEETS.SETTLED_ARCHIVE, [
    "Archive ID", "Batch ID", "Archived At", "Original Transaction ID", "Date", "Title",
    "Amount (₹)", "Type", "Category", "Payment Method", "Account ID", "Account Name",
    "Family Contact ID", "Family Contact Name", "Settlement Status", "Notes", "Original Created At"
  ]);

  getOrCreateSheet(ss, SHEETS.RECONCILIATIONS, [
    "Reconciliation ID", "Reconciled At", "Account ID", "Account Name",
    "Passbook Balance (₹)", "Computed Balance (₹)", "Adjustment Amount (₹)", "Notes", "Created At"
  ]);

  getOrCreateSheet(ss, SHEETS.AUDIT_LOG, [
    "Log ID", "Timestamp", "Action", "Entity Type", "Entity ID", "Summary", "Status"
  ]);

  getOrCreateSheet(ss, SHEETS.FREELANCE, [
    "Job ID", "Client Name", "Project Title", "Total Amount (₹)", "Received Amount (₹)", "Status", "Notes", "Milestones (JSON)"
  ]);
}

function logAudit(ss, action, type, id, summary) {
  try {
    var s = ss.getSheetByName(SHEETS.AUDIT_LOG);
    if (s) {
      s.appendRow(["log-" + new Date().getTime(), new Date().toISOString(), action, type, id, summary, "SUCCESS"]);
    }
  } catch (e) {}
}

function readTransactions(ss) {
  var s = ss.getSheetByName(SHEETS.TRANSACTIONS);
  if (!s || s.getLastRow() <= 1) return [];
  var rows = s.getRange(2, 1, s.getLastRow() - 1, 19).getValues();
  var txs = [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var id = String(r[0]).trim();
    if (!id) continue;
    var d = r[1] instanceof Date ? Utilities.formatDate(r[1], TIMEZONE, "yyyy-MM-dd") : formatDate(String(r[1]));
    txs.push({
      id: id,
      date: d,
      title: String(r[2]),
      amount: Number(r[3]) || 0,
      type: String(r[4] || "expense").toLowerCase(),
      category: String(r[5] || "Other"),
      paymentMethod: String(r[6] || "upi").toLowerCase(),
      accountId: String(r[7] || ""),
      accountName: String(r[8] || ""),
      isAppaReimbursable: String(r[9]).toUpperCase() === "TRUE",
      isFamilyReimbursable: String(r[10]).toUpperCase() === "TRUE",
      familyContactId: String(r[11] || ""),
      familyContactName: String(r[12] || ""),
      appaSettled: String(r[13]).toUpperCase() === "TRUE",
      settlementStatus: String(r[14] || "pending"),
      freelanceJobId: String(r[15] || ""),
      milestoneTitle: String(r[16] || ""),
      notes: String(r[17] || ""),
      createdAt: r[18] instanceof Date ? r[18].toISOString() : String(r[18] || "")
    });
  }
  txs.sort(function(a, b) { return new Date(b.date).getTime() - new Date(a.date).getTime(); });
  return txs;
}

function saveTransaction(ss, tx) {
  if (!tx || !tx.id || !tx.title) return error("Transaction ID and title are required", 400);
  var s = ss.getSheetByName(SHEETS.TRANSACTIONS);
  if (!s) return error("Transactions sheet not found", 404);
  var lastRow = s.getLastRow();
  var targetRow = -1;
  if (lastRow > 1) {
    var ids = s.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0]).trim() === tx.id) { targetRow = i + 2; break; }
    }
  }
  var row = [
    sanitize(tx.id), formatDate(tx.date), sanitize(tx.title), Number(tx.amount) || 0,
    sanitize(tx.type || "expense"), sanitize(tx.category || "Other"), sanitize(tx.paymentMethod || "upi"),
    sanitize(tx.accountId || ""), sanitize(tx.accountName || ""),
    tx.isAppaReimbursable ? "TRUE" : "FALSE", tx.isFamilyReimbursable ? "TRUE" : "FALSE",
    sanitize(tx.familyContactId || ""), sanitize(tx.familyContactName || ""),
    tx.appaSettled ? "TRUE" : "FALSE", sanitize(tx.settlementStatus || "pending"),
    sanitize(tx.freelanceJobId || ""), sanitize(tx.milestoneTitle || ""),
    sanitize(tx.notes || ""), tx.createdAt ? String(tx.createdAt) : new Date().toISOString()
  ];
  if (targetRow > 0) s.getRange(targetRow, 1, 1, row.length).setValues([row]);
  else s.appendRow(row);
  return success("Transaction saved", { transaction: tx });
}

function deleteTransaction(ss, id) {
  if (!id) return error("ID required", 400);
  var s = ss.getSheetByName(SHEETS.TRANSACTIONS);
  if (!s || s.getLastRow() <= 1) return error("Transaction not found", 404);
  var ids = s.getRange(2, 1, s.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]).trim() === id) { s.deleteRow(i + 2); return success("Deleted", { id: id }); }
  }
  return error("Not found", 404);
}

function readAccounts(ss) {
  var s = ss.getSheetByName(SHEETS.ACCOUNTS);
  if (!s || s.getLastRow() <= 1) return [];
  var rows = s.getRange(2, 1, s.getLastRow() - 1, 8).getValues();
  var accs = [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (!String(r[0]).trim()) continue;
    accs.push({
      id: String(r[0]), name: String(r[1]), type: String(r[2] || "bank"),
      openingBalance: Number(r[3]) || 0, openingDate: formatDate(String(r[4] || "2026-01-01")),
      active: String(r[5]).toUpperCase() === "TRUE",
      createdAt: String(r[6] || ""), updatedAt: String(r[7] || "")
    });
  }
  return accs;
}

function saveAccounts(ss, accounts) {
  if (!accounts || !Array.isArray(accounts)) return error("Invalid accounts array", 400);
  var s = ss.getSheetByName(SHEETS.ACCOUNTS);
  if (!s) return error("Accounts sheet not found", 404);
  if (s.getLastRow() > 1) s.getRange(2, 1, s.getLastRow() - 1, 8).clearContent();
  var rows = [];
  var now = new Date().toISOString();
  accounts.forEach(function(a) {
    rows.push([
      sanitize(a.id), sanitize(a.name), sanitize(a.type || "bank"),
      Number(a.openingBalance) || 0, formatDate(a.openingDate || "2026-01-01"),
      a.active !== false ? "TRUE" : "FALSE", a.createdAt || now, now
    ]);
  });
  if (rows.length > 0) s.getRange(2, 1, rows.length, 8).setValues(rows);
  logAudit(ss, "UPDATE_ACCOUNTS", "accounts", "all", "Updated " + accounts.length + " accounts");
  return success("Accounts updated", { accounts: accounts });
}

function readTransfers(ss) {
  var s = ss.getSheetByName(SHEETS.TRANSFERS);
  if (!s || s.getLastRow() <= 1) return [];
  var rows = s.getRange(2, 1, s.getLastRow() - 1, 10).getValues();
  var trs = [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (!String(r[0]).trim()) continue;
    trs.push({
      id: String(r[0]), date: formatDate(String(r[1])), amount: Number(r[2]) || 0,
      fromAccountId: String(r[3]), fromAccountName: String(r[4]),
      toAccountId: String(r[5]), toAccountName: String(r[6]),
      fee: Number(r[7]) || 0, notes: String(r[8] || ""), createdAt: String(r[9] || "")
    });
  }
  return trs;
}

function saveTransfer(ss, tr) {
  if (!tr || !tr.id || !tr.fromAccountId || !tr.toAccountId) return error("Invalid transfer", 400);
  var s = ss.getSheetByName(SHEETS.TRANSFERS);
  if (!s) return error("Transfers sheet not found", 404);
  s.appendRow([
    sanitize(tr.id), formatDate(tr.date), Number(tr.amount) || 0,
    sanitize(tr.fromAccountId), sanitize(tr.fromAccountName || ""),
    sanitize(tr.toAccountId), sanitize(tr.toAccountName || ""),
    Number(tr.fee) || 0, sanitize(tr.notes || ""), tr.createdAt || new Date().toISOString()
  ]);
  logAudit(ss, "CREATE_TRANSFER", "transfer", tr.id, "Transfer of ₹" + tr.amount);
  return success("Transfer saved", { transfer: tr });
}

function readContacts(ss) {
  var s = ss.getSheetByName(SHEETS.FAMILY_CONTACTS);
  if (!s || s.getLastRow() <= 1) return [];
  var rows = s.getRange(2, 1, s.getLastRow() - 1, 7).getValues();
  var conts = [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (!String(r[0]).trim()) continue;
    conts.push({
      id: String(r[0]), name: String(r[1]), relationship: String(r[2] || ""),
      phoneNumber: String(r[3] || ""), active: String(r[4]).toUpperCase() === "TRUE",
      createdAt: String(r[5] || ""), updatedAt: String(r[6] || "")
    });
  }
  return conts;
}

function calculateBalances(txs, conts) {
  var bals = {};
  conts.forEach(function(c) {
    bals[c.id] = { contact: c, totalReimbursable: 0, totalRepaid: 0, outstandingBalance: 0, pendingCount: 0 };
  });
  txs.forEach(function(t) {
    var cid = t.familyContactId || ((t.isAppaReimbursable || t.type === 'repayment') ? 'family-appa' : null);
    if (!cid || !bals[cid]) return;
    var amt = Number(t.amount) || 0;
    if (t.type === 'repayment') bals[cid].totalRepaid += amt;
    else if (t.type === 'expense' && (t.isAppaReimbursable || t.isFamilyReimbursable)) {
      bals[cid].totalReimbursable += amt;
      if (!t.appaSettled && t.settlementStatus !== 'settled') bals[cid].pendingCount += 1;
    }
  });
  var totalOut = 0;
  Object.keys(bals).forEach(function(k) {
    var b = bals[k];
    b.outstandingBalance = Math.max(0, b.totalReimbursable - b.totalRepaid);
    if (b.outstandingBalance <= 0) b.pendingCount = 0;
    totalOut += b.outstandingBalance;
  });
  return { balances: bals, totalOutstanding: totalOut };
}

function archiveSettled(ss, batchId, contactId, txIds) {
  if (!batchId || !txIds || !Array.isArray(txIds) || txIds.length === 0) return error("Missing parameters", 400);
  var txSheet = ss.getSheetByName(SHEETS.TRANSACTIONS);
  var archSheet = ss.getSheetByName(SHEETS.SETTLED_ARCHIVE);
  if (!txSheet || !archSheet) return error("Sheets missing", 404);
  var lastRow = txSheet.getLastRow();
  if (lastRow <= 1) return error("No transactions", 400);
  var data = txSheet.getRange(2, 1, lastRow - 1, 19).getValues();
  var idSet = {};
  txIds.forEach(function(id) { idSet[id] = true; });
  var rowsToArch = [];
  var delIndices = [];
  var now = new Date().toISOString();
  for (var i = 0; i < data.length; i++) {
    var r = data[i];
    var id = String(r[0]).trim();
    if (idSet[id]) {
      rowsToArch.push(["arch-" + id, batchId, now, id, r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8], r[11], r[12], "archived", r[17], r[18]]);
      delIndices.push(i + 2);
    }
  }
  for (var a = 0; a < rowsToArch.length; a++) archSheet.appendRow(rowsToArch[a]);
  delIndices.sort(function(x, y) { return y - x; });
  for (var d = 0; d < delIndices.length; d++) txSheet.deleteRow(delIndices[d]);
  logAudit(ss, "ARCHIVE", "archive", batchId, "Archived " + rowsToArch.length + " items for " + contactId);
  return success("Archived " + rowsToArch.length + " transactions", { batchId: batchId, count: rowsToArch.length });
}

function restoreArchive(ss, batchId) {
  if (!batchId) return error("Batch ID required", 400);
  var archSheet = ss.getSheetByName(SHEETS.SETTLED_ARCHIVE);
  var txSheet = ss.getSheetByName(SHEETS.TRANSACTIONS);
  if (!archSheet || !txSheet || archSheet.getLastRow() <= 1) return error("Archive empty", 404);
  var data = archSheet.getRange(2, 1, archSheet.getLastRow() - 1, 17).getValues();
  var rowsToRestore = [];
  var delIndices = [];
  for (var i = 0; i < data.length; i++) {
    var r = data[i];
    if (String(r[1]).trim() === batchId) {
      rowsToRestore.push([r[3], r[4], r[5], r[6], r[7], r[8], r[9], r[10], r[11], r[12] === 'family-appa' ? "TRUE" : "FALSE", "TRUE", r[12], r[13], "TRUE", "settled", "", "", r[15], r[16]]);
      delIndices.push(i + 2);
    }
  }
  for (var a = 0; a < rowsToRestore.length; a++) txSheet.appendRow(rowsToRestore[a]);
  delIndices.sort(function(x, y) { return y - x; });
  for (var d = 0; d < delIndices.length; d++) archSheet.deleteRow(delIndices[d]);
  logAudit(ss, "RESTORE", "archive", batchId, "Restored " + rowsToRestore.length + " items");
  return success("Restored " + rowsToRestore.length + " transactions", { batchId: batchId });
}

function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('🪙 MSR Penny')
    .addItem('⚡ Setup / Verify All Sheets', 'menuSetup')
    .addItem('🧪 Seed Sample Demo Data', 'menuSeed')
    .addItem('🧹 Clear Demo Data (Keep Headers)', 'menuClear')
    .addToUi();
}

function menuSetup() {
  ensureAllSheets(SpreadsheetApp.getActiveSpreadsheet());
  SpreadsheetApp.getUi().alert("✅ All MSR Penny sheets verified!");
}

function menuSeed() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureAllSheets(ss);
  var s = ss.getSheetByName(SHEETS.TRANSACTIONS);
  var today = Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd");
  var now = new Date().toISOString();
  s.appendRow(["tx-demo-1", today, "Metro Rail Smartcard Recharge", 200, "expense", "Travel", "upi", "acc-sbi", "SBI (Main)", "FALSE", "FALSE", "", "", "FALSE", "settled", "", "", "Campus commute recharge", now]);
  s.appendRow(["tx-demo-2", today, "Appa College Semester Bus Pass", 450, "expense", "Travel", "cash", "acc-cash", "Cash", "TRUE", "TRUE", "family-appa", "Appa", "FALSE", "pending", "", "", "Reimbursable student pass", now]);
  s.appendRow(["tx-demo-3", today, "Graphic Design Client Advance", 2500, "income", "Freelance", "upi", "acc-sbi", "SBI (Main)", "FALSE", "FALSE", "", "", "FALSE", "settled", "job-demo-1", "Advance 50%", "Acme Corp Tech Fest Poster", now]);
  s.appendRow(["tx-demo-4", today, "College Canteen Lunch", 80, "expense", "Food", "upi", "acc-iob", "IOB (Second)", "FALSE", "FALSE", "", "", "FALSE", "settled", "", "", "Campus meals", now]);
  s.appendRow(["tx-demo-5", today, "UPI Repayment from Appa", 450, "repayment", "Family", "upi", "acc-sbi", "SBI (Main)", "FALSE", "FALSE", "family-appa", "Appa", "TRUE", "settled", "", "", "Settlement for semester pass", now]);
  SpreadsheetApp.getUi().alert("✅ Sample demo data seeded!");
}

function menuClear() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  [SHEETS.TRANSACTIONS, SHEETS.TRANSFERS, SHEETS.SETTLED_ARCHIVE, SHEETS.RECONCILIATIONS].forEach(function(n) {
    var s = ss.getSheetByName(n);
    if (s && s.getLastRow() > 1) s.getRange(2, 1, s.getLastRow() - 1, s.getLastColumn()).clearContent();
  });
  SpreadsheetApp.getUi().alert("🧹 Data cleared!");
}

function doGet(e) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(15000); } catch (err) { return error("Database busy", 503); }
  try {
    var ss = getTargetSpreadsheet(e ? e.parameter : null);
    ensureAllSheets(ss);
    var action = (e && e.parameter && e.parameter.action) ? String(e.parameter.action).toLowerCase() : "get_all_data";
    if (action === "health" || action === "ping") {
      return success("Healthy", { status: "healthy", spreadsheetName: ss.getName() });
    }
    if (action === "get_all_data" || action === "state") {
      var txs = readTransactions(ss);
      var conts = readContacts(ss);
      var balInfo = calculateBalances(txs, conts);
      return success("State retrieved", {
        transactions: txs,
        accounts: readAccounts(ss),
        transfers: readTransfers(ss),
        familyContacts: conts,
        familyBalances: balInfo.balances,
        freelanceJobs: [],
        timestamp: new Date().toISOString()
      });
    }
    if (action === "accounts") return success("Accounts", { accounts: readAccounts(ss) });
    if (action === "contacts") return success("Contacts", { contacts: readContacts(ss) });
    if (action === "transfers") return success("Transfers", { transfers: readTransfers(ss) });
    return error("Unknown GET action: " + action, 404);
  } catch (err) {
    return error("Server error: " + err.toString(), 500);
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(30000); } catch (err) { return error("Write in progress", 503); }
  try {
    var p = JSON.parse(e.postData.contents);
    var ss = getTargetSpreadsheet(p);
    ensureAllSheets(ss);
    var action = p.action || "sync_all";
    if (action === "add_transaction") return saveTransaction(ss, p.transaction);
    if (action === "delete_transaction") return deleteTransaction(ss, p.id || p.transactionId);
    if (action === "update_accounts") return saveAccounts(ss, p.accounts);
    if (action === "save_transfer") return saveTransfer(ss, p.transfer);
    if (action === "archive_settled") return archiveSettled(ss, p.batchId, p.contactId, p.txIds);
    if (action === "restore_archive") return restoreArchive(ss, p.batchId);
    if (action === "sync_all") {
      if (p.transactions && Array.isArray(p.transactions)) p.transactions.forEach(function(t) { saveTransaction(ss, t); });
      if (p.accounts && Array.isArray(p.accounts)) saveAccounts(ss, p.accounts);
      return success("Sync complete", { syncedAt: new Date().toISOString() });
    }
    return error("Unknown POST action: " + action, 404);
  } catch (err) {
    return error("Error: " + err.toString(), 500);
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}
