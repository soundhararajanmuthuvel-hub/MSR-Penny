import { Transaction, TransactionCategory } from '../src/types';

/**
 * Normalizes family contact input from Apple Shortcuts.
 * Supports:
 * - Contact IDs: 'family-appa', 'family-amma', 'family-chinna-akka', 'family-periya-akka'
 * - Names & Aliases: 'Appa', 'Dad', 'Amma', 'Mom', 'Chinna Akka', 'Periya Akka'
 * - Boolean flags: isAppaReimbursable, isFamilyReimbursable
 */
export interface FamilyResolution {
  isReimbursable: boolean;
  contactId: string;
  contactName: string;
}

export function resolveFamilyContact(rawInput?: any, isAppaFlag?: boolean, isFamilyFlag?: boolean): FamilyResolution {
  // If boolean flag explicitly given without a contact name
  if (!rawInput && (isAppaFlag || isFamilyFlag)) {
    return { isReimbursable: true, contactId: 'family-appa', contactName: 'Appa' };
  }

  if (!rawInput) {
    return { isReimbursable: false, contactId: '', contactName: '' };
  }

  const str = String(rawInput).trim().toLowerCase();

  // Explicit personal / non-reimbursable indicators
  if (
    str === 'none' ||
    str === 'personal' ||
    str === 'self' ||
    str === 'me' ||
    str === 'no' ||
    str === 'false' ||
    str === '0'
  ) {
    return { isReimbursable: false, contactId: '', contactName: '' };
  }

  // Appa
  if (
    str === 'family-appa' ||
    str === 'appa' ||
    str === 'dad' ||
    str === 'father' ||
    str === 'daddy'
  ) {
    return { isReimbursable: true, contactId: 'family-appa', contactName: 'Appa' };
  }

  // Amma
  if (
    str === 'family-amma' ||
    str === 'amma' ||
    str === 'mom' ||
    str === 'mother' ||
    str === 'mommy'
  ) {
    return { isReimbursable: true, contactId: 'family-amma', contactName: 'Amma' };
  }

  // Chinna Akka
  if (
    str === 'family-chinna-akka' ||
    str === 'chinna akka' ||
    str === 'chinna-akka' ||
    str === 'chinna' ||
    str === 'younger sister'
  ) {
    return { isReimbursable: true, contactId: 'family-chinna-akka', contactName: 'Chinna Akka' };
  }

  // Periya Akka
  if (
    str === 'family-periya-akka' ||
    str === 'periya akka' ||
    str === 'periya-akka' ||
    str === 'periya' ||
    str === 'elder sister'
  ) {
    return { isReimbursable: true, contactId: 'family-periya-akka', contactName: 'Periya Akka' };
  }

  // Custom contact name if provided
  if (str.length > 0) {
    const formatted = str
      .split(/[-_\s]+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
    const idSlug = str.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    return {
      isReimbursable: true,
      contactId: idSlug.startsWith('family-') ? idSlug : `family-${idSlug}`,
      contactName: formatted,
    };
  }

  return { isReimbursable: false, contactId: '', contactName: '' };
}

/**
 * Normalizes date into YYYY-MM-DD.
 * Defaults to current date in Asia/Kolkata (Indian Standard Time).
 */
export function normalizeDate(inputDate?: any): string {
  if (!inputDate || typeof inputDate !== 'string' || !inputDate.trim()) {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    } catch {
      return new Date().toISOString().split('T')[0];
    }
  }

  const str = inputDate.trim();
  if (str.toLowerCase() === 'today') {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    } catch {
      return new Date().toISOString().split('T')[0];
    }
  }

  if (str.toLowerCase() === 'yesterday') {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
    } catch {
      return d.toISOString().split('T')[0];
    }
  }

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // ISO string
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(parsed);
    } catch {
      return parsed.toISOString().split('T')[0];
    }
  }

  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

/**
 * Normalizes category to strictly valid TransactionCategory.
 */
