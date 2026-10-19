// Vercel Serverless Function: GET /api/state
export default async function handler(req: any, res: any) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const scriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL || process.env.VITE_GOOGLE_APPS_SCRIPT_URL || '';

  // If Google Apps Script is configured in environment, fetch authoritative live database
  if (scriptUrl) {
    try {
      const fetchUrl = `${scriptUrl}${scriptUrl.includes('?') ? '&' : '?'}action=get_all_data`;
      const remoteRes = await fetch(fetchUrl, { method: 'GET' });
      if (remoteRes.ok) {
        const json = await remoteRes.json();
        if (json.success) {
          return res.status(200).json({
            success: true,
            source: 'google_sheets',
            data: {
              transactions: json.transactions || [],
              familyContacts: json.familyContacts || [],
              settings: {
                googleAppsScriptUrl: scriptUrl,
                lastSyncedAt: json.timestamp || new Date().toISOString(),
                syncEnabled: true,
              },
            },
          });
        }
      }
    } catch (e: any) {
      console.warn('Vercel state handler remote fetch error:', e.message);
    }
  }

  // Fallback response allowing client to initialize
  return res.status(200).json({
    success: true,
    source: 'local_fallback',
    data: null,
  });
}
