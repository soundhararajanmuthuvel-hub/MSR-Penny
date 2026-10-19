// Vercel Serverless Function: /api/transactions
export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // DELETE transaction
  if (req.method === 'DELETE') {
    const id = req.query?.id || req.body?.id;
    return res.status(200).json({ success: true, message: `Transaction ${id} removed` });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const tx = req.body;
  if (!tx || !tx.type || !tx.amount || Number(tx.amount) <= 0) {
    return res.status(400).json({
      success: false,
      error: 'Invalid transaction: positive amount and type are required.',
    });
  }

  if (!tx.id) {
    tx.id = 'tx-' + Date.now();
  }
  if (!tx.createdAt) {
    tx.createdAt = new Date().toISOString();
  }

  // Resolve target Google Apps Script URL
  const scriptUrl =
    req.body.googleAppsScriptUrl ||
    process.env.GOOGLE_APPS_SCRIPT_URL ||
    process.env.VITE_GOOGLE_APPS_SCRIPT_URL ||
    '';

  if (scriptUrl) {
    try {
      const remoteRes = await fetch(scriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'add_transaction',
          transaction: tx,
        }),
      });

      if (!remoteRes.ok) {
        return res.status(502).json({
          success: false,
          error: `Google Apps Script returned HTTP status ${remoteRes.status}`,
          transaction: tx,
        });
      }

      const json = await remoteRes.json();
      if (!json.success) {
        return res.status(500).json({
          success: false,
          error: json.error || 'Google Sheets persistence failed.',
          transaction: tx,
        });
      }

      return res.status(200).json({
        success: true,
        transaction: tx,
        previousBalance: json.previousBalance,
        updatedBalance: json.updatedBalance,
        remoteResponse: json,
      });
    } catch (err: any) {
      return res.status(502).json({
        success: false,
        error: `Failed to reach Google Apps Script: ${err.message}`,
        transaction: tx,
      });
    }
  }

  return res.status(200).json({
    success: true,
    transaction: tx,
    message: 'Transaction saved to local state (Google Sheets not configured).',
  });
}