export function normalizeCategory(cat?: string, title?: string): TransactionCategory {
  const validCategories: TransactionCategory[] = [
    'Travel',
    'Food',
    'College',
    'Shopping',
    'Freelance',
    'Academics',
    'Family',
    'Other',
  ];

  if (cat && typeof cat === 'string' && cat.trim()) {
    const c = cat.trim().toLowerCase();
    if (
      c === 'travel' ||
      c === 'transport' ||
      c === 'commute' ||
      c === 'petrol' ||
      c === 'fuel' ||
      c === 'rapido' ||
      c === 'uber' ||
      c === 'ola' ||
      c === 'auto' ||
      c === 'bus' ||
      c === 'train' ||
      c === 'metro'
    ) {
      return 'Travel';
    }
    if (
      c === 'food' ||
      c === 'dining' ||
      c === 'snacks' ||
      c === 'canteen' ||
      c === 'lunch' ||
      c === 'dinner' ||
      c === 'breakfast' ||
      c === 'swiggy' ||
      c === 'zomato' ||
      c === 'tea' ||
      c === 'coffee'
    ) {
      return 'Food';
    }
    if (c === 'college' || c === 'campus' || c === 'hostel' || c === 'mess' || c === 'fees') {
      return 'College';
    }
    if (
      c === 'shopping' ||
      c === 'groceries' ||
      c === 'grocery' ||
      c === 'clothes' ||
      c === 'recharge' ||
      c === 'bills' ||
      c === 'amazon' ||
      c === 'flipkart'
    ) {
      return 'Shopping';
    }
    if (c === 'freelance' || c === 'design' || c === 'work' || c === 'client' || c === 'project') {
      return 'Freelance';
    }
    if (
      c === 'academics' ||
      c === 'academic' ||
      c === 'education' ||
      c === 'books' ||
      c === 'tuition' ||
      c === 'print' ||
      c === 'xerox' ||
      c === 'stationery' ||
      c === 'exam'
    ) {
      return 'Academics';
    }
    if (c === 'family' || c === 'home' || c === 'relatives' || c === 'household' || c === 'parents') {
      return 'Family';
    }
    const found = validCategories.find((vc) => vc.toLowerCase() === c);
    if (found) return found;
  }

  const t = (title || '').toLowerCase();
  if (
    t.includes('canteen') ||
    t.includes('lunch') ||
    t.includes('dinner') ||
    t.includes('food') ||
    t.includes('snack') ||
    t.includes('coffee') ||
    t.includes('tea') ||
    t.includes('breakfast') ||
    t.includes('swiggy') ||
    t.includes('zomato')
  ) {
    return 'Food';
  }
  if (
    t.includes('bus') ||
    t.includes('train') ||
    t.includes('metro') ||
    t.includes('auto') ||
    t.includes('uber') ||
    t.includes('ola') ||
    t.includes('petrol') ||
    t.includes('fuel') ||
    t.includes('rapido')
  ) {
    return 'Travel';
  }
  if (
    t.includes('college') ||
    t.includes('hostel') ||
    t.includes('campus') ||
    t.includes('mess')
  ) {
    return 'College';
  }
  if (
    t.includes('print') ||
    t.includes('xerox') ||
    t.includes('book') ||
    t.includes('exam') ||
    t.includes('stationery')
  ) {
    return 'Academics';
  }
  if (
    t.includes('shopping') ||
    t.includes('amazon') ||
    t.includes('flipkart') ||
    t.includes('dress') ||
    t.includes('shirt')
  ) {
    return 'Shopping';
  }

  return 'Other';
}

/**
 * Extracts authentication token from Bearer header, API key headers, query, or body.
 */
