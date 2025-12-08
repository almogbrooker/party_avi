# 🎮 Host the React App Locally (Same UI!)

## Quick Setup - Let Others Play from Your PC

### Method 1: Using ngrok (Recommended - Easiest)

1. **Install ngrok**:
   ```bash
   # macOS
   brew install ngrok

   # Or download from: https://ngrok.com/download
   ```

2. **Start your app**:
   ```bash
   # If you have npm/node installed
   npm install
   npm run dev -- --host 0.0.0.0

   # OR use Python server
   python -m http.server 8000
   ```

3. **Share with ngrok**:
   ```bash
   ngrok http 5173  # For Vite dev server
   # OR
   ngrok http 8000  # For Python server
   ```

4. **Get your public URL**:
   ngrok will give you a URL like: `https://random-words.ngrok-free.app`

   Share this URL with all players - they can play from anywhere!

### Method 2: Local Network Only

1. **Find your IP**:
   ```bash
   # macOS/Linux
   ifconfig | grep "inet " | grep -v 127.0.0.1

   # Windows
   ipconfig
   ```

2. **Start server**:
   ```bash
   npm run dev -- --host 0.0.0.0
   ```

3. **Players connect to**:
   `http://YOUR_IP:5173`

### Method 3: Using serve (No npm needed)

1. **Install serve**:
   ```bash
   npm install -g serve
   ```

2. **Serve your app**:
   ```bash
   serve -s . -l 8000
   ```

3. **Use ngrok**:
   ```bash
   ngrok http 8000
   ```

## How PeerJS Works (The Magic)

Your app uses **PeerJS** for P2P connections:
- ✅ No server required
- ✅ Players connect directly to each other
- ✅ Works through NAT/firewall
- ✅ Low latency

The only thing needed is:
- Host creates a game
- Gets a 4-character code
- Players join with that code
- All connections are P2P (direct)

## Testing Steps

1. **Open two browsers** on your computer
2. **One creates game** (host)
3. **Other joins with code** (player)
4. **Test video upload and Q&A**

## For the Party

### Best Setup:
1. **Connect laptop to good WiFi**
2. **Run ngrok** to get public URL
3. **Share URL with guests**
4. **Everyone plays on their phones**

### Requirements for Players:
- Smartphone or laptop
- Internet connection
- Web browser (Chrome/Safari best)

## Advantages of Local Hosting

✅ **Same beautiful UI** as original
✅ **No changes to the code**
✅ **Free to host**
✅ **Full control**
✅ **Works offline** (local network)
✅ **No API limits**
✅ **Instant video analysis** (manual entry)

## Tips for Success

- 📶 Use strong WiFi connection
- 🔋 Keep laptop plugged in
- 📱 Test on mobile before party
- 👥 Limit to 10-15 players for best performance
- 🎥 Have videos ready on the host device

## Troubleshooting

**Players can't connect?**
- Check ngrok is running
- Verify the URL is correct
- Make sure host's firewall allows connections

**Video not uploading?**
- Check file size (under 100MB)
- Use MP4 format
- Try Chrome browser

**Game lag?**
- Too many players (limit to 10)
- Poor WiFi connection
- Browser issues (refresh page)