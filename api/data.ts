// Vercel Serverless Function: Consolidated Data Router (/api/data)
// Dispatches to internal handlers in api/_lib/handlers/ while keeping total Serverless Functions <= 4.

import stateHandler from './_lib/handlers/state';
import transactionsHandler from './_lib/handlers/transactions';
import contactsHandler from './_lib/handlers/contacts';
import accountsHandler from './_lib/handlers/accounts';
import transfersHandler from './_lib/handlers/transfers';
import archiveHandler from './_lib/handlers/archive';
import reconcileHandler from './_lib/handlers/reconcile';
import healthHandler from './_lib/handlers/health';
import freelanceHandler from './_lib/handlers/freelance';
import savingsHandler from './_lib/handlers/savings';
import settingsHandler from './_lib/handlers/settings';
import clearDataHandler from './_lib/handlers/clear-data';
import resetDataHandler from './_lib/handlers/reset-data';
import syncHandler from './_lib/handlers/sync';

export default async function handler(req: any, res: any) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Secret-Token');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Robust route extraction from Vercel query or req.url
    let mainRoute = '';
    if (req.query?.route) {
      if (Array.isArray(req.query.route)) {
        mainRoute = req.query.route[0] || '';
      } else {
        mainRoute = String(req.query.route).split('/')[0] || '';
      }
    }

    if (!mainRoute && req.url) {
      const cleanUrl = req.url.split('?')[0];
      const segments = cleanUrl.replace(/^\/api\/?/, '').split('/');
      mainRoute = segments[0] || '';
    }

    mainRoute = mainRoute.toLowerCase().trim();

    switch (mainRoute) {
      case 'state':
        return await stateHandler(req, res);

      case 'transactions':
        return await transactionsHandler(req, res);

      case 'contacts':
        return await contactsHandler(req, res);

      case 'accounts':
        return await accountsHandler(req, res);

      case 'transfers':
        return await transfersHandler(req, res);

      case 'archive':
        return await archiveHandler(req, res);

      case 'reconcile':
        return await reconcileHandler(req, res);

      case 'health':
        return await healthHandler(req, res);

      case 'freelance':
        return await freelanceHandler(req, res);

      case 'savings':
        return await savingsHandler(req, res);

      case 'settings':
        return await settingsHandler(req, res);

      case 'clear-data':
        return await clearDataHandler(req, res);

      case 'reset-data':
        return await resetDataHandler(req, res);

      case 'sync':
        return await syncHandler(req, res);

      default:
        return res.status(404).json({
          success: false,
          error: `Endpoint not found: /api/${mainRoute || ''}`,
        });
    }
  } catch (err: any) {
    console.error('API Router internal error:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Internal API router error',
    });
  }
}