export function extractToken(req: any): string {
  // 1. Authorization header: "Bearer <token>"
  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  if (typeof authHeader === 'string' && authHeader.trim()) {
    const parts = authHeader.trim().split(/\s+/);
    if (parts.length === 2 && /^bearer$/i.test(parts[0])) {
      return parts[1].trim();
    }
    return authHeader.trim();
  }

  // 2. Custom headers
  const customHeader =
    req.headers?.['x-api-key'] ||
    req.headers?.['X-Api-Key'] ||
    req.headers?.['x-shortcut-secret'] ||
    req.headers?.['X-Shortcut-Secret'] ||
    req.headers?.['x-auth-token'];
  if (typeof customHeader === 'string' && customHeader.trim()) {
    return customHeader.trim();
  }

  // 3. Request body
  if (req.body?.secretToken && typeof req.body.secretToken === 'string') {
    return req.body.secretToken.trim();
  }
  if (req.body?.token && typeof req.body.token === 'string') {
    return req.body.token.trim();
  }
  if (req.body?.apiKey && typeof req.body.apiKey === 'string') {
    return req.body.apiKey.trim();
  }

  // 4. Query parameter
  if (req.query?.token && typeof req.query.token === 'string') {
    return req.query.token.trim();
  }
  if (req.query?.key && typeof req.query.key === 'string') {
    return req.query.key.trim();
  }

  return '';
}

/**
 * Resolves or generates transaction ID.
 * Guarantees idempotency on retries if idempotencyKey or id is supplied.
 */
