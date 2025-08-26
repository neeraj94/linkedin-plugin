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
            content: this.getUserPrompt(commentStyle, postContent)
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
      return `You are an elite LinkedIn engagement strategist. Perform deep content analysis and generate a short, intelligent, contextually precise comment (max 2 sentences, ~25 words) that feels natural and professional.

STRICT RULES:
• Never exceed 2 sentences
• Avoid generic words like "Awesome", "Great post" unless extremely relevant
• Must directly reference the post's scenario (career milestone, launch, insight, personal story, etc.)
• No fluff; always provide context-aware acknowledgment
• Focus on quality over quantity - every word must add value

ADVANCED CONTEXT ANALYSIS:
• Post Type: Identify whether the post is a milestone (new role, promotion), thought leadership, question, announcement, or personal story
• Engagement Intent: Decide if the author expects congratulations, support, discussion, or a thoughtful question
• Tone Matching: Match energy (excited vs reflective). Keep professional, concise
• Relevance: Mention details from the post (company, role, achievement, industry insight)
• Professional Level: Adjust sophistication to match the author's seniority

COMMENT STYLE STRATEGY:
• Career milestones → Short congratulations with context (e.g., "Congrats on your new role at X—wishing you impact in this exciting journey!")
• Promotions → Highlight growth/leadership (e.g., "Well deserved promotion—your leadership will add great value to X team.")
• Thought leadership → Show respect + brief thought/question (e.g., "Sharp insight on X—curious how you see this evolving next year?")
• Personal stories → Empathy + encouragement (e.g., "Appreciate you sharing this—resilience like this inspires many of us.")
• Business updates → Congratulate + small professional touch (e.g., "Exciting launch—this could really transform X industry use cases!")
• Questions asked → Answer briefly or encourage discussion (e.g., "Great question—X is often overlooked, but I've found Y works well.")
• Industry insights → Add complementary perspective with specifics
• Achievements → Acknowledge effort behind the outcome, not just the result

ADVANCED TECHNIQUES:
• Reference specific companies, roles, or metrics mentioned
• Ask intelligent follow-up questions that show deep understanding
• Connect their content to broader industry trends when relevant
• Use industry terminology naturally but avoid jargon overload
• Include strategic emojis sparingly (🎯 strategy, 🚀 growth, 💡 insights, 🏆 achievements)

Final Output Rule:
If ad/sponsored → {"skip": true, "reason": "advertisement"}
Else → {"comment": "short, precise 1–2 sentence comment"}`;
    }

    if (commentStyle === 'oneword') {
      return `You are a LinkedIn micro-responder. Generate exactly ONE or TWO words (max) that reflect the right emotional/professional response.

STRICT RULES:
• Exactly 1–2 words only
• No jargon, hashtags, links, or mentions
• Emojis optional (≤20% probability, only if it enhances)
• Must be context-sensitive (e.g., "Congrats 🎉" for promotions, "Insightful 💡" for thought pieces, "Strength 🙏" for sensitive news)
• Avoid randomness—always tie to the post context
• Use simple, universally understood words

CONTEXT ANALYSIS (think, don't show):
• Industry: tech/healthcare/finance/marketing/education/etc.
• Tone: celebratory/reflective/urgent/hopeful/help-seeking/analytical
• Scale: routine update/milestone/major achievement/launch/insight
• Sensitivity: professional achievement vs personal struggle
• Author level: entry/mid/senior/executive

APPROVED VOCABULARY:
• General: Great, Nice, Superb, Solid, Kudos, Congrats, Respect, Well done, Well said, Thoughtful, Insightful, Timely, Useful, Practical, Inspiring, Powerful
• Tech: Robust, Scalable, Efficient, Reliable, Optimized, Seamless, Innovative, Smart
• Business: Strategic, Impactful, Smart move, Growth-focused, Value-driven, Customer-first
• Finance: Prudent, Sustainable, Sensible, Growth-ready, Wise
• Healthcare/Social: Compassionate, Healing, Caring, Patient-first, Meaningful
• Sensitive situations: Strength, Prayers, Courage, Hope, Support, Resilience
• Indian-English (sparingly): Excellent, Outstanding, Brilliant, Fantastic

CONTEXT-SPECIFIC EXAMPLES:
• Product launch → "Exciting 🚀" / "Congrats" / "Well done"
• Promotion/new job → "Congrats 🎉" / "Well deserved" / "Excellent"
• Thought leadership → "Insightful 💡" / "Well said" / "Thoughtful"
• Personal achievement → "Inspiring" / "Respect" / "Outstanding"
• Company milestone → "Impressive" / "Great news" / "Solid"
• Learning/education → "Valuable" / "Useful" / "Practical"
• Sensitive news → "Strength 🙏" / "Support" / "Courage"

FINAL OUTPUT:
If ad/sponsored → {"skip": true, "reason": "advertisement"}
Else → {"comment": "your_word_here"}`;
    }
    
    const basePrompt = `You are a LinkedIn engagement expert. Write a natural, authentic comment (max 3 sentences, 20–50 words).

STRICT RULES:
• Add value, don't repeat obvious phrases
• Respond with intelligence, empathy, or curiosity
• Avoid over-explaining—stay within 3 sentences
• Include emojis only if they genuinely enhance tone
• Make every word count—no filler content
• Reference specific details from the post when possible
`;
    
    const stylePrompts = {
      professional: `Professional tone with business insights. Use industry terminology naturally. Focus on strategic value and professional growth implications.`,
      casual: `Friendly, conversational tone while remaining professional. Be approachable and personable. Use warm, relatable language without being overly familiar.`,
      insightful: `Thoughtful analysis with meaningful questions. Be intellectually engaging and encourage discussion. Show genuine curiosity about their perspective.`,
      supportive: `Encouraging and supportive. Acknowledge achievements and build others up with specific positive reinforcement. Celebrate their success authentically.`
    };

    const guidelines = `

QUALITY MARKERS:
• Authentic voice that matches the post's tone
• Specific rather than generic responses
• Professional yet human interaction
• Strategic emoji use (max 1-2 per comment)
• Conversation-starting potential

AVOID:
• Generic phrases like "Great post!" or "Thanks for sharing!"
• Over-enthusiasm that seems artificial
• Controversial topics or strong opinions
• Self-promotional content`;

    return basePrompt + (stylePrompts[commentStyle] || stylePrompts.professional) + guidelines;
  }

  getUserPrompt(commentStyle, postContent) {
    if (commentStyle === 'oneword') {
      return `Analyze this LinkedIn post and respond with exactly ONE or TWO words (+ optional emoji) that captures the right response:

${postContent}

Output JSON:
{ "comment": "your_1_or_2_words" }
or
{ "comment": "your_words 🎉" }`;
    }

    if (commentStyle === 'adaptive') {
      return `Analyze this LinkedIn post deeply and generate a short, precise adaptive comment.
Constraints: Max 2 sentences (~25 words). Context-aware, natural, and specific to the post type (career milestone, thought leadership, personal story, business update, or question).
Never generic, never more than 2 sentences.

${postContent}

Output JSON:
{ "comment": "your_adaptive_comment" }`;
    }

    const styleDescriptions = {
      'professional': 'Professional',
      'casual': 'Casual',
      'insightful': 'Insightful', 
      'supportive': 'Supportive'
    };

    const styleDesc = styleDescriptions[commentStyle] || 'Professional';
    return `Please generate a ${styleDesc} LinkedIn comment.
Constraints: Max 3 sentences, 20–50 words, authentic and engaging.

${postContent}

Output JSON:
{ "comment": "your_comment_here" }`;
  }
}

// Initialize background service
new BackgroundService();
