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

          // WORK ACTIVITIES
          else if (url.includes('/work-activities')) {
            const urlParts = url.split('?');
            // match path: /projects/:projectId/work-activities or /projects/:projectId/work-activities/:id
            const match = urlParts[0].match(/\/projects\/([a-zA-Z0-9-]+)\/work-activities(?:\/([a-zA-Z0-9-]+))?$/);
            const projectId = match ? match[1] : null;
            const activityId = match ? match[2] : null;

            if (!mockDatabase.workActivities) mockDatabase.workActivities = [];

            if (method === 'get') {
              if (url.includes('/templates')) {
                responseData.data = [
                  { trade: 'civil', room_type: 'General', activity_name: 'Demolition and hacking', description: 'Demolition of existing structures, walls, or tiles.' },
                  { trade: 'civil', room_type: 'General', activity_name: 'Debris removal & site cleaning', description: 'Clearing out debris and preparing the floor/walls.' },
                  { trade: 'electrical', room_type: 'General', activity_name: 'Wall chasing and conduit pipe laying', description: 'Cutting grooves in walls and fitting PVC conduit pipes.' },
                  { trade: 'plumbing', room_type: 'Bathroom', activity_name: 'Waterproofing base coat application', description: 'Applying waterproofing compounds on floors and wet walls.' }
                ];
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
                responseData.data = filtered;
              }
            } else if (method === 'post') {
              const payload = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
              if (url.includes('/generate')) {
                const { phaseId, roomName, trade } = payload;
                const templates = [
                  { trade: 'civil', room_type: 'General', activity_name: 'Demolition and hacking', description: 'Demolition of existing structures, walls, or tiles.' },
                  { trade: 'civil', room_type: 'General', activity_name: 'Debris removal & site cleaning', description: 'Clearing out debris and preparing the floor/walls.' },
                  { trade: 'electrical', room_type: 'General', activity_name: 'Wall chasing and conduit pipe laying', description: 'Cutting grooves in walls and fitting PVC conduit pipes.' },
                  { trade: 'plumbing', room_type: 'Bathroom', activity_name: 'Waterproofing base coat application', description: 'Applying waterproofing compounds on floors and wet walls.' }
                ].filter(t => t.trade === trade);

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
                mockDatabase.workActivities[idx] = { 
                  ...mockDatabase.workActivities[idx], 
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
