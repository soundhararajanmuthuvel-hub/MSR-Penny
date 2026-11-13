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
