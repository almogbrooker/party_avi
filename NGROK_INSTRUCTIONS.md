# 📱 Sharing Your Game with Players

## Local WiFi Players (Easiest)
The app automatically generates correct links:
1. Create game in app
2. Click WhatsApp share
3. Players on same WiFi can join directly

## Players Outside Your WiFi (Use ngrok)

### Step 1: Install ngrok (one time)
```bash
brew install ngrok
```

### Step 2: Start ngrok
```bash
ngrok http 5173
```

### Step 3: Get Your Public URL
Ngrok will show something like:
```
Forwarding  https://random-words-abcd.ngrok-free.app -> http://localhost:5173
```

### Step 4: Share the ngrok URL
Instead of the local IP, share:
`https://random-words-abcd.ngrok-free.app`

### Step 5: Players Join
1. Players click the ngrok link
2. The game code is already in the URL
3. They just need to enter their name

## Pro Tips:
- ngrok is FREE for basic use
- The ngrok URL changes each time you run it
- Keep ngrok running during the party
- Test the link yourself first!

## Example WhatsApp Message:
```
יאללה כולם להיכנס למשחק!
🔗 https://abc123.ngrok.io
קוד: XYZW
```