// FIREBASE CONFIGURATION
// 1. Go to https://console.firebase.google.com/
// 2. Click "Add Project" and follow the steps.
// 3. Once created, click the web icon (</>) to add a web app.
// 4. Copy the "firebaseConfig" object from there and paste it below.

const firebaseConfig = {
    apiKey: "AIzaSyBuxGhq5odJDLNRZ0TDGJzA4DFSm_2eXq0",
    authDomain: "varshini-web.firebaseapp.com",
    projectId: "varshini-web",
    storageBucket: "varshini-web.firebasestorage.app",
    messagingSenderId: "578486220910",
    appId: "1:578486220910:web:90e214a9c8e56dca8e0e7f",
    measurementId: "G-EPEBTF4ZRM"
};

// Initialize Firebase
let app, db, auth;

try {
    if (firebaseConfig.apiKey !== "YOUR_API_KEY") {
        app = firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        auth = firebase.auth();
        console.log("✅ Firebase Connected");
    } else {
        console.warn("⚠️ Firebase keys not set. Please update js/firebase-config.js");
    }
} catch (e) {
    console.error("Firebase Init Error:", e);
}
