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
