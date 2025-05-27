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
                    // Set localStorage items immediately after user object is available
                    localStorage.setItem('familyName', familyName);
                    localStorage.setItem('userId', user.uid);
                    localStorage.setItem('email', user.email);
                    localStorage.setItem('role', role);
                    // Then, perform database operations
                    await database.ref(`families/${familyName}/users/${user.uid}`).set({ email: user.email, role: role });
                } catch (authError) { createFamilyError.textContent = authError.code === 'auth/email-already-in-use' ? 'Cette adresse e-mail est déjà utilisée.' : `Erreur: ${authError.message}`; }
            } else { createFamilyError.textContent = 'Cette famille est complète ou ce rôle est déjà pris.'; }
        } else {
            try {
                const userCredential = await auth.createUserWithEmailAndPassword(email, password);
                const user = userCredential.user;
                // Set localStorage items immediately after user object is available
                localStorage.setItem('familyName', familyName);
                localStorage.setItem('userId', user.uid);
                localStorage.setItem('email', user.email);
                localStorage.setItem('role', role);
                // Then, perform database operations
                await database.ref(`families/${familyName}/details`).set({ familyName: familyName, owner: user.uid });
                await database.ref(`families/${familyName}/users/${user.uid}`).set({ email: user.email, role: role });
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
        // Set essential items immediately after user object is available
        localStorage.setItem('familyName', familyName);
        localStorage.setItem('userId', user.uid);
        localStorage.setItem('email', user.email);

        const userFamilyRef = database.ref(`families/${familyName}/users/${user.uid}`);
        const snapshot = await userFamilyRef.once('value');
        if (!snapshot.exists()) {
            loginError.textContent = 'Utilisateur non trouvé dans cette famille ou informations incorrectes.';
            // Clear potentially incorrect localStorage items if user is not found in the family
            localStorage.removeItem('familyName');
            localStorage.removeItem('userId');
            localStorage.removeItem('email');
            await auth.signOut(); return;
        }
        const userData = snapshot.val();
        // Set role after fetching userData
        localStorage.setItem('role', userData.role);
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
    const profileRoleElHeader = document.getElementById('profile-roleheader');
    const profileEmailEl = document.getElementById('profile-email');

    if (profileFamilyNameEl) profileFamilyNameEl.textContent = familyName || '-';
    if (profileRoleEl) profileRoleEl.textContent = userRole || '-';
    if (profileRoleElHeader) profileRoleElHeader.textContent = userRole || '-';
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
            // Step 1: Ensure localStorage has userId and email from the auth user object.
            localStorage.setItem('userId', user.uid);
            localStorage.setItem('email', user.email);
            console.log(`checkAuthState: User ${user.uid} detected. userId and email set in localStorage.`);

            // Step 2: Let familyName = localStorage.getItem('familyName');
            let familyName = localStorage.getItem('familyName');
            let userRole = localStorage.getItem('role'); // Also get role, might be there

            // Step 3: If familyName is null or undefined
            if (!familyName) {
                console.log(`familyName not found in localStorage. Attempting to fetch from database for user ${user.uid}.`);
                try {
                    const familiesSnapshot = await database.ref('families').once('value');
                    let foundFamilyName = null;
                    let foundUserRole = null;

                    if (familiesSnapshot.exists()) {
                        familiesSnapshot.forEach(potentialFamilySnapshot => {
                            const potentialFamilyName = potentialFamilySnapshot.key;
                            const userDataSnapshot = potentialFamilySnapshot.child('users/' + user.uid);

                            if (userDataSnapshot.exists()) {
                                foundFamilyName = potentialFamilyName;
                                foundUserRole = userDataSnapshot.child('role').val();
                                
                                console.log(`User ${user.uid} found in family ${foundFamilyName} with role ${foundUserRole}. Storing in localStorage.`);
                                localStorage.setItem('familyName', foundFamilyName);
                                localStorage.setItem('role', foundUserRole);
                                
                                familyName = foundFamilyName; // Update local variable
                                userRole = foundUserRole;   // Update local variable
                                return true; // Break forEach loop
                            }
                        });
                    }

                    if (!foundFamilyName) {
                        console.warn(`Authenticated user ${user.uid} not found in any family in the database. Logging out.`);
                        localStorage.clear();
                        await auth.signOut();
                        if (typeof showLandingPage === 'function') showLandingPage(); // Redirect to landing/login
                        return; // Halt further execution
                    }
                } catch (error) {
                    console.error(`Error fetching families from database for user ${user.uid}:`, error);
                    localStorage.clear();
                    await auth.signOut();
                    if (typeof showLandingPage === 'function') showLandingPage();
                    return; // Halt further execution
                }
            }

            // Step 4: If familyName is now available (either initially or fetched)
            // userRole might have been fetched in step 3d.iii.2 as well.
            if (familyName) {
                // 4a. Retrieve userRole = localStorage.getItem('role'); (already done or updated)
                // 4b. If userRole is still null or undefined
                if (!userRole) {
                    console.log(`Role not found in localStorage for user ${user.uid} in family ${familyName}. Attempting to fetch from DB.`);
                    try {
                        const roleSnapshot = await database.ref(`families/${familyName}/users/${user.uid}/role`).once('value');
                        if (roleSnapshot.exists()) {
                            userRole = roleSnapshot.val();
                            localStorage.setItem('role', userRole);
                            console.log(`Role ${userRole} fetched from DB and stored in localStorage for user ${user.uid}.`);
                        } else {
                            console.warn(`Role still not found in DB for user ${user.uid} in family ${familyName} after specific fetch.`);
                        }
                    } catch (error) {
                        console.error(`Error fetching role for user ${user.uid} in family ${familyName}:`, error);
                        // Don't necessarily sign out here, the next check will handle it
                    }
                }

                // 4c. If userRole is now available
                if (userRole) {
                    console.log(`Proceeding with app initialization for user ${user.uid}, family ${familyName}, role ${userRole}.`);
                    // Ensure all critical items are definitely set before proceeding
                    localStorage.setItem('familyName', familyName);
                    localStorage.setItem('userId', user.uid);
                    localStorage.setItem('email', user.email);
                    localStorage.setItem('role', userRole);

                    displayUserProfile(); 

                    const familyUsers = await fetchFamilyUsersData(database, familyName);
                    const familyChildren = await fetchFamilyChildrenData(database, familyName);

                    if (typeof initChildren === 'function') initChildren(database, familyName, user.uid);
                    else console.error("initChildren function not found.");

                    if (typeof initCalendar === 'function') initCalendar(database, familyName);
                    else console.error("initCalendar function not found.");
                    
                    if (typeof initTodo === 'function') initTodo(database, familyName, user.uid, familyUsers);
                    else console.error("initTodo function not found.");

                    if (typeof initNotes === 'function') initNotes(database, familyName, user.uid, userRole, familyChildren);
                    else console.error("initNotes function not found.");

                    if (typeof showAppInterface === 'function') showAppInterface();
                    else console.error("showAppInterface function not found");

                } else { // 4d. If userRole is still null or undefined
                    console.warn(`Role could not be determined for user ${user.uid} in family ${familyName}. Clearing session and signing out.`);
                    localStorage.clear();
                    await auth.signOut();
                    if (typeof showLandingPage === 'function') showLandingPage();
                }
            } else {
                // This case should ideally be covered by step 3e.i (user not found in any family)
                // However, as a fallback, if familyName is somehow still null here:
                console.warn(`familyName is unexpectedly null for authenticated user ${user.uid} after recovery attempts. Logging out.`);
                localStorage.clear();
                await auth.signOut();
                if (typeof showLandingPage === 'function') showLandingPage();
            }
        } else {
            // Step 5: User is logged out
            console.log("onAuthStateChanged: User is logged out.");
            localStorage.clear(); 
            if (typeof showLandingPage === 'function') {
                showLandingPage();
            } else { console.error("showLandingPage function not found"); }
        }
    });
}

