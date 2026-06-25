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
      budget_max: 2500000,
      budget: 2000000,
      decision_complexity: 'Medium',
      urgency: 'High',
      latitude: 12.9216,
      longitude: 77.5446,
      stage_id: 'stage-1',
      stage_name: 'Lead Capture',
      stage_color: '#6B6B6B',
      score: 82,
      buying_intent: 'Warm',
      ai_recommendation: 'Schedule discovery call',
      assignee_id: 'mock-user-2',
      assignee_name: 'Amit S.',
      source: 'Website',
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
      budget_max: 1200000,
      budget: 1000000,
      decision_complexity: 'Low',
      urgency: 'Medium',
      latitude: 12.9350,
      longitude: 77.5300,
      stage_id: 'stage-4',
      stage_name: 'First Contact',
      stage_color: '#C4956A',
      score: 45,
      buying_intent: 'Cold',
      ai_recommendation: 'Send intro brochure',
      assignee_id: 'mock-user-2',
      assignee_name: 'Amit S.',
      source: 'Facebook',
      ai_score_breakdown: {
        "Buying Intent": 45,
        "Budget Confidence": 60
      }
    },
    {
      id: 'mock-lead-3',
      created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      name: 'Kalyan Kumar',
      email: 'kalyan.kumar@example.com',
      phone: '+91 9888877777',
      status: 'qualified',
      probability: 90,
      revenue_potential: 3500000,
      budget_max: 3500000,
      budget: 3000000,
      decision_complexity: 'Medium',
      urgency: 'High',
      latitude: 12.9250,
      longitude: 77.5410,
      stage_id: 'stage-8',
      stage_name: 'Site Visit Conducted',
      stage_color: '#0000A0',
      score: 92,
      buying_intent: 'Hot',
      ai_recommendation: 'Prepare quotation draft',
      assignee_id: 'mock-user-2',
      assignee_name: 'Amit S.',
      source: 'Referral',
      ai_score_breakdown: {
        "Buying Intent": 95,
        "Budget Confidence": 90
      }
    },
    {
      id: 'mock-lead-4',
      created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      name: 'Meera Nair',
      email: 'meera.nair@example.com',
      phone: '+91 9900112233',
      status: 'new',
      probability: 60,
      revenue_potential: 1800000,
      budget_max: 1800000,
      budget: 1500000,
      decision_complexity: 'Low',
      urgency: 'Medium',
      latitude: 12.9120,
      longitude: 77.5620,
      stage_id: 'stage-2',
      stage_name: 'AI Qualification',
      stage_color: '#1A3A5C',
      score: 78,
      buying_intent: 'Warm',
      ai_recommendation: 'Verify carpet area details',
      assignee_id: 'mock-user-1',
      assignee_name: 'Rahul K.',
      source: 'IndiaMART',
      ai_score_breakdown: {
        "Buying Intent": 80,
        "Budget Confidence": 76
      }
    },
    {
      id: 'mock-lead-5',
      created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      name: 'Vikram Malhotra',
      email: 'vikram.m@example.com',
      phone: '+91 9811223344',
      status: 'qualified',
      probability: 70,
      revenue_potential: 5000000,
      budget_max: 5000000,
      budget: 4500000,
      decision_complexity: 'High',
      urgency: 'High',
      latitude: 12.9520,
      longitude: 77.5840,
      stage_id: 'stage-5',
      stage_name: 'Discovery Call',
      stage_color: '#8B5E0A',
      score: 64,
      buying_intent: 'Warm',
      ai_recommendation: 'Discuss design style preferences',
      assignee_id: 'mock-user-1',
      assignee_name: 'Rahul K.',
      source: 'Direct',
      ai_score_breakdown: {
        "Buying Intent": 60,
        "Budget Confidence": 68
      }
    },
    {
      id: 'mock-lead-6',
      created_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
      name: 'Siddharth Roy',
      email: 'siddharth@example.com',
      phone: '+91 9777666555',
      status: 'qualified',
      probability: 80,
      revenue_potential: 4200000,
      budget_max: 4200000,
      budget: 4000000,
      decision_complexity: 'Medium',
      urgency: 'High',
      latitude: 12.9050,
      longitude: 77.5120,
      stage_id: 'stage-7',
      stage_name: 'Site Visit Scheduling',
      stage_color: '#1589FF',
      score: 88,
      buying_intent: 'Hot',
      ai_recommendation: 'Confirm site visit date and time',
      assignee_id: 'mock-user-3',
      assignee_name: 'Priya M.',
      source: 'Website',
      ai_score_breakdown: {
        "Buying Intent": 90,
        "Budget Confidence": 86
      }
    },
    {
      id: 'mock-lead-7',
      created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
      name: 'Ananya Sen',
      email: 'ananya.sen@example.com',
      phone: '+91 9666555444',
      status: 'qualified',
      probability: 95,
      revenue_potential: 3000000,
      budget_max: 3000000,
      budget: 3000000,
      decision_complexity: 'Medium',
      urgency: 'Medium',
      latitude: 12.9640,
      longitude: 77.5550,
      stage_id: 'stage-11',
      stage_name: 'Design Presentation',
      stage_color: '#FF00FF',
      score: 95,
      buying_intent: 'Hot',
      ai_recommendation: 'Present living room 3D render',
      assignee_id: 'mock-user-3',
      assignee_name: 'Priya M.',
      source: 'Referral',
      ai_score_breakdown: {
        "Buying Intent": 98,
        "Budget Confidence": 92
      }
    },
    {
      id: 'mock-lead-8',
      created_at: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
      name: 'Rakesh Patel',
      email: 'rakesh.patel@example.com',
      phone: '+91 9555444333',
      status: 'qualified',
      probability: 75,
      revenue_potential: 2200000,
      budget_max: 2200000,
      budget: 2000000,
      decision_complexity: 'Low',
      urgency: 'Low',
      latitude: 12.9320,
      longitude: 77.5750,
      stage_id: 'stage-12',
      stage_name: 'Quotation',
      stage_color: '#43BFC7',
      score: 81,
      buying_intent: 'Warm',
      ai_recommendation: 'Follow up on initial quotation draft',
      assignee_id: 'mock-user-2',
      assignee_name: 'Amit S.',
      source: 'Direct',
      ai_score_breakdown: {
        "Buying Intent": 80,
        "Budget Confidence": 82
      }
    },
    {
      id: 'mock-lead-9',
      created_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
      name: 'Pooja Hegde',
      email: 'pooja.h@example.com',
      phone: '+91 9444333222',
      status: 'qualified',
      probability: 90,
      revenue_potential: 6000000,
      budget_max: 6000000,
      budget: 5500000,
      decision_complexity: 'High',
      urgency: 'High',
      latitude: 12.9780,
      longitude: 77.5920,
      stage_id: 'stage-13',
      stage_name: 'Negotiation',
      stage_color: '#FF7F50',
      score: 90,
      buying_intent: 'Hot',
      ai_recommendation: 'Offer 5% discount on woodwork package',
      assignee_id: 'mock-user-2',
      assignee_name: 'Amit S.',
      source: 'Website',
      ai_score_breakdown: {
        "Buying Intent": 92,
        "Budget Confidence": 88
      }
    },
    {
      id: 'mock-lead-10',
      created_at: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
      name: 'Karan Johar',
      email: 'karan.j@example.com',
      phone: '+91 9333222111',
      status: 'qualified',
      probability: 99,
      revenue_potential: 8000000,
      budget_max: 8000000,
      budget: 7500000,
      decision_complexity: 'High',
      urgency: 'High',
      latitude: 12.9810,
      longitude: 77.6050,
      stage_id: 'stage-14',
      stage_name: 'Closing',
      stage_color: '#2D6A4F',
      score: 99,
      buying_intent: 'Hot',
      ai_recommendation: 'Collect token advance payment',
      assignee_id: 'mock-user-2',
      assignee_name: 'Amit S.',
      source: 'Referral',
      ai_score_breakdown: {
        "Buying Intent": 100,
        "Budget Confidence": 98
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
      is_scope_locked: true
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
      is_scope_locked: false
    }
  ],
  phases: [
    { id: 'mock-phase-1', project_id: 'mock-proj-1', name: 'Design & Concept', status: 'completed', is_execution: false, sort_order: 1 },
    { id: 'mock-phase-2', project_id: 'mock-proj-1', name: 'Procurement & Execution', status: 'in_progress', is_execution: true, sort_order: 2 },
    { id: 'mock-phase-3', project_id: 'mock-proj-2', name: 'Design & Concept', status: 'in_progress', is_execution: false, sort_order: 1 },
    { id: 'mock-phase-4', project_id: 'mock-proj-2', name: 'Procurement & Execution', status: 'pending', is_execution: true, sort_order: 2 }
  ],
  milestones: [
    { id: 'mock-m-1', phase_id: 'mock-phase-1', status: 'completed', name: 'Concept Drawings Approved' },
    { id: 'mock-m-2', phase_id: 'mock-phase-2', status: 'pending', name: 'Procurement List Approved' },
    { id: 'mock-m-3', phase_id: 'mock-phase-3', status: 'completed', name: 'Client Feedback Incorporated' },
    { id: 'mock-m-4', phase_id: 'mock-phase-4', status: 'pending', name: 'Site Handover' }
  ],
  documents: [
    { id: 'mock-doc-1', project_id: 'mock-proj-1', doc_type: 'contract', status: 'approved', name: 'Signed Client Contract' }
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
  users: [
    { id: 'mock-user-1', name: 'Rahul K.', role: 'project_manager' },
    { id: 'mock-user-2', name: 'Amit S.', role: 'sales_rep' },
    { id: 'mock-user-3', name: 'Priya M.', role: 'designer' }
  ],
  contacts: [
    {
      id: 'mock-contact-1',
      lead_id: 'mock-lead-1',
      name: 'Priya Sharma',
      phone: '+91 9876543211',
      email: 'priya.s@example.com',
      role: 'Spouse',
      decision_authority: 'Primary',
      relationship_notes: 'Highly interested in modular kitchen details.'
    }
  ],
  followups: [
    {
      id: 'mock-followup-1',
      lead_id: 'mock-lead-1',
      title: 'Call back to discuss modular kitchen',
      due_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      notes: 'Wants to see color samples.',
      is_done: false,
      done_at: null
    },
    {
      id: 'mock-followup-2',
      lead_id: 'mock-lead-1',
      title: 'Send initial quotation draft',
      due_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      notes: 'Based on 3BHK layout provided.',
      is_done: false,
      done_at: null
    }
  ],
  files: [
    {
      id: 'mock-file-1',
      lead_id: 'mock-lead-1',
      file_name: 'Floor_Plan_draft.pdf',
      file_size: 245310,
      mime_type: 'application/pdf',
      download_url: '#',
      storage_key: '#'
    }
  ],
  inspirations: [
    {
      id: 'mock-insp-1',
      lead_id: 'mock-lead-1',
      image_url: '/inspirations/modern_kitchen.png',
      room_type: 'Kitchen',
      notes: 'Sleek luxury modern kitchen with clean lines and warm LED lighting.'
    },
    {
      id: 'mock-insp-2',
      lead_id: 'mock-lead-1',
      image_url: '/inspirations/luxury_bedroom.png',
      room_type: 'Master Bedroom',
      notes: 'Japandi style master bedroom in warm earth tones and ambient lighting.'
    },
    {
      id: 'mock-insp-3',
      lead_id: 'mock-lead-1',
      image_url: '/inspirations/japandi_living.png',
      room_type: 'Living Room',
      notes: 'Minimal oak wood furniture and light textured plaster walls.'
    }
  ],
  activities: [
    {
      id: 'mock-act-1',
      lead_id: 'mock-lead-1',
      type: 'note',
      title: 'Initial contact notes',
      notes: 'Customer is looking for premium modular kitchen designs. Prefers warm lighting.',
      outcome: 'Interested',
      created_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
      user_name: 'Amit S.'
    },
    {
      id: 'mock-act-2',
      lead_id: 'mock-lead-1',
      type: 'call',
      title: 'Follow-up Call',
      notes: 'Called to discuss scheduling a site visit.',
      outcome: 'Site visit scheduled for next week',
      created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      user_name: 'Amit S.'
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
        if (merged.leads.length <= 2) {
          merged.leads = [...initialMockDatabase.leads];
        } else {
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
