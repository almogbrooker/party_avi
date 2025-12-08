# Bachelor Party QA Game - Streamlit Version

## Overview
This is a Streamlit-compatible version of the Bachelor Party Q&A game, designed to run on Streamlit Cloud.

## Features
- 🎮 Create and join multiplayer games
- 📹 Upload and analyze videos of the bride-to-be using Google Gemini AI
- ❓ Extract questions and answers automatically from videos
- 🏆 Track scores and game progress
- 📱 Mobile-friendly interface

## How it Works

### For the Game Host:
1. Upload a video of the bride-to-be answering questions
2. The AI (Google Gemini) analyzes the video and extracts all Q&A pairs
3. A game code is generated
4. Share the game code with players
5. Start the game and reveal answers

### For Players:
1. Enter the game code to join
2. Guess answers to questions about what the bride said
3. Earn points for correct answers
4. Enjoy the fun!

## Deployment on Streamlit Cloud

### Prerequisites:
- Google Gemini API key
- Streamlit Cloud account

### Steps:

1. **Fork this repository** to your GitHub account

2. **Set up secrets in Streamlit Cloud:**
   - Go to your Streamlit Cloud dashboard
   - Select your app
   - Go to "Secrets" section
   - Add the following secret:
     ```
     GEMINI_API_KEY=your_google_gemini_api_key_here
     ```

3. **Deploy the app:**
   - Connect your GitHub repository to Streamlit Cloud
   - Select the repository
   - Configure the deployment:
     - Main file path: `app.py`
     - Python version: 3.9 or higher
   - Click "Deploy"

### Environment Variables
Make sure to set these secrets in Streamlit Cloud:
- `GEMINI_API_KEY`: Your Google Gemini API key (required)

## Getting Google Gemini API Key

**Important Note**: Gemini API video analysis requires a **paid Google Cloud project**. Free API keys won't work with video files.

### Option 1: Get a Paid Gemini API Key (Recommended for large events)
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable billing for the project
4. Enable the Gemini API
5. Create an API key
6. Add the key to your Streamlit Cloud secrets

### Option 2: Use Manual Entry (Free)
The app now includes a manual entry mode that allows you to:
- Watch the video
- Manually enter questions and answers
- Set timestamps for each question
- Proceed with the game normally

### Option 3: Alternative AI Services
You can modify the app to use:
- OpenAI Whisper for transcription + GPT for analysis
- Azure Speech Services
- AWS Transcribe

The manual entry option is fully functional and doesn't require any API keys!

## Local Development

### Setup:
```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set environment variable
export GEMINI_API_KEY=your_api_key_here  # On Windows: set GEMINI_API_KEY=your_api_key_here

# Run the app
streamlit run app.py
```

## Architecture
- **Backend**: Streamlit (Python)
- **AI Processing**: Google Gemini 2.0 Flash
- **State Management**: Streamlit session state
- **File Processing**: In-memory file handling with auto-cleanup

## Key Differences from Original React Version
1. **No PeerJS**: Uses Streamlit's session state for game state management
2. **Simplified Communication**: All players interact through the same Streamlit instance
3. **AI Integration**: Direct Python integration with Google Gemini API
4. **Deployment Ready**: Fully compatible with Streamlit Cloud

## Limitations
- Single instance (all players use the same app instance)
- No real-time P2P communication like the original
- Simpler multiplayer experience (works well for small groups)

## Support
For issues or questions, please create an issue in the GitHub repository.