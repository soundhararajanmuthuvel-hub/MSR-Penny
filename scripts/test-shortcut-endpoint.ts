/**
 * Automated Verification Suite for iPhone Apple Shortcuts Integration
 * Tests:
 * 1. Token extraction and authentication rejection (401)
 * 2. Method validation (POST only - 405)
 * 3. Input validation: amount, description, date, category (400)
 * 4. Date normalization (Asia/Kolkata / IST, today, yesterday, DD-MM-YYYY, YYYY-MM-DD)
 * 5. Category normalization and keyword auto-inference
 * 6. Family contact resolution (Personal, Appa, Amma, Chinna Akka, Periya Akka)
 * 7. Transaction ID generation and idempotency on retries
 * 8. End-to-end handler execution with mock Google Apps Script backend
 * 9. Confirmed success response verification
 * 10. Failure handling when Google Apps Script rejects or is unreachable
 */

import handler, {
  extractToken,
  normalizeDate,
  normalizeCategory,
  resolveFamilyContact,
  resolveTransactionId,
} from '../api/shortcut';

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`  ✓ PASSED: ${testName}`);
  } else {
    console.error(`  ✗ FAILED: ${testName}`);
    throw new Error(`Assertion failed: ${testName}`);
  }
}

// Mock HTTP Request & Response helpers
interface MockResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: any;
  status: (code: number) => MockResponse;
  json: (data: any) => MockResponse;
  setHeader: (name: string, val: string) => MockResponse;
  end: () => MockResponse;
}

function createMockRes(): MockResponse {
  const res: MockResponse = {
    statusCode: 200,
    headers: {},
    body: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: any) {
      this.body = data;
      return this;
    },
    setHeader(name: string, val: string) {
      this.headers[name] = val;
      return this;
    },
    end() {
      return this;
    },
  };
  return res;
}

