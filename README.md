# LinkedIn AI Engagement Bot

A Chrome extension that automatically finds posts in your LinkedIn feed, generates AI-powered comments using OpenAI's GPT-4o, and posts them to increase your professional engagement.

## Features

- 🔍 Automatically scans your LinkedIn feed for the latest posts
- 🤖 Uses OpenAI GPT-4o to generate contextual, professional comments
- 🎯 Supports multiple comment styles (Professional, Casual, Insightful, Supportive)
- ⚙️ Configurable number of posts to process (1-20)
- 📊 Real-time statistics and activity logging
- 🕒 Human-like delays to avoid detection
- 💾 Persistent settings storage

## Installation

1. **Download the Extension Files**
   - Download all files from this project to a folder on your computer

2. **Install in Chrome**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the folder containing the extension files

3. **Set Up OpenAI API Key**
   - Get an API key from [OpenAI Platform](https://platform.openai.com/api-keys)
   - Click the extension icon in Chrome
   - Enter your API key and click "Save"

## How to Use

1. **Navigate to LinkedIn**
   - Go to [LinkedIn.com](https://linkedin.com) and log in
   - Make sure you're on your main feed page

2. **Configure Settings**
   - Click the extension icon in your browser toolbar
   - Choose your preferred comment style
   - Set the maximum number of posts to process (default: 10)

3. **Start the Bot**
   - Click "Start Engagement"
   - The bot will automatically:
     - Scan your feed for posts
     - Generate appropriate comments
     - Post them with realistic delays
   - Monitor progress in the activity log

4. **Stop Anytime**
   - Click "Stop" to halt the bot immediately
   - View statistics for posts found, comments posted, and any errors

## Comment Styles

- **Professional**: Business-focused, formal language with industry insights
- **Casual**: Friendly, conversational tone while remaining professional
- **Insightful**: Thoughtful analysis with meaningful questions
- **Supportive**: Encouraging responses that build others up

## Important Notes

⚠️ **Use Responsibly**
- This tool is for educational purposes
- Be aware of LinkedIn's Terms of Service
- Use reasonable delays and limits to avoid account restrictions
- Monitor your account activity regularly

🔒 **Privacy & Security**
- Your API key is stored locally in Chrome storage
- No data is sent to external servers except OpenAI for comment generation
- The extension only works on LinkedIn pages

## Troubleshooting

**Bot won't start?**
- Make sure you're on LinkedIn.com
- Check that your OpenAI API key is valid
- Ensure you have sufficient OpenAI API credits

**Comments not posting?**
- LinkedIn may have updated their interface
- Try refreshing the page and restarting the bot
- Check the activity log for specific error messages

**Extension not appearing?**
- Make sure Developer mode is enabled in Chrome extensions
- Try reloading the extension from `chrome://extensions/`

## Technical Details

- Built with Manifest V3 for modern Chrome extensions
- Uses OpenAI GPT-4o model for intelligent comment generation
- Implements human-like interaction patterns with configurable delays
- Content script isolation for secure LinkedIn integration

---

**Disclaimer**: This extension is for educational purposes. Users are responsible for complying with LinkedIn's Terms of Service and using the tool ethically.