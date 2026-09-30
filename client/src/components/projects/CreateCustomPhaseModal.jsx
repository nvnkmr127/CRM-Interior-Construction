/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useMemo } from 'react';
import styles from './CreateCustomPhaseModal.module.css';
import { Button, Modal, Input, Select, Badge } from '../ui';
import { createPhase, createMilestone } from '../../api/projects';
import { createPaymentMilestone, getPaymentMilestones } from '../../api/paymentMilestones';
import { configApi } from '../../api/config';
import { DEFAULT_PROJECT_TYPES } from '../../constants/projectTypes';
import { DEFAULT_PAYMENT_TEMPLATES, fetchPaymentTemplates } from '../../constants/paymentTemplates';
import { useToast } from '../../store/toastContext';

function formatDateDisplay(d) {
  if (!d) return '';
  const parts = d.split('-');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return d;
}

// Parse chronological stage / milestone sequence (1-based index)
function getMilestoneSequenceOrder(name, fallbackIdx = 0) {
  if (!name) return fallbackIdx + 1;
  const str = String(name);
  const match = str.match(/(?:Month|Stage|Phase|Installment)\s*(\d+)/i);
  if (match) return parseInt(match[1], 10);
  if (/booking|advance|token|sign-up|initial/i.test(str)) return 1;
  if (/design|sign-off|approval/i.test(str)) return 2;
  if (/procurement|production|factory|readiness/i.test(str)) return 3;
  if (/installation|woodwork|flooring|mep|civil/i.test(str)) return 4;
  if (/painting|fixture|snag|handover|final|key|closure|retention/i.test(str)) return 999;
  return fallbackIdx + 1;
}

// Clean and standardize milestone names into Stage-based terminology
function formatStageMilestoneName(rawName, idx, total = 5) {
  if (!rawName) {
    if (idx === 0) return 'Stage 1: Booking Advance';
    if (idx === total - 1) return `Stage ${total}: Final Handover & Sign-off`;
    return `Stage ${idx + 1}: Project Execution Milestone`;
  }
  let s = String(rawName).trim();
  const sepChars = ['-', ':', '\u2013'].join('');
  s = s.replace(new RegExp('^Month\\s*(\\d+)\\s*[' + sepChars + ']?\\s*', 'i'), 'Stage $1: ');
  s = s.replace(new RegExp('^Stage\\s*(\\d+)\\s*[' + sepChars + ']?\\s*', 'i'), 'Stage $1: ');
  // If it doesn't have a Stage prefix and isn't empty, prepend it cleanly
  if (!/^Stage\s*\d+/i.test(s)) {
    s = `Stage ${idx + 1}: ${s}`;
  }
  return s;
}

// Construction phase sequence order helper
function getPhaseSequenceOrder(phaseName, fallbackIdx = 0) {
  if (!phaseName) return fallbackIdx;
  const name = String(phaseName).toLowerCase();
  if (/design|planning|budget|approval|sign-off|token|advance/i.test(name)) return 1;
  if (/site|prep|demolition|procurement|factory|readiness/i.test(name)) return 2;
  if (/civil|plumbing|electrical|mep|structure|tiling/i.test(name)) return 3;
  if (/woodwork|modular|carpentry|kitchen|wardrobe|flooring|assembly/i.test(name)) return 4;
  if (/painting|fixture|snag|cleaning|audit|handover|final|key/i.test(name)) return 5;
  return fallbackIdx + 1;
}

// Compute date plus days formatted as YYYY-MM-DD
function addDaysToDateStr(baseDateStr, daysToAdd) {
  if (!baseDateStr) return '';
  const d = new Date(baseDateStr);
  d.setDate(d.getDate() + daysToAdd);
  return d.toISOString().split('T')[0];
}

