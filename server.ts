import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { initialSeedData } from './src/data/initialData';
import { DEFAULT_FAMILY_CONTACTS, calculateFamilyBalances } from './src/utils/familyMigration';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Persistent database path
const DATA_DIR = path.resolve(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

function readDb() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(initialSeedData, null, 2), 'utf-8');
    return initialSeedData;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const data = JSON.parse(raw);
    if (!data.familyContacts || data.familyContacts.length === 0) {
      data.familyContacts = DEFAULT_FAMILY_CONTACTS;
    }
    if (data.settings && !data.settings.appaPhoneNumber) {
      data.settings.appaPhoneNumber = '+919876543210';
    }
    return data;
  } catch (err) {
    console.error('Error reading db:', err);
    return initialSeedData;
  }
}

function writeDb(data: any) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// REST API Endpoints
app.get('/api/state', (req: Request, res: Response) => {
  const db = readDb();
  res.json({ success: true, data: db });
});

// Family Contacts
app.get('/api/contacts', (req: Request, res: Response) => {
  const db = readDb();
  res.json({ success: true, contacts: db.familyContacts || DEFAULT_FAMILY_CONTACTS });
});

app.post('/api/contacts', (req: Request, res: Response) => {
  const db = readDb();
  const contact = req.body;
  if (!contact || !contact.name) {
    return res.status(400).json({ success: false, error: 'Contact name is required' });
  }

  if (!db.familyContacts) {
    db.familyContacts = [...DEFAULT_FAMILY_CONTACTS];
  }

  const existingIdx = db.familyContacts.findIndex((c: any) => c.id === contact.id);
  if (existingIdx >= 0) {
    db.familyContacts[existingIdx] = { ...db.familyContacts[existingIdx], ...contact };
  } else {
    if (!contact.id) contact.id = 'family-' + Date.now();
    db.familyContacts.push(contact);
  }

  writeDb(db);
  res.json({ success: true, contact, contacts: db.familyContacts });
});

// Transactions CRUD with duplicate protection and verified persistence
app.post('/api/transactions', async (req: Request, res: Response) => {
  const db = readDb();
  const tx = req.body;

  if (!tx || !tx.type || !tx.amount || Number(tx.amount) <= 0) {
    return res.status(400).json({
      success: false,
      error: 'Invalid transaction: amount must be greater than zero and type is required.',
    });
  }

  const contacts = db.familyContacts || DEFAULT_FAMILY_CONTACTS;
  const prevBalances = calculateFamilyBalances(db.transactions, contacts);
  const targetContactId = tx.familyContactId || (tx.isAppaReimbursable ? 'family-appa' : undefined);

  const previousContactBalance = targetContactId && prevBalances.contactBalances[targetContactId]
    ? prevBalances.contactBalances[targetContactId].outstandingBalance
    : prevBalances.contactBalances['family-appa']?.outstandingBalance || 0;

  if (!tx.id) {
    tx.id = 'tx-' + Date.now();
  }
  if (!tx.createdAt) {
    tx.createdAt = new Date().toISOString();
  }

  // Idempotency: Duplicate protection by unique transaction ID
  const existingIdx = db.transactions.findIndex((t: any) => t.id === tx.id);
  if (existingIdx >= 0) {
    db.transactions[existingIdx] = { ...db.transactions[existingIdx], ...tx };
  } else {
    db.transactions.unshift(tx);
  }

  // Calculate updated balance after transaction is recorded
  const updatedBalances = calculateFamilyBalances(db.transactions, contacts);
  const updatedContactBalance = targetContactId && updatedBalances.contactBalances[targetContactId]
    ? updatedBalances.contactBalances[targetContactId].outstandingBalance
    : updatedBalances.contactBalances['family-appa']?.outstandingBalance || 0;

  writeDb(db);

  // Sync to Google Sheets if configured (and await verified response)
  const scriptUrl = db.settings.googleAppsScriptUrl || process.env.GOOGLE_APPS_SCRIPT_URL;
  let remoteResponse: any = null;

  if (scriptUrl) {
    try {
      const gRes = await fetch(scriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'add_transaction',
          transaction: tx,
        }),
      });

      if (gRes.ok) {
        remoteResponse = await gRes.json().catch(() => null);
      }
    } catch (e: any) {
      console.warn('Google Sheets persistence notice:', e.message);
    }
  }

  res.json({
    success: true,
    transaction: tx,
    previousBalance: previousContactBalance,
    updatedBalance: updatedContactBalance,
    previousAppaBalance: prevBalances.contactBalances['family-appa']?.outstandingBalance || 0,
    updatedAppaBalance: updatedBalances.contactBalances['family-appa']?.outstandingBalance || 0,
    remoteResponse,
    data: db,
  });
});

