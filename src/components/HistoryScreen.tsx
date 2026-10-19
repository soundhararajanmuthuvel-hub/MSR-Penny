import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { getTransactionIcon, formatDateLabel } from '../utils/categoryIcons';
import { Transaction } from '../types';

interface HistoryScreenProps {
  onSelectTransaction: (tx: Transaction) => void;
  onOpenAdd: () => void;
}

type FilterType = 'all' | 'expense' | 'income' | 'family' | 'repayment' | 'freelance';

export const HistoryScreen: React.FC<HistoryScreenProps> = ({
  onSelectTransaction,
  onOpenAdd,
}) => {
  const { state, familyContacts, clearDemoData, isDemoDataLoaded } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [selectedMember, setSelectedMember] = useState<string>('all');
  const [isClearing, setIsClearing] = useState(false);

  const transactions = state.transactions || [];
  const activeContacts = familyContacts.filter((c) => c.active !== false);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // Search query filter
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        tx.title.toLowerCase().includes(q) ||
        tx.category.toLowerCase().includes(q) ||
        (tx.familyContactName && tx.familyContactName.toLowerCase().includes(q)) ||
        (tx.notes && tx.notes.toLowerCase().includes(q));

      if (!matchSearch) return false;

      // Filter Type
      if (activeFilter === 'expense' && (tx.type !== 'expense' || tx.isFamilyReimbursable || tx.isAppaReimbursable)) {
        return false;
      }
      if (activeFilter === 'income' && tx.type !== 'income') return false;
      if (activeFilter === 'family' && !tx.isFamilyReimbursable && !tx.isAppaReimbursable && tx.type !== 'repayment') {
        return false;
      }
      if (activeFilter === 'repayment' && tx.type !== 'repayment') return false;
      if (activeFilter === 'freelance' && tx.category !== 'Freelance' && !tx.freelanceJobId) return false;

      // Filter by Specific Family Member
      if (selectedMember !== 'all') {
        const contactId = tx.familyContactId || (tx.isAppaReimbursable ? 'family-appa' : '');
        if (contactId !== selectedMember) return false;
      }

      return true;
    });
  }, [transactions, searchQuery, activeFilter, selectedMember]);

  // Group by date
  const groupedByDate = useMemo(() => {
    const groups: Record<string, Transaction[]> = {};
    filteredTransactions.forEach((tx) => {
      const dateKey = tx.date;
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(tx);
    });

    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredTransactions]);

  return (
    <div className="flex flex-col w-full gap-4 pb-28">
      {/* Top Search & Filter Bar */}
      <div className="bg-white rounded-2xl p-3 shadow-xs border border-[#dfe9fc]/60 space-y-3">
        <div className="flex items-center gap-2 bg-[#f8f9ff] px-3 py-2 rounded-xl border border-[#dfe9fc]/60">
          <span className="material-symbols-outlined text-[#6d7a72] text-[20px]">search</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Metro, Lunch, Appa, Amma, Poster..."
            className="w-full bg-transparent text-[13px] text-[#121c2a] placeholder:text-[#6d7a72] focus:outline-none"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-[#6d7a72]">
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {[
            { id: 'all', label: 'All' },
            { id: 'expense', label: 'Personal' },
            { id: 'family', label: 'Family Split' },
            { id: 'repayment', label: 'Repayments' },
            { id: 'income', label: 'Income' },
            { id: 'freelance', label: 'Freelance' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => {
                setActiveFilter(f.id as FilterType);
                if (f.id !== 'family' && f.id !== 'repayment') {
                  setSelectedMember('all');
                }
              }}
              className={`px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeFilter === f.id
                  ? 'bg-[#006948] text-white shadow-xs'
                  : 'bg-[#eff3ff] text-[#3e4942] hover:bg-[#dfe9fc]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Family Member Sub-Filter when Family or All is selected */}
        {(activeFilter === 'all' || activeFilter === 'family' || activeFilter === 'repayment') && (
          <div className="flex items-center gap-1.5 overflow-x-auto pt-1 border-t border-[#dfe9fc]/50">
            <span className="text-[10px] text-[#6d7a72] uppercase font-bold tracking-wider shrink-0 mr-1">
              Member:
            </span>
            <button
              type="button"
              onClick={() => setSelectedMember('all')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold cursor-pointer ${
                selectedMember === 'all'
                  ? 'bg-[#006948] text-white'
                  : 'bg-[#f8f9ff] text-[#3e4942] hover:bg-[#eff3ff]'
              }`}
            >
              All
            </button>
            {activeContacts.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedMember(c.id)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold cursor-pointer whitespace-nowrap ${
                  selectedMember === c.id
                    ? 'bg-[#006948] text-white'
                    : 'bg-[#f8f9ff] text-[#3e4942] hover:bg-[#eff3ff]'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {isDemoDataLoaded && (
        <div className="bg-[#eff3ff] border border-[#dfe9fc] rounded-xl p-3 flex items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2 min-w-0">
            <span className="material-symbols-outlined text-[#006948] text-[18px] shrink-0">info</span>
            <p className="text-[11px] text-[#3e4942] truncate">
              Demo sample transactions loaded.
            </p>
          </div>
          <button
            type="button"
            disabled={isClearing}
            onClick={async () => {
              if (window.confirm('Clear all demo transactions and start fresh? Your settings and webhook URL will remain saved.')) {
                setIsClearing(true);
                await clearDemoData(true);
                setIsClearing(false);
              }
            }}
            className="px-2.5 py-1 rounded-lg bg-white border border-[#ffb4ab] text-[#ba1a1a] text-[11px] font-semibold hover:bg-[#ffdad6]/40 shrink-0 cursor-pointer disabled:opacity-60"
          >
            {isClearing ? 'Clearing...' : 'Clear Demo Data'}
          </button>
        </div>
      )}

      {/* Transaction Feed */}
      <div className="flex flex-col gap-4">
        {groupedByDate.map(([dateKey, items]) => (
          <div key={dateKey} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between px-1">
              <span className="text-[12px] font-semibold text-[#3e4942]">
                {formatDateLabel(dateKey)}
              </span>
              <span className="text-[11px] text-[#6d7a72]">{items.length} items</span>
            </div>

            <div className="bg-white rounded-xl shadow-xs border border-[#dfe9fc]/50 overflow-hidden divide-y divide-[#dfe9fc]/60">
              {items.map((tx) => {
                const visual = getTransactionIcon(tx);
                const isNegative = tx.type === 'expense';
                const isRepayment = tx.type === 'repayment';
                const isReimbursable = tx.isFamilyReimbursable || tx.isAppaReimbursable;
                const memberName = tx.familyContactName || (tx.isAppaReimbursable ? 'Appa' : '');

                return (
                  <div
                    key={tx.id}
                    onClick={() => onSelectTransaction(tx)}
                    className="flex items-center justify-between p-3.5 hover:bg-[#eff3ff]/60 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-full ${visual.bgClass} flex items-center justify-center shrink-0`}
                      >
                        <span className={`material-symbols-outlined text-[20px] ${visual.textClass}`}>
                          {visual.icon}
                        </span>
                      </div>

                      <div className="min-w-0 flex flex-col">
                        <div className="flex items-center gap-1.5">
                          <p className="text-[14px] font-semibold text-[#121c2a] truncate">
                            {tx.title}
                          </p>
                          {isReimbursable && memberName && (
                            <span className="text-[9px] bg-[#ffdcc0] text-[#894d00] font-bold px-1.5 py-0.2 rounded-md shrink-0">
                              {memberName}
                            </span>
                          )}
                          {isRepayment && memberName && (
                            <span className="text-[9px] bg-[#88f8c4]/50 text-[#006948] font-bold px-1.5 py-0.2 rounded-md shrink-0">
                              {memberName}
                            </span>
                          )}
                        </div>

                        <p
                          className={`text-[12px] truncate ${
                            isReimbursable ? 'text-[#894d00] font-medium' : 'text-[#3e4942]'
                          }`}
                        >
                          {isReimbursable
                            ? `Claimed to ${memberName || 'Family'}`
                            : isRepayment
                            ? `Settlement from ${memberName || 'Family'}`
                            : tx.type === 'income'
                            ? 'Freelance Payout'
                            : tx.category}
                          {tx.notes ? ` • ${tx.notes}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0 pl-2">
                      <p
                        className={`text-[15px] font-bold tabular-nums ${
                          isRepayment
                            ? 'text-[#006948]'
                            : isNegative
                            ? 'text-[#121c2a]'
                            : 'text-[#006948]'
                        }`}
                      >
                        {isNegative ? `- ₹${tx.amount}` : `+ ₹${tx.amount}`}
                      </p>

                      <div className="flex items-center justify-end gap-1">
                        <span
                          className={`text-[10px] font-medium ${
                            isReimbursable
                              ? 'text-[#894d00] font-semibold'
                              : tx.type === 'income'
                              ? 'text-[#006948] font-semibold'
                              : 'text-[#3e4942]'
                          }`}
                        >
                          {isReimbursable
                            ? (tx.settlementStatus === 'settled' || tx.appaSettled ? 'Settled' : 'Pending')
                            : tx.paymentMethod === 'upi'
                            ? 'UPI'
                            : 'Cash'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {filteredTransactions.length === 0 && (
          <div className="bg-white p-8 rounded-2xl text-center text-[#6d7a72] text-[13px] border border-[#dfe9fc]/60">
            No matching transactions found.
          </div>
        )}
      </div>
    </div>
  );
};