// Helper function to get the current user's role
// Assumes familyName is available in localStorage and role is at families/{familyName}/users/{userId}/role
function getCurrentUserRole() {
    return new Promise((resolve, reject) => {
        const user = auth.currentUser; // Using the global 'auth' from initAuth
        if (user) {
            const userId = user.uid;
            const familyName = localStorage.getItem('familyName');
            if (!familyName) {
                console.warn("getCurrentUserRole: familyName not found in localStorage.");
                return resolve("Rôle inconnu (famille non spécifiée)");
            }
            // Path based on observed structure in auth.js
            database.ref(`families/${familyName}/users/${userId}/role`).once('value')
                .then(snapshot => {
                    const role = snapshot.val();
                    resolve(role || "Rôle inconnu");
                })
                .catch(error => {
                    console.error("Error fetching user role from Firebase:", error);
                    reject("Erreur récupération du rôle: " + error.message);
                });
        } else {
            console.log("getCurrentUserRole: No user logged in.");
            resolve("Utilisateur non connecté"); // Or reject, depending on desired handling
        }
    });
}

// Helper function to get the other parent's email
// Assumes familyName is in localStorage and users are under families/{familyName}/users/
function getOtherParentEmail() {
    return new Promise((resolve, reject) => {
        const currentUser = auth.currentUser; // Using the global 'auth'
        if (!currentUser) {
            console.log("getOtherParentEmail: No user logged in.");
            return reject("Utilisateur non connecté.");
        }
        const currentUserId = currentUser.uid;
        const familyName = localStorage.getItem('familyName');

        if (!familyName) {
            console.warn("getOtherParentEmail: familyName not found in localStorage.");
            return reject("Famille non spécifiée pour trouver l'autre parent.");
        }

        const familyUsersRef = database.ref(`families/${familyName}/users`);
        familyUsersRef.once('value')
            .then(snapshot => {
                const users = snapshot.val();
                if (!users) {
                    return reject("Aucun utilisateur trouvé dans la famille.");
                }
                
                let otherParentUserId = null;
                for (const userIdInFamily in users) {
                    if (userIdInFamily !== currentUserId) {
                        otherParentUserId = userIdInFamily;
                        break; // Assuming only two users (parents) per family for simplicity
                    }
                }

                if (!otherParentUserId) {
                    return reject("Autre parent non trouvé dans la famille.");
                }

                // Email is stored directly under the user's node in the family's user list
                const otherParentEmail = users[otherParentUserId].email;
                if (otherParentEmail) {
                    resolve(otherParentEmail);
                } else {
                    reject("Email de l'autre parent non trouvé.");
                }
            })
            .catch(error => {
                console.error("Error fetching family users for getOtherParentEmail:", error);
                reject("Erreur récupération des membres de la famille: " + error.message);
            });
    });
}