const handleDeleteTransaction = async (req: Request, res: Response) => {
  const id = req.params?.id || (req.query?.id as string) || req.body?.id || req.body?.transactionId;
  if (!id) {
    return res.status(400).json({ success: false, error: 'Transaction ID is required' });
  }

  const db = readDb();
  const deletedTx = db.transactions.find((t: any) => t.id === id);
  db.transactions = db.transactions.filter((t: any) => t.id !== id);
  writeDb(db);

  const scriptUrl = db.settings?.googleAppsScriptUrl || process.env.GOOGLE_APPS_SCRIPT_URL;
  let remoteResponse: any = null;

  if (scriptUrl) {
    try {
      const gRes = await fetch(scriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'delete_transaction',
          transactionId: id,
        }),
      });
      if (gRes.ok) {
        remoteResponse = await gRes.json().catch(() => null);
      }
    } catch (e: any) {
      console.warn('Google Sheets deletion notice:', e.message);
    }
  }

  const contacts = db.familyContacts || DEFAULT_FAMILY_CONTACTS;
  const balances = calculateFamilyBalances(db.transactions, contacts);

  return res.json({
    success: true,
    transactionId: id,
    deletedTransaction: deletedTx,
    remoteResponse,
    appaBalance: balances.contactBalances['family-appa']?.outstandingBalance || 0,
    totalFamilyOutstanding: balances.totalFamilyOutstanding,
    balancesByContact: balances.contactBalances,
    data: db,
  });
};

app.delete('/api/transactions/:id', handleDeleteTransaction);
app.delete('/api/transactions', handleDeleteTransaction);

// Freelance CRUD
app.post('/api/freelance', (req: Request, res: Response) => {
  const db = readDb();
  const job = req.body;
  if (!job.id) {
    job.id = 'job-' + Date.now();
  }
  if (!job.createdAt) {
    job.createdAt = new Date().toISOString();
  }

  const existingIdx = db.freelanceJobs.findIndex((j: any) => j.id === job.id);
  if (existingIdx >= 0) {
    db.freelanceJobs[existingIdx] = { ...db.freelanceJobs[existingIdx], ...job };
  } else {
    db.freelanceJobs.unshift(job);
  }

  writeDb(db);
  res.json({ success: true, job, data: db });
});

app.delete('/api/freelance/:id', (req: Request, res: Response) => {
  const db = readDb();
  db.freelanceJobs = db.freelanceJobs.filter((j: any) => j.id !== req.params.id);
  writeDb(db);
  res.json({ success: true, data: db });
});

// Savings & Emergency Fund
app.post('/api/savings', (req: Request, res: Response) => {
  const db = readDb();
  db.savings = { ...db.savings, ...req.body };
  writeDb(db);
  res.json({ success: true, data: db });
});

// Settings & Google Sheets URL
app.post('/api/settings', (req: Request, res: Response) => {
  const db = readDb();
  db.settings = { ...db.settings, ...req.body };
  writeDb(db);
  res.json({ success: true, data: db });
});

// Reset data to defaults
app.post('/api/reset-data', (req: Request, res: Response) => {
  writeDb(initialSeedData);
  res.json({ success: true, data: initialSeedData });
});

// Clear all demo data (start fresh, keep user settings)
app.post('/api/clear-data', (req: Request, res: Response) => {
  const db = readDb();
  db.transactions = [];
  db.freelanceJobs = [];
  db.familyContacts = DEFAULT_FAMILY_CONTACTS;
  db.savings = {
    emergencyFund: { current: 0, target: 3000, title: 'Emergency Fund', subtitle: 'Target: 1 Month Living Buffer' },
    goals: [],
  };
  writeDb(db);
  res.json({ success: true, data: db });
});

// Google Sheets / Apps Script Webhook Push proxy
app.post('/api/sync/push', async (req: Request, res: Response) => {
  const db = readDb();
  const scriptUrl = req.body.url || db.settings.googleAppsScriptUrl;

  if (!scriptUrl) {
    return res.status(400).json({ success: false, error: 'No Google Apps Script Webhook URL provided.' });
  }

  try {
    const payload = {
      action: 'sync_all',
      timestamp: new Date().toISOString(),
      transactions: db.transactions,
      familyContacts: db.familyContacts || DEFAULT_FAMILY_CONTACTS,
      freelanceJobs: db.freelanceJobs,
      savings: db.savings,
      settings: db.settings,
    };

    const response = await fetch(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });

    const respText = await response.text();
    let respJson: any = null;
    try {
      respJson = JSON.parse(respText);
    } catch {
      respJson = { message: respText };
    }

    db.settings.lastSyncedAt = new Date().toISOString();
    writeDb(db);

    return res.json({ success: true, syncedAt: db.settings.lastSyncedAt, remoteResponse: respJson });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to reach Apps Script URL' });
  }
});

// Mount Vite in dev mode or serve static files in production
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT} (mode: ${isProduction ? 'production' : 'development'})`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
