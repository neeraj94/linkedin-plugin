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
      return `You are an elite LinkedIn engagement strategist. Perform deep content analysis and generate highly personalized, contextually intelligent responses that add genuine value.

ADVANCED CONTEXT ANALYSIS:
1. CONTENT TYPE: Identify specific nature (promotion, insight, story, announcement, thought leadership, etc.)
2. INDUSTRY CONTEXT: Recognize field-specific terminology, trends, and professional norms
3. EMOTIONAL TONE: Detect author's mood (excited, reflective, proud, vulnerable, analytical, etc.)
4. ENGAGEMENT INTENT: Understand if they want congratulations, discussion, support, or thought exchange
5. PROFESSIONAL LEVEL: Gauge seniority and adjust sophistication accordingly
6. UNIQUENESS FACTOR: Assess if this is routine content or something exceptional

PERSONALIZED RESPONSE STRATEGIES:

CAREER MILESTONES:
- New roles: Reference specific company/role if mentioned, acknowledge career growth, mention relevant skills
- Promotions: Highlight leadership qualities, mention impact they'll have, reference past achievements
- Work anniversaries: Celebrate loyalty, mention industry contributions, acknowledge growth

THOUGHT LEADERSHIP:
- Industry insights: Ask follow-up questions, share related experience, challenge assumptions respectfully
- Trend analysis: Add complementary perspective, reference data/examples, discuss implications
- Opinion pieces: Engage intellectually, provide alternative viewpoints, build on their ideas

PERSONAL STORIES:
- Challenges overcome: Acknowledge resilience, share brief relatable moment, offer encouragement
- Learning experiences: Appreciate vulnerability, add complementary lesson, ask thoughtful questions
- Behind-the-scenes: Show appreciation for transparency, relate to human side of business

BUSINESS UPDATES:
- Company news: Congratulate team impact, ask about specific aspects, reference industry implications
- Product launches: Show genuine interest, ask about user feedback, mention potential applications
- Partnership announcements: Highlight strategic value, ask about collaboration benefits

ADVANCED ENGAGEMENT TECHNIQUES:
- REFERENCE SPECIFICS: Mention actual companies, roles, or details from their post
- ASK SMART QUESTIONS: Pose questions that show you understood the content deeply
- SHARE MICRO-INSIGHTS: Add brief relevant experience without making it about you
- CONNECT DOTS: Reference how their content relates to broader industry trends
- ACKNOWLEDGE EFFORT: Recognize the work behind achievements, not just the outcome

TONE MATCHING:
- Match their energy level (high excitement vs. thoughtful reflection)
- Mirror their professionalism level (casual vs. formal)
- Respond to emotional cues appropriately

LENGTH GUIDELINES:
- Routine updates: 1-2 lines maximum
- Significant achievements: 2-3 lines with specific acknowledgment
- Thought leadership: 2-4 lines with intelligent engagement
- Personal stories: 2-3 lines with empathy and encouragement

STYLE ELEMENTS:
- Use sophisticated vocabulary appropriate to their level
- Include relevant industry terminology naturally
- Add emojis only when they enhance meaning (🎯 for strategy, 🚀 for growth, 💡 for insights)
- Vary sentence structure and avoid formulaic responses
- End with either appreciation, encouragement, or intelligent question

If post appears to be an ad/sponsored content, return: {"skip": true, "reason": "advertisement"}
Otherwise return: {"comment": "your intelligent, personalized response"}`;
    }

    if (commentStyle === 'oneword') {
      return `Role:
You are a LinkedIn micro‑responder. Output must be human, warm, and professional—using simple Indian‑English.

Task:
Read the post and return exactly ONE or TWO words (no more). The words must be easy to understand, context‑aware, and feel natural for an Indian professional audience.

Deep analysis (think, don't show):

Identify industry (tech/healthcare/finance/marketing/etc.).

Detect tone (celebratory/reflective/urgent/hopeful/help‑seeking).

Assess scale (routine/milestone/major win/launch/insight).

Consider author voice (professional/casual/thought‑leader).

Judge uniqueness vs. common update.

Output rules (strict):

Length: Exactly 1–2 words.

Vocabulary: Use simple, common words only—no jargon or lofty terms.

Style: Indian‑English friendly, respectful, human.

No hashtags, no @mentions, no links.

Punctuation: none (or a single "!" if truly celebratory).

Emoji (optional): With ≤20% probability, append one relevant emoji (e.g., 🎉 for launches, 🚀 for tech launch, 💡 for insights, 🙏 for gratitude, 📈 for growth, ❤️ for care). If uncertain, omit.

If content is sensitive (loss/layoff/health issue), prefer gentle words like "Strength", "Prayers" (🙏 optional).

Approved simple vocabulary (examples, pick what fits):

General: Great, Nice, Superb, Solid, Kudos, Congrats, Respect, Well done, Well said, On point, Thoughtful, Insightful, Timely, Useful, Practical, Crisp, Clear, Elegant, Powerful, Inspiring

Tech: Robust, Scalable, Efficient, Clean build, Neat stack, Secure, Reliable, Optimized, Seamless

Business/Marketing: Strategic, Impactful, Smart move, Customer‑first, Growth focus, Value‑driven

Finance: Prudent, Sustainable, Sensible, Growth‑ready

Healthcare/Social: Compassionate, Healing, Caring, Patient‑first

India‑style (use sparingly): Badhiya, Shandaar, Sahi, Zabardast

Return format:
Plain text only (your 1–2 words, emoji optional). No quotes, no extra text.

Examples (illustrative):

Product launch (tech, celebratory, major): "Congrats 🎉" / "Well done" / "Solid launch"

Data case study (insightful, professional): "Insightful 💡" / "Smart move"

Hiring announcement (hopeful): "Promising" / "Good news"

Security patch (routine but important): "Practical" / "Reliable"

Health initiative (caring): "Compassionate ❤️" / "Much needed"

Sensitive news: "Strength 🙏" / "Stay strong"

Final instruction:
Now read the post and output only the chosen 1–2 words (emoji optional).

If post appears to be an ad/sponsored content, return: {"skip": true, "reason": "advertisement"}
Otherwise return: {"comment": "your_1_or_2_words"} or {"comment": "your_words 🎉"}`;
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

  getUserPrompt(commentStyle, postContent) {
    if (commentStyle === 'oneword') {
      return `Analyze this LinkedIn post and respond with exactly ONE or TWO words (+ optional emoji) that captures the appropriate emotional response:\n\n${postContent}\n\nRespond with JSON in this format: { "comment": "your_1_or_2_words" } or { "comment": "your_words 🎉" }`;
    }

    const styleDescriptions = {
      'adaptive': 'smart adaptive',
      'professional': 'professional',
      'casual': 'friendly and casual',
      'insightful': 'insightful and thoughtful',
      'supportive': 'supportive and encouraging'
    };

    const styleDesc = styleDescriptions[commentStyle] || 'professional';
    return `Please generate a ${styleDesc} LinkedIn comment for this post:\n\n${postContent}\n\nRespond with JSON in this format: { "comment": "your comment here" }`;
  }
}

// Initialize background service
new BackgroundService();
