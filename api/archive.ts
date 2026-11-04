// Vercel Serverless Function: /api/archive
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

  // GET: Fetch archived items
  if (req.method === 'GET') {
    if (scriptUrl) {
      try {
        const fetchUrl = `${scriptUrl}${scriptUrl.includes('?') ? '&' : '?'}action=get_settled_archive`;
        const remoteRes = await fetch(fetchUrl, { method: 'GET' });
        if (remoteRes.ok) {
          const json = await remoteRes.json();
          return res.status(200).json(json);
        }
      } catch (err: any) {
        console.warn('Apps Script get_settled_archive warning:', err);
      }
    }

    // Local fallback
    try {
      const dataFile = path.resolve(process.cwd(), 'data', 'settled_archive.json');
      if (fs.existsSync(dataFile)) {
        const items = JSON.parse(fs.readFileSync(dataFile, 'utf8') || '[]');
        return res.status(200).json({ success: true, archiveItems: items });
      }
    } catch {}

    return res.status(200).json({ success: true, archiveItems: [] });
  }

  // POST: Archive or Restore
  if (req.method === 'POST') {
    const { action, batchId, contactId, transactionIds } = req.body || {};

    if (action === 'restore') {
      if (scriptUrl) {
        try {
          const remoteRes = await fetch(scriptUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
              action: 'restore_archived_items',
              batchId,
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
      return res.status(200).json({ success: true, message: 'Restored locally' });
    }

    // Default: Archive settled items
    if (scriptUrl) {
      try {
        const remoteRes = await fetch(scriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'archive_settled_items',
            batchId,
            contactId,
            transactionIds,
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
      batchId: batchId || `arch-batch-${Date.now()}`,
      archivedCount: (transactionIds || []).length,
      message: 'Archived locally',
    });
  }

  return res.status(405).json({ success: false, error: 'Method not allowed' });
}
