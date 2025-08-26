// LinkedIn AI Engagement Bot - Popup Script

class PopupController {
  constructor() {
    this.isRunning = false;
    this.stats = {
      postsFound: 0,
      postsLiked: 0,
      commentsPosted: 0,
      errors: 0
    };
    this.globalLogs = [];
    
    this.initializeElements();
    this.loadStoredData();
    this.setupEventListeners();
    this.setupMessageListener();
  }

  initializeElements() {
    this.elements = {
      apiKey: document.getElementById('apiKey'),
      saveKey: document.getElementById('saveKey'),
      maxPosts: document.getElementById('maxPosts'),
      maxLikes: document.getElementById('maxLikes'),
      singleWordComments: document.getElementById('singleWordComments'),
      adaptiveComments: document.getElementById('adaptiveComments'),
      resetSplit: document.getElementById('resetSplit'),
      splitSubtitle: document.getElementById('splitSubtitle'),
      splitError: document.getElementById('splitError'),
      splitTotal: document.getElementById('splitTotal'),
      delayMin: document.getElementById('delayMin'),
      delayMax: document.getElementById('delayMax'),
      startBot: document.getElementById('startBot'),
      stopBot: document.getElementById('stopBot'),
      downloadLogs: document.getElementById('downloadLogs'),
      status: document.getElementById('status'),
      postsFound: document.getElementById('postsFound'),
      postsLiked: document.getElementById('postsLiked'),
      commentsPosted: document.getElementById('commentsPosted'),
      errors: document.getElementById('errors'),
      logContainer: document.getElementById('logContainer')
    };
    
    // Initialize split state
    this.isSplitOverridden = false;
  }

  async loadStoredData() {
    try {
      const result = await chrome.storage.sync.get([
        'openaiApiKey',
        'maxPosts',
        'maxLikes',
        'singleWordComments',
        'adaptiveComments', 
        'isSplitOverridden',
        'delayMin',
        'delayMax',
        'stats',
        'globalLogs'
      ]);

      if (result.openaiApiKey) {
        this.elements.apiKey.value = result.openaiApiKey;
      }

      if (result.maxPosts) {
        this.elements.maxPosts.value = result.maxPosts;
      }

      if (result.maxLikes) {
        this.elements.maxLikes.value = result.maxLikes;
      }

      if (result.delayMin) {
        this.elements.delayMin.value = result.delayMin;
      }

      if (result.delayMax) {
        this.elements.delayMax.value = result.delayMax;
      }

      // Load split state
      this.isSplitOverridden = result.isSplitOverridden || false;
      
      if (this.isSplitOverridden && result.singleWordComments !== undefined && result.adaptiveComments !== undefined) {
        this.elements.singleWordComments.value = result.singleWordComments;
        this.elements.adaptiveComments.value = result.adaptiveComments;
        this.updateSplitDisplay();
      } else {
        // Calculate default 70/30 split
        this.applyDefaultSplit();
      }

      if (result.stats) {
        this.stats = { ...this.stats, ...result.stats };
        this.updateStatsDisplay();
      }

      if (result.globalLogs) {
        this.globalLogs = result.globalLogs || [];
      }
    } catch (error) {
      this.addLog('Error loading stored data: ' + error.message, 'error');
    }
  }

