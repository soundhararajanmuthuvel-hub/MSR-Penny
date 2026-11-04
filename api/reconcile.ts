// Vercel Serverless Function: /api/reconcile
import fs from 'fs';
import path from 'path';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const scriptUrl =
    req.body?.googleAppsScriptUrl ||
    req.query?.scriptUrl ||
    process.env.GOOGLE_APPS_SCRIPT_URL ||
    process.env.VITE_GOOGLE_APPS_SCRIPT_URL ||
    '';

  // GET: Fetch reconciliations
  if (req.method === 'GET') {
    if (scriptUrl) {
      try {
        const fetchUrl = `${scriptUrl}${scriptUrl.includes('?') ? '&' : '?'}action=get_reconciliations`;
        const remoteRes = await fetch(fetchUrl, { method: 'GET' });
        if (remoteRes.ok) {
          const json = await remoteRes.json();
          return res.status(200).json(json);
        }
      } catch (err: any) {
        console.warn('Apps Script get_reconciliations warning:', err);
      }
    }

    return res.status(200).json({ success: true, reconciliations: [] });
  }

  // POST: Record reconciliation adjustment
  if (req.method === 'POST') {
    const { reconciliation } = req.body || {};

    if (!reconciliation || !reconciliation.accountId) {
      return res.status(400).json({ success: false, error: 'Invalid reconciliation payload' });
    }

    if (scriptUrl) {
      try {
        const remoteRes = await fetch(scriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'save_reconciliation',
            reconciliation,
          }),
        });
        if (remoteRes.ok) {
          const json = await remoteRes.json();
          return res.status(200).json(json);
        }
      } catch (err: any) {
        return res.status(502).json({ success: false, error: err.message });
      }
    }

    return res.status(200).json({
      success: true,
      reconciliationId: reconciliation.id || `rec-${Date.now()}`,
      message: 'Reconciliation recorded locally',
    });
  }

  return res.status(405).json({ success: false, error: 'Method not allowed' });
}
