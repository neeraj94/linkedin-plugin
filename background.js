// LinkedIn AI Engagement Bot - Background Script

class BackgroundService {
  constructor() {
    this.setupMessageListener();
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      switch (message.type) {
        case 'GENERATE_COMMENT':
          this.handleCommentGeneration(message, sendResponse);
          return true; // Keep the message channel open for async response
        case 'LOG_ERROR':
          console.error('Content Script Error:', message.error);
          break;
      }
    });
  }

  async handleCommentGeneration(message, sendResponse) {
    try {
      const { postContent, commentStyle, apiKey } = message;
      
      // Use provided key (environment variables not available in browser context)
      const openaiKey = apiKey;
      
      if (!openaiKey || !openaiKey.startsWith('sk-')) {
        throw new Error('Invalid OpenAI API key');
      }

      const result = await this.generateComment(postContent, commentStyle, openaiKey);
      
      sendResponse({
        success: true,
        result: result
      });
      
    } catch (error) {
      console.error('Error generating comment:', error);
      
      sendResponse({
        success: false,
        error: error.message
      });
    }
  }

  async generateComment(postContent, commentStyle, apiKey) {
    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt(commentStyle)
          },
          {
            role: 'user',
            content: `Please generate a ${commentStyle} LinkedIn comment for this post:\n\n${postContent}\n\nRespond with JSON in this format: { "comment": "your comment here" }`
          }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 150,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`OpenAI API Error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Invalid response format from OpenAI API');
    }

    try {
      const result = JSON.parse(data.choices[0].message.content);
      
      // Handle skip directive for ads/sponsored content
      if (result.skip) {
        return { skip: true, reason: result.reason || 'AI decided to skip this post' };
      }
      
      if (!result.comment || typeof result.comment !== 'string') {
        throw new Error('Invalid comment format in API response');
      }

      return { comment: result.comment.trim(), skip: false };
      
    } catch (parseError) {
      throw new Error('Failed to parse OpenAI response: ' + parseError.message);
    }
  }

  getSystemPrompt(commentStyle) {
    if (commentStyle === 'adaptive') {
      return `You are a LinkedIn engagement expert. Analyze the post content and generate the most appropriate response based on context:

POST TYPE RESPONSES:
- Job announcements/new positions: Brief congratulations (1-2 lines) like "Congratulations! 🎉", "Exciting opportunity!", "Best of luck in your new role!"
- Achievement/milestone posts: Enthusiastic support like "Amazing work! 👏", "Well deserved!", "So inspiring!", "Wow, incredible!"
- Industry insights/articles: Thoughtful responses with questions like "Great points! Have you considered...?", "Love this perspective...", "This aligns with..."
- Personal stories: Warm, relatable responses like "Love this!", "So true!", "Thanks for sharing!", "Haha, been there too!"
- Business updates/company news: Professional but engaging responses

RULES:
- Maximum 4 lines, often 1-2 lines is perfect
- Use natural expressions: "haha", "wow", "love this", "so true", "amazing" when appropriate
- Add professional emojis sparingly: 🎉 👏 💡 🚀 ❤️
- Vary length - not every comment needs to be long
- Be authentic and conversational
- Skip obvious advertisements or sponsored content

If post appears to be an ad/sponsored content, return: {"skip": true, "reason": "advertisement"}
Otherwise return: {"comment": "your engaging comment"}`;
    }

    if (commentStyle === 'oneword') {
      return `You are a LinkedIn engagement expert. Analyze the post content and generate EXACTLY ONE WORD that best captures the appropriate emotional response to the post.

ANALYZE THE POST AND RESPOND WITH ONE WORD BASED ON CONTENT:

ACHIEVEMENT/SUCCESS POSTS: Amazing, Incredible, Outstanding, Impressive, Brilliant, Fantastic, Wonderful, Excellent
INSPIRATIONAL/MOTIVATIONAL: Inspiring, Motivating, Uplifting, Powerful, Moving, Encouraging
EDUCATIONAL/INSIGHTS: Insightful, Valuable, Useful, Informative, Enlightening, Thoughtful, Wise
PERSONAL STORIES: Relatable, Touching, Genuine, Authentic, Heartwarming, Beautiful
NOSTALGIC/MEMORY POSTS: Nostalgic, Memorable, Timeless, Classic, Golden, Precious
INNOVATIVE/TECH: Innovative, Groundbreaking, Revolutionary, Cutting-edge, Advanced, Futuristic
CHALLENGES/STRUGGLES: Resilient, Strong, Courageous, Brave, Determined, Persevering
ANNOUNCEMENTS: Exciting, Congratulations, Fantastic, Wonderful, Great, Awesome
INDUSTRY TRENDS: Relevant, Important, Timely, Significant, Notable, Trending

RULES:
- Respond with EXACTLY ONE WORD only
- Choose the most contextually appropriate word based on post content
- Use professional but engaging language
- No emojis, punctuation, or additional text
- Skip obvious advertisements or sponsored content

If post appears to be an ad/sponsored content, return: {"skip": true, "reason": "advertisement"}
Otherwise return: {"comment": "your_one_word_here"}`;
    }
    
    const basePrompt = `You are a LinkedIn engagement expert. Generate authentic, meaningful comments (max 4 lines). `;
    
    const stylePrompts = {
      professional: `Professional tone with business insights. Use industry terminology and formal language.`,
      casual: `Friendly, conversational tone while remaining professional. Be approachable and personable.`,
      insightful: `Thoughtful analysis with meaningful questions. Be intellectually engaging and encourage discussion.`,
      supportive: `Encouraging and supportive. Acknowledge achievements and build others up with positive reinforcement.`
    };

    const guidelines = `
- Keep authentic and engaging (20-80 words)
- Add value to the conversation  
- Use proper grammar and appropriate emojis occasionally
- Avoid generic responses and controversial topics`;

    return basePrompt + (stylePrompts[commentStyle] || stylePrompts.professional) + guidelines;
  }
}

// Initialize background service
new BackgroundService();
