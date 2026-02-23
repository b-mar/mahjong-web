### Daily flow for testing on local emulator
# Terminal 1 — start the Firestore emulator
firebase emulators:start --only firestore

# Terminal 2 — seed from production, then serve
node seed.js && python3 -m http.server 3000

Open the app at http://localhost:3000. Inspect/edit emulator data at http://localhost:4000.
May need to reset browser cache Cmd + Shift + R
