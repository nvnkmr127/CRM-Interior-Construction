const { z } = require('zod');

const uploadUrlSchema = z.object({
  filename: z.string(),
  contentType: z.string()
}).catchall(z.any());

const createProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required'),
  clientId: z.string().uuid('Invalid client ID').optional().or(z.literal('')),
  description: z.string().optional(),
  type: z.string().optional(),
  budget: z.number().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
}).catchall(z.any());

const updateReferralSchema = z.object({}).catchall(z.any());
const updateProjectSchema = z.object({}).catchall(z.any());
const cancelProjectSchema = z.object({}).catchall(z.any());
const updateRetentionSchema = z.object({}).catchall(z.any());
const reopenProjectSchema = z.object({}).catchall(z.any());
const scheduleAppointmentSchema = z.object({}).catchall(z.any());
const designRequirementsSchema = z.object({}).catchall(z.any());
const roomRequirementSchema = z.object({}).catchall(z.any());
const inspirationSchema = z.object({}).catchall(z.any());
const replaceResourceSchema = z.object({}).catchall(z.any());
const pauseProjectSchema = z.object({}).catchall(z.any());
const resumeProjectSchema = z.object({}).catchall(z.any());
const handoverSignOffSchema = z.object({}).catchall(z.any());
const updateComplianceSchema = z.object({}).catchall(z.any());
const updateMepChecklistSchema = z.object({}).catchall(z.any());
const updateVendorCoordinationSchema = z.object({}).catchall(z.any());
const vendorRecoverySchema = z.object({}).catchall(z.any());
const confirmBookingSchema = z.object({}).catchall(z.any());
const coordinationSchema = z.object({}).catchall(z.any());
const applySchema = z.object({}).catchall(z.any());

module.exports = {
  uploadUrlSchema,
  createProjectSchema,
  updateReferralSchema,
  updateProjectSchema,
  cancelProjectSchema,
  updateRetentionSchema,
  reopenProjectSchema,
  scheduleAppointmentSchema,
  designRequirementsSchema,
  roomRequirementSchema,
  inspirationSchema,
  replaceResourceSchema,
  pauseProjectSchema,
  resumeProjectSchema,
  handoverSignOffSchema,
  updateComplianceSchema,
  updateMepChecklistSchema,
  updateVendorCoordinationSchema,
  vendorRecoverySchema,
  confirmBookingSchema,
  coordinationSchema,
  applySchema
};
