/**
 * MSR Penny — Google Apps Script Response Utilities
 * File: responseUtils.gs
 */

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function successResponse(message, data) {
  var payload = {
    success: true,
    message: message || "Operation completed successfully",
    data: data || {},
    timestamp: new Date().toISOString()
  };
  return jsonResponse(payload);
}

function errorResponse(errorMessage, statusCode) {
  var payload = {
    success: false,
    error: errorMessage || "An unexpected error occurred",
    statusCode: statusCode || 500,
    timestamp: new Date().toISOString()
  };
  return jsonResponse(payload);
}
