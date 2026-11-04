// Vercel Serverless Function: /api/cron
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

  // 1. Authorization verification for Cron
  const cronSecret = process.env.CRON_SECRET;
  const shortcutToken = process.env.SHORTCUT_SECRET_TOKEN;
  const authHeader = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  const querySecret = (req.query?.secret || req.query?.token || '') as string;

  if (cronSecret) {
    const isAuthorized = authHeader === cronSecret || querySecret === cronSecret || (shortcutToken && authHeader === shortcutToken);
    if (!isAuthorized) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Invalid or missing CRON_SECRET',
      });
    }
  }

  try {
    webpush.setVapidDetails(VAPID_SUBJECT, DEFAULT_PUBLIC_KEY, DEFAULT_PRIVATE_KEY);

    // 2. Determine today's date in Asia/Kolkata timezone (YYYY-MM-DD)
    const istDateString = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

    // 3. Smart Skip Check
    const skipIfLogged = req.query?.force !== 'true';
    const scriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL || process.env.VITE_GOOGLE_APPS_SCRIPT_URL;

    let hasExpenseToday = false;

    // Check local database fallback
    try {
      const dbPath = path.resolve(process.cwd(), 'data', 'db.json');
      if (fs.existsSync(dbPath)) {
        const db = JSON.parse(fs.readFileSync(dbPath, 'utf8') || '{}');
        const txs: any[] = db.transactions || [];
        hasExpenseToday = txs.some(
          (t) => t.date === istDateString && t.type === 'expense' && !t.deleted
        );
      }
    } catch {}

    // Check Google Apps Script live transactions
    if (!hasExpenseToday && scriptUrl) {
      try {
        const remoteRes = await fetch(`${scriptUrl.trim()}?action=get_all_data`);
        if (remoteRes.ok) {
          const json: any = await remoteRes.json();
          if (json.success && Array.isArray(json.transactions)) {
            hasExpenseToday = json.transactions.some(
              (t: any) => t.date === istDateString && t.type === 'expense' && !t.deleted
            );
          }
        }
      } catch {}
    }

    if (hasExpenseToday && skipIfLogged) {
      return res.status(200).json({
        success: true,
        skipped: true,
        reason: `Expense already logged for today (${istDateString} IST). Reminder skipped.`,
      });
    }

    // 4. Retrieve push subscriptions
    let subscriptions: any[] = [];
    try {
      const subFile = path.resolve(process.cwd(), 'data', 'push_subscriptions.json');
      if (fs.existsSync(subFile)) {
        subscriptions = JSON.parse(fs.readFileSync(subFile, 'utf8') || '[]');
      }
    } catch {}

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
      return res.status(200).json({
        success: true,
        sentCount: 0,
        message: 'No push subscriptions registered. Notification not sent.',
      });
    }

    // 5. Send daily reminder notification
    const payload = JSON.stringify({
      title: 'MSR Penny • Daily Reminder 📝',
      body: 'Did you spend anything today? Tap to record your expenses before you sleep!',
      icon: '/pwa-192x192.png',
      badge: '/favicon.svg',
      tag: 'msr-penny-daily-reminder',
      data: {
        url: '/',
        date: istDateString,
      },
    });

    let sentCount = 0;
    const sendPromises = subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: sub.keys,
          },
          payload
        );
        sentCount++;
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          console.warn('Subscription expired/unsubscribed:', sub.endpoint);
        }
      }
    });

    await Promise.allSettled(sendPromises);

    return res.status(200).json({
      success: true,
      sentCount,
      totalSubscribers: subscriptions.length,
      date: istDateString,
      message: `Daily reminder delivered to ${sentCount} device(s).`,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Error executing cron reminder',
    });
  }
}

export const reminderCronHandler = handler;
