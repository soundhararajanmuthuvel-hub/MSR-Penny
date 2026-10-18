import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Persistent database path
const DATA_DIR = path.resolve(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// Initial seed data matching the user's screenshots exactly
const initialSeedData = {
  transactions: [
    {
      id: 'tx-1',
      type: 'expense',
      title: 'Metro Recharge',
      amount: 100,
      category: 'Travel',
      date: '2026-10-24',
      paymentMethod: 'upi',
      isAppaReimbursable: false,
      appaSettled: false,
      notes: 'Station kiosk topup',
      createdAt: new Date('2026-10-24T09:30:00Z').toISOString(),
    },
    {
      id: 'tx-2',
      type: 'expense',
      title: 'Bus Pass (Appa)',
      amount: 40,
      category: 'Travel',
      date: '2026-10-23',
      paymentMethod: 'cash',
      isAppaReimbursable: true,
      appaSettled: false,
      notes: 'Claimed to Appa - Daily bus pass ticket',
      createdAt: new Date('2026-10-23T14:15:00Z').toISOString(),
    },
    {
      id: 'tx-3',
      type: 'income',
      title: 'Poster Design Client',
      amount: 800,
      category: 'Freelance',
      date: '2026-10-22',
      paymentMethod: 'upi',
      isAppaReimbursable: false,
      appaSettled: false,
      freelanceJobId: 'job-1',
      milestoneTitle: 'Milestone #1',
      notes: 'Tech Fest poster first draft approval',
      createdAt: new Date('2026-10-22T16:00:00Z').toISOString(),
    },
    {
      id: 'tx-4',
      type: 'expense',
      title: 'Canteen Lunch',
      amount: 65,
      category: 'Food',
      date: '2026-10-21',
      paymentMethod: 'upi',
      isAppaReimbursable: false,
      appaSettled: false,
      notes: 'College campus meals',
      createdAt: new Date('2026-10-21T13:00:00Z').toISOString(),
    },
    {
      id: 'tx-5',
      type: 'expense',
      title: 'Printouts',
      amount: 45,
      category: 'College',
      date: '2026-10-20',
      paymentMethod: 'cash',
      isAppaReimbursable: false,
      appaSettled: false,
      notes: 'CAD assignment prints',
      createdAt: new Date('2026-10-20T11:45:00Z').toISOString(),
    },
    {
      id: 'tx-6',
      type: 'expense',
      title: 'College Bus Pass',
      amount: 100,
      category: 'Travel',
      date: '2026-10-22',
      paymentMethod: 'upi',
      isAppaReimbursable: true,
      appaSettled: false,
      notes: 'Monthly route 14 for Appa',
      createdAt: new Date('2026-10-22T08:00:00Z').toISOString(),
    },
    {
      id: 'tx-7',
      type: 'expense',
      title: 'Train Semester Ticket',
      amount: 60,
      category: 'Travel',
      date: '2026-10-19',
      paymentMethod: 'upi',
      isAppaReimbursable: true,
      appaSettled: false,
      notes: 'Suburban railway for family visit',
      createdAt: new Date('2026-10-19T10:00:00Z').toISOString(),
    },
    {
      id: 'tx-8',
      type: 'expense',
      title: 'Engineering Printouts',
      amount: 40,
      category: 'College',
      date: '2026-10-16',
      paymentMethod: 'cash',
      isAppaReimbursable: true,
      appaSettled: false,
      notes: 'CAD design sheets for home plan',
      createdAt: new Date('2026-10-16T12:00:00Z').toISOString(),
    },
    {
      id: 'tx-9',
      type: 'repayment',
      title: 'Cash from Appa',
      amount: 300,
      category: 'Family',
      date: '2026-10-18',
      paymentMethod: 'cash',
      isAppaReimbursable: false,
      appaSettled: true,
      notes: 'Handover morning settlement',
      createdAt: new Date('2026-10-18T09:00:00Z').toISOString(),
    },
    {
      id: 'tx-10',
      type: 'repayment',
      title: 'UPI from Appa',
      amount: 300,
      category: 'Family',
      date: '2026-10-05',
      paymentMethod: 'upi',
      isAppaReimbursable: false,
      appaSettled: true,
      notes: 'Direct bank credit',
      createdAt: new Date('2026-10-05T17:30:00Z').toISOString(),
    },
    {
      id: 'tx-11',
      type: 'income',
      title: 'UI Design Consultation',
      amount: 3700,
      category: 'Freelance',
      date: '2026-10-02',
      paymentMethod: 'upi',
      isAppaReimbursable: false,
      appaSettled: false,
      notes: 'Client monthly retainer payout',
      createdAt: new Date('2026-10-02T11:00:00Z').toISOString(),
    },
    {
      id: 'tx-12',
      type: 'expense',
      title: 'Groceries & Snacks',
      amount: 1040,
      category: 'Food',
      date: '2026-10-10',
      paymentMethod: 'upi',
      isAppaReimbursable: false,
      appaSettled: false,
      notes: 'Supermarket supplies',
      createdAt: new Date('2026-10-10T18:00:00Z').toISOString(),
    }
  ],
  freelanceJobs: [
    {
      id: 'job-1',
      title: 'College Fest Brand Poster',
      clientName: 'Rohan Tech Fest',
      totalFee: 1600,
      paidAmount: 800,
      pendingAmount: 800,
      status: 'in_progress',
      dueDate: '2026-10-28',
      milestones: [
        { id: 'm-1', title: 'Concept Sketches & Key Visual', amount: 800, paid: true, paidAt: '2026-10-22' },
        { id: 'm-2', title: 'Final Vector Delivery & Formats', amount: 800, paid: false }
      ],
      costs: [
        { id: 'c-1', title: 'Sample matte photo print', amount: 45, date: '2026-10-21' }
      ],
      createdAt: new Date('2026-10-15T10:00:00Z').toISOString(),
    },
    {
      id: 'job-2',
      title: 'Cafe Launch Social Banner Pack',
      clientName: 'Bean & Bloom Cafe',
      totalFee: 2400,
      paidAmount: 1200,
      pendingAmount: 1200,
      status: 'awaiting_payment',
      dueDate: '2026-10-31',
      milestones: [
        { id: 'm-3', title: 'Initial 5 Feed Templates', amount: 1200, paid: true, paidAt: '2026-10-12' },
        { id: 'm-4', title: 'Story Templates & Print Menu', amount: 1200, paid: false }
      ],
      costs: [],
      createdAt: new Date('2026-10-10T10:00:00Z').toISOString(),
    }
  ],
  savings: {
    emergencyFund: {
      target: 3000,
      current: 900,
      title: 'Emergency Fund',
      subtitle: 'Target: 1 Month Living Buffer • Auto-deposit on 1st',
    },
    goals: [
      {
        id: 'goal-1',
        title: 'Drawing Tablet for Freelance',
        target: 12000,
        current: 4500,
        icon: 'tablet_mac',
        deadline: '2026-12-31'
      },
      {
        id: 'goal-2',
        title: 'Tech Festival Travel',
        target: 2500,
        current: 1200,
        icon: 'flight',
        deadline: '2026-11-20'
      }
    ]
  },
  settings: {
    monthlyBudget: 4000,
    userName: 'Soundhar',
    appaPhoneNumber: '+919876543210',
    googleAppsScriptUrl: '',
    googleSheetId: '',
    lastSyncedAt: null,
    syncEnabled: false,
    currency: '₹'
  }
};

function getAppaBalance(transactions: any[]) {
  const eligibleExpenses = (transactions || []).filter((t: any) => t.isAppaReimbursable);
  const totalPaidByMe = eligibleExpenses.reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0);
  const repayments = (transactions || []).filter((t: any) => t.type === 'repayment');
  const totalRepaid = repayments.reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0);
  return Math.max(0, totalPaidByMe - totalRepaid);
}

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

