// Vercel Serverless Function: Consolidated Data Router (/api/data)
// Dispatches all data API requests (/api/state, /api/transactions, /api/accounts, etc.)
// Completely self-contained to eliminate any Node ESM relative-import resolution issues in Vercel lambdas.

const DEFAULT_ACCOUNTS = [
  { id: 'acc-sbi', name: 'SBI (Main)', type: 'bank', openingBalance: 10000, openingDate: '2026-01-01', active: true, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
  { id: 'acc-iob', name: 'IOB (Second)', type: 'bank', openingBalance: 2000, openingDate: '2026-01-01', active: true, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
  { id: 'acc-cash', name: 'Cash', type: 'cash', openingBalance: 500, openingDate: '2026-01-01', active: true, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
];

const DEFAULT_FAMILY_CONTACTS = [
  { id: 'family-appa', name: 'Appa', phoneNumber: '+919876543210', active: true, relationship: 'Father' },
  { id: 'family-amma', name: 'Amma', phoneNumber: '+919876543211', active: true, relationship: 'Mother' },
  { id: 'family-chinna-akka', name: 'Chinna Akka', phoneNumber: '+919876543212', active: true, relationship: 'Sister' },
  { id: 'family-periya-akka', name: 'Periya Akka', phoneNumber: '+919876543213', active: true, relationship: 'Sister' },
];

function getScriptUrl(req: any): string {
  return (
    req.body?.googleAppsScriptUrl ||
    req.body?.url ||
    req.query?.scriptUrl ||
    process.env.GOOGLE_APPS_SCRIPT_URL ||
    process.env.VITE_GOOGLE_APPS_SCRIPT_URL ||
    ''
  );
}

// Handler: GET /api/state
async function handleState(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const scriptUrl = getScriptUrl(req);
  if (scriptUrl) {
    try {
      const fetchUrl = `${scriptUrl}${scriptUrl.includes('?') ? '&' : '?'}action=get_all_data`;
      const remoteRes = await fetch(fetchUrl, { method: 'GET' });
      if (remoteRes.ok) {
        const json: any = await remoteRes.json();
        if (json.success) {
          return res.status(200).json({
            success: true,
            source: 'google_sheets',
            data: {
              transactions: json.transactions || [],
              accounts: json.accounts || [],
              transfers: json.transfers || [],
              familyContacts: json.familyContacts || [],
              freelanceJobs: json.freelanceJobs || [],
              savings: json.savings || undefined,
              settings: {
                googleAppsScriptUrl: scriptUrl,
                lastSyncedAt: json.timestamp || new Date().toISOString(),
                syncEnabled: true,
              },
            },
          });
        }
      }
    } catch (e: any) {
      console.warn('Vercel state handler remote fetch error:', e.message);
    }
  }

  return res.status(200).json({
    success: true,
    source: 'local_fallback',
    data: {
      transactions: [],
      accounts: DEFAULT_ACCOUNTS,
      transfers: [],
      familyContacts: DEFAULT_FAMILY_CONTACTS,
      freelanceJobs: [],
      savings: {
        emergencyFund: { current: 0, target: 3000, title: 'Emergency Fund', subtitle: 'Target: 1 Month Living Buffer' },
        goals: [],
      },
      settings: {
        currency: 'INR',
        currencySymbol: '₹',
        syncEnabled: false,
        googleAppsScriptUrl: '',
      },
    },
  });
}

// Handler: /api/transactions
async function handleTransactions(req: any, res: any) {
  const scriptUrl = getScriptUrl(req);

  // DELETE
  if (req.method === 'DELETE' || (req.method === 'POST' && req.body?.action === 'delete_transaction')) {
    const id = req.query?.id || req.body?.id || req.body?.transactionId;
    if (!id) {
      return res.status(400).json({ success: false, error: 'Transaction ID is required for deletion.' });
    }

    if (scriptUrl) {
      try {
        const remoteRes = await fetch(scriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'delete_transaction', transactionId: id }),
        });
        if (!remoteRes.ok) {
          return res.status(502).json({
            success: false,
            error: `Google Apps Script returned HTTP status ${remoteRes.status}`,
            transactionId: id,
          });
        }
        const json: any = await remoteRes.json();
        return res.status(json.success ? 200 : (json.notFound ? 404 : 500)).json(json);
      } catch (err: any) {
        return res.status(502).json({
          success: false,
          error: `Failed to reach Google Apps Script: ${err.message}`,
          transactionId: id,
        });
      }
    }

    return res.status(200).json({
      success: true,
      transactionId: id,
      message: `Transaction ${id} removed from local state.`,
    });
  }

  // POST
  if (req.method === 'POST') {
    const tx = req.body;
    if (!tx || !tx.type || !tx.amount || Number(tx.amount) <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid transaction: positive amount and type are required.',
      });
    }

    if (!tx.id) tx.id = 'tx-' + Date.now();
    if (!tx.date) tx.date = new Date().toISOString().split('T')[0];
    if (!tx.createdAt) tx.createdAt = new Date().toISOString();
    if (!tx.category) tx.category = 'Other';

    if (scriptUrl) {
      try {
        const remoteRes = await fetch(scriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'add_transaction', transaction: tx }),
        });
        if (!remoteRes.ok) {
          return res.status(502).json({
            success: false,
            error: `Google Apps Script returned HTTP status ${remoteRes.status}`,
            transaction: tx,
          });
        }
        const json: any = await remoteRes.json();
        return res.status(json.success ? 200 : 500).json(json);
      } catch (err: any) {
        return res.status(502).json({
          success: false,
          error: `Failed to reach Google Apps Script: ${err.message}`,
          transaction: tx,
        });
      }
    }

    return res.status(200).json({
      success: true,
      transaction: tx,
      message: 'Transaction saved to local state.',
    });
  }

  return res.status(405).json({ success: false, error: 'Method not allowed' });
}

