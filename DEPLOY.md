# 🚀 Deploy to Streamlit Cloud (5 Minutes)

## Why Streamlit Cloud?
- ✅ Completely free hosting
- ✅ No server management
- ✅ HTTPS included
- ✅ Works worldwide
- ✅ Auto-scales for players

## Option 1: Deploy WITHOUT API Key (Free Manual Entry)

### Step 1: Push to GitHub
```bash
git add .
git commit -m "Ready for Streamlit deployment"
git push origin main
```

### Step 2: Deploy to Streamlit Cloud
1. Go to [streamlit.io/cloud](https://streamlit.io/cloud)
2. Click "New app"
3. Select your GitHub repository
4. Main file path: `app.py`
5. Click "Deploy"!

That's it! Your app is live! 🎉

## Option 2: Deploy WITH API Key (Requires Billing)

### Step 1: Enable Billing
1. Go to [Google AI Studio](https://aistudio.google.com/)
2. Click on your profile → "Billing"
3. Add billing information
4. Typical cost: $1-5 per party

### Step 2: Add Secret to Streamlit Cloud
In your Streamlit Cloud app dashboard:
1. Go to "Secrets"
2. Add this secret:
   ```
   GEMINI_API_KEY=AIzaSyCd3Bf_U30uxcBBalQH2QQMjVMeTIdNvO8
   ```
3. Click "Save"

### Step 3: Deploy
Follow the same steps as Option 1

## After Deployment

Your app will be available at: `https://yourusername-bachelor-party-qa.streamlit.app`

### How Players Join:
1. Host creates the game
2. Gets a 4-character game code
3. Players visit the URL
4. Enter code to join
5. Play!

## Testing Locally
```bash
pip install streamlit google-generativeai
streamlit run app.py
```

## Need Help?
- Streamlit docs: https://docs.streamlit.io/
- Issues: Check the app automatically falls back to manual mode

## Features
- 📹 Video upload and analysis (with API)
- ✍️ Manual question entry (free)
- 🎮 Multiplayer game
- 📱 Mobile-friendly
- 🎉 Fun animations