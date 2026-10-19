/**
 * Normalizes an Indian phone number for WhatsApp Click-to-Chat (wa.me)
 * 
 * Rules:
 * - Strip all non-digit characters (+, spaces, hyphens, brackets).
 * - If 10 digits (e.g. 9876543210), prepend '91' -> '919876543210'.
 * - If 11 digits starting with '0' (e.g. 09876543210), strip leading '0' and prepend '91' -> '919876543210'.
 * - If 12 digits starting with '91' (e.g. 919876543210), keep as is.
 * - If empty or less than 10 digits, returns empty string.
 */
export function normalizeWhatsAppNumber(raw: string | undefined | null): string {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';

  if (digits.length === 10) {
    return '91' + digits;
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return '91' + digits.substring(1);
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits;
  }
  if (digits.length >= 10) {
    return digits;
  }
  return '';
}

/**
 * Validates whether a phone number can generate a valid WhatsApp Click-to-Chat link.
 */
export function isValidWhatsAppNumber(raw: string | undefined | null): boolean {
  const normalized = normalizeWhatsAppNumber(raw);
  return normalized.length >= 10 && normalized.length <= 15;
}

/**
 * Formats phone number for display (e.g., +91 98765 43210)
 */
export function formatPhoneNumberDisplay(raw: string | undefined | null): string {
  const norm = normalizeWhatsAppNumber(raw);
  if (!norm) return raw || 'Not configured';
  if (norm.startsWith('91') && norm.length === 12) {
    return `+91 ${norm.substring(2, 7)} ${norm.substring(7)}`;
  }
  return `+${norm}`;
}
