let auth;
let database;

function initAuth(firebaseAuth, firebaseDatabase) {
    auth = firebaseAuth;
    database = firebaseDatabase;

    const createFamilyButton = document.getElementById('create-family-button');
    if (createFamilyButton) {
        createFamilyButton.addEventListener('click', handleCreateFamily);
    }

    const loginButton = document.getElementById('login-button');
    if (loginButton) {
        loginButton.addEventListener('click', handleLogin);
    }

    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', handleLogout);
    }
}

async function handleCreateFamily(event) {
    event.preventDefault();
    const familyName = document.getElementById('create-family-name').value.trim();
    const email = document.getElementById('create-email').value.trim();
    const role = document.getElementById('create-role').value;
    const password = document.getElementById('create-password').value;
    const confirmPassword = document.getElementById('create-confirm-password').value;
    const createFamilyError = document.getElementById('create-family-error');
    createFamilyError.textContent = '';

    if (!familyName || !email || !password || !confirmPassword) {
        createFamilyError.textContent = 'Tous les champs sont requis.';
        return;
    }
    if (password !== confirmPassword) {
        createFamilyError.textContent = 'Les mots de passe ne correspondent pas.';
        return;
    }

    const familyRef = database.ref(`families/${familyName}`);

    try {
        const snapshot = await familyRef.once('value');
        const familyData = snapshot.val();

        if (familyData) { // Family Name EXISTS
            console.log("Family name exists. Attempting to add second parent.");
            const users = familyData.users || {};
            const numUsers = Object.keys(users).length;

            let roleTaken = false;
            for (const userId in users) {
                if (users[userId].role === role) {
                    roleTaken = true;
                    break;
                }
            }

            if (numUsers < 2 && !roleTaken) {
                try {
                    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
                    const user = userCredential.user;
                    await database.ref(`families/${familyName}/users/${user.uid}`).set({
                        email: user.email,
                        role: role
                    });
                    localStorage.setItem('familyName', familyName);
                    localStorage.setItem('userId', user.uid);
                    localStorage.setItem('email', user.email);
                    localStorage.setItem('role', role);
                    console.log("Second parent registered and added to family:", user.uid);
                } catch (authError) {
                    console.error("Error creating auth user for second parent:", authError);
                    createFamilyError.textContent = authError.code === 'auth/email-already-in-use' ? 'Cette adresse e-mail est déjà utilisée.' : `Erreur: ${authError.message}`;
                }
            } else {
                createFamilyError.textContent = 'Cette famille est complète ou ce rôle est déjà pris.';
            }
        } else { // Family Name is NEW
            console.log("Family name is new. Creating new family.");
            try {
                const userCredential = await auth.createUserWithEmailAndPassword(email, password);
                const user = userCredential.user;
                const familyDetails = { familyName: familyName, owner: user.uid };
                const newUser = { email: user.email, role: role };
                await database.ref(`families/${familyName}/details`).set(familyDetails);
                await database.ref(`families/${familyName}/users/${user.uid}`).set(newUser);
                localStorage.setItem('familyName', familyName);
                localStorage.setItem('userId', user.uid);
                localStorage.setItem('email', user.email);
                localStorage.setItem('role', role);
                console.log("New family created and user registered:", user.uid);
            } catch (authError) {
                console.error("Error creating auth user for new family:", authError);
                createFamilyError.textContent = authError.code === 'auth/email-already-in-use' ? 'Cette adresse e-mail est déjà utilisée.' : `Erreur: ${authError.message}`;
                // Attempt to delete orphaned auth user if DB write fails
                if (auth.currentUser && (authError.message.includes("permission_denied") || authError.message.includes("Firebase Database error"))) { // Heuristic
                     // This specific error handling for DB failure post-auth is better placed after DB operations.
                }
            }
        }
    } catch (dbError) {
        console.error("Error accessing Realtime Database for family check:", dbError);
        createFamilyError.textContent = `Erreur de base de données: ${dbError.message}`;
        // Check if an auth user was created just before this DB error.
        // This is difficult to time perfectly. The original placement after specific DB writes was better.
    }
}