export function resolveTransactionId(body: any): string {
  if (body?.id && typeof body.id === 'string' && body.id.trim()) {
    return body.id.trim();
  }
  if (body?.idempotencyKey && typeof body.idempotencyKey === 'string' && body.idempotencyKey.trim()) {
    const key = body.idempotencyKey.trim().replace(/[^a-z0-9_-]/gi, '');
    return `tx-sc-${key}`;
  }
  return `tx-sc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
}

/**
 * Primary Vercel Serverless Function & Express Route Handler
 * Endpoint: POST /api/shortcut
 */
export default async function handler(req: any, res: any) {
  // 1. CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, x-shortcut-secret');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed: iPhone Apple Shortcuts endpoint only accepts POST requests.',
    });
  }

  // 2. Authentication Verification
  const configuredSecret = (
    process.env.SHORTCUT_SECRET_TOKEN ||
    process.env.MSR_SHORTCUT_TOKEN ||
    process.env.APPLE_SHORTCUT_TOKEN ||
    ''
  ).trim();

  if (!configuredSecret) {
    return res.status(500).json({
      success: false,
      error: 'Server authentication configuration missing.',
      hint: 'Please set the SHORTCUT_SECRET_TOKEN environment variable in your Vercel Project Settings > Environment Variables.',
    });
  }

  const providedToken = extractToken(req);
  if (!providedToken || providedToken !== configuredSecret) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Invalid or missing authentication token.',
      hint: 'Include your secret token in the Authorization header as "Bearer <TOKEN>" or in the "x-api-key" header.',
    });
  }

  // 3. Request Body Validation
  const body = req.body || {};

  // Amount parsing
  const rawAmount = body.amount ?? body.cost ?? body.price;
  let amount = NaN;
  if (typeof rawAmount === 'number') {
    amount = rawAmount;
  } else if (rawAmount !== undefined && rawAmount !== null) {
    const cleaned = String(rawAmount).trim().replace(/[^0-9.-]/g, '');
    amount = parseFloat(cleaned);
  }

  if (isNaN(amount) || amount <= 0) {
    return res.status(400).json({
      success: false,
      error: 'Invalid amount: A positive numeric amount is required (e.g. 120 or 250.50).',
    });
  }

  // Description / Title parsing
  const title = String(
    body.description || body.title || body.name || body.item || ''
  ).trim();
  if (!title) {
    return res.status(400).json({
      success: false,
      error: 'Description or title is required (e.g. "Lunch at Canteen", "Bus pass recharge").',
    });
  }

  // Date parsing
  const date = normalizeDate(body.date);

  // Category parsing
  const category = normalizeCategory(body.category, title);

  // Payment method
  const rawMethod = String(body.paymentMethod || body.payment_method || body.method || 'upi').toLowerCase();
  const paymentMethod = rawMethod.includes('cash') ? 'cash' : 'upi';

  // Family contact resolution (Appa, Amma, Chinna Akka, Periya Akka, or Personal)
  const rawContact =
    body.familyContactId ||
    body.familyContactName ||
    body.contactId ||
    body.contact ||
    body.for ||
    body.reimbursableTo;

  const isAppaFlag = Boolean(body.isAppaReimbursable);
  const isFamilyFlag = Boolean(body.isFamilyReimbursable);

  const familyRes = resolveFamilyContact(rawContact, isAppaFlag, isFamilyFlag);

  // Transaction ID with retry duplicate protection
  const txId = resolveTransactionId(body);

  const notes = String(body.notes || body.note || body.memo || 'Logged via iPhone Shortcut').trim();

  const transaction: Transaction = {
    id: txId,
    title,
    amount,
    type: 'expense',
    category,
    date,
    paymentMethod,
    isAppaReimbursable: familyRes.isReimbursable && familyRes.contactId === 'family-appa',
    appaSettled: false,
    isFamilyReimbursable: familyRes.isReimbursable,
    familyContactId: familyRes.isReimbursable ? familyRes.contactId : undefined,
    familyContactName: familyRes.isReimbursable ? familyRes.contactName : undefined,
    settlementStatus: familyRes.isReimbursable ? 'pending' : undefined,
    notes,
    createdAt: new Date().toISOString(),
  };

  // 4. Resolve Google Apps Script URL
  const scriptUrl = (
    body.googleAppsScriptUrl ||
    process.env.GOOGLE_APPS_SCRIPT_URL ||
    process.env.VITE_GOOGLE_APPS_SCRIPT_URL ||
    ''
  ).trim();

  if (!scriptUrl) {
    return res.status(500).json({
      success: false,
      error: 'Google Sheets connection not configured: GOOGLE_APPS_SCRIPT_URL environment variable is missing on Vercel.',
      hint: 'Add GOOGLE_APPS_SCRIPT_URL in your Vercel Project Settings > Environment Variables.',
    });
  }

  // 5. Save directly through Google Sheets backend
  try {
    const remoteRes = await fetch(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'add_transaction',
        transaction,
      }),
    });

    if (!remoteRes.ok) {
      return res.status(502).json({
        success: false,
        error: `Google Apps Script returned HTTP status ${remoteRes.status}.`,
        transactionId: txId,
      });
    }

    const gJson: any = await remoteRes.json();
    if (!gJson.success) {
      return res.status(500).json({
        success: false,
        error: gJson.error || 'Google Sheets rejected transaction save.',
        transactionId: txId,
      });
    }

    // 6. Return verified success only after Google Sheets confirmation
    let summaryText = `₹${amount.toLocaleString('en-IN')} spent on ${title} (${category})`;
    if (familyRes.isReimbursable) {
      const updatedBal = gJson.updatedBalance !== undefined ? `₹${Number(gJson.updatedBalance).toLocaleString('en-IN')}` : 'updated';
      summaryText += `. Reimbursable from ${familyRes.contactName} (Balance: ${updatedBal})`;
    }

    return res.status(200).json({
      success: true,
      message: `Saved ₹${amount.toLocaleString('en-IN')} for "${title}".`,
      summary: summaryText,
      transaction: {
        id: transaction.id,
        date: transaction.date,
        title: transaction.title,
        amount: transaction.amount,
        type: transaction.type,
        category: transaction.category,
        paymentMethod: transaction.paymentMethod,
        isFamilyReimbursable: transaction.isFamilyReimbursable,
        isAppaReimbursable: transaction.isAppaReimbursable,
        familyContactId: transaction.familyContactId || null,
        familyContactName: transaction.familyContactName || null,
        settlementStatus: transaction.settlementStatus || null,
        notes: transaction.notes,
      },
      family: {
        isReimbursable: familyRes.isReimbursable,
        contactId: familyRes.contactId || null,
        contactName: familyRes.contactName || null,
        previousBalance: gJson.previousBalance ?? null,
        updatedBalance: gJson.updatedBalance ?? null,
      },
      googleSheetsConfirmed: true,
      googleSheetsMessage: gJson.message || 'Transaction saved successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(502).json({
      success: false,
      error: `Failed to reach Google Apps Script: ${err.message || 'Network timeout'}`,
      transactionId: txId,
    });
  }
}
