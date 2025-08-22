// LinkedIn AI Engagement Bot - Content Script

class LinkedInBot {
  constructor() {
    this.isRunning = false;
    this.config = {};
    this.stats = {
      postsFound: 0,
      postsLiked: 0,
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
      console.log('[LinkedIn Bot] Received message:', message.type);
      
      try {
        switch (message.type) {
          case 'START_BOT':
            this.startBot(message.config);
            sendResponse({ success: true, message: 'Bot started successfully' });
            break;
          case 'STOP_BOT':
            this.stopBot();
            sendResponse({ success: true, message: 'Bot stopped successfully' });
            break;
          case 'PING':
            // Health check message
            sendResponse({ success: true, message: 'Content script is active' });
            break;
          default:
            sendResponse({ success: false, message: `Unknown message type: ${message.type}` });
        }
      } catch (error) {
        console.error('[LinkedIn Bot] Message handler error:', error);
        sendResponse({ success: false, message: error.message });
      }
      
      return true; // Keep message channel open for async operations
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
    
    let likesCount = 0;
    let commentsCount = 0;
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
        const actions = [];
        
        // Determine what actions to perform on this post
        if (this.config.enableLikes && likesCount < this.config.maxLikes) {
          actions.push('like');
        }
        
        if (this.config.enableComments && commentsCount < this.config.maxComments) {
          actions.push('comment');
        }

        if (actions.length === 0) {
          this.log('All action limits reached, stopping processing');
          break;
        }

        const result = await this.processPost(post, actions);
        
        if (result.liked) likesCount++;
        if (result.commented) commentsCount++;
        
        processedCount++;
        
        // Add random human-like delay between posts
        const delay = this.getRandomDelay();
        this.log(`Waiting ${delay}s before next post...`);
        await this.delay(delay * 1000);
        
      } catch (error) {
        this.log(`Error processing post: ${error.message}`, 'error');
        this.updateStats({ errors: this.stats.errors + 1 });
        
        // Add delay even on error to avoid rapid retries
        await this.delay(this.getRandomDelay() * 1000);
      }
    }

    this.log(`Completed processing ${processedCount} posts (${likesCount} liked, ${commentsCount} commented)`);
    this.updateStatus(`Completed - ${processedCount} processed, ${likesCount} liked, ${commentsCount} commented`);
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
    
    // Check if this is an ad or sponsored content
    const isAd = this.isAdvertisement(postElement);
    if (isAd) {
      throw new Error('Skipping advertisement/sponsored post');
    }
    
    // Check if already engaged with this post
    const alreadyEngaged = this.isAlreadyEngaged(postElement);
    if (alreadyEngaged.liked && alreadyEngaged.commented) {
      throw new Error('Already liked and commented on this post');
    }
    
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

    // Get engagement status
    const engagementStatus = this.isAlreadyEngaged(postElement);

    return {
      id: postId,
      content: contentElement.textContent.trim(),
      author: authorName,
      element: postElement,
      commentButton: commentButton,
      alreadyLiked: engagementStatus.liked,
      alreadyCommented: engagementStatus.commented
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

    // Get engagement status
    const engagementStatus = this.isAlreadyEngaged(postElement);

    return {
      id: postId,
      content: contentElement.textContent.trim(),
      author: authorName,
      element: postElement,
      commentButton: commentButton,
      alreadyLiked: engagementStatus.liked,
      alreadyCommented: engagementStatus.commented
    };
  }

  isAdvertisement(postElement) {
    // Check for sponsored content indicators
    const adIndicators = [
      'Sponsored',
      'Promoted',
      'Ad',
      'Advertisement',
      'sponsored',
      'promoted'
    ];
    
    // Check post text for ad indicators
    const postText = postElement.textContent.toLowerCase();
    const hasAdKeywords = adIndicators.some(indicator => 
      postText.includes(indicator.toLowerCase())
    );
    
    // Check for promoted post classes or attributes
    const hasAdClasses = postElement.querySelector('[aria-label*="Promoted"]') ||
                        postElement.querySelector('[aria-label*="Sponsored"]') ||
                        postElement.querySelector('.feed-shared-actor__sub-description') ||
                        postElement.classList.contains('promoted') ||
                        postElement.querySelector('.feed-shared-actor__description')?.textContent?.includes('Promoted');
    
    return hasAdKeywords || hasAdClasses;
  }

