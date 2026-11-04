// Vercel Serverless Function: /api/push (Consolidates subscribe & test)
import webpush from 'web-push';
import fs from 'fs';
import path from 'path';

interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

const DEFAULT_PUBLIC_KEY =
  process.env.VITE_VAPID_PUBLIC_KEY ||
  'BFumy3go8AuIfBnrtYBbst5Fksz3VkUbfJe23Q6Ydl6okux_S5BdX9hA9Jq679Evygnc_uh6fpYxb9Fs_cIa6t0';

const DEFAULT_PRIVATE_KEY =
  process.env.VAPID_PRIVATE_KEY ||
  'RZHZodVOHoZSQ9sag5F6zbzmwxFe6aYVbFXx7t5mdsM';

const VAPID_SUBJECT =
  process.env.VAPID_SUBJECT || 'mailto:soundhararajanmuthuvel@gmail.com';

// Sub-handler: Subscribe
export async function subscribeHandler(req: any, res: any) {
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

    // 1. Save to local fallback storage
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
      const existingIdx = currentSubs.findIndex((s) => s.endpoint === subData.endpoint);
      if (existingIdx >= 0) {
        currentSubs[existingIdx] = { ...subData, updatedAt: new Date().toISOString() };
      } else {
        currentSubs.push({ ...subData, createdAt: new Date().toISOString() });
      }
      fs.writeFileSync(subFile, JSON.stringify(currentSubs, null, 2), 'utf8');
    } catch (e: any) {
      console.warn('Local push subscription storage note:', e.message);
    }

    // 2. Forward to Google Apps Script if configured
    const scriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL || process.env.VITE_GOOGLE_APPS_SCRIPT_URL;
    if (scriptUrl) {
      try {
        await fetch(scriptUrl.trim(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'save_push_subscription',
            subscription: subData,
            userAgent: userAgent || req.headers['user-agent'] || 'Unknown',
          }),
        });
      } catch (err: any) {
        console.warn('Apps Script push subscription note:', err.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Push subscription registered successfully',
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to save push subscription',
    });
  }
}

// Sub-handler: Send Test Notification
export async function testPushHandler(req: any, res: any) {
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, DEFAULT_PUBLIC_KEY, DEFAULT_PRIVATE_KEY);

    let subscriptions: any[] = [];
    try {
      const subFile = path.resolve(process.cwd(), 'data', 'push_subscriptions.json');
      if (fs.existsSync(subFile)) {
        subscriptions = JSON.parse(fs.readFileSync(subFile, 'utf8') || '[]');
      }
    } catch {}

    const scriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL || process.env.VITE_GOOGLE_APPS_SCRIPT_URL;
    if (subscriptions.length === 0 && scriptUrl) {
      try {
        const remoteRes = await fetch(`${scriptUrl.trim()}?action=get_push_subscriptions`);
        if (remoteRes.ok) {
          const json: any = await remoteRes.json();
          if (json.success && Array.isArray(json.subscriptions)) {
            subscriptions = json.subscriptions;
          }
        }
      } catch {}
    }

    if (subscriptions.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No active push subscriptions found on this device or sheet.',
      });
    }

    const payload = JSON.stringify({
      title: 'MSR Penny • Test Notification 🚀',
      body: 'Notifications are active! You will receive daily expense reminders at 9:00 PM IST.',
      icon: '/pwa-192x192.png',
      badge: '/favicon.svg',
      data: { url: '/' },
    });

    let sent = 0;
    const errors: any[] = [];

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: sub.keys,
          },
          payload
        );
        sent++;
      } catch (err: any) {
        errors.push({ endpoint: sub.endpoint, error: err.message });
      }
    }

    return res.status(200).json({
      success: true,
      sentCount: sent,
      totalDevices: subscriptions.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Error sending test push notification',
    });
  }
}

// Main Dispatcher
export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const isTest =
    req.url?.includes('/test') ||
    req.query?.action === 'test' ||
    req.body?.action === 'test';

  if (isTest) {
    return testPushHandler(req, res);
  }

  return subscribeHandler(req, res);
}