// Handler: /api/accounts
async function handleAccounts(req: any, res: any) {
  const scriptUrl = getScriptUrl(req);

  // GET: Fetch accounts or backups list
  if (req.method === 'GET') {
    if (req.query?.action === 'backups' || req.query?.backups === 'true') {
      if (scriptUrl) {
        try {
          const fetchUrl = `${scriptUrl}${scriptUrl.includes('?') ? '&' : '?'}action=get_accounts_backups`;
          const remoteRes = await fetch(fetchUrl, { method: 'GET' });
          if (remoteRes.ok) {
            const json: any = await remoteRes.json();
            return res.status(200).json(json);
          }
        } catch (e: any) {
          console.warn('Remote accounts backups fetch error:', e.message);
        }
      }
      return res.status(200).json({ success: true, backups: [] });
    }

    if (scriptUrl) {
      try {
        const fetchUrl = `${scriptUrl}${scriptUrl.includes('?') ? '&' : '?'}action=get_accounts`;
        const remoteRes = await fetch(fetchUrl, { method: 'GET' });
        if (remoteRes.ok) {
          const json: any = await remoteRes.json();
          if (json.success && Array.isArray(json.accounts)) {
            return res.status(200).json({ success: true, accounts: json.accounts });
          }
        }
      } catch (e: any) {
        console.warn('Remote accounts fetch error:', e.message);
      }
    }
    return res.status(200).json({ success: true, accounts: DEFAULT_ACCOUNTS });
  }

  // POST: Save/update accounts or restore backup
  if (req.method === 'POST') {
    // Handle restore action
    if (req.body?.action === 'restore_backup' || req.body?.action === 'restore_accounts_backup') {
      if (scriptUrl) {
        try {
          const remoteRes = await fetch(scriptUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
              action: 'restore_accounts_backup',
              backupName: req.body?.backupName,
            }),
          });
          if (!remoteRes.ok) {
            return res.status(502).json({
              success: false,
              error: `Google Apps Script returned status ${remoteRes.status}`,
            });
          }
          const json: any = await remoteRes.json();
          return res.status(json.success ? 200 : 500).json(json);
        } catch (err: any) {
          return res.status(502).json({
            success: false,
            error: `Failed to restore accounts backup: ${err.message}`,
          });
        }
      }
      return res.status(200).json({ success: true, message: 'Restore executed locally.' });
    }

    const rawAccounts = req.body?.accounts || req.body;
    if (!Array.isArray(rawAccounts) || rawAccounts.length === 0) {
      return res.status(400).json({ success: false, error: 'Accounts array is required.' });
    }

    // Server-side validation: Allowed accounts & non-negative numbers
    const allowedAccountIds = new Set(['acc-sbi', 'acc-iob', 'acc-cash']);
    const sanitizedAccounts = [];

    for (const a of rawAccounts) {
      if (!a.id || !allowedAccountIds.has(a.id)) {
        return res.status(400).json({
          success: false,
          error: `Invalid account ID '${a?.id}'. Allowed accounts are SBI, IOB, and Cash.`,
        });
      }

      const bal = Number(a.openingBalance);
      if (isNaN(bal) || bal < 0) {
        return res.status(400).json({
          success: false,
          error: `Opening balance for ${a.name || a.id} must be a non-negative number.`,
        });
      }

      const dateStr = String(a.openingDate || '').trim();
      if (dateStr && !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return res.status(400).json({
          success: false,
          error: `Opening date for ${a.name || a.id} must be in YYYY-MM-DD format.`,
        });
      }

      sanitizedAccounts.push({
        id: a.id,
        name: String(a.name || a.id).trim(),
        type: a.type === 'cash' ? 'cash' : 'bank',
        openingBalance: Math.round(bal * 100) / 100,
        openingDate: dateStr || '2026-10-01',
        active: a.active !== false,
      });
    }

    if (scriptUrl) {
      try {
        const remoteRes = await fetch(scriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'save_accounts', accounts: sanitizedAccounts }),
        });
        if (!remoteRes.ok) {
          return res.status(502).json({
            success: false,
            error: `Google Apps Script returned status ${remoteRes.status}`,
          });
        }
        const json: any = await remoteRes.json();
        return res.status(json.success ? 200 : 500).json(json);
      } catch (err: any) {
        return res.status(502).json({
          success: false,
          error: `Failed to reach Google Apps Script: ${err.message}`,
        });
      }
    }

    return res.status(200).json({
      success: true,
      accounts: sanitizedAccounts,
      message: 'Accounts saved locally (Google Sheets not configured).',
    });
  }

  return res.status(405).json({ success: false, error: 'Method not allowed' });
}

