// Vercel Serverless Function: /api/transactions
export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // DELETE transaction (supports DELETE method or POST action=delete_transaction)
  if (req.method === 'DELETE' || (req.method === 'POST' && req.body?.action === 'delete_transaction')) {
    const id = req.query?.id || req.body?.id || req.body?.transactionId;
    if (!id) {
      return res.status(400).json({ success: false, error: 'Transaction ID is required for deletion.' });
    }

    const scriptUrl =
      req.body?.googleAppsScriptUrl ||
      req.query?.scriptUrl ||
      process.env.GOOGLE_APPS_SCRIPT_URL ||
      process.env.VITE_GOOGLE_APPS_SCRIPT_URL ||
      '';

    if (scriptUrl) {
      try {
        const remoteRes = await fetch(scriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'delete_transaction',
            transactionId: id,
          }),
        });

        if (!remoteRes.ok) {
          return res.status(502).json({
            success: false,
            error: `Google Apps Script returned HTTP status ${remoteRes.status}`,
            transactionId: id,
          });
        }

        const json = await remoteRes.json();
        return res.status(json.success ? 200 : (json.notFound ? 404 : 500)).json(json);
      } catch (err: any) {
        return res.status(502).json({
          success: false,
          error: `Failed to reach Google Apps Script: ${err.message}`,
          transactionId: id,
        });
      }
    }

    return res.status(200).json({
      success: true,
      transactionId: id,
      message: `Transaction ${id} removed from local state (Google Sheets not configured).`,
    });
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
