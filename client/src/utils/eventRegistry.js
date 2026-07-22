class EventRegistry {
  constructor() {
    this.modules = new Map();
  }
  
  /**
   * Register a new module and its supported actions for webhooks.
   * @param {string} name - The display name of the module (e.g., 'Lead')
   * @param {string[]} actions - The list of actions supported (defaults to standard 5)
   */
  registerModule(name, actions = ['']) {
    this.modules.set(name, actions);
  }

  /**
   * Get formatted event groups for the UI
   */
  getEventGroups() {
    return Array.from(this.modules.entries()).map(([name, actions]) => ({
      label: `${name} Events`,
      events: actions.map(action => action ? `${name.toLowerCase()}.${action}` : name.toLowerCase())
    }));
  }

  /**
   * Get a flat list of all valid event strings
   */
  getAllEventNames() {
    let all = [];
    for (const [name, actions] of this.modules.entries()) {
      actions.forEach(action => all.push(action ? `${name.toLowerCase()}.${action}` : name.toLowerCase()));
    }
    return all;
  }
}

const eventRegistry = new EventRegistry();

// Pre-register all requested modules
const defaultModules = [
  'Customer', 
  'Lead', 
  'Project', 
  'Quotation', 
  'Invoice', 
  'Payment', 
  'Task', 
  'Vendor', 
  'Employee',
  'Budget',
  'ChangeOrder',
  'DesignReview',
  'Document',
  'Milestone',
  'Phase',
  'PurchaseOrder',
  'ServiceTicket',
  'Snag',
  'Warranty'
];

defaultModules.forEach(mod => {
  eventRegistry.registerModule(mod);
});

export default eventRegistry;
