# Mahjong Scorer

A real-time mahjong score tracker synced across devices via Firebase.

**[Launch App](https://b-mar.github.io/mahjong-web/)**

## How to Use

**Playing a game:**
1. Click **New Game** to start fresh
2. Add each player's name using the **Add Player** field
3. After each round, enter scores (must sum to zero) and click **Submit**
4. The chart and table update in real time

**Saving to history:**
- Click **Add to History** to move the completed game into all-time records
- The **History** tab shows cumulative scores across all past games

**Other controls:**
- **Undo** — reverts the last action
- **Edit / Save** — inline editing of any round score in the table

## Local Development

### Prerequisites
```bash
brew install node firebase-cli
npm install
```

Java is also required for the Firebase emulator:
```bash
brew install openjdk
echo 'export PATH="/opt/homebrew/opt/openjdk/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

### Daily flow for testing on local emulator

**Terminal 1 — start the Firestore emulator:**
```bash
firebase emulators:start --only firestore
```

**Terminal 2 — seed from production, then serve:**
```bash
node seed.js && python3 -m http.server 3000
```

**Browser:**
- App: http://localhost:3000
- Emulator UI: http://localhost:4000

If changes aren't reflecting, hard refresh with `Cmd + Shift + R`.
