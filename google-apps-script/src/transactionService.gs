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
