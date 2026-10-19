// Vercel Serverless Function: POST /api/sync/push
export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const scriptUrl =
    req.body.url ||
    req.body.googleAppsScriptUrl ||
    process.env.GOOGLE_APPS_SCRIPT_URL ||
    process.env.VITE_GOOGLE_APPS_SCRIPT_URL;

  if (!scriptUrl) {
    return res.status(400).json({
      success: false,
      error: 'No Google Apps Script Webhook URL provided.',
    });
  }

  try {
    const payload = {
      action: 'sync_all',
      timestamp: new Date().toISOString(),
      transactions: req.body.transactions || [],
      familyContacts: req.body.familyContacts || [],
      freelanceJobs: req.body.freelanceJobs || [],
      savings: req.body.savings || {},
      settings: req.body.settings || {},
    };

    const remoteRes = await fetch(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });

    const respText = await remoteRes.text();
    let respJson: any = null;
    try {
      respJson = JSON.parse(respText);
    } catch {
      respJson = { raw: respText };
    }

    if (!remoteRes.ok || respJson?.success === false) {
      return res.status(502).json({
        success: false,
        error: respJson?.error || `Remote server returned HTTP ${remoteRes.status}`,
        remoteResponse: respJson,
      });
    }

    return res.status(200).json({
      success: true,
      syncedAt: new Date().toISOString(),
      remoteResponse: respJson,
    });
  } catch (err: any) {
    return res.status(502).json({
      success: false,
      error: err.message || 'Failed to reach Apps Script URL.',
    });
  }
}
