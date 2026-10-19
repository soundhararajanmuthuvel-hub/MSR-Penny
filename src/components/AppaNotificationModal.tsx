import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { FamilyNotificationData } from '../types';
import { formatDateLabel } from '../utils/categoryIcons';
import {
  buildExpenseWhatsAppMessage,
  buildRepaymentWhatsAppMessage,
  generateWhatsAppUrl,
} from '../utils/familyMigration';
import { normalizeWhatsAppNumber, formatPhoneNumberDisplay } from '../utils/phoneNormalizer';

interface FamilyNotificationModalProps {
  data: FamilyNotificationData | null;
  onClose: () => void;
}

export const FamilyNotificationModal: React.FC<FamilyNotificationModalProps> = ({
  data,
  onClose,
}) => {
  const { familyContacts, updateFamilyContact } = useApp();
  const [copied, setCopied] = useState(false);
  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const contact = familyContacts.find((c) => c.id === data?.contactId);

  useEffect(() => {
    if (data) {
      setPhoneNumber(contact?.phoneNumber || data.phoneNumber || '');
      setPhoneError(null);
      setEditingPhone(false);
      setCopied(false);
    }
  }, [data, contact?.phoneNumber]);

  if (!data) return null;

  const isExpense = data.type === 'expense';
  const formattedDate = formatDateLabel(data.date);
  const contactName = data.contactName || contact?.name || 'Family Member';

  // Build the message strictly conforming to prompt specifications (Sections 18 & 19)
  const messageText = isExpense
    ? buildExpenseWhatsAppMessage({
        contactName,
        description: data.title,
        date: formattedDate,
        amount: data.amount,
        previousBalance: data.previousBalance,
        updatedBalance: data.updatedBalance,
      })
    : buildRepaymentWhatsAppMessage({
        contactName,
        repaymentAmount: data.amount,
        previousBalance: data.previousBalance,
        updatedBalance: data.updatedBalance,
      });

  const handleCopyMessage = () => {
    navigator.clipboard?.writeText(messageText).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSendWhatsApp = () => {
    const currentNumber = phoneNumber.trim() || contact?.phoneNumber || '';
    const normalized = normalizeWhatsAppNumber(currentNumber);

    if (!normalized || normalized.length < 10) {
      setPhoneError(`Please enter a valid WhatsApp number with country code for ${contactName} (e.g. +919876543210).`);
      setEditingPhone(true);
      return;
    }

    setPhoneError(null);
    const whatsappUrl = generateWhatsAppUrl(normalized, messageText);
    window.open(whatsappUrl, '_blank');
  };

  const handleSavePhone = async () => {
    const normalized = normalizeWhatsAppNumber(phoneNumber);
    if (!normalized || normalized.length < 10) {
      setPhoneError('Please enter at least 10 digits including country code.');
      return;
    }

    setPhoneError(null);
    if (contact) {
      await updateFamilyContact({
        ...contact,
        phoneNumber: phoneNumber.trim(),
      });
    }
    setEditingPhone(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl space-y-4 animate-scale-up">
        {/* Header */}
        <div className="flex items-center justify-between pb-1 border-b border-[#dfe9fc]/60">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#006948]/10 flex items-center justify-center text-[#006948]">
              <span className="material-symbols-outlined text-[22px]">
                {isExpense ? 'send_to_mobile' : 'verified'}
              </span>
            </div>
            <div>
              <h3 className="text-[16px] font-bold text-[#121c2a]">
                {isExpense ? 'Expense Confirmation' : 'Repayment Recorded'}
              </h3>
              <p className="text-[11px] text-[#3e4942]">
                {isExpense ? `${contactName} will repay you` : `Settlement with ${contactName} updated`}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#3e4942] hover:bg-[#eff3ff]"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Financial Breakdown Card */}
        <div className="bg-[#f8f9ff] rounded-2xl p-4 border border-[#dfe9fc]/70 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-medium text-[#3e4942]">Family Member</span>
            <span className="text-[13px] font-bold text-[#006948]">
              {contactName}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[12px] font-medium text-[#3e4942]">Description</span>
            <span className="text-[13px] font-semibold text-[#121c2a] truncate max-w-[180px]">
              {data.title}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[12px] font-medium text-[#3e4942]">Date</span>
            <span className="text-[12px] text-[#121c2a] font-medium">{formattedDate}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[12px] font-medium text-[#3e4942]">
              {isExpense ? 'Amount Paid' : 'Amount Received'}
            </span>
            <span className={`text-[14px] font-bold tabular-nums ${isExpense ? 'text-[#121c2a]' : 'text-[#006948]'}`}>
              {isExpense ? `₹${data.amount.toLocaleString('en-IN')}` : `₹${data.amount.toLocaleString('en-IN')}`}
            </span>
          </div>

          <div className="h-px bg-[#dfe9fc]/60 my-1" />

          <div className="flex items-center justify-between text-[12px]">
            <span className="text-[#3e4942]">Previous balance</span>
            <span className="text-[#3e4942] font-semibold tabular-nums">
              ₹{data.previousBalance.toLocaleString('en-IN')}
            </span>
          </div>

          <div className="flex items-center justify-between text-[12px]">
            <span className="text-[#3e4942]">{isExpense ? 'New expense' : 'Repayment'}</span>
            <span className={`font-semibold tabular-nums ${isExpense ? 'text-[#894d00]' : 'text-[#006948]'}`}>
              {isExpense ? `+ ₹${data.amount.toLocaleString('en-IN')}` : `- ₹${data.amount.toLocaleString('en-IN')}`}
            </span>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-[#dfe9fc]/60">
            <span className="text-[13px] font-bold text-[#121c2a]">
              {isExpense ? 'Total amount to repay' : 'Updated remaining balance'}
            </span>
            <span className="text-[18px] font-bold text-[#006948] tabular-nums">
              ₹{data.updatedBalance.toLocaleString('en-IN')}
            </span>
          </div>
        </div>

        {/* WhatsApp Recipient Pill */}
        <div className="bg-[#eff3ff] px-3.5 py-2.5 rounded-xl border border-[#dfe9fc]/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#006948] text-[18px]">chat</span>
            <div>
              <span className="text-[10px] text-[#3e4942] block font-semibold uppercase tracking-wider">
                {contactName}'s WhatsApp
              </span>
              <span className="text-[12px] font-bold text-[#121c2a]">
                {formatPhoneNumberDisplay(phoneNumber || contact?.phoneNumber)}
              </span>
            </div>
          </div>

          <button
            onClick={() => setEditingPhone(!editingPhone)}
            className="text-[11px] text-[#006948] font-semibold hover:underline cursor-pointer"
          >
            {editingPhone ? 'Done' : 'Change'}
          </button>
        </div>

        {/* Inline Phone Edit Field */}
        {editingPhone && (
          <div className="space-y-1.5 p-3 bg-white border border-[#dfe9fc] rounded-xl shadow-xs">
            <label className="text-[10px] font-semibold text-[#3e4942] uppercase tracking-wider block">
              Enter {contactName}'s WhatsApp Number (with country code)
            </label>
            <div className="flex gap-2">
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+919876543210"
                className="flex-1 px-3 py-1.5 bg-[#f8f9ff] border border-[#dfe9fc] rounded-lg text-[13px] text-[#121c2a] focus:outline-none focus:border-[#006948]"
              />
              <button
                type="button"
                onClick={handleSavePhone}
                className="px-3 py-1.5 bg-[#006948] text-white text-[12px] font-semibold rounded-lg cursor-pointer"
              >
                Save
              </button>
            </div>
            {phoneError && (
              <p className="text-[10px] text-[#ba1a1a] font-medium">{phoneError}</p>
            )}
          </div>
        )}

        {/* Message Preview Box */}
        <div className="space-y-1">
          <span className="text-[10px] font-semibold text-[#3e4942] uppercase tracking-wider block">
            Message Preview (Prefilled in WhatsApp)
          </span>
          <div className="p-3 bg-[#f8f9ff] rounded-xl border border-[#dfe9fc]/60 text-[11px] text-[#121c2a] whitespace-pre-wrap font-sans leading-relaxed max-h-36 overflow-y-auto">
            {messageText}
          </div>
        </div>

        {/* Two Primary Action Buttons */}
        <div className="space-y-2 pt-1">
          {/* Green WhatsApp Button */}
          <button
            type="button"
            onClick={handleSendWhatsApp}
            className="w-full h-12 rounded-xl bg-[#006948] hover:bg-[#00855d] active:scale-[0.98] text-white text-[14px] font-semibold flex items-center justify-center gap-2 shadow-[0_4px_14px_rgba(0,105,72,0.28)] transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">send</span>
            <span>Send to {contactName} on WhatsApp</span>
          </button>

          {/* Secondary Copy Message Button */}
          <button
            type="button"
            onClick={handleCopyMessage}
            className="w-full h-11 rounded-xl bg-[#eff3ff] hover:bg-[#dfe9fc] text-[#121c2a] text-[13px] font-semibold flex items-center justify-center gap-2 border border-[#dfe9fc]/60 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px] text-[#006948]">
              {copied ? 'check' : 'content_copy'}
            </span>
            <span>{copied ? 'Message Copied!' : 'Copy Message'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// Backwards-compatible alias export
export const AppaNotificationModal = FamilyNotificationModal;
