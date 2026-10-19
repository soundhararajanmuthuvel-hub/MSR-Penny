import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { TransactionCategory, PaymentMethod, TransactionType, FamilyNotificationData } from '../types';

interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialType?: TransactionType;
  onShowAppaNotification?: (data: FamilyNotificationData) => void;
}

const CATEGORIES: Array<{
  name: TransactionCategory;
  icon: string;
  bgClass: string;
  textClass: string;
}> = [
  { name: 'Food', icon: 'lunch_dining', bgClass: 'bg-[#ffdcc0]', textClass: 'text-[#894d00]' },
  { name: 'Travel', icon: 'directions_bus', bgClass: 'bg-[#e1e0ff]', textClass: 'text-[#4648d4]' },
  { name: 'College', icon: 'school', bgClass: 'bg-[#d9e3f6]', textClass: 'text-[#121c2a]' },
  { name: 'Shopping', icon: 'shopping_bag', bgClass: 'bg-[#ffdad6]', textClass: 'text-[#ba1a1a]' },
  { name: 'Freelance', icon: 'laptop_mac', bgClass: 'bg-[#88f8c4]', textClass: 'text-[#006948]' },
  { name: 'Other', icon: 'more_horiz', bgClass: 'bg-[#e6eeff]', textClass: 'text-[#3e4942]' },
];

