// Vercel Serverless Function: /api/cron/reminder
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
  const querySecret = (req.query.secret || req.query.token || '') as string;

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

    // 3. Smart skip check: verify if an expense was already logged today
    const scriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL || process.env.VITE_GOOGLE_APPS_SCRIPT_URL;
    let hasExpenseToday = false;

    // Check Google Apps Script for today's transactions
    if (scriptUrl && scriptUrl.trim().length > 10) {
      try {
        const checkRes = await fetch(`${scriptUrl.trim()}?action=get_state`);
        if (checkRes.ok) {
          const json = await checkRes.json();
          const txs = json.data?.transactions || json.transactions || [];
          hasExpenseToday = txs.some(
            (t: any) => t.type === 'expense' && t.date === istDateString && !t.deleted
          );
        }
      } catch (err) {
        console.warn('Smart skip check warning:', err);
      }
    }

    // Also check local database fallback if exists
    if (!hasExpenseToday) {
      try {
        const dbFile = path.resolve(process.cwd(), 'data', 'database.json');
        if (fs.existsSync(dbFile)) {
          const localData = JSON.parse(fs.readFileSync(dbFile, 'utf8') || '{}');
          const txs = localData.transactions || [];
          hasExpenseToday = txs.some(
            (t: any) => t.type === 'expense' && t.date === istDateString && !t.deleted
          );
        }
      } catch {}
    }

    // Check if smart skip was requested (default is true unless force query param is present)
    const isForced = req.query.force === 'true';
    if (hasExpenseToday && !isForced) {
      return res.status(200).json({
        success: true,
        skipped: true,
        reason: `Expense already logged for today (${istDateString}) in Asia/Kolkata. Skipping reminder.`,
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
          const json = await remoteRes.json();
          if (json.success && Array.isArray(json.subscriptions)) {
            subscriptions = json.subscriptions;
          }
        }
      } catch {}
    }

    if (subscriptions.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No push subscriptions currently registered.',
        skipped: true,
      });
    }

    // 5. Send reminder notification to all registered devices
    const payload = JSON.stringify({
      title: 'MSR Penny Reminder 🪙',
      body: "Hey Soundhar! Don't forget to record your daily expenses for today.",
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
      success: true,
      sentCount: sent,
      failedCount: errors.length,
      totalCount: subscriptions.length,
      dateIST: istDateString,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error('Cron reminder error:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to process daily reminder cron',
    });
  }
}
