// Vercel Serverless Function: /api/transfers
export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const scriptUrl =
    req.body?.googleAppsScriptUrl ||
    req.query?.scriptUrl ||
    process.env.GOOGLE_APPS_SCRIPT_URL ||
    process.env.VITE_GOOGLE_APPS_SCRIPT_URL ||
    '';

  // GET: Fetch transfers
  if (req.method === 'GET') {
    if (scriptUrl) {
      try {
        const fetchUrl = `${scriptUrl}${scriptUrl.includes('?') ? '&' : '?'}action=get_transfers`;
        const remoteRes = await fetch(fetchUrl, { method: 'GET' });
        if (remoteRes.ok) {
          const json: any = await remoteRes.json();
          if (json.success && Array.isArray(json.transfers)) {
            return res.status(200).json({ success: true, transfers: json.transfers });
          }
        }
      } catch (e: any) {
        console.warn('Remote transfers fetch error:', e.message);
      }
    }
    return res.status(200).json({ success: true, transfers: [] });
  }

  // DELETE: Delete a transfer
  if (req.method === 'DELETE' || (req.method === 'POST' && req.body?.action === 'delete_transfer')) {
    const id = req.query?.id || req.body?.id || req.body?.transferId;
    if (!id) {
      return res.status(400).json({ success: false, error: 'Transfer ID is required for deletion.' });
    }

    if (scriptUrl) {
      try {
        const remoteRes = await fetch(scriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'delete_transfer',
            transferId: id,
          }),
        });

        if (!remoteRes.ok) {
          return res.status(502).json({
            success: false,
            error: `Google Apps Script returned status ${remoteRes.status}`,
          });
        }

        const json: any = await remoteRes.json();
        return res.status(json.success ? 200 : (json.notFound ? 404 : 500)).json(json);
      } catch (err: any) {
        return res.status(502).json({
          success: false,
          error: `Failed to reach Google Apps Script: ${err.message}`,
        });
      }
    }

    return res.status(200).json({ success: true, transferId: id, message: 'Transfer removed.' });
  }

  // POST: Add single transfer
  if (req.method === 'POST') {
    const tr = req.body;
    if (!tr || !tr.amount || Number(tr.amount) <= 0 || !tr.fromAccountId || !tr.toAccountId) {
      return res.status(400).json({
        success: false,
        error: 'Invalid transfer: positive amount and from/to accounts are required.',
      });
    }

    if (!tr.id) {
      tr.id = 'tr-' + Date.now();
    }
    if (!tr.createdAt) {
      tr.createdAt = new Date().toISOString();
    }

    if (scriptUrl) {
      try {
        const remoteRes = await fetch(scriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'add_transfer',
            transfer: tr,
          }),
        });

        if (!remoteRes.ok) {
          return res.status(502).json({
            success: false,
            error: `Google Apps Script returned status ${remoteRes.status}`,
          });
        }

        const json: any = await remoteRes.json();
        return res.status(json.success ? 200 : 500).json({
          success: json.success,
          transfer: tr,
          remoteResponse: json,
        });
      } catch (err: any) {
        return res.status(502).json({
          success: false,
          error: `Failed to reach Google Apps Script: ${err.message}`,
        });
      }
    }

    return res.status(200).json({
      success: true,
      transfer: tr,
      message: 'Transfer saved locally (Google Sheets not configured).',
    });
  }

  return res.status(405).json({ success: false, error: 'Method not allowed' });
}

