import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Transaction, TransactionCategory, PaymentMethod } from '../types';
import { getTransactionIcon, formatDateLabel } from '../utils/categoryIcons';

interface TransactionDetailModalProps {
  transaction: Transaction | null;
  onClose: () => void;
}

export const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({
  transaction,
  onClose,
}) => {
  const { updateTransaction, deleteTransaction } = useApp();

  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(transaction?.title || '');
  const [amountStr, setAmountStr] = useState(String(transaction?.amount || 0));
  const [category, setCategory] = useState<TransactionCategory>(transaction?.category || 'Other');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(transaction?.paymentMethod || 'upi');
  const [isAppaReimbursable, setIsAppaReimbursable] = useState(transaction?.isAppaReimbursable || false);
  const [notes, setNotes] = useState(transaction?.notes || '');

  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  if (!transaction) return null;

  const visual = getTransactionIcon(transaction);

  const handleCopyId = () => {
    if (transaction?.id) {
      navigator.clipboard?.writeText(transaction.id).catch(() => {});
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const isReimbursable = Boolean(transaction.isFamilyReimbursable || transaction.isAppaReimbursable);
  const memberName = transaction.familyContactName || (transaction.isAppaReimbursable ? 'Appa' : 'Family');
  const settlementStatus = transaction.settlementStatus || (transaction.appaSettled ? 'settled' : 'pending');

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseInt(amountStr, 10);
    if (!amount || amount <= 0 || !title.trim()) return;

    await updateTransaction({
      ...transaction,
      title: title.trim(),
      amount,
      category,
      paymentMethod,
      isAppaReimbursable,
      notes: notes.trim(),
    });

    setIsEditing(false);
    onClose();
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const success = await deleteTransaction(transaction.id);
      setIsDeleting(false);
      if (success) {
        onClose();
      } else {
        setDeleteError('Failed to delete transaction from Google Sheets. Record preserved.');
      }
    } catch (err: any) {
      setIsDeleting(false);
      setDeleteError(err.message || 'Error communicating with Google Sheets. Record preserved.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl p-5 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl ${visual.bgClass} flex items-center justify-center shrink-0`}>
              <span className={`material-symbols-outlined text-[20px] ${visual.textClass}`}>
                {visual.icon}
              </span>
            </div>
            <div>
              <h3 className="text-[16px] font-bold text-[#121c2a]">
                {isEditing ? 'Edit Transaction' : 'Transaction Details'}
              </h3>
              <p className="text-[11px] text-[#3e4942]">{formatDateLabel(transaction.date)}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-[#3e4942] hover:bg-[#eff3ff]"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* View Mode */}
        {!isEditing ? (
          <div className="space-y-3">
            <div className="bg-[#eff3ff]/70 p-3.5 rounded-xl border border-[#dfe9fc]/60 text-center">
              <span className="text-[11px] text-[#3e4942] uppercase tracking-wider block font-medium">
                {transaction.type === 'expense'
                  ? 'Expense Amount'
                  : transaction.type === 'income'
                  ? 'Income Inflow'
                  : 'Family Settlement'}
              </span>
              <p className="text-[28px] font-bold text-[#121c2a] tabular-nums mt-0.5">
                {transaction.type === 'expense' ? `- ₹${transaction.amount}` : `+ ₹${transaction.amount}`}
              </p>
              <p className="text-[12px] text-[#121c2a] font-semibold mt-1">{transaction.title}</p>
            </div>

            <div className="space-y-2 text-[12px]">
              {/* Transaction ID */}
              <div className="flex justify-between items-center py-1 border-b border-[#dfe9fc]/40">
                <span className="text-[#3e4942]">Transaction ID</span>
                <button
                  type="button"
                  onClick={handleCopyId}
                  title="Click to copy ID"
                  className="flex items-center gap-1 font-mono text-[11px] bg-[#eff3ff] hover:bg-[#dfe9fc] text-[#121c2a] px-2 py-0.5 rounded border border-[#dfe9fc] font-semibold transition-colors cursor-pointer"
                >
                  <span className="truncate max-w-[170px]">{transaction.id}</span>
                  <span className="material-symbols-outlined text-[13px] text-[#006948]">
                    {copiedId ? 'check' : 'content_copy'}
                  </span>
                </button>
              </div>

              <div className="flex justify-between py-1 border-b border-[#dfe9fc]/40">
                <span className="text-[#3e4942]">Category</span>
                <span className="font-semibold text-[#121c2a]">{transaction.category}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-[#dfe9fc]/40">
                <span className="text-[#3e4942]">Payment Method</span>
                <span className="font-semibold text-[#121c2a] uppercase">{transaction.paymentMethod}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-[#dfe9fc]/40">
                <span className="text-[#3e4942]">Family Settlement</span>
                <span className={`font-semibold ${isReimbursable ? 'text-[#894d00]' : 'text-[#3e4942]'}`}>
                  {isReimbursable
                    ? `Claimed to ${memberName} (${settlementStatus === 'settled' ? 'Settled' : 'Pending'})`
                    : 'Personal'}
                </span>
              </div>

              {transaction.notes && (
                <div className="flex justify-between py-1 border-b border-[#dfe9fc]/40">
                  <span className="text-[#3e4942]">Notes</span>
                  <span className="font-medium text-[#121c2a] text-right">{transaction.notes}</span>
                </div>
              )}
            </div>

            {isConfirmingDelete ? (
              <div className="pt-2 p-3 bg-[#ffdad6]/25 border border-[#ba1a1a]/20 rounded-xl space-y-2.5">
                <div className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-[18px] text-[#ba1a1a] shrink-0 mt-0.5">warning</span>
                  <div>
                    <p className="text-[12px] font-bold text-[#ba1a1a]">
                      Delete this transaction?
                    </p>
                    <p className="text-[11px] text-[#3e4942]">
                      This permanently deletes the record from MSR Penny and your linked Google Sheet.
                    </p>
                  </div>
                </div>

                {deleteError && (
                  <div className="p-2 bg-white rounded-lg border border-[#ba1a1a]/30 text-[11px] text-[#ba1a1a] font-medium">
                    ⚠️ {deleteError}
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    disabled={isDeleting}
                    onClick={() => {
                      setIsConfirmingDelete(false);
                      setDeleteError(null);
                    }}
                    className="flex-1 py-2 rounded-lg border border-[#dfe9fc] text-[12px] font-semibold text-[#3e4942] hover:bg-[#eff3ff] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={isDeleting}
                    onClick={handleConfirmDelete}
                    className="flex-1 py-2 rounded-lg bg-[#ba1a1a] hover:bg-[#93000a] text-white text-[12px] font-semibold shadow-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-60"
                  >
                    {isDeleting ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Deleting...</span>
                      </>
                    ) : (
                      'Yes, Delete'
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="pt-2 flex gap-2">
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex-1 py-2.5 rounded-xl bg-[#006948] hover:bg-[#00855d] text-white text-[13px] font-semibold shadow-xs transition-colors"
                >
                  Edit
                </button>

                <button
                  onClick={() => {
                    setIsConfirmingDelete(true);
                    setDeleteError(null);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-[#ffdad6] hover:bg-[#ffdad6]/80 text-[#ba1a1a] text-[13px] font-semibold transition-colors"
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Edit Mode Form */
          <form onSubmit={handleSaveEdit} className="space-y-3">
            <div>
              <label className="text-[11px] font-semibold text-[#3e4942] uppercase tracking-wider block mb-1">
                Title / Description
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full px-3 py-2 bg-[#f8f9ff] border border-[#dfe9fc] rounded-xl text-[13px] text-[#121c2a] focus:outline-none focus:border-[#006948]"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-[#3e4942] uppercase tracking-wider block mb-1">
                Amount (₹)
              </label>
              <input
                type="number"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                required
                className="w-full px-3 py-2 bg-[#f8f9ff] border border-[#dfe9fc] rounded-xl text-[16px] font-bold text-[#121c2a] focus:outline-none focus:border-[#006948]"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-semibold text-[#3e4942] uppercase tracking-wider block mb-1">
                  Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full px-2 py-2 bg-[#f8f9ff] border border-[#dfe9fc] rounded-xl text-[12px] text-[#121c2a]"
                >
                  <option value="upi">UPI / Bank</option>
                  <option value="cash">Cash</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#3e4942] uppercase tracking-wider block mb-1">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as TransactionCategory)}
                  className="w-full px-2 py-2 bg-[#f8f9ff] border border-[#dfe9fc] rounded-xl text-[12px] text-[#121c2a]"
                >
                  <option value="Food">Food</option>
                  <option value="Travel">Travel</option>
                  <option value="College">College</option>
                  <option value="Shopping">Shopping</option>
                  <option value="Freelance">Freelance</option>
                  <option value="Academics">Academics</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            {transaction.type === 'expense' && (
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="edit-appa-claim"
                  checked={isAppaReimbursable}
                  onChange={(e) => setIsAppaReimbursable(e.target.checked)}
                  className="w-4 h-4 accent-[#006948]"
                />
                <label htmlFor="edit-appa-claim" className="text-[12px] text-[#121c2a] font-medium cursor-pointer">
                  Claim to Appa (Reimbursable)
                </label>
              </div>
            )}

            <div>
              <label className="text-[11px] font-semibold text-[#3e4942] uppercase tracking-wider block mb-1">
                Notes
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes"
                className="w-full px-3 py-2 bg-[#f8f9ff] border border-[#dfe9fc] rounded-xl text-[12px] text-[#121c2a] focus:outline-none focus:border-[#006948]"
              />
            </div>

            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="flex-1 py-2.5 rounded-xl border border-[#dfe9fc] text-[13px] font-semibold text-[#3e4942]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl bg-[#006948] hover:bg-[#00855d] text-white text-[13px] font-semibold shadow-xs"
              >
                Save Changes
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
