const EventEmitter = require('events');

class EventBus extends EventEmitter {
  constructor() {
    super();
    // In a distributed setup, this could wrap Redis Pub/Sub or Kafka
    // For now, it's an in-memory event bus
  }

  /**
   * Publishes an event to the bus.
   * @param {string} eventName - e.g., 'lead.created', 'lead.stage_changed'
   * @param {object} payload - The event payload
   * @param {object} context - Tenant and User context { tenantId, userId }
   */
  publish(eventName, payload, context = {}) {
    const event = {
      eventId: require('crypto').randomUUID(),
      eventName,
      timestamp: new Date().toISOString(),
      payload,
      context
    };
    
    // Emit internally
    this.emit(eventName, event);
    
    // Also emit a catch-all event useful for generic dispatchers/loggers
    this.emit('*', event);
    
    console.log(`[EventBus] Published: ${eventName} for tenant ${context.tenantId || 'system'}`);
  }
}

const instance = new EventBus();

module.exports = instance;
