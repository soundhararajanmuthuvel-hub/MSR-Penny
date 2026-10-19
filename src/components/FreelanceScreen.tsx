import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { FreelanceJob, Milestone, PaymentMethod } from '../types';

export const FreelanceScreen: React.FC = () => {
  const {
    state,
    addFreelanceJob,
    updateFreelanceJob,
    deleteFreelanceJob,
    recordCustomFreelancePayment,
    addTransaction,
  } = useApp();

  // Modals
  const [showAddJobModal, setShowAddJobModal] = useState(false);
  const [editingJob, setEditingJob] = useState<FreelanceJob | null>(null);
  const [customPaymentJob, setCustomPaymentJob] = useState<{ job: FreelanceJob; milestoneId?: string } | null>(null);
  const [showAddCostModal, setShowAddCostModal] = useState<string | null>(null); // jobId
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Design Types Options
  const DESIGN_TYPES = [
    'Poster',
    'Social Media',
    'Banner / Flex',
    'Branding / Logo',
    'UI / Web',
    'Certificate',
    'Other',
  ];

  // New Job Form State
  const [jobTitle, setJobTitle] = useState('');
  const [clientName, setClientName] = useState('');
  const [designType, setDesignType] = useState('Poster');
  const [totalFeeStr, setTotalFeeStr] = useState('');
  const [advanceReceivedStr, setAdvanceReceivedStr] = useState('0');
  const [advancePaymentMethod, setAdvancePaymentMethod] = useState<PaymentMethod>('upi');
  const [projectStatus, setProjectStatus] = useState<'in_progress' | 'awaiting_payment' | 'completed'>('in_progress');
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  const [initialCostTitle, setInitialCostTitle] = useState('');
  const [initialCostStr, setInitialCostStr] = useState('');
  const [initialCostPaymentMethod, setInitialCostPaymentMethod] = useState<PaymentMethod>('cash');
  const [jobNotes, setJobNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Custom Payment State
  const [customPaymentAmount, setCustomPaymentAmount] = useState('800');
  const [customPaymentMethod, setCustomPaymentMethod] = useState<PaymentMethod>('upi');
  const [customPaymentNote, setCustomPaymentNote] = useState('');

  // Edit Job State
  const [editTitle, setEditTitle] = useState('');
  const [editClient, setEditClient] = useState('');
  const [editTotalFee, setEditTotalFee] = useState('');
  const [editPaidAmount, setEditPaidAmount] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editDesignType, setEditDesignType] = useState('Poster');
  const [editStatus, setEditStatus] = useState<'in_progress' | 'awaiting_payment' | 'completed'>('in_progress');
  const [editNotes, setEditNotes] = useState('');
  const [editMilestones, setEditMilestones] = useState<Milestone[]>([]);

  // New Cost Form State
  const [costTitle, setCostTitle] = useState('Poster print sample');
  const [costAmountStr, setCostAmountStr] = useState('50');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const resetNewJobForm = () => {
    setJobTitle('');
    setClientName('');
    setDesignType('Poster');
    setTotalFeeStr('');
    setAdvanceReceivedStr('0');
    setAdvancePaymentMethod('upi');
    setProjectStatus('in_progress');
    const d = new Date();
    d.setDate(d.getDate() + 7);
    setDueDate(d.toISOString().split('T')[0]);
    setInitialCostTitle('');
    setInitialCostStr('');
    setInitialCostPaymentMethod('cash');
    setJobNotes('');
    setFormError(null);
    setIsSubmitting(false);
  };

  const freelanceJobs = state.freelanceJobs || [];

  // Summary Metrics
  let totalInvoiced = 0;
  let totalCollected = 0;
  let totalPending = 0;
  let totalCosts = 0;

  freelanceJobs.forEach((j) => {
    totalInvoiced += Number(j.totalFee) || 0;
    totalCollected += Number(j.paidAmount) || 0;
    totalPending += Number(j.pendingAmount) || 0;
    (j.costs || []).forEach((c) => {
      totalCosts += Number(c.amount) || 0;
    });
  });

  const netEarnings = totalCollected - totalCosts;

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const title = jobTitle.trim();
    const client = clientName.trim();
    const fee = parseInt(totalFeeStr, 10) || 0;
    const advance = parseInt(advanceReceivedStr, 10) || 0;
    const initialCost = parseInt(initialCostStr, 10) || 0;

    if (!title) {
      setFormError('Please enter a project title (e.g. Fest Social Posters).');
      return;
    }
    if (!client) {
      setFormError('Please enter client or organization name.');
      return;
    }
    if (fee <= 0) {
      setFormError('Agreed amount (Total Fee) must be greater than ₹0.');
      return;
    }
    if (advance < 0) {
      setFormError('Advance received cannot be negative.');
      return;
    }
    if (advance > fee) {
      setFormError(`Advance received (₹${advance}) cannot exceed agreed total fee (₹${fee}).`);
      return;
    }
    if (initialCost < 0) {
      setFormError('Work costs cannot be negative.');
      return;
    }

    setIsSubmitting(true);

    try {
      const remaining = Math.max(0, fee - advance);
      const computedStatus: 'in_progress' | 'awaiting_payment' | 'completed' =
        remaining === 0 ? 'completed' : projectStatus;

      const milestones: Milestone[] = [];
      const nowStr = new Date().toISOString().split('T')[0];

      if (advance > 0 && remaining > 0) {
        milestones.push({
          id: 'm-' + Date.now() + '-1',
          title: 'Advance Payment',
          amount: advance,
          paid: true,
          paidAt: nowStr,
        });
        milestones.push({
          id: 'm-' + Date.now() + '-2',
          title: 'Final Delivery & Balance',
          amount: remaining,
          paid: false,
        });
      } else if (advance === fee) {
        milestones.push({
          id: 'm-' + Date.now() + '-1',
          title: 'Full Agreed Fee Paid',
          amount: fee,
          paid: true,
          paidAt: nowStr,
        });
      } else {
        const m1 = Math.round(fee / 2);
        const m2 = fee - m1;
        milestones.push({
          id: 'm-' + Date.now() + '-1',
          title: 'Advance / First Draft (50%)',
          amount: m1,
          paid: false,
        });
        milestones.push({
          id: 'm-' + Date.now() + '-2',
          title: 'Final Delivery & Balance',
          amount: m2,
          paid: false,
        });
      }

      const initialCosts = [];
      if (initialCost > 0) {
        initialCosts.push({
          id: 'cost-' + Date.now(),
          title: initialCostTitle.trim() || 'Printing & materials',
          amount: initialCost,
          date: nowStr,
        });
      }

      const jobId = 'job-' + Date.now();

      // 1. Add Freelance Job
      await addFreelanceJob({
        title,
        clientName: client,
        designType,
        totalFee: fee,
        paidAmount: advance,
        pendingAmount: remaining,
        status: computedStatus,
        dueDate,
        milestones,
        costs: initialCosts,
        notes: jobNotes.trim() || undefined,
      });

      // 2. If advance received, record income transaction
      if (advance > 0) {
        await addTransaction({
          type: 'income',
          title: `${title} - Advance Payment`,
          amount: advance,
          category: 'Freelance',
          date: nowStr,
          paymentMethod: advancePaymentMethod,
          isAppaReimbursable: false,
          isFamilyReimbursable: false,
          appaSettled: false,
          freelanceJobId: jobId,
          milestoneTitle: 'Advance Payment',
          notes: `Advance from ${client}${jobNotes ? ` (${jobNotes})` : ''}`,
        });
      }

      // 3. If initial work cost entered, record expense transaction
      if (initialCost > 0) {
        await addTransaction({
          type: 'expense',
          title: `${title} - ${initialCostTitle.trim() || 'Prints & materials'}`,
          amount: initialCost,
          category: 'Freelance',
          date: nowStr,
          paymentMethod: initialCostPaymentMethod,
          isAppaReimbursable: false,
          isFamilyReimbursable: false,
          appaSettled: false,
          notes: `Work costs for ${client}`,
        });
      }

      setShowAddJobModal(false);
      resetNewJobForm();
      showToast(`Created new freelance job "${title}" successfully!`);
    } catch (err: any) {
      setFormError(err.message || 'Failed to save new freelance job. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditJobModal = (job: FreelanceJob) => {
    setEditingJob(job);
    setEditTitle(job.title);
    setEditClient(job.clientName);
    setEditTotalFee(String(job.totalFee));
    setEditPaidAmount(String(job.paidAmount));
    setEditDueDate(job.dueDate || '');
    setEditDesignType(job.designType || 'Poster');
    setEditStatus(job.status || 'in_progress');
    setEditNotes(job.notes || '');
    setEditMilestones(JSON.parse(JSON.stringify(job.milestones || [])));
  };

  const handleSaveEditJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingJob) return;

    const totalFee = parseInt(editTotalFee, 10) || 0;
    const paidAmount = parseInt(editPaidAmount, 10) || 0;
    const pendingAmount = Math.max(0, totalFee - paidAmount);
    const status = pendingAmount === 0 ? 'completed' : editStatus;

    const updated: FreelanceJob = {
      ...editingJob,
      title: editTitle.trim(),
      clientName: editClient.trim(),
      totalFee,
      paidAmount,
      pendingAmount,
      dueDate: editDueDate,
      designType: editDesignType,
      status,
      notes: editNotes.trim() || undefined,
      milestones: editMilestones,
    };

    await updateFreelanceJob(updated);
    setEditingJob(null);
    showToast(`Saved updates to "${updated.title}"!`);
  };

  const openCustomPaymentModal = (job: FreelanceJob, milestone?: Milestone) => {
    setCustomPaymentJob({ job, milestoneId: milestone?.id });
    setCustomPaymentAmount(String(milestone ? milestone.amount : job.pendingAmount || 500));
    setCustomPaymentMethod('upi');
    setCustomPaymentNote(milestone ? `${milestone.title} payment` : 'Client payment installment');
  };

  const handleSaveCustomPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customPaymentJob) return;

    const amount = parseInt(customPaymentAmount, 10) || 0;
    if (amount <= 0) return;

    await recordCustomFreelancePayment(
      customPaymentJob.job.id,
      amount,
      customPaymentMethod,
      customPaymentNote,
      customPaymentJob.milestoneId
    );

    setCustomPaymentJob(null);
    showToast(`Recorded received payment of ₹${amount.toLocaleString('en-IN')}!`);
  };

  const handleAddCost = async (jobId: string, e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseInt(costAmountStr, 10) || 0;
    if (amount <= 0 || !costTitle.trim()) return;

    const job = freelanceJobs.find((j) => j.id === jobId);
    if (!job) return;

    const newCost = {
      id: 'cost-' + Date.now(),
      title: costTitle.trim(),
      amount,
      date: new Date().toISOString().split('T')[0],
    };

    const updatedJob: FreelanceJob = {
      ...job,
      costs: [...(job.costs || []), newCost],
    };

    await Promise.all([
      updateFreelanceJob(updatedJob),
      addTransaction({
        type: 'expense',
        title: `${job.title} - ${costTitle}`,
        amount,
        category: 'Freelance',
        date: new Date().toISOString().split('T')[0],
        paymentMethod: 'cash',
        isAppaReimbursable: false,
        appaSettled: false,
        notes: `Work expense for ${job.clientName}`,
      }),
    ]);

    setShowAddCostModal(null);
    setCostTitle('');
    setCostAmountStr('');
    showToast(`Added work cost of ₹${amount} and recorded expense!`);
  };

  return (
    <div className="flex flex-col w-full gap-4 pb-28">
      {/* Top Banner */}
      <div className="flex items-center justify-between bg-white px-4 py-3 rounded-2xl border border-[#dfe9fc]/60 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#88f8c4]/40 flex items-center justify-center text-[#006948]">
            <span className="material-symbols-outlined text-[22px]">palette</span>
          </div>
          <div>
            <h2 className="text-[16px] font-bold text-[#121c2a]">Poster & Client Jobs</h2>
            <p className="text-[11px] text-[#3e4942]">Freelance income, milestones & costs</p>
          </div>
        </div>

        <button
          id="btn-new-job"
          onClick={() => setShowAddJobModal(true)}
          className="bg-[#006948] hover:bg-[#00855d] text-white px-3.5 py-2 rounded-xl text-[12px] font-semibold flex items-center gap-1 shadow-xs active:scale-95 transition-all cursor-pointer"
        >
          <span className="material-symbols-outlined text-[16px]">add</span>
          <span>New Job</span>
        </button>
      </div>

      {/* 4 Metrics Grid */}
      <div className="grid grid-cols-2 gap-2.5">
        {/* Pending Client Balances */}
        <div className="bg-[#eff3ff] p-3.5 rounded-xl border border-[#dfe9fc]/70 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-[#894d00]">Pending Balances</span>
            <span className="material-symbols-outlined text-[16px] text-[#894d00]">pending_actions</span>
          </div>
          <div className="mt-2">
            <p className="text-[22px] font-bold text-[#ac6200] tabular-nums">
              ₹{totalPending.toLocaleString('en-IN')}
            </p>
            <span className="text-[10px] text-[#3e4942]">Uncollected pipeline</span>
          </div>
        </div>

        {/* Collected Inflows */}
        <div className="bg-white p-3.5 rounded-xl border border-[#dfe9fc]/60 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-[#006948]">Money Received</span>
            <span className="material-symbols-outlined text-[16px] text-[#006948]">payments</span>
          </div>
          <div className="mt-2">
            <p className="text-[22px] font-bold text-[#006948] tabular-nums">
              ₹{totalCollected.toLocaleString('en-IN')}
            </p>
            <span className="text-[10px] text-[#3e4942]">Settled into wallet/UPI</span>
          </div>
        </div>

        {/* Work Costs */}
        <div className="bg-white p-3.5 rounded-xl border border-[#dfe9fc]/60 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-[#3e4942]">Work Costs / Prints</span>
            <span className="material-symbols-outlined text-[16px] text-[#ba1a1a]">print</span>
          </div>
          <div className="mt-2">
            <p className="text-[20px] font-bold text-[#121c2a] tabular-nums">
              ₹{totalCosts.toLocaleString('en-IN')}
            </p>
            <span className="text-[10px] text-[#3e4942]">Materials & paper</span>
          </div>
        </div>

        {/* Net Profit */}
        <div className="bg-white p-3.5 rounded-xl border border-[#dfe9fc]/60 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-[#4648d4]">Net Freelance Profit</span>
            <span className="material-symbols-outlined text-[16px] text-[#4648d4]">trending_up</span>
          </div>
          <div className="mt-2">
            <p className="text-[20px] font-bold text-[#4648d4] tabular-nums">
              ₹{netEarnings.toLocaleString('en-IN')}
            </p>
            <span className="text-[10px] text-[#3e4942]">Received minus costs</span>
          </div>
        </div>
      </div>

      {/* Jobs Feed */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-[17px] font-semibold text-[#121c2a]">Active Projects ({freelanceJobs.length})</h3>
        </div>

        {freelanceJobs.map((job) => {
          const progressPercent = Math.min(100, Math.round((job.paidAmount / (job.totalFee || 1)) * 100));
          return (
            <div
              key={job.id}
              className="bg-white rounded-2xl p-4 shadow-sm border border-[#dfe9fc]/60 space-y-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[#eff3ff] text-[#4648d4]">
                      {job.clientName}
                    </span>
                    {job.designType && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[#88f8c4]/30 text-[#006948]">
                        {job.designType}
                      </span>
                    )}
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                        job.status === 'completed'
                          ? 'bg-[#88f8c4]/30 text-[#006948]'
                          : job.status === 'awaiting_payment'
                          ? 'bg-[#ffeed4] text-[#894d00]'
                          : 'bg-[#eff3ff] text-[#3e4942]'
                      }`}
                    >
                      {job.status === 'completed'
                        ? 'Completed'
                        : job.status === 'awaiting_payment'
                        ? 'Awaiting Payment'
                        : 'In Progress'}
                    </span>
                  </div>
                  <h4 className="text-[16px] font-bold text-[#121c2a] mt-1">{job.title}</h4>
                  <p className="text-[11px] text-[#3e4942]">Due: {job.dueDate || 'Flexible'}</p>
                  {job.notes && (
                    <p className="text-[11px] text-[#556059] bg-[#f8f9ff] px-2.5 py-1.5 rounded-lg border border-[#dfe9fc]/50 mt-1.5">
                      <span className="font-semibold text-[#121c2a]">Note:</span> {job.notes}
                    </p>
                  )}
                </div>

                <div className="text-right">
                  <span className="text-[18px] font-bold text-[#121c2a] tabular-nums">
                    ₹{job.totalFee.toLocaleString('en-IN')}
                  </span>
                  <p className="text-[11px] font-medium mt-0.5">
                    {job.pendingAmount > 0 ? (
                      <span className="text-[#894d00]">₹{job.pendingAmount.toLocaleString('en-IN')} pending</span>
                    ) : (
                      <span className="text-[#006948] font-bold">Fully Paid</span>
                    )}
                  </p>
                </div>
              </div>

              {/* Progress Bar & Custom Received Amount Trigger */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-[11px] text-[#3e4942]">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-[#121c2a]">₹{job.paidAmount} received</span>
                    <button
                      onClick={() => openCustomPaymentModal(job)}
                      className="text-[10px] text-[#006948] hover:underline flex items-center gap-0.5 bg-[#88f8c4]/30 px-1.5 py-0.5 rounded-md cursor-pointer font-medium"
                      title="Record a custom amount payment from client"
                    >
                      <span className="material-symbols-outlined text-[12px]">add</span>
                      <span>Payment</span>
                    </button>
                  </div>
                  <span className="font-bold">{progressPercent}%</span>
                </div>
                <div className="w-full bg-[#e6eeff] rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-[#006948] h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Milestones List */}
              <div className="bg-[#f8f9ff] rounded-xl p-3 border border-[#dfe9fc]/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-[#3e4942] uppercase tracking-wider">
                    Milestones
                  </span>
                  <button
                    onClick={() => openEditJobModal(job)}
                    className="text-[10px] text-[#006948] hover:underline font-semibold flex items-center gap-0.5"
                  >
                    <span className="material-symbols-outlined text-[12px]">edit</span>
                    <span>Edit Milestones</span>
                  </button>
                </div>

                {job.milestones.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between py-1.5 border-b border-[#dfe9fc]/40 last:border-0"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`material-symbols-outlined text-[18px] ${
                          m.paid ? 'text-[#006948]' : 'text-[#6d7a72]'
                        }`}
                        style={m.paid ? { fontVariationSettings: "'FILL' 1" } : {}}
                      >
                        {m.paid ? 'check_circle' : 'radio_button_unchecked'}
                      </span>
                      <span className={`text-[12px] ${m.paid ? 'line-through text-[#6d7a72]' : 'text-[#121c2a] font-medium'}`}>
                        {m.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-bold text-[#121c2a] tabular-nums">
                        ₹{m.amount}
                      </span>
                      {m.paid ? (
                        <span className="text-[10px] bg-[#88f8c4]/40 text-[#006948] px-2 py-0.5 rounded-full font-semibold">
                          Paid
                        </span>
                      ) : (
                        <button
                          onClick={() => openCustomPaymentModal(job, m)}
                          className="text-[10px] bg-[#006948] hover:bg-[#00855d] text-white px-2.5 py-0.5 rounded-full font-semibold active:scale-95 transition-transform cursor-pointer"
                        >
                          Receive
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Work Costs & Card Actions: Add Cost, Edit Job, Delete Job */}
              <div className="flex items-center justify-between pt-1">
                <button
                  onClick={() => setShowAddCostModal(job.id)}
                  className="text-[11px] text-[#3e4942] hover:text-[#006948] font-medium flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[15px]">add_circle</span>
                  <span>Add Project Cost ({job.costs?.length || 0})</span>
                </button>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => openEditJobModal(job)}
                    className="text-[11px] text-[#006948] hover:underline font-semibold flex items-center gap-0.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[14px]">edit</span>
                    <span>Edit Job</span>
                  </button>

                  <button
                    onClick={() => deleteFreelanceJob(job.id)}
                    className="text-[11px] text-[#ba1a1a] hover:underline cursor-pointer"
                  >
                    Delete Job
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {freelanceJobs.length === 0 && (
          <div className="bg-white p-8 rounded-3xl text-center border border-[#dfe9fc]/60 shadow-xs space-y-3">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-[#88f8c4]/40 flex items-center justify-center text-[#006948]">
              <span className="material-symbols-outlined text-[32px]">palette</span>
            </div>
            <div>
              <h4 className="text-[15px] font-bold text-[#121c2a]">No Freelance Jobs Yet</h4>
              <p className="text-[12px] text-[#3e4942] mt-1 max-w-xs mx-auto">
                Track your poster design clients, milestone payments, printing work costs, and net profits in one place.
              </p>
            </div>
            <button
              id="btn-create-first-job"
              onClick={() => setShowAddJobModal(true)}
              className="bg-[#006948] hover:bg-[#00855d] text-white px-4 py-2.5 rounded-xl text-[13px] font-semibold inline-flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer mt-1"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              <span>+ Create First Job</span>
            </button>
          </div>
        )}
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-[#121c2a] text-white px-4 py-2.5 rounded-full shadow-lg text-[13px] flex items-center gap-2 z-50 animate-fade-in">
          <span className="material-symbols-outlined text-[18px] text-[#88f8c4]">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* New Freelance Job Modal */}
      {showAddJobModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fade-in">
          <div className="w-full max-w-md max-h-[92vh] overflow-y-auto bg-white rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 border border-[#dfe9fc]/80">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-1 border-b border-[#dfe9fc]/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#88f8c4]/40 flex items-center justify-center text-[#006948]">
                  <span className="material-symbols-outlined text-[22px]">palette</span>
                </div>
                <div>
                  <h3 className="text-[17px] font-bold text-[#121c2a]">New Freelance Job</h3>
                  <p className="text-[11px] text-[#3e4942]">Record agreed fee, advance payment & prints</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAddJobModal(false);
                  resetNewJobForm();
                }}
                className="w-8 h-8 flex items-center justify-center rounded-full text-[#3e4942] hover:bg-[#eff3ff] transition-colors cursor-pointer"
                title="Close modal"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Validation Error Alert */}
            {formError && (
              <div className="p-3 bg-[#ba1a1a]/10 border border-[#ba1a1a]/30 rounded-xl flex items-start gap-2 text-[#ba1a1a] text-[12px]">
                <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5">error</span>
                <span className="font-medium">{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateJob} className="space-y-3.5">
              {/* Client Name */}
              <div>
                <label className="text-[11px] font-bold text-[#3e4942] uppercase tracking-wider block mb-1">
                  Client / Organization <span className="text-[#ba1a1a]">*</span>
                </label>
                <input
                  id="input-client-name"
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="e.g. Campus Culture Club, Tech Fest, Prof. Ramesh"
                  required
                  autoFocus
                  className="w-full px-3.5 py-2.5 bg-[#f8f9ff] border border-[#dfe9fc] rounded-xl text-[13px] text-[#121c2a] placeholder-[#8e9a92] focus:outline-none focus:border-[#006948] transition-colors"
                />
              </div>

              {/* Project Title */}
              <div>
                <label className="text-[11px] font-bold text-[#3e4942] uppercase tracking-wider block mb-1">
                  Project Name <span className="text-[#ba1a1a]">*</span>
                </label>
                <input
                  id="input-job-title"
                  type="text"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="e.g. Fest Social Media Posters & ID Badges"
                  required
                  className="w-full px-3.5 py-2.5 bg-[#f8f9ff] border border-[#dfe9fc] rounded-xl text-[13px] text-[#121c2a] placeholder-[#8e9a92] focus:outline-none focus:border-[#006948] transition-colors"
                />
              </div>

              {/* Design Type Selector */}
              <div>
                <label className="text-[11px] font-bold text-[#3e4942] uppercase tracking-wider block mb-1.5">
                  Design Type
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {DESIGN_TYPES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setDesignType(t)}
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all cursor-pointer ${
                        designType === t
                          ? 'bg-[#006948] text-white shadow-xs'
                          : 'bg-[#f8f9ff] text-[#3e4942] border border-[#dfe9fc] hover:bg-[#eff3ff]'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Agreed Amount & Advance Received */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] font-bold text-[#3e4942] uppercase tracking-wider block mb-1">
                    Agreed Amount (₹) <span className="text-[#ba1a1a]">*</span>
                  </label>
                  <input
                    id="input-total-fee"
                    type="number"
                    min="1"
                    value={totalFeeStr}
                    onChange={(e) => setTotalFeeStr(e.target.value)}
                    placeholder="2000"
                    required
                    className="w-full px-3.5 py-2.5 bg-[#f8f9ff] border border-[#dfe9fc] rounded-xl text-[16px] font-bold text-[#121c2a] placeholder-[#8e9a92] focus:outline-none focus:border-[#006948]"
                  />
                  <span className="text-[10px] text-[#556059] mt-0.5 block">Total contract fee</span>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-[#3e4942] uppercase tracking-wider block mb-1">
                    Advance Received (₹)
                  </label>
                  <input
                    id="input-advance-received"
                    type="number"
                    min="0"
                    value={advanceReceivedStr}
                    onChange={(e) => setAdvanceReceivedStr(e.target.value)}
                    placeholder="0"
                    className="w-full px-3.5 py-2.5 bg-[#f8f9ff] border border-[#dfe9fc] rounded-xl text-[16px] font-bold text-[#006948] placeholder-[#8e9a92] focus:outline-none focus:border-[#006948]"
                  />
                  <span className="text-[10px] text-[#556059] mt-0.5 block">Advance payment</span>
                </div>
              </div>

              {/* Live Remaining Balance Calculation Card */}
              {(() => {
                const fee = Math.max(0, parseInt(totalFeeStr, 10) || 0);
                const adv = Math.max(0, parseInt(advanceReceivedStr, 10) || 0);
                const rem = Math.max(0, fee - adv);
                return (
                  <div className="bg-[#eff3ff] p-3 rounded-2xl border border-[#dfe9fc] flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-[#3e4942] uppercase tracking-wider block">
                        Remaining Pending Balance
                      </span>
                      <p className="text-[11px] text-[#556059]">
                        {adv > 0
                          ? `₹${adv.toLocaleString('en-IN')} advance recorded as income`
                          : 'No advance received yet'}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[17px] font-bold text-[#ac6200] tabular-nums">
                        ₹{rem.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Advance Payment Method if Advance > 0 */}
              {(parseInt(advanceReceivedStr, 10) || 0) > 0 && (
                <div>
                  <label className="text-[11px] font-bold text-[#3e4942] uppercase tracking-wider block mb-1">
                    Advance Payment Method
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setAdvancePaymentMethod('upi')}
                      className={`py-2 rounded-xl text-[12px] font-semibold border transition-all cursor-pointer ${
                        advancePaymentMethod === 'upi'
                          ? 'bg-[#006948] text-white border-[#006948]'
                          : 'bg-[#f8f9ff] text-[#3e4942] border-[#dfe9fc]'
                      }`}
                    >
                      UPI / Online
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdvancePaymentMethod('cash')}
                      className={`py-2 rounded-xl text-[12px] font-semibold border transition-all cursor-pointer ${
                        advancePaymentMethod === 'cash'
                          ? 'bg-[#006948] text-white border-[#006948]'
                          : 'bg-[#f8f9ff] text-[#3e4942] border-[#dfe9fc]'
                      }`}
                    >
                      Cash
                    </button>
                  </div>
                </div>
              )}

              {/* Project Status & Due Date */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] font-bold text-[#3e4942] uppercase tracking-wider block mb-1">
                    Project Status
                  </label>
                  <select
                    value={projectStatus}
                    onChange={(e) => setProjectStatus(e.target.value as any)}
                    className="w-full px-3 py-2.5 bg-[#f8f9ff] border border-[#dfe9fc] rounded-xl text-[12px] font-semibold text-[#121c2a] focus:outline-none focus:border-[#006948]"
                  >
                    <option value="in_progress">In Progress</option>
                    <option value="awaiting_payment">Awaiting Payment</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-[#3e4942] uppercase tracking-wider block mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#f8f9ff] border border-[#dfe9fc] rounded-xl text-[12px] text-[#121c2a] focus:outline-none focus:border-[#006948]"
                  />
                </div>
              </div>

              {/* Optional Initial Work Costs / Prints */}
              <div className="p-3 bg-[#f8f9ff] rounded-2xl border border-[#dfe9fc]/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[#3e4942] uppercase tracking-wider flex items-center gap-1">
                    <span className="material-symbols-outlined text-[15px] text-[#ba1a1a]">print</span>
                    <span>Initial Work Costs / Prints (Optional)</span>
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <input
                      type="text"
                      value={initialCostTitle}
                      onChange={(e) => setInitialCostTitle(e.target.value)}
                      placeholder="e.g. Sample print, photo paper"
                      className="w-full px-2.5 py-1.5 bg-white border border-[#dfe9fc] rounded-lg text-[12px] text-[#121c2a] placeholder-[#8e9a92] focus:outline-none focus:border-[#006948]"
                    />
                  </div>
                  <div>
                    <input
                      type="number"
                      min="0"
                      value={initialCostStr}
                      onChange={(e) => setInitialCostStr(e.target.value)}
                      placeholder="₹ Amount"
                      className="w-full px-2.5 py-1.5 bg-white border border-[#dfe9fc] rounded-lg text-[12px] font-bold text-[#121c2a] placeholder-[#8e9a92] focus:outline-none focus:border-[#006948]"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[#6d7a72] block">
                    Recorded as work expense and deducted from net profit.
                  </span>
                  {(parseInt(initialCostStr, 10) || 0) > 0 && (
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => setInitialCostPaymentMethod('cash')}
                        className={`text-[10px] px-2 py-0.5 rounded-md font-semibold cursor-pointer ${
                          initialCostPaymentMethod === 'cash' ? 'bg-[#006948] text-white' : 'bg-white text-[#3e4942] border border-[#dfe9fc]'
                        }`}
                      >
                        Cash
                      </button>
                      <button
                        type="button"
                        onClick={() => setInitialCostPaymentMethod('upi')}
                        className={`text-[10px] px-2 py-0.5 rounded-md font-semibold cursor-pointer ${
                          initialCostPaymentMethod === 'upi' ? 'bg-[#006948] text-white' : 'bg-white text-[#3e4942] border border-[#dfe9fc]'
                        }`}
                      >
                        UPI
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-[11px] font-bold text-[#3e4942] uppercase tracking-wider block mb-1">
                  Notes / Deliverables
                </label>
                <textarea
                  value={jobNotes}
                  onChange={(e) => setJobNotes(e.target.value)}
                  placeholder="e.g. 3 revisions included, deliver print-ready CMYK PDF and PNG for Instagram."
                  rows={2}
                  className="w-full px-3 py-2 bg-[#f8f9ff] border border-[#dfe9fc] rounded-xl text-[12px] text-[#121c2a] placeholder-[#8e9a92] focus:outline-none focus:border-[#006948]"
                />
              </div>

              {/* Modal Actions */}
              <div className="pt-2 flex gap-2">
                <button
                  id="btn-cancel-job"
                  type="button"
                  onClick={() => {
                    setShowAddJobModal(false);
                    resetNewJobForm();
                  }}
                  className="flex-1 py-2.5 rounded-xl border border-[#dfe9fc] text-[13px] font-semibold text-[#3e4942] hover:bg-[#eff3ff] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="btn-submit-job"
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-[#006948] hover:bg-[#00855d] text-white text-[13px] font-bold shadow-xs active:scale-98 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <span>Saving...</span>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[16px]">check</span>
                      <span>Create Project</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Custom Payment Modal */}
      {customPaymentJob && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#88f8c4]/40 flex items-center justify-center text-[#006948]">
                  <span className="material-symbols-outlined text-[18px]">payments</span>
                </div>
                <div>
                  <h3 className="text-[16px] font-bold text-[#121c2a]">Record Received Payment</h3>
                  <p className="text-[11px] text-[#3e4942]">{customPaymentJob.job.clientName}</p>
                </div>
              </div>
              <button
                onClick={() => setCustomPaymentJob(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full text-[#3e4942] hover:bg-[#eff3ff]"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveCustomPayment} className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-[#3e4942] uppercase tracking-wider block mb-1">
                  Received Amount (₹)
                </label>
                <input
                  type="number"
                  value={customPaymentAmount}
                  onChange={(e) => setCustomPaymentAmount(e.target.value)}
                  placeholder="800"
                  autoFocus
                  required
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
                    onClick={() => setCustomPaymentMethod('upi')}
                    className={`py-2 rounded-xl text-[12px] font-semibold border transition-all cursor-pointer ${
                      customPaymentMethod === 'upi'
                        ? 'bg-[#006948] text-white border-[#006948]'
                        : 'bg-[#f8f9ff] text-[#3e4942] border-[#dfe9fc]'
                    }`}
                  >
                    UPI / Bank
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomPaymentMethod('cash')}
                    className={`py-2 rounded-xl text-[12px] font-semibold border transition-all cursor-pointer ${
                      customPaymentMethod === 'cash'
                        ? 'bg-[#006948] text-white border-[#006948]'
                        : 'bg-[#f8f9ff] text-[#3e4942] border-[#dfe9fc]'
                    }`}
                  >
                    Cash
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#3e4942] uppercase tracking-wider block mb-1">
                  Note / Milestone Reference
                </label>
                <input
                  type="text"
                  value={customPaymentNote}
                  onChange={(e) => setCustomPaymentNote(e.target.value)}
                  placeholder="e.g. Concept sketches payment"
                  className="w-full px-3 py-2 bg-[#f8f9ff] border border-[#dfe9fc] rounded-xl text-[13px] text-[#121c2a] focus:outline-none focus:border-[#006948]"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setCustomPaymentJob(null)}
                  className="flex-1 py-2.5 rounded-xl border border-[#dfe9fc] text-[13px] font-semibold text-[#3e4942]"
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

      {/* Edit Job Modal */}
      {editingJob && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm max-h-[90vh] overflow-y-auto bg-white rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-[#006948]">edit</span>
                <h3 className="text-[16px] font-bold text-[#121c2a]">Edit Freelance Project</h3>
              </div>
              <button
                onClick={() => setEditingJob(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full text-[#3e4942] hover:bg-[#eff3ff]"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveEditJob} className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-[#3e4942] uppercase tracking-wider block mb-1">
                  Project Title
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-[#f8f9ff] border border-[#dfe9fc] rounded-xl text-[13px] text-[#121c2a] focus:outline-none focus:border-[#006948]"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#3e4942] uppercase tracking-wider block mb-1">
                  Client Name
                </label>
                <input
                  type="text"
                  value={editClient}
                  onChange={(e) => setEditClient(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-[#f8f9ff] border border-[#dfe9fc] rounded-xl text-[13px] text-[#121c2a] focus:outline-none focus:border-[#006948]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-[#3e4942] uppercase tracking-wider block mb-1">
                    Total Fee (₹)
                  </label>
                  <input
                    type="number"
                    value={editTotalFee}
                    onChange={(e) => setEditTotalFee(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-[#f8f9ff] border border-[#dfe9fc] rounded-xl text-[14px] font-bold text-[#121c2a] focus:outline-none focus:border-[#006948]"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-[#3e4942] uppercase tracking-wider block mb-1">
                    Received Amount (₹)
                  </label>
                  <input
                    type="number"
                    value={editPaidAmount}
                    onChange={(e) => setEditPaidAmount(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-[#f8f9ff] border border-[#dfe9fc] rounded-xl text-[14px] font-bold text-[#006948] focus:outline-none focus:border-[#006948]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#3e4942] uppercase tracking-wider block mb-1">
                  Design Type
                </label>
                <select
                  value={editDesignType}
                  onChange={(e) => setEditDesignType(e.target.value)}
                  className="w-full px-3 py-2 bg-[#f8f9ff] border border-[#dfe9fc] rounded-xl text-[13px] text-[#121c2a] focus:outline-none focus:border-[#006948]"
                >
                  {DESIGN_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-[#3e4942] uppercase tracking-wider block mb-1">
                    Project Status
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as any)}
                    className="w-full px-3 py-2 bg-[#f8f9ff] border border-[#dfe9fc] rounded-xl text-[12px] font-semibold text-[#121c2a] focus:outline-none focus:border-[#006948]"
                  >
                    <option value="in_progress">In Progress</option>
                    <option value="awaiting_payment">Awaiting Payment</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-[#3e4942] uppercase tracking-wider block mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={editDueDate}
                    onChange={(e) => setEditDueDate(e.target.value)}
                    className="w-full px-3 py-2 bg-[#f8f9ff] border border-[#dfe9fc] rounded-xl text-[12px] text-[#121c2a] focus:outline-none focus:border-[#006948]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#3e4942] uppercase tracking-wider block mb-1">
                  Notes
                </label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={2}
                  placeholder="Project notes, deliverables or specs"
                  className="w-full px-3 py-2 bg-[#f8f9ff] border border-[#dfe9fc] rounded-xl text-[12px] text-[#121c2a] focus:outline-none focus:border-[#006948]"
                />
              </div>

              {/* Milestones in Edit */}
              <div className="space-y-2 pt-1 border-t border-[#dfe9fc]/60">
                <span className="text-[11px] font-semibold text-[#3e4942] uppercase tracking-wider block">
                  Milestones ({editMilestones.length})
                </span>

                {editMilestones.map((m, idx) => (
                  <div key={m.id || idx} className="bg-[#f8f9ff] p-2.5 rounded-xl border border-[#dfe9fc]/50 space-y-1.5">
                    <div className="flex gap-2 items-center">
                      <input
                        type="text"
                        value={m.title}
                        onChange={(e) => {
                          const updated = [...editMilestones];
                          updated[idx].title = e.target.value;
                          setEditMilestones(updated);
                        }}
                        className="flex-1 px-2 py-1 bg-white border border-[#dfe9fc] rounded-lg text-[12px] text-[#121c2a]"
                      />
                      <input
                        type="number"
                        value={m.amount}
                        onChange={(e) => {
                          const updated = [...editMilestones];
                          updated[idx].amount = parseInt(e.target.value, 10) || 0;
                          setEditMilestones(updated);
                        }}
                        className="w-20 px-2 py-1 bg-white border border-[#dfe9fc] rounded-lg text-[12px] font-bold text-[#121c2a]"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-1.5 text-[11px] text-[#3e4942] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={m.paid}
                          onChange={(e) => {
                            const updated = [...editMilestones];
                            updated[idx].paid = e.target.checked;
                            setEditMilestones(updated);
                          }}
                          className="accent-[#006948] w-3.5 h-3.5"
                        />
                        <span>Mark as Paid</span>
                      </label>

                      <button
                        type="button"
                        onClick={() => {
                          setEditMilestones(editMilestones.filter((_, i) => i !== idx));
                        }}
                        className="text-[10px] text-[#ba1a1a] hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => {
                    setEditMilestones([
                      ...editMilestones,
                      {
                        id: 'm-' + Date.now(),
                        title: 'New Milestone',
                        amount: 500,
                        paid: false,
                      },
                    ]);
                  }}
                  className="w-full py-1.5 rounded-lg border border-dashed border-[#006948]/50 text-[#006948] text-[11px] font-semibold hover:bg-[#88f8c4]/10 cursor-pointer"
                >
                  + Add Milestone
                </button>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditingJob(null)}
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
          </div>
        </div>
      )}

      {/* Add Cost Modal */}
      {showAddCostModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[16px] font-bold text-[#121c2a]">Add Project Work Cost</h3>
              <button
                onClick={() => setShowAddCostModal(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full text-[#3e4942] hover:bg-[#eff3ff]"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={(e) => handleAddCost(showAddCostModal, e)} className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-[#3e4942] uppercase tracking-wider block mb-1">
                  Cost Item / Description
                </label>
                <input
                  type="text"
                  value={costTitle}
                  onChange={(e) => setCostTitle(e.target.value)}
                  placeholder="e.g. Poster sample print, badge paper"
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
                  value={costAmountStr}
                  onChange={(e) => setCostAmountStr(e.target.value)}
                  placeholder="50"
                  required
                  className="w-full px-3 py-2 bg-[#f8f9ff] border border-[#dfe9fc] rounded-xl text-[14px] font-bold text-[#121c2a] focus:outline-none focus:border-[#006948]"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddCostModal(null)}
                  className="flex-1 py-2.5 rounded-xl border border-[#dfe9fc] text-[13px] font-semibold text-[#3e4942] hover:bg-[#eff3ff]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-[#006948] hover:bg-[#00855d] text-white text-[13px] font-semibold shadow-xs"
                >
                  Record Work Cost
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
