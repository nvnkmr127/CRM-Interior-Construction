import api from '../api/axios';

export const DEFAULT_PAYMENT_TEMPLATES = [
  {
    id: 'tpl-5month-20',
    name: '5-Month Equal Installment Plan (20% x 5)',
    description: '5 equal monthly payments of 20% across 5 consecutive project months.',
    milestones: [
      { name: 'Month 1 - Booking Advance', percentage: 20, stage: 'Booking', offsetDays: 0 },
      { name: 'Month 2 - Design Finalization', percentage: 20, stage: 'Design', offsetDays: 30 },
      { name: 'Month 3 - Factory Production Start', percentage: 20, stage: 'Production', offsetDays: 60 },
      { name: 'Month 4 - Site Installation', percentage: 20, stage: 'Installation', offsetDays: 90 },
      { name: 'Month 5 - Final Handover', percentage: 20, stage: 'Handover', offsetDays: 120 }
    ]
  },
  {
    id: 'tpl-3stage-20-50-30',
    name: 'Standard 3-Stage Milestone (20% - 50% - 30%)',
    description: '20% booking advance, 50% material dispatch, 30% final handover.',
    milestones: [
      { name: 'Stage 1 - Booking Advance', percentage: 20, stage: 'Booking', offsetDays: 0 },
      { name: 'Stage 2 - Material Dispatch', percentage: 50, stage: 'Material Dispatch', offsetDays: 30 },
      { name: 'Stage 3 - Final Handover', percentage: 30, stage: 'Handover', offsetDays: 60 }
    ]
  },
  {
    id: 'tpl-4stage-10-40-40-10',
    name: 'Commercial Construction 4-Stage (10% - 40% - 40% - 10%)',
    description: '10% sign-up, 40% structure, 40% finishing, 10% retention handover.',
    milestones: [
      { name: 'Token Advance', percentage: 10, stage: 'Token', offsetDays: 0 },
      { name: 'Civil & Structure Work', percentage: 40, stage: 'Structure', offsetDays: 30 },
      { name: 'Interior Finishing', percentage: 40, stage: 'Finishing', offsetDays: 75 },
      { name: 'Handover & Retention', percentage: 10, stage: 'Retention', offsetDays: 105 }
    ]
  }
];

export const formatTemplatePercentages = (tpl) => {
  if (tpl && Array.isArray(tpl.milestones) && tpl.milestones.length > 0) {
    return tpl.milestones.map(m => `${m.percentage}%`).join(' - ');
  }
  return tpl?.name || '';
};

export const formatTemplateLabel = (tpl) => {
  if (!tpl) return '';
  const pctStr = formatTemplatePercentages(tpl);
  if (tpl.name && tpl.name.includes('%')) {
    return tpl.name;
  }
  return pctStr ? `${tpl.name} (${pctStr})` : (tpl.name || pctStr);
};

export const PAYMENT_TEMPLATE_NAMES = DEFAULT_PAYMENT_TEMPLATES.reduce((acc, tpl) => {
  acc[tpl.id] = formatTemplateLabel(tpl);
  return acc;
}, {
  '10_40_40_10': 'Commercial Construction 4-Stage (10% - 40% - 40% - 10%)',
  '20_50_30': 'Standard 3-Stage Milestone (20% - 50% - 30%)',
  '20_20_20_20_20': '5-Month Equal Installment Plan (20% x 5)',
  '30_30_30_10': '30% - 30% - 30% - 10%',
  '50_50': '50% - 50%'
});

export async function fetchPaymentTemplates() {
  try {
    const res = await api.get('/config/tenant-settings');
    const customTpls = res.data?.data?.payment_templates || res.data?.payment_templates;
    if (Array.isArray(customTpls) && customTpls.length > 0) {
      return customTpls;
    }
  } catch (err) {
    console.warn('Could not fetch payment templates from settings, using default:', err);
  }
  return DEFAULT_PAYMENT_TEMPLATES;
}