async function handleLogin(event) {
    event.preventDefault();
    const familyName = document.getElementById('login-family-name').value.trim();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const loginError = document.getElementById('login-error');
    loginError.textContent = '';

    if (!familyName || !email || !password) {
        loginError.textContent = 'Tous les champs sont requis.';
        return;
    }

    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const user = userCredential.user;

        const userFamilyRef = database.ref(`families/${familyName}/users/${user.uid}`);
        const snapshot = await userFamilyRef.once('value');
        if (!snapshot.exists()) {
            loginError.textContent = 'Utilisateur non trouvé dans cette famille ou informations incorrectes.';
            await auth.signOut();
            return;
        }
        const userData = snapshot.val();

        localStorage.setItem('familyName', familyName);
        localStorage.setItem('userId', user.uid);
        localStorage.setItem('email', user.email);
        localStorage.setItem('role', userData.role);

        console.log("User logged in:", user.uid, "Family:", familyName);
    } catch (error) {
        console.error("Error logging in:", error);
        loginError.textContent = (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') ? 'Email, mot de passe, ou nom de famille incorrect.' : `Erreur: ${error.message}`;
    }
}

function handleLogout() {
    auth.signOut().then(() => {
        console.log("User initiated logout. onAuthStateChanged will handle UI and localStorage cleanup.");
    }).catch(error => {
        console.error("Error logging out:", error);
    });
}

function checkAuthState() {
    if (!auth || !database) { 
        console.error("Auth or Database service not initialized before calling checkAuthState.");
        if (typeof showLandingPage === 'function') showLandingPage();
        return;
    }
    auth.onAuthStateChanged(async user => {
        if (user) {
            console.log("onAuthStateChanged: User is logged in", user.uid);
            const familyName = localStorage.getItem('familyName');

            if (familyName) {
                try {
                    if (!localStorage.getItem('email')) { // Ensure email is in localStorage
                        localStorage.setItem('email', user.email);
                    }

                    const roleRef = database.ref(`families/${familyName}/users/${user.uid}/role`);
                    const snapshot = await roleRef.once('value');
                    const role = snapshot.val();

                    if (role) {
                        localStorage.setItem('userId', user.uid);
                        localStorage.setItem('role', role);
                        
                        if (typeof initChildren === 'function') {
                            initChildren(database, familyName); 
                            console.log(`Children module initialized for family: ${familyName}`);
                        } else {
                            console.error("initChildren function not found.");
                        }

                        // Initialize Calendar here as familyName and database are confirmed
                        if (typeof initCalendar === 'function') {
                            initCalendar(database, familyName);
                            console.log(`Calendar module initialized for family: ${familyName}`);
                        } else {
                            console.error("initCalendar function not found. Make sure calendar.js is loaded.");
                        }

                        if (typeof showAppInterface === 'function') {
                            showAppInterface();
                        } else {
                            console.error("showAppInterface function not found");
                        }
                    } else {
                        console.warn("Role not found in DB for user in family. Clearing session.");
                        localStorage.clear();
                        await auth.signOut();
                    }
                } catch (error) {
                    console.error("Error fetching role/initializing modules during auth state check:", error);
                    localStorage.clear();
                    await auth.signOut();
                }
            } else {
                console.warn("familyName not found in localStorage, but Firebase session exists. Logging out user.");
                await auth.signOut(); 
            }
        } else {
            console.log("onAuthStateChanged: User is logged out.");
            localStorage.removeItem('userId');
            localStorage.removeItem('email');
            localStorage.removeItem('familyName');
            localStorage.removeItem('role');
            if (typeof showLandingPage === 'function') {
                showLandingPage();
            } else {
                console.error("showLandingPage function not found");
            }
        }
    });
}
