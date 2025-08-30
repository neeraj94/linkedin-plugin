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
    this.processedPostsEngagement = new Map(); // Track what we've done to each post
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
          case 'CONNECT_TOP_INFLUENCERS':
            this.connectTopInfluencers()
              .then(() => sendResponse({ success: true, message: 'Connection requests sent' }))
              .catch(error => sendResponse({ success: false, message: error.message }));
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
    
    // Initialize engagement tracking map
    if (!this.processedPostsEngagement) {
      this.processedPostsEngagement = new Map();
    }
    this.processedPostsEngagement.clear();
    
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

  async connectTopInfluencers() {
    this.log('Searching for top influencers...');
    try {
      const posts = document.querySelectorAll('article, div.feed-shared-update-v2');
      const candidates = [];

      posts.forEach(post => {
        const buttons = Array.from(post.querySelectorAll('button'));
        const connectBtn = buttons.find(btn => {
          const text = btn.textContent.trim();
          const label = btn.getAttribute('aria-label') || '';
          return text === 'Connect' || label.includes('Connect');
        });
        if (!connectBtn) return;

        let reactions = 0;
        const reactionEl = post.querySelector('.social-details-social-counts__reactions-count, span[aria-label*=" reactions"]');
        if (reactionEl) {
          const match = reactionEl.innerText.replace(/,/g, '').match(/\d+/);
          if (match) reactions = parseInt(match[0], 10);
        }
        candidates.push({ button: connectBtn, reactions });
      });

      if (candidates.length === 0) {
        this.log('No influencers found to connect', 'error');
        throw new Error('No influencers found');
      }

      candidates.sort((a, b) => b.reactions - a.reactions);
      const topTen = candidates.slice(0, 10);

      for (const inf of topTen) {
        inf.button.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await this.delay(this.getRandomDelay(1, 2) * 1000);
        inf.button.click();

        const sendBtn = await this.waitForElement("button[aria-label='Send now']", 3000);
        if (sendBtn) {
          await this.delay(200);
          sendBtn.click();
        }

        await this.delay(this.getRandomDelay(1, 2) * 1000);
      }

      this.log(`Sent connection requests to ${topTen.length} influencers`, 'success');
    } catch (error) {
      this.log('Influencer connection error: ' + error.message, 'error');
      throw error;
    }
  }

  async processFeedPosts() {
    this.log('Starting sequential post-by-post processing...');
    this.updateStatus('Processing posts one by one...');
    
    let likesCount = 0;
    let commentsCount = 0;
    let singleWordCommentCount = 0;
    let adaptiveCommentCount = 0;
    let postsExamined = 0;
    let skippedCount = 0;
    
    // Track targets
    const targetLikes = this.config.maxLikes || 0;
    const targetComments = this.config.maxComments || 0;
    const targetSingleWord = this.config.singleWordComments || 0;
    const targetAdaptive = this.config.adaptiveComments || 0;
    
    this.log(`Targets: ${targetLikes} likes, ${targetComments} comments (${targetSingleWord} single-word + ${targetAdaptive} adaptive)`);
    
    // Start from the current position and process posts as we encounter them
    let scrollAttempts = 0;
    const maxScrollAttempts = 10; // Allow more scrolling for sequential processing
    
    while (this.isRunning && scrollAttempts < maxScrollAttempts) {
      // Find posts currently visible on screen
      const visiblePosts = this.findCurrentlyVisiblePosts();
      
      if (visiblePosts.length === 0) {
        this.log('No visible posts found, scrolling to load more...');
        await this.scrollToLoadMorePosts();
        scrollAttempts++;
        continue;
      }
      
      let processedInThisBatch = false;
      
      // Process each visible post
      for (const postElement of visiblePosts) {
        if (!this.isRunning) break;
        
        // Check if we've reached all our targets
        if (likesCount >= targetLikes && commentsCount >= targetComments) {
          this.log('All targets reached!');
          this.isRunning = false;
          break;
        }
        
        try {
          // Extract post data
          const postData = this.extractPostData(postElement);
          
          if (!postData || this.processedPosts.has(postData.id)) {
            continue; // Skip if we can't extract data or already processed
          }
          
          postsExamined++;
          this.processedPosts.add(postData.id);
          
          this.log(`Examining post ${postsExamined} by ${postData.author}`);
          
          // Check if post is an advertisement first
          if (this.isAdvertisement(postElement)) {
            this.log(`Skipping advertisement/sponsored post by ${postData.author}`, 'info');
            skippedCount++;
            continue;
          }
          
          // Log engagement status
          if (postData.alreadyLiked) {
            this.log(`Post by ${postData.author} already liked - skipping like action`, 'info');
          }
          if (postData.alreadyCommented) {
            this.log(`Post by ${postData.author} already commented - skipping comment action`, 'info');
          }
          
          // Determine what actions to take randomly but respecting quotas and engagement status
          const actions = this.determineRandomActions(postData, {
            likesCount,
            commentsCount,
            singleWordCommentCount,
            adaptiveCommentCount,
            targetLikes,
            targetComments,
            targetSingleWord,
            targetAdaptive
          });
          
          if (actions.length === 0) {
            let skipReason = 'No actions available - ';
            const reasons = [];
            
            if (postData.alreadyLiked && postData.alreadyCommented) {
              reasons.push('already liked and commented');
            } else if (postData.alreadyLiked) {
              reasons.push('already liked');
            } else if (postData.alreadyCommented) {
              reasons.push('already commented');
            }
            
            if (likesCount >= targetLikes && commentsCount >= targetComments) {
              reasons.push('all quotas reached');
            } else if (likesCount >= targetLikes) {
              reasons.push('like quota reached');
            } else if (commentsCount >= targetComments) {
              reasons.push('comment quota reached');
            }
            
            skipReason += reasons.join(', ');
            this.log(`Skipping post by ${postData.author}: ${skipReason}`, 'info');
            skippedCount++;
            continue;
          }
          
          // FINAL SAFETY CHECK - re-validate engagement before processing
          const finalEngagement = this.isAlreadyEngaged(postElement);
          if (finalEngagement.liked || finalEngagement.commented) {
            this.log(`⚠️ FINAL CHECK: Post by ${postData.author} shows engagement - ABORTING all actions`, 'warning');
            skippedCount++;
            continue;
          }
          
          // Process the post with determined actions
          const result = await this.processPostSequentially(postData, actions);
          
          if (result.liked) {
            likesCount++;
            this.log(`✓ Liked post ${likesCount}/${targetLikes} by ${postData.author}`);
            
            // Track this post as liked in our memory
            if (!this.processedPostsEngagement.has(postData.id)) {
              this.processedPostsEngagement.set(postData.id, { liked: false, commented: false });
            }
            this.processedPostsEngagement.get(postData.id).liked = true;
          }
          
          if (result.commented) {
            commentsCount++;
            if (result.commentType === 'singleword') {
              singleWordCommentCount++;
              this.log(`✓ Posted single-word comment ${singleWordCommentCount}/${targetSingleWord} on post by ${postData.author}`);
            } else {
              adaptiveCommentCount++;
              this.log(`✓ Posted adaptive comment ${adaptiveCommentCount}/${targetAdaptive} on post by ${postData.author}`);
            }
            
            // Track this post as commented in our memory
            if (!this.processedPostsEngagement.has(postData.id)) {
              this.processedPostsEngagement.set(postData.id, { liked: false, commented: false });
            }
            this.processedPostsEngagement.get(postData.id).commented = true;
          }
          
          processedInThisBatch = true;
          
          // Update stats
          this.updateStats({ 
            postsFound: postsExamined,
            postsLiked: likesCount,
            commentsPosted: commentsCount
          });
          
          // Human-like delay between actions
          const delay = this.getRandomDelay();
          this.log(`Waiting ${delay}s before next post...`);
          await this.delay(delay * 1000);
          
        } catch (error) {
          if (error.message.includes('Skipping advertisement') || error.message.includes('already')) {
            this.log(`${error.message}`, 'info');
            skippedCount++;
          } else {
            this.log(`Error processing post: ${error.message}`, 'error');
            this.updateStats({ errors: this.stats.errors + 1 });
          }
        }
      }
      
      // If we didn't process any posts in this batch, scroll down
      if (!processedInThisBatch) {
        this.log('No posts processed in this batch, scrolling to find more...');
        await this.scrollToLoadMorePosts();
        scrollAttempts++;
      } else {
        scrollAttempts = 0; // Reset scroll attempts if we found posts to process
      }
    }
    
    this.log(`Sequential processing completed!`);
    this.log(`Final results: ${postsExamined} posts examined, ${skippedCount} skipped`);
    this.log(`Actions taken: ${likesCount} likes, ${commentsCount} comments (${singleWordCommentCount} single-word + ${adaptiveCommentCount} adaptive)`);
    this.updateStatus(`Completed - ${likesCount} likes, ${commentsCount} comments, ${skippedCount} skipped`);
  }

  // Legacy function - no longer used since we switched to sequential processing

  extractPostData(postElement) {
    // Debug: Log post element structure
    this.log(`Analyzing post element with classes: ${postElement.className}`);
    
    // Check for sponsored/promoted content and skip
    const isAd = this.isAdvertisement(postElement);
    if (isAd) {
      this.log(`Detected sponsored content, skipping post`, 'info');
      throw new Error('Skipping advertisement/sponsored post');
    }
    
    this.log(`Processing regular post for content extraction`, 'info');
    
    // Check if already engaged with this post
    const alreadyEngaged = this.isAlreadyEngaged(postElement);
    
    // We will handle individual action skipping later, don't skip entire post here
    // Just store the engagement status for later use
    
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
      this.log(`No content element found with standard selectors`);
      
      const textElements = postElement.querySelectorAll('*');
      const textElementsWithContent = Array.from(textElements).filter(el => 
        el.textContent && el.textContent.trim().length > 20 && 
        !el.querySelector('*') // Only leaf nodes
      );
      
      this.log(`Found ${textElementsWithContent.length} potential text elements in fallback`);
      
      // Log first few text elements for debugging
      textElementsWithContent.slice(0, 3).forEach((el, i) => {
        this.log(`Text element ${i + 1}: "${el.textContent.trim().substring(0, 50)}..."`);
      });
      
      if (textElementsWithContent.length > 0) {
        this.log(`Using fallback method with first text element`);
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
    this.log(`Comment button found: ${!!commentButton}`);

    if (!commentButton || commentButton.disabled) {
      this.log(`Cannot comment - button missing or disabled`);
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
    // Very specific checks for actual sponsored/promoted content only
    
    // Check for explicit promoted post data attributes (most reliable)
    const hasPromotedData = postElement.querySelector('[data-promoted-post="true"]') ||
                           postElement.hasAttribute('data-promoted') ||
                           postElement.classList.contains('feed-shared-update-v2--promoted');
    
    if (hasPromotedData) {
      return true;
    }
    
    // Check for "Promoted" or "Sponsored" text in very specific locations
    // Look in subtitle/secondary text areas where LinkedIn puts promotion labels
    const promotionIndicators = postElement.querySelectorAll(
      '.feed-shared-actor__sub-description, .feed-shared-actor__supplementary-actor-info, .update-components-actor__description'
    );
    
    for (const indicator of promotionIndicators) {
      const text = indicator.textContent.trim().toLowerCase();
      // Must be exact matches for "promoted" or "sponsored" as standalone words
      if (text === 'promoted' || text === 'sponsored' || 
          text.startsWith('promoted ') || text.startsWith('sponsored ')) {
        return true;
      }
    }
    
    // Check for sponsored content in aria-labels (very specific)
    const sponsoredAriaLabels = postElement.querySelector('[aria-label*="Sponsored"][aria-label*="post"]') ||
                               postElement.querySelector('[aria-label*="Promoted"][aria-label*="post"]');
    
    if (sponsoredAriaLabels) {
      return true;
    }
    
    // If none of the specific indicators are found, it's not an ad
    return false;
  }

  isAlreadyEngaged(postElement) {
    // Check if WE already liked this post - enhanced detection
    const likeButton = this.findLikeButton(postElement);
    
    const alreadyLiked = likeButton && (
      likeButton.classList.contains('react-button__trigger--active') ||
      likeButton.classList.contains('reactions-react-button--active') ||
      likeButton.classList.contains('artdeco-button--primary') ||
      likeButton.getAttribute('aria-pressed') === 'true' ||
      likeButton.querySelector('.reaction-button--active') ||
      likeButton.querySelector('[data-test-icon="thumbs-up-filled-icon"]') ||
      likeButton.textContent.toLowerCase().includes('liked') ||
      likeButton.classList.contains('active')
    );
    
    // Check if WE already commented - look for our own comments specifically
    // COMPREHENSIVE comment detection - use multiple methods
    let alreadyCommented = false;
    
    // Method 1: Check if ANY comment button shows "commented" state
    const commentButton = this.findCommentButton(postElement);
    if (commentButton) {
      const commentButtonText = commentButton.textContent.toLowerCase();
      const commentButtonClass = commentButton.className;
      const commentButtonPressed = commentButton.getAttribute('aria-pressed') === 'true';
      
      if (commentButtonPressed || commentButtonText.includes('commented') || 
          commentButtonClass.includes('active') || commentButtonClass.includes('pressed')) {
        alreadyCommented = true;
        this.log(`Detected commented state from comment button - already commented`);
      }
    }
    
    // Method 2: Check for "You commented" or "You and X others commented" text anywhere in the post
    const allTextElements = postElement.querySelectorAll('*');
    for (const element of allTextElements) {
      const text = element.textContent?.toLowerCase() || '';
      if (text.includes('you commented') || text.includes('you and ') && text.includes('commented')) {
        alreadyCommented = true;
        this.log(`Found "you commented" text indicator - already commented`);
        break;
      }
    }
    
    // Method 3: Check comment count changes - look for active comment indicators
    const commentCounts = postElement.querySelectorAll('.social-counts-reactions__count-text, .social-counts-reactions__comment-text, .feed-shared-social-counts');
    for (const countElement of commentCounts) {
      const countText = countElement.textContent?.toLowerCase() || '';
      if (countText.includes('you') && countText.includes('comment')) {
        alreadyCommented = true;
        this.log(`Found active comment indicator in counts - already commented`);
        break;
      }
    }
    
    // Method 4: User name detection (fallback method)
    const currentUserName = this.getCurrentUserName();
    if (!alreadyCommented && currentUserName) {
      const commentItems = postElement.querySelectorAll('.comments-comment-item, .comment-item, .comments-comment-item-content');
      
      for (const comment of commentItems) {
        const commentAuthorElements = comment.querySelectorAll('a, span, .hoverable-link-text, [data-control-name="commenter_profile"]');
        
        for (const authorElement of commentAuthorElements) {
          const authorText = authorElement.textContent?.trim().toLowerCase() || '';
          const userNameLower = currentUserName.toLowerCase();
          
          // Strict name matching - must be exact or very close
          if (authorText === userNameLower || 
              (authorText.length > 3 && userNameLower.length > 3 && authorText.includes(userNameLower))) {
            alreadyCommented = true;
            this.log(`Found existing comment by user ${currentUserName} - already commented`);
            break;
          }
        }
        if (alreadyCommented) break;
      }
    }
    
    // Method 5: Check if the post element itself has commented state classes
    if (!alreadyCommented) {
      const postClasses = postElement.className || '';
      if (postClasses.includes('commented') || postClasses.includes('user-commented')) {
        alreadyCommented = true;
        this.log(`Found commented state in post classes - already commented`);
      }
    }
    
    // Method 6: AGGRESSIVE SCAN - Look for ANY form of "you" + "comment" combination
    if (!alreadyCommented) {
      const postHTML = postElement.innerHTML.toLowerCase();
      const patterns = [
        /you\s+commented/i,
        /you\s+and\s+\d+\s+others?\s+commented/i,
        /you.*comment/i,
        /commented.*you/i
      ];
      
      for (const pattern of patterns) {
        if (pattern.test(postHTML)) {
          alreadyCommented = true;
          this.log(`AGGRESSIVE DETECTION: Found comment pattern in post HTML - already commented`);
          break;
        }
      }
    }
    
    // Method 7: Check for processed post tracking (internal memory)
    const postId = postElement.getAttribute('data-urn') || 
                  postElement.getAttribute('data-id') ||
                  this.generatePostId(postElement.textContent, postElement);
    
    if (this.processedPostsEngagement && this.processedPostsEngagement.has(postId)) {
      const engagement = this.processedPostsEngagement.get(postId);
      if (engagement.commented) {
        alreadyCommented = true;
        this.log(`MEMORY CHECK: Post already processed and commented - already commented`);
      }
    }
    
    const result = {
      liked: !!alreadyLiked,
      commented: alreadyCommented
    };
    
    // Log engagement detection for debugging
    if (result.liked || result.commented) {
      this.log(`Engagement detected - Liked: ${result.liked}, Commented: ${result.commented}`);
    }
    
    return result;
  }
  
  getCurrentUserName() {
    // Try to get current user name from LinkedIn navigation/header
    const userNameSelectors = [
      '.global-nav__me-photo + span', // User name next to profile photo
      '.global-nav__me-content .t-16--open', // User name in navigation
      '.global-nav__primary-link-me-menu-trigger span:not(.visually-hidden)', // Me menu trigger
      '[data-control-name="identity_welcome_message"] .t-16', // Welcome message
      '.global-nav__me .artdeco-button__text' // Me button text
    ];
    
    for (const selector of userNameSelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent && element.textContent.trim().length > 0) {
        const userName = element.textContent.trim();
        // Extract first and last name, ignore things like "(You)" or other additions
        const cleanName = userName.replace(/\s*\([^)]*\)\s*/g, '').trim();
        if (cleanName.length > 0) {
          this.log(`Detected current user: ${cleanName}`);
          return cleanName;
        }
      }
    }
    
    // Fallback: try to get from URL or other sources
    const profileElements = document.querySelectorAll('[data-control-name="nav.settings_and_privacy"], .global-nav__me');
    for (const element of profileElements) {
      const title = element.title || element.getAttribute('aria-label') || '';
      if (title.includes('View profile') || title.includes('Account for')) {
        const nameMatch = title.match(/(?:View profile for|Account for)\s+([^,\n]+)/);
        if (nameMatch && nameMatch[1]) {
          const userName = nameMatch[1].trim();
          this.log(`Detected current user from title: ${userName}`);
          return userName;
        }
      }
    }
    
    this.log('Could not detect current user name - will be conservative about comment checking');
    return null;
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

      // Enhanced check if already liked - should match the detection in isAlreadyEngaged
      const isLiked = likeButton.getAttribute('aria-pressed') === 'true' ||
                     likeButton.classList.contains('artdeco-button--primary') ||
                     likeButton.classList.contains('react-button__trigger--active') ||
                     likeButton.classList.contains('reactions-react-button--active') ||
                     likeButton.querySelector('[data-test-icon="thumbs-up-filled-icon"]') ||
                     likeButton.querySelector('.reaction-button--active') ||
                     likeButton.textContent.toLowerCase().includes('liked') ||
                     likeButton.classList.contains('active');

      if (isLiked) {
        this.log(`Post by ${postData.author} already liked, skipping like action`, 'info');
        return false; // Return false to indicate no action taken
      }

      // Click the like button
      likeButton.click();
      await this.delay(this.getRandomDelay(0.3, 1) * 1000);

      // Verify the like was successful
      const nowLiked = likeButton.getAttribute('aria-pressed') === 'true' ||
                      likeButton.classList.contains('artdeco-button--primary') ||
                      likeButton.classList.contains('react-button__trigger--active') ||
                      likeButton.querySelector('[data-test-icon="thumbs-up-filled-icon"]');

      if (!nowLiked) {
        this.log(`Warning: Could not verify like on post by ${postData.author}`, 'warning');
      } else {
        this.log(`✓ Successfully liked post by ${postData.author}`, 'success');
      }
      
      return true; // Return true to indicate action was taken

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

        if (action === 'comment' && postData.alreadyCommented) {
          this.log(`⏭️ Already commented on post by ${postData.author}`, 'info');
        }

        if (action === 'comment' && !postData.alreadyCommented) {
          this.log(`✅ Starting comment generation for ${postData.author} (alreadyCommented: ${postData.alreadyCommented})`, 'info');
          this.log(`Generating ${this.config.commentStyle} comment for post by ${postData.author}...`, 'info');
          const commentResult = await this.generateComment(postData.content);
          
          if (commentResult && commentResult.skip) {
            this.log(`⏭️ Skipped post by ${postData.author}: ${commentResult.reason}`, 'info');
          } else if (commentResult && commentResult.comment) {
            this.log(`Generated comment: "${commentResult.comment}"`, 'info');
            await this.postComment(postData, commentResult.comment);
            result.commented = true;
            this.updateStats({ commentsPosted: this.stats.commentsPosted + 1 });
            this.log(`✓ Commented on post by ${postData.author}: "${commentResult.comment}"`, 'success');
          } else {
            this.log(`Failed to generate comment for post by ${postData.author} - no comment returned`, 'error');
            this.updateStats({ errors: this.stats.errors + 1 });
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
      // Double-check if we've already commented on this post before proceeding
      const currentEngagement = this.isAlreadyEngaged(postData.element);
      if (currentEngagement.commented) {
        this.log(`Detected existing comment during posting attempt - skipping comment on post by ${postData.author}`, 'info');
        return false;
      }
      
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
  
  findCurrentlyVisiblePosts() {
    // Find posts currently visible in viewport or near it
    const postElements = document.querySelectorAll('.feed-shared-update-v2, [data-test-id="main-feed-activity-card"], .feed-shared-update-v2__container');
    const visiblePosts = [];
    
    for (const postElement of postElements) {
      // Check if post is in or near viewport
      const rect = postElement.getBoundingClientRect();
      const isVisible = rect.top < window.innerHeight + 200 && rect.bottom > -200; // Include posts 200px outside viewport
      
      if (isVisible && !this.processedPosts.has(this.generatePostId(postElement))) {
        visiblePosts.push(postElement);
      }
    }
    
    this.log(`Found ${visiblePosts.length} visible posts to examine`);
    return visiblePosts;
  }
  
  async scrollToLoadMorePosts() {
    // Scroll down smoothly to load more posts
    const scrollAmount = 300 + Math.random() * 400; // Random scroll between 300-700px
    window.scrollBy({ 
      top: scrollAmount, 
      behavior: 'smooth' 
    });
    
    // Wait for content to load
    const pauseTime = 1000 + Math.random() * 1000; // 1-2 seconds
    await this.delay(pauseTime);
  }
  
  generatePostId(postElement) {
    // Generate a consistent ID for a post element
    const authorElement = postElement.querySelector('.feed-shared-actor__title a, .update-components-actor__title a');
    const contentElement = postElement.querySelector('.feed-shared-text__text-view, .feed-shared-text, .update-components-text');
    
    const author = authorElement ? authorElement.textContent.trim() : 'unknown';
    const content = contentElement ? contentElement.textContent.trim().substring(0, 50) : 'no-content';
    
    return `${author}_${content}`.replace(/[^a-zA-Z0-9]/g, '_');
  }
  
  determineRandomActions(postData, quotaStatus) {
    const actions = [];
    
    // Check if we can like this post
    const canLike = !postData.alreadyLiked && 
                   quotaStatus.likesCount < quotaStatus.targetLikes;
    
    // Check if we can comment on this post
    const canComment = !postData.alreadyCommented && 
                      quotaStatus.commentsCount < quotaStatus.targetComments;
    
    if (!canLike && !canComment) {
      return actions; // No actions possible
    }
    
    // Random decision making - more natural distribution
    const likeChance = 0.6; // 60% chance to like if possible
    const commentChance = 0.4; // 40% chance to comment if possible
    
    // Sometimes do both, sometimes just one
    const shouldLike = canLike && Math.random() < likeChance;
    const shouldComment = canComment && Math.random() < commentChance;
    
    if (shouldLike) {
      actions.push('like');
    }
    
    if (shouldComment) {
      // Determine comment type based on remaining quota
      const singleWordRemaining = quotaStatus.targetSingleWord - quotaStatus.singleWordCommentCount;
      const adaptiveRemaining = quotaStatus.targetAdaptive - quotaStatus.adaptiveCommentCount;
      
      if (singleWordRemaining > 0 && adaptiveRemaining > 0) {
        // Both types available, choose based on ratio (70/30 preference)
        const usesSingleWord = Math.random() < 0.7;
        actions.push(usesSingleWord ? 'comment_singleword' : 'comment_adaptive');
      } else if (singleWordRemaining > 0) {
        actions.push('comment_singleword');
      } else if (adaptiveRemaining > 0) {
        actions.push('comment_adaptive');
      }
    }
    
    return actions;
  }
  
  async processPostSequentially(postData, actions) {
    this.log(`Processing post by ${postData.author} with actions: ${actions.join(', ')}...`);
    this.updateStatus(`Processing post by ${postData.author}`);

    const result = { liked: false, commented: false, commentType: null };

    // Scroll to post
    postData.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await this.delay(this.getRandomDelay(1, 2) * 1000);

    // Process actions in random order for more natural behavior
    const shuffledActions = [...actions].sort(() => Math.random() - 0.5);

    for (const action of shuffledActions) {
      if (!this.isRunning) break;

      try {
        if (action === 'like') {
          await this.likePost(postData);
          result.liked = true;
          this.log(`✓ Liked post by ${postData.author}`, 'success');
          
          // Random delay between actions
          if (shuffledActions.length > 1) {
            await this.delay(this.getRandomDelay(0.5, 2) * 1000);
          }
        }

        if (action.startsWith('comment_')) {
          const commentType = action.split('_')[1]; // 'singleword' or 'adaptive'
          this.log(`Generating ${commentType} comment for post by ${postData.author}...`, 'info');
          
          const commentResult = await this.generateCommentByType(postData.content, commentType);
          
          if (commentResult && commentResult.skip) {
            this.log(`⏭️ Skipped post by ${postData.author}: ${commentResult.reason}`, 'info');
          } else if (commentResult && commentResult.comment) {
            this.log(`Generated ${commentType} comment: "${commentResult.comment}"`, 'info');
            await this.postComment(postData, commentResult.comment);
            result.commented = true;
            result.commentType = commentType;
            this.log(`✓ Commented on post by ${postData.author}: "${commentResult.comment}"`, 'success');
          } else {
            this.log(`Failed to generate ${commentType} comment for post by ${postData.author}`, 'error');
            this.updateStats({ errors: this.stats.errors + 1 });
          }
        }
      } catch (error) {
        this.log(`Error with ${action} on post by ${postData.author}: ${error.message}`, 'error');
      }
    }

    return result;
  }
  
  async generateCommentByType(postContent, commentType) {
    // Use appropriate comment style based on type
    const commentStyle = commentType === 'singleword' ? 'oneword' : 'adaptive';
    return await this.generateComment(postContent, commentStyle);
  }
  
  async generateComment(postContent, commentStyle = 'adaptive') {
    try {
      this.log(`Generating ${commentStyle} comment...`, 'info');
      
      const response = await chrome.runtime.sendMessage({
        type: 'GENERATE_COMMENT',
        postContent: postContent,
        commentStyle: commentStyle,
        apiKey: this.config.apiKey
      });
      
      if (response && response.success) {
        return response.result;
      } else {
        throw new Error(response?.error || 'Failed to generate comment');
      }
    } catch (error) {
      this.log(`Comment generation error: ${error.message}`, 'error');
      throw error;
    }
  }
}

// Initialize bot when script loads
new LinkedInBot();
