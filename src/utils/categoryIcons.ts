import { TransactionCategory, Transaction } from '../types';

export interface CategoryVisual {
  name: TransactionCategory;
  icon: string;
  bgClass: string;
  textClass: string;
}

export const CATEGORY_MAP: Record<TransactionCategory, CategoryVisual> = {
  Food: {
    name: 'Food',
    icon: 'lunch_dining',
    bgClass: 'bg-[#ffdcc0]',
    textClass: 'text-[#894d00]',
  },
  Travel: {
    name: 'Travel',
    icon: 'directions_bus',
    bgClass: 'bg-[#e1e0ff]',
    textClass: 'text-[#4648d4]',
  },
  College: {
    name: 'College',
    icon: 'school',
    bgClass: 'bg-[#d9e3f6]',
    textClass: 'text-[#121c2a]',
  },
  Shopping: {
    name: 'Shopping',
    icon: 'shopping_bag',
    bgClass: 'bg-[#ffdad6]',
    textClass: 'text-[#ba1a1a]',
  },
  Freelance: {
    name: 'Freelance',
    icon: 'laptop_mac',
    bgClass: 'bg-[#88f8c4]',
    textClass: 'text-[#006948]',
  },
  Academics: {
    name: 'Academics',
    icon: 'print',
    bgClass: 'bg-[#dfe9fc]',
    textClass: 'text-[#121c2a]',
  },
  Family: {
    name: 'Family',
    icon: 'family_restroom',
    bgClass: 'bg-[#ffdcc0]',
    textClass: 'text-[#894d00]',
  },
  Other: {
    name: 'Other',
    icon: 'more_horiz',
    bgClass: 'bg-[#e6eeff]',
    textClass: 'text-[#3e4942]',
  },
};

export function getTransactionIcon(tx: Transaction): { icon: string; bgClass: string; textClass: string } {
  const titleLower = tx.title.toLowerCase();

  if (tx.type === 'repayment') {
    if (tx.paymentMethod === 'cash' || titleLower.includes('cash')) {
      return { icon: 'payments', bgClass: 'bg-[#88f8c4]/40', textClass: 'text-[#006948]' };
    }
    return { icon: 'account_balance', bgClass: 'bg-[#88f8c4]/40', textClass: 'text-[#006948]' };
  }

  if (tx.isAppaReimbursable) {
    if (titleLower.includes('bus')) {
      return { icon: 'directions_bus', bgClass: 'bg-[#ffdcc0]/40', textClass: 'text-[#894d00]' };
    }
    if (titleLower.includes('train')) {
      return { icon: 'train', bgClass: 'bg-[#dfe9fc]', textClass: 'text-[#121c2a]' };
    }
    if (titleLower.includes('print')) {
      return { icon: 'print', bgClass: 'bg-[#dfe9fc]', textClass: 'text-[#121c2a]' };
    }
    return { icon: 'family_restroom', bgClass: 'bg-[#ffdcc0]/40', textClass: 'text-[#894d00]' };
  }

  if (titleLower.includes('metro') || titleLower.includes('subway')) {
    return { icon: 'subway', bgClass: 'bg-[#dfe9fc]', textClass: 'text-[#121c2a]' };
  }
  if (titleLower.includes('poster') || titleLower.includes('design')) {
    return { icon: 'palette', bgClass: 'bg-[#88f8c4]/40', textClass: 'text-[#006948]' };
  }
  if (titleLower.includes('canteen') || titleLower.includes('lunch') || titleLower.includes('food')) {
    return { icon: 'restaurant', bgClass: 'bg-[#dfe9fc]', textClass: 'text-[#121c2a]' };
  }
  if (titleLower.includes('print')) {
    return { icon: 'print', bgClass: 'bg-[#dfe9fc]', textClass: 'text-[#121c2a]' };
  }

  const catVisual = CATEGORY_MAP[tx.category] || CATEGORY_MAP.Other;
  return {
    icon: catVisual.icon,
    bgClass: 'bg-[#dfe9fc]',
    textClass: 'text-[#121c2a]',
  };
}

export function formatDateLabel(dateStr: string): string {
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    if (dateStr === todayStr) return 'Today';
    if (dateStr === yesterdayStr) return 'Yesterday';

    const d = new Date(dateStr);
    const day = d.getDate();
    const month = d.toLocaleString('en-US', { month: 'short' });
    return `${day} ${month}`;
  } catch {
    return dateStr;
  }
}
