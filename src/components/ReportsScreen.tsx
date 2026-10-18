import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';

export const ReportsScreen: React.FC = () => {
  const {
    state,
    totalIncome,
    currentMonthSpent,
    totalAppaPaidByMe,
    totalAppaRepaid,
    appaOwesMe,
    availableBalance,
    monthlyBudget,
    updateSettings,
    syncWithGoogleSheets,
  } = useApp();

  const [scriptUrlInput, setScriptUrlInput] = useState(
    state.settings.googleAppsScriptUrl || ''
  );
  const [budgetInput, setBudgetInput] = useState(String(state.settings.monthlyBudget || 4000));
  const [appaPhoneInput, setAppaPhoneInput] = useState(state.settings.appaPhoneNumber || '+919876543210');
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [showScriptModal, setShowScriptModal] = useState<boolean>(false);

  const handleSaveAppaPhone = async () => {
    await updateSettings({ appaPhoneNumber: appaPhoneInput.trim() });
    setSyncStatus("Appa's WhatsApp phone number updated!");
    setTimeout(() => setSyncStatus(null), 2500);
  };

  // Category breakdown calculation
  const categoryBreakdown = useMemo(() => {
    const expenses = state.transactions.filter(
      (t) => t.type === 'expense' && !t.isAppaReimbursable
    );
    const totals: Record<string, number> = {};
    let grandTotal = 0;

    expenses.forEach((t) => {
      totals[t.category] = (totals[t.category] || 0) + Number(t.amount);
      grandTotal += Number(t.amount);
    });

    const categories = Object.entries(totals).map(([category, amount]) => ({
      category,
      amount,
      percentage: grandTotal > 0 ? Math.round((amount / grandTotal) * 100) : 0,
    }));

    return categories.sort((a, b) => b.amount - a.amount);
  }, [state.transactions]);

  // Payment Method Breakdown
  const paymentMethodBreakdown = useMemo(() => {
    let upiTotal = 0;
    let cashTotal = 0;
    state.transactions.forEach((t) => {
      if (t.type === 'expense') {
        if (t.paymentMethod === 'upi') upiTotal += Number(t.amount);
        else cashTotal += Number(t.amount);
      }
    });
    const total = upiTotal + cashTotal || 1;
    return {
      upiTotal,
      cashTotal,
      upiPercent: Math.round((upiTotal / total) * 100),
      cashPercent: Math.round((cashTotal / total) * 100),
    };
  }, [state.transactions]);

  const handleSaveBudget = async () => {
    const b = parseInt(budgetInput, 10);
    if (b > 0) {
      await updateSettings({ monthlyBudget: b });
      setSyncStatus('Monthly budget updated!');
      setTimeout(() => setSyncStatus(null), 2500);
    }
  };

  const handleSaveSyncUrl = async () => {
    await updateSettings({ googleAppsScriptUrl: scriptUrlInput.trim() });
    setSyncStatus('Google Apps Script URL saved!');
    setTimeout(() => setSyncStatus(null), 2500);
  };

  const handleTriggerSync = async () => {
    setIsSyncing(true);
    setSyncStatus('Connecting to Google Apps Script...');
    const result = await syncWithGoogleSheets(scriptUrlInput.trim());
    setIsSyncing(false);
    setSyncStatus(result.message);
    setTimeout(() => setSyncStatus(null), 4000);
  };

  const handleExportCSV = () => {
    const headers = ['ID', 'Date', 'Type', 'Title', 'Amount', 'Category', 'PaymentMethod', 'AppaReimbursable', 'Notes'];
    const rows = state.transactions.map((t) => [
      t.id,
      t.date,
      t.type,
      `"${t.title.replace(/"/g, '""')}"`,
      t.amount,
      t.category,
      t.paymentMethod,
      t.isAppaReimbursable ? 'YES' : 'NO',
      `"${(t.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `msr_penny_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(state, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `msr_penny_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const appsScriptCode = `/**
 * Google Apps Script Webhook for MSR Penny Dual-Sync
 * In your Google Sheet: Extensions -> Apps Script -> Paste this code -> Deploy as Web App (Anyone)
 */
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Transactions Sheet
    var txSheet = ss.getSheetByName("Transactions") || ss.insertSheet("Transactions");
    if (txSheet.getLastRow() === 0) {
      txSheet.appendRow(["ID", "Date", "Type", "Title", "Amount", "Category", "PaymentMethod", "AppaReimbursable", "Notes"]);
    }
    
    if (data.transactions && data.transactions.length > 0) {
      // Clear and re-write all rows for sync
      txSheet.getRange(2, 1, Math.max(1, txSheet.getLastRow() - 1), 9).clearContent();
      var rows = data.transactions.map(function(t) {
        return [t.id, t.date, t.type, t.title, t.amount, t.category, t.paymentMethod, t.isAppaReimbursable ? "YES" : "NO", t.notes || ""];
      });
      txSheet.getRange(2, 1, rows.length, 9).setValues(rows);
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      rowsSynced: data.transactions ? data.transactions.length : 0,
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}`;

  return (
    <div className="flex flex-col w-full gap-4 pb-28">
      {/* Top Banner */}
      <div className="flex items-center justify-between bg-white px-4 py-3 rounded-2xl border border-[#dfe9fc]/60 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#006948]/10 flex items-center justify-center text-[#006948]">
            <span className="material-symbols-outlined text-[22px]">insights</span>
          </div>
          <div>
            <h2 className="text-[16px] font-bold text-[#121c2a]">Financial Reports & Sync</h2>
            <p className="text-[11px] text-[#3e4942]">Monthly statistics, analytics & cloud sync</p>
          </div>
        </div>
      </div>

      {/* Monthly Financial Health Summary */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#dfe9fc]/60 space-y-3">
        <span className="text-[11px] font-semibold text-[#3e4942] uppercase tracking-wider block">
          Current Month Summary
        </span>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="bg-[#eff3ff] p-3 rounded-xl border border-[#dfe9fc]/50">
            <span className="text-[10px] text-[#3e4942] block">Total Inflows</span>
            <span className="text-[18px] font-bold text-[#006948] tabular-nums">
              ₹{totalIncome.toLocaleString('en-IN')}
            </span>
          </div>

          <div className="bg-[#eff3ff] p-3 rounded-xl border border-[#dfe9fc]/50">
            <span className="text-[10px] text-[#3e4942] block">Personal Spent</span>
            <span className="text-[18px] font-bold text-[#ba1a1a] tabular-nums">
              ₹{currentMonthSpent.toLocaleString('en-IN')}
            </span>
          </div>

          <div className="bg-[#eff3ff] p-3 rounded-xl border border-[#dfe9fc]/50">
            <span className="text-[10px] text-[#3e4942] block">Appa Outstanding</span>
            <span className="text-[18px] font-bold text-[#894d00] tabular-nums">
              ₹{appaOwesMe.toLocaleString('en-IN')}
            </span>
          </div>

          <div className="bg-[#eff3ff] p-3 rounded-xl border border-[#dfe9fc]/50">
            <span className="text-[10px] text-[#3e4942] block">Available Balance</span>
            <span className="text-[18px] font-bold text-[#121c2a] tabular-nums">
              ₹{availableBalance.toLocaleString('en-IN')}
            </span>
          </div>
        </div>
      </div>

      {/* Spending by Category */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#dfe9fc]/60 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-bold text-[#121c2a]">Spending by Category</span>
          <span className="text-[11px] text-[#3e4942]">
            Total ₹{currentMonthSpent.toLocaleString('en-IN')}
          </span>
        </div>

        <div className="space-y-2.5">
          {categoryBreakdown.map((item) => (
            <div key={item.category} className="space-y-1">
              <div className="flex items-center justify-between text-[12px]">
                <span className="font-medium text-[#121c2a]">{item.category}</span>
                <span className="text-[#3e4942] font-semibold tabular-nums">
                  ₹{item.amount.toLocaleString('en-IN')} ({item.percentage}%)
                </span>
              </div>
              <div className="w-full bg-[#e6eeff] rounded-full h-2 overflow-hidden">
                <div
                  className="bg-[#006948] h-2 rounded-full transition-all"
                  style={{ width: `${Math.min(100, Math.max(4, item.percentage))}%` }}
                />
              </div>
            </div>
          ))}

          {categoryBreakdown.length === 0 && (
            <p className="text-[12px] text-[#6d7a72] py-2 text-center">No expenses recorded yet.</p>
          )}
        </div>
      </div>

      {/* Payment Modes Distribution */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#dfe9fc]/60 space-y-3">
        <span className="text-[13px] font-bold text-[#121c2a]">Payment Method Breakdown</span>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="bg-[#eff3ff] p-3 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#006948] text-[20px]">
                account_balance
              </span>
              <div>
                <span className="text-[11px] text-[#3e4942] block">UPI / Bank</span>
                <span className="text-[14px] font-bold text-[#121c2a] tabular-nums">
                  ₹{paymentMethodBreakdown.upiTotal}
                </span>
              </div>
            </div>
            <span className="text-[11px] font-bold text-[#006948]">
              {paymentMethodBreakdown.upiPercent}%
            </span>
          </div>

          <div className="bg-[#eff3ff] p-3 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#894d00] text-[20px]">payments</span>
              <div>
                <span className="text-[11px] text-[#3e4942] block">Cash</span>
                <span className="text-[14px] font-bold text-[#121c2a] tabular-nums">
                  ₹{paymentMethodBreakdown.cashTotal}
                </span>
              </div>
            </div>
            <span className="text-[11px] font-bold text-[#894d00]">
              {paymentMethodBreakdown.cashPercent}%
            </span>
          </div>
        </div>
      </div>

      {/* Appa WhatsApp Contact Settings */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#dfe9fc]/60 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-[#ffdcc0] flex items-center justify-center text-[#894d00]">
            <span className="material-symbols-outlined text-[18px]">chat</span>
          </div>
          <div>
            <span className="text-[13px] font-bold text-[#121c2a]">Appa's WhatsApp Contact</span>
            <p className="text-[11px] text-[#3e4942]">For prefilling settlement & expense notifications</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-[#3e4942] uppercase tracking-wider block">
            Phone Number (with Country Code)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="tel"
              value={appaPhoneInput}
              onChange={(e) => setAppaPhoneInput(e.target.value)}
              placeholder="+919876543210"
              className="flex-1 px-3 py-2 bg-[#f8f9ff] border border-[#dfe9fc] rounded-xl text-[13px] text-[#121c2a] focus:outline-none focus:border-[#006948]"
            />
            <button
              onClick={handleSaveAppaPhone}
              className="px-4 py-2 bg-[#006948] hover:bg-[#00855d] text-white text-[12px] font-semibold rounded-xl cursor-pointer"
            >
              Save
            </button>
          </div>
        </div>
      </div>

      {/* Budget Configuration */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#dfe9fc]/60 space-y-3">
        <span className="text-[13px] font-bold text-[#121c2a]">Monthly Budget Goal</span>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={budgetInput}
            onChange={(e) => setBudgetInput(e.target.value)}
            className="flex-1 px-3 py-2 bg-[#f8f9ff] border border-[#dfe9fc] rounded-xl text-[14px] font-bold text-[#121c2a] focus:outline-none focus:border-[#006948]"
          />
          <button
            onClick={handleSaveBudget}
            className="px-4 py-2 bg-[#006948] hover:bg-[#00855d] text-white text-[12px] font-semibold rounded-xl cursor-pointer"
          >
            Save
          </button>
        </div>
      </div>

      {/* Google Sheets Dual-Sync Integration */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#dfe9fc]/60 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#006948] text-[20px]">sync</span>
            <span className="text-[13px] font-bold text-[#121c2a]">Google Sheets Dual-Sync</span>
          </div>

          <button
            onClick={() => setShowScriptModal(true)}
            className="text-[11px] text-[#006948] font-semibold hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[14px]">code</span>
            <span>View Apps Script</span>
          </button>
        </div>

        <p className="text-[11px] text-[#3e4942] leading-relaxed">
          Keep your transactions in your private Google Sheets spreadsheet via Google Apps Script Webhook. All credentials stay securely on the backend.
        </p>

        <div className="space-y-2">
          <label className="text-[11px] font-semibold text-[#3e4942] uppercase tracking-wider block">
            Apps Script Webhook URL
          </label>
          <input
            type="url"
            value={scriptUrlInput}
            onChange={(e) => setScriptUrlInput(e.target.value)}
            placeholder="https://script.google.com/macros/s/.../exec"
            className="w-full px-3 py-2 bg-[#f8f9ff] border border-[#dfe9fc] rounded-xl text-[12px] text-[#121c2a] focus:outline-none focus:border-[#006948]"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleSaveSyncUrl}
            className="flex-1 py-2 bg-[#eff3ff] hover:bg-[#dfe9fc] text-[#121c2a] text-[12px] font-semibold rounded-xl cursor-pointer transition-colors"
          >
            Save URL
          </button>

          <button
            onClick={handleTriggerSync}
            disabled={isSyncing}
            className="flex-1 py-2 bg-[#006948] hover:bg-[#00855d] text-white text-[12px] font-semibold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer disabled:bg-[#bdcac0]"
          >
            {isSyncing ? (
              <span className="material-symbols-outlined text-[16px] animate-spin">refresh</span>
            ) : (
              <span className="material-symbols-outlined text-[16px]">cloud_upload</span>
            )}
            <span>{isSyncing ? 'Syncing...' : 'Sync to Sheets'}</span>
          </button>
        </div>

        {state.settings.lastSyncedAt && (
          <p className="text-[10px] text-[#006948] font-medium text-center">
            Last dual-synced: {new Date(state.settings.lastSyncedAt).toLocaleString()}
          </p>
        )}

        {syncStatus && (
          <p className="text-[11px] text-[#006948] font-semibold text-center bg-[#88f8c4]/20 py-1 rounded-lg">
            {syncStatus}
          </p>
        )}
      </div>

      {/* Export & Data Backup */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#dfe9fc]/60 space-y-3">
        <span className="text-[13px] font-bold text-[#121c2a]">Backup & Data Export</span>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleExportCSV}
            className="py-2.5 bg-[#eff3ff] hover:bg-[#dfe9fc] text-[#121c2a] text-[12px] font-semibold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
          >
            <span className="material-symbols-outlined text-[16px] text-[#006948]">table_view</span>
            <span>Export CSV</span>
          </button>

          <button
            onClick={handleExportJSON}
            className="py-2.5 bg-[#eff3ff] hover:bg-[#dfe9fc] text-[#121c2a] text-[12px] font-semibold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
          >
            <span className="material-symbols-outlined text-[16px] text-[#4648d4]">download</span>
            <span>JSON Backup</span>
          </button>
        </div>
      </div>

      {/* Google Apps Script Modal */}
      {showScriptModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md max-h-[85vh] bg-white rounded-2xl p-5 shadow-2xl flex flex-col space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[16px] font-bold text-[#121c2a]">Google Apps Script Setup</h3>
              <button
                onClick={() => setShowScriptModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full text-[#3e4942] hover:bg-[#eff3ff]"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <p className="text-[11px] text-[#3e4942]">
              1. Open a Google Sheet. Go to <strong>Extensions &gt; Apps Script</strong>.<br />
              2. Paste the code below and click <strong>Save</strong>.<br />
              3. Click <strong>Deploy &gt; New deployment &gt; Web app</strong>. Set "Who has access" to "Anyone".<br />
              4. Copy the Web app URL and paste it into the field above.
            </p>

            <textarea
              readOnly
              value={appsScriptCode}
              rows={10}
              className="w-full p-2.5 bg-[#f8f9ff] border border-[#dfe9fc] rounded-xl text-[11px] font-mono text-[#121c2a] select-all focus:outline-none"
            />

            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(appsScriptCode);
                  setSyncStatus('Apps Script code copied to clipboard!');
                  setTimeout(() => setSyncStatus(null), 2500);
                }}
                className="px-4 py-2 bg-[#006948] text-white text-[12px] font-semibold rounded-xl"
              >
                Copy Code
              </button>
              <button
                onClick={() => setShowScriptModal(false)}
                className="px-4 py-2 border border-[#dfe9fc] text-[#3e4942] text-[12px] font-semibold rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
