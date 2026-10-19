import { DEFAULT_FAMILY_CONTACTS } from '../src/utils/familyMigration';

// Vercel Serverless Function: POST /api/clear-data
export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const scriptUrl =
    req.body?.googleAppsScriptUrl ||
    process.env.GOOGLE_APPS_SCRIPT_URL ||
    process.env.VITE_GOOGLE_APPS_SCRIPT_URL;

  if (scriptUrl && req.body?.wipeRemoteSheet) {
    try {
      await fetch(scriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'clear_data',
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (e: any) {
      console.warn('Clear remote sheet notice:', e.message);
    }
  }

  return res.status(200).json({
    success: true,
    data: {
      transactions: [],
      familyContacts: DEFAULT_FAMILY_CONTACTS,
      freelanceJobs: [],
      savings: {
        emergencyFund: { current: 0, target: 3000, title: 'Emergency Fund', subtitle: 'Target: 1 Month Living Buffer' },
        goals: [],
      },
    },
  });
}
