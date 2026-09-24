const pool = require('../../db/pool');
const eventBus = require('../../utils/eventBus');
const logger = require('../../utils/logger');

/**
 * Evaluates open snags across tenants and triggers escalation events
 * when SLA thresholds (50%, 100%, 200%, 300%) are exceeded.
 * Deduplicates via audit_logs table.
 *
 * @param {string} [tenantId] Optional tenant filter
 */
async function checkSnagSLAs(tenantId = null) {
  try {
    let query = `
      SELECT id, tenant_id, project_id, title, status, created_at, sla_hours, assignee_id,
             EXTRACT(EPOCH FROM (NOW() - created_at))/3600.0 as elapsed_hours
      FROM snags
      WHERE status NOT IN ('closed', 'resolved') AND sla_hours IS NOT NULL AND sla_hours > 0
    `;
    const params = [];
    if (tenantId) {
      query += ` AND tenant_id = $1`;
      params.push(tenantId);
    }

    const { rows: snags } = await pool.query(query, params);

    for (const snag of snags) {
      const sla = parseFloat(snag.sla_hours);
      const elapsed = parseFloat(snag.elapsed_hours);
      const ratio = elapsed / sla;

      let level = null;
      if (ratio >= 3.0) {
        level = 'snag_sla_300';
      } else if (ratio >= 2.0) {
        level = 'snag_sla_200';
      } else if (ratio >= 1.0) {
        level = 'snag_sla_100';
      } else if (ratio >= 0.5) {
        level = 'snag_sla_50';
      }

      if (!level) continue;

      // Check deduplication in audit_logs
      const dupCheck = await pool.query(`
        SELECT id FROM audit_logs 
        WHERE tenant_id = $1 AND entity = 'snag' AND entity_id = $2 AND action = $3
        LIMIT 1
      `, [snag.tenant_id, snag.id, level]);

      if (dupCheck.rows.length > 0) {
        continue;
      }

      // Record in audit_logs for deduplication
      await pool.query(`
        INSERT INTO audit_logs (tenant_id, entity, entity_id, action, new_value)
        VALUES ($1, 'snag', $2, $3, $4)
      `, [snag.tenant_id, snag.id, level, JSON.stringify({ elapsed, sla, ratio })]);

      // Emit event
      eventBus.emit('snag.sla_escalated', { snag, level });
    }
  } catch (error) {
    logger.error('Error checking snag SLAs:', error);
  }
}

/**
 * Checks service tickets for 2x and 3x SLA breaches and creates escalations.
 *
 * @param {string} [tenantId] Optional tenant filter
 */
async function checkSLABreaches(tenantId = null) {
  try {
    let query = `
      SELECT id, tenant_id, project_id, ticket_number, title, priority, status, created_at, due_date, sla_hours, escalation_level,
             EXTRACT(EPOCH FROM (NOW() - created_at))/3600.0 as elapsed_hours
      FROM service_tickets
      WHERE status NOT IN ('resolved', 'closed') AND sla_hours IS NOT NULL AND sla_hours > 0
    `;
    const params = [];
    if (tenantId) {
      query += ` AND tenant_id = $1`;
      params.push(tenantId);
    }

    const { rows: tickets } = await pool.query(query, params);

    for (const ticket of tickets) {
      const sla = parseFloat(ticket.sla_hours);
      let elapsed = parseFloat(ticket.elapsed_hours);
      if (ticket.due_date && new Date(ticket.due_date) < new Date()) {
        const overdueHours = (Date.now() - new Date(ticket.due_date).getTime()) / 3600000;
        elapsed = Math.max(elapsed, sla + overdueHours);
      }
      const currentLevel = ticket.escalation_level || 0;

      // 1x SLA breach check
      const isBreached = (ticket.due_date && new Date(ticket.due_date) < new Date()) || (elapsed >= sla);
      if (isBreached) {
        const breachCheck = await pool.query(
          `SELECT id FROM audit_logs WHERE tenant_id = $1 AND entity = 'service_ticket' AND entity_id = $2 AND action = 'sla_breach'`,
          [ticket.tenant_id, ticket.id]
        );
        if (breachCheck.rows.length === 0) {
          await pool.query(
            `INSERT INTO audit_logs (tenant_id, entity, entity_id, action, new_value)
             VALUES ($1, 'service_ticket', $2, 'sla_breach', $3)`,
            [ticket.tenant_id, ticket.id, JSON.stringify({ elapsed, sla })]
          );
          eventBus.emit('service_ticket.sla_breached', { ticket, elapsed, sla });
        }
      }

      if (elapsed >= sla * 3.0 && currentLevel < 2) {
        await pool.query(
          `UPDATE service_tickets SET escalation_level = 2, updated_at = NOW() WHERE id = $1 AND tenant_id = $2`,
          [ticket.id, ticket.tenant_id]
        );
        await pool.query(
          `INSERT INTO service_ticket_escalations (tenant_id, ticket_id, escalated_to_role, previous_level, new_level, reason)
           VALUES ($1, $2, 'director', $3, 2, 'Breached SLA by 3x')`,
          [ticket.tenant_id, ticket.id, currentLevel]
        );
      } else if (elapsed >= sla * 2.0 && currentLevel < 1) {
        await pool.query(
          `UPDATE service_tickets SET escalation_level = 1, updated_at = NOW() WHERE id = $1 AND tenant_id = $2`,
          [ticket.id, ticket.tenant_id]
        );
        await pool.query(
          `INSERT INTO service_ticket_escalations (tenant_id, ticket_id, escalated_to_role, previous_level, new_level, reason)
           VALUES ($1, $2, 'pm', $3, 1, 'Breached SLA by 2x')`,
          [ticket.tenant_id, ticket.id, currentLevel]
        );
      }
    }

    try {
      const { sendPreVisitReminders } = require('../postSale/serviceTicketService');
      await sendPreVisitReminders();
    } catch (reminderErr) {
      logger.error('Error sending pre-visit reminders in SLA Engine:', reminderErr);
    }
  } catch (error) {
    logger.error('Error checking service ticket SLA breaches:', error);
  }
}

module.exports = {
  checkSnagSLAs,
  checkSLABreaches
};
