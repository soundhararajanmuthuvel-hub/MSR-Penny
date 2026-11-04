// Vercel Serverless Function: /api/accounts
import { DEFAULT_ACCOUNTS } from '../../src/utils/balanceCalculator';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
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

  // GET: Fetch accounts
  if (req.method === 'GET') {
    if (scriptUrl) {
      try {
        const fetchUrl = `${scriptUrl}${scriptUrl.includes('?') ? '&' : '?'}action=get_accounts`;
        const remoteRes = await fetch(fetchUrl, { method: 'GET' });
        if (remoteRes.ok) {
          const json: any = await remoteRes.json();
          if (json.success && Array.isArray(json.accounts)) {
            return res.status(200).json({ success: true, accounts: json.accounts });
          }
        }
      } catch (e: any) {
        console.warn('Remote accounts fetch error:', e.message);
      }
    }
    return res.status(200).json({ success: true, accounts: DEFAULT_ACCOUNTS });
  }

  // POST: Save/update accounts
  if (req.method === 'POST') {
    const accounts = req.body?.accounts || req.body;
    if (!Array.isArray(accounts) || accounts.length === 0) {
      return res.status(400).json({ success: false, error: 'Accounts array is required.' });
    }

    if (scriptUrl) {
      try {
        const remoteRes = await fetch(scriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'save_accounts',
            accounts,
          }),
        });

        if (!remoteRes.ok) {
          return res.status(502).json({
            success: false,
            error: `Google Apps Script returned status ${remoteRes.status}`,
          });
        }

        const json: any = await remoteRes.json();
        return res.status(json.success ? 200 : 500).json(json);
      } catch (err: any) {
        return res.status(502).json({
          success: false,
          error: `Failed to reach Google Apps Script: ${err.message}`,
        });
      }
    }

    return res.status(200).json({
      success: true,
      accounts,
      message: 'Accounts saved locally (Google Sheets not configured).',
    });
  }

  return res.status(405).json({ success: false, error: 'Method not allowed' });
}

