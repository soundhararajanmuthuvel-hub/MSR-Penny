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
