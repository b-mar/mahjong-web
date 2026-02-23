const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc, setDoc, connectFirestoreEmulator } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyBudm3kTAmwHikngh4AlmjekoURZTcXqG4",
  authDomain: "mahjong-web.firebaseapp.com",
  projectId: "mahjong-web",
};

// Read from production
const prodApp = initializeApp(firebaseConfig, 'prod');
const prodDb = getFirestore(prodApp);

// Write to emulator
const emuApp = initializeApp({ projectId: 'mahjong-web' }, 'emulator');
const emuDb = getFirestore(emuApp);
connectFirestoreEmulator(emuDb, 'localhost', 8080);

async function seed() {
  const snapshot = await getDoc(doc(prodDb, 'games', 'default'));
  if (!snapshot.exists()) return console.log('No production data found');
  await setDoc(doc(emuDb, 'games', 'default'), snapshot.data());
  console.log('Emulator seeded with production data');
  process.exit(0);
}

seed().catch(console.error);
