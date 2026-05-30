// Firebase configuration (using your project credentials)
const firebaseConfig = {
    apiKey: "AIzaSyALbWDHrhratYCCq3WpAu7jZFw6S8kTg2U",
    authDomain: "pureore-capital-zambia.firebaseapp.com",
    projectId: "pureore-capital-zambia",
    storageBucket: "pureore-capital-zambia.firebasestorage.app",
    messagingSenderId: "78967797858",
    appId: "1:78967797858:web:379b9692951429c345793b",
    measurementId: "G-FQKC29NYE9"
};

// Initialize Firebase (compat version – works with the SDKs loaded in HTML)
firebase.initializeApp(firebaseConfig);

// Firebase services used across the app
const db = firebase.firestore();
const auth = firebase.auth();
const storage = firebase.storage();

// Optional: Enable persistence so users stay logged in
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
    .catch(error => console.warn("Persistence error:", error));