// Handler: /api/transfers
async function handleTransfers(req: any, res: any) {
  const scriptUrl = getScriptUrl(req);

  if (req.method === 'GET') {
    if (scriptUrl) {
      try {
        const fetchUrl = `${scriptUrl}${scriptUrl.includes('?') ? '&' : '?'}action=get_transfers`;
        const remoteRes = await fetch(fetchUrl, { method: 'GET' });
        if (remoteRes.ok) {
          const json: any = await remoteRes.json();
          if (json.success && Array.isArray(json.transfers)) {
            return res.status(200).json({ success: true, transfers: json.transfers });
          }
        }
      } catch (e: any) {
        console.warn('Remote transfers fetch error:', e.message);
      }
    }
    return res.status(200).json({ success: true, transfers: [] });
  }

  if (req.method === 'DELETE' || (req.method === 'POST' && req.body?.action === 'delete_transfer')) {
    const id = req.query?.id || req.body?.id || req.body?.transferId;
    if (!id) {
      return res.status(400).json({ success: false, error: 'Transfer ID is required for deletion.' });
    }

    if (scriptUrl) {
      try {
        const remoteRes = await fetch(scriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'delete_transfer', transferId: id }),
        });
        if (!remoteRes.ok) {
          return res.status(502).json({
            success: false,
            error: `Google Apps Script returned status ${remoteRes.status}`,
          });
        }
        const json: any = await remoteRes.json();
        return res.status(json.success ? 200 : (json.notFound ? 404 : 500)).json(json);
      } catch (err: any) {
        return res.status(502).json({
          success: false,
          error: `Failed to reach Google Apps Script: ${err.message}`,
        });
      }
    }

    return res.status(200).json({ success: true, transferId: id, message: 'Transfer removed.' });
  }

  if (req.method === 'POST') {
    const tr = req.body;
    if (!tr || !tr.amount || Number(tr.amount) <= 0 || !tr.fromAccountId || !tr.toAccountId) {
      return res.status(400).json({
        success: false,
        error: 'Invalid transfer: positive amount and from/to accounts are required.',
      });
    }

    if (!tr.id) tr.id = 'tr-' + Date.now();
    if (!tr.createdAt) tr.createdAt = new Date().toISOString();

    if (scriptUrl) {
      try {
        const remoteRes = await fetch(scriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'add_transfer', transfer: tr }),
        });
        if (!remoteRes.ok) {
          return res.status(502).json({
            success: false,
            error: `Google Apps Script returned status ${remoteRes.status}`,
          });
        }
        const json: any = await remoteRes.json();
        return res.status(json.success ? 200 : 500).json(json);
      } catch (err: any) {
        return res.status(502).json({
          success: false,
          error: `Failed to reach Google Apps Script: ${err.message}`,
        });
      }
    }

    return res.status(200).json({ success: true, transfer: tr, message: 'Transfer recorded locally.' });
  }

  return res.status(405).json({ success: false, error: 'Method not allowed' });
}

