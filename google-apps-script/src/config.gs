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
