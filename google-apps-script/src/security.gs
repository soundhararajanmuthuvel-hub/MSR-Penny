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
