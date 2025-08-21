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

      const comment = await this.generateComment(postContent, commentStyle, openaiKey);
      
      sendResponse({
        success: true,
        comment: comment
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
      
      if (!result.comment || typeof result.comment !== 'string') {
        throw new Error('Invalid comment format in API response');
      }

      return result.comment.trim();
      
    } catch (parseError) {
      throw new Error('Failed to parse OpenAI response: ' + parseError.message);
    }
  }

  getSystemPrompt(commentStyle) {
    const basePrompt = `You are a LinkedIn engagement expert. Generate authentic, meaningful comments that add value to professional discussions. `;
    
    const stylePrompts = {
      professional: `Write in a professional, business-focused tone. Use industry terminology appropriately and maintain formal language. Focus on business insights and professional perspectives.`,
      
      casual: `Write in a friendly, conversational tone while remaining professional. Use a more relaxed approach but keep it appropriate for LinkedIn. Be approachable and personable.`,
      
      insightful: `Provide thoughtful analysis and deeper perspectives. Ask meaningful questions or share relevant insights that encourage further discussion. Be intellectually engaging.`,
      
      supportive: `Be encouraging and supportive. Acknowledge achievements, offer congratulations, or provide positive reinforcement. Focus on building others up and showing appreciation.`
    };

    const guidelines = `

Guidelines:
- Keep comments between 20-80 words
- Be genuine and avoid generic responses
- Add value to the conversation
- Use proper grammar and punctuation
- Avoid controversial topics
- Don't use excessive emojis or hashtags
- Make it personal but professional
- Encourage engagement from others`;

    return basePrompt + (stylePrompts[commentStyle] || stylePrompts.professional) + guidelines;
  }
}

// Initialize background service
new BackgroundService();