  isAlreadyEngaged(postElement) {
    // Check if already liked (liked button will have active/pressed state)
    const likeButton = postElement.querySelector('[data-control-name="like"]') ||
                      postElement.querySelector('button[aria-label*="like"]') ||
                      postElement.querySelector('.react-button__trigger');
    
    const alreadyLiked = likeButton && (
      likeButton.classList.contains('react-button__trigger--active') ||
      likeButton.classList.contains('reactions-react-button--active') ||
      likeButton.getAttribute('aria-pressed') === 'true' ||
      likeButton.querySelector('.reaction-button--active')
    );
    
    // Check if already commented (look for our previous comments)
    const commentSection = postElement.querySelector('.comments-comment-box') ||
                          postElement.querySelector('.social-details-social-counts');
    
    // Simple check - if we can see expanded comments, we might have commented
    const alreadyCommented = commentSection && 
      (commentSection.querySelector('.comments-comment-item') || 
       commentSection.textContent.includes('comment'));
    
    return {
      liked: !!alreadyLiked,
      commented: !!alreadyCommented
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

  findLikeButton(postElement) {
    // Try multiple selectors for like buttons
    return postElement.querySelector('[aria-label*="Like"]') ||
           postElement.querySelector('[aria-label*="like"]') ||
           postElement.querySelector('button[data-control-name*="like"]') ||
           postElement.querySelector('.social-actions-button[aria-label*="Like"]') ||
           postElement.querySelector('.feed-shared-social-action-bar button[aria-label*="Like"]') ||
           postElement.querySelector('.reactions-react-button') ||
           postElement.querySelector('.feed-shared-social-action-bar .artdeco-button:first-child') ||
           postElement.querySelector('.social-actions-button:first-child');
  }

  async likePost(postData) {
    try {
      const likeButton = this.findLikeButton(postData.element);
      
      if (!likeButton) {
        throw new Error('Like button not found');
      }

      // Check if already liked
      const isLiked = likeButton.getAttribute('aria-pressed') === 'true' ||
                     likeButton.classList.contains('artdeco-button--primary') ||
                     likeButton.querySelector('[data-test-icon="thumbs-up-filled-icon"]') ||
                     likeButton.textContent.toLowerCase().includes('liked');

      if (isLiked) {
        this.log(`Post by ${postData.author} already liked, skipping`);
        return;
      }

      // Click the like button
      likeButton.click();
      await this.delay(this.getRandomDelay(0.3, 1) * 1000);

      // Verify the like was successful
      const nowLiked = likeButton.getAttribute('aria-pressed') === 'true' ||
                      likeButton.classList.contains('artdeco-button--primary') ||
                      likeButton.querySelector('[data-test-icon="thumbs-up-filled-icon"]');

      if (!nowLiked) {
        this.log(`Warning: Could not verify like on post by ${postData.author}`);
      }

    } catch (error) {
      throw new Error(`Failed to like post: ${error.message}`);
    }
  }

  getRandomDelay(min = null, max = null) {
    // Use config delays if no specific range provided
    const minDelay = min !== null ? min : this.config.delayMin || 2;
    const maxDelay = max !== null ? max : this.config.delayMax || 8;
    
    // Generate random delay between min and max
    return Math.random() * (maxDelay - minDelay) + minDelay;
  }

  generatePostId(content, element) {
    // Create a simple hash from content and element position
    const text = content.substring(0, 100);
    const position = Array.from(element.parentNode.children).indexOf(element);
    return btoa(text + position).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
  }

  async processPost(postData, actions) {
    this.log(`Processing post by ${postData.author} (${actions.join(', ')})...`);
    this.updateStatus(`Processing post by ${postData.author}`);

    const result = { liked: false, commented: false };

    // Scroll to post
    postData.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await this.delay(this.getRandomDelay(1, 2) * 1000);

    // Process actions in random order to appear more human
    const shuffledActions = [...actions].sort(() => Math.random() - 0.5);

    for (const action of shuffledActions) {
      if (!this.isRunning) break;

      try {
        if (action === 'like' && !postData.alreadyLiked) {
          await this.likePost(postData);
          result.liked = true;
          this.updateStats({ postsLiked: this.stats.postsLiked + 1 });
          this.log(`✓ Liked post by ${postData.author}`, 'success');
          
          // Random delay between actions
          if (shuffledActions.length > 1) {
            await this.delay(this.getRandomDelay(0.5, 2) * 1000);
          }
        } else if (action === 'like' && postData.alreadyLiked) {
          this.log(`⏭️ Already liked post by ${postData.author}`, 'info');
        }

        if (action === 'comment' && !postData.alreadyCommented) {
          const commentResult = await this.generateComment(postData.content);
          
          if (commentResult && commentResult.skip) {
            this.log(`⏭️ Skipped post by ${postData.author}: ${commentResult.reason}`, 'info');
          } else if (commentResult && commentResult.comment) {
            await this.postComment(postData, commentResult.comment);
            result.commented = true;
            this.updateStats({ commentsPosted: this.stats.commentsPosted + 1 });
            this.log(`✓ Commented on post by ${postData.author}: "${commentResult.comment.substring(0, 30)}..."`, 'success');
          } else {
            this.log(`Failed to generate comment for post by ${postData.author}`, 'error');
          }
        }
      } catch (error) {
        this.log(`Error with ${action} on post by ${postData.author}: ${error.message}`, 'error');
      }
    }

    return result;
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
          resolve(response.result);
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
