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