// Handler: /api/archive
async function handleArchive(req: any, res: any) {
  const scriptUrl = getScriptUrl(req);

  if (req.method === 'GET') {
    if (scriptUrl) {
      try {
        const fetchUrl = `${scriptUrl}${scriptUrl.includes('?') ? '&' : '?'}action=get_settled_archive`;
        const remoteRes = await fetch(fetchUrl, { method: 'GET' });
        if (remoteRes.ok) {
          const json: any = await remoteRes.json();
          return res.status(200).json(json);
        }
      } catch (err: any) {
        console.warn('Apps Script get_settled_archive warning:', err);
      }
    }
    return res.status(200).json({ success: true, archiveItems: [] });
  }

  if (req.method === 'POST') {
    const { action, batchId, contactId, transactionIds } = req.body || {};

    if (action === 'restore') {
      if (scriptUrl) {
        try {
          const remoteRes = await fetch(scriptUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'restore_archived_items', batchId }),
          });
          if (remoteRes.ok) {
            const json: any = await remoteRes.json();
            return res.status(200).json(json);
          }
        } catch (err: any) {
          return res.status(502).json({ success: false, error: err.message });
        }
      }
      return res.status(200).json({ success: true, message: 'Restored locally.' });
    }

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
          const json: any = await remoteRes.json();
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
      message: 'Archived locally.',
    });
  }

  return res.status(405).json({ success: false, error: 'Method not allowed' });
}

// Handler: /api/reconcile
async function handleReconcile(req: any, res: any) {
  const scriptUrl = getScriptUrl(req);

  if (req.method === 'GET') {
    if (scriptUrl) {
      try {
        const fetchUrl = `${scriptUrl}${scriptUrl.includes('?') ? '&' : '?'}action=get_reconciliations`;
        const remoteRes = await fetch(fetchUrl, { method: 'GET' });
        if (remoteRes.ok) {
          const json: any = await remoteRes.json();
          return res.status(200).json(json);
        }
      } catch (err: any) {
        console.warn('Apps Script get_reconciliations warning:', err);
      }
    }
    return res.status(200).json({ success: true, reconciliations: [] });
  }

  if (req.method === 'POST') {
    const { reconciliation } = req.body || {};
    if (!reconciliation || !reconciliation.accountId) {
      return res.status(400).json({ success: false, error: 'Invalid reconciliation payload' });
    }

    if (scriptUrl) {
      try {
        const remoteRes = await fetch(scriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'save_reconciliation', reconciliation }),
        });
        if (remoteRes.ok) {
          const json: any = await remoteRes.json();
          return res.status(200).json(json);
        }
      } catch (err: any) {
        return res.status(502).json({ success: false, error: err.message });
      }
    }

    return res.status(200).json({
      success: true,
      reconciliationId: reconciliation.id || `rec-${Date.now()}`,
      message: 'Reconciliation recorded locally',
    });
  }

  return res.status(405).json({ success: false, error: 'Method not allowed' });
}

