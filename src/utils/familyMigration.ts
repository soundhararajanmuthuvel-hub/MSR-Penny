import { FamilyContact, Transaction, FamilyContactBalance } from '../types';
import { normalizeWhatsAppNumber } from './phoneNormalizer';

export const DEFAULT_FAMILY_CONTACTS: FamilyContact[] = [
  {
    id: 'family-appa',
    name: 'Appa',
    phoneNumber: '+919876543210',
    active: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'family-amma',
    name: 'Amma',
    phoneNumber: '',
    active: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'family-chinna-akka',
    name: 'Chinna Akka',
    phoneNumber: '',
    active: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'family-periya-akka',
    name: 'Periya Akka',
    phoneNumber: '',
    active: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
];

export interface MigrationResult {
  migratedTransactions: Transaction[];
  migratedCount: number;
  needsReviewCount: number;
}

/**
 * Idempotently migrates existing Appa-only transactions to family settlements schema.
 * 
 * Rules:
 * - If transaction is already assigned to a family contact, preserve it.
 * - If isAppaReimbursable = true, assign to Appa ('family-appa').
 * - If type = repayment:
 *   - Check title/notes: if "appa" is found, assign to Appa ('family-appa').
 *   - If no reliable contact indicator exists, flag with needsReview = true.
 * - Never arbitrarily assign legacy records to Amma or sisters.
 * - Preserve all original IDs, amounts, dates, notes, and descriptions.
 */
export function migrateAppaTransactions(
  transactions: Transaction[],
  familyContacts: FamilyContact[] = DEFAULT_FAMILY_CONTACTS
): MigrationResult {
  let migratedCount = 0;
  let needsReviewCount = 0;

  const appaContact = familyContacts.find((c) => c.id === 'family-appa') || DEFAULT_FAMILY_CONTACTS[0];

  const migratedTransactions = (transactions || []).map((t) => {
    // Clone transaction to maintain immutability
    const updated: Transaction = { ...t };

    // Already migrated with a familyContactId
    if (updated.familyContactId) {
      if (!updated.familyContactName) {
        const matched = familyContacts.find((c) => c.id === updated.familyContactId);
        updated.familyContactName = matched ? matched.name : 'Family';
      }
      return updated;
    }

    // Legacy reimbursable expense
    if (updated.type === 'expense' && updated.isAppaReimbursable) {
      updated.isFamilyReimbursable = true;
      updated.familyContactId = appaContact.id;
      updated.familyContactName = appaContact.name;
      updated.settlementStatus = updated.appaSettled ? 'settled' : 'pending';
      migratedCount++;
      return updated;
    }

    // Legacy repayment
    if (updated.type === 'repayment') {
      const text = `${updated.title || ''} ${updated.notes || ''}`.toLowerCase();
      if (text.includes('appa') || updated.appaSettled) {
        updated.familyContactId = appaContact.id;
        updated.familyContactName = appaContact.name;
        updated.settlementStatus = 'settled';
        migratedCount++;
      } else {
        // Unknown source repayment: flag for manual review
        updated.needsReview = true;
        needsReviewCount++;
      }
      return updated;
    }

    return updated;
  });

  return {
    migratedTransactions,
    migratedCount,
    needsReviewCount,
  };
}

/**
 * Deterministically calculates outstanding balances and ledger metrics for all family contacts.
 */
export function calculateFamilyBalances(
  transactions: Transaction[],
  contacts: FamilyContact[] = DEFAULT_FAMILY_CONTACTS
) {
  const contactBalances: Record<string, FamilyContactBalance> = {};

  let totalFamilyExpenses = 0;
  let totalFamilyRepayments = 0;

  // Initialize for all active contacts
  contacts.forEach((contact) => {
    contactBalances[contact.id] = {
      contact,
      totalReimbursable: 0,
      totalRepaid: 0,
      outstandingBalance: 0,
      pendingCount: 0,
    };
  });

  (transactions || []).forEach((t) => {
    const amt = Number(t.amount) || 0;
    if (amt <= 0) return;

    // Resolve target contact ID
    let contactId = t.familyContactId;
    if (!contactId && (t.isAppaReimbursable || (t.type === 'repayment' && !t.needsReview))) {
      contactId = 'family-appa';
    }

    if (!contactId || !contactBalances[contactId]) {
      // If contact does not exist in initial map, dynamically create record
      if (contactId) {
        contactBalances[contactId] = {
          contact: { id: contactId, name: t.familyContactName || contactId, active: true },
          totalReimbursable: 0,
          totalRepaid: 0,
          outstandingBalance: 0,
          pendingCount: 0,
        };
      } else {
        return;
      }
    }

    const item = contactBalances[contactId];

    if (t.type === 'expense' && (t.isFamilyReimbursable || t.isAppaReimbursable)) {
      item.totalReimbursable += amt;
      totalFamilyExpenses += amt;
      if (!t.appaSettled && t.settlementStatus !== 'settled') {
        item.pendingCount += 1;
      }
    } else if (t.type === 'repayment') {
      item.totalRepaid += amt;
      totalFamilyRepayments += amt;
      if (!item.lastSettlementDate || new Date(t.date) > new Date(item.lastSettlementDate)) {
        item.lastSettlementDate = t.date;
      }
    }
  });

  // Calculate final outstanding balance per contact
  let totalFamilyOutstanding = 0;
  Object.values(contactBalances).forEach((bal) => {
    bal.outstandingBalance = Math.max(0, bal.totalReimbursable - bal.totalRepaid);
    totalFamilyOutstanding += bal.outstandingBalance;
  });

  return {
    contactBalances,
    totalFamilyExpenses,
    totalFamilyRepayments,
    totalFamilyOutstanding,
  };
}

/**
 * Builds the WhatsApp message for an eligible family expense (Section 18).
 */
export function buildExpenseWhatsAppMessage(params: {
  contactName: string;
  description: string;
  date: string;
  amount: number;
  previousBalance: number;
  updatedBalance: number;
}): string {
  const { contactName, description, date, amount, previousBalance, updatedBalance } = params;
  return `Hi ${contactName} 👋\n\nI paid for an expense on your behalf.\n\nExpense: ${description}\nDate: ${date}\nAmount paid: ₹${amount.toLocaleString('en-IN')}\nPrevious balance: ₹${previousBalance.toLocaleString('en-IN')}\nNew expense: ₹${amount.toLocaleString('en-IN')}\nTotal amount to repay: ₹${updatedBalance.toLocaleString('en-IN')}\n\nPlease settle it when convenient.\n\n— MSR Penny`;
}

/**
 * Builds the WhatsApp message for a family repayment (Section 19).
 */
export function buildRepaymentWhatsAppMessage(params: {
  contactName: string;
  repaymentAmount: number;
  previousBalance: number;
  updatedBalance: number;
}): string {
  const { contactName, repaymentAmount, previousBalance, updatedBalance } = params;
  return `Hi ${contactName} 👋\n\nI have updated our settlement record.\n\nAmount received: ₹${repaymentAmount.toLocaleString('en-IN')}\nPrevious outstanding balance: ₹${previousBalance.toLocaleString('en-IN')}\nRemaining balance: ₹${updatedBalance.toLocaleString('en-IN')}\n\nThank you!\n\n— MSR Penny`;
}

/**
 * Generates the wa.me Click-to-Chat URL.
 */
export function generateWhatsAppUrl(phoneNumber: string | undefined | null, message: string): string {
  const encoded = encodeURIComponent(message);
  const normalized = normalizeWhatsAppNumber(phoneNumber);
  if (normalized) {
    return `https://wa.me/${normalized}?text=${encoded}`;
  }
  return `https://wa.me/?text=${encoded}`;
}
