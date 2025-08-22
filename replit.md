# LinkedIn AI Engagement Bot

## Overview

This is a Chrome browser extension that automates LinkedIn engagement through AI-generated comments. The bot scans LinkedIn feeds, extracts post content, generates contextually appropriate comments using OpenAI's GPT-4o model, and automatically posts them to increase user engagement on the platform. The extension uses a human-like interaction pattern with configurable delays and comment styles to avoid detection as an automated tool.

## Recent Changes (August 22, 2025)

### AI-Powered Smart Engagement System
- **Smart Adaptive Comments**: AI automatically chooses response style based on post content (job announcements, achievements, insights, personal stories)
- **Natural Expressions**: Added "haha", "wow", "love this", "so true" and professional emojis for authentic engagement
- **Variable Comment Length**: Comments range from 1-4 lines, with many being short and natural (not every comment is long)
- **Advertisement Detection**: Automatically skips sponsored posts and ads to avoid spam-like behavior
- **Engagement Checking**: Detects already liked/commented posts and skips them to prevent duplicate actions
- **Context-Aware Responses**: Job posts get congratulations, achievements get praise, insights get thoughtful questions

### Advanced Feature Update (August 21, 2025)
- **Post Liking Feature**: Added automatic post liking with smart detection of already-liked posts
- **Flexible Action Controls**: Users can now enable/disable likes and comments independently  
- **Advanced Limits System**: Separate controls for max posts to like (1-100) and comment (1-50)
- **Human-like Behavior**: Implemented randomized delays between actions (user-configurable range)
- **Action Randomization**: Bot randomly shuffles like/comment order to appear more natural
- **Enhanced Statistics**: Added real-time tracking for posts liked in addition to comments posted

### Technical Improvements (August 20, 2025)
- Fixed browser compatibility issues (removed Node.js process.env usage)
- Updated LinkedIn DOM selectors for current site structure  
- Enhanced content extraction with fallback methods
- Improved comment posting with better rich text editor support
- Added comprehensive debugging and logging
- Created test page for API key validation

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Chrome Extension Architecture
- **Manifest V3 Structure**: Uses service worker background script pattern for modern Chrome extension development
- **Multi-Script Architecture**: Separates concerns across background.js (API calls), content.js (DOM manipulation), popup.js (UI control), and config.js (settings)
- **Message Passing System**: Implements Chrome extension message passing between popup, content script, and background service worker for coordinated actions

### Content Script Strategy
- **DOM Monitoring**: Uses CSS selectors to identify LinkedIn feed posts, comment buttons, and text editors
- **Human-like Automation**: Implements configurable delays between actions (scrolling, clicking, typing) to mimic human behavior
- **State Management**: Tracks processed posts to avoid duplicate comments and maintains running statistics

### AI Integration
- **OpenAI GPT-4o Integration**: Direct API calls to OpenAI's chat completions endpoint for comment generation
- **Comment Style Customization**: Supports multiple comment styles (professional, casual, insightful, supportive) through prompt engineering
- **Content Context Awareness**: Extracts post content and generates relevant, contextual responses

### User Interface Design
- **Popup-based Control Panel**: Browser extension popup provides configuration interface and bot controls
- **Real-time Status Updates**: Live statistics tracking and status indicators for bot operation
- **Persistent Settings**: Chrome storage API for saving API keys and user preferences

### Security and Privacy
- **API Key Management**: Secure storage of OpenAI API key using Chrome's sync storage
- **Content Script Isolation**: Runs in isolated context on LinkedIn pages without interfering with site functionality
- **Error Handling**: Comprehensive error management and logging for debugging and user feedback

## External Dependencies

### APIs and Services
- **OpenAI API**: GPT-4o model for natural language comment generation
- **Chrome Extensions API**: Storage, messaging, and content script injection capabilities

### Target Platform
- **LinkedIn Web Platform**: Specifically designed for LinkedIn.com feed interaction and engagement
- **DOM Selectors**: Relies on LinkedIn's current HTML structure and CSS classes for automation

### Node.js Dependencies
- **OpenAI Package**: Version 5.13.1 for API client functionality (though primarily used for reference in browser context)

### Browser Requirements
- **Chrome Browser**: Manifest V3 compatible Chrome browser for extension hosting
- **LinkedIn Session**: Requires active LinkedIn login session for feed access and comment posting