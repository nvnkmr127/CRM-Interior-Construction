import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { updateGlobalTask, updateTask, createGlobalTask, getGlobalTasks } from '../api/tasks';

export const useTaskAutomationStore = create(
  persist(
    (set, get) => ({
      rules: [],
      logs: [],

      setRules: (rules) => set({ rules }),
      
      clearLogs: () => set({ logs: [] }),

      addLog: (ruleId, ruleName, taskId, taskTitle, status, message) => {
        const entry = {
          id: Date.now().toString() + Math.random().toString(36).substring(2, 7),
          timestamp: new Date().toISOString(),
          ruleId, ruleName, taskId, taskTitle, status, message
        };
        set((state) => ({
          logs: [entry, ...state.logs].slice(0, 500)
        }));
      },

      executeAction: async (action, task, deps) => {
        try {
          if (action.type === 'change_status') {
            const p = { status: action.value };
            task.project?.id ? await updateTask(task.project.id, task.id, p) : await updateGlobalTask(task.id, p);
            return `Changed status to ${action.value}`;
          }
          if (action.type === 'change_priority') {
            const p = { priority: action.value };
            task.project?.id ? await updateTask(task.project.id, task.id, p) : await updateGlobalTask(task.id, p);
            return `Changed priority to ${action.value}`;
          }
          if (action.type === 'add_tag') {
            const p = { tags: [...(task.tags || []), action.value] };
            task.project?.id ? await updateTask(task.project.id, task.id, p) : await updateGlobalTask(task.id, p);
            return `Added tag ${action.value}`;
          }
          if (action.type === 'notify_manager') {
            if (deps?.addNotification) {
              deps.addNotification('mentioned', 'Automation Alert', `Task "${task.title}" triggered manager notification.`, task.id);
            }
            return `Notified manager via UI`;
          }
          if (action.type === 'create_task') {
            await createGlobalTask({ 
              title: `Follow-up: ${task.title}`, 
              description: 'Auto-generated follow up task',
              status: 'todo',
              priority: 'medium'
            });
            return `Created follow-up task`;
          }
          return `Unknown action type: ${action.type}`;
        } catch (e) {
          throw new Error(`Failed to execute ${action.type}: ${e.message}`);
        }
      },

      evaluateCondition: (condition, task, prevTask) => {
        const val = task[condition.field];
        if (condition.operator === 'equals') return val === condition.value;
        if (condition.operator === 'not_equals') return val !== condition.value;
        if (condition.operator === 'contains') return val && Array.isArray(val) ? val.includes(condition.value) : String(val).includes(condition.value);
        if (condition.operator === 'changed_to') return val === condition.value && prevTask?.[condition.field] !== condition.value;
        return false;
      },

      runAutomations: (triggerEvent, task, prevTask = null, deps = {}) => {
        if (!task || !task.id) return;
        const { rules, evaluateCondition, executeAction, addLog } = get();
        
        setTimeout(async () => {
          for (const rule of rules) {
            if (!rule.isActive) continue;
            if (rule.trigger.type !== triggerEvent) continue;

            try {
              let conditionsMet = true;
              for (const cond of rule.conditions) {
                if (!evaluateCondition(cond, task, prevTask)) {
                  conditionsMet = false;
                  break;
                }
              }

              if (conditionsMet) {
                let resultMsgs = [];
                for (const action of rule.actions) {
                  const msg = await executeAction(action, task, deps);
                  resultMsgs.push(msg);
                }
                addLog(rule.id, rule.name, task.id, task.title, 'success', resultMsgs.join(', '));
                if (deps.toast) deps.toast.success(`Automation applied: ${rule.name}`);
                window.dispatchEvent(new CustomEvent('automationExecuted'));
              }
            } catch (err) {
              addLog(rule.id, rule.name, task.id, task.title, 'error', err.message);
              if (deps.toast) deps.toast.error(`Automation failed: ${rule.name}`);
            }
          }
        }, 0);
      }
    }),
    {
      name: 'task-automation-storage',
      partialize: (state) => ({ rules: state.rules, logs: state.logs })
    }
  )
);

let schedulerTimer = null;
export function initAutomationScheduler() {
  if (schedulerTimer) return;
  
  // One-time migration from old Context-based localStorage keys
  try {
    const oldRules = localStorage.getItem('myTaskAutomations');
    if (oldRules) {
      useTaskAutomationStore.getState().setRules(JSON.parse(oldRules));
      localStorage.removeItem('myTaskAutomations');
    }
    const oldLogs = localStorage.getItem('myTaskAutomationLogs');
    if (oldLogs) {
      useTaskAutomationStore.setState({ logs: JSON.parse(oldLogs) });
      localStorage.removeItem('myTaskAutomationLogs');
    }
  } catch (e) {
    // ignore parse errors
  }

  schedulerTimer = setInterval(async () => {
    const { rules, evaluateCondition, executeAction, addLog } = useTaskAutomationStore.getState();
    const scheduledRules = rules.filter(r => r.isActive && r.trigger.type === 'schedule');
    if (scheduledRules.length === 0) return;
    
    const now = new Date();
    try {
      const res = await getGlobalTasks({ assigneeId: 'me', limit: 100 });
      const allTasks = res.data?.data || res.data || [];
      const tasks = Array.isArray(allTasks) ? allTasks : [];
      
      for (const rule of scheduledRules) {
        const [hh, mm] = (rule.trigger.value || '00:00').split(':');
        if (now.getHours() === parseInt(hh, 10) && now.getMinutes() === parseInt(mm, 10) && now.getSeconds() < 10) {
           for (const t of tasks) {
             let met = true;
             for (const cond of rule.conditions) {
               if (!evaluateCondition(cond, t, t)) met = false;
             }
             if (met) {
               for (const action of rule.actions) {
                 await executeAction(action, t, {});
               }
               addLog(rule.id, rule.name, t.id, t.title, 'success', 'Scheduled run success');
             }
           }
        }
      }
    } catch (e) {
      // silent background error
    }
  }, 10000);
}
