import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatDateLabel } from '../utils/categoryIcons';
import { Transaction, AppaNotificationData } from '../types';

interface AppaSettlementScreenProps {
  onBack: () => void;
  onOpenAddExpenseForAppa: () => void;
  onShowAppaNotification?: (data: AppaNotificationData) => void;
}

export const AppaSettlementScreen: React.FC<AppaSettlementScreenProps> = ({
  onBack,
  onOpenAddExpenseForAppa,
  onShowAppaNotification,
}) => {
  const { state, totalAppaPaidByMe, totalAppaRepaid, appaOwesMe, addTransaction, updateTransaction } = useApp();

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showRecordModal, setShowRecordModal] = useState<boolean>(false);
  const [repayAmount, setRepayAmount] = useState<string>(String(appaOwesMe || 200));
  const [repayMethod, setRepayMethod] = useState<'cash' | 'upi'>('cash');
  const [repayNote, setRepayNote] = useState<string>('Handover morning');

  const pendingExpenses = state.transactions.filter(
    (t) => t.isAppaReimbursable && !t.appaSettled
  );

  const recentRepayments = state.transactions.filter(
    (t) => t.type === 'repayment'
  );

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  };

  const generateSummaryText = () => {
    let text = `Hi Appa 👋\n\nHere is the pending reimbursement summary:\n`;
    pendingExpenses.forEach((item) => {
      text += `• ${item.title}: ₹${item.amount}\n`;
    });
    text += `\nTotal pending: ₹${appaOwesMe}\n(Previous payments received: ₹${totalAppaRepaid})\n\n— MSR Penny`;
    return text;
  };

  const handleCopySummary = () => {
    const summary = generateSummaryText();
    navigator.clipboard?.writeText(summary).catch(() => {});
    showToast('Summary copied for WhatsApp!');
  };

  const handleShareWhatsApp = () => {
    const summary = generateSummaryText();
    const encoded = encodeURIComponent(summary);
    const cleanPhone = (state.settings.appaPhoneNumber || '').replace(/[^0-9]/g, '');
    const url = cleanPhone.length >= 10 ? `https://wa.me/${cleanPhone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
    window.open(url, '_blank');
  };

  const handleRecordRepayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseInt(repayAmount, 10);
    if (!amount || amount <= 0) return;

    const res = await addTransaction({
      type: 'repayment',
      title: repayMethod === 'cash' ? 'Cash from Appa' : 'UPI from Appa',
      amount,
      category: 'Family',
      date: new Date().toISOString().split('T')[0],
      paymentMethod: repayMethod,
      isAppaReimbursable: false,
      appaSettled: true,
      notes: repayNote || 'Settlement received',
    });

    setShowRecordModal(false);

    if (res.success && onShowAppaNotification) {
      onShowAppaNotification({
        type: 'repayment',
        title: repayMethod === 'cash' ? 'Cash from Appa' : 'UPI from Appa',
        amount,
        date: new Date().toISOString().split('T')[0],
        previousBalance: res.previousBalance,
        updatedBalance: res.updatedBalance,
        paymentMethod: repayMethod,
      });
    } else if (res.success) {
      showToast(`Recorded ₹${amount} repayment from Appa!`);
    } else {
      showToast(res.error || 'Failed to record repayment.');
    }
  };

  const handleMarkItemSettled = async (tx: Transaction) => {
    await updateTransaction({
      ...tx,
      appaSettled: true,
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
            <span className="text-[12px] font-semibold text-[#121c2a]">Family Reimbursement</span>
            <p className="text-[11px] text-[#3e4942]">Personal ledger (offline tracking)</p>
          </div>
        </div>
        <span className="text-[10px] bg-[#006948]/10 text-[#006948] px-2.5 py-1 rounded-full uppercase tracking-wider font-semibold">
          Active
        </span>
      </div>

      {/* Hero Card: Total to Receive */}
      <div className="relative overflow-hidden bg-white rounded-xl p-5 shadow-sm border border-[#dfe9fc]/60">
        <div className="absolute -right-6 -bottom-6 w-32 h-32 rounded-full bg-[#006948]/5 pointer-events-none" />
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] text-[#3e4942] uppercase tracking-wider font-semibold">
            Total to Receive
          </span>
          <span className="inline-flex items-center gap-1 bg-[#006948]/10 text-[#006948] px-2.5 py-0.5 rounded-full text-[10px] font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-[#006948]" />
            Pending Appa
          </span>
        </div>

        <div className="flex items-baseline gap-1 my-1">
          <span className="text-[36px] font-bold text-[#121c2a] tracking-tight tabular-nums">
            ₹{appaOwesMe.toLocaleString('en-IN')}
          </span>
          <span className="text-[12px] text-[#3e4942]">due</span>
        </div>

        <div className="mt-3 pt-2 flex items-center justify-between bg-[#eff3ff]/70 px-3.5 py-2 rounded-lg border border-[#dfe9fc]/50">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#006948] text-[18px]">verified</span>
            <span className="text-[12px] text-[#121c2a]">
              {pendingExpenses.length} shared items awaiting settlement
            </span>
          </div>
          <button
            onClick={handleShareWhatsApp}
            className="flex items-center gap-1 text-[11px] text-[#006948] hover:text-[#00855d] font-semibold transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">share</span>
            <span>Share</span>
          </button>
        </div>
      </div>

      {/* 3 Metric Breakdown Row */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white p-3 rounded-xl flex flex-col shadow-xs border border-[#dfe9fc]/50">
          <div className="flex items-center gap-1 text-[#3e4942] mb-1">
            <span className="material-symbols-outlined text-[15px]">arrow_outward</span>
            <span className="text-[10px] font-medium">I Paid</span>
          </div>
          <span className="text-[17px] font-bold text-[#121c2a] tabular-nums">
            ₹{totalAppaPaidByMe.toLocaleString('en-IN')}
          </span>
          <span className="text-[10px] text-[#3e4942] mt-0.5">{pendingExpenses.length} items</span>
        </div>

        <div className="bg-white p-3 rounded-xl flex flex-col shadow-xs border border-[#dfe9fc]/50">
          <div className="flex items-center gap-1 text-[#006948] mb-1">
            <span className="material-symbols-outlined text-[15px]">arrow_downward</span>
            <span className="text-[10px] font-medium">Appa Paid</span>
          </div>
          <span className="text-[17px] font-bold text-[#006948] tabular-nums">
            ₹{totalAppaRepaid.toLocaleString('en-IN')}
          </span>
          <span className="text-[10px] text-[#3e4942] mt-0.5">{recentRepayments.length} transfers</span>
        </div>

        <div className="bg-[#dfe9fc] p-3 rounded-xl flex flex-col shadow-xs border border-[#bdcac0]/40">
          <div className="flex items-center gap-1 text-[#894d00] mb-1">
            <span className="material-symbols-outlined text-[15px]">hourglass_top</span>
            <span className="text-[10px] font-medium">Remaining</span>
          </div>
          <span className="text-[17px] font-bold text-[#894d00] tabular-nums">
            ₹{appaOwesMe.toLocaleString('en-IN')}
          </span>
          <span className="text-[10px] text-[#894d00] font-semibold mt-0.5">Balance</span>
        </div>
      </div>

      {/* Quick Action Drawer Trigger */}
      <div className="flex gap-2 items-center">
        <button
          onClick={() => {
            setRepayAmount(String(appaOwesMe || 200));
            setShowRecordModal(true);
          }}
          className="flex-1 bg-[#006948] hover:bg-[#00855d] active:scale-[0.98] text-white h-12 rounded-xl text-[14px] font-semibold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
        >
          <span className="material-symbols-outlined text-[20px]">add_circle</span>
          <span>Record Payment</span>
        </button>

        <button
          onClick={handleCopySummary}
          title="Copy summary for WhatsApp"
          className="bg-white text-[#121c2a] hover:bg-[#eff3ff] px-4 h-12 rounded-xl text-[12px] font-semibold flex items-center gap-1.5 shadow-xs border border-[#dfe9fc]/60 transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px] text-[#006948]">content_copy</span>
          <span>Copy</span>
        </button>

        <button
          onClick={onOpenAddExpenseForAppa}
          title="Add new expense claimed to Appa"
          className="bg-white text-[#894d00] hover:bg-[#ffdcc0]/20 px-3 h-12 rounded-xl text-[12px] font-semibold flex items-center gap-1 shadow-xs border border-[#ffdcc0]/80 transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          <span>Claim</span>
        </button>
      </div>

      {/* Pending Expenses Section */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-[18px] text-[#121c2a] font-semibold">Pending Expenses</h2>
          <span className="text-[11px] text-[#3e4942] font-medium">
            {pendingExpenses.length} uncollected
          </span>
        </div>

        <div className="flex flex-col gap-2">
          {pendingExpenses.map((item) => (
            <div
              key={item.id}
              className="bg-white p-3.5 rounded-xl flex items-center justify-between shadow-xs border border-[#dfe9fc]/50 hover:bg-[#eff3ff]/40 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-[#eff3ff] flex items-center justify-center text-[#3e4942] shrink-0">
                  <span className="material-symbols-outlined text-[20px]">
                    {item.title.toLowerCase().includes('bus')
                      ? 'directions_bus'
                      : item.title.toLowerCase().includes('train')
                      ? 'train'
                      : item.title.toLowerCase().includes('print')
                      ? 'print'
                      : 'receipt'}
                  </span>
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[14px] font-semibold text-[#121c2a] truncate">
                    {item.title}
                  </span>
                  <span className="text-[12px] text-[#3e4942] truncate">
                    {formatDateLabel(item.date)} • {item.notes || 'Reimbursable expense'}
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-end gap-1 shrink-0 pl-2">
                <span className="text-[17px] font-bold text-[#121c2a] tabular-nums">
                  ₹{item.amount}
                </span>
                <button
                  type="button"
                  onClick={() => handleMarkItemSettled(item)}
                  title="Mark this individual item settled"
                  className="text-[10px] bg-[#ffdcc0] text-[#2d1600] hover:bg-[#88f8c4] px-2 py-0.5 rounded-full font-medium transition-colors cursor-pointer"
                >
                  Pending
                </button>
              </div>
            </div>
          ))}

          {pendingExpenses.length === 0 && (
            <div className="bg-white p-6 rounded-xl text-center text-[#3e4942] text-[13px] border border-[#dfe9fc]/40">
              <span className="material-symbols-outlined text-[32px] text-[#006948] mb-1">
                check_circle
              </span>
              <p className="font-semibold text-[#121c2a]">All settled up with Appa!</p>
              <p className="text-[11px] mt-1 text-[#6d7a72]">
                No pending reimbursable expenses at the moment.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Recent Repayments Section */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-[18px] text-[#121c2a] font-semibold">Recent Repayments</h2>
          <span className="text-[11px] text-[#3e4942] font-medium">
            Total ₹{totalAppaRepaid.toLocaleString('en-IN')} repaid
          </span>
        </div>

        <div className="flex flex-col gap-2">
          {recentRepayments.map((rep) => (
            <div
              key={rep.id}
              className="bg-white p-3.5 rounded-xl flex items-center justify-between shadow-xs border border-[#dfe9fc]/50"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-[#88f8c4]/30 flex items-center justify-center text-[#006948] shrink-0">
                  <span className="material-symbols-outlined text-[20px]">
                    {rep.paymentMethod === 'cash' ? 'payments' : 'account_balance'}
                  </span>
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[14px] font-semibold text-[#121c2a] truncate">
                    {rep.title}
                  </span>
                  <span className="text-[12px] text-[#3e4942] truncate">
                    {formatDateLabel(rep.date)} • {rep.notes || (rep.paymentMethod === 'cash' ? 'Cash Handover' : 'Direct bank credit')}
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-end gap-1 shrink-0 pl-2">
                <span className="text-[17px] font-bold text-[#006948] tabular-nums">
                  +₹{rep.amount}
                </span>
                <span className="text-[10px] bg-[#006948]/10 text-[#006948] px-2 py-0.5 rounded-full font-medium">
                  Settled
                </span>
              </div>
            </div>
          ))}

          {recentRepayments.length === 0 && (
            <div className="bg-white p-4 rounded-xl text-center text-[#6d7a72] text-[12px] border border-[#dfe9fc]/40">
              No repayments logged yet. When Appa transfers money, tap "Record Payment".
            </div>
          )}
        </div>
      </div>

      {/* Warm Reassuring Micro Note */}
      <div className="flex items-center justify-center gap-1.5 py-2 text-[#3e4942] opacity-80 text-center">
        <span className="material-symbols-outlined text-[15px] text-[#ba1a1a]">favorite</span>
        <span className="text-[11px]">Personal family expense tracker • Auto-synced locally</span>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-[#121c2a] text-white px-4 py-2.5 rounded-full shadow-lg text-[13px] flex items-center gap-2 z-50 animate-fade-in">
          <span className="material-symbols-outlined text-[18px] text-[#88f8c4]">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Record Payment Modal */}
      {showRecordModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#88f8c4]/40 flex items-center justify-center text-[#006948]">
                  <span className="material-symbols-outlined text-[18px]">payments</span>
                </div>
                <h3 className="text-[16px] font-bold text-[#121c2a]">Record Payment from Appa</h3>
              </div>
              <button
                onClick={() => setShowRecordModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full text-[#3e4942] hover:bg-[#eff3ff]"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={handleRecordRepayment} className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-[#3e4942] uppercase tracking-wider block mb-1">
                  Amount Received (₹)
                </label>
                <input
                  type="number"
                  value={repayAmount}
                  onChange={(e) => setRepayAmount(e.target.value)}
                  placeholder="200"
                  autoFocus
                  className="w-full px-3 py-2 bg-[#f8f9ff] border border-[#dfe9fc] rounded-xl text-[20px] font-bold text-[#121c2a] focus:outline-none focus:border-[#006948]"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#3e4942] uppercase tracking-wider block mb-1">
                  Payment Method
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRepayMethod('cash')}
                    className={`py-2 rounded-xl text-[12px] font-semibold border transition-all cursor-pointer ${
                      repayMethod === 'cash'
                        ? 'bg-[#006948] text-white border-[#006948]'
                        : 'bg-[#f8f9ff] text-[#3e4942] border-[#dfe9fc]'
                    }`}
                  >
                    Cash
                  </button>
                  <button
                    type="button"
                    onClick={() => setRepayMethod('upi')}
                    className={`py-2 rounded-xl text-[12px] font-semibold border transition-all cursor-pointer ${
                      repayMethod === 'upi'
                        ? 'bg-[#006948] text-white border-[#006948]'
                        : 'bg-[#f8f9ff] text-[#3e4942] border-[#dfe9fc]'
                    }`}
                  >
                    UPI / Bank
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#3e4942] uppercase tracking-wider block mb-1">
                  Note
                </label>
                <input
                  type="text"
                  value={repayNote}
                  onChange={(e) => setRepayNote(e.target.value)}
                  placeholder="e.g. Handover morning settlement"
                  className="w-full px-3 py-2 bg-[#f8f9ff] border border-[#dfe9fc] rounded-xl text-[13px] text-[#121c2a] focus:outline-none focus:border-[#006948]"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowRecordModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-[#dfe9fc] text-[13px] font-semibold text-[#3e4942] hover:bg-[#eff3ff]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-[#006948] hover:bg-[#00855d] text-white text-[13px] font-semibold shadow-xs"
                >
                  Confirm & Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
