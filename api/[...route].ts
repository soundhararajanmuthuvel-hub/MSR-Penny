// Vercel Serverless Function: Catch-All Router for all Application Data Endpoints
// Consolidates 14 separate handlers into a single serverless function to stay well within the Vercel Hobby 12-function limit.

import stateHandler from '../server/handlers/state';
import transactionsHandler from '../server/handlers/transactions';
import contactsHandler from '../server/handlers/contacts';
import accountsHandler from '../server/handlers/accounts';
import transfersHandler from '../server/handlers/transfers';
import archiveHandler from '../server/handlers/archive';
import reconcileHandler from '../server/handlers/reconcile';
import healthHandler from '../server/handlers/health';
import freelanceHandler from '../server/handlers/freelance';
import savingsHandler from '../server/handlers/savings';
import settingsHandler from '../server/handlers/settings';
import clearDataHandler from '../server/handlers/clear-data';
import resetDataHandler from '../server/handlers/reset-data';
import syncHandler from '../server/handlers/sync';

export default async function handler(req: any, res: any) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Secret-Token');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

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
      return stateHandler(req, res);

    case 'transactions':
      return transactionsHandler(req, res);

    case 'contacts':
      return contactsHandler(req, res);

    case 'accounts':
      return accountsHandler(req, res);

    case 'transfers':
      return transfersHandler(req, res);

    case 'archive':
      return archiveHandler(req, res);

    case 'reconcile':
      return reconcileHandler(req, res);

    case 'health':
      return healthHandler(req, res);

    case 'freelance':
      return freelanceHandler(req, res);

    case 'savings':
      return savingsHandler(req, res);

    case 'settings':
      return settingsHandler(req, res);

    case 'clear-data':
      return clearDataHandler(req, res);

    case 'reset-data':
      return resetDataHandler(req, res);

    case 'sync':
      return syncHandler(req, res);

    default:
      return res.status(404).json({
        success: false,
        error: `Endpoint not found: /api/${mainRoute || ''}`,
      });
  }
}
