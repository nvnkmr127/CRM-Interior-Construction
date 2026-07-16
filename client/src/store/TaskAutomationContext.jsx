/* eslint-disable no-unused-vars, react-hooks/set-state-in-effect, no-empty, preserve-caught-error, react-hooks/exhaustive-deps, react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { updateGlobalTask, updateTask, createGlobalTask, getGlobalTasks } from '../api/tasks';
import { useTaskNotifications } from './TaskNotificationContext';
import { useToast } from './toastContext';

const TaskAutomationContext = createContext(null);

export function TaskAutomationProvider({ children }) {
  const [rules, setRules] = useState([]);
  const [logs, setLogs] = useState([]);
  const toast = useToast();
  const { addNotification } = useTaskNotifications();
  const timerRef = useRef(null);

  useEffect(() => {
    try {
      const savedRules = localStorage.getItem('myTaskAutomations');
      if (savedRules) setRules(JSON.parse(savedRules));
      const savedLogs = localStorage.getItem('myTaskAutomationLogs');
      if (savedLogs) setLogs(JSON.parse(savedLogs));
    } catch (e) {}
  }, []);

  useEffect(() => {
    localStorage.setItem('myTaskAutomations', JSON.stringify(rules));
  }, [rules]);

  useEffect(() => {
    localStorage.setItem('myTaskAutomationLogs', JSON.stringify(logs));
  }, [logs]);

  const addLog = (ruleId, ruleName, taskId, taskTitle, status, message) => {
    const entry = {
      id: Date.now().toString() + Math.random().toString(36).substr(2,5),
      timestamp: new Date().toISOString(),
      ruleId, ruleName, taskId, taskTitle, status, message
    };
    setLogs(prev => [entry, ...prev].slice(0, 500)); // Keep last 500 logs
  };

  const executeAction = async (action, task) => {
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
        addNotification('mentioned', 'Automation Alert', `Task "${task.title}" triggered manager notification.`, task.id);
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
  };

  const evaluateCondition = (condition, task, prevTask) => {
    const val = task[condition.field];
    if (condition.operator === 'equals') return val === condition.value;
    if (condition.operator === 'not_equals') return val !== condition.value;
    if (condition.operator === 'contains') return val && Array.isArray(val) ? val.includes(condition.value) : String(val).includes(condition.value);
    if (condition.operator === 'changed_to') return val === condition.value && prevTask?.[condition.field] !== condition.value;
    return false;
  };

  const runAutomations = (triggerEvent, task, prevTask = null) => {
    if (!task || !task.id) return;
    
    // We do not await these, they run asynchronously in the background.
    setTimeout(async () => {
      for (const rule of rules) {
        if (!rule.isActive) continue;
        if (rule.trigger.type !== triggerEvent) continue;

        try {
          // Check conditions (AND logic)
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
              const msg = await executeAction(action, task);
              resultMsgs.push(msg);
            }
            addLog(rule.id, rule.name, task.id, task.title, 'success', resultMsgs.join(', '));
            toast.success(`Automation applied: ${rule.name}`);
            // Dispatch event to force UI reload if needed
            window.dispatchEvent(new CustomEvent('automationExecuted'));
          }
        } catch (err) {
          addLog(rule.id, rule.name, task.id, task.title, 'error', err.message);
          toast.error(`Automation failed: ${rule.name}`);
        }
      }
    }, 0);
  };

  // Schedule loop for 'schedule' triggers
  useEffect(() => {
    timerRef.current = setInterval(async () => {
      const scheduledRules = rules.filter(r => r.isActive && r.trigger.type === 'schedule');
      if (scheduledRules.length === 0) return;
      
      const now = new Date();
      // Extremely simplified scheduler for mock:
      // If trigger.value is 'every_minute', we run it.
      // If it's a specific hour "09:00", we check if we just crossed that minute (requires lastRun tracking).
      // For simplicity in this demo, let's just trigger 'every_minute' or mock a time match.
      
      try {
        const res = await getGlobalTasks({ assigneeId: 'me', limit: 100 });
        const allTasks = res.data?.data || res.data || [];
        const tasks = Array.isArray(allTasks) ? allTasks : [];
        
        for (const rule of scheduledRules) {
          // e.g. rule.trigger.value === '09:00'
          const [hh, mm] = (rule.trigger.value || '00:00').split(':');
          if (now.getHours() === parseInt(hh) && now.getMinutes() === parseInt(mm) && now.getSeconds() < 10) {
             // Basic naive match if it hits within the first 10 seconds of the minute
             for (const t of tasks) {
               let met = true;
               for (const cond of rule.conditions) {
                 if (!evaluateCondition(cond, t, t)) met = false;
               }
               if (met) {
                 for (const action of rule.actions) {
                   await executeAction(action, t);
                 }
                 addLog(rule.id, rule.name, t.id, t.title, 'success', 'Scheduled run success');
               }
             }
          }
        }
      } catch (e) {}
    }, 10000); // Check every 10 seconds
    
    return () => clearInterval(timerRef.current);
  }, [rules]);

  return (
    <TaskAutomationContext.Provider value={{
      rules, setRules, logs, runAutomations, clearLogs: () => setLogs([])
    }}>
      {children}
    </TaskAutomationContext.Provider>
  );
}

export const useTaskAutomation = () => useContext(TaskAutomationContext);
