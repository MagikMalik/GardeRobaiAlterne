const firebaseConfig = {
  apiKey: "AIzaSyBB-xtM869XDak8ckEzRQAqdEJ7yEOr5f4",
  authDomain: "gardealterne-b6b17.firebaseapp.com",
  databaseURL: "https://gardealterne-b6b17-default-rtdb.firebaseio.com", // Added this line
  projectId: "gardealterne-b6b17",
  storageBucket: "gardealterne-b6b17.appspot.com", // Ensured standard format
  messagingSenderId: "275193359676",
  appId: "1:275193359676:web:1eb29392463a519ea00239"
};

if (typeof firebase !== 'undefined') {
  const app = firebase.initializeApp(firebaseConfig);
  console.log("Firebase initialized successfully with databaseURL.");
  const auth = firebase.auth();
  const database = firebase.database(); // This should now work without warnings/errors

  if (typeof initAuth === 'function') {
    initAuth(auth, database); 
  } else {
    console.error("initAuth function not found. Make sure auth.js is loaded and defines it.");
  }

  // Call checkAuthState to handle initial UI and auth state listening
  if (typeof checkAuthState === 'function') {
    checkAuthState(); 
  } else {
    console.error("checkAuthState function not found. Make sure auth.js is loaded and defines it.");
    if (typeof showLandingPage === 'function') {
        showLandingPage(); // Fallback
    }
  }

  // Note: initCalendar is called within checkAuthState in auth.js after user and family are confirmed.
  // No direct call to initCalendar here is needed as per previous subtask logic.

} else {
  console.error("Firebase SDK not loaded. Make sure to include it in your HTML.");
   if (typeof showLandingPage === 'function') {
        showLandingPage(); // Fallback
    }
}