  setupEventListeners() {
    this.elements.saveKey.addEventListener('click', () => this.saveApiKey());
    this.elements.startBot.addEventListener('click', () => this.startBot());
    this.elements.stopBot.addEventListener('click', () => this.stopBot());
    this.elements.downloadLogs.addEventListener('click', () => this.downloadGlobalLogs());
    
    // Save settings on change
    this.elements.maxPosts.addEventListener('input', () => {
      if (!this.isSplitOverridden) {
        this.applyDefaultSplit();
      } else {
        this.validateSplitInputs();
      }
      this.saveSettings();
    });
    
    // Comment split event listeners
    this.elements.singleWordComments.addEventListener('input', (e) => {
      this.isSplitOverridden = true;
      this.updateSplitSubtitle();
      this.handleSplitChange('single', parseInt(e.target.value) || 0);
    });
    
    this.elements.adaptiveComments.addEventListener('input', (e) => {
      this.isSplitOverridden = true;
      this.updateSplitSubtitle();
      this.handleSplitChange('adaptive', parseInt(e.target.value) || 0);
    });
    
    this.elements.resetSplit.addEventListener('click', () => {
      this.resetToDefaultSplit();
    });
    
    this.elements.maxLikes.addEventListener('change', () => this.saveSettings());
    this.elements.delayMin.addEventListener('change', () => this.saveSettings());
    this.elements.delayMax.addEventListener('change', () => this.saveSettings());
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

  // Comment Split Logic Methods
  applyDefaultSplit() {
    const totalPosts = parseInt(this.elements.maxPosts.value) || 10;
    const singleWordCount = Math.ceil(totalPosts * 0.7);
    const adaptiveCount = totalPosts - singleWordCount;
    
    this.elements.singleWordComments.value = singleWordCount;
    this.elements.adaptiveComments.value = adaptiveCount;
    
    this.isSplitOverridden = false;
    this.updateSplitDisplay();
    this.updateSplitSubtitle();
    this.clearSplitError();
    this.saveSettings();
  }
  
  resetToDefaultSplit() {
    this.applyDefaultSplit();
    this.addLog('Comment split reset to default 70/30 distribution', 'success');
  }
  
  handleSplitChange(changedField, newValue) {
    const totalPosts = parseInt(this.elements.maxPosts.value) || 10;
    const currentSingle = parseInt(this.elements.singleWordComments.value) || 0;
    const currentAdaptive = parseInt(this.elements.adaptiveComments.value) || 0;
    
    // Validate bounds
    if (newValue < 0) {
      newValue = 0;
    } else if (newValue > totalPosts) {
      newValue = totalPosts;
    }
    
    // Auto-adjust the other field
    if (changedField === 'single') {
      const adaptiveValue = totalPosts - newValue;
      this.elements.singleWordComments.value = newValue;
      this.elements.adaptiveComments.value = adaptiveValue;
    } else {
      const singleValue = totalPosts - newValue;
      this.elements.adaptiveComments.value = newValue;
      this.elements.singleWordComments.value = singleValue;
    }
    
    this.validateSplitInputs();
    this.updateSplitDisplay();
    this.saveSettings();
  }
  
  validateSplitInputs() {
    const totalPosts = parseInt(this.elements.maxPosts.value) || 10;
    const singleWordCount = parseInt(this.elements.singleWordComments.value) || 0;
    const adaptiveCount = parseInt(this.elements.adaptiveComments.value) || 0;
    const sum = singleWordCount + adaptiveCount;
    
    // Clear previous validation styles
    this.elements.singleWordComments.classList.remove('error', 'success');
    this.elements.adaptiveComments.classList.remove('error', 'success');
    
    if (sum !== totalPosts) {
      this.showSplitError(`Values must add up to ${totalPosts} total posts (currently: ${sum})`);
      this.elements.singleWordComments.classList.add('error');
      this.elements.adaptiveComments.classList.add('error');
      return false;
    } else if (singleWordCount < 0 || adaptiveCount < 0) {
      this.showSplitError('Values cannot be negative');
      if (singleWordCount < 0) this.elements.singleWordComments.classList.add('error');
      if (adaptiveCount < 0) this.elements.adaptiveComments.classList.add('error');
      return false;
    } else {
      this.clearSplitError();
      this.elements.singleWordComments.classList.add('success');
      this.elements.adaptiveComments.classList.add('success');
      return true;
    }
  }
  
  updateSplitDisplay() {
    const singleWordCount = parseInt(this.elements.singleWordComments.value) || 0;
    const adaptiveCount = parseInt(this.elements.adaptiveComments.value) || 0;
    const total = singleWordCount + adaptiveCount;
    
    this.elements.splitTotal.textContent = total;
  }
  
  updateSplitSubtitle() {
    if (this.isSplitOverridden) {
      this.elements.splitSubtitle.textContent = "Custom: User-defined split";
      this.elements.splitSubtitle.style.color = "#ea580c";
      this.elements.splitSubtitle.style.backgroundColor = "rgba(249, 115, 22, 0.1)";
      this.elements.splitSubtitle.style.borderColor = "rgba(249, 115, 22, 0.3)";
    } else {
      this.elements.splitSubtitle.textContent = "Auto: 70% Quick, 30% Smart";
      this.elements.splitSubtitle.style.color = "#3b82f6";
      this.elements.splitSubtitle.style.backgroundColor = "rgba(59, 130, 246, 0.1)";
      this.elements.splitSubtitle.style.borderColor = "rgba(59, 130, 246, 0.3)";
    }
  }
  
  showSplitError(message) {
    this.elements.splitError.textContent = message;
    this.elements.splitError.classList.add('show');
  }
  
  clearSplitError() {
    this.elements.splitError.classList.remove('show');
  }

  async saveSettings() {
    try {
      await chrome.storage.sync.set({
        maxPosts: parseInt(this.elements.maxPosts.value),
        maxLikes: parseInt(this.elements.maxLikes.value),
        singleWordComments: parseInt(this.elements.singleWordComments.value),
        adaptiveComments: parseInt(this.elements.adaptiveComments.value),
        isSplitOverridden: this.isSplitOverridden,
        delayMin: parseInt(this.elements.delayMin.value),
        delayMax: parseInt(this.elements.delayMax.value)
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

      // Ensure content script is injected and ready
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['config.js', 'content.js']
        });
        
        // Small delay to ensure script initialization
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (scriptError) {
        // Content script might already be loaded, continue
        console.log('Content script injection result:', scriptError.message);
      }

      // Test connection with ping
      try {
        await chrome.tabs.sendMessage(tab.id, { type: 'PING' });
      } catch (pingError) {
        throw new Error('Content script not responding. Please refresh the LinkedIn page and try again.');
      }

      // Send start message to content script
      const maxPosts = parseInt(this.elements.maxPosts.value);
      const singleWordCount = parseInt(this.elements.singleWordComments.value);
      const adaptiveCount = parseInt(this.elements.adaptiveComments.value);
      
      await chrome.tabs.sendMessage(tab.id, {
        type: 'START_BOT',
        config: {
          apiKey: apiKey,
          maxPosts: maxPosts,
          enableLikes: true,
          enableComments: true,
          maxLikes: parseInt(this.elements.maxLikes.value),
          maxComments: maxPosts, // Total comments = total posts to process
          singleWordComments: singleWordCount,
          adaptiveComments: adaptiveCount,
          delayMin: parseInt(this.elements.delayMin.value),
          delayMax: parseInt(this.elements.delayMax.value)
        }
      });

      this.isRunning = true;
      this.updateUIState();
      this.updateStatus('Starting bot...');
      this.clearCurrentLogs(); // Clear UI logs but keep global logs
      this.addLog('Bot started successfully', 'success');
      
    } catch (error) {
      this.addLog('Error starting bot: ' + error.message, 'error');
    }
  }

  async stopBot() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      try {
        await chrome.tabs.sendMessage(tab.id, { type: 'STOP_BOT' });
      } catch (messageError) {
        // Content script might not be responsive, that's ok
        console.log('Stop message result:', messageError.message);
      }
      
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
    this.elements.postsLiked.textContent = this.stats.postsLiked || 0;
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
    const timestamp = new Date();
    const timeStr = timestamp.toLocaleTimeString();
    
    // Add to global logs with full timestamp
    this.globalLogs.push({
      timestamp: timestamp.toISOString(),
      time: timeStr,
      message: message,
      level: level
    });
    
    // Save global logs to storage
    this.saveGlobalLogs();
    
    // Display in UI
    const logEntry = document.createElement('div');
    logEntry.className = 'log-entry';
    
    const timeSpan = document.createElement('span');
    timeSpan.className = 'log-time';
    timeSpan.textContent = `[${timeStr}] `;
    
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
    
    // Keep only last 50 entries in UI
    while (this.elements.logContainer.children.length > 50) {
      this.elements.logContainer.removeChild(this.elements.logContainer.firstChild);
    }
  }

  // Removed - replaced with applyDefaultSplit() method above

  clearCurrentLogs() {
    this.elements.logContainer.innerHTML = '';
  }

  async saveGlobalLogs() {
    try {
      // Keep only last 1000 logs to prevent storage overflow
      if (this.globalLogs.length > 1000) {
        this.globalLogs = this.globalLogs.slice(-1000);
      }
      
      await chrome.storage.sync.set({ globalLogs: this.globalLogs });
    } catch (error) {
      console.error('Error saving global logs:', error);
    }
  }

  downloadGlobalLogs() {
    if (this.globalLogs.length === 0) {
      this.addLog('No logs available to download', 'info');
      return;
    }
    
    // Create downloadable content
    const logContent = this.globalLogs.map(log => 
      `${log.timestamp} [${log.level.toUpperCase()}] ${log.message}`
    ).join('\\n');
    
    // Create and trigger download
    const blob = new Blob([logContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `linkedin-bot-logs-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    this.addLog(`Downloaded ${this.globalLogs.length} log entries`, 'success');
  }
}

// Initialize popup controller when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});
