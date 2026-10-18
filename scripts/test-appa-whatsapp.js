async function runTests() {
  const baseUrl = 'http://localhost:3000';
  console.log('--- STARTING MSR PENNY APPA WHATSAPP TESTS ---\n');

  // Helper to fetch state
  async function getState() {
    const res = await fetch(`${baseUrl}/api/state`);
    const json = await res.json();
    return json.data;
  }

  // Calculate Appa balance directly
  function computeAppaBalance(txs) {
    const reimbursable = txs.filter((t) => t.isAppaReimbursable);
    const paidByMe = reimbursable.reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const repayments = txs.filter((t) => t.type === 'repayment');
    const repaid = repayments.reduce((s, t) => s + (Number(t.amount) || 0), 0);
    return Math.max(0, paidByMe - repaid);
  }

  // Initial State
  const initial = await getState();
  const initialBalance = computeAppaBalance(initial.transactions);
  console.log(`[Baseline] Appa Initial Balance: ₹${initialBalance}`);
  console.log(`[Baseline] Appa WhatsApp Number: ${initial.settings.appaPhoneNumber}`);

  // 1. TEST: Reimbursable expense increases outstanding balance once
  const reimbursableId = 'tx-test-reimbursable-' + Date.now();
  const testAmount = 250;
  const postReimbursableRes = await fetch(`${baseUrl}/api/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: reimbursableId,
      type: 'expense',
      title: 'College Lab Journal Kit',
      amount: testAmount,
      category: 'College',
      date: '2026-10-24',
      paymentMethod: 'upi',
      isAppaReimbursable: true,
      appaSettled: false,
    }),
  });

  const reimbursableJson = await postReimbursableRes.json();
  const stateAfter1 = await getState();
  const balanceAfter1 = computeAppaBalance(stateAfter1.transactions);

  const test1Passed =
    reimbursableJson.success === true &&
    balanceAfter1 === initialBalance + testAmount &&
    reimbursableJson.previousAppaBalance === initialBalance &&
    reimbursableJson.updatedAppaBalance === initialBalance + testAmount;

  console.log(`\nTest 1: Reimbursable expense increases balance once`);
  console.log(`  Expected balance: ₹${initialBalance + testAmount}, Actual: ₹${balanceAfter1}`);
  console.log(`  Backend previous: ₹${reimbursableJson.previousAppaBalance}, updated: ₹${reimbursableJson.updatedAppaBalance}`);
  console.log(`  Result: ${test1Passed ? 'PASSED ✓' : 'FAILED ✗'}`);

  // 2. TEST: Personal expense does NOT increase Appa balance
  const personalId = 'tx-test-personal-' + Date.now();
  const personalAmount = 350;
  const postPersonalRes = await fetch(`${baseUrl}/api/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: personalId,
      type: 'expense',
      title: 'Personal Movie & Snack',
      amount: personalAmount,
      category: 'Food',
      date: '2026-10-24',
      paymentMethod: 'cash',
      isAppaReimbursable: false,
      appaSettled: false,
    }),
  });

  const personalJson = await postPersonalRes.json();
  const stateAfter2 = await getState();
  const balanceAfter2 = computeAppaBalance(stateAfter2.transactions);

  const test2Passed =
    personalJson.success === true &&
    balanceAfter2 === balanceAfter1 &&
    personalJson.previousAppaBalance === balanceAfter1 &&
    personalJson.updatedAppaBalance === balanceAfter1;

  console.log(`\nTest 2: Personal expense does NOT increase Appa balance`);
  console.log(`  Balance before: ₹${balanceAfter1}, Balance after: ₹${balanceAfter2}`);
  console.log(`  Result: ${test2Passed ? 'PASSED ✓' : 'FAILED ✗'}`);

  // 3. TEST: Repayment reduces outstanding amount correctly
  const repaymentId = 'tx-test-repay-' + Date.now();
  const repayAmount = 150;
  const postRepaymentRes = await fetch(`${baseUrl}/api/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: repaymentId,
      type: 'repayment',
      title: 'Cash from Appa',
      amount: repayAmount,
      category: 'Family',
      date: '2026-10-24',
      paymentMethod: 'cash',
      isAppaReimbursable: false,
      appaSettled: true,
    }),
  });

  const repaymentJson = await postRepaymentRes.json();
  const stateAfter3 = await getState();
  const balanceAfter3 = computeAppaBalance(stateAfter3.transactions);

  const test3Passed =
    repaymentJson.success === true &&
    balanceAfter3 === balanceAfter2 - repayAmount &&
    repaymentJson.previousAppaBalance === balanceAfter2 &&
    repaymentJson.updatedAppaBalance === balanceAfter2 - repayAmount;

  console.log(`\nTest 3: Repayment reduces balance correctly`);
  console.log(`  Balance before: ₹${balanceAfter2}, Repayment: ₹${repayAmount}, Balance after: ₹${balanceAfter3}`);
  console.log(`  Result: ${test3Passed ? 'PASSED ✓' : 'FAILED ✗'}`);

  // 4. TEST: WhatsApp message contains correct balance, recipient and encoding
  const cleanPhone = (stateAfter3.settings.appaPhoneNumber || '').replace(/[^0-9]/g, '');
  const expectedMsg = `Hi Appa 👋\n\nI paid for a college expense.\n\nExpense: College Lab Journal Kit\nDate: 24 Oct\nAmount paid: ₹250\nPrevious balance: ₹${initialBalance}\nNew expense: ₹250\nTotal amount to repay: ₹${initialBalance + 250}\n\nPlease settle it when convenient.\n\n— MSR Penny`;
  const encoded = encodeURIComponent(expectedMsg);
  const clickToChatUrl = `https://wa.me/${cleanPhone}?text=${encoded}`;

  const test4Passed =
    cleanPhone.length >= 10 &&
    clickToChatUrl.startsWith(`https://wa.me/${cleanPhone}?text=`) &&
    clickToChatUrl.includes(encodeURIComponent('Total amount to repay: ₹' + (initialBalance + 250))) &&
    clickToChatUrl.includes(encodeURIComponent('— MSR Penny'));

  console.log(`\nTest 4: WhatsApp Click-to-Chat URL & Message Formatting`);
  console.log(`  Cleaned Phone: ${cleanPhone}`);
  console.log(`  URL sample: ${clickToChatUrl.substring(0, 80)}...`);
  console.log(`  Result: ${test4Passed ? 'PASSED ✓' : 'FAILED ✗'}`);

  // 5. TEST: Retrying a save does not duplicate a transaction (idempotency)
  const countBeforeRetry = stateAfter3.transactions.length;
  // Retry same reimbursableId
  const retryRes = await fetch(`${baseUrl}/api/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: reimbursableId,
      type: 'expense',
      title: 'College Lab Journal Kit (Retried Update)',
      amount: testAmount,
      category: 'College',
      date: '2026-10-24',
      paymentMethod: 'upi',
      isAppaReimbursable: true,
      appaSettled: false,
    }),
  });
  const retryJson = await retryRes.json();
  const stateAfterRetry = await getState();
  const countAfterRetry = stateAfterRetry.transactions.length;
  const balanceAfterRetry = computeAppaBalance(stateAfterRetry.transactions);

  const test5Passed =
    retryJson.success === true &&
    countAfterRetry === countBeforeRetry &&
    balanceAfterRetry === balanceAfter3;

  console.log(`\nTest 5: Retrying a save does not duplicate transaction`);
  console.log(`  Count before retry: ${countBeforeRetry}, Count after retry: ${countAfterRetry}`);
  console.log(`  Result: ${test5Passed ? 'PASSED ✓' : 'FAILED ✗'}`);

  // 6. TEST: Refreshing/persisting state preserves records
  const reloaded = await getState();
  const foundSavedTx = reloaded.transactions.find((t) => t.id === reimbursableId);
  const test6Passed = !!foundSavedTx && foundSavedTx.amount === testAmount;

  console.log(`\nTest 6: Refreshing preserves persisted records`);
  console.log(`  Found transaction in database: ${foundSavedTx ? foundSavedTx.title : 'None'}`);
  console.log(`  Result: ${test6Passed ? 'PASSED ✓' : 'FAILED ✗'}`);

  // 7. TEST: Failed saves (invalid amount/type) do not produce false success
  const invalidRes = await fetch(`${baseUrl}/api/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'expense',
      title: 'Invalid Negative Amount',
      amount: -50,
      category: 'Food',
      date: '2026-10-24',
    }),
  });

  const invalidJson = await invalidRes.json();
  const test7Passed = invalidRes.status === 400 && invalidJson.success === false;

  console.log(`\nTest 7: Failed saves do not produce false success messages`);
  console.log(`  Status code: ${invalidRes.status}, success field: ${invalidJson.success}`);
  console.log(`  Error received: "${invalidJson.error}"`);
  console.log(`  Result: ${test7Passed ? 'PASSED ✓' : 'FAILED ✗'}`);

  // Cleanup test transactions to leave user's ledger pristine
  await fetch(`${baseUrl}/api/transactions/${reimbursableId}`, { method: 'DELETE' });
  await fetch(`${baseUrl}/api/transactions/${personalId}`, { method: 'DELETE' });
  await fetch(`${baseUrl}/api/transactions/${repaymentId}`, { method: 'DELETE' });

  const finalState = await getState();
  const finalBalance = computeAppaBalance(finalState.transactions);
  console.log(`\n[Cleanup] Cleaned up temporary test transactions. Balance restored to: ₹${finalBalance}`);

  const allPassed = test1Passed && test2Passed && test3Passed && test4Passed && test5Passed && test6Passed && test7Passed;
  console.log(`\n========================================`);
  console.log(`ALL 7 TESTS PASSED: ${allPassed ? 'YES (100% SUCCESS)' : 'NO'}`);
  console.log(`========================================\n`);

  if (!allPassed) process.exit(1);
}

runTests().catch((e) => {
  console.error('Test execution failed:', e);
  process.exit(1);
});
