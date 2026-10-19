import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatDateLabel } from '../utils/categoryIcons';
import { Transaction, FamilyNotificationData, FamilyContact, PaymentMethod } from '../types';
import {
  generateWhatsAppUrl,
  buildExpenseWhatsAppMessage,
} from '../utils/familyMigration';
import { normalizeWhatsAppNumber, formatPhoneNumberDisplay } from '../utils/phoneNormalizer';

interface FamilySettlementScreenProps {
  onBack: () => void;
  onOpenAddExpenseForFamily?: () => void;
  onOpenAddExpenseForAppa?: () => void; // Backward compatibility
  onShowFamilyNotification?: (data: FamilyNotificationData) => void;
  onShowAppaNotification?: (data: FamilyNotificationData) => void; // Backward compatibility
}

export const FamilySettlementScreen: React.FC<FamilySettlementScreenProps> = ({
  onBack,
  onOpenAddExpenseForFamily,
  onOpenAddExpenseForAppa,
  onShowFamilyNotification,
  onShowAppaNotification,
}) => {
  const {
    state,
    familyContacts,
    familyBalances,
    totalFamilyExpensesWaiting,
    totalFamilyRepaid,
    totalFamilyOutstanding,
    recordFamilyRepayment,
    addFamilyContact,
    updateFamilyContact,
    updateTransaction,
    migrationStatus,
  } = useApp();

  const notifyHandler = onShowFamilyNotification || onShowAppaNotification;
  const addExpenseHandler = onOpenAddExpenseForFamily || onOpenAddExpenseForAppa;

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedMemberFilter, setSelectedMemberFilter] = useState<string>('all');
  
  // Record Repayment Modal State
  const [showRepayModal, setShowRepayModal] = useState<boolean>(false);
  const [repayContactId, setRepayContactId] = useState<string>('family-appa');
  const [repayAmount, setRepayAmount] = useState<string>('200');
  const [repayMethod, setRepayMethod] = useState<PaymentMethod>('upi');
  const [repayNote, setRepayNote] = useState<string>('Settlement received');
  const [repayError, setRepayError] = useState<string | null>(null);

  // Add/Edit Contact Modal State
  const [showContactModal, setShowContactModal] = useState<boolean>(false);
  const [editingContact, setEditingContact] = useState<FamilyContact | null>(null);
  const [contactNameInput, setContactNameInput] = useState<string>('');
  const [contactPhoneInput, setContactPhoneInput] = useState<string>('');

  // Expand transactions for member
  const [expandedContactId, setExpandedContactId] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const activeContacts = familyContacts.filter((c) => c.active !== false);

  // Filter transactions
  const allReimbursableTransactions = state.transactions.filter(
    (t) => t.isFamilyReimbursable || t.isAppaReimbursable || t.type === 'repayment'
  );

  const handleOpenRecordRepayment = (contactId: string) => {
    const contactBal = familyBalances[contactId]?.outstandingBalance || 0;
    setRepayContactId(contactId);
    setRepayAmount(contactBal > 0 ? String(contactBal) : '100');
    setRepayNote(`Settlement received`);
    setRepayError(null);
    setShowRepayModal(true);
  };

  const handleSaveRepayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseInt(repayAmount, 10);
    if (!amt || amt <= 0) {
      setRepayError('Please enter an amount greater than zero.');
      return;
    }

    const targetContact = familyContacts.find((c) => c.id === repayContactId);
    const contactBal = familyBalances[repayContactId]?.outstandingBalance || 0;

    if (contactBal > 0 && amt > contactBal) {
      const confirmAdvance = window.confirm(
        `Amount ₹${amt} is greater than ${targetContact?.name || 'this member'}'s balance of ₹${contactBal}. Record as advance settlement?`
      );
      if (!confirmAdvance) return;
    }

    const res = await recordFamilyRepayment(
      repayContactId,
      amt,
      repayMethod,
      repayNote
    );

    setShowRepayModal(false);

    if (res.success && notifyHandler) {
      notifyHandler({
        type: 'repayment',
        title: repayMethod === 'cash' ? `Cash from ${res.contactName}` : `UPI from ${res.contactName}`,
        amount: amt,
        date: new Date().toISOString().split('T')[0],
        contactId: repayContactId,
        contactName: res.contactName || targetContact?.name || 'Family Member',
        phoneNumber: targetContact?.phoneNumber,
        previousBalance: res.previousBalance,
        updatedBalance: res.updatedBalance,
        paymentMethod: repayMethod,
      });
    } else if (res.success) {
      showToast(`Recorded ₹${amt} repayment from ${res.contactName}!`);
    } else {
      showToast(res.error || 'Failed to record repayment.');
    }
  };

  const handleShareSummaryWhatsApp = (contact: FamilyContact) => {
    const contactBal = familyBalances[contact.id]?.outstandingBalance || 0;
    const memberPendingExpenses = state.transactions.filter(
      (t) =>
        t.type === 'expense' &&
        (t.familyContactId === contact.id || (contact.id === 'family-appa' && !t.familyContactId && t.isAppaReimbursable)) &&
        !t.appaSettled &&
        t.settlementStatus !== 'settled'
    );

    let text = `Hi ${contact.name} 👋\n\nHere is our pending reimbursement summary:\n`;
    if (memberPendingExpenses.length > 0) {
      memberPendingExpenses.forEach((item) => {
        text += `• ${item.title}: ₹${item.amount.toLocaleString('en-IN')}\n`;
      });
    }
    text += `\nTotal amount to settle: ₹${contactBal.toLocaleString('en-IN')}\n\nPlease settle when convenient.\n\n— MSR Penny`;

    const cleanPhone = normalizeWhatsAppNumber(contact.phoneNumber);
    const url = generateWhatsAppUrl(cleanPhone, text);
    window.open(url, '_blank');
  };

  const handleCopySummary = (contact: FamilyContact) => {
    const contactBal = familyBalances[contact.id]?.outstandingBalance || 0;
    const memberPendingExpenses = state.transactions.filter(
      (t) =>
        t.type === 'expense' &&
        (t.familyContactId === contact.id || (contact.id === 'family-appa' && !t.familyContactId && t.isAppaReimbursable)) &&
        !t.appaSettled &&
        t.settlementStatus !== 'settled'
    );

    let text = `Hi ${contact.name} 👋\n\nHere is our pending reimbursement summary:\n`;
    if (memberPendingExpenses.length > 0) {
      memberPendingExpenses.forEach((item) => {
        text += `• ${item.title}: ₹${item.amount.toLocaleString('en-IN')}\n`;
      });
    }
    text += `\nTotal amount to settle: ₹${contactBal.toLocaleString('en-IN')}\n\nPlease settle when convenient.\n\n— MSR Penny`;

    navigator.clipboard?.writeText(text).catch(() => {});
    showToast(`Summary for ${contact.name} copied!`);
  };

  const handleSaveContact = async () => {
    if (!contactNameInput.trim()) return;

    if (editingContact) {
      await updateFamilyContact({
        ...editingContact,
        name: contactNameInput.trim(),
        phoneNumber: contactPhoneInput.trim(),
      });
      showToast(`${contactNameInput} updated!`);
    } else {
      await addFamilyContact(contactNameInput.trim(), contactPhoneInput.trim());
      showToast(`${contactNameInput} added to family settlements!`);
    }
    setShowContactModal(false);
  };

  const handleMarkItemSettled = async (tx: Transaction) => {
    await updateTransaction({
      ...tx,
      appaSettled: true,
      settlementStatus: 'settled',
    });
    showToast(`Marked "${tx.title}" as settled!`);
  };

  return (
    <div className="flex flex-col w-full gap-4 pb-28">
      {/* Top Relationship Context Pill */}
      <div className="flex items-center justify-between bg-[#eff3ff] px-4 py-2.5 rounded-xl border border-[#dfe9fc]/60">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[#d9e3f6] flex items-center justify-center text-[#006948]">
            <span className="material-symbols-outlined text-[18px]">family_restroom</span>
          </div>
          <div>
            <span className="text-[12px] font-semibold text-[#121c2a]">Family Settlements</span>
            <p className="text-[11px] text-[#3e4942]">Single-user private offline tracking</p>
          </div>
        </div>

        <button
          onClick={() => {
            setEditingContact(null);
            setContactNameInput('');
            setContactPhoneInput('');
            setShowContactModal(true);
          }}
          className="text-[11px] bg-[#006948] hover:bg-[#00855d] text-white px-2.5 py-1 rounded-full font-semibold flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
        >
          <span className="material-symbols-outlined text-[14px]">person_add</span>
          <span>Add Member</span>
        </button>
      </div>

      {/* Migration Notice Pill if records were migrated */}
      {migrationStatus.needsReviewCount > 0 && (
        <div className="bg-[#fff8e1] border border-[#ffe082] rounded-xl p-3 flex items-center justify-between text-[11px] text-[#8d6e63]">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#f57f17] text-[18px]">flag</span>
            <span>
              {migrationStatus.needsReviewCount} legacy repayment record(s) flagged for manual review.
            </span>
          </div>
        </div>
      )}

      {/* Hero Summary Card: Total Family Outstanding */}
      <div className="relative overflow-hidden bg-white rounded-2xl p-5 shadow-sm border border-[#dfe9fc]/70">
        <div className="absolute -right-6 -bottom-6 w-32 h-32 rounded-full bg-[#006948]/5 pointer-events-none" />
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] text-[#3e4942] uppercase tracking-wider font-semibold">
            Total Family Owes Me
          </span>
          <span className="inline-flex items-center gap-1 bg-[#006948]/10 text-[#006948] px-2.5 py-0.5 rounded-full text-[10px] font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-[#006948]" />
            All Members Combined
          </span>
        </div>

        <div className="flex items-baseline gap-1 my-1">
          <span className="text-[36px] font-bold text-[#121c2a] tracking-tight tabular-nums">
            ₹{totalFamilyOutstanding.toLocaleString('en-IN')}
          </span>
          <span className="text-[12px] text-[#3e4942]">outstanding</span>
        </div>

        <div className="mt-3 pt-2 flex items-center justify-between bg-[#eff3ff]/70 px-3.5 py-2.5 rounded-xl border border-[#dfe9fc]/50">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#006948] text-[18px]">verified</span>
            <span className="text-[12px] text-[#121c2a]">
              {activeContacts.length} active family contacts configured
            </span>
          </div>
          {addExpenseHandler && (
            <button
              onClick={addExpenseHandler}
              className="flex items-center gap-1 text-[11px] bg-[#006948] hover:bg-[#00855d] text-white px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[15px]">add</span>
              <span>Claim Expense</span>
            </button>
          )}
        </div>
      </div>

      {/* 3 Metric Breakdown Row */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white p-3 rounded-xl flex flex-col shadow-xs border border-[#dfe9fc]/50">
          <div className="flex items-center gap-1 text-[#3e4942] mb-1">
            <span className="material-symbols-outlined text-[15px]">arrow_outward</span>
            <span className="text-[10px] font-medium">Total Paid</span>
          </div>
          <span className="text-[17px] font-bold text-[#121c2a] tabular-nums">
            ₹{totalFamilyExpensesWaiting.toLocaleString('en-IN')}
          </span>
          <span className="text-[10px] text-[#3e4942] mt-0.5">Family expenses</span>
        </div>

        <div className="bg-white p-3 rounded-xl flex flex-col shadow-xs border border-[#dfe9fc]/50">
          <div className="flex items-center gap-1 text-[#006948] mb-1">
            <span className="material-symbols-outlined text-[15px]">arrow_downward</span>
            <span className="text-[10px] font-medium">Repaid</span>
          </div>
          <span className="text-[17px] font-bold text-[#006948] tabular-nums">
            ₹{totalFamilyRepaid.toLocaleString('en-IN')}
          </span>
          <span className="text-[10px] text-[#3e4942] mt-0.5">Received back</span>
        </div>

        <div className="bg-[#dfe9fc] p-3 rounded-xl flex flex-col shadow-xs border border-[#bdcac0]/40">
          <div className="flex items-center gap-1 text-[#894d00] mb-1">
            <span className="material-symbols-outlined text-[15px]">hourglass_top</span>
            <span className="text-[10px] font-medium">Remaining</span>
          </div>
          <span className="text-[17px] font-bold text-[#894d00] tabular-nums">
            ₹{totalFamilyOutstanding.toLocaleString('en-IN')}
          </span>
          <span className="text-[10px] text-[#894d00] font-semibold mt-0.5">Balance</span>
        </div>
      </div>

      {/* Member Filter Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        <button
          onClick={() => setSelectedMemberFilter('all')}
          className={`px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all cursor-pointer ${
            selectedMemberFilter === 'all'
              ? 'bg-[#006948] text-white shadow-xs'
              : 'bg-[#eff3ff] text-[#3e4942] hover:bg-[#dfe9fc]'
          }`}
        >
          All Members ({activeContacts.length})
        </button>
        {activeContacts.map((c) => {
          const bal = familyBalances[c.id]?.outstandingBalance || 0;
          return (
            <button
              key={c.id}
              onClick={() => setSelectedMemberFilter(c.id)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1 ${
                selectedMemberFilter === c.id
                  ? 'bg-[#006948] text-white shadow-xs'
                  : 'bg-[#eff3ff] text-[#3e4942] hover:bg-[#dfe9fc]'
              }`}
            >
              <span>{c.name}</span>
              <span className="text-[10px] opacity-80">(₹{bal})</span>
            </button>
          );
        })}
      </div>

      {/* Family Member Cards List */}
      <div className="space-y-3">
        {activeContacts
          .filter((c) => selectedMemberFilter === 'all' || selectedMemberFilter === c.id)
          .map((contact) => {
            const bal = familyBalances[contact.id] || {
              contact,
              totalReimbursable: 0,
              totalRepaid: 0,
              outstandingBalance: 0,
              pendingCount: 0,
            };

            const isExpanded = expandedContactId === contact.id;

            const memberTransactions = allReimbursableTransactions.filter((t) => {
              if (t.familyContactId === contact.id) return true;
              if (contact.id === 'family-appa' && !t.familyContactId && (t.isAppaReimbursable || t.type === 'repayment')) {
                return true;
              }
              return false;
            });

            return (
              <div
                key={contact.id}
                className="bg-white rounded-2xl p-4 shadow-sm border border-[#dfe9fc]/60 space-y-3 hover:border-[#006948]/30 transition-all"
              >
                {/* Member Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#006948]/10 text-[#006948] font-bold text-[16px] flex items-center justify-center">
                      {contact.name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-[15px] font-bold text-[#121c2a]">{contact.name}</h3>
                        <span
                          className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                            bal.outstandingBalance > 0
                              ? 'bg-[#fed7aa] text-[#9a3412]'
                              : 'bg-[#88f8c4]/40 text-[#006948]'
                          }`}
                        >
                          {bal.outstandingBalance > 0 ? 'Pending' : 'Settled'}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#3e4942]">
                        {formatPhoneNumberDisplay(contact.phoneNumber)}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-[#3e4942] block font-medium">Balance</span>
                    <span className="text-[20px] font-bold text-[#006948] tabular-nums">
                      ₹{bal.outstandingBalance.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                {/* Sub-Metrics Row */}
                <div className="grid grid-cols-3 gap-2 bg-[#f8f9ff] p-2.5 rounded-xl border border-[#dfe9fc]/40 text-[11px]">
                  <div>
                    <span className="text-[#3e4942] block">I Paid</span>
                    <strong className="text-[#121c2a]">₹{bal.totalReimbursable.toLocaleString('en-IN')}</strong>
                  </div>
                  <div>
                    <span className="text-[#3e4942] block">Repaid</span>
                    <strong className="text-[#006948]">₹{bal.totalRepaid.toLocaleString('en-IN')}</strong>
                  </div>
                  <div>
                    <span className="text-[#3e4942] block">Pending</span>
                    <strong className="text-[#894d00]">{bal.pendingCount} items</strong>
                  </div>
                </div>

                {/* Member Action Buttons */}
                <div className="flex items-center gap-2 pt-1 border-t border-[#dfe9fc]/50">
                  <button
                    type="button"
                    onClick={() => handleOpenRecordRepayment(contact.id)}
                    className="flex-1 py-2 rounded-xl bg-[#006948] hover:bg-[#00855d] text-white text-[12px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs active:scale-98 transition-all"
                  >
                    <span className="material-symbols-outlined text-[16px]">payments</span>
                    <span>Record Repayment</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleShareSummaryWhatsApp(contact)}
                    title={`Send WhatsApp message to ${contact.name}`}
                    className="h-9 px-3 rounded-xl bg-[#eff3ff] hover:bg-[#dfe9fc] text-[#006948] text-[12px] font-semibold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">chat</span>
                    <span>WhatsApp</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCopySummary(contact)}
                    title="Copy settlement summary"
                    className="h-9 w-9 rounded-xl bg-[#eff3ff] hover:bg-[#dfe9fc] text-[#3e4942] flex items-center justify-center cursor-pointer transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">content_copy</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setExpandedContactId(isExpanded ? null : contact.id)}
                    className="h-9 px-2.5 rounded-xl border border-[#dfe9fc] text-[#3e4942] hover:bg-[#eff3ff] text-[11px] font-semibold flex items-center gap-0.5 cursor-pointer"
                  >
                    <span>{isExpanded ? 'Hide' : 'History'}</span>
                    <span className="material-symbols-outlined text-[14px]">
                      {isExpanded ? 'expand_less' : 'expand_more'}
                    </span>
                  </button>
                </div>

                {/* Expanded Member Transactions Accordion */}
                {isExpanded && (
                  <div className="space-y-2 pt-2 border-t border-[#dfe9fc]/60">
                    <span className="text-[11px] font-semibold text-[#3e4942] uppercase tracking-wider block">
                      Settlement History for {contact.name} ({memberTransactions.length} records)
                    </span>

                    <div className="divide-y divide-[#dfe9fc]/60 max-h-56 overflow-y-auto">
                      {memberTransactions.map((tx) => {
                        const isRepay = tx.type === 'repayment';
                        const isSettled = tx.appaSettled || tx.settlementStatus === 'settled';
                        return (
                          <div key={tx.id} className="py-2 flex items-center justify-between text-[12px]">
                            <div className="min-w-0 pr-2">
                              <p className="font-semibold text-[#121c2a] truncate">{tx.title}</p>
                              <span className="text-[10px] text-[#3e4942]">
                                {formatDateLabel(tx.date)} • {isRepay ? 'Repayment received' : 'Expense paid'}
                              </span>
                            </div>

                            <div className="text-right shrink-0 flex items-center gap-2">
                              <span
                                className={`font-bold tabular-nums ${
                                  isRepay ? 'text-[#006948]' : 'text-[#121c2a]'
                                }`}
                              >
                                {isRepay ? `+ ₹${tx.amount}` : `₹${tx.amount}`}
                              </span>

                              {!isRepay && !isSettled && (
                                <button
                                  type="button"
                                  onClick={() => handleMarkItemSettled(tx)}
                                  className="text-[10px] bg-[#dfe9fc] hover:bg-[#006948] hover:text-white text-[#121c2a] px-2 py-0.5 rounded-full font-medium transition-colors cursor-pointer"
                                  title="Mark as settled"
                                >
                                  Settle
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {memberTransactions.length === 0 && (
                        <p className="text-[11px] text-[#6d7a72] py-2 text-center">
                          No transactions recorded for {contact.name} yet.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
      </div>

      {/* Record Repayment Modal */}
      {showRepayModal && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#dfe9fc]/60 pb-2">
              <h3 className="text-[16px] font-bold text-[#121c2a]">Record Repayment</h3>
              <button
                type="button"
                onClick={() => setShowRepayModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#3e4942] hover:bg-[#eff3ff]"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveRepayment} className="space-y-3.5">
              {/* Member Selector */}
              <div>
                <label className="text-[11px] font-semibold text-[#3e4942] uppercase tracking-wider block mb-1">
                  Received from
                </label>
                <select
                  value={repayContactId}
                  onChange={(e) => {
                    const cId = e.target.value;
                    setRepayContactId(cId);
                    const bal = familyBalances[cId]?.outstandingBalance || 0;
                    setRepayAmount(bal > 0 ? String(bal) : '100');
                  }}
                  className="w-full px-3 py-2 bg-[#f8f9ff] border border-[#dfe9fc] rounded-xl text-[13px] text-[#121c2a] focus:outline-none focus:border-[#006948]"
                >
                  {activeContacts.map((c) => {
                    const bal = familyBalances[c.id]?.outstandingBalance || 0;
                    return (
                      <option key={c.id} value={c.id}>
                        {c.name} (Owes ₹{bal})
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Amount */}
              <div>
                <label className="text-[11px] font-semibold text-[#3e4942] uppercase tracking-wider block mb-1">
                  Amount Received (₹)
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-[20px] font-bold text-[#121c2a]">₹</span>
                  <input
                    type="number"
                    value={repayAmount}
                    onChange={(e) => setRepayAmount(e.target.value)}
                    className="flex-1 px-3 py-2 bg-[#f8f9ff] border border-[#dfe9fc] rounded-xl text-[16px] font-bold text-[#121c2a] focus:outline-none focus:border-[#006948] tabular-nums"
                  />
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <label className="text-[11px] font-semibold text-[#3e4942] uppercase tracking-wider block mb-1">
                  Payment Method
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRepayMethod('upi')}
                    className={`py-2 rounded-xl text-[12px] font-semibold border transition-all cursor-pointer ${
                      repayMethod === 'upi'
                        ? 'bg-[#006948] text-white border-[#006948]'
                        : 'bg-[#f8f9ff] border-[#dfe9fc] text-[#3e4942]'
                    }`}
                  >
                    UPI / Bank
                  </button>
                  <button
                    type="button"
                    onClick={() => setRepayMethod('cash')}
                    className={`py-2 rounded-xl text-[12px] font-semibold border transition-all cursor-pointer ${
                      repayMethod === 'cash'
                        ? 'bg-[#006948] text-white border-[#006948]'
                        : 'bg-[#f8f9ff] border-[#dfe9fc] text-[#3e4942]'
                    }`}
                  >
                    Cash
                  </button>
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="text-[11px] font-semibold text-[#3e4942] uppercase tracking-wider block mb-1">
                  Reference / Note
                </label>
                <input
                  type="text"
                  value={repayNote}
                  onChange={(e) => setRepayNote(e.target.value)}
                  placeholder="e.g. Handover morning settlement"
                  className="w-full px-3 py-2 bg-[#f8f9ff] border border-[#dfe9fc] rounded-xl text-[13px] text-[#121c2a] focus:outline-none focus:border-[#006948]"
                />
              </div>

              {repayError && (
                <p className="text-[11px] text-[#ba1a1a] font-medium">{repayError}</p>
              )}

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowRepayModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-[#dfe9fc] text-[12px] font-semibold text-[#3e4942] hover:bg-[#eff3ff]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-[#006948] hover:bg-[#00855d] text-white text-[12px] font-semibold shadow-xs"
                >
                  Save Repayment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Family Member Modal */}
      {showContactModal && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#dfe9fc]/60 pb-2">
              <h3 className="text-[16px] font-bold text-[#121c2a]">
                {editingContact ? 'Edit Family Contact' : 'Add Family Member'}
              </h3>
              <button
                type="button"
                onClick={() => setShowContactModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#3e4942] hover:bg-[#eff3ff]"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-[#3e4942] uppercase tracking-wider block mb-1">
                  Name / Relationship
                </label>
                <input
                  type="text"
                  value={contactNameInput}
                  onChange={(e) => setContactNameInput(e.target.value)}
                  placeholder="e.g. Amma, Akka, Uncle"
                  className="w-full px-3 py-2 bg-[#f8f9ff] border border-[#dfe9fc] rounded-xl text-[13px] text-[#121c2a] focus:outline-none focus:border-[#006948]"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#3e4942] uppercase tracking-wider block mb-1">
                  WhatsApp Phone Number (with Country Code)
                </label>
                <input
                  type="tel"
                  value={contactPhoneInput}
                  onChange={(e) => setContactPhoneInput(e.target.value)}
                  placeholder="+919876543210"
                  className="w-full px-3 py-2 bg-[#f8f9ff] border border-[#dfe9fc] rounded-xl text-[13px] text-[#121c2a] focus:outline-none focus:border-[#006948]"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowContactModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-[#dfe9fc] text-[12px] font-semibold text-[#3e4942] hover:bg-[#eff3ff]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveContact}
                  className="flex-1 py-2.5 rounded-xl bg-[#006948] hover:bg-[#00855d] text-white text-[12px] font-semibold shadow-xs"
                >
                  {editingContact ? 'Update Contact' : 'Save Member'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-[#121c2a] text-white text-[12px] px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 animate-fade-in">
          <span className="material-symbols-outlined text-[16px] text-[#88f8c4]">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};

// Backwards compatibility export
export const AppaSettlementScreen = FamilySettlementScreen;
