const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  guildId: {
    type: String,
    required: true,
    unique: true
  },
  botActivity: {
    type: String,
    default: ''
  },
  dashboardSettings: {
    navName: {
      type: String,
      default: 'DrakoBot'
    },
    favicon: {
      type: String,
      default: 'None'
    },
    tabName: {
      type: String,
      default: 'DrakoBot Dashboard'
    },
    customNavItems: [{
      name: { type: String, required: true },
      href: { type: String, required: true },
      iconName: String,
      isExternal: { type: Boolean, default: false },
      id: String
    }],
    navCategories: {
      navigation: { type: String, default: 'Navigation' },
      custom: { type: String, default: 'Custom Links' },
      addons: { type: String, default: 'Addons' }
    }
  }
});

module.exports = mongoose.model('Settings', settingsSchema); 