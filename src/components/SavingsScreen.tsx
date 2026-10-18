import React, { useState } from 'react';
import { useApp } from '../context/AppContext';

export const SavingsScreen: React.FC = () => {
  const { state, updateEmergencyFund, addSavingsGoal, updateSavingsGoal, deleteSavingsGoal } = useApp();

  const emergencyFund = state.savings.emergencyFund;
  const goals = state.savings.goals || [];

  const [showDepositModal, setShowDepositModal] = useState<boolean>(false);
  const [showEditTargetModal, setShowEditTargetModal] = useState<boolean>(false);
  const [showAddGoalModal, setShowAddGoalModal] = useState<boolean>(false);

  const [depositAmount, setDepositAmount] = useState<string>('300');
  const [newTarget, setNewTarget] = useState<string>(String(emergencyFund.target));

  // Goal Form State
  const [goalTitle, setGoalTitle] = useState('');
  const [goalTargetStr, setGoalTargetStr] = useState('');
  const [goalIcon, setGoalIcon] = useState('devices');

  const emergencyPercent = Math.min(
    100,
    Math.round((emergencyFund.current / (emergencyFund.target || 1)) * 100)
  );

  const handleDepositToEmergency = async (e: React.FormEvent) => {
    e.preventDefault();
    const add = parseInt(depositAmount, 10) || 0;
    if (add <= 0) return;

    await updateEmergencyFund(emergencyFund.current + add, emergencyFund.target);
    setShowDepositModal(false);
    setDepositAmount('300');
  };

  const handleUpdateTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = parseInt(newTarget, 10) || 0;
    if (t <= 0) return;

    await updateEmergencyFund(emergencyFund.current, t);
    setShowEditTargetModal(false);
  };

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = parseInt(goalTargetStr, 10) || 0;
    if (target <= 0 || !goalTitle.trim()) return;

    await addSavingsGoal({
      title: goalTitle.trim(),
      target,
      current: 0,
      icon: goalIcon || 'savings',
      deadline: '',
    });

    setShowAddGoalModal(false);
    setGoalTitle('');
    setGoalTargetStr('');
  };

  return (
    <div className="flex flex-col w-full gap-4 pb-28">
      {/* Top Banner */}
      <div className="flex items-center justify-between bg-white px-4 py-3 rounded-2xl border border-[#dfe9fc]/60 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#e1e0ff] flex items-center justify-center text-[#4648d4]">
            <span className="material-symbols-outlined text-[22px]">shield</span>
          </div>
          <div>
            <h2 className="text-[16px] font-bold text-[#121c2a]">Savings & Emergency Buffer</h2>
            <p className="text-[11px] text-[#3e4942]">Financial security & milestone goals</p>
          </div>
        </div>

        <button
          onClick={() => setShowAddGoalModal(true)}
          className="bg-[#4648d4] hover:bg-[#6063ee] text-white px-3 py-2 rounded-xl text-[12px] font-semibold flex items-center gap-1 shadow-xs active:scale-95 transition-all cursor-pointer"
        >
          <span className="material-symbols-outlined text-[16px]">add</span>
          <span>New Goal</span>
        </button>
      </div>

      {/* Emergency Fund Hero Card */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#dfe9fc]/70 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#e1e0ff] flex items-center justify-center text-[#4648d4]">
              <span className="material-symbols-outlined text-[20px]">security</span>
            </div>
            <div>
              <h3 className="text-[16px] font-bold text-[#121c2a]">{emergencyFund.title}</h3>
              <p className="text-[11px] text-[#3e4942]">{emergencyFund.subtitle}</p>
            </div>
          </div>
          <span className="text-[13px] font-bold text-[#4648d4] bg-[#e1e0ff]/70 px-3 py-1 rounded-full">
            {emergencyPercent}%
          </span>
        </div>

        {/* Big Numbers */}
        <div className="flex items-baseline justify-between pt-1">
          <div>
            <span className="text-[32px] font-bold text-[#121c2a] tracking-tight tabular-nums">
              ₹{emergencyFund.current.toLocaleString('en-IN')}
            </span>
            <span className="text-[12px] text-[#3e4942] ml-1.5">
              of ₹{emergencyFund.target.toLocaleString('en-IN')} goal
            </span>
          </div>
          <span className="text-[12px] text-[#894d00] font-medium">
            ₹{Math.max(0, emergencyFund.target - emergencyFund.current).toLocaleString('en-IN')} remaining
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-[#e6eeff] rounded-full h-3 overflow-hidden">
          <div
            className="bg-[#6063ee] h-3 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, Math.max(3, emergencyPercent))}%` }}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => setShowDepositModal(true)}
            className="flex-1 py-2.5 rounded-xl bg-[#4648d4] hover:bg-[#6063ee] text-white text-[13px] font-semibold flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-98 transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            <span>Deposit Money</span>
          </button>

          <button
            onClick={() => {
              setNewTarget(String(emergencyFund.target));
              setShowEditTargetModal(true);
            }}
            className="px-4 py-2.5 rounded-xl bg-[#eff3ff] hover:bg-[#dfe9fc] text-[#121c2a] text-[13px] font-semibold flex items-center justify-center gap-1 cursor-pointer transition-colors"
          >
            <span className="material-symbols-outlined text-[18px] text-[#3e4942]">tune</span>
            <span>Target</span>
          </button>
        </div>
      </div>

      {/* Custom Goals List */}
      <div className="space-y-3">
        <h3 className="text-[17px] font-semibold text-[#121c2a] px-1">Savings Goals</h3>

        {goals.map((g) => {
          const pct = Math.min(100, Math.round((g.current / (g.target || 1)) * 100));
          return (
            <div
              key={g.id}
              className="bg-white rounded-xl p-4 shadow-xs border border-[#dfe9fc]/60 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#eff3ff] flex items-center justify-center text-[#4648d4]">
                    <span className="material-symbols-outlined text-[18px]">{g.icon}</span>
                  </div>
                  <div>
                    <h4 className="text-[14px] font-semibold text-[#121c2a]">{g.title}</h4>
                    <span className="text-[11px] text-[#3e4942]">
                      ₹{g.current.toLocaleString('en-IN')} of ₹{g.target.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-bold text-[#4648d4] bg-[#e1e0ff]/50 px-2 py-0.5 rounded-full">
                    {pct}%
                  </span>
                  <button
                    onClick={() => deleteSavingsGoal(g.id)}
                    className="text-[#6d7a72] hover:text-[#ba1a1a] p-1"
                  >
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                  </button>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-[#e6eeff] rounded-full h-2 overflow-hidden">
                <div
                  className="bg-[#006948] h-2 rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>

              {/* Quick Add Deposit to Goal */}
              <div className="flex justify-end gap-2 pt-1">
                {[100, 500, 1000].map((step) => (
                  <button
                    key={step}
                    onClick={() =>
                      updateSavingsGoal({
                        ...g,
                        current: Math.min(g.target, g.current + step),
                      })
                    }
                    className="px-2.5 py-1 rounded-lg bg-[#eff3ff] hover:bg-[#dfe9fc] text-[11px] font-semibold text-[#121c2a] active:scale-95 cursor-pointer"
                  >
                    +₹{step}
                  </button>
                ))}
              </div>
            </div>
          );
        })}

        {goals.length === 0 && (
          <div className="bg-white p-5 rounded-xl text-center text-[#6d7a72] text-[13px] border border-[#dfe9fc]/50">
            No specific savings goals yet. Add one like "Drawing Tablet" or "Festival Trip"!
          </div>
        )}
      </div>

      {/* Deposit to Emergency Modal */}
      {showDepositModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[16px] font-bold text-[#121c2a]">Deposit to Emergency Fund</h3>
              <button
                onClick={() => setShowDepositModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full text-[#3e4942] hover:bg-[#eff3ff]"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={handleDepositToEmergency} className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-[#3e4942] uppercase tracking-wider block mb-1">
                  Deposit Amount (₹)
                </label>
                <input
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="300"
                  autoFocus
                  required
                  className="w-full px-3 py-2 bg-[#f8f9ff] border border-[#dfe9fc] rounded-xl text-[20px] font-bold text-[#121c2a] focus:outline-none focus:border-[#4648d4]"
                />
              </div>

              <div className="flex gap-2">
                {[100, 200, 500, 1000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setDepositAmount(String(amt))}
                    className="flex-1 py-1.5 rounded-lg bg-[#eff3ff] hover:bg-[#dfe9fc] text-[11px] font-semibold text-[#121c2a]"
                  >
                    ₹{amt}
                  </button>
                ))}
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowDepositModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-[#dfe9fc] text-[13px] font-semibold text-[#3e4942]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-[#4648d4] hover:bg-[#6063ee] text-white text-[13px] font-semibold shadow-xs"
                >
                  Confirm Deposit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Target Modal */}
      {showEditTargetModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[16px] font-bold text-[#121c2a]">Adjust Emergency Target</h3>
              <button
                onClick={() => setShowEditTargetModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full text-[#3e4942] hover:bg-[#eff3ff]"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={handleUpdateTarget} className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-[#3e4942] uppercase tracking-wider block mb-1">
                  Target Buffer Goal (₹)
                </label>
                <input
                  type="number"
                  value={newTarget}
                  onChange={(e) => setNewTarget(e.target.value)}
                  placeholder="3000"
                  autoFocus
                  required
                  className="w-full px-3 py-2 bg-[#f8f9ff] border border-[#dfe9fc] rounded-xl text-[18px] font-bold text-[#121c2a] focus:outline-none focus:border-[#4648d4]"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditTargetModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-[#dfe9fc] text-[13px] font-semibold text-[#3e4942]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-[#4648d4] hover:bg-[#6063ee] text-white text-[13px] font-semibold shadow-xs"
                >
                  Save Goal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Goal Modal */}
      {showAddGoalModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[16px] font-bold text-[#121c2a]">New Savings Goal</h3>
              <button
                onClick={() => setShowAddGoalModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full text-[#3e4942] hover:bg-[#eff3ff]"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateGoal} className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-[#3e4942] uppercase tracking-wider block mb-1">
                  Goal Name
                </label>
                <input
                  type="text"
                  value={goalTitle}
                  onChange={(e) => setGoalTitle(e.target.value)}
                  placeholder="e.g. Drawing Tablet"
                  required
                  className="w-full px-3 py-2 bg-[#f8f9ff] border border-[#dfe9fc] rounded-xl text-[13px] text-[#121c2a] focus:outline-none focus:border-[#4648d4]"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#3e4942] uppercase tracking-wider block mb-1">
                  Target Amount (₹)
                </label>
                <input
                  type="number"
                  value={goalTargetStr}
                  onChange={(e) => setGoalTargetStr(e.target.value)}
                  placeholder="10000"
                  required
                  className="w-full px-3 py-2 bg-[#f8f9ff] border border-[#dfe9fc] rounded-xl text-[14px] font-bold text-[#121c2a] focus:outline-none focus:border-[#4648d4]"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#3e4942] uppercase tracking-wider block mb-1">
                  Icon
                </label>
                <div className="flex gap-2">
                  {['devices', 'flight', 'backpack', 'laptop_mac', 'savings'].map((ic) => (
                    <button
                      key={ic}
                      type="button"
                      onClick={() => setGoalIcon(ic)}
                      className={`p-2 rounded-xl border flex items-center justify-center ${
                        goalIcon === ic
                          ? 'bg-[#4648d4] text-white border-[#4648d4]'
                          : 'bg-[#f8f9ff] text-[#3e4942] border-[#dfe9fc]'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[18px]">{ic}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddGoalModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-[#dfe9fc] text-[13px] font-semibold text-[#3e4942]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-[#4648d4] hover:bg-[#6063ee] text-white text-[13px] font-semibold shadow-xs"
                >
                  Create Goal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
