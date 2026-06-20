const EventEmitter = require('events');

class EventBus extends EventEmitter {}

// Create a singleton instance
const eventBus = new EventBus();

module.exports = eventBus;
