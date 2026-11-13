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
