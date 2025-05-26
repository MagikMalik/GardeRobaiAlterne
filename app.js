const firebaseConfig = {
  apiKey: "AIzaSyBB-xtM869XDak8ckEzRQAqdEJ7yEOr5f4",
  authDomain: "gardealterne-b6b17.firebaseapp.com",
  projectId: "gardealterne-b6b17",
  storageBucket: "gardealterne-b6b17.appspot.com",
  messagingSenderId: "275193359676",
  appId: "1:275193359676:web:1eb29392463a519ea00239"
};

if (typeof firebase !== 'undefined') {
  const app = firebase.initializeApp(firebaseConfig);
  console.log("Firebase initialized successfully.");
  const auth = firebase.auth();
  const database = firebase.database();

  if (typeof initAuth === 'function') {
    initAuth(auth, database); 
  } else {
    console.error("initAuth function not found. Make sure auth.js is loaded and defines it.");
  }

  // Call checkAuthState to handle initial UI and auth state listening
  if (typeof checkAuthState === 'function') {
    checkAuthState(); // This will now manage showing landing/app page
  } else {
    console.error("checkAuthState function not found. Make sure auth.js is loaded and defines it.");
    if (typeof showLandingPage === 'function') {
        showLandingPage(); // Fallback
    }
  }

  // Initialize Calendar
  // This should ideally be called when the app interface is shown,
  // but for now, we'll call it after auth setup.
  // If initCalendar relies on elements only visible in the app interface,
  // it might be better to call it from within showAppInterface in ui.js,
  // or ensure elements are present even if hidden.
  if (typeof initCalendar === 'function') {
    initCalendar();
  } else {
    console.error("initCalendar function not found. Make sure calendar.js is loaded.");
  }

} else {
  console.error("Firebase SDK not loaded. Make sure to include it in your HTML.");
   if (typeof showLandingPage === 'function') {
        showLandingPage(); // Fallback
    }
}
