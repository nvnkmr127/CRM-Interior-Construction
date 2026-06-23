export const initialMockDatabase = {
  leads: [
    {
      id: 'mock-lead-1',
      created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      name: 'Rohan Sharma',
      email: 'rohan.sharma@example.com',
      phone: '+91 9876543210',
      status: 'qualified',
      probability: 85,
      revenue_potential: 2500000,
      decision_complexity: 'Medium',
      urgency: 'High',
      latitude: 12.9216,
      longitude: 77.5446,
      ai_score_breakdown: {
        "Buying Intent": 88,
        "Budget Confidence": 72
      }
    },
    {
      id: 'mock-lead-2',
      created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      name: 'Anita Desai',
      email: 'anita.d@example.com',
      phone: '+91 9123456789',
      status: 'new',
      probability: 25,
      revenue_potential: 1200000,
      decision_complexity: 'Low',
      urgency: 'Medium',
      latitude: 12.9350,
      longitude: 77.5300,
      ai_score_breakdown: {
        "Buying Intent": 45,
        "Budget Confidence": 60
      }
    }
  ],
  projects: [
    {
      id: 'mock-proj-1',
      name: 'Luxury Villa Interior - Phase 1',
      client_name: 'Mr. Sharma',
      pm_name: 'Rahul K.',
      type: 'Residential',
      status: 'active',
      progress: 65,
      completedTasks: 12,
      totalTasks: 20,
      phase: 'Execution',
      value: 4500000,
      target_date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
      overdue: false,
      created_at: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'mock-proj-2',
      name: 'Corporate Office Renovation',
      client_name: 'Tech Solutions Inc.',
      pm_name: 'Priya M.',
      type: 'Commercial',
      status: 'on_hold',
      progress: 30,
      completedTasks: 5,
      totalTasks: 25,
      phase: 'Design',
      value: 12000000,
      target_date: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
      overdue: false,
      created_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    }
  ],
  tasks: [
    {
      id: 'mock-task-1',
      project_id: 'mock-proj-1',
      title: 'Procure Italian Marble',
      status: 'in_progress',
      assignee: 'Rahul K.',
      due_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      priority: 'high'
    },
    {
      id: 'mock-task-2',
      project_id: 'mock-proj-1',
      title: 'Electrical Wiring Approval',
      status: 'completed',
      assignee: 'Amit S.',
      due_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      priority: 'medium'
    }
  ],
  dashboardStats: {
    totalRevenue: 16500000,
    activeProjects: 12,
    newLeads: 24,
    tasksCompleted: 89,
    revenueGrowth: 15.2,
    leadsGrowth: 5.4
  },
  dashboardActivity: [
    { id: 1, text: 'Rahul completed task "Electrical Wiring"', time: '2 hours ago' },
    { id: 2, text: 'New lead Anita Desai registered', time: '5 hours ago' },
    { id: 3, text: 'Project "Corporate Office" put on hold', time: '1 day ago' }
  ],
  dashboardPipeline: [
    { stage: 'New', count: 12 },
    { stage: 'Qualified', count: 8 },
    { stage: 'Negotiation', count: 4 },
    { stage: 'Closed Won', count: 5 }
  ]
};

export const loadMockDatabase = () => {
  try {
    const saved = localStorage.getItem('mockDatabase');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Ensure missing top-level keys get defaults from initial
      const merged = { ...initialMockDatabase, ...parsed };
      
      // Also ensure that initial leads that were saved without lat/lng get patched with the new coordinates
      if (merged.leads && Array.isArray(merged.leads)) {
        merged.leads = merged.leads.map(lead => {
          let updatedLead = { ...lead };
          
          const initialLead = initialMockDatabase.leads.find(l => l.id === lead.id);
          if (initialLead) {
            updatedLead = { ...initialLead, ...lead }; // lead overrides initial, but initial provides missing lat/lng
          }
          
          // If the lead STILL has no coordinates (e.g. newly created lead before this fix), give it random ones
          if (!updatedLead.latitude || !updatedLead.longitude) {
            updatedLead.latitude = 12.92 + (Math.random() * 0.1 - 0.05);
            updatedLead.longitude = 77.54 + (Math.random() * 0.1 - 0.05);
          }
          
          return updatedLead;
        });
      }
      
      return merged;
    }
  } catch (e) {
    console.error('Failed to parse mockDatabase from localStorage', e);
  }
  return { ...initialMockDatabase };
};

export const saveMockDatabase = (db) => {
  localStorage.setItem('mockDatabase', JSON.stringify(db));
};
