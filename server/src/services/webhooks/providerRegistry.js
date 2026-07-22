const standardProvider = require('./providers/StandardProvider');
const slackProvider = require('./providers/SlackProvider');

class ProviderRegistry {
  constructor() {
    this.providers = {
      'standard': standardProvider,
      'slack': slackProvider
      // Future integrations like 'teams', 'zapier' can be registered here.
    };
  }

  /**
   * Returns the provider instance for the given integration type.
   * Defaults to 'standard' if the type is unknown or missing.
   */
  getProvider(integrationType) {
    const type = integrationType ? integrationType.toLowerCase() : 'standard';
    return this.providers[type] || this.providers['standard'];
  }
}

module.exports = new ProviderRegistry();
