/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/Header';
import { BottomNav, NavTab } from './components/BottomNav';
import { HomeScreen } from './components/HomeScreen';
import { AppaSettlementScreen } from './components/AppaSettlementScreen';
import { AddTransactionModal } from './components/AddTransactionModal';
import { FreelanceScreen } from './components/FreelanceScreen';
import { SavingsScreen } from './components/SavingsScreen';
import { HistoryScreen } from './components/HistoryScreen';
import { ReportsScreen } from './components/ReportsScreen';
import { TransactionDetailModal } from './components/TransactionDetailModal';
import { SyncModal } from './components/SyncModal';
import { ProfileModal } from './components/ProfileModal';
import { PWAInstallBanner } from './components/PWAInstallBanner';
import { AppaNotificationModal } from './components/AppaNotificationModal';
import { Transaction, TransactionType, AppaNotificationData } from './types';

type SubView = 'none' | 'appa' | 'savings';

function MainApp() {
  const { state } = useApp();

  const [currentTab, setCurrentTab] = useState<NavTab>('home');
  const [subView, setSubView] = useState<SubView>('none');

  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addInitialType, setAddInitialType] = useState<TransactionType>('expense');
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [isSyncOpen, setIsSyncOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [appaNotificationData, setAppaNotificationData] = useState<AppaNotificationData | null>(null);

  // Tab change resets subview
  const handleTabChange = (tab: NavTab) => {
    setCurrentTab(tab);
    setSubView('none');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenAdd = (type: TransactionType = 'expense') => {
    setAddInitialType(type);
    setIsAddOpen(true);
  };

  // Header Title
  const getHeaderTitle = () => {
    if (subView === 'appa') return 'Home';
    if (subView === 'savings') return 'Savings';
    switch (currentTab) {
      case 'home':
        return 'Home';
      case 'history':
        return 'History';
      case 'freelance':
        return 'Freelance';
      case 'reports':
        return 'Reports';
      default:
        return 'MSR Penny';
    }
  };

  return (
    <div className="bg-[#f8f9ff] text-[#121c2a] min-h-screen flex flex-col font-sans select-none">
      {/* Top Fixed Header */}
      <Header
        title={getHeaderTitle()}
        showBack={subView !== 'none'}
        onBack={() => setSubView('none')}
        onAvatarClick={() => setIsProfileOpen(true)}
        onNotificationsClick={() => setIsSyncOpen(true)}
        userName={state.settings.userName}
      />

      {/* Main View Area with iPhone max width constraint */}
      <main className="flex-1 flex flex-col w-full max-w-md mx-auto px-4 pt-20 pb-safe bg-[#f8f9ff]">
        {/* PWA Install Banner */}
        <PWAInstallBanner />

        {/* View Switcher */}
        {subView === 'appa' ? (
          <AppaSettlementScreen
            onBack={() => setSubView('none')}
            onOpenAddExpenseForAppa={() => handleOpenAdd('expense')}
            onShowAppaNotification={(data) => setAppaNotificationData(data)}
          />
        ) : subView === 'savings' ? (
          <SavingsScreen />
        ) : currentTab === 'home' ? (
          <HomeScreen
            onOpenAdd={handleOpenAdd}
            onNavigateToAppa={() => setSubView('appa')}
            onNavigateToHistory={() => handleTabChange('history')}
            onNavigateToSavings={() => setSubView('savings')}
            onSelectTransaction={(tx) => setSelectedTransaction(tx)}
            onOpenSyncModal={() => setIsSyncOpen(true)}
          />
        ) : currentTab === 'history' ? (
          <HistoryScreen
            onSelectTransaction={(tx) => setSelectedTransaction(tx)}
            onOpenAdd={() => handleOpenAdd('expense')}
          />
        ) : currentTab === 'freelance' ? (
          <FreelanceScreen />
        ) : currentTab === 'reports' ? (
          <ReportsScreen />
        ) : null}
      </main>

      {/* Fixed Bottom Dock */}
      <BottomNav
        currentTab={currentTab}
        onTabChange={handleTabChange}
        onOpenAdd={() => handleOpenAdd('expense')}
      />

      {/* Quick Add Transaction Modal */}
      <AddTransactionModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        initialType={addInitialType}
        onShowAppaNotification={(data) => setAppaNotificationData(data)}
      />

      {/* Appa WhatsApp Notification & Confirmation Modal */}
      <AppaNotificationModal
        data={appaNotificationData}
        onClose={() => setAppaNotificationData(null)}
      />

      {/* Transaction Details & Edit Modal */}
      <TransactionDetailModal
        transaction={selectedTransaction}
        onClose={() => setSelectedTransaction(null)}
      />

      {/* Live Dual-Sync Info & Trigger Modal */}
      <SyncModal
        isOpen={isSyncOpen}
        onClose={() => setIsSyncOpen(false)}
        onNavigateToSettings={() => {
          setSubView('none');
          setCurrentTab('reports');
        }}
      />

      {/* Profile & Reset Modal */}
      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <MainApp />
    </AppProvider>
  );
}
