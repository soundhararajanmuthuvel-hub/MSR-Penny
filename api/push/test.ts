// Vercel Serverless Function: /api/push/test
import webpush from 'web-push';
import fs from 'fs';
import path from 'path';

const DEFAULT_PUBLIC_KEY =
  process.env.VITE_VAPID_PUBLIC_KEY ||
  'BFumy3go8AuIfBnrtYBbst5Fksz3VkUbfJe23Q6Ydl6okux_S5BdX9hA9Jq679Evygnc_uh6fpYxb9Fs_cIa6t0';

const DEFAULT_PRIVATE_KEY =
  process.env.VAPID_PRIVATE_KEY ||
  'RZHZodVOHoZSQ9sag5F6zbzmwxFe6aYVbFXx7t5mdsM';

const VAPID_SUBJECT =
  process.env.VAPID_SUBJECT || 'mailto:soundhararajanmuthuvel@gmail.com';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    webpush.setVapidDetails(VAPID_SUBJECT, DEFAULT_PUBLIC_KEY, DEFAULT_PRIVATE_KEY);

    // Collect subscriptions from local storage or Apps Script
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
          const json = await remoteRes.json();
          if (json.success && Array.isArray(json.subscriptions)) {
            subscriptions = json.subscriptions;
          }
        }
      } catch {}
    }

    if (subscriptions.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No active push subscriptions found. Please enable notifications on your device first.',
      });
    }

    const payload = JSON.stringify({
      title: 'MSR Penny 🪙',
      body: 'Test notification confirmed! Daily reminder will alert you at 9:00 PM IST.',
      icon: '/pwa-192x192.png',
      badge: '/favicon-32x32.png',
      data: { url: '/#add-expense' },
    });

    let sent = 0;
    const errors: any[] = [];

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.keys?.p256dh || sub.p256dh,
              auth: sub.keys?.auth || sub.auth,
            },
          },
          payload
        );
        sent++;
      } catch (err: any) {
        errors.push({ endpoint: sub.endpoint, error: err?.message || String(err) });
      }
    }

    return res.status(200).json({
      success: sent > 0,
      sentCount: sent,
      totalCount: subscriptions.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err: any) {
    console.error('Test push error:', err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Failed to send test push notification',
    });
  }
}