export default function CreateCustomPhaseModal({
  isOpen,
  onClose,
  projectId,
  project,
  existingPhasesCount = 0,
  onSuccess
}) {
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  const [projectPaymentMilestones, setProjectPaymentMilestones] = useState([]);
  const [paymentTemplates, setPaymentTemplates] = useState(DEFAULT_PAYMENT_TEMPLATES);

  const contractBudget = Number(project?.contract_value || project?.budget || project?.estimated_cost || 0);

  const [draft, setDraft] = useState({
    id: null,
    name: '',
    type: 'full_interior',
    desc: '',
    phases: []
  });

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setDraft({
        id: null,
        name: project?.name ? `${project.name} Custom Schedule` : '',
        type: 'full_interior',
        desc: '',
        phases: []
      });

      // Load company templates for preload option
      setLoadingTemplates(true);
      configApi.getTemplates()
        .then(data => {
          const list = Array.isArray(data) ? data : (data?.templates || []);
          setTemplates(list);
        })
        .catch(err => {
          console.warn('Could not fetch templates list:', err);
        })
        .finally(() => setLoadingTemplates(false));

      // Fetch payment milestones defined for this project (from creation or lead conversion)
      if (projectId) {
        getPaymentMilestones(projectId)
          .then(res => {
            const list = res.data?.data || res.data || [];
            if (Array.isArray(list) && list.length > 0) {
              setProjectPaymentMilestones(list);
            }
          })
          .catch(err => {
            console.warn('Could not fetch project payment milestones:', err);
          });
      }

      fetchPaymentTemplates()
        .then(tpls => {
          if (Array.isArray(tpls) && tpls.length > 0) {
            setPaymentTemplates(tpls);
          }
        })
        .catch(err => {
          console.warn('Could not fetch payment templates:', err);
        });
    }
  }, [isOpen, project, projectId]);

  // Dynamic project calendar metrics based on actual project start_date and target_date
  const projectDateMetrics = useMemo(() => {
    const sDate = project?.start_date ? String(project.start_date).split('T')[0] : '';
    const tDate = project?.target_date ? String(project.target_date).split('T')[0] : (project?.endDate ? String(project.endDate).split('T')[0] : '');

    let totalProjDays = 60; // sensible interior default if no dates are set
    if (sDate && tDate) {
      const s = new Date(sDate);
      const t = new Date(tDate);
      const diff = Math.round((t - s) / (1000 * 60 * 60 * 24));
      if (diff > 5) {
        totalProjDays = diff;
      }
    }

    return {
      startDate: sDate,
      targetDate: tDate,
      totalProjDays
    };
  }, [project]);

  // Resolve ONLY the payment terms defined for this project during creation or conversion
  const projectAgreedTerm = useMemo(() => {
    // 1. Check existing payment milestones created for this project
    if (Array.isArray(projectPaymentMilestones) && projectPaymentMilestones.length > 0) {
      // Sort milestones by their true chronological stage sequence first!
      const sortedMilestones = [...projectPaymentMilestones].sort((a, b) => {
        const orderA = getMilestoneSequenceOrder(a.name || a.title, 0);
        const orderB = getMilestoneSequenceOrder(b.name || b.title, 0);
        if (orderA !== orderB) return orderA - orderB;
        if (a.due_date && b.due_date) return new Date(a.due_date) - new Date(b.due_date);
        return 0;
      });

      const pcts = sortedMilestones.map(pm => Number(pm.percentage || pm.percent) || 0);
      let label = `${pcts.join('% - ')}% (${pcts.length} Stages)`;
      if (pcts.length === 5 && pcts.every(p => Math.abs(p - 20) < 0.1)) {
        label = '20% x 5 (5-Stage Equal Plan)';
      } else if (pcts.length === 4 && pcts[0] === 10 && pcts[1] === 40 && pcts[2] === 40 && pcts[3] === 10) {
        label = '10-40-40-10 (Commercial 4-Stage)';
      } else if (pcts.length === 3 && pcts[0] === 20 && pcts[1] === 50 && pcts[2] === 30) {
        label = '20-50-30 (Standard 3-Stage)';
      } else if (pcts.length === 2 && pcts[0] === 50 && pcts[1] === 50) {
        label = '50% - 50% (2 Stages)';
      }

      return {
        label,
        percentages: pcts,
        milestones: sortedMilestones.map((pm, idx) => ({
          name: formatStageMilestoneName(pm.name || pm.title, idx, sortedMilestones.length),
          pct: Number(pm.percentage || pm.percent) || Number((100 / sortedMilestones.length).toFixed(1)),
          amount: Number(pm.amount) || (contractBudget > 0 ? Math.round((contractBudget * (Number(pm.percentage || pm.percent) || 0)) / 100) : 0),
          dueDate: pm.due_date ? String(pm.due_date).split('T')[0] : ''
        }))
      };
    }

    // 2. Check project.payment_terms or project.paymentTerms from project record
    const termsKey = project?.payment_terms || project?.paymentTerms;
    if (termsKey) {
      const allTpls = [...(paymentTemplates || []), ...DEFAULT_PAYMENT_TEMPLATES];
      const matched = allTpls.find(t => t.id === termsKey || t.name === termsKey);
      if (matched && Array.isArray(matched.milestones) && matched.milestones.length > 0) {
        const sortedMatchedMilestones = [...matched.milestones].sort((a, b) => {
          const orderA = getMilestoneSequenceOrder(a.name, 0);
          const orderB = getMilestoneSequenceOrder(b.name, 0);
          return orderA - orderB;
        });

        const pcts = sortedMatchedMilestones.map(m => Number(m.percentage));
        let label = matched.name || `${pcts.join('% - ')}%`;
        label = label.replace(/5-Month/gi, '5-Stage');
        if (pcts.length === 5 && pcts.every(p => p === 20)) {
          label = '20% x 5 (5-Stage Equal Plan)';
        } else if (pcts.length === 4 && pcts[0] === 10 && pcts[1] === 40 && pcts[2] === 40 && pcts[3] === 10) {
          label = '10-40-40-10 (Commercial 4-Stage)';
        } else if (pcts.length === 3 && pcts[0] === 20 && pcts[1] === 50 && pcts[2] === 30) {
          label = '20-50-30 (Standard 3-Stage)';
        }

        return {
          label,
          percentages: pcts,
          milestones: sortedMatchedMilestones.map((m, idx) => ({
            name: formatStageMilestoneName(m.name, idx, sortedMatchedMilestones.length),
            pct: Number(m.percentage),
            amount: contractBudget > 0 ? Math.round((contractBudget * Number(m.percentage)) / 100) : 0
          }))
        };
      }

      // Check underscore/hyphen format like '10_40_40_10' or '20_20_20_20_20'
      const parts = String(termsKey).split(/[-_]/).map(Number).filter(n => !isNaN(n) && n > 0);
      if (parts.length >= 2) {
        let label = `${parts.join('% - ')}% (${parts.length} Stages)`;
        if (parts.length === 5 && parts.every(p => p === 20)) {
          label = '20% x 5 (5-Stage Equal Plan)';
        } else if (parts.length === 4 && parts[0] === 10 && parts[1] === 40 && parts[2] === 40 && parts[3] === 10) {
          label = '10-40-40-10 (Commercial 4-Stage)';
        }
        return {
          label,
          percentages: parts,
          milestones: parts.map((pct, idx) => ({
            name: idx === 0 ? 'Stage 1: Booking Advance' : (idx === parts.length - 1 ? `Stage ${parts.length}: Handover & Final Settlement` : `Stage ${idx + 1}: Progress Installment`),
            pct,
            amount: contractBudget > 0 ? Math.round((contractBudget * pct) / 100) : 0
          }))
        };
      }
    }

    // 3. Default fallback if not specified: 5-Stage plan
    return {
      label: '20% x 5 (5-Stage Equal Plan)',
      percentages: [20, 20, 20, 20, 20],
      milestones: [
        { name: 'Stage 1: Booking Advance & Design Sign-off', pct: 20 },
        { name: 'Stage 2: Site Readiness & Factory Procurement', pct: 20 },
        { name: 'Stage 3: Civil, Plumbing & Electrical (MEP)', pct: 20 },
        { name: 'Stage 4: Modular Woodwork Assembly & Flooring', pct: 20 },
        { name: 'Stage 5: Final Painting & Key Handover', pct: 20 }
      ]
    };
  }, [project, projectPaymentMilestones, paymentTemplates, contractBudget]);

  // Aggregate metrics
  const totalDays = useMemo(() => {
    return (draft.phases || []).reduce((acc, p) => acc + (Number(p.duration) || 0), 0);
  }, [draft.phases]);

  const paymentMilestones = useMemo(() => {
    return (draft.phases || []).flatMap(p => (p.milestones || []).filter(m => m.triggersPayment));
  }, [draft.phases]);

  const totalAllocatedPercent = useMemo(() => {
    const sum = paymentMilestones.reduce((acc, m) => acc + (Number(m.paymentPercent) || 0), 0);
    return Number(sum.toFixed(1));
  }, [paymentMilestones]);

  const totalAllocatedRupees = useMemo(() => {
    return paymentMilestones.reduce((acc, m) => acc + (Number(m.paymentAmount) || 0), 0);
  }, [paymentMilestones]);

  const allocationStatus = useMemo(() => {
    if (Math.abs(totalAllocatedPercent - 100) < 0.1) return 'balanced';
    if (totalAllocatedPercent < 100) return 'under';
    return 'over';
  }, [totalAllocatedPercent]);

  if (!isOpen) return null;

  // --- Handlers ---

  const addPhase = () => {
    setDraft(prev => ({
      ...prev,
      phases: [
        ...prev.phases,
        {
          id: Date.now().toString(),
          name: '',
          duration: 15,
          is_execution: true,
          milestones: []
        }
      ]
    }));
  };

  const addMilestone = (phaseIdx) => {
    setDraft(prev => {
      const np = [...prev.phases];
      const defaultPct = 20;
      np[phaseIdx].milestones = [
        ...(np[phaseIdx].milestones || []),
        {
          id: Date.now().toString() + Math.random(),
          name: '',
          dueDate: '',
          triggersPayment: false,
          paymentPercent: defaultPct,
          paymentAmount: contractBudget > 0 ? Math.round((contractBudget * defaultPct) / 100) : '',
          paymentName: ''
        }
      ];
      return { ...prev, phases: np };
    });
  };

  const handleMilestoneChange = (pIdx, mIdx, field, value) => {
    setDraft(prev => {
      const np = [...prev.phases];
      const m = { ...np[pIdx].milestones[mIdx] };
      m[field] = value;

      // Two-way synchronization between % and ₹ amount
      if (field === 'paymentPercent' && contractBudget > 0) {
        const pct = parseFloat(value) || 0;
        m.paymentAmount = Math.round((contractBudget * pct) / 100);
      }
      if (field === 'paymentAmount' && contractBudget > 0) {
        const amt = parseFloat(value) || 0;
        m.paymentPercent = Number(((amt / contractBudget) * 100).toFixed(1));
      }

      np[pIdx].milestones[mIdx] = m;
      return { ...prev, phases: np };
    });
  };

  const togglePayment = (pIdx, mIdx) => {
    setDraft(prev => {
      const np = [...prev.phases];
      const m = { ...np[pIdx].milestones[mIdx] };
      m.triggersPayment = !m.triggersPayment;

      if (m.triggersPayment) {
        if (!m.paymentPercent) m.paymentPercent = 20;
        if (contractBudget > 0 && !m.paymentAmount) {
          m.paymentAmount = Math.round((contractBudget * m.paymentPercent) / 100);
        }
      }
      np[pIdx].milestones[mIdx] = m;
      return { ...prev, phases: np };
    });
  };

  // Preload from existing company template
  const handlePreloadTemplate = (tmplId) => {
    if (!tmplId) return;
    const tmpl = templates.find(t => String(t.id) === String(tmplId));
    if (!tmpl) return;

    let parsedPhases = [];
    try {
      parsedPhases = typeof tmpl.phases === 'string' ? JSON.parse(tmpl.phases) : (tmpl.phases || []);
    } catch (e) {
      console.error('Error parsing template phases:', e);
    }

    if (!Array.isArray(parsedPhases) || parsedPhases.length === 0) {
      toast.warning('Selected template has no phases defined.');
      return;
    }

    const loaded = parsedPhases.map((p, pIdx) => ({
      id: `p-${Date.now()}-${pIdx}`,
      name: p.name || `Phase ${pIdx + 1}`,
      duration: Number(p.duration_days || p.duration) || 15,
      is_execution: p.is_execution !== false,
      milestones: (p.milestones || []).map((m, mIdx) => {
        const isPay = Boolean(m.triggers_payment || m.triggersPayment);
        return {
          id: `m-${Date.now()}-${pIdx}-${mIdx}`,
          name: m.name || `Checkpoint ${mIdx + 1}`,
          dueDate: '',
          triggersPayment: isPay,
          paymentPercent: isPay ? 20 : 0,
          paymentAmount: (isPay && contractBudget > 0) ? Math.round((contractBudget * 20) / 100) : '',
          paymentName: isPay ? (m.name || 'Stage Installment') : ''
        };
      })
    }));

    setDraft(prev => ({
      ...prev,
      name: prev.name || tmpl.name,
      type: tmpl.project_type || prev.type,
      desc: prev.desc || tmpl.description || '',
      phases: loaded
    }));

    setSelectedTemplateId('');
    toast.success(`Loaded "${tmpl.name}" with ${loaded.length} phases! Customize dates and payment terms.`);
  };

  // Payment Presets
  const handleSplitEqually = () => {
    const count = paymentMilestones.length;
    if (count === 0) {
      toast.warning('Turn on "₹ Triggers Payment" on checkpoints first.');
      return;
    }
    const eqPct = Number((100 / count).toFixed(1));

    setDraft(prev => {
      const np = prev.phases.map(p => ({
        ...p,
        milestones: p.milestones.map(m => {
          if (!m.triggersPayment) return m;
          return {
            ...m,
            paymentPercent: eqPct,
            paymentAmount: contractBudget > 0 ? Math.round((contractBudget * eqPct) / 100) : ''
          };
        })
      }));
      return { ...prev, phases: np };
    });
    toast.success(`Split 100% equally across ${count} payment milestones (${eqPct}% each)`);
  };

  const handleApplyAgreedTerm = () => {
    if (!projectAgreedTerm) return;
    const { milestones } = projectAgreedTerm;
    const { startDate, totalProjDays } = projectDateMetrics;

    // Helper to calculate milestone due date
    const computeDueDate = (cumDays) => {
      if (!startDate) return '';
      return addDaysToDateStr(startDate, cumDays);
    };

    // Calculate phase durations fitting the actual project timeline
    let calculatedDurations = [];
    if (milestones.length === 5) {
      // Proportions: ~16% (Design), ~20% (Site Readiness), ~24% (Civil/MEP), ~28% (Woodwork), remainder (Painting/Handover)
      const d1 = Math.max(5, Math.round(totalProjDays * 0.16));
      const d2 = Math.max(5, Math.round(totalProjDays * 0.20));
      const d3 = Math.max(5, Math.round(totalProjDays * 0.24));
      const d4 = Math.max(5, Math.round(totalProjDays * 0.28));
      const d5 = Math.max(5, totalProjDays - (d1 + d2 + d3 + d4));
      calculatedDurations = [d1, d2, d3, d4, d5];
    } else if (milestones.length === 4) {
      const d1 = Math.max(5, Math.round(totalProjDays * 0.15));
      const d2 = Math.max(5, Math.round(totalProjDays * 0.35));
      const d3 = Math.max(5, Math.round(totalProjDays * 0.35));
      const d4 = Math.max(5, totalProjDays - (d1 + d2 + d3));
      calculatedDurations = [d1, d2, d3, d4];
    } else if (milestones.length === 3) {
      const d1 = Math.max(5, Math.round(totalProjDays * 0.25));
      const d2 = Math.max(5, Math.round(totalProjDays * 0.55));
      const d3 = Math.max(5, totalProjDays - (d1 + d2));
      calculatedDurations = [d1, d2, d3];
    } else {
      const each = Math.max(5, Math.floor(totalProjDays / Math.max(1, milestones.length)));
      calculatedDurations = milestones.map((_, i) => i === milestones.length - 1 ? (totalProjDays - each * (milestones.length - 1)) : each);
    }

    let standardPhases = [];
    if (milestones.length === 5) {
      standardPhases = [
        { name: 'Design, Approvals & Budget Sign-off', is_execution: false, checkpoint: 'Design Approvals & 3D Render Sign-off' },
        { name: 'Site Readiness & Factory Procurement', is_execution: true, checkpoint: 'Demolition & Factory Procurement Initiated' },
        { name: 'Civil, Plumbing & Electrical (MEP)', is_execution: true, checkpoint: 'Plumbing & Concealed Electrical Passed' },
        { name: 'Modular Woodwork Assembly & Flooring', is_execution: true, checkpoint: 'Wardrobes, Kitchen Carcass & Shutters Done' },
        { name: 'Painting, Electrical Fixtures & Handover', is_execution: true, checkpoint: 'Final Quality Audit & Key Handover' }
      ];
    } else if (milestones.length === 4) {
      standardPhases = [
        { name: 'Advance / Token & Floor Plan Sign-off', is_execution: false, checkpoint: 'Token Advance & Floor Plan Sign-off' },
        { name: 'Civil & Structural Modifications', is_execution: true, checkpoint: 'Civil, MEP & Tiling Approved' },
        { name: 'Modular Woodwork & Interior Finishing', is_execution: true, checkpoint: 'Modular Units & Painting Complete' },
        { name: 'Final Handover & Retention', is_execution: true, checkpoint: 'Snags Closed & Key Handover' }
      ];
    } else if (milestones.length === 3) {
      standardPhases = [
        { name: 'Booking & Procurement Stage', is_execution: false, checkpoint: 'Booking Advance & Factory Order Placed' },
        { name: 'Site Installation & Fit-out', is_execution: true, checkpoint: 'Fit-out & Assembly Complete' },
        { name: 'Final Handover Stage', is_execution: true, checkpoint: 'Final Inspection & Key Handover' }
      ];
    } else {
      standardPhases = milestones.map((m, idx) => ({
        name: m.name ? `Phase ${idx + 1} - ${m.name.replace(/^Stage\s*\d+:\s*/i, '')}` : `Phase ${idx + 1}`,
        is_execution: idx > 0,
        checkpoint: m.name || `Stage ${idx + 1} Completion`
      }));
    }

    // If draft.phases is empty OR only contains a single blank phase, generate the full schedule
    const isEffectivelyEmpty = draft.phases.length === 0 || 
      (draft.phases.length === 1 && !draft.phases[0].name?.trim() && (!draft.phases[0].milestones || draft.phases[0].milestones.length === 0));

    if (isEffectivelyEmpty) {
      let cumulativeDays = 0;
      const generated = standardPhases.map((sp, idx) => {
        const dur = calculatedDurations[idx] || 15;
        cumulativeDays += dur;
        const autoDueDate = computeDueDate(cumulativeDays);

        const mDef = milestones[idx] || { name: sp.checkpoint, pct: 20 };
        const pct = mDef.pct !== undefined ? mDef.pct : Number((100 / milestones.length).toFixed(1));
        const amt = contractBudget > 0 ? Math.round((contractBudget * pct) / 100) : '';
        const dueDate = mDef.dueDate || autoDueDate;

        return {
          id: `p-${Date.now()}-${idx}`,
          name: sp.name,
          duration: dur,
          is_execution: sp.is_execution,
          milestones: [
            {
              id: `m-${Date.now()}-${idx}`,
              name: mDef.name || sp.checkpoint,
              dueDate: dueDate,
              triggersPayment: true,
              paymentPercent: pct,
              paymentAmount: amt,
              paymentName: mDef.name ? `${mDef.name} (${pct}%)` : `${pct}% Stage Payment`
            }
          ]
        };
      });

      setDraft(prev => ({ ...prev, phases: generated }));
      toast.success(`Applied project agreed payment terms: ${projectAgreedTerm.label} (${totalProjDays} days total)!`);
      return;
    }

    // If phases already exist, sort them by logical construction order so Handover is ALWAYS at the end
    const sortedExistingPhases = [...draft.phases].sort((a, b) => {
      return getPhaseSequenceOrder(a.name, 0) - getPhaseSequenceOrder(b.name, 0);
    });

    let cumulativeDays = 0;
    const updatedPhases = sortedExistingPhases.map((p, pIdx) => {
      const dur = calculatedDurations[pIdx] || p.duration || 15;
      cumulativeDays += dur;
      const autoDueDate = computeDueDate(cumulativeDays);

      const mDef = milestones[pIdx] || (pIdx === sortedExistingPhases.length - 1 ? milestones[milestones.length - 1] : null);
      const pct = mDef?.pct !== undefined ? mDef.pct : Number((100 / Math.max(1, milestones.length)).toFixed(1));
      const amt = contractBudget > 0 ? Math.round((contractBudget * pct) / 100) : '';
      const dueDate = mDef?.dueDate || autoDueDate;

      // Update existing milestones or add milestone if none exists
      let updatedMilestones = (p.milestones || []).map((m, mIdx) => {
        if (mIdx === 0 && mDef) {
          return {
            ...m,
            name: mDef.name,
            triggersPayment: true,
            paymentPercent: pct,
            paymentAmount: amt,
            paymentName: `${mDef.name} (${pct}%)`,
            dueDate: dueDate || m.dueDate
          };
        }
        return m;
      });

      if (updatedMilestones.length === 0 && mDef) {
        updatedMilestones = [
          {
            id: `m-${Date.now()}-${pIdx}`,
            name: mDef.name,
            dueDate: dueDate,
            triggersPayment: true,
            paymentPercent: pct,
            paymentAmount: amt,
            paymentName: `${mDef.name} (${pct}%)`
          }
        ];
      }

      return {
        ...p,
        duration: dur,
        milestones: updatedMilestones
      };
    });

    setDraft(prev => ({ ...prev, phases: updatedPhases }));
    toast.success(`Applied project agreed payment terms: ${projectAgreedTerm.label} across ${totalProjDays} days!`);
  };

  // Save to Database
  const handleSave = async () => {
    if (draft.phases.length === 0) {
      toast.error('Please add at least one phase before saving.');
      return;
    }

    const invalid = draft.phases.find(p => !p.name.trim());
    if (invalid) {
      toast.error('All phases must have a phase name.');
      return;
    }

    setSubmitting(true);
    try {
      let createdPhasesCount = 0;
      let createdMilestonesCount = 0;
      let createdPaymentsCount = 0;

      for (let pIdx = 0; pIdx < draft.phases.length; pIdx++) {
        const p = draft.phases[pIdx];
        const sortOrder = existingPhasesCount + pIdx + 1;

        // 1. Create Phase
        const phaseRes = await createPhase(projectId, {
          name: p.name.trim(),
          duration_days: Number(p.duration) || 0,
          is_execution: p.is_execution !== false,
          sort_order: sortOrder
        });

        const createdPhase = phaseRes.data?.data || phaseRes.data;
        if (!createdPhase?.id) {
          throw new Error(`Failed to create phase "${p.name}"`);
        }
        createdPhasesCount++;

        // 2. Create Milestones for this phase
        for (let mIdx = 0; mIdx < (p.milestones || []).length; mIdx++) {
          const m = p.milestones[mIdx];
          if (!m.name.trim()) continue;

          const mRes = await createMilestone(createdPhase.id, {
            name: m.name.trim(),
            due_date: m.dueDate || null,
            triggers_payment: Boolean(m.triggersPayment),
            sort_order: mIdx + 1
          });

          const createdMilestone = mRes.data?.data || mRes.data;
          createdMilestonesCount++;

          // 3. Create Payment Milestone if triggersPayment
          if (m.triggersPayment && createdMilestone?.id) {
            const finalPercent = m.paymentPercent ? Number(m.paymentPercent) : null;
            let finalAmount = m.paymentAmount ? Number(m.paymentAmount) : null;
            if (!finalAmount && finalPercent && contractBudget > 0) {
              finalAmount = Math.round((contractBudget * finalPercent) / 100);
            }

            await createPaymentMilestone({
              projectId,
              name: m.paymentName?.trim() || m.name.trim(),
              amount: finalAmount,
              percent: finalPercent,
              dueDate: m.dueDate || null,
              milestoneId: createdMilestone.id,
              notes: `Linked to checkpoint: ${m.name.trim()} (${p.name.trim()})`
            }).catch(err => {
              console.warn('Payment milestone creation notice:', err);
            });
            createdPaymentsCount++;
          }
        }
      }

      toast.success(`Created ${createdPhasesCount} phases, ${createdMilestonesCount} checkpoints, and ${createdPaymentsCount} payment milestones!`);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error('Error saving schedule:', err);
      toast.error(err?.response?.data?.error?.message || err?.message || 'Failed to save schedule');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="New Template"
      size="xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={submitting}>
            {submitting ? 'Saving…' : 'Save Template'}
          </Button>
        </>
      }
    >
      <div className={styles.modalBody}>
        {/* Left Column: Form Inputs & Phases */}
        <div className={styles.leftCol}>
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ flex: 2 }}>
              <Input
                label="Template Name *"
                value={draft.name}
                onChange={e => setDraft({ ...draft, name: e.target.value })}
                placeholder="e.g. Full Interior Schedule"
              />
            </div>
            <div style={{ flex: 1 }}>
              <Select
                label="Type"
                options={DEFAULT_PROJECT_TYPES.map(pt => ({
                  value: pt.id,
                  label: `${pt.icon || ''} ${pt.label}`.trim()
                }))}
                value={draft.type}
                onChange={v => setDraft({ ...draft, type: v })}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--color-text)' }}>
              Description
            </label>
            <textarea
              style={{
                width: '100%',
                minHeight: 60,
                padding: 8,
                borderRadius: 4,
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface)',
                color: 'var(--color-text)',
                outline: 'none',
                boxSizing: 'border-box'
              }}
              value={draft.desc}
              onChange={e => setDraft({ ...draft, desc: e.target.value })}
              placeholder="Description"
            />
          </div>

          {/* Project Financial Context & Preload Option */}
          <div className={styles.contextBar}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, width: '100%' }}>
              <div className={styles.contextMeta}>
                <span>Client: <strong>{project?.client?.name || project?.client_name || 'Client'}</strong></span>
                <span>•</span>
                <span>Contract Budget: <strong style={{ color: 'var(--color-accent)' }}>{contractBudget > 0 ? `₹${contractBudget.toLocaleString('en-IN')}` : 'Not Specified'}</strong></span>
              </div>

              {templates.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontWeight: 600 }}>📥 Preload Template:</span>
                  <select
                    className={styles.preloadSelect}
                    value={selectedTemplateId}
                    onChange={e => {
                      setSelectedTemplateId(e.target.value);
                      handlePreloadTemplate(e.target.value);
                    }}
                    disabled={loadingTemplates}
                  >
                    <option value="">-- Choose Template --</option>
                    {templates.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {projectAgreedTerm && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 8,
                paddingTop: 8,
                borderTop: '1px dashed var(--color-border)',
                marginTop: 2,
                width: '100%'
              }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                  ⚡ Project Payment Terms:
                </span>
                <button
                  type="button"
                  className={styles.presetBtn}
                  onClick={handleApplyAgreedTerm}
                  title={`Apply this project's defined payment terms: ${projectAgreedTerm.label}`}
                  style={{
                    color: 'var(--color-accent)',
                    borderColor: 'var(--color-accent)',
                    background: 'var(--color-accent-light)',
                    fontWeight: 700,
                    padding: '5px 12px',
                    fontSize: '12px'
                  }}
                >
                  ⚡ Apply Agreed Terms: {projectAgreedTerm.label}
                </button>
              </div>
            )}
          </div>

          <div className={styles.sectionTitle} style={{ marginTop: 12 }}>
            <span>Phases</span>
          </div>

          {draft.phases.map((p, pIdx) => (
            <div key={p.id} className={styles.phaseBlock}>
              <div className={styles.phaseHeader}>
                <div className={styles.dragHandle}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <circle cx="6" cy="4" r="1.5" /><circle cx="6" cy="8" r="1.5" /><circle cx="6" cy="12" r="1.5" />
                    <circle cx="10" cy="4" r="1.5" /><circle cx="10" cy="8" r="1.5" /><circle cx="10" cy="12" r="1.5" />
                  </svg>
                </div>
                <div style={{ flex: 2 }}>
                  <Input
                    placeholder="Phase Name"
                    value={p.name}
                    onChange={e => {
                      const np = [...draft.phases];
                      np[pIdx].name = e.target.value;
                      setDraft({ ...draft, phases: np });
                    }}
                  />
                </div>
                <div style={{ width: 90 }}>
                  <Input
                    type="number"
                    placeholder="Days"
                    value={p.duration}
                    onChange={e => {
                      const np = [...draft.phases];
                      np[pIdx].duration = parseInt(e.target.value) || 0;
                      setDraft({ ...draft, phases: np });
                    }}
                  />
                </div>
                <select
                  className={styles.phaseTypeSelect}
                  value={p.is_execution ? 'execution' : 'planning'}
                  onChange={e => {
                    const np = [...draft.phases];
                    np[pIdx].is_execution = e.target.value === 'execution';
                    setDraft({ ...draft, phases: np });
                  }}
                  title="Stage type: Execution requires site readiness verification"
                >
                  <option value="execution">🏗️ Execution</option>
                  <option value="planning">📐 Design / Approvals</option>
                </select>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDraft({ ...draft, phases: draft.phases.filter((_, i) => i !== pIdx) });
                  }}
                >
                  ✕
                </Button>
              </div>

              <div className={styles.phaseContent}>
                <div className={styles.milestoneList}>
                  {(p.milestones || []).map((m, mIdx) => (
                    <div key={m.id} className={styles.milestoneRow}>
                      <div className={styles.milestoneMainRow}>
                        <div style={{ flex: 1, minWidth: 160 }}>
                          <Input
                            placeholder="Milestone Name"
                            value={m.name}
                            onChange={e => {
                              const np = [...draft.phases];
                              np[pIdx].milestones[mIdx].name = e.target.value;
                              setDraft({ ...draft, phases: np });
                            }}
                          />
                        </div>

                        <input
                          type="date"
                          className={styles.dateInputSm}
                          value={m.dueDate || ''}
                          onChange={e => handleMilestoneChange(pIdx, mIdx, 'dueDate', e.target.value)}
                          title="Target Milestone Date"
                        />

                        <div
                          className={`${styles.paymentToggle} ${m.triggersPayment ? styles.active : ''}`}
                          onClick={() => togglePayment(pIdx, mIdx)}
                        >
                          ₹ Triggers Payment
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const np = [...draft.phases];
                            np[pIdx].milestones = np[pIdx].milestones.filter((_, i) => i !== mIdx);
                            setDraft({ ...draft, phases: np });
                          }}
                        >
                          ✕
                        </Button>
                      </div>

                      {/* Payment Sub-Row when triggers payment is active */}
                      {m.triggersPayment && (
                        <div className={styles.paymentDetailsRow}>
                          <div className={styles.paymentField}>
                            <span className={styles.paymentLabel}>Stage %:</span>
                            <input
                              type="number"
                              step="0.5"
                              min="0"
                              max="100"
                              className={styles.percentInputSm}
                              placeholder="%"
                              value={m.paymentPercent ?? ''}
                              onChange={e => handleMilestoneChange(pIdx, mIdx, 'paymentPercent', e.target.value)}
                              title="Payment Stage Percentage"
                            />
                            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)' }}>%</span>
                          </div>

                          <div className={styles.paymentField}>
                            <span className={styles.paymentLabel}>Amount:</span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-accent)' }}>₹</span>
                            <input
                              type="number"
                              className={styles.amountInputSm}
                              placeholder="Amount"
                              value={m.paymentAmount ?? ''}
                              onChange={e => handleMilestoneChange(pIdx, mIdx, 'paymentAmount', e.target.value)}
                              title="Payment Stage Amount"
                            />
                          </div>

                          <div className={styles.paymentField} style={{ flex: 1 }}>
                            <span className={styles.paymentLabel}>Label:</span>
                            <input
                              type="text"
                              className={styles.installmentNameInput}
                              placeholder={m.name ? `${m.name} Installment` : 'e.g. 2nd Stage - 20% on Woodwork'}
                              value={m.paymentName ?? ''}
                              onChange={e => handleMilestoneChange(pIdx, mIdx, 'paymentName', e.target.value)}
                              title="Invoice / Stage Name"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => addMilestone(pIdx)}
                  style={{ alignSelf: 'flex-start' }}
                >
                  + Add Milestone
                </Button>
              </div>
            </div>
          ))}

          {/* Add Phase & Split % Helper Button */}
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginTop: 8 }}>
            <Button variant="secondary" onClick={addPhase}>
              + Add Phase
            </Button>

            {paymentMilestones.length > 0 && (
              <button
                type="button"
                className={styles.presetBtn}
                onClick={handleSplitEqually}
                title="Evenly split 100% across all active payment checkpoints"
              >
                ⚡ Split % Equally
              </button>
            )}
          </div>
        </div>

        {/* Right Column: Preview */}
        <div className={styles.rightCol}>
          <div className={styles.sectionTitle}>
            <span>Preview</span>
          </div>

          {draft.phases.length === 0 ? (
            <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
              No phases added yet.
            </div>
          ) : (
            <>
              {/* Summary Card when phases exist */}
              <div className={styles.previewSummaryCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                    Payment Terms Allocation
                  </span>
                  <Badge
                    variant={allocationStatus === 'balanced' ? 'success' : allocationStatus === 'over' ? 'danger' : 'warning'}
                    size="sm"
                  >
                    {allocationStatus === 'balanced'
                      ? '✓ 100% Balanced'
                      : allocationStatus === 'over'
                        ? `❌ Overallocated: +${(totalAllocatedPercent - 100).toFixed(1)}%`
                        : `⚠️ Remaining: ${(100 - totalAllocatedPercent).toFixed(1)}%`}
                  </Badge>
                </div>

                <div className={styles.progressBarTrack}>
                  <div
                    className={styles.progressBarFill}
                    style={{
                      width: `${Math.min(totalAllocatedPercent, 100)}%`,
                      backgroundColor: allocationStatus === 'balanced'
                        ? 'var(--color-success)'
                        : allocationStatus === 'over'
                          ? 'var(--color-danger)'
                          : 'var(--color-warning)'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
                  <span>{totalAllocatedPercent}% ({contractBudget > 0 ? `₹${totalAllocatedRupees.toLocaleString('en-IN')}` : `${paymentMilestones.length} Stages`})</span>
                  <span>⏱️ {totalDays} Total Days</span>
                </div>
              </div>

              {/* Vertical Timeline Tree */}
              <div className={styles.previewTimeline}>
                {draft.phases.map(p => (
                  <div key={p.id} className={styles.previewPhase}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div className={styles.previewPhaseName}>{p.name || 'Untitled Phase'}</div>
                      <Badge variant={p.is_execution ? 'accent' : 'neutral'} size="sm">
                        {p.is_execution ? 'Execution' : 'Planning'}
                      </Badge>
                    </div>
                    <div className={styles.previewDuration}>{p.duration || 0} days</div>

                    {(p.milestones || []).map(m => (
                      <div key={m.id} className={styles.previewMilestone}>
                        <span style={{ color: 'var(--color-border-strong)' }}>└</span>
                        <span style={{ color: 'var(--color-text)', fontWeight: 500 }}>
                          {m.name || 'Untitled Milestone'}
                        </span>

                        {m.dueDate && (
                          <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
                            📅 {formatDateDisplay(m.dueDate)}
                          </span>
                        )}

                        {m.triggersPayment && (
                          <span className={styles.previewMilestonePay}>
                            ₹ Payment{m.paymentPercent ? ` (${m.paymentPercent}%${m.paymentAmount ? ` • ₹${Number(m.paymentAmount).toLocaleString('en-IN')}` : ''})` : ''}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
