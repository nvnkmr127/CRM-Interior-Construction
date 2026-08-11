const logger = require('../../utils/logger');
const eventBus = require('../../utils/eventBus');
const pool = require('../../db/pool');
class TimelineWriter {
  constructor() {
    this.listen();
  }

  listen() {
    eventBus.on('*', async (event) => {
      require('fs').appendFileSync('d:/Digicloudify softwares/CRM-Interior-Construction/debug_timeline.txt', `\n[${new Date().toISOString()}] RECEIVED *: ` + JSON.stringify(event));
      try {
        await this.handleEvent(event);
      } catch (error) {
        logger.error('[TimelineWriter] Error writing to timeline:', error);
        require('fs').appendFileSync('d:/Digicloudify softwares/CRM-Interior-Construction/debug_timeline.txt', `\nERROR: ` + error.message);
      }
    });
  }

  async handleEvent(event) {
    const { eventName, payload, context } = event;
    const tenantId = context.tenantId;
    const userId = context.userId;

    if (!tenantId) return;

    let leadId = null;
    let summary = '';
    let entity = null;
    let entityId = null;
    let eventType = eventName;

    // Extract common payload fields based on event names
    if (eventName.startsWith('lead.')) {
      leadId = payload.id || payload.leadId || (payload.lead && payload.lead.id);
      entity = 'lead';
      entityId = leadId;
      
      if (eventName === 'lead.stage_changed') {
        const oldStage = payload.oldStage?.name || 'Unknown';
        const newStage = payload.newStage?.name || 'Unknown';
        summary = `Stage changed from ${oldStage} to ${newStage}${payload.mandatoryFieldsText || ''}`;
      } else if (eventName === 'lead.created') {
        summary = 'Lead created';
      } else if (eventName === 'lead.assigned') {
        eventType = 'system.assignment';
        summary = `Lead reassigned`;
      } else if (eventName === 'lead.file_uploaded') {
        const fileName = payload.file?.file_name || 'A file';
        summary = `Uploaded file: ${fileName}`;
      } else if (eventName === 'lead.estimates_synced') {
        summary = `Estimates synced via ${payload.source === 'webhook' ? 'webhook' : 'manual pull'}`;
        if (payload.referenceId) summary += ` (Ref: ${payload.referenceId})`;
      } else if (eventName === 'lead.stakeholder_added') {
        eventType = 'activity.note';
        summary = `Added stakeholder: ${payload.name}${payload.role ? ` (${payload.role})` : ''}`;
        entity = 'lead_contacts';
        entityId = payload.contactId;
      } else if (eventName === 'lead.stakeholder_updated') {
        eventType = 'activity.note';
        summary = `Updated stakeholder: ${payload.name}${payload.role ? ` (${payload.role})` : ''}`;
        entity = 'lead_contacts';
        entityId = payload.contactId;
      } else if (eventName === 'lead.stakeholder_removed') {
        eventType = 'activity.note';
        summary = `Removed stakeholder: ${payload.name}`;
        entity = 'lead_contacts';
        entityId = payload.contactId;
      } else if (eventName === 'lead.followup_scheduled') {
        eventType = 'activity.note';
        summary = `Scheduled follow-up: ${payload.title} due on ${payload.formattedDate}`;
        entity = 'lead_followups';
        entityId = payload.followupId;
      } else if (eventName === 'lead.followup_completed') {
        eventType = 'activity.note';
        summary = `Completed follow-up: ${payload.title}`;
        entity = 'lead_followups';
        entityId = payload.followupId;
      } else if (eventName === 'lead.followup_reverted') {
        eventType = 'activity.note';
        summary = `Marked follow-up: ${payload.title} as pending`;
        entity = 'lead_followups';
        entityId = payload.followupId;
      } else if (eventName === 'lead.followup_cancelled') {
        eventType = 'activity.note';
        summary = `Cancelled follow-up: ${payload.title}`;
        entity = 'lead_followups';
        entityId = payload.followupId;
      } else if (eventName === 'lead.inspiration_added') {
        eventType = 'activity.note';
        summary = `Added inspiration image${payload.roomType ? ` for ${payload.roomType}` : ''}`;
        entity = 'lead_inspirations';
        entityId = payload.inspirationId;
      } else if (eventName === 'lead.inspiration_deleted') {
        eventType = 'activity.note';
        summary = `Deleted inspiration image${payload.roomType ? ` for ${payload.roomType}` : ''}`;
        entity = 'lead_inspirations';
        entityId = payload.inspirationId;
      } else if (eventName === 'lead.negotiation_updated') {
        eventType = 'activity.note';
        summary = `Updated negotiation terms (Quoted: ₹${payload.quotedPrice || 0}, Target: ₹${payload.targetPrice || 0})`;
        entity = 'lead';
        entityId = leadId;
      } else if (eventName === 'lead.file_deleted') {
        eventType = 'activity.note';
        summary = `Deleted file: ${payload.fileName}`;
        entity = 'lead';
        entityId = leadId;
      } else if (eventName === 'lead.updated') {
        // Timeline event is handled in updateLead for stages, but we can capture other updates if needed
        // We'll skip generic updates to avoid spam
        return; 
      }
    } else if (eventName.startsWith('task.')) {
      leadId = payload.lead_id || payload.record?.lead_id;
      entity = 'task';
      entityId = payload.id || payload.record?.id;
      if (eventName === 'task.created') summary = `Task created: ${payload.title || payload.record?.title}`;
      if (eventName === 'task.completed') summary = `Task completed: ${payload.title || payload.record?.title}`;
    } else if (eventName.startsWith('site_visit.')) {
      leadId = payload.lead_id;
      entity = 'site_visit';
      entityId = payload.id;
      summary = `Site visit ${eventName.split('.')[1]}: ${payload.notes || ''}`;
    } else if (eventName.startsWith('quotation.')) {
      leadId = payload.lead_id;
      entity = 'quotation';
      entityId = payload.id;
      summary = `Quotation ${eventName.split('.')[1]}: Amount ₹${payload.total_amount || payload.amount || 0}`;
    } else if (eventName.startsWith('payment.')) {
      leadId = payload.lead_id;
      entity = 'payment';
      entityId = payload.id;
      summary = `Payment ${eventName.split('.')[1]}: Amount ₹${payload.amount || 0}`;
    } else if (eventName.startsWith('project.')) {
      leadId = payload.lead_id;
      entity = 'project';
      entityId = payload.id;
      summary = `Project ${eventName.split('.')[1]}: ${payload.name || 'Status updated'}`;
    } else if (eventName.startsWith('call.')) {
      leadId = payload.lead_id;
      entity = 'call';
      entityId = payload.id;
      summary = `Call ${eventName.split('.')[1]}: ${payload.notes || 'Logged'}`;
    } else if (eventName.startsWith('meeting.')) {
      leadId = payload.lead_id;
      entity = 'meeting';
      entityId = payload.id;
      summary = `Meeting ${eventName.split('.')[1]}: ${payload.subject || payload.notes || 'Logged'}`;
    } else if (eventName.startsWith('communication.')) {
      leadId = payload.lead_id;
      entity = 'communication';
      entityId = payload.id;
      summary = `Communication via ${payload.channel}: ${payload.subject || 'Message sent'}`;
    } else if (eventName.startsWith('ai.')) {
      leadId = payload.lead_id;
      entity = 'ai_insight';
      entityId = payload.id;
      summary = `AI Insight: ${payload.summary || 'Insight generated'}`;
    } else if (eventName === 'estimate.created') {
      leadId = payload.leadId;
      entity = 'estimate';
      entityId = payload.id;
      summary = `Created estimate for amount: ${payload.total_amount || 0}`;
    } else if (eventName === 'activity.created') {
      // Legacy generic activities
      leadId = payload.lead_id;
      entity = 'activity';
      entityId = payload.id;
      eventType = `activity.${payload.type}`;
      summary = payload.notes || 'Activity logged';
    } else if (eventName.startsWith('automation.')) {
      leadId = payload.lead_id || (payload.lead && payload.lead.id) || payload.record?.lead_id;
      entity = 'automation';
      entityId = payload.id || payload.automation_id || null;
      if (eventName === 'automation.executed') {
        summary = `Automation executed: ${payload.automation_name || payload.name || 'Workflow'}`;
      } else {
        summary = `Automation event: ${eventName}`;
      }
    }

    if (!leadId) {
      // If we couldn't resolve a lead ID, this event isn't timeline-relevant
      return;
    }

    // Insert into unified lead_timeline
    await pool.query(`
      INSERT INTO lead_timeline (
        tenant_id, lead_id, event_type, entity, entity_id, summary, user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [tenantId, leadId, eventType, entity, entityId, summary, userId || null]);

    // Avoid double writing to audit_logs for actions logged directly in services
    const skippedAuditEvents = ['lead.stage_changed', 'lead.created', 'lead.deleted', 'lead.updated'];
    if (!skippedAuditEvents.includes(eventName)) {
      try {
        const { logAction } = require('../auditLog');
        await logAction({
          tenantId,
          userId,
          action: eventName,
          entity: entity || 'lead',
          entityId: entityId || leadId,
          newValue: payload
        });
      } catch (auditError) {
        logger.error('[TimelineWriter] Error writing to audit_logs:', auditError);
      }
    }
  }
}

// Initialize and export
const timelineWriter = new TimelineWriter();
module.exports = timelineWriter;
