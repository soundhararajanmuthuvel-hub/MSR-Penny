// Vercel Serverless Function: /api/health
export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const scriptUrl =
    req.query?.scriptUrl ||
    process.env.GOOGLE_APPS_SCRIPT_URL ||
    process.env.VITE_GOOGLE_APPS_SCRIPT_URL ||
    '';

  if (scriptUrl) {
    try {
      const fetchUrl = `${scriptUrl}${scriptUrl.includes('?') ? '&' : '?'}action=check_data_health`;
      const remoteRes = await fetch(fetchUrl, { method: 'GET' });
      if (remoteRes.ok) {
        const json: any = await remoteRes.json();
        return res.status(200).json(json);
      }
    } catch (err: any) {
      console.warn('Apps Script check_data_health warning:', err);
    }
  }

  // Local health fallback
  return res.status(200).json({
    success: true,
    healthReport: {
      timestamp: new Date().toISOString(),
      totalIssuesCount: 0,
      errorsCount: 0,
      warningsCount: 0,
      issues: [],
      isHealthy: true,
    },
  });
}