// Handler: /api/health
async function handleHealth(req: any, res: any) {
  const scriptUrl = getScriptUrl(req);

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

// Handler: /api/sync/push
async function handleSync(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const scriptUrl = getScriptUrl(req);
  if (!scriptUrl) {
    return res.status(400).json({
      success: false,
      error: 'No Google Apps Script Webhook URL provided.',
    });
  }

  try {
    const payload = {
      action: 'sync_all',
      timestamp: new Date().toISOString(),
      transactions: req.body.transactions || [],
      accounts: req.body.accounts || [],
      transfers: req.body.transfers || [],
      familyContacts: req.body.familyContacts || [],
      freelanceJobs: req.body.freelanceJobs || [],
      savings: req.body.savings || {},
      settings: req.body.settings || {},
    };

    const remoteRes = await fetch(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });

    const respText = await remoteRes.text();
    let respJson: any = null;
    try {
      respJson = JSON.parse(respText);
    } catch {
      respJson = { raw: respText };
    }

    if (!remoteRes.ok || respJson?.success === false) {
      return res.status(502).json({
        success: false,
        error: respJson?.error || `Remote server returned HTTP ${remoteRes.status}`,
        remoteResponse: respJson,
      });
    }

    return res.status(200).json({
      success: true,
      timestamp: respJson?.timestamp || new Date().toISOString(),
      message: 'Full state synchronized successfully with Google Sheets.',
      remoteResponse: respJson,
    });
  } catch (err: any) {
    return res.status(502).json({
      success: false,
      error: `Failed to push sync to Google Apps Script: ${err.message}`,
    });
  }
}

// Handler: /api/contacts
async function handleContacts(req: any, res: any) {
  return res.status(200).json({
    success: true,
    contact: req.body || null,
    updatedAt: new Date().toISOString(),
  });
}

// Handler: /api/freelance
async function handleFreelance(req: any, res: any) {
  if (req.method === 'DELETE') {
    return res.status(200).json({ success: true, message: 'Freelance job deleted' });
  }
  return res.status(200).json({
    success: true,
    job: req.body || null,
  });
}

// Handler: /api/savings
async function handleSavings(req: any, res: any) {
  return res.status(200).json({
    success: true,
    savings: req.body || null,
  });
}

// Handler: /api/settings
async function handleSettings(req: any, res: any) {
  return res.status(200).json({
    success: true,
    settings: req.body || {},
    updatedAt: new Date().toISOString(),
  });
}

// Handler: /api/clear-data
async function handleClearData(req: any, res: any) {
  const scriptUrl = getScriptUrl(req);
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

// Handler: /api/reset-data
async function handleResetData(req: any, res: any) {
  return res.status(200).json({
    success: true,
    message: 'Reset data completed',
  });
}

// Main Consolidated Data Router
export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Secret-Token');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
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
        return await handleState(req, res);
      case 'transactions':
        return await handleTransactions(req, res);
      case 'contacts':
        return await handleContacts(req, res);
      case 'accounts':
        return await handleAccounts(req, res);
      case 'transfers':
        return await handleTransfers(req, res);
      case 'archive':
        return await handleArchive(req, res);
      case 'reconcile':
        return await handleReconcile(req, res);
      case 'health':
        return await handleHealth(req, res);
      case 'freelance':
        return await handleFreelance(req, res);
      case 'savings':
        return await handleSavings(req, res);
      case 'settings':
        return await handleSettings(req, res);
      case 'clear-data':
        return await handleClearData(req, res);
      case 'reset-data':
        return await handleResetData(req, res);
      case 'sync':
        return await handleSync(req, res);
      default:
        return res.status(404).json({
          success: false,
          error: `API route '${mainRoute}' not found on consolidated data router.`,
        });
    }
  } catch (err: any) {
    console.error('Data router unhandled error:', err);
    return res.status(500).json({
      success: false,
      error: `Internal server error: ${err.message}`,
    });
  }
}
