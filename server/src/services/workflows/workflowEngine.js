const eventBus = require('../../utils/eventBus');
// const pool = require('../../config/db'); // For future database-backed rules
const fs = require('fs');
const path = require('path');

// In Phase 2, we start with file-based configuration.
// In Phase 3, this can easily be replaced by fetching from a `tenant_workflows` table.
const workflowsPath = path.resolve(__dirname, 'workflows.json');

let workflows = [];
try {
  if (fs.existsSync(workflowsPath)) {
    workflows = JSON.parse(fs.readFileSync(workflowsPath, 'utf-8'));
  } else {
    // Default example rule
    workflows = [
      {
        id: 'rule_1',
        event: 'lead.created',
        conditions: { source: 'Website' },
        actions: [
          { type: 'assign_to_role', role: 'sales_rep' },
          { type: 'notify', message: 'New Web Lead!' }
        ]
      },
      {
        id: 'rule_sla_lead',
        event: 'lead.sla_breached',
        conditions: {},
        actions: [
          { type: 'notify_manager', message: 'Lead SLA Breached: Untouched for 48 hours.' },
          { type: 'notify_assignee', message: 'ACTION REQUIRED: Lead SLA breached.' }
        ]
      },
      {
        id: 'rule_sla_milestone',
        event: 'project.milestone_overdue',
        conditions: {},
        actions: [
          { type: 'notify_pm', message: 'URGENT: Project Milestone Overdue.' }
        ]
      }
    ];
  }
} catch (e) {
  console.error('[WorkflowEngine] Error loading workflows.json', e);
}

class WorkflowEngine {
  constructor() {
    this.registerListeners();
  }

  registerListeners() {
    // Listen to ALL events generically if possible, or specifically register for known events
    const eventsToListen = [...new Set(workflows.map(w => w.event))];
    
    eventsToListen.forEach(eventName => {
      eventBus.on(eventName, async (payload) => {
        await this.evaluate(eventName, payload);
      });
    });
    
    console.log(`[WorkflowEngine] Subscribed to ${eventsToListen.length} event types.`);
  }

  async evaluate(eventName, payload) {
    const applicableWorkflows = workflows.filter(w => w.event === eventName);
    
    for (const workflow of applicableWorkflows) {
      if (this.checkConditions(workflow.conditions, payload)) {
        await this.executeActions(workflow.actions, payload);
      }
    }
  }

  checkConditions(conditions, payload) {
    if (!conditions) return true;
    
    // Very basic condition evaluator
    for (const [key, expectedValue] of Object.entries(conditions)) {
      // Assuming payload has lead object if it's a lead event
      const actualValue = payload.lead ? payload.lead[key] : payload[key];
      if (actualValue !== expectedValue) {
        return false;
      }
    }
    return true;
  }

  async executeActions(actions, payload) {
    for (const action of actions) {
      console.log(`[WorkflowEngine] Executing action: ${action.type}`, payload.lead ? payload.lead.id : '');
      // In a full implementation, this would dispatch to queues or call services
      if (action.type === 'notify' || action.type === 'notify_assignee') {
        const { notificationQueue } = require('../../queues/queueSetup');
        if (payload.lead && payload.lead.assignee_id) {
          await notificationQueue.add('workflowNotification', {
            type: 'in-app',
            recipientId: payload.lead.assignee_id,
            message: action.message,
          });
        }
      } else if (action.type === 'notify_manager') {
        const { notificationQueue } = require('../../queues/queueSetup');
        const pool = require('../../db/pool');
        const tenantId = payload.lead ? payload.lead.tenant_id : payload.tenantId;
        
        if (tenantId) {
          try {
            const managerRes = await pool.query(`SELECT id FROM users WHERE tenant_id = $1 AND role = 'manager' LIMIT 1`, [tenantId]);
            if (managerRes.rows.length > 0) {
              await notificationQueue.add('workflowNotification', {
                type: 'in-app',
                recipientId: managerRes.rows[0].id,
                message: action.message,
              });
              console.log(`[WorkflowEngine] Sent manager escalation for Lead ${payload.lead ? payload.lead.id : 'Unknown'} to Manager ${managerRes.rows[0].id}`);
            }
          } catch (e) {
            console.error('[WorkflowEngine] Error fetching manager', e.message);
          }
        }
      } else if (action.type === 'notify_pm') {
        const { notificationQueue } = require('../../queues/queueSetup');
        if (payload.milestone && payload.milestone.pm_id) {
          await notificationQueue.add('workflowNotification', {
            type: 'in-app',
            recipientId: payload.milestone.pm_id,
            message: action.message,
          });
        }
      }
    }
  }
}

// Instantiate to boot it up
const workflowEngine = new WorkflowEngine();

module.exports = workflowEngine;