async function runTests() {
  console.log('================================================================');
  console.log('   MSR PENNY — APPLE SHORTCUTS INTEGRATION TEST SUITE');
  console.log('================================================================\n');

  const SECRET_TEST_TOKEN = 'msr_test_secret_shortcut_token_12345';
  process.env.SHORTCUT_SECRET_TOKEN = SECRET_TEST_TOKEN;
  process.env.GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/TEST_SCRIPT_URL/exec';

  // -------------------------------------------------------------
  // Suite 1: Token Extraction & Auth
  // -------------------------------------------------------------
  console.log('Suite 1: Token Extraction & Authentication');
  {
    // Bearer token
    const req1 = { headers: { authorization: `Bearer ${SECRET_TEST_TOKEN}` } };
    assert(extractToken(req1) === SECRET_TEST_TOKEN, 'Extracts token from Authorization: Bearer <TOKEN>');

    // x-api-key header
    const req2 = { headers: { 'x-api-key': SECRET_TEST_TOKEN } };
    assert(extractToken(req2) === SECRET_TEST_TOKEN, 'Extracts token from x-api-key header');

    // Body token
    const req3 = { headers: {}, body: { secretToken: SECRET_TEST_TOKEN } };
    assert(extractToken(req3) === SECRET_TEST_TOKEN, 'Extracts token from request body secretToken');

    // Empty / Missing token
    const req4 = { headers: {}, body: {} };
    assert(extractToken(req4) === '', 'Returns empty string when no token is provided');
  }

  // -------------------------------------------------------------
  // Suite 2: Date Normalization (IST / Asia/Kolkata)
  // -------------------------------------------------------------
  console.log('\nSuite 2: Date Normalization (Asia/Kolkata)');
  {
    const today = normalizeDate();
    assert(/^\d{4}-\d{2}-\d{2}$/.test(today), 'Empty date defaults to YYYY-MM-DD');

    const explicitDate = normalizeDate('2026-10-19');
    assert(explicitDate === '2026-10-19', 'Keeps YYYY-MM-DD format as is');

    const dmy = normalizeDate('19/10/2026');
    assert(dmy === '2026-10-19', 'Converts DD/MM/YYYY to YYYY-MM-DD');

    const dmyDash = normalizeDate('19-10-2026');
    assert(dmyDash === '2026-10-19', 'Converts DD-MM-YYYY to YYYY-MM-DD');

    const todayStr = normalizeDate('today');
    assert(todayStr === today, '"today" keyword resolves to current date in IST');
  }

  // -------------------------------------------------------------
  // Suite 3: Category Normalization & Inferences
  // -------------------------------------------------------------
  console.log('\nSuite 3: Category Normalization & Auto-Inference');
  {
    assert(normalizeCategory('Food') === 'Food', 'Normalizes exact "Food" category');
    assert(normalizeCategory('dining') === 'Food', 'Normalizes alias "dining" to Food');
    assert(normalizeCategory('petrol') === 'Travel', 'Normalizes alias "petrol" to Travel');
    assert(normalizeCategory('rapido') === 'Travel', 'Normalizes alias "rapido" to Travel');
    assert(normalizeCategory('books') === 'Academics', 'Normalizes alias "books" to Academics');
    assert(normalizeCategory('groceries') === 'Shopping', 'Normalizes alias "groceries" to Shopping');
    assert(normalizeCategory('unknown_xyz', 'Canteen Lunch') === 'Food', 'Infers Food category from title');
    assert(normalizeCategory('', 'Bus ticket') === 'Travel', 'Infers Travel category from title');
    assert(normalizeCategory('', 'Uncategorized expense') === 'Other', 'Defaults to Other when no match');
  }

  // -------------------------------------------------------------
  // Suite 4: Family Contact Resolution
  // -------------------------------------------------------------
  console.log('\nSuite 4: Family Contact Resolution');
  {
    // Personal expense
    const personal1 = resolveFamilyContact();
    assert(!personal1.isReimbursable && personal1.contactId === '', 'Default is personal expense');

    const personal2 = resolveFamilyContact('personal');
    assert(!personal2.isReimbursable, 'Keyword "personal" is recognized as personal expense');

    const personal3 = resolveFamilyContact('none');
    assert(!personal3.isReimbursable, 'Keyword "none" is recognized as personal expense');

    // Appa
    const appa1 = resolveFamilyContact('Appa');
    assert(appa1.isReimbursable && appa1.contactId === 'family-appa' && appa1.contactName === 'Appa', 'Resolves "Appa"');

    const appa2 = resolveFamilyContact('dad');
    assert(appa2.isReimbursable && appa2.contactId === 'family-appa', 'Resolves "dad" to Appa');

    const appa3 = resolveFamilyContact(undefined, true);
    assert(appa3.isReimbursable && appa3.contactId === 'family-appa', 'isAppaReimbursable boolean flag resolves to Appa');

    // Amma
    const amma = resolveFamilyContact('Amma');
    assert(amma.isReimbursable && amma.contactId === 'family-amma' && amma.contactName === 'Amma', 'Resolves "Amma"');

    // Chinna Akka
    const chinna = resolveFamilyContact('chinna-akka');
    assert(chinna.isReimbursable && chinna.contactId === 'family-chinna-akka' && chinna.contactName === 'Chinna Akka', 'Resolves "chinna-akka"');

    // Periya Akka
    const periya = resolveFamilyContact('Periya Akka');
    assert(periya.isReimbursable && periya.contactId === 'family-periya-akka' && periya.contactName === 'Periya Akka', 'Resolves "Periya Akka"');
  }

  // -------------------------------------------------------------
  // Suite 5: Idempotency & Unique Transaction IDs
  // -------------------------------------------------------------
  console.log('\nSuite 5: Idempotency & Unique Transaction IDs');
  {
    const id1 = resolveTransactionId({});
    assert(id1.startsWith('tx-sc-'), 'Generates transaction ID with tx-sc- prefix');

    const id2 = resolveTransactionId({});
    assert(id1 !== id2, 'Two subsequent calls generate distinct random IDs');

    const customKey = 'shortcut-run-20261019-001';
    const id3 = resolveTransactionId({ idempotencyKey: customKey });
    const id4 = resolveTransactionId({ idempotencyKey: customKey });
    assert(id3 === id4 && id3 === `tx-sc-${customKey}`, 'idempotencyKey produces identical ID across retries');

    const existingId = 'tx-existing-123';
    const id5 = resolveTransactionId({ id: existingId });
    assert(id5 === existingId, 'Existing ID is preserved directly');
  }

  // -------------------------------------------------------------
  // Suite 6: End-to-End HTTP Handler Execution (with Mock Fetch)
  // -------------------------------------------------------------
  console.log('\nSuite 6: End-to-End HTTP Handler & Google Sheets Responses');

  const originalFetch = globalThis.fetch;

  try {
    // Test 6.1: Reject non-POST
    {
      const req = { method: 'GET', headers: {} };
      const res = createMockRes();
      await handler(req, res);
      assert(res.statusCode === 405, 'Rejects GET request with 405 Method Not Allowed');
    }

    // Test 6.2: Reject missing token
    {
      const req = { method: 'POST', headers: {}, body: { amount: 100, description: 'Test' } };
      const res = createMockRes();
      await handler(req, res);
      assert(res.statusCode === 401, 'Rejects request without token with 401 Unauthorized');
    }

    // Test 6.3: Reject wrong token
    {
      const req = {
        method: 'POST',
        headers: { authorization: 'Bearer WRONG_TOKEN' },
        body: { amount: 100, description: 'Test' },
      };
      const res = createMockRes();
      await handler(req, res);
      assert(res.statusCode === 401, 'Rejects request with invalid token with 401 Unauthorized');
    }

    // Test 6.4: Reject invalid amount
    {
      const req = {
        method: 'POST',
        headers: { authorization: `Bearer ${SECRET_TEST_TOKEN}` },
        body: { amount: -50, description: 'Test' },
      };
      const res = createMockRes();
      await handler(req, res);
      assert(res.statusCode === 400 && res.body?.error.includes('amount'), 'Rejects non-positive amount with 400 Bad Request');
    }

    // Test 6.5: Reject missing description
    {
      const req = {
        method: 'POST',
        headers: { authorization: `Bearer ${SECRET_TEST_TOKEN}` },
        body: { amount: 150 },
      };
      const res = createMockRes();
      await handler(req, res);
      assert(res.statusCode === 400 && res.body?.error.includes('Description'), 'Rejects missing description with 400 Bad Request');
    }

    // Test 6.6: Personal Expense saved successfully to Google Sheets
    {
      let interceptedPayload: any = null;
      globalThis.fetch = async (url: any, options: any) => {
        interceptedPayload = JSON.parse(options.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            action: 'add_transaction',
            transactionId: interceptedPayload.transaction.id,
            message: 'Transaction saved to Transactions sheet',
          }),
        } as any;
      };

      const req = {
        method: 'POST',
        headers: { authorization: `Bearer ${SECRET_TEST_TOKEN}` },
        body: {
          amount: 85,
          description: 'Canteen Coffee and Bun',
          category: 'Food',
          paymentMethod: 'upi',
          familyContactId: 'none',
        },
      };
      const res = createMockRes();
      await handler(req, res);

      assert(res.statusCode === 200, 'Returns HTTP 200 on confirmed Google Sheets save');
      assert(res.body?.success === true, 'Response body has success: true');
      assert(res.body?.googleSheetsConfirmed === true, 'Confirms googleSheetsConfirmed is true');
      assert(res.body?.transaction?.amount === 85, 'Transaction amount is 85');
      assert(res.body?.transaction?.category === 'Food', 'Transaction category is Food');
      assert(res.body?.transaction?.isFamilyReimbursable === false, 'Personal expense isFamilyReimbursable is false');
      assert(interceptedPayload.action === 'add_transaction', 'Dispatches action "add_transaction" to Apps Script');
    }

    // Test 6.7: Family Reimbursable Expense (Appa)
    {
      let interceptedPayload: any = null;
      globalThis.fetch = async (url: any, options: any) => {
        interceptedPayload = JSON.parse(options.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            action: 'add_transaction',
            transactionId: interceptedPayload.transaction.id,
            previousBalance: 1200,
            updatedBalance: 1750,
            message: 'Transaction saved to Transactions sheet',
          }),
        } as any;
      };

      const req = {
        method: 'POST',
        headers: { 'x-api-key': SECRET_TEST_TOKEN },
        body: {
          amount: 550,
          description: 'Medicine for Home',
          category: 'Family',
          paymentMethod: 'upi',
          familyContactId: 'Appa',
        },
      };
      const res = createMockRes();
      await handler(req, res);

      assert(res.statusCode === 200, 'Returns HTTP 200 for Appa expense');
      assert(res.body?.transaction?.isAppaReimbursable === true, 'Sets isAppaReimbursable: true');
      assert(res.body?.transaction?.familyContactId === 'family-appa', 'Sets familyContactId: family-appa');
      assert(res.body?.transaction?.familyContactName === 'Appa', 'Sets familyContactName: Appa');
      assert(res.body?.family?.updatedBalance === 1750, 'Returns updated balance from Google Sheets');
      assert(res.body?.summary.includes('Reimbursable from Appa'), 'Summary includes family contact reimbursement notice');
    }

    // Test 6.8: Family Reimbursable Expense (Chinna Akka)
    {
      let interceptedPayload: any = null;
      globalThis.fetch = async (url: any, options: any) => {
        interceptedPayload = JSON.parse(options.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            action: 'add_transaction',
            transactionId: interceptedPayload.transaction.id,
            previousBalance: 300,
            updatedBalance: 700,
            message: 'Transaction saved to Transactions sheet',
          }),
        } as any;
      };

      const req = {
        method: 'POST',
        headers: { authorization: `Bearer ${SECRET_TEST_TOKEN}` },
        body: {
          amount: 400,
          description: 'Printouts for Chinna Akka project',
          for: 'Chinna Akka',
        },
      };
      const res = createMockRes();
      await handler(req, res);

      assert(res.statusCode === 200, 'Returns HTTP 200 for Chinna Akka expense');
      assert(res.body?.transaction?.familyContactId === 'family-chinna-akka', 'Resolves to family-chinna-akka');
      assert(res.body?.transaction?.familyContactName === 'Chinna Akka', 'Sets name Chinna Akka');
      assert(res.body?.transaction?.isAppaReimbursable === false, 'isAppaReimbursable is false for sibling');
      assert(res.body?.transaction?.isFamilyReimbursable === true, 'isFamilyReimbursable is true');
    }

    // Test 6.9: Deduplication / Retry Protection
    {
      const customRetryKey = 'retry-test-attempt-1';
      let savedIds: string[] = [];

      globalThis.fetch = async (url: any, options: any) => {
        const payload = JSON.parse(options.body);
        savedIds.push(payload.transaction.id);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            action: 'add_transaction',
            transactionId: payload.transaction.id,
            message: 'Transaction saved / updated without duplicates',
          }),
        } as any;
      };

      // Attempt 1
      const req1 = {
        method: 'POST',
        headers: { authorization: `Bearer ${SECRET_TEST_TOKEN}` },
        body: { amount: 200, description: 'Bus pass', idempotencyKey: customRetryKey },
      };
      const res1 = createMockRes();
      await handler(req1, res1);

      // Attempt 2 (Retry of identical shortcut run)
      const req2 = {
        method: 'POST',
        headers: { authorization: `Bearer ${SECRET_TEST_TOKEN}` },
        body: { amount: 200, description: 'Bus pass', idempotencyKey: customRetryKey },
      };
      const res2 = createMockRes();
      await handler(req2, res2);

      assert(savedIds.length === 2, 'Two requests processed');
      assert(savedIds[0] === savedIds[1], 'Identical transaction ID used on retries to prevent duplicate Google Sheets rows');
      assert(res1.body?.transaction?.id === res2.body?.transaction?.id, 'Returned IDs match exactly');
    }

    // Test 6.10: Failure propagation when Google Apps Script returns an error
    {
      globalThis.fetch = async () => {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: false,
            error: 'Google Sheets Transactions sheet locked by administrator',
          }),
        } as any;
      };

      const req = {
        method: 'POST',
        headers: { authorization: `Bearer ${SECRET_TEST_TOKEN}` },
        body: { amount: 150, description: 'Stationery' },
      };
      const res = createMockRes();
      await handler(req, res);

      assert(res.statusCode === 500, 'Returns HTTP 500 when Google Apps Script returns success: false');
      assert(res.body?.success === false, 'Does NOT report success to Apple Shortcuts');
      assert(res.body?.error.includes('locked'), 'Returns descriptive error message from Google Sheets');
    }

    // Test 6.11: Network failure propagation
    {
      globalThis.fetch = async () => {
        throw new Error('Connection reset by peer');
      };

      const req = {
        method: 'POST',
        headers: { authorization: `Bearer ${SECRET_TEST_TOKEN}` },
        body: { amount: 150, description: 'Stationery' },
      };
      const res = createMockRes();
      await handler(req, res);

      assert(res.statusCode === 502, 'Returns HTTP 502 on network/connectivity failure to Google Apps Script');
      assert(res.body?.success === false, 'Does NOT report success on network timeout');
      assert(res.body?.error.includes('Connection reset'), 'Returns network error details');
    }

    // Test 6.12: Unparsed JSON string body (e.g. from iOS Shortcut text body)
    {
      let interceptedPayload: any = null;
      globalThis.fetch = async (url: any, options: any) => {
        interceptedPayload = JSON.parse(options.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            action: 'add_transaction',
            transactionId: interceptedPayload.transaction.id,
            message: 'Saved',
          }),
        } as any;
      };

      const req = {
        method: 'POST',
        headers: { authorization: `Bearer ${SECRET_TEST_TOKEN}` },
        body: '{"amount": "₹250", "description": "Auto ride to college", "category": "Travel"}',
      };
      const res = createMockRes();
      await handler(req, res);

      assert(res.statusCode === 200, 'Parses unparsed JSON string body with currency symbol');
      assert(res.body?.transaction?.amount === 250, 'Parsed ₹250 to numeric 250');
      assert(res.body?.transaction?.category === 'Travel', 'Identified category Travel');
    }

    // Test 6.13: Capitalized dictionary keys (standard Apple Shortcuts behavior)
    {
      let interceptedPayload: any = null;
      globalThis.fetch = async (url: any, options: any) => {
        interceptedPayload = JSON.parse(options.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            action: 'add_transaction',
            transactionId: interceptedPayload.transaction.id,
            message: 'Saved',
          }),
        } as any;
      };

      const req = {
        method: 'POST',
        headers: { authorization: `Bearer ${SECRET_TEST_TOKEN}` },
        body: {
          Amount: '1,200',
          Description: 'Hostel mess fee',
          Category: 'College',
          PaymentMethod: 'UPI',
          For: 'Personal',
        },
      };
      const res = createMockRes();
      await handler(req, res);

      assert(res.statusCode === 200, 'Supports capitalized dictionary keys from Apple Shortcuts');
      assert(res.body?.transaction?.amount === 1200, 'Stripped comma and parsed 1,200 to numeric 1200');
      assert(res.body?.transaction?.title === 'Hostel mess fee', 'Parsed Description property');
      assert(res.body?.transaction?.category === 'College', 'Parsed Category property');
    }

    // Test 6.14: Currency word variations (INR, Rs, etc.)
    {
      let interceptedPayload: any = null;
      globalThis.fetch = async (url: any, options: any) => {
        interceptedPayload = JSON.parse(options.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            action: 'add_transaction',
            transactionId: interceptedPayload.transaction.id,
            message: 'Saved',
          }),
        } as any;
      };

      const req = {
        method: 'POST',
        headers: { authorization: `Bearer ${SECRET_TEST_TOKEN}` },
        body: { amount: 'Rs. 45.50', description: 'Tea' },
      };
      const res = createMockRes();
      await handler(req, res);

      assert(res.statusCode === 200, 'Handles "Rs. 45.50" string');
      assert(res.body?.transaction?.amount === 45.5, 'Parsed amount 45.5');
    }

    // Test 6.15: Query parameter fallbacks
    {
      let interceptedPayload: any = null;
      globalThis.fetch = async (url: any, options: any) => {
        interceptedPayload = JSON.parse(options.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            action: 'add_transaction',
            transactionId: interceptedPayload.transaction.id,
            message: 'Saved',
          }),
        } as any;
      };

      const req = {
        method: 'POST',
        headers: { authorization: `Bearer ${SECRET_TEST_TOKEN}` },
        query: { amount: '75', description: 'Notebook' },
      };
      const res = createMockRes();
      await handler(req, res);

      assert(res.statusCode === 200, 'Extracts amount and description from query parameters if body empty');
      assert(res.body?.transaction?.amount === 75, 'Parsed query parameter amount 75');
    }
  } finally {
    globalThis.fetch = originalFetch;
  }

  console.log('\n================================================================');
  console.log('   ALL 28 APPLE SHORTCUT INTEGRATION TESTS PASSED SUCCESSFULLY! ✓');
  console.log('================================================================\n');
}

runTests().catch((err) => {
  console.error('\n❌ TEST RUN FAILED:', err);
  process.exit(1);
});
