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
    this.updateModeExplanation();
  }

  initializeElements() {
    this.elements = {
      apiKey: document.getElementById('apiKey'),
      saveKey: document.getElementById('saveKey'),
      commentStyle: document.getElementById('commentStyle'),
      modeExplanation: document.getElementById('modeExplanation'),
      maxPosts: document.getElementById('maxPosts'),
      maxLikes: document.getElementById('maxLikes'),
      maxComments: document.getElementById('maxComments'),
      validationMsg: document.getElementById('validationMsg'),
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
  }

  async loadStoredData() {
    try {
      const result = await chrome.storage.sync.get([
        'openaiApiKey',
        'commentStyle',
        'maxPosts',
        'maxLikes',
        'maxComments',
        'delayMin',
        'delayMax',
        'stats',
        'globalLogs'
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

      // Auto-populate likes and comments based on max posts
      this.updateCountsFromMaxPosts();

      if (result.maxLikes) {
        this.elements.maxLikes.value = result.maxLikes;
      }

      if (result.maxComments) {
        this.elements.maxComments.value = result.maxComments;
      }

      if (result.delayMin) {
        this.elements.delayMin.value = result.delayMin;
      }

      if (result.delayMax) {
        this.elements.delayMax.value = result.delayMax;
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
    this.elements.commentStyle.addEventListener('change', () => {
      this.saveSettings();
      this.updateModeExplanation();
    });
    this.elements.maxPosts.addEventListener('change', () => {
      this.updateCountsFromMaxPosts();
      this.saveSettings();
    });
    this.elements.maxLikes.addEventListener('change', () => {
      this.validateCounts();
      this.saveSettings();
    });
    this.elements.maxComments.addEventListener('change', () => {
      this.validateCounts();
      this.saveSettings();
    });
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

  async saveSettings() {
    try {
      await chrome.storage.sync.set({
        commentStyle: this.elements.commentStyle.value,
        maxPosts: parseInt(this.elements.maxPosts.value),
        maxLikes: parseInt(this.elements.maxLikes.value),
        maxComments: parseInt(this.elements.maxComments.value),
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

    if (!this.validateCounts()) {
      this.addLog('Please fix the validation error before starting the bot', 'error');
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
      await chrome.tabs.sendMessage(tab.id, {
        type: 'START_BOT',
        config: {
          apiKey: apiKey,
          commentStyle: this.elements.commentStyle.value,
          maxPosts: parseInt(this.elements.maxPosts.value),
          enableLikes: true,
          enableComments: true,
          maxLikes: parseInt(this.elements.maxLikes.value),
          maxComments: parseInt(this.elements.maxComments.value),
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

  updateCountsFromMaxPosts() {
    const maxPosts = parseInt(this.elements.maxPosts.value);
    const half = Math.floor(maxPosts / 2);
    
    this.elements.maxLikes.value = half;
    this.elements.maxComments.value = maxPosts - half;
    
    this.validateCounts();
  }

  validateCounts() {
    const maxPosts = parseInt(this.elements.maxPosts.value);
    const maxLikes = parseInt(this.elements.maxLikes.value);
    const maxComments = parseInt(this.elements.maxComments.value);
    
    const total = maxLikes + maxComments;
    const validationMsg = this.elements.validationMsg;
    
    if (total !== maxPosts) {
      validationMsg.textContent = `Error: Likes (${maxLikes}) + Comments (${maxComments}) = ${total}, but should equal Max Posts (${maxPosts})`;
      validationMsg.classList.add('show');
      return false;
    } else {
      validationMsg.classList.remove('show');
      return true;
    }
  }

  updateModeExplanation() {
    const explanations = {
      'adaptive': '🎯 Elite Smart Adaptive performs deep content analysis, references specific details from posts, asks intelligent questions, shares micro-insights, and matches the author\'s professional level and emotional tone for highly personalized engagement.',
      'oneword': '💎 Advanced 1-Word Comments uses sophisticated vocabulary pools (Phenomenal, Revolutionary, Paradigm-shifting) based on industry context, achievement level, and author seniority. Never repeats words within a session.',
      'professional': '💼 Always Professional maintains formal business language with industry terminology for all posts.',
      'casual': '😊 Always Casual uses friendly, conversational tone while remaining professional.',
      'insightful': '🧠 Always Insightful provides thoughtful analysis with meaningful questions to encourage discussion.',
      'supportive': '❤️ Always Supportive focuses on encouragement and positive reinforcement for all posts.'
    };
    
    const style = this.elements.commentStyle.value;
    this.elements.modeExplanation.textContent = explanations[style] || explanations['adaptive'];
  }

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
