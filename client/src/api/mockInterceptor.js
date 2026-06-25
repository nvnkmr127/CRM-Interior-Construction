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

          // ACTIVITIES
          if (url.includes('/activities')) {
            const urlParts = url.split('?');
            const match = urlParts[0].match(/\/leads\/([a-zA-Z0-9-]+)\/activities(?:\/([a-zA-Z0-9-]+))?$/);
            const leadId = match ? match[1] : null;
            const activityId = match ? match[2] : null;

            if (method === 'get') {
              responseData.data = mockDatabase.activities?.filter(a => a.lead_id === leadId) || [];
            } else if (method === 'post') {
              const payload = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
              const newActivity = {
                id: `mock-act-${Date.now()}`,
                lead_id: leadId,
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
                const newProj = {
                  id: `mock-proj-${Date.now()}`,
                  name: payload.projectName || 'Converted Project',
                  client_name: payload.clientName || 'Client',
                  status: 'active',
                  progress: 0,
                  created_at: new Date().toISOString(),
                  value: payload.contractValue || 0,
                  target_date: payload.handoverDate || null,
                  pm_id: payload.pm || null
                };
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
                    filtered = filtered.filter(l => 
                      (l.name && l.name.toLowerCase().includes(s)) ||
                      (l.email && l.email.toLowerCase().includes(s)) ||
                      (l.phone && l.phone.toLowerCase().includes(s))
                    );
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
          // PROJECTS
          else if (url.includes('/projects')) {
            const match = url.match(/\/projects\/([a-zA-Z0-9-]+)$/);
            const projId = match ? match[1] : null;

            if (method === 'post') {
              const newProj = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
              newProj.id = `mock-proj-${Date.now()}`;
              newProj.created_at = new Date().toISOString();
              newProj.status = newProj.status || 'active';
              newProj.progress = newProj.progress || 0;
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
                  mockDatabase.projects[idx] = { ...mockDatabase.projects[idx], ...updates };
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
            if (method === 'get') {
              responseData.data = [...(mockDatabase.users || [])];
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
                due_date: payload.due_date,
                assigned_to: payload.assigned_to || null,
                assignee_name: assignee ? assignee.name : null,
                status: payload.status || 'open',
                priority: payload.priority || 'medium'
              };
              mockDatabase.tasks.push(newTask);
              persistDb();
              responseData.data = newTask;
            } else if (method === 'patch' || method === 'put') {
              if (taskId) {
                const updates = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
                const idx = mockDatabase.tasks.findIndex(t => t.id === taskId);
                if (idx !== -1) {
                  const updatedTask = { ...mockDatabase.tasks[idx], ...updates };
                  if (updates.assigned_to !== undefined) {
                    const assignee = mockDatabase.users?.find(u => u.id === updates.assigned_to);
                    updatedTask.assignee_name = assignee ? assignee.name : null;
                    updatedTask.assigned_to = updates.assigned_to;
                  }
                  mockDatabase.tasks[idx] = updatedTask;
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
