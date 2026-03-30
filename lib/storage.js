// =============================================
// Storage Helpers — chrome.storage.local wrapper
// =============================================

const Storage = {
  async get(keys) {
    return chrome.storage.local.get(keys);
  },

  async set(data) {
    return chrome.storage.local.set(data);
  },

  async remove(keys) {
    return chrome.storage.local.remove(keys);
  },

  async clear() {
    return chrome.storage.local.clear();
  },

  // Get a single key with default value
  async getValue(key, defaultVal = null) {
    const result = await chrome.storage.local.get(key);
    return result[key] !== undefined ? result[key] : defaultVal;
  },

  // Profile helpers
  async getProfile() {
    return this.getValue('profile', {});
  },

  async setProfile(profile) {
    return this.set({ profile });
  },

  // Saved fields helpers
  async getSavedFields() {
    return this.getValue('savedFields', []);
  },

  async setSavedFields(fields) {
    return this.set({ savedFields: fields });
  },

  // API key (simple storage — for encrypted version, see crypto.js)
  async getApiKey() {
    return this.getValue('apiKey', '');
  },

  async setApiKey(key) {
    return this.set({ apiKey: key });
  }
};

// Make available globally
if (typeof window !== 'undefined') window.Storage = Storage;
