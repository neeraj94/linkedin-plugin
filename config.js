// LinkedIn AI Engagement Bot - Configuration

const CONFIG = {
  // Timing delays to appear more human-like (in milliseconds)
  DELAYS: {
    SCROLL: 1000,        // Delay after scrolling to post
    CLICK: 500,          // Delay after clicking comment button
    FOCUS: 300,          // Delay after focusing comment editor
    TYPE: 1000,          // Delay after typing comment
    SUBMIT: 1000,        // Delay after submitting comment
    BETWEEN_POSTS: 3000  // Delay between processing posts
  },

  // LinkedIn selectors (may need updates if LinkedIn changes their DOM)
  SELECTORS: {
    FEED_POSTS: '.feed-shared-update-v2',
    POST_CONTENT: [
      '.feed-shared-text__text-view span[dir="ltr"]',
      '.feed-shared-text span[dir="ltr"]',
      '.feed-shared-update-v2__description span'
    ],
    COMMENT_BUTTON: [
      '[aria-label*="omment"]',
      'button[data-control-name*="comment"]',
      '.social-actions-button:nth-child(2)'
    ],
    COMMENT_EDITOR: '.comments-comment-texteditor .ql-editor',
    SUBMIT_BUTTON: '.comments-comment-texteditor .comments-comment-texteditor__submit-button:not([disabled])',
    AUTHOR: [
      '.feed-shared-actor__title a',
      '.update-components-actor__title a'
    ],
    COMMENTS_SECTION: [
      '.comments-comments-list',
      '.social-details-social-comments'
    ]
  },

  // Default settings
  DEFAULTS: {
    MAX_POSTS: 10,
    COMMENT_STYLE: 'professional',
    COMMENT_MIN_LENGTH: 20,
    COMMENT_MAX_LENGTH: 80
  },

  // Error messages
  ERRORS: {
    NO_API_KEY: 'OpenAI API key is required',
    INVALID_API_KEY: 'Invalid OpenAI API key format',
    NOT_LINKEDIN: 'This extension only works on LinkedIn',
    NO_POSTS_FOUND: 'No posts found in the current feed',
    COMMENT_FAILED: 'Failed to post comment',
    RATE_LIMITED: 'Rate limited by LinkedIn or OpenAI'
  }
};

// Export config for other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}
