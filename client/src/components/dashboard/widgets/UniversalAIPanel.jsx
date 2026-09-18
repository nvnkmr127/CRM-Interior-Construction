/* eslint-disable no-unused-vars */
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../../api/axios';
import styles from './UniversalAIPanel.module.css';

const renderFormattedText = (text) => {
  if (!text) return null;
  // Replace **text** with <strong>text</strong> for clean display
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
};

export function UniversalAIPanel() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef(null);
  
  const [messages, setMessages] = useState([
    { role: 'ai', text: 'Hi, I am your CRM AI assistant. Ask me anything about your live leads, projects, or tasks!' }
  ]);

  const togglePanel = () => setIsOpen(!isOpen);

  const handleOpenLead = (leadId) => {
    if (!leadId) return;
    navigate(`/leads?id=${leadId}&view=list`);
  };

  useEffect(() => {
    if (isOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const executeQuery = async (userText) => {
    if (!userText || loading) return;

    setMessages(prev => [...prev, { role: 'user', text: userText }]);
    setQuery('');
    setLoading(true);

    const lower = userText.toLowerCase();

      // Intent detection
      const isBudgetOrFinancial = /\b(budget|pending|collect|cost|value|price|paid|amount|collection|money|financial)\b/i.test(lower);
      const isTeamOrRole = /\b(team|member|members|user|users|staff|employee|employees|designer|designers|pm|pms|project manager|project managers|admin|sales|executive|role|roles)\b/i.test(lower);

      const isWhoOrList = /\b(who|which|list|names?|show|give|details|tell me about|present in|what are)\b/i.test(lower);
      const isCount = /\b(how many|count|total|number of|sum)\b/i.test(lower);

      const isLeadTopic = /\b(lead|leads|prospect|prospects|client|clients)\b/i.test(lower);
      // Ensure 'project manager' or 'pm' is NOT classified as a generic project list topic
      const isProjectTopic = /\b(project|projects|site|sites)\b/i.test(lower) && !/\b(project manager|project managers|pm|pms)\b/i.test(lower);
      const isTaskTopic = /\b(task|tasks|followup|follow-up|todo|todos)\b/i.test(lower);

      const isOnlyActive = lower.includes('active') || lower.includes('open') || lower.includes('pending') || lower.includes('in progress');
      const isConverted = lower.includes('converted') || lower.includes('won');
      const isLost = lower.includes('lost');

      try {
        let aiMessage = { role: 'ai', text: '' };

        // Helper to format currency accurately
        const formatCurrency = (val) => {
          if (val === undefined || val === null || isNaN(Number(val))) return '₹0';
          return `₹${Number(val).toLocaleString('en-IN')}`;
        };

        // 1. SPECIFIC TEAM MEMBERS / ROLE QUERY
        if (isTeamOrRole && !isProjectTopic && !isLeadTopic && !isTaskTopic) {
          try {
            const res = await api.get('/users', { params: { limit: 100 } });
            const users = Array.isArray(res.data?.data) ? res.data.data : (Array.isArray(res.data) ? res.data : []);
            
            // Extract requested role dynamically or match against known patterns
            let requestedRoleMatch = lower.match(/\b(designer|designers|pm|pms|project manager|project managers|admin|superadmin|sales|executive|qc|quality|engineer|qc engineer|architect|supervisor|accountant|site engineer)\b/i);
            
            // Or extract phrase right before "role" or "assigned as"
            let extractedRole = null;
            const rolePhraseMatch = lower.match(/(?:assigned as|role as|role of|with the|as a|as)\s+(?:a\s+|an\s+)?([a-z0-9\s]+?)(?:\s+role|\s+team|\s*$)/i);
            if (rolePhraseMatch && rolePhraseMatch[1]) {
              extractedRole = rolePhraseMatch[1].trim();
            }

            let filteredUsers = [];
            let roleTitle = 'Team Members';

            if (/\b(designer|designers)\b/i.test(lower)) {
              roleTitle = 'Designer';
              filteredUsers = users.filter(u => /\bdesigner\b/i.test(u.role_name || u.role || ''));
            } else if (/\b(pm|pms|project manager|project managers)\b/i.test(lower)) {
              roleTitle = 'Project Manager';
              filteredUsers = users.filter(u => {
                const r = (u.role_name || u.role || '').toLowerCase();
                return r.includes('pm') || r.includes('project manager');
              });
            } else if (/\b(admin|superadmin)\b/i.test(lower)) {
              roleTitle = 'Admin';
              filteredUsers = users.filter(u => /\badmin\b/i.test(u.role_name || u.role || ''));
            } else if (/\b(sales|executive)\b/i.test(lower)) {
              roleTitle = 'Sales Executive';
              filteredUsers = users.filter(u => /\b(sales|executive)\b/i.test(u.role_name || u.role || ''));
            } else if (extractedRole || requestedRoleMatch) {
              const targetRoleStr = (extractedRole || requestedRoleMatch[0]).toLowerCase();
              roleTitle = targetRoleStr.charAt(0).toUpperCase() + targetRoleStr.slice(1);
              filteredUsers = users.filter(u => {
                const r = (u.role_name || u.role || '').toLowerCase();
                return r.includes(targetRoleStr);
              });
            } else {
              // General team list query
              filteredUsers = users;
            }

            if (filteredUsers.length === 0) {
              aiMessage.text = `There are currently no team members assigned with the **${roleTitle}** role in your CRM.`;
            } else {
              aiMessage.text = `Here is the list of **${filteredUsers.length} team member(s)** with the **${roleTitle}** role:`;
              aiMessage.usersList = filteredUsers;
            }
          } catch (err) {
            aiMessage.text = "Unable to fetch team members list right now.";
          }
        }
      // 2. TASK TOPIC QUERY (Higher priority than general project topic when tasks are explicitly mentioned)
      else if (isTaskTopic) {
        try {
          const res = await api.get('/tasks');
          const tasks = Array.isArray(res.data?.data) ? res.data.data : (Array.isArray(res.data) ? res.data : []);
          const pendingTasks = tasks.filter(t => (t.status || '').toLowerCase() !== 'completed' && (t.status || '').toLowerCase() !== 'done');
          
          if (isWhoOrList || lower.includes('give me') || lower.includes('show me') || !isCount) {
            const listToDisplay = isOnlyActive ? pendingTasks : tasks;
            if (listToDisplay.length === 0) {
              aiMessage.text = `There are currently no **${isOnlyActive ? 'pending ' : ''}tasks** in your CRM.`;
            } else {
              aiMessage.text = `Here are your **${listToDisplay.length} ${isOnlyActive ? 'pending ' : ''}task(s)**:`;
              aiMessage.tasksList = listToDisplay;
            }
          } else {
            aiMessage.text = `You have **${tasks.length} total task(s)** assigned, with **${pendingTasks.length} pending task(s)** requiring follow-up.`;
            aiMessage.card = {
              title: 'Tasks Overview',
              metrics: [
                { label: 'Pending Tasks', value: pendingTasks.length },
                { label: 'Total Tasks', value: tasks.length }
              ]
            };
          }
        } catch (err) {
          aiMessage.text = "Unable to fetch live tasks data right now.";
        }
      }
      // 3. PROJECT FINANCIAL / BUDGET / PENDING AMOUNT QUERY OR GENERAL PROJECT QUERY
      else if (isProjectTopic || (isBudgetOrFinancial && !isLeadTopic)) {
        try {
          const statusParam = isOnlyActive ? 'active' : undefined;
          const res = await api.get('/projects', { params: { status: statusParam, limit: 100 } });
          const projects = Array.isArray(res.data?.data) ? res.data.data : (Array.isArray(res.data) ? res.data : []);
          const total = res.data?.pagination?.total ?? res.total ?? projects.length;

          const isProjectActive = (p) => {
            const st = (p.status || 'active').toLowerCase();
            return !['completed', 'deleted', 'cancelled', 'archived', 'on_hold'].includes(st);
          };

          const activeProjects = projects.filter(isProjectActive);
          const targetProjects = isOnlyActive ? activeProjects : projects;

          // Check if specific project name is mentioned (e.g., "pavan", "mahesh")
          const matchedProject = projects.find(p => {
            const pName = (p.name || p.title || '').toLowerCase();
            const cName = (p.client_name || '').toLowerCase();
            return (pName && lower.includes(pName)) || 
                   (cName && lower.includes(cName)) ||
                   (lower.includes('pavan') && (pName.includes('pavan') || cName.includes('pavan'))) ||
                   (lower.includes('mahesh') && (pName.includes('mahesh') || cName.includes('mahesh')));
          });

          const isCombinedAggregate = /\b(all|combined|total|overall|portfolio|every|sum)\b/i.test(lower);
          const isFollowupSingleRequest = matchedProject && (lower.includes('only for') || lower.includes('give for') || lower.includes('show for') || lower.includes('just for') || lower.includes('details for') || lower.includes('for '));

          if (isCombinedAggregate && isBudgetOrFinancial) {
            // Fetch detailed stats for all active projects
            const detailsPromises = targetProjects.map(p => 
              api.get(`/projects/${p.id}`).then(r => r.data?.data || p).catch(() => p)
            );
            const detailedProjects = await Promise.all(detailsPromises);

            let combinedBudget = 0;
            let combinedCollected = 0;
            let combinedPending = 0;

            detailedProjects.forEach(dp => {
              const stats = dp.stats || {};
              const b = Number(dp.contract_value || dp.value || dp.budget || stats.netContractValue || 0);
              const c = stats.collectedPayment !== undefined ? Number(stats.collectedPayment) : Number(dp.paid_amount || dp.collected_amount || 0);
              
              // If milestone invoices haven't been raised yet, outstandingBalance is 0 because netBilled is 0.
              // In this case, pending collection is budget - collected.
              let p = 0;
              if (stats.outstandingBalance !== undefined && stats.outstandingBalance > 0) {
                p = Number(stats.outstandingBalance);
              } else {
                p = Math.max(0, b - c);
              }

              combinedBudget += b;
              combinedCollected += c;
              combinedPending += p;
            });

            aiMessage.text = `Across all **${targetProjects.length} ${isOnlyActive ? 'active ' : ''}project(s) combined**, the total amount left to collect is **${formatCurrency(combinedPending)}** (Total Budget: ${formatCurrency(combinedBudget)}, Total Collected: ${formatCurrency(combinedCollected)}).`;
            
            aiMessage.card = {
              title: `Portfolio Financial Intelligence`,
              metrics: [
                { label: 'Total Portfolio Budget', value: formatCurrency(combinedBudget) },
                { label: 'Total Collected', value: formatCurrency(combinedCollected) },
                { label: 'Total Pending to Collect', value: formatCurrency(combinedPending) }
              ]
            };
          } else if (matchedProject && (isBudgetOrFinancial || isFollowupSingleRequest)) {
            let detailProj = matchedProject;
            try {
              const dRes = await api.get(`/projects/${matchedProject.id}`);
              if (dRes.data?.data) {
                detailProj = dRes.data.data;
              }
            } catch (e) {
              // fallback to matchedProject list data
            }

            const name = detailProj.name || detailProj.title || detailProj.client_name || 'Project';
            const stats = detailProj.stats || {};

            const budgetVal = Number(detailProj.contract_value || detailProj.value || detailProj.budget || stats.netContractValue || 0);
            const collectedVal = stats.collectedPayment !== undefined ? Number(stats.collectedPayment) : Number(detailProj.paid_amount || detailProj.collected_amount || 0);
            
            let pendingVal = 0;
            if (stats.outstandingBalance !== undefined && stats.outstandingBalance > 0) {
              pendingVal = Number(stats.outstandingBalance);
            } else {
              pendingVal = Math.max(0, budgetVal - collectedVal);
            }
            
            if (lower.includes('pending') || lower.includes('collect') || lower.includes('balance') || lower.includes('remaining')) {
              aiMessage.text = `For **${name}**, the remaining pending amount to collect is **${formatCurrency(pendingVal)}** (Collected: ${formatCurrency(collectedVal)} out of Total Budget: ${formatCurrency(budgetVal)}).`;
            } else {
              aiMessage.text = `Financial breakdown for **${name}**: Total Budget is **${formatCurrency(budgetVal)}**, Collected Amount is **${formatCurrency(collectedVal)}**, and Pending to Collect is **${formatCurrency(pendingVal)}**.`;
            }

            aiMessage.card = {
              title: `${name} Financial Summary`,
              metrics: [
                { label: 'Total Budget', value: formatCurrency(budgetVal) },
                { label: 'Collected Amount', value: formatCurrency(collectedVal) },
                { label: 'Pending to Collect', value: formatCurrency(pendingVal) }
              ]
            };
            aiMessage.projectsList = [detailProj];
          } else if (isWhoOrList && !isCount) {
            if (targetProjects.length === 0) {
              aiMessage.text = `There are currently no **${isOnlyActive ? 'active ' : ''}projects** in your CRM.`;
            } else {
              aiMessage.text = `Here are your **${targetProjects.length} ${isOnlyActive ? 'active ' : ''}project(s)**:`;
              aiMessage.projectsList = targetProjects;
            }
          } else {
            aiMessage.text = `You have **${total} total project(s)**, with **${activeProjects.length} currently active / in-progress**.`;
            aiMessage.card = {
              title: 'Projects Intelligence',
              metrics: [
                { label: 'Active Projects', value: activeProjects.length },
                { label: 'Total Projects', value: total }
              ]
            };
          }
        } catch (err) {
          aiMessage.text = "Unable to fetch live projects data right now.";
        }
      } else if (isLeadTopic || lower.includes('lead') || lower.includes('prospect')) {
        try {
          let statusFilterParam = 'active';
          let stageLabel = 'Active';

          if (isConverted) {
            statusFilterParam = 'converted';
            stageLabel = 'Converted';
          } else if (lower.includes('parked')) {
            statusFilterParam = 'parked';
            stageLabel = 'Parked';
          } else if (isLost) {
            statusFilterParam = 'lost';
            stageLabel = 'Lost';
          }

          // Fetch exact leads for requested tab status
          const [statusRes, totalRes] = await Promise.all([
            api.get('/leads', { params: { status: statusFilterParam } }),
            api.get('/leads').catch(() => ({ data: { data: [] } }))
          ]);

          const filteredLeads = Array.isArray(statusRes.data?.data) ? statusRes.data.data : (Array.isArray(statusRes.data) ? statusRes.data : []);
          const allLeads = Array.isArray(totalRes.data?.data) ? totalRes.data.data : (Array.isArray(totalRes.data) ? totalRes.data : []);
          const totalCount = totalRes.data?.pagination?.total ?? (allLeads.length || filteredLeads.length);

          // 1. If user is asking WHO / LIST / NAMES of the leads:
          if (isWhoOrList && !isCount) {
            if (filteredLeads.length === 0) {
              aiMessage.text = `There are currently no **${stageLabel.toLowerCase()} leads** in your CRM.`;
            } else if (filteredLeads.length === 1) {
              const lead = filteredLeads[0];
              const name = lead.name || lead.title || lead.client_name || lead.contact_name || `Lead #${lead.id}`;
              const stage = lead.stage_name || lead.stage || lead.status || stageLabel;
              aiMessage.text = `The **${stageLabel.toLowerCase()} lead** currently in your CRM is **${name}** (Stage: ${stage}).`;
              aiMessage.leadsList = filteredLeads;
            } else {
              aiMessage.text = `Here are the **${filteredLeads.length} ${stageLabel.toLowerCase()} lead(s)** in your CRM:`;
              aiMessage.leadsList = filteredLeads;
            }
          } else {
            // 2. If user is asking HOW MANY / COUNT / SUMMARY:
            const activeCount = filteredLeads.length;
            
            aiMessage.text = isOnlyActive 
              ? `Currently, there is **${activeCount} active lead** in your CRM out of ${totalCount} total leads.`
              : `There are **${totalCount} total lead(s)** (${activeCount} active) in your CRM.`;

            const stagesCount = {};
            filteredLeads.forEach(l => {
              let st = l.stage_name || l.stage || l.status || 'Active';
              st = st.charAt(0).toUpperCase() + st.slice(1);
              stagesCount[st] = (stagesCount[st] || 0) + 1;
            });

            const breakdownList = Object.entries(stagesCount).map(([stage, count]) => ({ stage, count }));

            aiMessage.card = {
              title: isOnlyActive ? 'Active Leads Summary' : 'Leads Overview',
              metrics: [
                { label: 'Active Leads', value: activeCount },
                { label: 'Total Leads', value: totalCount }
              ],
              breakdownTitle: 'Stage Breakdown',
              breakdown: breakdownList
            };
          }
        } catch (err) {
          if (err.response?.status === 403) {
            aiMessage.text = "Your role currently does not have permission to view leads data.";
          } else {
            aiMessage.text = "Unable to fetch live leads data at the moment. Please check your network connection.";
          }
        }
      } else if (isTaskTopic) {
        try {
          const res = await api.get('/tasks');
          const tasks = Array.isArray(res.data?.data) ? res.data.data : (Array.isArray(res.data) ? res.data : []);
          const pendingTasks = tasks.filter(t => (t.status || '').toLowerCase() !== 'completed');
          
          if (isWhoOrList && !isCount) {
            const listToDisplay = isOnlyActive ? pendingTasks : tasks;
            if (listToDisplay.length === 0) {
              aiMessage.text = `There are currently no **${isOnlyActive ? 'pending ' : ''}tasks** in your CRM.`;
            } else {
              aiMessage.text = `Here are your **${listToDisplay.length} task(s)**:`;
              aiMessage.tasksList = listToDisplay;
            }
          } else {
            aiMessage.text = `You have **${tasks.length} total task(s)** assigned, with **${pendingTasks.length} pending task(s)** requiring follow-up.`;
            aiMessage.card = {
              title: 'Tasks Overview',
              metrics: [
                { label: 'Pending Tasks', value: pendingTasks.length },
                { label: 'Total Tasks', value: tasks.length }
              ]
            };
          }
        } catch (err) {
          aiMessage.text = "Unable to fetch live tasks data right now.";
        }
      } else {
        try {
          const res = await api.post('/ai/copilot/chat', { message: userText });
          aiMessage.text = res.data?.reply || res.data?.data?.reply || "I am connected to your live CRM system. Ask me about active leads, projects, or pending tasks!";
        } catch (err) {
          try {
            const leadsRes = await api.get('/leads');
            const leadsCount = leadsRes.data?.pagination?.total ?? (Array.isArray(leadsRes.data?.data) ? leadsRes.data.data.length : 0);
            aiMessage.text = `I am connected to your CRM with **${leadsCount} total leads**. Ask me specific questions about lead names, active leads, projects, or tasks!`;
          } catch {
            aiMessage.text = "I am connected to your CRM assistant service. How can I help you analyze your leads or dashboard today?";
          }
        }
      }

      setMessages(prev => [...prev, aiMessage]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'ai', text: 'Error processing your request. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    executeQuery(query);
  };

  return (
    <>
      {/* Floating Button */}
      <button 
        className={`${styles.fab} ${isOpen ? styles.fabOpen : ''}`} 
        onClick={togglePanel}
        aria-label="Toggle AI Panel"
      >
        {isOpen ? (
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        ) : (
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="10" rx="2"></rect>
            <circle cx="12" cy="5" r="2"></circle>
            <path d="M12 7v4"></path>
            <line x1="8" y1="16" x2="8.01" y2="16"></line>
            <line x1="16" y1="16" x2="16.01" y2="16"></line>
          </svg>
        )}
      </button>

      {/* AI Panel */}
      <div className={`${styles.panel} ${isOpen ? styles.panelOpen : ''}`}>
        <div className={styles.header}>
          <div>
            <h2 className={styles.headerTitle}>Universal AI Assistant</h2>
            <p className={styles.headerSubtitle}>Ask anything about your dashboard or leads</p>
          </div>
        </div>
        
        <div className={styles.chatArea}>
          {messages.map((msg, idx) => (
            <div key={idx} className={`${styles.message} ${msg.role === 'ai' ? styles.messageAi : styles.messageUser}`}>
              <div className={styles.bubble}>
                <div>{renderFormattedText(msg.text)}</div>

                {/* Render Lead List Cards */}
                {msg.leadsList && msg.leadsList.length > 0 && (
                  <div className={styles.leadList}>
                    {msg.leadsList.map((lead, lIdx) => {
                      const name = lead.name || lead.title || lead.client_name || lead.contact_name || `Lead #${lead.id}`;
                      const stage = lead.stage_name || lead.stage || lead.status || 'Active';
                      const email = lead.email;
                      const phone = lead.phone;
                      const assignee = lead.assignee_name;
                      const budget = lead.budget ? `₹${Number(lead.budget).toLocaleString()}` : null;

                      return (
                        <div 
                          key={lIdx} 
                          className={styles.leadItemCard}
                          onClick={() => handleOpenLead(lead.id)}
                          title="Click to view full lead details"
                        >
                          <div className={styles.leadCardTop}>
                            <span className={styles.leadItemName}>👤 {name} <span className={styles.leadClickHint}>↗</span></span>
                            <span className={styles.leadStageBadge}>{stage}</span>
                          </div>
                          <div className={styles.leadMetaRow}>
                            {email && <span className={styles.leadMetaItem}>📧 {email}</span>}
                            {phone && <span className={styles.leadMetaItem}>📞 {phone}</span>}
                            {budget && <span className={styles.leadMetaItem}>💰 {budget}</span>}
                            {assignee && <span className={styles.leadMetaItem}>👨‍💼 {assignee}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Render Project List Cards */}
                {msg.projectsList && msg.projectsList.length > 0 && (
                  <div className={styles.leadList}>
                    {msg.projectsList.map((proj, pIdx) => {
                      const title = proj.title || proj.name || `Project #${proj.id}`;
                      const status = proj.status || 'In Progress';
                      const client = proj.client_name;
                      return (
                        <div 
                          key={pIdx} 
                          className={styles.leadItemCard}
                          onClick={() => proj.id && navigate(`/projects/${proj.id}`)}
                          title="Click to view project details"
                        >
                          <div className={styles.leadCardTop}>
                            <span className={styles.leadItemName}>🏗️ {title} <span className={styles.leadClickHint}>↗</span></span>
                            <span className={styles.leadStageBadge}>{status}</span>
                          </div>
                          {client && (
                            <div className={styles.leadMetaRow}>
                              <span className={styles.leadMetaItem}>👤 Client: {client}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Render User / Team Member List Cards */}
                {msg.usersList && msg.usersList.length > 0 && (
                  <div className={styles.leadList}>
                    {msg.usersList.map((usr, uIdx) => {
                      const name = usr.name || usr.email || `User #${usr.id}`;
                      const role = usr.role_name || usr.role || 'Team Member';
                      const email = usr.email;
                      const status = usr.status || 'active';
                      return (
                        <div key={uIdx} className={styles.leadItemCard}>
                          <div className={styles.leadCardTop}>
                            <span className={styles.leadItemName}>👨‍💼 {name}</span>
                            <span className={styles.leadStageBadge}>{role}</span>
                          </div>
                          <div className={styles.leadMetaRow}>
                            {email && <span className={styles.leadMetaItem}>📧 {email}</span>}
                            <span className={styles.leadMetaItem}>⚡ Status: {status}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Render Task List Cards */}
                {msg.tasksList && msg.tasksList.length > 0 && (
                  <div className={styles.leadList}>
                    {msg.tasksList.map((tsk, tIdx) => {
                      const title = tsk.title || tsk.name || `Task #${tsk.id}`;
                      const status = tsk.status || 'Pending';
                      const priority = tsk.priority;
                      return (
                        <div key={tIdx} className={styles.leadItemCard}>
                          <div className={styles.leadCardTop}>
                            <span className={styles.leadItemName}>📋 {title}</span>
                            <span className={styles.leadStageBadge}>{status}</span>
                          </div>
                          {priority && (
                            <div className={styles.leadMetaRow}>
                              <span className={styles.leadMetaItem}>🔥 Priority: {priority}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Render Rich AI Metric Summary Cards */}
                {msg.card && (
                  <div className={styles.aiCard}>
                    <div className={styles.cardHeader}>
                      <span>⚡</span> {msg.card.title}
                    </div>

                    {msg.card.metrics && (
                      <div className={styles.statGrid}>
                        {msg.card.metrics.map((m, mIdx) => (
                          <div key={mIdx} className={styles.statItem}>
                            <span className={styles.statVal}>{m.value}</span>
                            <span className={styles.statLbl}>{m.label}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {msg.card.breakdown && msg.card.breakdown.length > 0 && (
                      <div className={styles.breakdownSection}>
                        <div className={styles.breakdownTitle}>{msg.card.breakdownTitle || 'Breakdown'}</div>
                        <div className={styles.tagsWrapper}>
                          {msg.card.breakdown.map((item, bIdx) => (
                            <span key={bIdx} className={styles.stageTag}>
                              {item.stage} <span className={styles.tagCount}>{item.count}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className={`${styles.message} ${styles.messageAi}`}>
              <div className={styles.bubble}>
                ⚡ Fetching live CRM data...
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
        
        {/* Quick Suggestion Chips */}
        <div className={styles.quickChips}>
          <button type="button" className={styles.chipBtn} onClick={() => executeQuery('who is present in the active leads')}>
            👤 Who is Active Lead
          </button>
          <button type="button" className={styles.chipBtn} onClick={() => executeQuery('how many leads were present in active leads tab')}>
            📊 Lead Count
          </button>
          <button type="button" className={styles.chipBtn} onClick={() => executeQuery('list active projects')}>
            🏗️ Projects
          </button>
        </div>

        <form className={styles.inputArea} onSubmit={handleFormSubmit}>
          <input 
            type="text" 
            placeholder="Ask 'who is the active lead' or 'show projects'..." 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={loading}
          />
          <button type="submit" disabled={!query.trim() || loading}>
            {loading ? '...' : 'Send'}
          </button>
        </form>
      </div>
    </>
  );
}



