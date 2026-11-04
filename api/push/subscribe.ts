// Vercel Serverless Function: /api/push/subscribe
import fs from 'fs';
import path from 'path';

interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { subscription, userAgent } = req.body || {};

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return res.status(400).json({ success: false, error: 'Invalid push subscription payload' });
    }

    const subData: PushSubscriptionData = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
    };

    // 1. Save to local fallback storage (for dev / node server)
    try {
      const dataDir = path.resolve(process.cwd(), 'data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      const subFile = path.join(dataDir, 'push_subscriptions.json');
      let currentSubs: any[] = [];
      if (fs.existsSync(subFile)) {
        currentSubs = JSON.parse(fs.readFileSync(subFile, 'utf8') || '[]');
      }
      const existingIdx = currentSubs.findIndex((s: any) => s.endpoint === subData.endpoint);
      const entry = {
        ...subData,
        userAgent: userAgent || 'Unknown',
        updatedAt: new Date().toISOString(),
      };
      if (existingIdx >= 0) {
        currentSubs[existingIdx] = entry;
      } else {
        currentSubs.push({ ...entry, createdAt: new Date().toISOString() });
      }
      fs.writeFileSync(subFile, JSON.stringify(currentSubs, null, 2), 'utf8');
    } catch (fsErr) {
      // In serverless / read-only environment, ignore local filesystem errors
    }

    // 2. Forward to Google Apps Script Push_Subscriptions tab if configured
    const scriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL || process.env.VITE_GOOGLE_APPS_SCRIPT_URL;
    if (scriptUrl && scriptUrl.trim().length > 10) {
      try {
        await fetch(scriptUrl.trim(), {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'save_push_subscription',
            subscription: subData,
            userAgent: userAgent || 'PWA',
          }),
        });
      } catch (scriptErr) {
        console.warn('Could not forward push subscription to Apps Script:', scriptErr);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Push subscription stored successfully',
    });
  } catch (error: any) {
    console.error('Push subscribe error:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error saving subscription',
    });
  }
}
