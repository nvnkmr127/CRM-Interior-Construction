/* eslint-disable no-dupe-else-if, no-unused-vars */
import { loadMockDatabase, saveMockDatabase } from './mockData';

export const setupMockInterceptor = (api) => {
  api.interceptors.request.use(
    (config) => {
      if (import.meta.env.DEV && localStorage.getItem('mockSession')) {
        const method = (config.method || 'get').toLowerCase();
        const isMutation = ['post', 'patch', 'put', 'delete'].includes(method);
        const url = config.url || '';

        config.adapter = () => {
          let responseData = { success: true, data: [], meta: {} };
          const mockDatabase = loadMockDatabase();

          const persistDb = () => saveMockDatabase(mockDatabase);

          if (!mockDatabase.taskTemplates) {
            mockDatabase.taskTemplates = [
              {
                id: 'tmpl-1',
                name: 'Client Onboarding',
                category: 'HR',
                is_favorite: true,
                is_shared: true,
                title: 'Onboard [Client Name]',
                description: '<p>Standard onboarding process.</p>',
                priority: 'high',
                checklist: [{ id: '1', text: 'Send welcome email', done: false }]
              },
              {
                id: 'tmpl-2',
                name: 'Weekly Report',
                category: 'Management',
                is_favorite: false,
                is_shared: true,
                title: 'Weekly Status Report',
                description: 'Compile metrics.',
                priority: 'medium',
                checklist: []
              }
            ]
          }

          if (!mockDatabase.tags) {
            mockDatabase.tags = [
              { id: 'tag-1', name: 'Urgent', color: '#ef4444' },
              { id: 'tag-2', name: 'Frontend', color: '#3b82f6' },
              { id: 'tag-3', name: 'Backend', color: '#10b981' },
              { id: 'tag-4', name: 'Design', color: '#8b5cf6' },
            ]
          }

          if (!mockDatabase.taskViews) {
            mockDatabase.taskViews = [
              {
                id: 'view-1',
                name: 'Default List',
                is_shared: true,
                is_default: false,
                payload: {
                  activeTab: 'all',
                  statusFilter: 'all',
                  priorityFilter: 'all',
                  projectFilter: 'all',
                  tagFilter: 'all',
                  sortBy: 'due_asc',
                  viewMode: 'list'
                }
              }
            ]
          }

          const logTaskActivity = (taskId, actionType, description, userName = 'Admin User') => {
            if (!mockDatabase.taskActivity) mockDatabase.taskActivity = [];
            mockDatabase.taskActivity.push({
              id: `act-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              task_id: taskId,
              action_type: actionType, // created, edited, status_changed, priority_changed, due_date_changed, assignee_changed, checklist_updated, comment_added, attachment_added
              description,
              created_at: new Date().toISOString(),
              user_name: userName,
              is_ai: actionType.startsWith('ai_')
            });
            persistDb();
          };

          const addDays = (date, days) => {
            const d = new Date(date);
            d.setDate(d.getDate() + days);
            return d;
          };

          const addMonths = (date, months) => {
            const d = new Date(date);
            d.setMonth(d.getMonth() + months);
            return d;
          };

          const generateFutureTasks = (baseTask, rule, startIndex = 1) => {
            if (!rule || rule.endType === 'never') return [];
            let current = new Date(baseTask.due_date || new Date().toISOString());
            let tasks = [];
            
            const maxOccurrences = rule.endType === 'occurrences' ? rule.occurrences : 10;
            const endDate = rule.endType === 'date' ? new Date(rule.endDate) : new Date(2100, 0, 1);
            
            let count = startIndex;
            while (count < maxOccurrences) {
              if (rule.frequency === 'daily') current = addDays(current, rule.interval || 1);
              else if (rule.frequency === 'weekly') current = addDays(current, (rule.interval || 1) * 7);
              else if (rule.frequency === 'monthly') current = addMonths(current, rule.interval || 1);
              else if (rule.frequency === 'yearly') current = addMonths(current, (rule.interval || 1) * 12);
              else break;

              if (rule.skipWeekends) {
                const day = current.getDay();
                if (day === 6) current = addDays(current, 2); // Saturday -> Monday
                if (day === 0) current = addDays(current, 1); // Sunday -> Monday
              }

              if (current > endDate) break;

              const newTask = {
                ...baseTask,
                id: `mock-task-${Date.now()}-${count}`,
                due_date: current.toISOString(),
                status: 'todo', // Reset status for future occurrences
                series_id: baseTask.series_id || baseTask.id,
                series_index: count,
                recurrence_rule: rule,
                is_recurring: true
              };
              tasks.push(newTask);
              count++;
            }
            return tasks;
          };

          // ACTIVITIES
          if (url.includes('/activities')) {
            const urlParts = url.split('?');
            const matchLead = urlParts[0].match(/\/leads\/([a-zA-Z0-9-]+)\/activities(?:\/([a-zA-Z0-9-]+))?$/);
            const matchProj = urlParts[0].match(/\/projects\/([a-zA-Z0-9-]+)\/activities(?:\/([a-zA-Z0-9-]+))?$/);
            
            const entityId = matchLead ? matchLead[1] : (matchProj ? matchProj[1] : null);
            const entityType = matchLead ? 'lead_id' : 'project_id';
            const activityId = matchLead ? matchLead[2] : (matchProj ? matchProj[2] : null);

            if (method === 'get') {
              responseData.data = mockDatabase.activities?.filter(a => a[entityType] === entityId) || [];
            } else if (method === 'post') {
              const payload = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
              const newActivity = {
                id: `mock-act-${Date.now()}`,
                [entityType]: entityId,
                type: payload.type || 'note',
                title: payload.title || null,
                notes: payload.notes || '',
                outcome: payload.outcome || null,
                created_at: new Date().toISOString(),
                user_name: 'Amit S.'
              };
              if (!mockDatabase.activities) mockDatabase.activities = [];
              mockDatabase.activities.push(newActivity);
              persistDb();
              responseData.data = newActivity;
            } else if (method === 'patch' || method === 'put') {
              if (activityId) {
                const updates = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
                if (!mockDatabase.activities) mockDatabase.activities = [];
                const idx = mockDatabase.activities.findIndex(a => a.id === activityId);
                if (idx !== -1) {
                  mockDatabase.activities[idx] = { ...mockDatabase.activities[idx], ...updates };
                  persistDb();
                  responseData.data = mockDatabase.activities[idx];
                }
              }
            }
          }
          // CONTACTS
          else if (url.includes('/contacts')) {
            const urlParts = url.split('?');
            const match = urlParts[0].match(/\/leads\/([a-zA-Z0-9-]+)\/contacts(?:\/([a-zA-Z0-9-]+))?$/);
            const leadId = match ? match[1] : null;
            const contactId = match ? match[2] : null;

            if (method === 'get') {
              responseData.data = mockDatabase.contacts?.filter(c => c.lead_id === leadId) || [];
            } else if (method === 'post') {
              const payload = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
              const newContact = {
                id: `mock-contact-${Date.now()}`,
                lead_id: leadId,
                name: payload.name,
                phone: payload.phone || null,
                email: payload.email || null,
                role: payload.role || null,
                decision_authority: payload.decision_authority || 'Influencer',
                relationship_notes: payload.relationship_notes || null
              };
              if (!mockDatabase.contacts) mockDatabase.contacts = [];
              mockDatabase.contacts.push(newContact);
              persistDb();
              responseData.data = newContact;
            } else if (method === 'patch' || method === 'put') {
              if (contactId) {
                const updates = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
                if (!mockDatabase.contacts) mockDatabase.contacts = [];
                const idx = mockDatabase.contacts.findIndex(c => c.id === contactId);
                if (idx !== -1) {
                  mockDatabase.contacts[idx] = { ...mockDatabase.contacts[idx], ...updates };
                  persistDb();
                  responseData.data = mockDatabase.contacts[idx];
                }
              }
            } else if (method === 'delete') {
              if (contactId) {
                if (!mockDatabase.contacts) mockDatabase.contacts = [];
                mockDatabase.contacts = mockDatabase.contacts.filter(c => c.id !== contactId);
                persistDb();
                responseData.data = { success: true };
              }
            }
          }
          // FOLLOWUPS
          else if (url.includes('/followups')) {
            const urlParts = url.split('?');
            const match = urlParts[0].match(/\/leads\/([a-zA-Z0-9-]+)\/followups(?:\/([a-zA-Z0-9-]+))?$/);
            const leadId = match ? match[1] : null;
            const followupId = match ? match[2] : null;

            if (method === 'get') {
              responseData.data = mockDatabase.followups?.filter(f => f.lead_id === leadId) || [];
            } else if (method === 'post') {
              const payload = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
              const newFollowup = {
                id: `mock-followup-${Date.now()}`,
                lead_id: leadId,
                title: payload.title,
                due_at: payload.due_at,
                notes: payload.notes || null,
                is_done: false,
                done_at: null
              };
              if (!mockDatabase.followups) mockDatabase.followups = [];
              mockDatabase.followups.push(newFollowup);
              persistDb();
              responseData.data = newFollowup;
            } else if (method === 'patch' || method === 'put') {
              if (followupId) {
                const updates = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
                if (!mockDatabase.followups) mockDatabase.followups = [];
                const idx = mockDatabase.followups.findIndex(f => f.id === followupId);
                if (idx !== -1) {
                  let doneUpdates = {};
                  if (updates.is_done !== undefined) {
                    doneUpdates.done_at = updates.is_done ? new Date().toISOString() : null;
                  }
                  mockDatabase.followups[idx] = { ...mockDatabase.followups[idx], ...updates, ...doneUpdates };
                  persistDb();
                  responseData.data = mockDatabase.followups[idx];
                }
              }
            } else if (method === 'delete') {
              if (followupId) {
                if (!mockDatabase.followups) mockDatabase.followups = [];
                mockDatabase.followups = mockDatabase.followups.filter(f => f.id !== followupId);
                persistDb();
                responseData.data = { success: true };
              }
            }
          }
          // TAGS
          if (url.includes('/tags')) {
            if (!mockDatabase.tags) mockDatabase.tags = [];
            const urlParts = url.split('?');
            const match = urlParts[0].match(/\/tags\/([a-zA-Z0-9-]+)$/);
            const tagId = match ? match[1] : null;

            if (method === 'get') {
              responseData.data = mockDatabase.tags;
            } else if (method === 'post') {
              const payload = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
              const newTag = {
                id: `tag-${Date.now()}`,
                name: payload.name,
                color: payload.color || '#9ca3af'
              };
              mockDatabase.tags.push(newTag);
              persistDb();
              responseData.data = newTag;
            } else if (method === 'patch' || method === 'put') {
              if (tagId) {
                const updates = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
                const idx = mockDatabase.tags.findIndex(t => t.id === tagId);
                if (idx !== -1) {
                  mockDatabase.tags[idx] = { ...mockDatabase.tags[idx], ...updates };
                  persistDb();
                  responseData.data = mockDatabase.tags[idx];
                } else {
                  return [404, { error: { message: 'Tag not found' } }];
                }
              }
            } else if (method === 'delete') {
              if (tagId) {
                mockDatabase.tags = mockDatabase.tags.filter(t => t.id !== tagId);
                // Also remove this tag from all tasks
                if (mockDatabase.tasks) {
                  mockDatabase.tasks = mockDatabase.tasks.map(t => {
                    if (t.tags && t.tags.includes(tagId)) {
                      return { ...t, tags: t.tags.filter(tg => tg !== tagId) };
                    }
                    return t;
                  });
                }
                persistDb();
                responseData.data = { success: true };
              }
            }
          }
          // TASK VIEWS
          if (url.includes('/task-views')) {
            if (!mockDatabase.taskViews) mockDatabase.taskViews = [];
            const urlParts = url.split('?');
            const match = urlParts[0].match(/\/task-views\/([a-zA-Z0-9-]+)$/);
            const viewId = match ? match[1] : null;

            if (method === 'get') {
              responseData.data = mockDatabase.taskViews;
            } else if (method === 'post') {
              const payload = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
              const newView = {
                id: `view-${Date.now()}`,
                name: payload.name || 'Untitled View',
                is_shared: payload.is_shared || false,
                is_default: payload.is_default || false,
                payload: payload.payload || {}
              };
              
              if (newView.is_default) {
                mockDatabase.taskViews.forEach(v => v.is_default = false);
              }
              
              mockDatabase.taskViews.push(newView);
              persistDb();
              responseData.data = newView;
            } else if (method === 'patch' || method === 'put') {
              if (viewId) {
                const updates = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
                const idx = mockDatabase.taskViews.findIndex(v => v.id === viewId);
                if (idx !== -1) {
                  if (updates.is_default) {
                    mockDatabase.taskViews.forEach(v => v.is_default = false);
                  }
                  mockDatabase.taskViews[idx] = { ...mockDatabase.taskViews[idx], ...updates };
                  persistDb();
                  responseData.data = mockDatabase.taskViews[idx];
                } else {
                  return [404, { error: { message: 'View not found' } }];
                }
              }
            } else if (method === 'delete') {
              if (viewId) {
                mockDatabase.taskViews = mockDatabase.taskViews.filter(v => v.id !== viewId);
                persistDb();
                responseData.data = { success: true };
              }
            }
          }
          // TASK TEMPLATES
          if (url.includes('/task-templates')) {
            if (!mockDatabase.taskTemplates) mockDatabase.taskTemplates = [];
            const urlParts = url.split('?');
            const match = urlParts[0].match(/\/task-templates\/([a-zA-Z0-9-]+)$/);
            const templateId = match ? match[1] : null;

            if (method === 'get') {
              responseData.data = mockDatabase.taskTemplates;
            } else if (method === 'post') {
              const payload = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
              const newTmpl = {
                id: `tmpl-${Date.now()}`,
                name: payload.name || 'Untitled Template',
                category: payload.category || 'General',
                is_favorite: payload.is_favorite || false,
                is_shared: payload.is_shared || false,
                title: payload.title || '',
                description: payload.description || '',
                priority: payload.priority || 'medium',
                checklist: payload.checklist || [],
                subtasks: payload.subtasks || []
              };
              mockDatabase.taskTemplates.push(newTmpl);
              persistDb();
              responseData.data = newTmpl;
            } else if (method === 'patch' || method === 'put') {
              if (templateId) {
                const updates = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
                const idx = mockDatabase.taskTemplates.findIndex(t => t.id === templateId);
                if (idx !== -1) {
                  mockDatabase.taskTemplates[idx] = { ...mockDatabase.taskTemplates[idx], ...updates };
                  persistDb();
                  responseData.data = mockDatabase.taskTemplates[idx];
                } else {
                  return [404, { error: { message: 'Template not found' } }];
                }
              }
            } else if (method === 'delete') {
              if (templateId) {
                mockDatabase.taskTemplates = mockDatabase.taskTemplates.filter(t => t.id !== templateId);
                persistDb();
                responseData.data = { success: true };
              }
            }
          }
          // FILES
          else if (url.includes('/files')) {
            const urlParts = url.split('?');
            const match = urlParts[0].match(/\/leads\/([a-zA-Z0-9-]+)\/files(?:\/([a-zA-Z0-9-]+))?(?:\/parse)?$/);
            const leadId = match ? match[1] : null;
            const fileId = match ? match[2] : null;
            const isParse = url.includes('/parse');

            if (method === 'get') {
              responseData.data = mockDatabase.files?.filter(f => f.lead_id === leadId) || [];
            } else if (method === 'post') {
              if (isParse) {
                responseData.data = {
                  carpet_area: 1800,
                  room_count: 3,
                  property_type: '3bhk',
                  extracted_scope: 'Parsed scope: Living room wardrobes and modern kitchen cabinets.'
                };
              } else {
                let fileName = 'uploaded_document.pdf';
                let fileSize = 102400;
                let mimeType = 'application/pdf';

                if (config.data instanceof FormData) {
                  const fileObj = config.data.get('file');
                  if (fileObj) {
                    fileName = fileObj.name;
                    fileSize = fileObj.size;
                    mimeType = fileObj.type;
                  }
                } else if (config.data) {
                  const payload = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
                  if (payload.file_name) fileName = payload.file_name;
                  if (payload.file_size) fileSize = payload.file_size;
                }

                const newFile = {
                  id: `mock-file-${Date.now()}`,
                  lead_id: leadId,
                  file_name: fileName,
                  file_size: fileSize,
                  mime_type: mimeType,
                  download_url: '#',
                  storage_key: '#'
                };

                if (!mockDatabase.files) mockDatabase.files = [];
                mockDatabase.files.push(newFile);
                persistDb();
                responseData.data = newFile;
              }
            } else if (method === 'delete') {
              if (fileId) {
                if (!mockDatabase.files) mockDatabase.files = [];
                mockDatabase.files = mockDatabase.files.filter(f => f.id !== fileId);
                persistDb();
                responseData.data = { success: true };
              }
            }
          }
          // INSPIRATIONS
          else if (url.includes('/inspirations')) {
            const urlParts = url.split('?');
            const match = urlParts[0].match(/\/leads\/([a-zA-Z0-9-]+)\/inspirations(?:\/([a-zA-Z0-9-]+))?$/);
            const leadId = match ? match[1] : null;
            const inspirationId = match ? match[2] : null;

            if (method === 'get') {
              responseData.data = mockDatabase.inspirations?.filter(i => i.lead_id === leadId) || [];
            } else if (method === 'post') {
              const payload = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
              const newInsp = {
                id: `mock-insp-${Date.now()}`,
                lead_id: leadId,
                image_url: payload.image_url,
                room_type: payload.room_type || null,
                notes: payload.notes || null
              };
              if (!mockDatabase.inspirations) mockDatabase.inspirations = [];
              mockDatabase.inspirations.push(newInsp);
              persistDb();
              responseData.data = newInsp;
            } else if (method === 'delete') {
              if (inspirationId) {
                if (!mockDatabase.inspirations) mockDatabase.inspirations = [];
                mockDatabase.inspirations = mockDatabase.inspirations.filter(i => i.id !== inspirationId);
                persistDb();
                responseData.data = { success: true };
              }
            }
          }
          // GLOBAL SEARCH
          else if (url.includes('/search')) {
            const urlParts = url.split('?');
            let q = '';
            if (urlParts[1]) {
              const searchParams = new URLSearchParams(urlParts[1]);
              q = (searchParams.get('q') || '').toLowerCase().trim();
            }
            if (method === 'get') {
              if (!q || q.length < 2) {
                responseData.data = { leads: [], projects: [], tasks: [] };
              } else {
                const leads = (mockDatabase.leads || []).filter(l => 
                  (l.name && l.name.toLowerCase().includes(q)) || 
                  (l.email && l.email.toLowerCase().includes(q)) || 
                  (l.phone && l.phone.toLowerCase().includes(q))
                );
                const projects = (mockDatabase.projects || []).filter(p => 
                  (p.name && p.name.toLowerCase().includes(q)) || 
                  (p.client_name && p.client_name.toLowerCase().includes(q))
                );
                responseData.data = { leads, projects, tasks: [] };
              }
            }
          }
          // LEADS
          else if (url.includes('/leads')) {
            if (url.includes('/timeline')) {
              responseData.data = [];
            } else if (url.includes('/estimates')) {
              responseData.data = [];
            } else if (url.includes('/buying-intent')) {
              responseData.data = { intent: 'Warm', confidence: 80, reason: 'Mocked intent.' };
            } else if (url.includes('/buying-intent')) {
              responseData.data = { intent: 'Warm', confidence: 80, reason: 'Mocked intent.' };
            } else if (url.includes('/sentiment')) {
              responseData.data = { emoji: '🙂', mood: 'Positive', tip: 'Mocked sentiment.' };
            } else if (url.includes('/ai-design-proposal')) {
              responseData.data = {
                recommended_style: 'Modern Minimalist',
                design_concept: 'A clean, uncluttered aesthetic focusing on functionality and open space.',
                color_palette: [
                  { hex: '#FAFAFA', name: 'Alabaster White' },
                  { hex: '#2C3E50', name: 'Midnight Navy' },
                  { hex: '#D4AF37', name: 'Muted Gold' }
                ],
                material_suggestions: ['Matte Black Fixtures', 'White Oak Flooring', 'Quartz Countertops']
              };
            } else if (url.includes('/ai-insights')) {
              responseData.data = {
                sentiment: 'Positive',
                signals: ['Expressed interest in premium materials'],
                objections: [],
                nextAction: 'Schedule a site visit',
                buyIntent: 'high',
                winProbability: 80,
                aiScoreBreakdown: { "Base Score": "+50", "High Budget": "+20", "Engaged": "+10" },
                suggestedFollowupDate: new Date(Date.now() + 86400000).toISOString()
              };
            } else if (url.includes('/negotiation')) {
              const match = url.match(/\/leads\/([a-zA-Z0-9-]+)\/negotiation$/);
              const leadId = match ? match[1] : null;
              if (method === 'patch' || method === 'put') {
                if (leadId) {
                  const payload = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
                  const idx = mockDatabase.leads.findIndex(l => l.id === leadId);
                  if (idx !== -1) {
                    const currentLead = mockDatabase.leads[idx];
                    const cf = currentLead.custom_fields || {};
                    cf.negotiation = {
                      target_price: payload.target_price,
                      quoted_price: payload.quoted_price,
                      notes: payload.notes,
                      status: null
                    };
                    mockDatabase.leads[idx] = {
                      ...currentLead,
                      custom_fields: cf,
                      updated_at: new Date().toISOString()
                    };
                    persistDb();
                    responseData.data = mockDatabase.leads[idx];
                  }
                }
              }
            } else if (url.includes('/import')) {
              if (method === 'post') {
                const payload = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
                const leadsCount = (payload.csv?.split('\n').length || 2) - 1; // dummy count
                responseData.data = { created: leadsCount, skipped: 0 };
              }
            } else if (url.match(/\/leads\/[a-zA-Z0-9-]+\/convert-to-project$/)) {
              if (method === 'post') {
                const payload = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
                
                // Dynamic checklist validation in mock
                const checklistConfig = (mockDatabase.tenantSettings || {}).pre_conversion_checklist || [
                  { key: 'contract_signed', label: 'Contract signed', required: true, active: true },
                  { key: 'booking_received', label: 'Booking amount received', required: true, active: true },
                  { key: 'scope_finalized', label: 'Scope frozen', required: true, active: true },
                  { key: 'site_visit_completed', label: 'Site visit completed', required: true, active: true },
                  { key: 'floor_plan', label: 'Floor plan attached', required: false, active: true },
                  { key: 'site_address_confirmed', label: 'Site address confirmed', required: false, active: true }
                ];
                
                const missingFields = [];
                for (const item of checklistConfig) {
                  if (item.active && item.required && !payload[item.key]) {
                    missingFields.push(item.key);
                  }
                }
                if (!payload.projectName || !payload.projectName.trim()) missingFields.push('projectName');
                if (!payload.projectType) missingFields.push('projectType');
                if (!payload.contract_file_key) missingFields.push('contract_file_key');
                
                if (missingFields.length > 0) {
                  return Promise.reject({
                    response: {
                      status: 400,
                      statusText: 'Bad Request',
                      data: {
                        success: false,
                        error: {
                          code: 'VALIDATION_ERROR',
                          message: `Missing required fields: ${missingFields.join(', ')}`,
                          missingFields
                        }
                      }
                    }
                  });
                }

                const advanceAmount = Number(payload.advanceAmount) || 0;
                const paymentTerms = payload.paymentTerms || null;
                const status = (advanceAmount > 0 || paymentTerms) ? 'pending_payment' : 'active';

                const newProj = {
                  id: `mock-proj-${Date.now()}`,
                  name: payload.projectName || 'Converted Project',
                  client_name: payload.clientName || 'Client',
                  status,
                  booking_amount: advanceAmount,
                  payment_terms: paymentTerms,
                  progress: 0,
                  created_at: new Date().toISOString(),
                  value: payload.contractValue || 0,
                  target_date: payload.handoverDate || null,
                  pm_id: payload.pm || null,
                  agreement_signed_by: payload.agreement_signed_by || null,
                  agreement_signed_at: payload.agreement_signed_at || null,
                  agreement_signature_method: payload.agreement_signature_method || null
                };

                const contractVal = Number(payload.contractValue || 0);
                const templates = {
                  '10_40_40_10': [
                    { name: 'Booking Advance', pct: 10 },
                    { name: 'Design Sign-off', pct: 40 },
                    { name: 'Production Commencement', pct: 40 },
                    { name: 'Handover', pct: 10 }
                  ],
                  '30_30_30_10': [
                    { name: 'Booking Advance', pct: 30 },
                    { name: 'Material Procurement', pct: 30 },
                    { name: 'Mid-Execution', pct: 30 },
                    { name: 'Handover', pct: 10 }
                  ],
                  '50_50': [
                    { name: 'Booking Advance', pct: 50 },
                    { name: 'Final Handover', pct: 50 }
                  ]
                };

                let milestoneDefinitions = templates[paymentTerms];
                if (!milestoneDefinitions && paymentTerms) {
                  const parts = paymentTerms.split('_').map(Number);
                  const total = parts.reduce((a, b) => a + b, 0);
                  if (total === 100) {
                    milestoneDefinitions = parts.map((pct, idx) => ({
                      name: idx === 0 ? 'Booking Advance' : (idx === parts.length - 1 ? 'Handover' : `Installment ${idx + 1}`),
                      pct
                    }));
                  }
                }

                if (milestoneDefinitions && contractVal > 0) {
                  if (!mockDatabase.paymentMilestones) mockDatabase.paymentMilestones = [];
                  milestoneDefinitions.forEach((def, index) => {
                    const amount = (contractVal * (def.pct / 100)).toFixed(2);
                    mockDatabase.paymentMilestones.push({
                      id: `mock-pmil-${Date.now()}-${index}`,
                      project_id: newProj.id,
                      name: def.name,
                      amount: Number(amount),
                      percentage: def.pct,
                      status: 'scheduled',
                      due_date: index === 0 ? new Date().toISOString() : new Date(Date.now() + (index * 30 * 24 * 60 * 60 * 1000)).toISOString()
                    });
                  });
                  newProj.booking_amount = Number((contractVal * (milestoneDefinitions[0].pct / 100)).toFixed(2));
                } else if (newProj.booking_amount && newProj.booking_amount > 0) {
                  if (!mockDatabase.paymentMilestones) mockDatabase.paymentMilestones = [];
                  mockDatabase.paymentMilestones.push({
                    id: `mock-pmil-${Date.now()}`,
                    project_id: newProj.id,
                    name: 'Booking Advance',
                    amount: newProj.booking_amount,
                    percentage: contractVal > 0 ? Number(((newProj.booking_amount / contractVal) * 100).toFixed(2)) : 100,
                    status: 'scheduled',
                    due_date: new Date().toISOString()
                  });
                }

                mockDatabase.projects.push(newProj);
                
                // Also mark lead as converted if possible
                const match = url.match(/\/leads\/([a-zA-Z0-9-]+)\/convert-to-project$/);
                if (match) {
                  const leadId = match[1];
                  const leadToUpdate = mockDatabase.leads.find(l => l.id === leadId);
                  if (leadToUpdate) leadToUpdate.status = 'converted';
                }
                
                persistDb();
                responseData.data = { project_id: newProj.id };
              }
            } else {
              const match = url.match(/\/leads\/([a-zA-Z0-9-]+)$/);
              const leadId = match ? match[1] : null;

              if (method === 'post') {
                const newLead = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
                newLead.id = `mock-${Date.now()}`;
                newLead.created_at = new Date().toISOString();
                newLead.status = newLead.status || 'new';
                newLead.probability = newLead.probability || 10;
                
                // Add random coordinates near Bangalore for the map view
                if (!newLead.latitude || !newLead.longitude) {
                  newLead.latitude = 12.92 + (Math.random() * 0.1 - 0.05);
                  newLead.longitude = 77.54 + (Math.random() * 0.1 - 0.05);
                }
                
                mockDatabase.leads.push(newLead);
                persistDb();
                responseData.data = newLead;
              } else if (method === 'get') {
                if (leadId) {
                  responseData.data = mockDatabase.leads.find(l => l.id === leadId) || null;
                } else {
                  const getParam = (name) => {
                    if (config.params && config.params[name] !== undefined) {
                      return config.params[name];
                    }
                    const urlParts = url.split('?');
                    if (urlParts[1]) {
                      const searchParams = new URLSearchParams(urlParts[1]);
                      return searchParams.get(name);
                    }
                    return undefined;
                  };

                  let filtered = [...mockDatabase.leads];

                  // 1. Search filter
                  const searchVal = getParam('search');
                  if (searchVal) {
                    const s = searchVal.toLowerCase().trim();
                    filtered = filtered.filter(l => {
                      const name = String(l.name || '').toLowerCase();
                      const email = String(l.email || '').toLowerCase();
                      const phone = String(l.phone || '').toLowerCase();
                      return name.includes(s) || email.includes(s) || phone.includes(s);
                    });
                  }

                  // 2. Stage filter
                  const stageId = getParam('stageId') || getParam('stage_id');
                  if (stageId) {
                    filtered = filtered.filter(l => l.stage_id === stageId);
                  }

                  // 3. Assignee filter
                  const assigneeId = getParam('assigneeId') || getParam('assignee_id');
                  if (assigneeId) {
                    filtered = filtered.filter(l => l.assignee_id === assigneeId);
                  }

                  // 4. Source filter
                  const source = getParam('source');
                  if (source && source !== 'All Sources') {
                    filtered = filtered.filter(l => l.source && l.source.toLowerCase() === source.toLowerCase());
                  }

                  // 5. Score range filter
                  const scoreRangeVal = getParam('scoreRange');
                  if (scoreRangeVal && scoreRangeVal !== 'all') {
                    const parts = scoreRangeVal.split('-');
                    if (parts.length === 2) {
                      const min = parseInt(parts[0], 10);
                      const max = parseInt(parts[1], 10);
                      filtered = filtered.filter(l => {
                        const score = l.score !== undefined ? l.score : 0;
                        return score >= min && score <= max;
                      });
                    }
                  }

                  // 6. Intent filter
                  const intent = getParam('intent');
                  if (intent && intent !== 'all') {
                    filtered = filtered.filter(l => l.buying_intent === intent);
                  }

                  // 7. Created date filters
                  const createdFromVal = getParam('createdFrom');
                  if (createdFromVal) {
                    filtered = filtered.filter(l => l.created_at >= createdFromVal);
                  }
                  const createdToVal = getParam('createdTo');
                  if (createdToVal) {
                    filtered = filtered.filter(l => l.created_at <= createdToVal);
                  }

                  // 8. Sorting
                  const sortByVal = getParam('sortBy') || 'created_at';
                  const sortDescVal = getParam('sortDesc');
                  const isDesc = sortDescVal === undefined || sortDescVal === 'true' || sortDescVal === true;

                  filtered.sort((a, b) => {
                    let fieldA = a[sortByVal];
                    let fieldB = b[sortByVal];

                    if (sortByVal === 'created_at') {
                      fieldA = new Date(a.created_at || 0).getTime();
                      fieldB = new Date(b.created_at || 0).getTime();
                    } else if (sortByVal === 'score') {
                      fieldA = a.score || 0;
                      fieldB = b.score || 0;
                    } else {
                      fieldA = String(fieldA || '').toLowerCase();
                      fieldB = String(fieldB || '').toLowerCase();
                    }

                    if (fieldA < fieldB) return isDesc ? 1 : -1;
                    if (fieldA > fieldB) return isDesc ? -1 : 1;
                    return 0;
                  });

                  // 9. Pagination
                  const pageVal = parseInt(getParam('page') || '1', 10);
                  const limitVal = parseInt(getParam('limit') || '20', 10);
                  const totalCount = filtered.length;
                  const offsetVal = (pageVal - 1) * limitVal;
                  
                  const paginatedData = filtered.slice(offsetVal, offsetVal + limitVal);

                  responseData.data = paginatedData;
                  responseData.meta = {
                    total: totalCount,
                    page: pageVal,
                    limit: limitVal
                  };
                  responseData.success = true;
                }
              } else if (method === 'patch' || method === 'put') {
                if (leadId) {
                  const updates = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
                  const idx = mockDatabase.leads.findIndex(l => l.id === leadId);
                  if (idx !== -1) {
                    mockDatabase.leads[idx] = { ...mockDatabase.leads[idx], ...updates };
                    persistDb();
                    responseData.data = mockDatabase.leads[idx];
                  }
                }
              } else if (method === 'delete') {
                if (leadId) {
                  mockDatabase.leads = mockDatabase.leads.filter(l => l.id !== leadId);
                  persistDb();
                  responseData.data = { success: true };
                }
              }
            }
          }
          // PROJECTS PHASES AND SIGN-OFF
          else if (url.includes('/phases') && url.includes('/projects')) {
            const parts = url.split('?')[0].split('/');
            const projectId = parts[parts.indexOf('projects') + 1];
            
            if (url.includes('/sign-off')) {
              const phaseId = parts[parts.indexOf('phases') + 1];
              if (method === 'post') {
                if (!mockDatabase.phases) mockDatabase.phases = [];
                const phase = mockDatabase.phases.find(p => p.id === phaseId);
                if (phase) {
                  const nextSortOrder = phase.sort_order + 1;
                  const nextPhase = mockDatabase.phases.find(p => p.project_id === projectId && p.sort_order === nextSortOrder);
                  
                  if (nextPhase && nextPhase.is_execution) {
                    const project = mockDatabase.projects.find(p => p.id === projectId);
                    const contractDoc = mockDatabase.documents?.find(d => d.project_id === projectId && d.doc_type === 'contract' && d.status === 'approved');
                    
                    if (!project?.is_scope_locked || !contractDoc) {
                      return Promise.reject({
                        response: {
                          status: 400,
                          statusText: 'Bad Request',
                          data: {
                            success: false,
                            error: {
                              code: 'SCOPE_LOCK_REQUIRED',
                              message: 'Cannot start execution phase: Design scope must be locked and contract document approved.'
                            }
                          }
                        }
                      });
                    }
                  }
                  
                  phase.status = 'completed';
                  if (nextPhase) {
                    nextPhase.status = 'in_progress';
                  }
                  persistDb();
                  responseData.data = phase;
                }
              }
            } else {
              const phaseId = parts[parts.indexOf('phases') + 1];
              if (method === 'get') {
                responseData.data = mockDatabase.phases?.filter(p => p.project_id === projectId) || [];
              } else if (method === 'put') {
                const updates = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
                const idx = mockDatabase.phases?.findIndex(p => p.id === phaseId);
                if (idx !== -1) {
                  const phase = mockDatabase.phases[idx];
                  if (updates.status && (updates.status === 'in_progress' || updates.status === 'active')) {
                    if (phase.is_execution) {
                      const project = mockDatabase.projects.find(p => p.id === projectId);
                      const contractDoc = mockDatabase.documents?.find(d => d.project_id === projectId && d.doc_type === 'contract' && d.status === 'approved');
                      
                      if (!project?.is_scope_locked || !contractDoc) {
                        return Promise.reject({
                          response: {
                            status: 400,
                            statusText: 'Bad Request',
                            data: {
                              success: false,
                              error: {
                                code: 'SCOPE_LOCK_REQUIRED',
                                message: 'Cannot start execution phase: Design scope must be locked and contract document approved.'
                              }
                            }
                          }
                        });
                      }
                    }
                  }
                  mockDatabase.phases[idx] = { ...phase, ...updates };
                  persistDb();
                  responseData.data = mockDatabase.phases[idx];
                }
              }
            }
          }
          // MILESTONES
          else if (url.includes('/milestones')) {
            const parts = url.split('?')[0].split('/');
            const phaseId = parts[parts.indexOf('phases') + 1];
            if (method === 'get') {
              responseData.data = mockDatabase.milestones?.filter(m => m.phase_id === phaseId) || [];
            } else if (method === 'post' && url.includes('/complete')) {
              const milestoneId = parts[parts.indexOf('milestones') + 1];
              const idx = mockDatabase.milestones?.findIndex(m => m.id === milestoneId);
              if (idx !== -1) {
                mockDatabase.milestones[idx].status = 'completed';
                persistDb();
                responseData.data = mockDatabase.milestones[idx];
              }
            }
          }
          // DOCUMENTS
          else if (url.includes('/documents') && url.includes('/projects')) {
            const parts = url.split('?')[0].split('/');
            const projectId = parts[parts.indexOf('projects') + 1];
            if (method === 'get') {
              responseData.data = mockDatabase.documents?.filter(d => d.project_id === projectId) || [];
            } else if (method === 'post') {
              if (url.includes('/register')) {
                const payload = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
                const newDoc = {
                  id: `mock-doc-${Date.now()}`,
                  project_id: projectId,
                  doc_type: payload.doc_type || 'contract',
                  status: 'pending',
                  name: payload.name || 'Uploaded Document',
                  storage_key: payload.storage_key || 'mock-key.pdf'
                };
                if (!mockDatabase.documents) mockDatabase.documents = [];
                mockDatabase.documents.push(newDoc);
                persistDb();
                responseData.data = newDoc;
              } else if (url.includes('/approve')) {
                const docId = parts[parts.indexOf('documents') + 1];
                const idx = mockDatabase.documents?.findIndex(d => d.id === docId);
                if (idx !== -1) {
                  mockDatabase.documents[idx].status = 'approved';
                  persistDb();
                  responseData.data = mockDatabase.documents[idx];
                }
              }
            }
          }
          // PROJECTS CONTRACT UPLOAD
          else if (url.includes('/projects/contract/upload-url')) {
            if (method === 'post') {
              responseData.data = {
                uploadUrl: 'https://mock-s3.local/temp-contract-upload-url',
                storageKey: `mock-contract-${Date.now()}.pdf`
              };
            }
          }
          // PAYMENT MILESTONES
          else if (url.includes('/payment-milestones')) {
            if (url.includes('/projects')) {
              const parts = url.split('?')[0].split('/');
              const projectId = parts[parts.indexOf('projects') + 1];
              responseData.data = mockDatabase.paymentMilestones?.filter(m => m.project_id === projectId) || [];
            } else {
              const parts = url.split('?')[0].split('/');
              const milestoneId = parts[parts.length - 1];
              if (method === 'patch' || method === 'put') {
                const updates = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
                if (!mockDatabase.paymentMilestones) mockDatabase.paymentMilestones = [];
                const idx = mockDatabase.paymentMilestones.findIndex(m => m.id === milestoneId);
                if (idx !== -1) {
                  mockDatabase.paymentMilestones[idx] = { ...mockDatabase.paymentMilestones[idx], ...updates };
                  
                  if (updates.status === 'paid' && mockDatabase.paymentMilestones[idx].name === 'Booking Advance') {
                    const projectId = mockDatabase.paymentMilestones[idx].project_id;
                    const pIdx = mockDatabase.projects.findIndex(p => p.id === projectId);
                    if (pIdx !== -1) {
                      mockDatabase.projects[pIdx].status = 'active';
                    }
                  }
                  
                  persistDb();
                  responseData.data = mockDatabase.paymentMilestones[idx];
                }
              }
            }
          }
          // PROJECTS
          else if (url.includes('/projects')) {
            const match = url.match(/\/projects\/([a-zA-Z0-9-]+)$/);
            const projId = match ? match[1] : null;

            if (method === 'post') {
              const newProj = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
              if (!newProj.contract_file_key) {
                return Promise.reject({
                  response: {
                    status: 400,
                    statusText: 'Bad Request',
                    data: {
                      success: false,
                      error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Contract document attachment is required during project creation.'
                      }
                    }
                  }
                });
              }
              const bookingAmt = Number(newProj.booking_amount || newProj.bookingAmount || 0);
              const paymentTerms = newProj.payment_terms || newProj.paymentTerms || null;
              const status = (bookingAmt > 0 || paymentTerms) ? 'pending_payment' : (newProj.status || 'active');

              newProj.id = `mock-proj-${Date.now()}`;
              newProj.created_at = new Date().toISOString();
              newProj.status = status;
              newProj.booking_amount = bookingAmt;
              newProj.payment_terms = paymentTerms;
              newProj.progress = newProj.progress || 0;

              const contractVal = Number(newProj.contract_value || newProj.contractValue || 0);
              const templates = {
                '10_40_40_10': [
                  { name: 'Booking Advance', pct: 10 },
                  { name: 'Design Sign-off', pct: 40 },
                  { name: 'Production Commencement', pct: 40 },
                  { name: 'Handover', pct: 10 }
                ],
                '30_30_30_10': [
                  { name: 'Booking Advance', pct: 30 },
                  { name: 'Material Procurement', pct: 30 },
                  { name: 'Mid-Execution', pct: 30 },
                  { name: 'Handover', pct: 10 }
                ],
                '50_50': [
                  { name: 'Booking Advance', pct: 50 },
                  { name: 'Final Handover', pct: 50 }
                ]
              };

              let milestoneDefinitions = templates[paymentTerms];
              if (!milestoneDefinitions && paymentTerms) {
                const parts = paymentTerms.split('_').map(Number);
                const total = parts.reduce((a, b) => a + b, 0);
                if (total === 100) {
                  milestoneDefinitions = parts.map((pct, idx) => ({
                    name: idx === 0 ? 'Booking Advance' : (idx === parts.length - 1 ? 'Handover' : `Installment ${idx + 1}`),
                    pct
                  }));
                }
              }

              if (milestoneDefinitions && contractVal > 0) {
                if (!mockDatabase.paymentMilestones) mockDatabase.paymentMilestones = [];
                milestoneDefinitions.forEach((def, index) => {
                  const amount = (contractVal * (def.pct / 100)).toFixed(2);
                  mockDatabase.paymentMilestones.push({
                    id: `mock-pmil-${Date.now()}-${index}`,
                    project_id: newProj.id,
                    name: def.name,
                    amount: Number(amount),
                    percentage: def.pct,
                    status: 'scheduled',
                    due_date: index === 0 ? new Date().toISOString() : new Date(Date.now() + (index * 30 * 24 * 60 * 60 * 1000)).toISOString()
                  });
                });
                newProj.booking_amount = Number((contractVal * (milestoneDefinitions[0].pct / 100)).toFixed(2));
              } else if (newProj.booking_amount && newProj.booking_amount > 0) {
                if (!mockDatabase.paymentMilestones) mockDatabase.paymentMilestones = [];
                mockDatabase.paymentMilestones.push({
                  id: `mock-pmil-${Date.now()}`,
                  project_id: newProj.id,
                  name: 'Booking Advance',
                  amount: newProj.booking_amount,
                  percentage: contractVal > 0 ? Number(((newProj.booking_amount / contractVal) * 100).toFixed(2)) : 100,
                  status: 'scheduled',
                  due_date: new Date().toISOString()
                });
              }

              mockDatabase.projects.push(newProj);
              persistDb();
              responseData.data = newProj;
            } else if (method === 'get') {
              if (projId) {
                responseData.data = mockDatabase.projects.find(p => p.id === projId) || null;
              } else {
                responseData.data = [...mockDatabase.projects];
              }
            } else if (method === 'patch' || method === 'put') {
              if (projId) {
                const updates = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
                const idx = mockDatabase.projects.findIndex(p => p.id === projId);
                if (idx !== -1) {
                  const currentProj = mockDatabase.projects[idx];
                  const newStatus = updates.status || currentProj.status;

                  if (newStatus === 'active' && currentProj.status !== 'active' && Number(currentProj.booking_amount) > 0) {
                    const advanceMilestone = mockDatabase.paymentMilestones?.find(
                      m => m.project_id === projId && m.name === 'Booking Advance'
                    );
                    if (advanceMilestone && advanceMilestone.status !== 'paid') {
                      return Promise.reject({
                        response: {
                          status: 400,
                          statusText: 'Bad Request',
                          data: {
                            success: false,
                            error: {
                              code: 'BOOKING_PAYMENT_REQUIRED',
                              message: 'Cannot activate project: Booking advance payment has not been received.'
                            }
                          }
                        }
                      });
                    }
                  }

                  const updatedKeys = Object.keys(updates).filter(k => currentProj[k] !== updates[k] && k !== 'updated_at');
                  if (updatedKeys.length > 0) {
                    if (!mockDatabase.activities) mockDatabase.activities = [];
                    mockDatabase.activities.push({
                      id: `mock-act-${Date.now()}`,
                      project_id: projId,
                      type: 'system',
                      title: 'Project Updated',
                      notes: `Updated fields: ${updatedKeys.join(', ')}`,
                      created_at: new Date().toISOString(),
                      user_name: 'System'
                    });
                  }

                  mockDatabase.projects[idx] = { ...currentProj, ...updates };
                  persistDb();
                  responseData.data = mockDatabase.projects[idx];
                }
              }
            } else if (method === 'delete') {
              if (projId) {
                mockDatabase.projects = mockDatabase.projects.filter(p => p.id !== projId);
                persistDb();
                responseData.data = { success: true };
              }
            }
          }
          // DASHBOARD
          else if (url.includes('/dashboard')) {
            if (url.includes('/stats')) {
              responseData.data = mockDatabase.dashboardStats;
            } else if (url.includes('/activity')) {
              responseData.data = mockDatabase.dashboardActivity;
            } else if (url.includes('/pipeline')) {
              responseData.data = mockDatabase.dashboardPipeline;
            } else if (url.includes('/my-tasks')) {
              responseData.data = mockDatabase.tasks.slice(0, 5);
            }
          }
          // USERS
          else if (url.includes('/users')) {
            if (url.includes('/approval-history')) {
              responseData.data = [];
            } else if (url.includes('/approve') || url.includes('/reject') || url.includes('/request-changes')) {
              responseData.data = { success: true };
            } else if (method === 'get') {
              const getParam = (name) => {
                if (config.params && config.params[name] !== undefined) {
                  return config.params[name];
                }
                const urlParts = url.split('?');
                if (urlParts[1]) {
                  const searchParams = new URLSearchParams(urlParts[1]);
                  return searchParams.get(name);
                }
                return undefined;
              };
              let filtered = [...(mockDatabase.users || [])];
              
              const searchVal = getParam('search');
              if (searchVal) {
                const s = searchVal.toLowerCase().trim();
                filtered = filtered.filter(u => {
                  const name = String(u.name || '').toLowerCase();
                  const email = String(u.email || '').toLowerCase();
                  return name.includes(s) || email.includes(s);
                });
              }
              
              const roleVal = getParam('role');
              if (roleVal) {
                filtered = filtered.filter(u => u.role_name === roleVal || u.role_id === roleVal);
              }
              
              const statusVal = getParam('status');
              if (statusVal) {
                filtered = filtered.filter(u => u.status === statusVal);
              }

              responseData.data = filtered;
            } else if (url.includes('/add-member') && method === 'post') {
              const payload = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
              const newUser = {
                id: `mock-user-${Date.now()}`,
                name: payload.name || 'Mock User',
                email: payload.email,
                role_id: payload.roleId,
                status: 'pending_approval',
                created_at: new Date().toISOString()
              };
              if (!mockDatabase.users) mockDatabase.users = [];
              mockDatabase.users.unshift(newUser);
              persistDb();
              responseData.data = newUser;
            } else if (method === 'patch') {
              const parts = url.split('/');
              const id = parts[parts.length - 1];
              const updates = typeof config.data === 'string' ? JSON.parse(config.data || '{}') : (config.data || {});
              
              if (mockDatabase.users) {
                const idx = mockDatabase.users.findIndex(u => u.id === id);
                if (idx !== -1) {
                  mockDatabase.users[idx] = { ...mockDatabase.users[idx], ...updates };
                  
                  // Clear offboarding record if user is reactivated
                  if (updates.status === 'active' && mockDatabase.offboarding) {
                    mockDatabase.offboarding = mockDatabase.offboarding.filter(o => o.user_id !== id);
                  }
                  
                  persistDb();
                  responseData.data = mockDatabase.users[idx];
                }
              }
            }
          }
          // OFFBOARDING
          else if (url.includes('/offboarding')) {
            if (!mockDatabase.offboarding) mockDatabase.offboarding = [];
            
            if (method === 'get') {
              if (mockDatabase.users && mockDatabase.offboarding) {
                mockDatabase.offboarding = mockDatabase.offboarding.filter(o => {
                  const u = mockDatabase.users.find(user => user.id === o.user_id);
                  // Keep record if user doesn't exist (rare) or if their status isn't active
                  return !u || (u.status !== 'active' && u.status !== 'probation' && u.status !== 'onboarding');
                });
                persistDb();
              }
              responseData.data = [...(mockDatabase.offboarding || [])];
            } else if (url.includes('/initiate') && method === 'post') {
              const payload = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
              const targetUser = mockDatabase.users?.find(u => u.id === payload.user_id) || {};
              const newRecord = {
                id: `mock-off-${Date.now()}`,
                user_id: payload.user_id,
                first_name: targetUser.name ? targetUser.name.split(' ')[0] : 'Mock',
                last_name: targetUser.name ? targetUser.name.split(' ').slice(1).join(' ') : 'User',
                email: targetUser.email || 'mock@example.com',
                status: 'pending_manager',
                resignation_date: payload.resignation_date || new Date().toISOString(),
                last_working_day: payload.last_working_day || new Date().toISOString(),
                created_at: new Date().toISOString()
              };
              mockDatabase.offboarding.unshift(newRecord);
              persistDb();
              responseData.data = newRecord;
            } else if (url.includes('/finalize') && method === 'post') {
              const parts = url.split('/');
              const id = parts.includes('offboarding') ? parts[parts.indexOf('offboarding') + 1] : parts[parts.length - 1];
              const idx = mockDatabase.offboarding.findIndex(o => o.id === id);
              if (idx !== -1) {
                mockDatabase.offboarding[idx] = { ...mockDatabase.offboarding[idx], status: 'archived' };
                
                // Also archive the associated user account
                const userId = mockDatabase.offboarding[idx].user_id;
                const userIdx = mockDatabase.users?.findIndex(u => u.id === userId);
                if (userIdx !== -1 && mockDatabase.users) {
                  mockDatabase.users[userIdx].status = 'archived';
                }
                
                persistDb();
                responseData.data = mockDatabase.offboarding[idx];
              }
            } else if (method === 'put' || method === 'patch') {
              const parts = url.split('/');
              // URL format: /offboarding/:id or /offboarding/:id/manager-approve
              const id = parts.includes('offboarding') ? parts[parts.indexOf('offboarding') + 1] : parts[parts.length - 1];
              
              const updates = typeof config.data === 'string' ? JSON.parse(config.data || '{}') : (config.data || {});
              
              if (url.includes('manager-approve')) {
                updates.status = 'pending_hr';
                updates.manager_approved_at = new Date().toISOString();
              }
              if (url.includes('hr-approve')) {
                updates.status = 'active_transfer';
                updates.hr_approved_at = new Date().toISOString();
              }
              if (url.includes('finalize')) updates.status = 'archived';
              
              const idx = mockDatabase.offboarding.findIndex(o => o.id === id);
              if (idx !== -1) {
                const updatedRecord = { ...mockDatabase.offboarding[idx], ...updates };
                
                if (url.includes('/step')) {
                  const isTransfersDone = updatedRecord.knowledge_transfer_done && updatedRecord.project_transfer_done && updatedRecord.task_transfer_done;
                  if (isTransfersDone && !updatedRecord.assets_returned) {
                    updatedRecord.status = 'pending_asset_return';
                  } else if (isTransfersDone && updatedRecord.assets_returned) {
                    updatedRecord.status = 'completed';
                  } else if (!isTransfersDone && mockDatabase.offboarding[idx].status !== 'pending_manager' && mockDatabase.offboarding[idx].status !== 'pending_hr') {
                    updatedRecord.status = 'active_transfer';
                  }
                }
                
                mockDatabase.offboarding[idx] = updatedRecord;
                persistDb();
                responseData.data = updatedRecord;
              }
            }
          }
          // CUSTOM FIELDS
          else if (url.includes('/config/custom-fields')) {
            if (!mockDatabase.customFields) {
              mockDatabase.customFields = [
                { id: 'cf-1', entity: 'lead', label: 'Budget Range', name: 'budget_range', field_type: 'dropdown', is_required: true, options: ['< 5L', '5L - 10L', '> 10L'], sort_order: 0, is_active: true },
                { id: 'cf-2', entity: 'lead', label: 'Property Type', name: 'property_type', field_type: 'dropdown', is_required: true, options: ['Apartment', 'Villa', 'Commercial'], sort_order: 1, is_active: true },
                { id: 'cf-3', entity: 'project', label: 'Project Scope', name: 'project_scope', field_type: 'text', is_required: false, options: [], sort_order: 0, is_active: true },
                { id: 'cf-4', entity: 'task', label: 'Task Priority', name: 'task_priority', field_type: 'dropdown', is_required: false, options: ['Low', 'Medium', 'High'], sort_order: 0, is_active: true },
              ];
            }
            if (method === 'get') {
              const urlParts = url.split('?');
              if (urlParts[1]) {
                const searchParams = new URLSearchParams(urlParts[1]);
                const entity = searchParams.get('entity');
                if (entity) {
                  responseData.data = mockDatabase.customFields.filter(c => c.entity === entity);
                } else {
                  responseData.data = mockDatabase.customFields;
                }
              } else {
                responseData.data = mockDatabase.customFields;
              }
            } else if (method === 'post') {
              const payload = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
              const newField = {
                id: `cf-${Date.now()}`,
                entity: payload.entity,
                label: payload.label,
                name: payload.name,
                field_type: payload.field_type,
                is_required: payload.is_required || false,
                options: payload.options || [],
                sort_order: payload.sort_order || 0,
                is_active: true
              };
              mockDatabase.customFields.push(newField);
              persistDb();
              responseData.data = newField;
            } else if (method === 'put' || method === 'patch') {
              const match = url.match(/\/config\/custom-fields\/([a-zA-Z0-9-]+)$/);
              if (match) {
                const id = match[1];
                const updates = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
                const idx = mockDatabase.customFields.findIndex(c => c.id === id);
                if (idx !== -1) {
                  mockDatabase.customFields[idx] = { ...mockDatabase.customFields[idx], ...updates };
                  persistDb();
                  responseData.data = mockDatabase.customFields[idx];
                }
              }
            } else if (method === 'delete') {
              const match = url.match(/\/config\/custom-fields\/([a-zA-Z0-9-]+)$/);
              if (match) {
                const id = match[1];
                mockDatabase.customFields = mockDatabase.customFields.filter(c => c.id !== id);
                persistDb();
                responseData.data = { success: true };
              }
            }
          }
          // LEAD STAGES
          else if (url.includes('/config/lead-stages')) {
            if (method === 'get') {
              responseData.data = [
                { id: 'stage-1', name: 'Lead Capture', color: '#6B6B6B', sort_order: 1 },
                { id: 'stage-2', name: 'AI Qualification', color: '#1A3A5C', sort_order: 2 },
                { id: 'stage-3', name: 'Lead Assignment', color: '#2D5A8E', sort_order: 3 },
                { id: 'stage-4', name: 'First Contact', color: '#C4956A', sort_order: 4 },
                { id: 'stage-5', name: 'Discovery Call', color: '#8B5E0A', sort_order: 5 },
                { id: 'stage-6', name: 'AI Budgeting', color: '#E8A317', sort_order: 6 },
                { id: 'stage-7', name: 'Site Visit Scheduling', color: '#1589FF', sort_order: 7 },
                { id: 'stage-8', name: 'Site Visit Conducted', color: '#0000A0', sort_order: 8 },
                { id: 'stage-9', name: 'Inspiration & Prefs', color: '#B048B5', sort_order: 9 },
                { id: 'stage-10', name: 'AI Design Generation', color: '#800080', sort_order: 10 },
                { id: 'stage-11', name: 'Design Presentation', color: '#FF00FF', sort_order: 11 },
                { id: 'stage-12', name: 'Quotation', color: '#43BFC7', sort_order: 12 },
                { id: 'stage-13', name: 'Negotiation', color: '#FF7F50', sort_order: 13 },
                { id: 'stage-14', name: 'Closing', color: '#2D6A4F', sort_order: 14 }
              ];
            }
          }

          // SITE READINESS CHECKLIST
          else if (url.includes('/site-readiness')) {
            const urlParts = url.split('?');
            const match = urlParts[0].match(/\/projects\/([a-zA-Z0-9-]+)\/site-readiness(?:\/([a-zA-Z0-9-]+))?$/);
            const projectId = match ? match[1] : null;
            const itemId = match ? match[2] : null;

            if (!mockDatabase.siteReadiness) mockDatabase.siteReadiness = [];

            const seedIfEmpty = () => {
              const projectItems = mockDatabase.siteReadiness.filter(item => item.project_id === projectId);
              if (projectItems.length === 0) {
                const defaults = [
                  { key: 'civil_handover', label: 'Civil Handover Completed' },
                  { key: 'electrical_rough_in', label: 'Electrical Rough-In Ready' },
                  { key: 'waterproofing', label: 'Wet Area Waterproofing Done' },
                  { key: 'debris_cleared', label: 'Debris Cleared & Site Cleaned' }
                ];
                defaults.forEach(d => {
                  mockDatabase.siteReadiness.push({
                    id: `mock-sr-${Date.now()}-${Math.random()}`,
                    project_id: projectId,
                    item_key: d.key,
                    label: d.label,
                    is_completed: false,
                    completed_at: null,
                    completed_by: null,
                    notes: ''
                  });
                });
                persistDb();
              }
            };

            if (method === 'get') {
              seedIfEmpty();
              responseData.data = mockDatabase.siteReadiness.filter(item => item.project_id === projectId);
            } else if (method === 'post') {
              if (url.includes('/sign-off')) {
                seedIfEmpty();
                mockDatabase.siteReadiness.forEach(item => {
                  if (item.project_id === projectId) {
                    item.is_completed = true;
                    item.completed_at = new Date().toISOString();
                    item.completed_by_name = 'PM (Mock)';
                  }
                });
                persistDb();
                responseData.data = mockDatabase.siteReadiness.filter(item => item.project_id === projectId);
              }
            } else if (method === 'patch' || method === 'put') {
              const payload = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
              const idx = mockDatabase.siteReadiness.findIndex(item => item.id === itemId);
              if (idx !== -1) {
                const item = mockDatabase.siteReadiness[idx];
                if (payload.is_completed === true) {
                  item.is_completed = true;
                  item.completed_at = new Date().toISOString();
                  item.completed_by_name = 'Supervisor (Mock)';
                } else if (payload.is_completed === false) {
                  item.is_completed = false;
                  item.completed_at = null;
                  item.completed_by_name = null;
                }
                if (payload.notes !== undefined) item.notes = payload.notes;
                if (payload.photo_key !== undefined) item.photo_key = payload.photo_key;

                persistDb();
                responseData.data = item;
              }
            }
          }

          // CONFIG TRADE ACTIVITY TEMPLATES
          else if (url.includes('/config/trade-activity-templates')) {
            const urlParts = url.split('?');
            const match = urlParts[0].match(/\/config\/trade-activity-templates(?:\/([a-zA-Z0-9-]+))?$/);
            const templateId = match ? match[1] : null;

            if (!mockDatabase.tradeActivityTemplates) {
              mockDatabase.tradeActivityTemplates = [
                { id: 't1', trade: 'civil', room_type: 'General', activity_name: 'Demolition and hacking', description: 'Demolition of existing structures, walls, or tiles.', sort_order: 10 },
                { id: 't2', trade: 'civil', room_type: 'General', activity_name: 'Debris removal & site cleaning', description: 'Clearing out debris and preparing the floor/walls.', sort_order: 20 },
                { id: 't3', trade: 'electrical', room_type: 'General', activity_name: 'Wall chasing and conduit pipe laying', description: 'Cutting grooves in walls and fitting PVC conduit pipes.', sort_order: 10 },
                { id: 't4', trade: 'plumbing', room_type: 'Bathroom', activity_name: 'Waterproofing base coat application', description: 'Applying waterproofing compounds on floors and wet walls.', sort_order: 10 }
              ];
            }

            if (method === 'get') {
              responseData.data = mockDatabase.tradeActivityTemplates;
            } else if (method === 'post') {
              const payload = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
              const newTpl = {
                id: `mock-tpl-${Date.now()}`,
                trade: payload.trade,
                room_type: payload.room_type || 'General',
                activity_name: payload.activity_name,
                description: payload.description || '',
                sort_order: Number(payload.sort_order || 0),
                tenant_id: 'mock-tenant-id'
              };
              mockDatabase.tradeActivityTemplates.push(newTpl);
              persistDb();
              responseData.data = newTpl;
            } else if (method === 'patch' || method === 'put') {
              const payload = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
              const idx = mockDatabase.tradeActivityTemplates.findIndex(t => t.id === templateId);
              if (idx !== -1) {
                mockDatabase.tradeActivityTemplates[idx] = {
                  ...mockDatabase.tradeActivityTemplates[idx],
                  ...payload
                };
                persistDb();
                responseData.data = mockDatabase.tradeActivityTemplates[idx];
              }
            } else if (method === 'delete') {
              const idx = mockDatabase.tradeActivityTemplates.findIndex(t => t.id === templateId);
              if (idx !== -1) {
                mockDatabase.tradeActivityTemplates.splice(idx, 1);
                persistDb();
              }
              responseData.data = { success: true };
            }
          }

          // WORK ACTIVITIES DEPENDENCIES
          else if (url.includes('/work-activities/dependencies')) {
            const match = url.match(/\/projects\/([a-zA-Z0-9-]+)\/work-activities\/dependencies(?:\/([a-zA-Z0-9-]+))?$/);
            const projectId = match ? match[1] : null;
            const dependencyId = match ? match[2] : null;

            if (!mockDatabase.workActivityDependencies) mockDatabase.workActivityDependencies = [];

            if (method === 'get') {
              const deps = mockDatabase.workActivityDependencies.filter(d => d.project_id === projectId);
              const joined = deps.map(d => {
                const act1 = mockDatabase.workActivities?.find(a => a.id === d.activity_id) || {};
                const act2 = mockDatabase.workActivities?.find(a => a.id === d.depends_on_activity_id) || {};
                return {
                  ...d,
                  activity_name: act1.activity_name || 'Activity',
                  activity_trade: act1.trade || 'civil',
                  activity_room: act1.room_name || 'General',
                  depends_on_activity_name: act2.activity_name || 'Prerequisite',
                  depends_on_activity_trade: act2.trade || 'civil',
                  depends_on_activity_room: act2.room_name || 'General',
                  depends_on_activity_status: act2.status || 'todo'
                };
              });
              responseData.data = joined;
            } else if (method === 'post') {
              const payload = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
              const newDep = {
                id: `mock-dep-${Date.now()}`,
                project_id: projectId,
                activity_id: payload.activityId,
                depends_on_activity_id: payload.dependsOnActivityId,
                dependency_type: payload.dependencyType || 'finish-to-start',
                created_at: new Date().toISOString()
              };
              mockDatabase.workActivityDependencies.push(newDep);
              persistDb();
              responseData.data = newDep;
            } else if (method === 'delete') {
              const idx = mockDatabase.workActivityDependencies.findIndex(d => d.id === dependencyId);
              if (idx !== -1) {
                mockDatabase.workActivityDependencies.splice(idx, 1);
                persistDb();
              }
              responseData.data = { success: true };
            } else if (method === 'put' && url.includes('/bulk')) {
              const payload = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
              mockDatabase.workActivityDependencies = mockDatabase.workActivityDependencies.filter(d => d.project_id !== projectId);
              if (Array.isArray(payload.dependencies)) {
                for (const dep of payload.dependencies) {
                  mockDatabase.workActivityDependencies.push({
                    id: `mock-dep-${Date.now()}-${Math.random()}`,
                    project_id: projectId,
                    activity_id: dep.activityId,
                    depends_on_activity_id: dep.dependsOnActivityId,
                    dependency_type: dep.dependencyType || 'finish-to-start',
                    created_at: new Date().toISOString()
                  });
                }
              }
              persistDb();
              responseData.data = { success: true };
            }
          }

          // WORK ACTIVITIES PHOTOS
          else if (url.includes('/work-activities') && url.includes('/photos')) {
            const match = url.match(/\/projects\/([a-zA-Z0-9-]+)\/work-activities\/([a-zA-Z0-9-]+)\/photos(?:\/([a-zA-Z0-9-]+))?$/);
            const projectId = match ? match[1] : null;
            const activityId = match ? match[2] : null;
            const photoId = match ? match[3] : null;

            if (method === 'post') {
              const newPhoto = {
                id: `mock-photo-${Date.now()}`,
                activity_id: activityId,
                file_url: 'https://images.unsplash.com/photo-1581094288338-2314dddb7eed?w=400',
                caption: 'Mock Uploaded Evidence',
                created_at: new Date().toISOString()
              };
              const act = mockDatabase.workActivities?.find(a => a.id === activityId);
              if (act) {
                if (!act.photos) act.photos = [];
                act.photos.push({ ...newPhoto, url: newPhoto.file_url });
              }
              persistDb();
              responseData.data = { ...newPhoto, url: newPhoto.file_url };
            } else if (method === 'delete') {
              const act = mockDatabase.workActivities?.find(a => a.id === activityId);
              if (act && act.photos) {
                act.photos = act.photos.filter(p => p.id !== photoId);
              }
              persistDb();
              responseData.data = { success: true };
            }
          }

          // WORK ACTIVITIES MAIN
          else if (url.includes('/work-activities')) {
            const urlParts = url.split('?');
            const match = urlParts[0].match(/\/projects\/([a-zA-Z0-9-]+)\/work-activities(?:\/([a-zA-Z0-9-]+))?$/);
            const projectId = match ? match[1] : null;
            const activityId = match ? match[2] : null;

            if (!mockDatabase.workActivities) mockDatabase.workActivities = [];

            if (method === 'get') {
              if (url.includes('/templates')) {
                if (!mockDatabase.tradeActivityTemplates) {
                  mockDatabase.tradeActivityTemplates = [
                    { id: 't1', trade: 'civil', room_type: 'General', activity_name: 'Demolition and hacking', description: 'Demolition of existing structures, walls, or tiles.', sort_order: 10 },
                    { id: 't2', trade: 'civil', room_type: 'General', activity_name: 'Debris removal & site cleaning', description: 'Clearing out debris and preparing the floor/walls.', sort_order: 20 },
                    { id: 't3', trade: 'electrical', room_type: 'General', activity_name: 'Wall chasing and conduit pipe laying', description: 'Cutting grooves in walls and fitting PVC conduit pipes.', sort_order: 10 },
                    { id: 't4', trade: 'plumbing', room_type: 'Bathroom', activity_name: 'Waterproofing base coat application', description: 'Applying waterproofing compounds on floors and wet walls.', sort_order: 10 }
                  ];
                }
                responseData.data = mockDatabase.tradeActivityTemplates;
              } else {
                let filtered = mockDatabase.workActivities.filter(a => a.project_id === projectId);
                const params = urlParts[1] ? new URLSearchParams(urlParts[1]) : null;
                if (params) {
                  const tradeParam = params.get('trade');
                  const roomParam = params.get('roomName');
                  const statusParam = params.get('status');
                  const phaseParam = params.get('phaseId');

                  if (tradeParam) filtered = filtered.filter(a => a.trade === tradeParam);
                  if (roomParam) filtered = filtered.filter(a => a.room_name === roomParam);
                  if (statusParam) filtered = filtered.filter(a => a.status === statusParam);
                  if (phaseParam) filtered = filtered.filter(a => a.phase_id === phaseParam);
                }

                // Enrich with photos and dependencies
                filtered = filtered.map(a => {
                  const deps = mockDatabase.workActivityDependencies?.filter(d => d.activity_id === a.id) || [];
                  const joinedDeps = deps.map(d => {
                    const target = mockDatabase.workActivities.find(act => act.id === d.depends_on_activity_id) || {};
                    return {
                      ...d,
                      depends_on_activity_name: target.activity_name || 'Prerequisite',
                      depends_on_activity_status: target.status || 'todo',
                      depends_on_activity_room: target.room_name || 'General',
                      depends_on_activity_trade: target.trade || 'civil'
                    };
                  });
                  return {
                    ...a,
                    dependencies: joinedDeps,
                    photos: a.photos || []
                  };
                });

                responseData.data = filtered;
              }
            } else if (method === 'post') {
              const payload = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
              
              const MOCK_QC_CHECKLISTS = {
                carpentry: [
                  { id: `c1_${Date.now()}`, label: 'Verify dimensions match approved design drawing', required: true, is_checked: false },
                  { id: `c2_${Date.now()}`, label: 'Check veneer/laminate grains alignment and color matching', required: true, is_checked: false },
                  { id: `c3_${Date.now()}`, label: 'Check drawer runners and soft-close hinges function smoothly', required: true, is_checked: false },
                  { id: `c4_${Date.now()}`, label: 'Ensure edge banding is smooth and free of sharp edges', required: true, is_checked: false },
                  { id: `c5_${Date.now()}`, label: 'Verify handle alignment and installation height', required: true, is_checked: false }
                ],
                painting: [
                  { id: `p1_${Date.now()}`, label: 'Check wall surface is sanded smooth and clean of dust', required: true, is_checked: false },
                  { id: `p2_${Date.now()}`, label: 'Verify application of wall primer coat', required: true, is_checked: false },
                  { id: `p3_${Date.now()}`, label: 'Ensure putty levels are checked under light to find imperfections', required: true, is_checked: false },
                  { id: `p4_${Date.now()}`, label: 'Check final paint coat color uniformity and edge alignments', required: true, is_checked: false },
                  { id: `p5_${Date.now()}`, label: 'Ensure no paint stains on flooring, switch plates, or windows', required: true, is_checked: false }
                ],
                electrical: [
                  { id: `e1_${Date.now()}`, label: 'Verify conduit pipe layout matches layout drawing', required: true, is_checked: false },
                  { id: `e2_${Date.now()}`, label: 'Check continuity and insulation resistance test of cables', required: true, is_checked: false },
                  { id: `e3_${Date.now()}`, label: 'Ensure correct rating of MCBs and correct labeling in DB', required: true, is_checked: false },
                  { id: `e4_${Date.now()}`, label: 'Verify all modular switch plates are level and securely fixed', required: true, is_checked: false },
                  { id: `e5_${Date.now()}`, label: 'Test all light points, sockets, and appliance outlets', required: true, is_checked: false }
                ],
                plumbing: [
                  { id: `pl1_${Date.now()}`, label: 'Pressure test water supply pipes for 24 hours at 10 bar', required: true, is_checked: false },
                  { id: `pl2_${Date.now()}`, label: 'Check drainage slope/alignment to ensure no water stagnation', required: true, is_checked: false },
                  { id: `pl3_${Date.now()}`, label: 'Conduct waterproofing pond test in bathroom for 48 hours', required: true, is_checked: false },
                  { id: `pl4_${Date.now()}`, label: 'Verify fitment of WCs and washbasin without wobble', required: true, is_checked: false },
                  { id: `pl5_${Date.now()}`, label: 'Check all CP fittings (faucets, showers) for leakage and flow rate', required: true, is_checked: false }
                ],
                flooring: [
                  { id: `f1_${Date.now()}`, label: 'Verify subfloor cleaning and level markings before laying tiles/marble', required: true, is_checked: false },
                  { id: `f2_${Date.now()}`, label: 'Check tile spacers are used and joint lines are perfectly aligned', required: true, is_checked: false },
                  { id: `f3_${Date.now()}`, label: 'Verify hollow-sound check by tapping laid tiles/stones', required: true, is_checked: false },
                  { id: `f4_${Date.now()}`, label: 'Check slope towards drain point in dry/wet areas', required: true, is_checked: false },
                  { id: `f5_${Date.now()}`, label: 'Ensure grout filling is complete and uniform', required: true, is_checked: false }
                ]
              };

              if (url.includes('/generate')) {
                const { phaseId, roomName, trade } = payload;
                if (!mockDatabase.tradeActivityTemplates) {
                  mockDatabase.tradeActivityTemplates = [
                    { id: 't1', trade: 'civil', room_type: 'General', activity_name: 'Demolition and hacking', description: 'Demolition of existing structures, walls, or tiles.', sort_order: 10 },
                    { id: 't2', trade: 'civil', room_type: 'General', activity_name: 'Debris removal & site cleaning', description: 'Clear out debris and prepare the floor/walls.', sort_order: 20 },
                    { id: 't3', trade: 'electrical', room_type: 'General', activity_name: 'Wall chasing and conduit pipe laying', description: 'Cut grooves in walls and fit PVC conduit pipes.', sort_order: 10 },
                    { id: 't4', trade: 'plumbing', room_type: 'Bathroom', activity_name: 'Waterproofing base coat application', description: 'Apply waterproofing compounds on floors and wet walls.', sort_order: 10 }
                  ];
                }
                const templates = mockDatabase.tradeActivityTemplates.filter(t => t.trade === trade);

                const created = [];
                for (const tpl of templates) {
                  const newAct = {
                    id: `mock-act-${Date.now()}-${Math.random()}`,
                    project_id: projectId,
                    phase_id: phaseId || null,
                    room_name: roomName,
                    trade,
                    activity_name: tpl.activity_name,
                    description: tpl.description,
                    status: 'todo',
                    qc_checklist: MOCK_QC_CHECKLISTS[trade] || [],
                    photos: [],
                    dependencies: [],
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                  };
                  mockDatabase.workActivities.push(newAct);
                  created.push(newAct);
                }
                persistDb();
                responseData.data = created;
              } else {
                const newAct = {
                  id: `mock-act-${Date.now()}`,
                  project_id: projectId,
                  phase_id: payload.phase_id || null,
                  room_name: payload.room_name,
                  trade: payload.trade,
                  activity_name: payload.activity_name,
                  description: payload.description || '',
                  status: payload.status || 'todo',
                  assignee_id: payload.assignee_id || null,
                  due_date: payload.due_date || null,
                  notes: payload.notes || '',
                  qc_checklist: payload.qc_checklist || MOCK_QC_CHECKLISTS[payload.trade] || [],
                  photos: [],
                  dependencies: [],
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                };
                mockDatabase.workActivities.push(newAct);
                persistDb();
                responseData.data = newAct;
              }
            } else if (method === 'patch' || method === 'put') {
              const payload = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
              const idx = mockDatabase.workActivities.findIndex(a => a.id === activityId);
              if (idx !== -1) {
                const current = mockDatabase.workActivities[idx];
                const targetStatus = payload.status || current.status;
                const targetChecklist = payload.qc_checklist !== undefined ? payload.qc_checklist : (current.qc_checklist || []);

                if (targetStatus === 'completed' || targetStatus === 'in_progress') {
                  const deps = mockDatabase.workActivityDependencies?.filter(d => d.activity_id === activityId) || [];
                  for (const dep of deps) {
                    const prerequisite = mockDatabase.workActivities.find(act => act.id === dep.depends_on_activity_id);
                    if (prerequisite && prerequisite.status !== 'completed') {
                      return Promise.reject({
                        response: {
                          status: 400,
                          data: {
                            success: false,
                            error: {
                              code: 'DEPENDENCY_UNSATISFIED',
                              message: `Cannot start/complete work activity: Prerequisite activity '${prerequisite.activity_name}' must be completed first.`
                            }
                          }
                        }
                      });
                    }
                  }
                }

                if (targetStatus === 'completed') {
                  const incomplete = targetChecklist.filter(item => item.required && !item.is_checked);
                  if (incomplete.length > 0) {
                    return Promise.reject({
                      response: {
                        status: 400,
                        data: {
                          success: false,
                          error: {
                            code: 'QC_CHECKLIST_INCOMPLETE',
                            message: `Cannot complete work activity: There are ${incomplete.length} unchecked required QC checklist items.`
                          }
                        }
                      }
                    });
                  }
                }

                mockDatabase.workActivities[idx] = { 
                  ...current, 
                  ...payload, 
                  updated_at: new Date().toISOString() 
                };
                persistDb();
                responseData.data = mockDatabase.workActivities[idx];
              }
            } else if (method === 'delete') {
              const idx = mockDatabase.workActivities.findIndex(a => a.id === activityId);
              if (idx !== -1) {
                mockDatabase.workActivities.splice(idx, 1);
                persistDb();
              }
              responseData.data = { success: true };
            }
          }

          // TASKS (global or specific)
          else if (url.includes('/tasks')) {
            const urlParts = url.split('?');
            const match = urlParts[0].match(/\/tasks\/([a-zA-Z0-9-]+)$/);
            const taskId = match ? match[1] : null;

            if (method === 'get') {
              if (taskId) {
                responseData.data = mockDatabase.tasks.find(t => t.id === taskId) || null;
              } else {
                let leadIdParam = config.params?.lead_id;
                if (!leadIdParam && urlParts.length > 1) {
                  leadIdParam = new URLSearchParams(urlParts[1]).get('lead_id');
                }
                if (leadIdParam) {
                  responseData.data = mockDatabase.tasks.filter(t => t.lead_id === leadIdParam);
                } else {
                  responseData.data = [...mockDatabase.tasks];
                }
              }
            } else if (method === 'post') {
              const payload = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
              const assignee = mockDatabase.users?.find(u => u.id === payload.assigned_to);
              const newTask = {
                id: `mock-task-${Date.now()}`,
                lead_id: payload.lead_id || null,
                project_id: payload.project_id || null,
                title: payload.title,
                start_date: payload.start_date || payload.due_date || null,
                due_date: payload.due_date || null,
                assigned_to: payload.assigned_to || null,
                assignee_name: assignee ? assignee.name : null,
                status: payload.status || 'todo',
                priority: payload.priority || 'medium',
                description: payload.description || '',
                checklist: payload.checklist || [],
                is_recurring: payload.is_recurring || false,
                recurrence_rule: payload.recurrence_rule || null,
                series_id: payload.is_recurring ? `series-${Date.now()}` : null,
                series_index: 0
              };
              mockDatabase.tasks.push(newTask);
              
              if (newTask.is_recurring && newTask.recurrence_rule) {
                const futureTasks = generateFutureTasks(newTask, newTask.recurrence_rule, 1);
                mockDatabase.tasks.push(...futureTasks);
              }
              logTaskActivity(newTask.id, 'created', 'Created task');
              if (payload.assigned_to) {
                logTaskActivity(newTask.id, 'assignee_changed', `Assigned task to ${newTask.assignee_name}`);
              }
              persistDb();
              responseData.data = newTask;
            } else if (method === 'patch' || method === 'put') {
              if (taskId) {
                const updates = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
                const idx = mockDatabase.tasks.findIndex(t => t.id === taskId);
                if (idx !== -1) {
                  const oldTask = mockDatabase.tasks[idx];
                  if (updates.status && updates.status !== oldTask.status) {
                    logTaskActivity(taskId, 'status_changed', `Changed status from ${oldTask.status} to ${updates.status}`);
                  }
                  if (updates.priority && updates.priority !== oldTask.priority) {
                    logTaskActivity(taskId, 'priority_changed', `Changed priority from ${oldTask.priority} to ${updates.priority}`);
                  }
                  if (updates.title && updates.title !== oldTask.title) {
                    logTaskActivity(taskId, 'edited', `Updated task title`);
                  }
                  if (updates.description && updates.description !== oldTask.description) {
                    logTaskActivity(taskId, 'edited', `Updated task description`);
                  }
                  if (updates.start_date && updates.start_date !== oldTask.start_date) {
                    logTaskActivity(taskId, 'start_date_changed', `Changed start date`);
                  }
                  if (updates.due_date && updates.due_date !== oldTask.due_date) {
                    logTaskActivity(taskId, 'due_date_changed', `Changed due date`);
                  }
                  if (updates.checklist) {
                    logTaskActivity(taskId, 'checklist_updated', `Updated checklist`);
                  }
                  
                  const updatedTask = { ...oldTask, ...updates };
                  if (updates.assigned_to !== undefined) {
                    const assignee = mockDatabase.users?.find(u => u.id === updates.assigned_to);
                    updatedTask.assignee_name = assignee ? assignee.name : null;
                    updatedTask.assigned_to = updates.assigned_to;
                    if (updates.assigned_to !== oldTask.assigned_to) {
                      logTaskActivity(taskId, 'assignee_changed', `Changed assignee to ${updatedTask.assignee_name || 'Unassigned'}`);
                    }
                  }
                  mockDatabase.tasks[idx] = updatedTask;

                  if (updates.is_recurring && updates.recurrence_rule && updates.updateMode === 'future' && updatedTask.series_id) {
                    // Delete existing future tasks in series
                    mockDatabase.tasks = mockDatabase.tasks.filter(t => !(t.series_id === updatedTask.series_id && t.series_index > updatedTask.series_index));
                    // Generate new future tasks
                    const futureTasks = generateFutureTasks(updatedTask, updates.recurrence_rule, updatedTask.series_index + 1);
                    mockDatabase.tasks.push(...futureTasks);
                  } else if (updates.updateMode === 'all' && updatedTask.series_id) {
                    // Update all tasks in series (title, description, etc)
                    mockDatabase.tasks = mockDatabase.tasks.map(t => {
                      if (t.series_id === updatedTask.series_id) {
                        return {
                          ...t,
                          title: updates.title !== undefined ? updates.title : t.title,
                          description: updates.description !== undefined ? updates.description : t.description,
                          start_date: updates.start_date !== undefined ? updates.start_date : t.start_date,
                          due_date: updates.due_date !== undefined ? updates.due_date : t.due_date,
                          priority: updates.priority !== undefined ? updates.priority : t.priority,
                          assigned_to: updates.assigned_to !== undefined ? updates.assigned_to : t.assigned_to,
                          assignee_name: updates.assigned_to !== undefined ? updatedTask.assignee_name : t.assignee_name,
                          recurrence_rule: updates.recurrence_rule !== undefined ? updates.recurrence_rule : t.recurrence_rule,
                          tags: updates.tags !== undefined ? updates.tags : t.tags
                        };
                      }
                      return t;
                    });
                    
                    if (updates.recurrence_rule) {
                      const seriesRoot = mockDatabase.tasks.find(t => t.series_id === updatedTask.series_id && t.series_index === 0);
                      if (seriesRoot) {
                        mockDatabase.tasks = mockDatabase.tasks.filter(t => t.series_id !== updatedTask.series_id || t.id === seriesRoot.id);
                        const futureTasks = generateFutureTasks(seriesRoot, updates.recurrence_rule, 1);
                        mockDatabase.tasks.push(...futureTasks);
                      }
                    }
                  }

                  persistDb();
                  responseData.data = updatedTask;
                }
              }
            } else if (method === 'delete') {
              if (taskId) {
                mockDatabase.tasks = mockDatabase.tasks.filter(t => t.id !== taskId);
                persistDb();
                responseData.data = { success: true };
              }
            }
          }
          // TASK COMMENTS
          else if (url.includes('/comments') && (url.includes('/tasks') || url.includes('/projects'))) {
            const urlParts = url.split('?');
            const matchComment = urlParts[0].match(/\/tasks\/([a-zA-Z0-9-]+)\/comments\/([a-zA-Z0-9-]+)$/);
            const matchComments = urlParts[0].match(/\/tasks\/([a-zA-Z0-9-]+)\/comments$/);
            const matchReaction = urlParts[0].match(/\/tasks\/([a-zA-Z0-9-]+)\/comments\/([a-zA-Z0-9-]+)\/reactions$/);
            
            let taskId = null;
            let commentId = null;
            if (matchReaction) {
              taskId = matchReaction[1];
              commentId = matchReaction[2];
            } else if (matchComment) {
              taskId = matchComment[1];
              commentId = matchComment[2];
            } else if (matchComments) {
              taskId = matchComments[1];
            }

            if (!mockDatabase.taskComments) mockDatabase.taskComments = [];

            if (matchReaction && method === 'post') {
              const payload = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
              const idx = mockDatabase.taskComments.findIndex(c => c.id === commentId);
              if (idx !== -1) {
                const comment = mockDatabase.taskComments[idx];
                if (!comment.reactions) comment.reactions = [];
                const existingReactIdx = comment.reactions.findIndex(r => r.emoji === payload.reaction && r.user_name === 'Admin User');
                if (existingReactIdx !== -1) {
                  comment.reactions.splice(existingReactIdx, 1);
                } else {
                  comment.reactions.push({ emoji: payload.reaction, user_name: 'Admin User' });
                }
                persistDb();
                responseData.data = comment;
              }
            } else if (commentId && method === 'patch') {
              const payload = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
              const idx = mockDatabase.taskComments.findIndex(c => c.id === commentId);
              if (idx !== -1) {
                mockDatabase.taskComments[idx] = { ...mockDatabase.taskComments[idx], ...payload, updated_at: new Date().toISOString() };
                persistDb();
                responseData.data = mockDatabase.taskComments[idx];
              }
            } else if (commentId && method === 'delete') {
              mockDatabase.taskComments = mockDatabase.taskComments.filter(c => c.id !== commentId);
              persistDb();
              responseData.data = { success: true };
            } else if (taskId && method === 'get') {
              const params = urlParts[1] ? new URLSearchParams(urlParts[1]) : null;
              const page = params ? parseInt(params.get('page') || '1', 10) : 1;
              const limit = params ? parseInt(params.get('limit') || '20', 10) : 20;
              
              let comments = mockDatabase.taskComments.filter(c => c.task_id === taskId);
              comments.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
              
              const offset = (page - 1) * limit;
              const paginated = comments.slice(offset, offset + limit);
              
              responseData.data = {
                data: paginated,
                meta: { page, limit, total: comments.length }
              };
            } else if (taskId && method === 'post') {
              const payload = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
              const newComment = {
                id: `mock-comment-${Date.now()}`,
                task_id: taskId,
                content: payload.content,
                parent_id: payload.parent_id || null,
                attachments: payload.attachments || [],
                created_at: new Date().toISOString(),
                user_name: 'Admin User',
                is_own: true,
                reactions: [],
                read_by: []
              };
              mockDatabase.taskComments.push(newComment);
              logTaskActivity(taskId, 'comment_added', 'Added a comment');
              persistDb();
              responseData.data = newComment;
            }
          }
          // TASK ATTACHMENTS
          else if (url.includes('/attachments') && (url.includes('/tasks') || url.includes('/projects'))) {
            const urlParts = url.split('?');
            const matchAttachments = urlParts[0].match(/\/tasks\/([a-zA-Z0-9-]+)\/attachments$/);
            const matchAttachment = urlParts[0].match(/\/tasks\/([a-zA-Z0-9-]+)\/attachments\/([a-zA-Z0-9-]+)$/);

            let taskId = null;
            let attachmentId = null;

            if (matchAttachment) {
              taskId = matchAttachment[1];
              attachmentId = matchAttachment[2];
            } else if (matchAttachments) {
              taskId = matchAttachments[1];
            }

            if (!mockDatabase.taskAttachments) mockDatabase.taskAttachments = [];

            if (taskId && method === 'get') {
              const attachments = mockDatabase.taskAttachments.filter(a => a.task_id === taskId);
              responseData.data = attachments;
            } else if (taskId && method === 'post' && !attachmentId) {
              const payload = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
              const newAttachment = {
                id: `mock-att-${Date.now()}`,
                task_id: taskId,
                name: payload.name,
                type: payload.type,
                size: payload.size,
                url: payload.url,
                version: 1,
                created_at: new Date().toISOString(),
                user_name: 'Admin User',
              };
              mockDatabase.taskAttachments.push(newAttachment);
              logTaskActivity(taskId, 'attachment_added', `Added attachment: ${newAttachment.name}`);
              persistDb();
              
              // Simulate network delay for upload progress
              // await new Promise(resolve => setTimeout(resolve, 1500));
              responseData.data = newAttachment;
            } else if (attachmentId && method === 'delete') {
              mockDatabase.taskAttachments = mockDatabase.taskAttachments.filter(a => a.id !== attachmentId);
              persistDb();
              responseData.data = { success: true };
            } else if (attachmentId && method === 'patch') {
              const payload = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
              const idx = mockDatabase.taskAttachments.findIndex(a => a.id === attachmentId);
              if (idx !== -1) {
                const updated = {
                  ...mockDatabase.taskAttachments[idx],
                  name: payload.name || mockDatabase.taskAttachments[idx].name,
                  type: payload.type || mockDatabase.taskAttachments[idx].type,
                  size: payload.size || mockDatabase.taskAttachments[idx].size,
                  url: payload.url || mockDatabase.taskAttachments[idx].url,
                  version: mockDatabase.taskAttachments[idx].version + 1,
                  updated_at: new Date().toISOString()
                };
                mockDatabase.taskAttachments[idx] = updated;
                persistDb();
                
                // Simulate network delay
                // await new Promise(resolve => setTimeout(resolve, 1500));
                responseData.data = updated;
              }
            }
          }
          // TASK ACTIVITY HISTORY
          else if (url.includes('/activity') && (url.includes('/tasks') || url.includes('/projects'))) {
            const urlParts = url.split('?');
            const matchActivity = urlParts[0].match(/\/tasks\/([a-zA-Z0-9-]+)\/activity$/);
            if (matchActivity && method === 'get') {
              const taskId = matchActivity[1];
              if (!mockDatabase.taskActivity) mockDatabase.taskActivity = [];
              let activities = mockDatabase.taskActivity.filter(a => a.task_id === taskId);
              
              // Sort descending
              activities.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
              
              responseData.data = activities;
            }
          }
          // SITE VISITS
          else if (url.includes('/site-visits')) {
            const urlParts = url.split('?');
            const matchProject = urlParts[0].match(/\/site-visits\/project\/([a-zA-Z0-9-]+)$/);
            const matchLead = urlParts[0].match(/\/site-visits\/lead\/([a-zA-Z0-9-]+)$/);
            const matchSingle = urlParts[0].match(/\/site-visits\/([a-zA-Z0-9-]+)$/);
            const matchPhotos = urlParts[0].match(/\/site-visits\/([a-zA-Z0-9-]+)\/photos$/);
            const matchSinglePhoto = urlParts[0].match(/\/site-visits\/([a-zA-Z0-9-]+)\/photos\/([a-zA-Z0-9-]+)$/);

            if (!mockDatabase.siteVisits) mockDatabase.siteVisits = [];
            if (!mockDatabase.siteVisitPhotos) mockDatabase.siteVisitPhotos = [];

            if (matchProject) {
              const projectId = matchProject[1];
              if (method === 'get') {
                responseData.data = mockDatabase.siteVisits.filter(sv => sv.project_id === projectId);
              } else if (method === 'post') {
                const payload = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
                const newVisit = {
                  id: `mock-sv-${Date.now()}`,
                  project_id: projectId,
                  tenant_id: 'mock-tenant-123',
                  assignee_id: payload.assignee_id || 'mock-user-1',
                  assignee_name: payload.assignee_id === 'mock-user-2' ? 'Supervisor Ramesh' : 'PM Amit',
                  scheduled_at: payload.scheduled_at,
                  completed_at: null,
                  status: 'scheduled',
                  checklist: payload.checklist || [],
                  notes: payload.notes || '',
                  client_invited: payload.client_invited || false,
                  client_feedback: '',
                  gps_coordinates: {},
                  measurements: {},
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                };
                mockDatabase.siteVisits.push(newVisit);
                persistDb();
                responseData.data = newVisit;
              }
            } else if (matchLead) {
              const leadId = matchLead[1];
              if (method === 'get') {
                responseData.data = mockDatabase.siteVisits.filter(sv => sv.lead_id === leadId);
              } else if (method === 'post') {
                const payload = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
                const newVisit = {
                  id: `mock-sv-${Date.now()}`,
                  lead_id: leadId,
                  tenant_id: 'mock-tenant-123',
                  assignee_id: payload.assignee_id || 'mock-user-1',
                  assignee_name: 'PM Amit',
                  scheduled_at: payload.scheduled_at,
                  completed_at: null,
                  status: 'scheduled',
                  checklist: payload.checklist || [],
                  notes: payload.notes || '',
                  client_invited: payload.client_invited || false,
                  client_feedback: '',
                  gps_coordinates: {},
                  measurements: {},
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                };
                mockDatabase.siteVisits.push(newVisit);
                persistDb();
                responseData.data = newVisit;
              }
            } else if (matchPhotos) {
              const siteVisitId = matchPhotos[1];
              if (method === 'get') {
                responseData.data = mockDatabase.siteVisitPhotos.filter(p => p.site_visit_id === siteVisitId);
              } else if (method === 'post') {
                let fileName = 'site_photo.jpg';
                let caption = '';
                if (config.data instanceof FormData) {
                  const fileObj = config.data.get('file');
                  if (fileObj) fileName = fileObj.name;
                  caption = config.data.get('caption') || '';
                } else if (config.data) {
                  const payload = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
                  if (payload.file_name) fileName = payload.file_name;
                  caption = payload.caption || '';
                }
                const newPhoto = {
                  id: `mock-svp-${Date.now()}`,
                  site_visit_id: siteVisitId,
                  tenant_id: 'mock-tenant-123',
                  file_url: 'mock-s3-key',
                  url: 'https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=800&auto=format&fit=crop', // default nice placeholder
                  caption: caption,
                  uploaded_at: new Date().toISOString()
                };
                mockDatabase.siteVisitPhotos.push(newPhoto);
                persistDb();
                responseData.data = newPhoto;
              }
            } else if (matchSinglePhoto) {
              const siteVisitId = matchSinglePhoto[1];
              const photoId = matchSinglePhoto[2];
              if (method === 'delete') {
                mockDatabase.siteVisitPhotos = mockDatabase.siteVisitPhotos.filter(p => p.id !== photoId);
                persistDb();
                responseData.data = { success: true };
              }
            } else if (matchSingle) {
              const siteVisitId = matchSingle[1];
              if (method === 'patch') {
                const updates = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
                const idx = mockDatabase.siteVisits.findIndex(sv => sv.id === siteVisitId);
                if (idx !== -1) {
                  mockDatabase.siteVisits[idx] = { 
                    ...mockDatabase.siteVisits[idx], 
                    ...updates,
                    updated_at: new Date().toISOString()
                  };
                  if (updates.assignee_id) {
                    mockDatabase.siteVisits[idx].assignee_name = updates.assignee_id === 'mock-user-2' ? 'Supervisor Ramesh' : 'PM Amit';
                  }
                  persistDb();
                  responseData.data = mockDatabase.siteVisits[idx];
                }
              } else if (method === 'delete') {
                mockDatabase.siteVisits = mockDatabase.siteVisits.filter(sv => sv.id !== siteVisitId);
                persistDb();
                responseData.data = { success: true };
              }
            }
          }
          // DELAY NOTIFICATIONS
          else if (url.includes('/delay-notifications')) {
            const urlParts = url.split('?');
            const matchProject = urlParts[0].match(/\/projects\/([a-zA-Z0-9-]+)\/delay-notifications$/);
            const matchSingle = urlParts[0].match(/\/projects\/([a-zA-Z0-9-]+)\/delay-notifications\/([a-zA-Z0-9-]+)$/);
            const matchSend = urlParts[0].match(/\/projects\/([a-zA-Z0-9-]+)\/delay-notifications\/([a-zA-Z0-9-]+)\/send$/);
            const matchPortal = url.includes('/portal/project/delay-notifications');

            if (!mockDatabase.delayNotifications) mockDatabase.delayNotifications = [];

            if (matchPortal) {
              const projectId = mockDatabase.projects?.[0]?.id || 'mock-proj-1';
              responseData.data = mockDatabase.delayNotifications.filter(dn => dn.project_id === projectId && dn.status === 'sent');
            } else if (matchProject) {
              const projectId = matchProject[1];
              if (method === 'get') {
                if (!mockDatabase.phases) mockDatabase.phases = [];
                if (!mockDatabase.milestones) mockDatabase.milestones = [];

                const projectPhases = mockDatabase.phases.filter(p => p.project_id === projectId);
                const phaseIds = projectPhases.map(p => p.id);

                mockDatabase.milestones.forEach(m => {
                  if (phaseIds.includes(m.phase_id) && m.status !== 'completed' && !m.due_date) {
                    const yesterday = new Date();
                    yesterday.setDate(yesterday.getDate() - 1);
                    m.due_date = yesterday.toISOString().split('T')[0];
                  }
                });

                const overdueMilestones = mockDatabase.milestones.filter(m => phaseIds.includes(m.phase_id) && m.status !== 'completed' && new Date(m.due_date) < new Date());
                overdueMilestones.forEach(m => {
                  const check = mockDatabase.delayNotifications.find(dn => dn.project_id === projectId && dn.milestone_id === m.id && dn.original_date === m.due_date);
                  if (!check) {
                    const revisedDate = new Date();
                    revisedDate.setDate(revisedDate.getDate() + 7);
                    const revisedDateStr = revisedDate.toISOString().split('T')[0];
                    const draftText = `Dear Client, we would like to inform you that the milestone "${m.name}" originally scheduled for completion on ${m.due_date} has been delayed. The revised expected completion date is now ${revisedDateStr}. Reason for delay: [Please specify the reason]. We apologize for the delay and appreciate your patience.`;

                    mockDatabase.delayNotifications.push({
                      id: `mock-dn-${Date.now()}-${m.id}`,
                      project_id: projectId,
                      tenant_id: 'mock-tenant-123',
                      milestone_id: m.id,
                      milestone_name: m.name,
                      type: 'milestone_delay',
                      original_date: m.due_date,
                      revised_date: revisedDateStr,
                      reason: 'Awaiting details',
                      message_draft: draftText,
                      status: 'draft',
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString()
                    });
                  }
                });

                const project = mockDatabase.projects?.find(p => p.id === projectId);
                if (project && project.target_date && new Date(project.target_date) < new Date() && project.status === 'active') {
                  const check = mockDatabase.delayNotifications.find(dn => dn.project_id === projectId && dn.milestone_id === null && dn.original_date === project.target_date);
                  if (!check) {
                    const revisedDate = new Date();
                    revisedDate.setDate(revisedDate.getDate() + 7);
                    const revisedDateStr = revisedDate.toISOString().split('T')[0];
                    const draftText = `Dear Client, we would like to inform you that the final completion date for your project "${project.name}" originally scheduled for ${project.target_date} has been delayed. The revised expected completion date is now ${revisedDateStr}. Reason for delay: [Please specify the reason]. We apologize for the delay and appreciate your patience.`;

                    mockDatabase.delayNotifications.push({
                      id: `mock-dn-${Date.now()}-proj`,
                      project_id: projectId,
                      tenant_id: 'mock-tenant-123',
                      milestone_id: null,
                      milestone_name: null,
                      type: 'project_delay',
                      original_date: project.target_date,
                      revised_date: revisedDateStr,
                      reason: 'Awaiting details',
                      message_draft: draftText,
                      status: 'draft',
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString()
                    });
                  }
                }

                persistDb();
                responseData.data = mockDatabase.delayNotifications
                  .filter(dn => dn.project_id === projectId)
                  .map(dn => {
                    const m = mockDatabase.milestones.find(ms => ms.id === dn.milestone_id);
                    return { ...dn, milestone_name: m ? m.name : null };
                  });
              }
            } else if (matchSend) {
              const projectId = matchSend[1];
              const notificationId = matchSend[2];
              if (method === 'post') {
                const idx = mockDatabase.delayNotifications.findIndex(dn => dn.id === notificationId);
                if (idx !== -1) {
                  mockDatabase.delayNotifications[idx].status = 'sent';
                  mockDatabase.delayNotifications[idx].sent_at = new Date().toISOString();
                  mockDatabase.delayNotifications[idx].updated_at = new Date().toISOString();
                  persistDb();
                  responseData.data = mockDatabase.delayNotifications[idx];

                  if (!mockDatabase.communications) mockDatabase.communications = [];
                  mockDatabase.communications.push({
                    id: `mock-comm-${Date.now()}`,
                    tenant_id: 'mock-tenant-123',
                    channel: 'email',
                    direction: 'outbound',
                    status: 'sent',
                    subject: 'Project Timeline Delay Update',
                    body: mockDatabase.delayNotifications[idx].message_draft,
                    sent_at: new Date().toISOString(),
                    created_at: new Date().toISOString()
                  });
                }
              }
            } else if (matchSingle) {
              const projectId = matchSingle[1];
              const notificationId = matchSingle[2];
              if (method === 'patch') {
                const updates = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
                const idx = mockDatabase.delayNotifications.findIndex(dn => dn.id === notificationId);
                if (idx !== -1) {
                  mockDatabase.delayNotifications[idx] = {
                    ...mockDatabase.delayNotifications[idx],
                    ...updates,
                    updated_at: new Date().toISOString()
                  };
                  persistDb();
                  responseData.data = mockDatabase.delayNotifications[idx];
                }
              } else if (method === 'delete') {
                mockDatabase.delayNotifications = mockDatabase.delayNotifications.filter(dn => dn.id !== notificationId);
                persistDb();
                responseData.data = { success: true };
              }
            }
          }
          // PUNCH LISTS
          else if (url.includes('/punch-lists')) {
            const urlParts = url.split('?');
            const pathPart = urlParts[0];

            if (!mockDatabase.punchLists) {
              mockDatabase.punchLists = [
                {
                  id: 'mock-pl-1',
                  project_id: 'mock-project-123',
                  title: 'Pre-Handover Walkthrough',
                  walkthrough_date: '2026-06-25',
                  status: 'active',
                  created_by: 'mock-user-123',
                  creator_name: 'System Admin',
                  signed_off_by_client: false,
                  client_signed_off_at: null,
                  created_at: new Date().toISOString()
                }
              ];
            }
            if (!mockDatabase.punchListItems) {
              mockDatabase.punchListItems = [
                {
                  id: 'mock-pli-1',
                  punch_list_id: 'mock-pl-1',
                  room_name: 'Living Room',
                  trade: 'carpentry',
                  item_description: 'Slight gap in the main wardrobe handle alignment',
                  photo_key: null,
                  assignee_id: 'mock-user-123',
                  assignee_name: 'System Admin',
                  status: 'open',
                  closed_by_qc: null,
                  closed_at: null,
                  qc_notes: null,
                  client_verified: false,
                  client_verified_at: null,
                  created_at: new Date().toISOString()
                },
                {
                  id: 'mock-pli-2',
                  punch_list_id: 'mock-pl-1',
                  room_name: 'Kitchen',
                  trade: 'plumbing',
                  item_description: 'Sink inlet pipe slow leakage',
                  photo_key: null,
                  assignee_id: 'mock-user-123',
                  assignee_name: 'System Admin',
                  status: 'resolved',
                  closed_by_qc: 'mock-user-123',
                  closed_by_qc_name: 'QC Manager',
                  closed_at: new Date().toISOString(),
                  qc_notes: 'Replaced Teflon tape and re-tightened the coupling joint. Leakage stopped.',
                  client_verified: false,
                  client_verified_at: null,
                  created_at: new Date().toISOString()
                }
              ];
            }

            const matchItemVerify = pathPart.match(/\/portal\/punch-lists\/items\/([a-zA-Z0-9-]+)\/verify$/);
            const matchPortalSignOff = pathPart.match(/\/portal\/punch-lists\/([a-zA-Z0-9-]+)\/sign-off$/);
            const matchPortalSingle = pathPart.match(/\/portal\/punch-lists\/([a-zA-Z0-9-]+)$/);
            const matchPortalList = pathPart.endsWith('/portal/punch-lists');
            
            const matchItemAction = pathPart.match(/\/projects\/[a-zA-Z0-9-]+\/punch-lists\/([a-zA-Z0-9-]+)\/items(?:\/([a-zA-Z0-9-]+))?$/);
            const matchPlAction = pathPart.match(/\/projects\/[a-zA-Z0-9-]+\/punch-lists(?:\/([a-zA-Z0-9-]+))?$/);

            if (matchItemVerify) {
              const itemId = matchItemVerify[1];
              const idx = mockDatabase.punchListItems.findIndex(i => i.id === itemId);
              if (idx !== -1) {
                mockDatabase.punchListItems[idx].status = 'verified';
                mockDatabase.punchListItems[idx].client_verified = true;
                mockDatabase.punchListItems[idx].client_verified_at = new Date().toISOString();
                
                const plId = mockDatabase.punchListItems[idx].punch_list_id;
                const siblings = mockDatabase.punchListItems.filter(i => i.punch_list_id === plId);
                const allVerified = siblings.every(i => i.status === 'verified');
                const plIdx = mockDatabase.punchLists.findIndex(p => p.id === plId);
                if (plIdx !== -1) {
                  if (allVerified) {
                    mockDatabase.punchLists[plIdx].status = 'client_verified';
                    mockDatabase.punchLists[plIdx].signed_off_by_client = true;
                    mockDatabase.punchLists[plIdx].client_signed_off_at = new Date().toISOString();
                  } else if (siblings.every(i => i.status === 'resolved' || i.status === 'verified')) {
                    mockDatabase.punchLists[plIdx].status = 'resolved';
                  }
                }
                persistDb();
                responseData.data = mockDatabase.punchListItems[idx];
              }
            }
            else if (matchPortalSignOff) {
              const plId = matchPortalSignOff[1];
              const idx = mockDatabase.punchLists.findIndex(p => p.id === plId);
              if (idx !== -1) {
                mockDatabase.punchLists[idx].status = 'client_verified';
                mockDatabase.punchLists[idx].signed_off_by_client = true;
                mockDatabase.punchLists[idx].client_signed_off_at = new Date().toISOString();
                persistDb();
                responseData.data = mockDatabase.punchLists[idx];
              }
            }
            else if (matchPortalSingle) {
              const plId = matchPortalSingle[1];
              const pl = mockDatabase.punchLists.find(p => p.id === plId);
              if (pl) {
                const items = mockDatabase.punchListItems.filter(i => i.punch_list_id === plId);
                responseData.data = { ...pl, items };
              } else {
                responseData.success = false;
              }
            }
            else if (matchPortalList) {
              responseData.data = mockDatabase.punchLists;
            }
            else if (matchItemAction) {
              const plId = matchItemAction[1];
              const itemId = matchItemAction[2];

              if (method === 'post') {
                const payload = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
                const newItem = {
                  id: `mock-pli-${Date.now()}`,
                  punch_list_id: plId,
                  room_name: payload.room_name,
                  trade: payload.trade,
                  item_description: payload.item_description,
                  photo_key: payload.photo_key || null,
                  assignee_id: payload.assignee_id || null,
                  assignee_name: payload.assignee_id ? 'Assigned Trade' : null,
                  status: 'open',
                  closed_by_qc: null,
                  closed_at: null,
                  qc_notes: null,
                  client_verified: false,
                  client_verified_at: null,
                  created_at: new Date().toISOString()
                };
                mockDatabase.punchListItems.push(newItem);
                
                const plIdx = mockDatabase.punchLists.findIndex(p => p.id === plId);
                if (plIdx !== -1 && mockDatabase.punchLists[plIdx].status === 'draft') {
                  mockDatabase.punchLists[plIdx].status = 'active';
                }
                
                persistDb();
                responseData.data = newItem;
              }
              else if (method === 'patch' && itemId) {
                const payload = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
                const idx = mockDatabase.punchListItems.findIndex(i => i.id === itemId);
                if (idx !== -1) {
                  if (payload.status === 'resolved') {
                    if (!payload.qc_notes) {
                      return Promise.reject({ response: { status: 400, data: { message: 'QC notes required' } } });
                    }
                    payload.closed_by_qc = 'mock-user-123';
                    payload.closed_by_qc_name = 'System Admin';
                    payload.closed_at = new Date().toISOString();
                  } else if (payload.status === 'verified') {
                    payload.client_verified = true;
                    payload.client_verified_at = new Date().toISOString();
                  } else if (payload.status === 'open') {
                    payload.closed_by_qc = null;
                    payload.closed_at = null;
                    payload.qc_notes = null;
                    payload.client_verified = false;
                    payload.client_verified_at = null;
                  }
                  mockDatabase.punchListItems[idx] = { ...mockDatabase.punchListItems[idx], ...payload };
                  
                  const siblings = mockDatabase.punchListItems.filter(i => i.punch_list_id === plId);
                  const allVerified = siblings.every(i => i.status === 'verified');
                  const allResolved = siblings.every(i => i.status === 'resolved' || i.status === 'verified');
                  const plIdx = mockDatabase.punchLists.findIndex(p => p.id === plId);
                  if (plIdx !== -1) {
                    if (allVerified) {
                      mockDatabase.punchLists[plIdx].status = 'client_verified';
                      mockDatabase.punchLists[plIdx].signed_off_by_client = true;
                      mockDatabase.punchLists[plIdx].client_signed_off_at = new Date().toISOString();
                    } else if (allResolved) {
                      mockDatabase.punchLists[plIdx].status = 'resolved';
                    } else {
                      mockDatabase.punchLists[plIdx].status = 'active';
                    }
                  }

                  persistDb();
                  responseData.data = mockDatabase.punchListItems[idx];
                }
              }
              else if (method === 'delete' && itemId) {
                mockDatabase.punchListItems = mockDatabase.punchListItems.filter(i => i.id !== itemId);
                
                const siblings = mockDatabase.punchListItems.filter(i => i.punch_list_id === plId);
                const plIdx = mockDatabase.punchLists.findIndex(p => p.id === plId);
                if (plIdx !== -1 && siblings.length > 0) {
                  const allVerified = siblings.every(i => i.status === 'verified');
                  const allResolved = siblings.every(i => i.status === 'resolved' || i.status === 'verified');
                  if (allVerified) {
                    mockDatabase.punchLists[plIdx].status = 'client_verified';
                    mockDatabase.punchLists[plIdx].signed_off_by_client = true;
                    mockDatabase.punchLists[plIdx].client_signed_off_at = new Date().toISOString();
                  } else if (allResolved) {
                    mockDatabase.punchLists[plIdx].status = 'resolved';
                  } else {
                    mockDatabase.punchLists[plIdx].status = 'active';
                  }
                }
                persistDb();
                responseData.data = { success: true };
              }
            }
            else if (matchPlAction) {
              const plId = matchPlAction[1];
              if (method === 'get') {
                if (plId) {
                  const pl = mockDatabase.punchLists.find(p => p.id === plId);
                  if (pl) {
                    const items = mockDatabase.punchListItems.filter(i => i.punch_list_id === plId);
                    responseData.data = { ...pl, items };
                  }
                } else {
                  responseData.data = mockDatabase.punchLists;
                }
              }
              else if (method === 'post') {
                const payload = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
                const newPl = {
                  id: `mock-pl-${Date.now()}`,
                  project_id: 'mock-project-123',
                  title: payload.title,
                  walkthrough_date: payload.walkthrough_date || null,
                  status: 'draft',
                  created_by: 'mock-user-123',
                  creator_name: 'System Admin',
                  signed_off_by_client: false,
                  client_signed_off_at: null,
                  created_at: new Date().toISOString()
                };
                mockDatabase.punchLists.push(newPl);
                persistDb();
                responseData.data = newPl;
              }
              else if (method === 'patch' && plId) {
                const payload = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
                const idx = mockDatabase.punchLists.findIndex(p => p.id === plId);
                if (idx !== -1) {
                  mockDatabase.punchLists[idx] = { ...mockDatabase.punchLists[idx], ...payload };
                  persistDb();
                  responseData.data = mockDatabase.punchLists[idx];
                }
              }
              else if (method === 'delete' && plId) {
                mockDatabase.punchLists = mockDatabase.punchLists.filter(p => p.id !== plId);
                mockDatabase.punchListItems = mockDatabase.punchListItems.filter(i => i.punch_list_id !== plId);
                persistDb();
                responseData.data = { success: true };
              }
            }
          }
          // MATERIAL DELIVERIES
          else if (url.includes('/material-deliveries')) {
            const urlParts = url.split('?');
            const pathPart = urlParts[0];

            if (!mockDatabase.materialDeliveries) {
              mockDatabase.materialDeliveries = [
                {
                  id: 'mock-md-1',
                  project_id: 'mock-project-123',
                  purchase_order_id: 'mock-po-123',
                  po_number: 'PO-2026-001',
                  delivery_number: 'DN-20260627-999',
                  status: 'pending',
                  expected_delivery_date: '2026-06-28T12:00:00Z',
                  actual_receipt_date: null,
                  received_by: null,
                  receiver_name: null,
                  notes: 'Delivery expected directly at client site storage area.',
                  created_at: new Date().toISOString()
                }
              ];
            }

            if (!mockDatabase.materialDeliveryItems) {
              mockDatabase.materialDeliveryItems = [
                {
                  id: 'mock-mdi-1',
                  material_delivery_id: 'mock-md-1',
                  po_item_id: 'mock-poi-1',
                  item_name: 'Premium 18mm Plywood',
                  brand: 'CenturyPly',
                  material_specifications: 'IS 710 BWR grade waterproof plywood',
                  quantity_expected: 50.00,
                  quantity_received: 0.00,
                  is_damaged: false,
                  damage_description: null,
                  condition_notes: null,
                  photo_key: null,
                  specification_conformance_status: 'conforming',
                  specification_variance_details: null,
                  inspection_status: 'pending',
                  rejected_quantity: 0.00,
                  rejection_reason: null,
                  created_at: new Date().toISOString()
                },
                {
                  id: 'mock-mdi-2',
                  material_delivery_id: 'mock-md-1',
                  po_item_id: 'mock-poi-2',
                  item_name: 'Multi-color LED COB Spotlights',
                  brand: 'Philips',
                  material_specifications: '12W warm white focus spotlights',
                  quantity_expected: 20.00,
                  quantity_received: 0.00,
                  is_damaged: false,
                  damage_description: null,
                  condition_notes: null,
                  photo_key: null,
                  specification_conformance_status: 'conforming',
                  specification_variance_details: null,
                  inspection_status: 'pending',
                  rejected_quantity: 0.00,
                  rejection_reason: null,
                  created_at: new Date().toISOString()
                }
              ];
            }

            const matchInspect = pathPart.match(/\/projects\/[a-zA-Z0-9-]+\/material-deliveries\/([a-zA-Z0-9-]+)\/inspect$/);
            const matchSingle = pathPart.match(/\/projects\/[a-zA-Z0-9-]+\/material-deliveries\/([a-zA-Z0-9-]+)$/);
            const matchQuery = pathPart.includes('/material-deliveries');

            if (matchInspect && method === 'post') {
              const deliveryId = matchInspect[1];
              const payload = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
              const { inspectionNotes, items } = payload;
              
              const mdIdx = mockDatabase.materialDeliveries.findIndex(d => d.id === deliveryId);
              if (mdIdx !== -1) {
                let anyRejected = false;
                let allAcceptedConforming = true;

                if (Array.isArray(items)) {
                  items.forEach(itemUpdate => {
                    const idx = mockDatabase.materialDeliveryItems.findIndex(i => i.id === itemUpdate.itemId);
                    if (idx !== -1) {
                      const {
                        quantityReceived,
                        specificationConformanceStatus,
                        specificationVarianceDetails,
                        inspectionStatus,
                        rejectedQuantity,
                        rejectionReason
                      } = itemUpdate;

                      if (inspectionStatus === 'rejected') {
                        anyRejected = true;
                      }
                      if (specificationConformanceStatus === 'non-conforming' || inspectionStatus === 'rejected') {
                        allAcceptedConforming = false;
                      }

                      mockDatabase.materialDeliveryItems[idx] = {
                        ...mockDatabase.materialDeliveryItems[idx],
                        quantity_received: quantityReceived,
                        specification_conformance_status: specificationConformanceStatus,
                        specification_variance_details: specificationVarianceDetails,
                        inspection_status: inspectionStatus,
                        rejected_quantity: rejectedQuantity,
                        rejection_reason: rejectionReason,
                        updated_at: new Date().toISOString()
                      };
                    }
                  });
                }

                let finalStatus = 'inspected';
                if (anyRejected) {
                  finalStatus = 'rejected';
                } else if (!allAcceptedConforming) {
                  finalStatus = 'partially received';
                }

                let vendorNotificationSent = false;
                let vendorNotificationSentAt = null;
                if (anyRejected) {
                  vendorNotificationSent = true;
                  vendorNotificationSentAt = new Date().toISOString();
                }

                mockDatabase.materialDeliveries[mdIdx] = {
                  ...mockDatabase.materialDeliveries[mdIdx],
                  status: finalStatus,
                  inspection_date: new Date().toISOString(),
                  inspected_by: 'mock-user-123',
                  receiver_name: 'System Admin',
                  inspection_notes: inspectionNotes || null,
                  vendor_notification_sent: vendorNotificationSent,
                  vendor_notification_sent_at: vendorNotificationSentAt,
                  actual_receipt_date: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                };

                persistDb();
                
                const responseObj = { ...mockDatabase.materialDeliveries[mdIdx] };
                responseObj.items = mockDatabase.materialDeliveryItems.filter(i => i.material_delivery_id === deliveryId);
                responseData.data = responseObj;
              } else {
                responseData.success = false;
              }
            }
            else if (matchSingle) {
              const deliveryId = matchSingle[1];
              if (method === 'get') {
                const delivery = mockDatabase.materialDeliveries.find(d => d.id === deliveryId);
                if (delivery) {
                  const items = mockDatabase.materialDeliveryItems.filter(i => i.material_delivery_id === deliveryId);
                  responseData.data = { ...delivery, items };
                } else {
                  responseData.success = false;
                }
              }
            }
            else if (matchQuery) {
              if (method === 'get') {
                responseData.data = mockDatabase.materialDeliveries;
              }
            }
          }
          // TENANT SETTINGS
          else if (url.includes('/config/tenant-settings')) {
            if (method === 'get') {
              responseData.data = mockDatabase.tenantSettings || {
                pre_conversion_checklist: [
                  { key: 'contract_signed', label: 'Contract signed', required: true, active: true },
                  { key: 'booking_received', label: 'Booking amount received', required: true, active: true },
                  { key: 'scope_finalized', label: 'Scope frozen', required: true, active: true },
                  { key: 'site_visit_completed', label: 'Site visit completed', required: true, active: true },
                  { key: 'floor_plan', label: 'Floor plan attached', required: false, active: true },
                  { key: 'site_address_confirmed', label: 'Site address confirmed', required: false, active: true }
                ]
              };
            } else if (method === 'patch') {
              const payload = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
              const currentSettings = mockDatabase.tenantSettings || {
                pre_conversion_checklist: [
                  { key: 'contract_signed', label: 'Contract signed', required: true, active: true },
                  { key: 'booking_received', label: 'Booking amount received', required: true, active: true },
                  { key: 'scope_finalized', label: 'Scope frozen', required: true, active: true },
                  { key: 'site_visit_completed', label: 'Site visit completed', required: true, active: true },
                  { key: 'floor_plan', label: 'Floor plan attached', required: false, active: true },
                  { key: 'site_address_confirmed', label: 'Site address confirmed', required: false, active: true }
                ]
              };
              mockDatabase.tenantSettings = {
                ...currentSettings,
                ...payload
              };
              persistDb();
              responseData.data = mockDatabase.tenantSettings;
            }
          }
          // CLOSURE CHECKLIST
          else if (url.includes('/closure-checklist')) {
            const urlParts = url.split('?');
            const pathPart = urlParts[0];
            const match = pathPart.match(/\/projects\/([a-zA-Z0-9-]+)\/closure-checklist$/);
            const projectId = match ? match[1] : 'mock-project-123';

            if (!mockDatabase.closureChecklists) {
              mockDatabase.closureChecklists = {};
            }

            if (!mockDatabase.closureChecklists[projectId]) {
              mockDatabase.closureChecklists[projectId] = {
                id: `mock-cc-${projectId}`,
                project_id: projectId,
                tenant_id: 'mock-tenant-123',
                financial_clearance_completed: false,
                financial_clearance_notes: '',
                financial_clearance_verified_by: null,
                financial_clearance_verified_at: null,
                task_completion_completed: false,
                task_completion_notes: '',
                task_completion_verified_by: null,
                task_completion_verified_at: null,
                snag_closure_completed: false,
                snag_closure_notes: '',
                snag_closure_verified_by: null,
                snag_closure_verified_at: null,
                document_archive_completed: false,
                document_archive_notes: '',
                document_archive_verified_by: null,
                document_archive_verified_at: null,
                warranty_activation_completed: false,
                warranty_activation_notes: '',
                warranty_activation_verified_by: null,
                warranty_activation_verified_at: null,
                status: 'in_progress',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              };
            }

            if (method === 'get') {
              responseData.data = {
                checklist: mockDatabase.closureChecklists[projectId],
                autoVerification: {
                  financialClearance: { passed: true, message: 'All milestones paid or deferred' },
                  taskCompletion: { passed: true, message: 'All project tasks completed' },
                  snagClosure: { passed: true, message: 'No open snags or defects' },
                  documentArchive: { passed: true, message: 'All documents approved' },
                  warrantyActivation: { passed: true, message: 'Warranties registered and active' }
                }
              };
            } else if (method === 'patch') {
              const payload = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
              const current = mockDatabase.closureChecklists[projectId];
              const updated = {
                ...current,
                ...payload,
                updated_at: new Date().toISOString()
              };
              
              if (
                updated.financial_clearance_completed &&
                updated.task_completion_completed &&
                updated.snag_closure_completed &&
                updated.document_archive_completed &&
                updated.warranty_activation_completed
              ) {
                updated.status = 'completed';
              } else {
                updated.status = 'in_progress';
              }

              mockDatabase.closureChecklists[projectId] = updated;
              persistDb();
              
              responseData.data = {
                checklist: updated,
                autoVerification: {
                  financialClearance: { passed: true, message: 'All milestones paid or deferred' },
                  taskCompletion: { passed: true, message: 'All project tasks completed' },
                  snagClosure: { passed: true, message: 'No open snags or defects' },
                  documentArchive: { passed: true, message: 'All documents approved' },
                  warrantyActivation: { passed: true, message: 'Warranties registered and active' }
                }
              };
            }
          }
          // RETROSPECTIVE
          else if (url.includes('/retrospective')) {
            const urlParts = url.split('?');
            const pathPart = urlParts[0];
            const match = pathPart.match(/\/projects\/([a-zA-Z0-9-]+)\/retrospective$/);
            const projectId = match ? match[1] : 'mock-project-123';

            if (!mockDatabase.retrospectives) {
              mockDatabase.retrospectives = {};
            }

            if (!mockDatabase.retrospectives[projectId]) {
              mockDatabase.retrospectives[projectId] = {
                id: `mock-retro-${projectId}`,
                project_id: projectId,
                tenant_id: 'mock-tenant-123',
                what_went_well: '',
                what_went_wrong: '',
                design_feedback: '',
                process_changes: '',
                created_by: 'mock-user-123',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              };
            }

            if (!mockDatabase.retroVendors) {
              mockDatabase.retroVendors = {};
            }

            if (!mockDatabase.retroVendors[projectId]) {
              mockDatabase.retroVendors[projectId] = [];
            }

            const allProjectVendors = mockDatabase.projectVendors || [
              { project_vendor_id: 'mock-pv-1', vendor_name: 'Decora Carpets', scope_of_work: 'Flooring & carpet installation' },
              { project_vendor_id: 'mock-pv-2', vendor_name: 'Apex Electricals', scope_of_work: 'Wiring & electrical fitting' }
            ];

            if (method === 'get') {
              const combinedRatings = allProjectVendors.map(v => {
                const found = mockDatabase.retroVendors[projectId].find(r => r.project_vendor_id === v.project_vendor_id);
                return {
                  project_vendor_id: v.project_vendor_id,
                  vendor_name: v.vendor_name,
                  scope_of_work: v.scope_of_work,
                  rating: found ? found.rating : null,
                  feedback: found ? found.feedback : ''
                };
              });

              responseData.data = {
                retrospective: mockDatabase.retrospectives[projectId],
                vendorRatings: combinedRatings,
                projectVendors: allProjectVendors
              };
            } else if (method === 'post') {
              const payload = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
              const { what_went_well, what_went_wrong, design_feedback, process_changes, vendor_ratings = [] } = payload;
              
              mockDatabase.retrospectives[projectId] = {
                ...mockDatabase.retrospectives[projectId],
                what_went_well,
                what_went_wrong,
                design_feedback,
                process_changes,
                updated_at: new Date().toISOString()
              };

              mockDatabase.retroVendors[projectId] = vendor_ratings;
              persistDb();

              const combinedRatings = allProjectVendors.map(v => {
                const found = mockDatabase.retroVendors[projectId].find(r => r.project_vendor_id === v.project_vendor_id);
                return {
                  project_vendor_id: v.project_vendor_id,
                  vendor_name: v.vendor_name,
                  scope_of_work: v.scope_of_work,
                  rating: found ? found.rating : null,
                  feedback: found ? found.feedback : ''
                };
              });

              responseData.data = {
                retrospective: mockDatabase.retrospectives[projectId],
                vendorRatings: combinedRatings,
                projectVendors: allProjectVendors
              };
            }
          }
          // ARCHIVE
          else if (url.includes('/archive')) {
            const urlParts = url.split('?');
            const pathPart = urlParts[0];
            const match = pathPart.match(/\/projects\/([a-zA-Z0-9-]+)\/archive$/);
            if (match && method === 'post') {
              const projectId = match[1];
              const idx = mockDatabase.projects?.findIndex(p => p.id === projectId);
              if (idx !== -1 && mockDatabase.projects) {
                mockDatabase.projects[idx].status = 'archived';
                persistDb();
                responseData.data = mockDatabase.projects[idx];
              }
            }
          }
          // REOPEN
          else if (url.includes('/reopen')) {
            const urlParts = url.split('?');
            const pathPart = urlParts[0];
            const match = pathPart.match(/\/projects\/([a-zA-Z0-9-]+)\/reopen$/);
            if (match && method === 'post') {
              const projectId = match[1];
              const payload = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
              const { newStartDate, newTargetDate } = payload;
              
              const idx = mockDatabase.projects?.findIndex(p => p.id === projectId);
              if (idx !== -1 && mockDatabase.projects) {
                mockDatabase.projects[idx].status = 'active';
                mockDatabase.projects[idx].start_date = newStartDate;
                if (newTargetDate) {
                  mockDatabase.projects[idx].target_date = newTargetDate;
                }
                persistDb();
                responseData.data = mockDatabase.projects[idx];
              }
            }
          }
          // EVENTS (AUDIT TRAIL)
          else if (url.includes('/events')) {
            if (method === 'get') {
              if (url.includes('export=csv')) {
                return Promise.resolve({
                  data: "Timestamp,User Name,User Email,Action,Entity,Entity ID,Old Value,New Value,IP Address\n2026-06-27T10:00:00Z,Mock Admin,admin@mock.com,project.updated,project,mock-proj-1,{},{},127.0.0.1",
                  status: 200,
                  statusText: 'OK',
                  headers: { 'content-type': 'text/csv' },
                  config,
                  request: {}
                });
              } else {
                responseData.data = [
                  {
                    id: 'mock-audit-1',
                    created_at: new Date(Date.now() - 3600000).toISOString(),
                    user_name: 'Mock Admin',
                    user_email: 'admin@mock.com',
                    action: 'project.updated',
                    entity: 'project',
                    entity_id: 'mock-proj-1',
                    old_value: '{"name": "Old Project Name"}',
                    new_value: '{"name": "New Project Name"}',
                    ip_address: '127.0.0.1'
                  },
                  {
                    id: 'mock-audit-2',
                    created_at: new Date(Date.now() - 7200000).toISOString(),
                    user_name: 'Mock Designer',
                    user_email: 'designer@mock.com',
                    action: 'document.approved',
                    entity: 'document',
                    entity_id: 'mock-doc-1',
                    old_value: '{"status": "pending"}',
                    new_value: '{"status": "approved"}',
                    ip_address: '127.0.0.1'
                  }
                ];
                responseData.meta = {
                  total: 2,
                  count: 2,
                  offset: 0,
                  limit: 50,
                  hasMore: false
                };
              }
            }
          }
          else if (url.includes('/vendor-lead-times')) {
            if (!mockDatabase.vendorLeadTimes) {
              mockDatabase.vendorLeadTimes = [
                { id: 'mock-lt-1', material_category: 'plywood', lead_time_days: 7, vendor_id: null },
                { id: 'mock-lt-2', material_category: 'hardware', lead_time_days: 3, vendor_id: null },
                { id: 'mock-lt-3', material_category: 'laminate', lead_time_days: 5, vendor_id: null },
                { id: 'mock-lt-4', material_category: 'paint', lead_time_days: 3, vendor_id: null },
                { id: 'mock-lt-5', material_category: 'modular', lead_time_days: 15, vendor_id: null },
                { id: 'mock-lt-6', material_category: 'general', lead_time_days: 5, vendor_id: null }
              ];
            }

            if (method === 'get') {
              responseData.data = mockDatabase.vendorLeadTimes;
            } else if (method === 'post') {
              const payload = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
              const existingIdx = mockDatabase.vendorLeadTimes.findIndex(lt => 
                lt.material_category === payload.materialCategory && lt.vendor_id === (payload.vendorId || null)
              );
              
              if (existingIdx !== -1) {
                mockDatabase.vendorLeadTimes[existingIdx].lead_time_days = Number(payload.leadTimeDays);
                responseData.data = mockDatabase.vendorLeadTimes[existingIdx];
              } else {
                const newLt = {
                  id: `mock-lt-${Date.now()}`,
                  material_category: payload.materialCategory,
                  lead_time_days: Number(payload.leadTimeDays),
                  vendor_id: payload.vendorId || null
                };
                mockDatabase.vendorLeadTimes.push(newLt);
                responseData.data = newLt;
              }
              persistDb();
            } else if (method === 'delete') {
              const parts = url.split('/');
              const id = parts[parts.length - 1];
              mockDatabase.vendorLeadTimes = mockDatabase.vendorLeadTimes.filter(lt => lt.id !== id);
              persistDb();
              responseData.data = { success: true };
            }
          }
          // DEVELOPER API TOKENS
          else if (url.includes('/api/developer/tokens')) {
            if (!mockDatabase.apiTokens) {
              mockDatabase.apiTokens = [
                { id: 'token-1', name: 'Zapier Integration', description: 'Used for lead sync', permissions: ['Leads Read', 'Leads Write'], status: 'active', last_used_at: new Date().toISOString(), created_at: new Date(Date.now() - 86400000).toISOString() }
              ];
            }
            if (url.includes('/dashboard')) {
              responseData.data = { stats: { total_requests: 12450, successful_requests: 12400, failed_requests: 50, last_request_at: new Date().toISOString() } };
            } else if (url.includes('/logs')) {
              responseData.data = { rows: [
                { id: 'log-1', endpoint: '/api/v1/leads', method: 'GET', status_code: 200, ip_address: '192.168.1.1', execution_time_ms: 45, created_at: new Date().toISOString() }
              ]};
            } else if (method === 'get') {
              responseData.data = mockDatabase.apiTokens;
            } else if (method === 'post') {
              if (url.includes('/regenerate')) {
                responseData.data = { rawSecret: 'sk_live_' + Math.random().toString(36).substring(2) };
              } else {
                const payload = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
                const newToken = {
                  id: `token-${Date.now()}`,
                  name: payload.name,
                  description: payload.description,
                  permissions: payload.permissions || [],
                  status: 'active',
                  created_at: new Date().toISOString()
                };
                mockDatabase.apiTokens.push(newToken);
                persistDb();
                responseData.data = { token: newToken, rawSecret: 'sk_live_' + Math.random().toString(36).substring(2) };
              }
            } else if (method === 'put') {
              const parts = url.split('/');
              const id = parts[parts.length - 1];
              const updates = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
              const idx = mockDatabase.apiTokens.findIndex(t => t.id === id);
              if (idx !== -1) {
                mockDatabase.apiTokens[idx] = { ...mockDatabase.apiTokens[idx], ...updates };
                persistDb();
              }
              responseData.data = { success: true };
            } else if (method === 'delete') {
              const parts = url.split('/');
              const id = parts[parts.length - 1];
              mockDatabase.apiTokens = mockDatabase.apiTokens.filter(t => t.id !== id);
              persistDb();
              responseData.data = { success: true };
            }
          }
          else if (url.includes('/config/webhooks')) {
            if (!mockDatabase.webhooks) {
              mockDatabase.webhooks = [];
            }
            if (method === 'get') {
              responseData.data = mockDatabase.webhooks;
            } else if (method === 'post') {
              const payload = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
              const newWebhook = {
                id: `webhook-${Date.now()}`,
                name: payload.name,
                url: payload.url,
                events: payload.events || [],
                custom_headers: payload.custom_headers || {},
                retry_count: payload.retry_count || 3,
                is_active: payload.is_active !== undefined ? payload.is_active : true,
                is_debug_mode: payload.is_debug_mode || false,
                created_at: new Date().toISOString()
              };
              mockDatabase.webhooks.push(newWebhook);
              persistDb();
              responseData.data = newWebhook;
            } else if (method === 'put') {
              const parts = url.split('/');
              const id = parts[parts.length - 1];
              const updates = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
              const idx = mockDatabase.webhooks.findIndex(w => w.id === id);
              if (idx !== -1) {
                mockDatabase.webhooks[idx] = { ...mockDatabase.webhooks[idx], ...updates };
                persistDb();
              }
              responseData.data = { success: true };
            } else if (method === 'delete') {
              const parts = url.split('/');
              const id = parts[parts.length - 1];
              mockDatabase.webhooks = mockDatabase.webhooks.filter(w => w.id !== id);
              persistDb();
              responseData.data = { success: true };
            }
          }
          else if (isMutation) {
            console.warn(
              `[MockSession] ${method.toUpperCase()} ${config.url} intercepted — request NOT sent to server.`
            );
          }

          return Promise.resolve({
            data: responseData,
            status: 200,
            statusText: 'OK',
            headers: {},
            config,
            request: {}
          });
        };
      }
      return config;
    },
    (error) => Promise.reject(error)
  );
};
