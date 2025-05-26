let auth;
let database;

function initAuth(firebaseAuth, firebaseDatabase) {
    auth = firebaseAuth;
    database = firebaseDatabase;

    const createFamilyButton = document.getElementById('create-family-button');
    if (createFamilyButton) createFamilyButton.addEventListener('click', handleCreateFamily);

    const loginButton = document.getElementById('login-button');
    if (loginButton) loginButton.addEventListener('click', handleLogin);

    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) logoutButton.addEventListener('click', handleLogout);
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
        createFamilyError.textContent = 'Tous les champs sont requis.'; return;
    }
    if (password !== confirmPassword) {
        createFamilyError.textContent = 'Les mots de passe ne correspondent pas.'; return;
    }

    const familyRef = database.ref(`families/${familyName}`);
    try {
        const snapshot = await familyRef.once('value');
        const familyData = snapshot.val();
        if (familyData) {
            const users = familyData.users || {};
            const numUsers = Object.keys(users).length;
            let roleTaken = false;
            for (const userId in users) { if (users[userId].role === role) { roleTaken = true; break; } }
            if (numUsers < 2 && !roleTaken) {
                try {
                    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
                    const user = userCredential.user;
                    await database.ref(`families/${familyName}/users/${user.uid}`).set({ email: user.email, role: role });
                    localStorage.setItem('familyName', familyName); localStorage.setItem('userId', user.uid);
                    localStorage.setItem('email', user.email); localStorage.setItem('role', role);
                } catch (authError) { createFamilyError.textContent = authError.code === 'auth/email-already-in-use' ? 'Cette adresse e-mail est déjà utilisée.' : `Erreur: ${authError.message}`; }
            } else { createFamilyError.textContent = 'Cette famille est complète ou ce rôle est déjà pris.'; }
        } else {
            try {
                const userCredential = await auth.createUserWithEmailAndPassword(email, password);
                const user = userCredential.user;
                await database.ref(`families/${familyName}/details`).set({ familyName: familyName, owner: user.uid });
                await database.ref(`families/${familyName}/users/${user.uid}`).set({ email: user.email, role: role });
                localStorage.setItem('familyName', familyName); localStorage.setItem('userId', user.uid);
                localStorage.setItem('email', user.email); localStorage.setItem('role', role);
            } catch (authError) { createFamilyError.textContent = authError.code === 'auth/email-already-in-use' ? 'Cette adresse e-mail est déjà utilisée.' : `Erreur: ${authError.message}`; }
        }
    } catch (dbError) { createFamilyError.textContent = `Erreur de base de données: ${dbError.message}`; }
}

async function handleLogin(event) {
    event.preventDefault();
    const familyName = document.getElementById('login-family-name').value.trim();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const loginError = document.getElementById('login-error');
    loginError.textContent = '';

    if (!familyName || !email || !password) { loginError.textContent = 'Tous les champs sont requis.'; return; }

    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const user = userCredential.user;
        const userFamilyRef = database.ref(`families/${familyName}/users/${user.uid}`);
        const snapshot = await userFamilyRef.once('value');
        if (!snapshot.exists()) {
            loginError.textContent = 'Utilisateur non trouvé dans cette famille ou informations incorrectes.';
            await auth.signOut(); return;
        }
        const userData = snapshot.val();
        localStorage.setItem('familyName', familyName); localStorage.setItem('userId', user.uid);
        localStorage.setItem('email', user.email); localStorage.setItem('role', userData.role);
    } catch (error) { loginError.textContent = (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') ? 'Email, mot de passe, ou nom de famille incorrect.' : `Erreur: ${error.message}`; }
}

function handleLogout() {
    auth.signOut().catch(error => console.error("Error logging out:", error));
}

async function fetchFamilyUsersData(db, familyName) {
    const usersRef = db.ref(`families/${familyName}/users`);
    try {
        const snapshot = await usersRef.once('value');
        return snapshot.val() || {};
    } catch (error) { console.error("Error fetching family users data in auth.js:", error); return {}; }
}

async function fetchFamilyChildrenData(db, familyName) {
    const childrenRef = db.ref(`families/${familyName}/children`);
    try {
        const snapshot = await childrenRef.once('value');
        return snapshot.val() || {};
    } catch (error) { console.error("Error fetching family children data in auth.js:", error); return {}; }
}

function displayUserProfile() {
    const familyName = localStorage.getItem('familyName');
    const userRole = localStorage.getItem('role');
    const userEmail = localStorage.getItem('email');

    const profileFamilyNameEl = document.getElementById('profile-family-name');
    const profileRoleEl = document.getElementById('profile-role');
    const profileEmailEl = document.getElementById('profile-email');

    if (profileFamilyNameEl) profileFamilyNameEl.textContent = familyName || '-';
    if (profileRoleEl) profileRoleEl.textContent = userRole || '-';
    if (profileEmailEl) profileEmailEl.textContent = userEmail || '-';
    
    console.log("User profile displayed:", { familyName, userRole, userEmail });
}


function checkAuthState() {
    if (!auth || !database) { 
        console.error("Auth or Database service not initialized before calling checkAuthState.");
        if (typeof showLandingPage === 'function') showLandingPage();
        return;
    }
    auth.onAuthStateChanged(async user => {
        if (user) {
            const familyName = localStorage.getItem('familyName');
            const userId = user.uid; 
            const userEmail = user.email;

            if (familyName) {
                try {
                    // It's good practice to ensure localStorage is consistent with the auth object upon state change.
                    localStorage.setItem('userId', userId);
                    localStorage.setItem('email', userEmail); // User's email from auth object is source of truth

                    const roleRef = database.ref(`families/${familyName}/users/${userId}/role`);
                    const roleSnapshot = await roleRef.once('value');
                    const userRole = roleSnapshot.val(); 

                    if (userRole) {
                        localStorage.setItem('role', userRole); 

                        // Display user profile information
                        displayUserProfile(); // Call after all relevant localStorage items are set

                        const familyUsers = await fetchFamilyUsersData(database, familyName);
                        const familyChildren = await fetchFamilyChildrenData(database, familyName); 

                        if (typeof initChildren === 'function') {
                            initChildren(database, familyName, userId); // Pass userId to initChildren
                        } else { console.error("initChildren function not found."); }

                        if (typeof initCalendar === 'function') {
                            initCalendar(database, familyName);
                        } else { console.error("initCalendar function not found."); }
                        
                        if (typeof initTodo === 'function') {
                            initTodo(database, familyName, userId, familyUsers);
                        } else { console.error("initTodo function not found."); }

                        if (typeof initNotes === 'function') {
                            initNotes(database, familyName, userId, userRole, familyChildren);
                        } else { console.error("initNotes function not found."); }

                        if (typeof showAppInterface === 'function') {
                            showAppInterface();
                        } else { console.error("showAppInterface function not found"); }

                    } else { 
                        console.warn("Role not found in DB for user in family. Clearing session.");
                        localStorage.clear(); await auth.signOut();
                    }
                } catch (error) { 
                    console.error("Error during auth state check (role/init modules):", error);
                    localStorage.clear(); await auth.signOut();
                }
            } else { 
                console.warn("familyName not found in localStorage, but Firebase session exists. Logging out.");
                await auth.signOut(); 
            }
        } else { 
            console.log("onAuthStateChanged: User is logged out.");
            localStorage.clear(); 
            if (typeof showLandingPage === 'function') {
                showLandingPage();
            } else { console.error("showLandingPage function not found"); }
        }
    });
}
