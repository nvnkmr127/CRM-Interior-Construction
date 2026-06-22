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

          // LEADS
          if (url.includes('/leads')) {
            if (url.includes('/timeline')) {
              responseData.data = [];
            } else if (url.includes('/files')) {
              responseData.data = [];
            } else if (url.includes('/estimates')) {
              responseData.data = [];
            } else if (url.includes('/buying-intent')) {
              responseData.data = { intent: 'Warm', confidence: 80, reason: 'Mocked intent.' };
            } else if (url.includes('/buying-intent')) {
              responseData.data = { intent: 'Warm', confidence: 80, reason: 'Mocked intent.' };
            } else if (url.includes('/sentiment')) {
              responseData.data = { emoji: '🙂', mood: 'Positive', tip: 'Mocked sentiment.' };
            } else if (url.includes('/import')) {
              if (method === 'post') {
                const payload = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
                const leadsCount = (payload.csv?.split('\n').length || 2) - 1; // dummy count
                responseData.data = { created: leadsCount, skipped: 0 };
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
                mockDatabase.leads.push(newLead);
                persistDb();
                responseData.data = newLead;
              } else if (method === 'get') {
                if (leadId) {
                  responseData.data = mockDatabase.leads.find(l => l.id === leadId) || null;
                } else {
                  responseData.data = [...mockDatabase.leads];
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
          // TASKS (global or specific)
          else if (url.includes('/tasks')) {
            if (method === 'get') {
              responseData.data = [...mockDatabase.tasks];
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