export const AddTransactionModal: React.FC<AddTransactionModalProps> = ({
  isOpen,
  onClose,
  initialType = 'expense',
  onShowAppaNotification,
}) => {
  const { addTransaction, familyContacts, familyBalances } = useApp();

  const activeContacts = familyContacts.filter((c) => c.active !== false);

  const [txType, setTxType] = useState<TransactionType>(initialType);
  const [amountStr, setAmountStr] = useState<string>('150');
  const [title, setTitle] = useState<string>('College bus travel');
  const [category, setCategory] = useState<TransactionCategory>('Travel');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('upi');
  const [date, setDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  
  // Family settlements
  const [someoneWillRepayMe, setSomeoneWillRepayMe] = useState<boolean>(true);
  const [selectedContactId, setSelectedContactId] = useState<string>(
    activeContacts[0]?.id || 'family-appa'
  );

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentAmount = parseInt(amountStr, 10) || 0;
  const selectedContact = activeContacts.find((c) => c.id === selectedContactId) || activeContacts[0] || {
    id: 'family-appa',
    name: 'Appa',
    active: true,
  };

  const selectedContactBalance = familyBalances[selectedContact.id]?.outstandingBalance || 0;

  const handleQuickAdd = (addVal: number) => {
    const next = currentAmount + addVal;
    setAmountStr(String(next));
    setErrorMessage(null);
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleaned = e.target.value.replace(/[^0-9]/g, '');
    setAmountStr(cleaned);
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentAmount <= 0) {
      setErrorMessage('Please enter an amount greater than zero.');
      return;
    }

    if (txType === 'expense' && someoneWillRepayMe && !selectedContact) {
      setErrorMessage('Please select who should repay you.');
      return;
    }

    if (txType === 'repayment' && selectedContactBalance > 0 && currentAmount > selectedContactBalance) {
      // Allow it but warn
      const proceed = window.confirm(
        `Note: ₹${currentAmount} is greater than ${selectedContact.name}'s current outstanding balance of ₹${selectedContactBalance}. Record as advance settlement?`
      );
      if (!proceed) return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    let defaultTitle = title.trim();
    if (!defaultTitle) {
      if (txType === 'repayment') {
        defaultTitle = paymentMethod === 'cash' ? `Cash from ${selectedContact.name}` : `UPI from ${selectedContact.name}`;
      } else {
        defaultTitle = `${category} expense`;
      }
    }

    const isReimbursable = txType === 'expense' ? someoneWillRepayMe : false;

    const res = await addTransaction({
      type: txType,
      title: defaultTitle,
      amount: currentAmount,
      category: txType === 'repayment' ? 'Family' : category,
      date,
      paymentMethod,
      isAppaReimbursable: selectedContact.id === 'family-appa' && isReimbursable,
      appaSettled: txType === 'repayment' && selectedContact.id === 'family-appa',
      isFamilyReimbursable: isReimbursable,
      familyContactId: (isReimbursable || txType === 'repayment') ? selectedContact.id : undefined,
      familyContactName: (isReimbursable || txType === 'repayment') ? selectedContact.name : undefined,
      settlementStatus: txType === 'repayment' ? 'settled' : 'pending',
    });

    setIsSubmitting(false);

    if (!res.success) {
      setErrorMessage(res.error || 'Failed to save transaction to database.');
      return;
    }

    // When someone will repay me was enabled OR when recording repayment:
    // Show expense/repayment confirmation screen after successful save!
    if (txType === 'expense' && someoneWillRepayMe) {
      if (onShowAppaNotification) {
        onShowAppaNotification({
          type: 'expense',
          title: defaultTitle,
          amount: currentAmount,
          date,
          contactId: selectedContact.id,
          contactName: selectedContact.name,
          phoneNumber: selectedContact.phoneNumber,
          previousBalance: res.previousBalance,
          updatedBalance: res.updatedBalance,
          paymentMethod,
        });
      }
      onClose();
    } else if (txType === 'repayment') {
      if (onShowAppaNotification) {
        onShowAppaNotification({
          type: 'repayment',
          title: defaultTitle,
          amount: currentAmount,
          date,
          contactId: selectedContact.id,
          contactName: selectedContact.name,
          phoneNumber: selectedContact.phoneNumber,
          previousBalance: res.previousBalance,
          updatedBalance: res.updatedBalance,
          paymentMethod,
        });
      }
      onClose();
    } else {
      // Personal expense or regular income without notification
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        onClose();
      }, 700);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-xs flex justify-center items-start pt-safe pb-safe">
      <div className="w-full max-w-md min-h-screen bg-[#f8f9ff] flex flex-col shadow-2xl relative">
        {/* Header */}
        <div className="h-16 px-4 flex items-center justify-between bg-[#f8f9ff]/90 backdrop-blur-md sticky top-0 z-10 border-b border-[#dfe9fc]/50">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 -ml-1 flex items-center justify-center rounded-full text-[#121c2a] hover:bg-[#dfe9fc]/50 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[22px]">arrow_back</span>
            </button>
            <h1 className="font-semibold text-[18px] text-[#121c2a] tracking-tight">
              Add Transaction
            </h1>
          </div>
          <div className="w-8 h-8 rounded-full bg-[#006948] flex items-center justify-center text-white">
            <span className="material-symbols-outlined text-[18px]">person</span>
          </div>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="flex-1 px-4 py-4 space-y-4">
          {/* Segmented Type Selector */}
          <div className="w-full bg-[#dfe9fc]/60 p-1 rounded-full flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setTxType('expense');
                if (title.startsWith('Cash from') || title.startsWith('UPI from')) setTitle('');
              }}
              className={`flex-1 py-2 rounded-full text-[12px] font-semibold transition-all duration-200 cursor-pointer ${
                txType === 'expense'
                  ? 'bg-[#006948] text-white shadow-xs'
                  : 'text-[#3e4942] hover:text-[#121c2a]'
              }`}
            >
              Expense
            </button>

            <button
              type="button"
              onClick={() => {
                setTxType('income');
                setCategory('Freelance');
              }}
              className={`flex-1 py-2 rounded-full text-[12px] font-semibold transition-all duration-200 cursor-pointer ${
                txType === 'income'
                  ? 'bg-[#006948] text-white shadow-xs'
                  : 'text-[#3e4942] hover:text-[#121c2a]'
              }`}
            >
              Income
            </button>

            <button
              type="button"
              onClick={() => {
                setTxType('repayment');
                setTitle(paymentMethod === 'cash' ? `Cash from ${selectedContact.name}` : `UPI from ${selectedContact.name}`);
              }}
              className={`flex-1 py-2 rounded-full text-[12px] font-semibold transition-all duration-200 cursor-pointer ${
                txType === 'repayment'
                  ? 'bg-[#006948] text-white shadow-xs'
                  : 'text-[#3e4942] hover:text-[#121c2a]'
              }`}
            >
              Family Repaid
            </button>
          </div>

          {/* Hero Amount Input */}
          <div className="flex flex-col items-center justify-center py-2">
            <span className="text-[11px] font-semibold text-[#3e4942] uppercase tracking-wider mb-1">
              {txType === 'repayment' ? 'REPAYMENT AMOUNT' : 'ENTER AMOUNT'}
            </span>
            <div className="flex items-center justify-center space-x-1 cursor-text">
              <span className="text-[36px] text-[#121c2a] select-none font-bold">₹</span>
              <input
                type="tel"
                inputMode="numeric"
                value={amountStr}
                onChange={handleAmountChange}
                placeholder="0"
                autoFocus
                className="bg-transparent text-[36px] text-[#121c2a] font-bold text-center w-44 focus:outline-none tracking-tight caret-[#006948] tabular-nums"
              />
            </div>

            {/* Quick Add Chips */}
            <div className="flex items-center gap-2 mt-3">
              {[50, 100, 200, 500].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => handleQuickAdd(val)}
                  className="px-3 py-1.5 rounded-full bg-[#e6eeff] text-[12px] font-medium text-[#121c2a] hover:bg-[#dfe9fc] transition-colors active:scale-95 cursor-pointer"
                >
                  +₹{val}
                </button>
              ))}
            </div>
          </div>

          {/* Note / Description Field */}
          <div className="w-full bg-white rounded-xl p-3 shadow-xs border border-[#dfe9fc]/60 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#e6eeff] flex items-center justify-center shrink-0 text-[#3e4942]">
              <span className="material-symbols-outlined text-[18px]">edit_note</span>
            </div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                txType === 'repayment'
                  ? `e.g. Settlement from ${selectedContact.name}`
                  : txType === 'income'
                  ? 'e.g. Poster Design Milestone'
                  : 'e.g. College bus travel'
              }
              className="w-full bg-transparent text-[14px] text-[#121c2a] placeholder:text-[#6d7a72] focus:outline-none"
            />
          </div>

          {/* Category Grid (Show for Expense & Income) */}
          {txType !== 'repayment' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-[12px] text-[#3e4942]">Category</span>
                <span className="text-[11px] text-[#006948] font-medium">{category}</span>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                {CATEGORIES.map((cat) => {
                  const isSelected = category === cat.name;
                  return (
                    <button
                      key={cat.name}
                      type="button"
                      onClick={() => setCategory(cat.name)}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl transition-all active:scale-95 cursor-pointer border ${
                        isSelected
                          ? 'bg-[#dfe9fc]/70 border-[#006948]/30 shadow-xs'
                          : 'bg-white border-[#dfe9fc]/50 hover:bg-[#eff3ff]/50'
                      }`}
                    >
                      <div
                        className={`w-11 h-11 rounded-full ${cat.bgClass} flex items-center justify-center ${cat.textClass} mb-1.5 transition-transform ${
                          isSelected ? 'scale-105 shadow-xs' : ''
                        }`}
                      >
                        <span className="material-symbols-outlined text-[22px]">{cat.icon}</span>
                      </div>
                      <span
                        className={`text-[12px] text-[#121c2a] ${
                          isSelected ? 'font-semibold' : 'font-normal'
                        }`}
                      >
                        {cat.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Payment Method & Date */}
          <div className="grid grid-cols-2 gap-2.5">
            {/* Mode Selector */}
            <div className="bg-white p-1 rounded-xl shadow-xs border border-[#dfe9fc]/60 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setPaymentMethod('upi')}
                className={`flex-1 py-1.5 rounded-lg text-[12px] font-semibold transition-all cursor-pointer ${
                  paymentMethod === 'upi'
                    ? 'bg-[#dfe9fc] text-[#121c2a]'
                    : 'text-[#3e4942] hover:text-[#121c2a]'
                }`}
              >
                UPI / Bank
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('cash')}
                className={`flex-1 py-1.5 rounded-lg text-[12px] font-semibold transition-all cursor-pointer ${
                  paymentMethod === 'cash'
                    ? 'bg-[#dfe9fc] text-[#121c2a]'
                    : 'text-[#3e4942] hover:text-[#121c2a]'
                }`}
              >
                Cash
              </button>
            </div>

            {/* Date Row */}
            <div className="bg-white px-3 py-2 rounded-xl shadow-xs border border-[#dfe9fc]/60 flex items-center justify-between relative cursor-pointer hover:bg-[#eff3ff]/50 transition-colors">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#006948] text-[18px]">
                  calendar_today
                </span>
                <span className="text-[12px] text-[#121c2a] font-medium">
                  {date === new Date().toISOString().split('T')[0] ? 'Today' : date}
                </span>
              </div>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
              />
              <span className="material-symbols-outlined text-[#6d7a72] text-[16px]">
                expand_more
              </span>
            </div>
          </div>

          {/* Key Toggle: Someone will repay me (For Expense only) */}
          {txType === 'expense' && (
            <div className="w-full bg-white rounded-xl p-3.5 shadow-xs border border-[#dfe9fc]/60 space-y-3 transition-all">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-[#ffdcc0] flex items-center justify-center text-[#894d00] shrink-0">
                    <span className="material-symbols-outlined text-[16px]">handshake</span>
                  </div>
                  <label
                    htmlFor="repay-switch"
                    className="text-[14px] font-semibold text-[#121c2a] cursor-pointer select-none"
                  >
                    Someone will repay me
                  </label>
                </div>

                <button
                  id="repay-switch"
                  type="button"
                  role="switch"
                  aria-checked={someoneWillRepayMe}
                  onClick={() => setSomeoneWillRepayMe(!someoneWillRepayMe)}
                  className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-200 flex items-center focus:outline-none cursor-pointer ${
                    someoneWillRepayMe ? 'bg-[#006948] justify-end' : 'bg-[#d9e3f6] justify-start'
                  }`}
                >
                  <div className="w-5 h-5 rounded-full bg-white shadow-xs transition-transform duration-200" />
                </button>
              </div>

              {/* Contact Selector when enabled */}
              {someoneWillRepayMe && (
                <div className="space-y-2 pt-1 border-t border-[#dfe9fc]/50">
                  <span className="text-[11px] font-semibold text-[#3e4942] uppercase tracking-wider block">
                    Who should repay me?
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {activeContacts.map((contact) => {
                      const isSelected = selectedContactId === contact.id;
                      const bal = familyBalances[contact.id]?.outstandingBalance || 0;
                      return (
                        <button
                          key={contact.id}
                          type="button"
                          onClick={() => setSelectedContactId(contact.id)}
                          className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                            isSelected
                              ? 'bg-[#006948]/10 border-[#006948] text-[#006948]'
                              : 'bg-[#f8f9ff] border-[#dfe9fc] text-[#3e4942] hover:bg-[#eff3ff]'
                          }`}
                        >
                          <span className="text-[13px] font-bold text-[#121c2a]">{contact.name}</span>
                          <span className="text-[11px] text-[#3e4942] mt-0.5">
                            Owes: <strong className="text-[#006948]">₹{bal}</strong>
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <p className="text-[12px] text-[#3e4942] leading-relaxed pt-1">
                    Will track <span className="font-semibold text-[#006948]">₹{currentAmount}</span> in{' '}
                    <span className="font-semibold text-[#121c2a]">{selectedContact.name}'s</span> balance and not count as personal spending.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Family Contact Selector when Repayment is selected */}
          {txType === 'repayment' && (
            <div className="w-full bg-white rounded-xl p-3.5 shadow-xs border border-[#dfe9fc]/60 space-y-2.5">
              <span className="text-[11px] font-semibold text-[#3e4942] uppercase tracking-wider block">
                Who repaid you?
              </span>
              <div className="grid grid-cols-2 gap-2">
                {activeContacts.map((contact) => {
                  const isSelected = selectedContactId === contact.id;
                  const bal = familyBalances[contact.id]?.outstandingBalance || 0;
                  return (
                    <button
                      key={contact.id}
                      type="button"
                      onClick={() => {
                        setSelectedContactId(contact.id);
                        if (title.startsWith('Cash from') || title.startsWith('UPI from')) {
                          setTitle(paymentMethod === 'cash' ? `Cash from ${contact.name}` : `UPI from ${contact.name}`);
                        }
                      }}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'bg-[#006948]/10 border-[#006948] text-[#006948]'
                          : 'bg-[#f8f9ff] border-[#dfe9fc] text-[#3e4942] hover:bg-[#eff3ff]'
                      }`}
                    >
                      <span className="text-[13px] font-bold text-[#121c2a]">{contact.name}</span>
                      <span className="text-[11px] text-[#3e4942] mt-0.5">
                        Outstanding: <strong className="text-[#006948]">₹{bal}</strong>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 bg-[#ffdad6]/60 border border-[#ba1a1a]/30 rounded-xl text-[12px] text-[#ba1a1a] font-medium flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]">error</span>
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Primary Bottom Action */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting || currentAmount <= 0}
              className={`w-full h-12 rounded-xl text-white text-[14px] font-semibold flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer ${
                isSuccess
                  ? 'bg-[#00855d] scale-98'
                  : currentAmount <= 0
                  ? 'bg-[#bdcac0] cursor-not-allowed'
                  : 'bg-[#006948] hover:bg-[#00855d] active:scale-[0.98]'
              }`}
            >
              {isSubmitting ? (
                <span className="material-symbols-outlined text-[20px] animate-spin">refresh</span>
              ) : isSuccess ? (
                <>
                  <span className="material-symbols-outlined text-[20px]">check_circle</span>
                  <span>Saved!</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[20px]">check</span>
                  <span>
                    {txType === 'expense'
                      ? 'Save Expense'
                      : txType === 'income'
                      ? 'Save Income'
                      : `Record Repayment from ${selectedContact.name}`}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