// Transactions CRUD with duplicate protection and accurate Appa balance calculation
app.post('/api/transactions', async (req: Request, res: Response) => {
  const db = readDb();
  const tx = req.body;

  if (!tx || !tx.type || !tx.amount || Number(tx.amount) <= 0) {
    return res.status(400).json({ success: false, error: 'Invalid transaction: amount must be greater than zero and type is required.' });
  }

  // Calculate previous balance before this transaction is applied
  const previousAppaBalance = getAppaBalance(db.transactions);

  if (!tx.id) {
    tx.id = 'tx-' + Date.now();
  }
  if (!tx.createdAt) {
    tx.createdAt = new Date().toISOString();
  }

  // Idempotency: Duplicate protection
  const existingIdx = db.transactions.findIndex((t: any) => t.id === tx.id);
  if (existingIdx >= 0) {
    db.transactions[existingIdx] = { ...db.transactions[existingIdx], ...tx };
  } else {
    db.transactions.unshift(tx);
  }

  // Calculate updated balance after transaction is recorded
  const updatedAppaBalance = getAppaBalance(db.transactions);

  writeDb(db);

  // Sync to Google Sheets if configured
  if (db.settings.googleAppsScriptUrl) {
    try {
      fetch(db.settings.googleAppsScriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sync_all',
          timestamp: new Date().toISOString(),
          transactions: db.transactions,
          settings: db.settings,
        })
      }).catch(e => console.warn('Background Google Sheets sync notice:', e.message));
    } catch {}
  }

  res.json({
    success: true,
    transaction: tx,
    previousAppaBalance,
    updatedAppaBalance,
    data: db
  });
});

app.delete('/api/transactions/:id', (req: Request, res: Response) => {
  const db = readDb();
  db.transactions = db.transactions.filter((t: any) => t.id !== req.params.id);
  writeDb(db);
  res.json({ success: true, data: db });
});

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
      freelanceJobs: db.freelanceJobs,
      savings: db.savings,
      settings: db.settings,
    };

    const response = await fetch(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
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
