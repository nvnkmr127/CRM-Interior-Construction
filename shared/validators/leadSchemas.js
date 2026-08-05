const { z } = require('zod');

const createLeadSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string(),
  email: z.string().email('Invalid email format').optional().or(z.literal('')),
  source: z.string().optional(),
  stageId: z.string().uuid('Invalid stage ID').optional().or(z.literal('')),
  assigneeId: z.string().uuid('Invalid assignee ID').optional().or(z.literal('')),
  notes: z.string().optional(),
  custom_fields: z.record(z.any()).optional()
});

const logActivitySchema = z.object({
  type: z.enum(['call', 'note', 'email', 'whatsapp', 'site_visit', 'meeting']),
  title: z.string().optional(),
  notes: z.string(),
  outcome: z.string().optional(),
  scheduledAt: z.string().optional(),
  metadata: z.record(z.any()).optional()
});

module.exports = {
  createLeadSchema,
  logActivitySchema
};
