// LinkedIn AI Engagement Bot - Popup Script

class PopupController {
  constructor() {
    this.isRunning = false;
    this.stats = {
      postsFound: 0,
      commentsPosted: 0,
      errors: 0
    };
    
    this.initializeElements();
    this.loadStoredData();
    this.setupEventListeners();
    this.setupMessageListener();
  }

  initializeElements() {
    this.elements = {
      apiKey: document.getElementById('apiKey'),
      saveKey: document.getElementById('saveKey'),
      commentStyle: document.getElementById('commentStyle'),
      maxPosts: document.getElementById('maxPosts'),
      startBot: document.getElementById('startBot'),
      stopBot: document.getElementById('stopBot'),
      status: document.getElementById('status'),
      postsFound: document.getElementById('postsFound'),
      commentsPosted: document.getElementById('commentsPosted'),
      errors: document.getElementById('errors'),
      logContainer: document.getElementById('logContainer')
    };
  }

  async loadStoredData() {
    try {
      const result = await chrome.storage.sync.get([
        'openaiApiKey',
        'commentStyle',
        'maxPosts',
        'stats'
      ]);

      if (result.openaiApiKey) {
        this.elements.apiKey.value = result.openaiApiKey;
      }

      if (result.commentStyle) {
        this.elements.commentStyle.value = result.commentStyle;
      }

      if (result.maxPosts) {
        this.elements.maxPosts.value = result.maxPosts;
      }

      if (result.stats) {
        this.stats = { ...this.stats, ...result.stats };
        this.updateStatsDisplay();
      }
    } catch (error) {
      this.addLog('Error loading stored data: ' + error.message, 'error');
    }
  }

  setupEventListeners() {
    this.elements.saveKey.addEventListener('click', () => this.saveApiKey());
    this.elements.startBot.addEventListener('click', () => this.startBot());
    this.elements.stopBot.addEventListener('click', () => this.stopBot());
    
    // Save settings on change
    this.elements.commentStyle.addEventListener('change', () => this.saveSettings());
    this.elements.maxPosts.addEventListener('change', () => this.saveSettings());
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      switch (message.type) {
        case 'STATUS_UPDATE':
          this.updateStatus(message.status);
          break;
        case 'STATS_UPDATE':
          this.updateStats(message.stats);
          break;
        case 'LOG_MESSAGE':
          this.addLog(message.message, message.level);
          break;
        case 'BOT_STOPPED':
          this.handleBotStopped();
          break;
      }
    });
  }

  async saveApiKey() {
    const apiKey = this.elements.apiKey.value.trim();
    
    if (!apiKey) {
      this.addLog('Please enter a valid OpenAI API key', 'error');
      return;
    }

    if (!apiKey.startsWith('sk-')) {
      this.addLog('Invalid OpenAI API key format', 'error');
      return;
    }

    try {
      await chrome.storage.sync.set({ openaiApiKey: apiKey });
      this.addLog('API key saved successfully', 'success');
    } catch (error) {
      this.addLog('Error saving API key: ' + error.message, 'error');
    }
  }

  async saveSettings() {
    try {
      await chrome.storage.sync.set({
        commentStyle: this.elements.commentStyle.value,
        maxPosts: parseInt(this.elements.maxPosts.value)
      });
    } catch (error) {
      this.addLog('Error saving settings: ' + error.message, 'error');
    }
  }

  async startBot() {
    const apiKey = this.elements.apiKey.value.trim();
    
    if (!apiKey || !apiKey.startsWith('sk-')) {
      this.addLog('Please save a valid OpenAI API key first', 'error');
      return;
    }

    try {
      // Get current active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab.url.includes('linkedin.com')) {
        this.addLog('Please navigate to LinkedIn first', 'error');
        return;
      }

      // Send start message to content script
      await chrome.tabs.sendMessage(tab.id, {
        type: 'START_BOT',
        config: {
          apiKey: apiKey,
          commentStyle: this.elements.commentStyle.value,
          maxPosts: parseInt(this.elements.maxPosts.value)
        }
      });

      this.isRunning = true;
      this.updateUIState();
      this.updateStatus('Starting bot...');
      this.addLog('Bot started successfully', 'success');
      
    } catch (error) {
      this.addLog('Error starting bot: ' + error.message, 'error');
    }
  }

  async stopBot() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      await chrome.tabs.sendMessage(tab.id, { type: 'STOP_BOT' });
      
      this.handleBotStopped();
      this.addLog('Bot stopped', 'success');
      
    } catch (error) {
      this.addLog('Error stopping bot: ' + error.message, 'error');
      this.handleBotStopped(); // Force stop UI state
    }
  }

  handleBotStopped() {
    this.isRunning = false;
    this.updateUIState();
    this.updateStatus('Ready');
  }

  updateUIState() {
    this.elements.startBot.disabled = this.isRunning;
    this.elements.stopBot.disabled = !this.isRunning;
    this.elements.apiKey.disabled = this.isRunning;
    this.elements.commentStyle.disabled = this.isRunning;
    this.elements.maxPosts.disabled = this.isRunning;
  }

  updateStatus(status) {
    this.elements.status.textContent = status;
    this.elements.status.className = 'status';
    
    if (status.toLowerCase().includes('error')) {
      this.elements.status.classList.add('error');
    } else if (status.toLowerCase().includes('running') || status.toLowerCase().includes('processing')) {
      this.elements.status.classList.add('running');
    }
  }

  updateStats(newStats) {
    this.stats = { ...this.stats, ...newStats };
    this.updateStatsDisplay();
    this.saveStatsToStorage();
  }

  updateStatsDisplay() {
    this.elements.postsFound.textContent = this.stats.postsFound || 0;
    this.elements.commentsPosted.textContent = this.stats.commentsPosted || 0;
    this.elements.errors.textContent = this.stats.errors || 0;
  }

  async saveStatsToStorage() {
    try {
      await chrome.storage.sync.set({ stats: this.stats });
    } catch (error) {
      console.error('Error saving stats:', error);
    }
  }

  addLog(message, level = 'info') {
    const logEntry = document.createElement('div');
    logEntry.className = 'log-entry';
    
    const time = new Date().toLocaleTimeString();
    const timeSpan = document.createElement('span');
    timeSpan.className = 'log-time';
    timeSpan.textContent = `[${time}] `;
    
    const messageSpan = document.createElement('span');
    messageSpan.textContent = message;
    
    if (level === 'error') {
      messageSpan.className = 'log-error';
    } else if (level === 'success') {
      messageSpan.className = 'log-success';
    }
    
    logEntry.appendChild(timeSpan);
    logEntry.appendChild(messageSpan);
    
    this.elements.logContainer.appendChild(logEntry);
    this.elements.logContainer.scrollTop = this.elements.logContainer.scrollHeight;
    
    // Keep only last 50 entries
    while (this.elements.logContainer.children.length > 50) {
      this.elements.logContainer.removeChild(this.elements.logContainer.firstChild);
    }
  }
}

// Initialize popup controller when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});
