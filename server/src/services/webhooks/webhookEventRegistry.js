/**
 * Backend Webhook Event Registry
 * Allows any CRM module to register events dynamically on startup.
 */
class WebhookEventRegistry {
  constructor() {
    this.groups = {};
    this.events = {};
  }

  /**
   * Registers an event group (e.g. 'Customer', 'Invoice')
   */
  registerGroup(groupId, label) {
    if (!this.groups[groupId]) {
      this.groups[groupId] = { id: groupId, label, events: [] };
    }
  }

  /**
   * Registers a specific event (e.g. 'customer.created')
   */
  registerEvent(groupId, eventId, label, samplePayload = {}) {
    if (!this.groups[groupId]) {
      this.registerGroup(groupId, groupId.charAt(0).toUpperCase() + groupId.slice(1));
    }
    
    const eventObj = { id: eventId, label, samplePayload };
    this.events[eventId] = eventObj;
    this.groups[groupId].events.push(eventObj);
  }

  /**
   * Gets all registered events grouped by their group
   */
  getAvailableEvents() {
    return this.groups;
  }

  /**
   * Gets the sample payload for a specific event
   */
  getSamplePayload(eventId) {
    return this.events[eventId] ? this.events[eventId].samplePayload : {};
  }
}

// Export singleton instance
module.exports = new WebhookEventRegistry();
