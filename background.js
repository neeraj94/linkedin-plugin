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
      return `You are a sophisticated LinkedIn engagement AI. Analyze the post content deeply and generate EXACTLY ONE WORD that perfectly captures the nuanced emotional response. Avoid repetition by using diverse vocabulary.

DEEP CONTENT ANALYSIS REQUIRED:
1. IDENTIFY the specific industry/field (tech, healthcare, finance, marketing, etc.)
2. DETECT the emotional tone (celebratory, reflective, urgent, hopeful, etc.)
3. ASSESS the achievement level (milestone, breakthrough, routine update, major win)
4. CONSIDER the author's personality (professional, casual, thought-leader, etc.)
5. EVALUATE uniqueness vs. commonality of the content

ADVANCED VOCABULARY POOL - CHOOSE CONTEXTUALLY:
CAREER ACHIEVEMENTS: Phenomenal, Stellar, Exceptional, Remarkable, Magnificent, Triumphant, Spectacular, Exemplary, Extraordinary, Legendary, Pioneering, Trailblazing
INNOVATION/TECH: Revolutionary, Disruptive, Visionary, Ingenious, Sophisticated, Cutting-edge, Paradigm-shifting, Mind-blowing, Game-changing, Transformative
PERSONAL GROWTH: Inspiring, Empowering, Enlightening, Profound, Thought-provoking, Eye-opening, Transformational, Revelatory, Motivational, Soul-stirring
BUSINESS INSIGHTS: Strategic, Astute, Perceptive, Shrewd, Analytical, Data-driven, Forward-thinking, Comprehensive, Tactical, Brilliant
CREATIVE WORK: Captivating, Mesmerizing, Artistic, Imaginative, Creative, Stunning, Breathtaking, Innovative, Original, Masterful
LEADERSHIP: Commanding, Influential, Impactful, Decisive, Bold, Courageous, Visionary, Inspiring, Transformational, Dynamic
LEARNING/EDUCATION: Enlightening, Educational, Informative, Valuable, Enriching, Knowledge-rich, Comprehensive, Detailed, Thorough, Expert
EMOTIONAL/PERSONAL: Heartfelt, Genuine, Authentic, Touching, Moving, Vulnerable, Honest, Raw, Beautiful, Meaningful

INDUSTRY-SPECIFIC WORDS:
TECH: Scalable, Robust, Agile, Efficient, Seamless, Optimized, Streamlined, Automated, Integrated, Cloud-native
HEALTHCARE: Compassionate, Healing, Life-saving, Innovative, Patient-centered, Evidence-based, Breakthrough, Therapeutic
FINANCE: Strategic, Profitable, Risk-aware, Analytical, Market-savvy, Investment-grade, Sustainable, Growth-oriented
MARKETING: Engaging, Compelling, Conversion-focused, Brand-building, Audience-centric, Creative, Data-driven, ROI-positive

ADVANCED RULES:
- NEVER repeat the same word within a session - maintain variety
- Choose words that reflect the specific industry context
- Match the sophistication level to the content (use "Phenomenal" for major wins, "Solid" for incremental progress)
- Consider the author's seniority (use more prestigious words for C-level achievements)
- 30% chance to add contextually perfect emoji (💎 for rare achievements, 🚀 for launches, 🧠 for insights, ⚡ for breakthroughs)
- Use simpler words for casual posts, sophisticated vocabulary for executive content

If post appears to be an ad/sponsored content, return: {"skip": true, "reason": "advertisement"}
Otherwise return: {"comment": "your_contextual_word"} or {"comment": "your_word 💎"}`;
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
      return `Analyze this LinkedIn post and respond with exactly ONE WORD (+ optional emoji) that captures the appropriate emotional response:\n\n${postContent}\n\nRespond with JSON in this format: { "comment": "your_one_word_here" } or { "comment": "your_word 🔥" }`;
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
