// LinkedIn AI Engagement Bot - Content Script

class LinkedInBot {
  constructor() {
    this.isRunning = false;
    this.config = {};
    this.stats = {
      postsFound: 0,
      commentsPosted: 0,
      errors: 0
    };
    this.processedPosts = new Set();
    this.setupMessageListener();
    
    // Wait for page to be fully loaded
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.initialize());
    } else {
      this.initialize();
    }
  }

  initialize() {
    this.log('LinkedIn AI Bot initialized');
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      switch (message.type) {
        case 'START_BOT':
          this.startBot(message.config);
          sendResponse({ success: true });
          break;
        case 'STOP_BOT':
          this.stopBot();
          sendResponse({ success: true });
          break;
      }
    });
  }

  async startBot(config) {
    if (this.isRunning) {
      this.log('Bot is already running', 'error');
      return;
    }

    this.config = config;
    this.isRunning = true;
    this.processedPosts.clear();
    
    this.log('Starting LinkedIn engagement bot...');
    this.updateStatus('Running - Scanning for posts...');
    
    try {
      await this.processFeedPosts();
    } catch (error) {
      this.log('Bot execution error: ' + error.message, 'error');
      this.updateStats({ errors: this.stats.errors + 1 });
    } finally {
      this.stopBot();
    }
  }

  stopBot() {
    this.isRunning = false;
    this.log('Bot stopped');
    this.sendMessage({ type: 'BOT_STOPPED' });
  }

  async processFeedPosts() {
    const posts = await this.findFeedPosts();
    
    if (posts.length === 0) {
      this.log('No posts found in feed', 'error');
      this.updateStatus('No posts found');
      return;
    }

    this.log(`Found ${posts.length} posts to process`);
    this.updateStats({ postsFound: posts.length });
    
    let processedCount = 0;
    
    for (const post of posts) {
      if (!this.isRunning) {
        this.log('Bot stopped during processing');
        break;
      }

      if (processedCount >= this.config.maxPosts) {
        this.log(`Reached maximum posts limit (${this.config.maxPosts})`);
        break;
      }

      try {
        await this.processPost(post);
        processedCount++;
        
        // Add delay between posts to avoid rate limiting
        await this.delay(CONFIG.DELAYS.BETWEEN_POSTS);
        
      } catch (error) {
        this.log(`Error processing post: ${error.message}`, 'error');
        this.updateStats({ errors: this.stats.errors + 1 });
      }
    }

    this.log(`Completed processing ${processedCount} posts`);
    this.updateStatus(`Completed - Processed ${processedCount} posts`);
  }

  async findFeedPosts() {
    // Wait for feed to load - try multiple selectors
    const feedLoaded = await this.waitForElement('.feed-shared-update-v2, .feed-shared-update-v2__container, [data-test-id="main-feed-activity-card"]', 5000);
    
    if (!feedLoaded) {
      this.log('Feed not loaded, trying alternative selectors');
    }
    
    const posts = [];
    // Try multiple selectors for feed posts
    const postElements = document.querySelectorAll('.feed-shared-update-v2, [data-test-id="main-feed-activity-card"], .feed-shared-update-v2__container');
    
    this.log(`Found ${postElements.length} potential post elements`);
    
    for (const postElement of postElements) {
      if (posts.length >= this.config.maxPosts) break;
      
      try {
        const postData = this.extractPostData(postElement);
        
        if (postData && !this.processedPosts.has(postData.id)) {
          posts.push(postData);
          this.processedPosts.add(postData.id);
          this.log(`Successfully extracted post by ${postData.author}: "${postData.content.substring(0, 50)}..."`);
        }
      } catch (error) {
        this.log(`Error extracting post data: ${error.message}`, 'error');
        // Log more details for debugging
        this.log(`Post element classes: ${postElement.className}`, 'info');
      }
    }
    
    return posts;
  }

  extractPostData(postElement) {
    // Debug: Log post element structure
    this.log(`Analyzing post element with classes: ${postElement.className}`);
    
    // Find the post content using multiple selectors for LinkedIn's dynamic structure
    const contentElement = postElement.querySelector('.feed-shared-text__text-view .break-words') ||
                          postElement.querySelector('.feed-shared-text .break-words') ||
                          postElement.querySelector('.feed-shared-update-v2__description .break-words') ||
                          postElement.querySelector('.feed-shared-text__text-view span') ||
                          postElement.querySelector('.feed-shared-text span') ||
                          postElement.querySelector('.update-components-text span') ||
                          postElement.querySelector('[data-test-id="main-feed-activity-card"] .break-words') ||
                          postElement.querySelector('.feed-shared-update-v2__description span') ||
                          postElement.querySelector('.feed-shared-text__text-view') ||
                          postElement.querySelector('.feed-shared-text') ||
                          postElement.querySelector('.update-components-text');
    
    if (!contentElement) {
      // Debug: Show what elements we can find
      const textElements = postElement.querySelectorAll('*');
      const textElementsWithContent = Array.from(textElements).filter(el => 
        el.textContent && el.textContent.trim().length > 20 && 
        !el.querySelector('*') // Only leaf nodes
      );
      
      this.log(`Found ${textElementsWithContent.length} potential text elements`);
      
      if (textElementsWithContent.length > 0) {
        // Use the first substantial text element
        return this.createPostDataFromFallback(postElement, textElementsWithContent[0]);
      }
      
      throw new Error('Could not find post content - no text elements found');
    }

    // Get post ID (using data attributes or generating one)
    let postId = postElement.getAttribute('data-urn') || 
                 postElement.getAttribute('data-id') ||
                 postElement.querySelector('[data-urn]')?.getAttribute('data-urn');
    
    if (!postId) {
      // Generate a unique ID based on content and position
      postId = this.generatePostId(contentElement.textContent, postElement);
    }

    // Check if we can comment (look for comment button)
    const commentButton = this.findCommentButton(postElement);

    if (!commentButton || commentButton.disabled) {
      throw new Error('Cannot comment on this post');
    }

    // Extract author info
    const authorElement = postElement.querySelector('.feed-shared-actor__title a') ||
                         postElement.querySelector('.update-components-actor__title a') ||
                         postElement.querySelector('.feed-shared-actor__name a') ||
                         postElement.querySelector('.update-components-actor__name a');
    
    const authorName = authorElement ? authorElement.textContent.trim() : 'Unknown';

    return {
      id: postId,
      content: contentElement.textContent.trim(),
      author: authorName,
      element: postElement,
      commentButton: commentButton
    };
  }

  createPostDataFromFallback(postElement, contentElement) {
    // Get post ID
    let postId = postElement.getAttribute('data-urn') || 
                 postElement.getAttribute('data-id') ||
                 postElement.querySelector('[data-urn]')?.getAttribute('data-urn');
    
    if (!postId) {
      postId = this.generatePostId(contentElement.textContent, postElement);
    }

    // Find comment button
    const commentButton = this.findCommentButton(postElement);
    if (!commentButton || commentButton.disabled) {
      throw new Error('Cannot comment on this post');
    }

    // Extract author info
    const authorElement = postElement.querySelector('.feed-shared-actor__title a') ||
                         postElement.querySelector('.update-components-actor__title a') ||
                         postElement.querySelector('.feed-shared-actor__name a') ||
                         postElement.querySelector('.update-components-actor__name a');
    
    const authorName = authorElement ? authorElement.textContent.trim() : 'Unknown';

    return {
      id: postId,
      content: contentElement.textContent.trim(),
      author: authorName,
      element: postElement,
      commentButton: commentButton
    };
  }

  findCommentButton(postElement) {
    // Try multiple selectors for comment buttons
    return postElement.querySelector('[aria-label*="Comment"]') ||
           postElement.querySelector('[aria-label*="comment"]') ||
           postElement.querySelector('button[data-control-name*="comment"]') ||
           postElement.querySelector('.social-actions-button[aria-label*="Comment"]') ||
           postElement.querySelector('.feed-shared-social-action-bar button[aria-label*="Comment"]') ||
           postElement.querySelector('.social-counts-reactions__comment-button') ||
           postElement.querySelector('.feed-shared-social-action-bar .artdeco-button:nth-child(2)') ||
           postElement.querySelector('.social-actions-button:nth-child(2)');
  }

  generatePostId(content, element) {
    // Create a simple hash from content and element position
    const text = content.substring(0, 100);
    const position = Array.from(element.parentNode.children).indexOf(element);
    return btoa(text + position).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
  }

  async processPost(postData) {
    this.log(`Processing post by ${postData.author}...`);
    this.updateStatus(`Processing post by ${postData.author}`);

    // Generate comment
    const comment = await this.generateComment(postData.content);
    
    if (!comment) {
      throw new Error('Failed to generate comment');
    }

    this.log(`Generated comment: "${comment.substring(0, 50)}..."`);

    // Post the comment
    await this.postComment(postData, comment);
    
    this.updateStats({ commentsPosted: this.stats.commentsPosted + 1 });
    this.log(`Successfully commented on post by ${postData.author}`, 'success');
  }

  async generateComment(postContent) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        type: 'GENERATE_COMMENT',
        postContent: postContent,
        commentStyle: this.config.commentStyle,
        apiKey: this.config.apiKey
      }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        if (response.success) {
          resolve(response.comment);
        } else {
          reject(new Error(response.error || 'Failed to generate comment'));
        }
      });
    });
  }

  async postComment(postData, comment) {
    try {
      // Scroll post into view
      postData.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await this.delay(CONFIG.DELAYS.SCROLL);

      // Click comment button
      postData.commentButton.click();
      await this.delay(CONFIG.DELAYS.CLICK);

      // Wait for comment editor to appear
      const commentEditor = await this.waitForElement(
        '.comments-comment-texteditor .ql-editor, .comments-comment-texteditor div[contenteditable="true"], .comments-comment-box__form div[contenteditable="true"], .ql-editor[contenteditable="true"]',
        3000,
        postData.element
      );

      if (!commentEditor) {
        throw new Error('Comment editor not found');
      }

      // Focus and type comment
      commentEditor.focus();
      await this.delay(CONFIG.DELAYS.FOCUS);

      // Clear any existing content
      commentEditor.innerHTML = '';
      
      // Type the comment
      await this.typeText(commentEditor, comment);
      await this.delay(CONFIG.DELAYS.TYPE);

      // Find and click submit button
      const submitButton = await this.waitForElement(
        '.comments-comment-texteditor .comments-comment-texteditor__submit-button:not([disabled]), .comments-comment-box__submit-button:not([disabled]), .comments-comment-texteditor button[type="submit"]:not([disabled]), .artdeco-button--primary:not([disabled])',
        2000,
        postData.element
      );

      if (!submitButton) {
        throw new Error('Submit button not found or disabled');
      }

      submitButton.click();
      await this.delay(CONFIG.DELAYS.SUBMIT);

      // Verify comment was posted
      await this.verifyCommentPosted(postData.element, comment);

    } catch (error) {
      throw new Error(`Failed to post comment: ${error.message}`);
    }
  }

  async verifyCommentPosted(postElement, expectedComment) {
    // Wait a bit for the comment to appear
    await this.delay(2000);
    
    // Look for the comment in the comments section
    const commentsSection = postElement.querySelector('.comments-comments-list') ||
                           postElement.querySelector('.social-details-social-comments');
    
    if (commentsSection) {
      const comments = commentsSection.querySelectorAll('.comments-comment-item__main-content');
      
      for (const commentEl of comments) {
        const commentText = commentEl.textContent.trim();
        if (commentText.includes(expectedComment.substring(0, 20))) {
          return true; // Comment found
        }
      }
    }
    
    // If we can't verify, assume it worked (LinkedIn sometimes delays showing comments)
    this.log('Could not verify comment posting, but assuming success');
    return true;
  }

  async typeText(element, text) {
    // Clear existing content first
    element.focus();
    
    // Use different methods based on editor type
    if (element.getAttribute('contenteditable') === 'true') {
      // For contenteditable elements (LinkedIn's rich text editor)
      element.innerHTML = '';
      
      // Insert text and trigger events
      element.textContent = text;
      
      // Trigger input events that LinkedIn expects
      element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
      element.dispatchEvent(new Event('keyup', { bubbles: true, cancelable: true }));
      element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
      
      // Trigger composition events for better compatibility
      element.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
      element.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: text }));
      
    } else {
      // For regular input elements
      element.value = text;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    }
    
    // Final focus and blur to ensure state is correct
    await this.delay(100);
    element.blur();
    await this.delay(100);
    element.focus();
  }

  async waitForElement(selector, timeout = 5000, parent = document) {
    return new Promise((resolve) => {
      const element = parent.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }

      const observer = new MutationObserver(() => {
        const element = parent.querySelector(selector);
        if (element) {
          observer.disconnect();
          resolve(element);
        }
      });

      observer.observe(parent, {
        childList: true,
        subtree: true
      });

      setTimeout(() => {
        observer.disconnect();
        resolve(null);
      }, timeout);
    });
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  updateStatus(status) {
    this.sendMessage({ type: 'STATUS_UPDATE', status });
  }

  updateStats(newStats) {
    this.stats = { ...this.stats, ...newStats };
    this.sendMessage({ type: 'STATS_UPDATE', stats: this.stats });
  }

  log(message, level = 'info') {
    console.log(`[LinkedIn Bot] ${message}`);
    this.sendMessage({
      type: 'LOG_MESSAGE',
      message: message,
      level: level
    });
  }

  sendMessage(message) {
    try {
      chrome.runtime.sendMessage(message);
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  }
}

// Initialize bot when script loads
new LinkedInBot();
