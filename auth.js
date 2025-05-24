// auth.js

// Firebase app, auth, and db are assumed to be initialized globally in index.html
let currentUserUID = null;
let currentFamilyId = null; // To store the family/shared plan ID
let firestoreListeners = []; // Array to hold unsubscribe functions for listeners

// Function to detach all active Firestore listeners
function detachFirestoreListeners() {
    console.log("Detaching Firestore listeners. Count:", firestoreListeners.length);
    firestoreListeners.forEach(unsubscribe => {
        try {
            unsubscribe();
        } catch (error) {
            console.error("Error unsubscribing a listener:", error);
        }
    });
    firestoreListeners = []; // Reset the array
}

// Helper function to manage button states
function setButtonsDisabledState(disabled) {
    const buttonIds = [
        'mainChildFormButton', 'saveTaskFormButton', 'applyCustodyConfigButton', 
        'addExceptionButton', 'saveAccountSettingsButton', 'saveTransitionSettingsButton',
        'saveDisplayPreferencesButton', 'addTransitionLocationButton', 'addTaskCategoryButton',
        'clearActionHistoryButton', 'exportDataButton', 'exportCsvButton', 'applyStatsFiltersButton', 'exportStatsButton',
        'showNewTaskFormButton' // Add this button as well
        // Note: Buttons within dynamically generated lists (like confirmTransition) are not handled here.
    ];
    buttonIds.forEach(id => {
        const button = document.getElementById(id);
        if (button) {
            button.disabled = disabled;
        }
    });
    // Special handling for importDataInput as it's an input field
    const importDataInput = document.getElementById('importDataInput');
    if (importDataInput) {
        importDataInput.disabled = disabled;
    }
}


// Auth state listener
firebase.auth().onAuthStateChanged(async (user) => {
    const loginForm = document.getElementById('loginForm');
    const registrationForm = document.getElementById('registrationForm'); 
    const userDetails = document.getElementById('userDetails');
    const userEmailDisplay = document.getElementById('userEmailDisplay');
    const authError = document.getElementById('authError');
    const registrationError = document.getElementById('registrationError'); 
    const mainAppHeader = document.getElementById('mainAppHeader'); 

    const mainTabContentIds = ['dashboard', 'calendar', 'transitions', 'children', 'tasks', 'stats'];
    const settingsContentWrapperIds = ['mainSettingsControls', 'mainSettingsDataManagementWrapper'];


    if (typeof window.settingsData === 'undefined') {
        console.warn('settingsData not defined globally. Initializing with defaults.');
        window.settingsData = { theme: 'light', parentsColors: { parent1: '#4299e1', parent2: '#ed64a6' }, parent1Name: 'Parent 1', parent2Name: 'Parent 2', custodyModel: 'week-alt', cycleStartDate: new Date().toISOString().split('T')[0], defaultTransitionTime: '18:00', taskCategories: [], transitionLocations: [], familyId: null };
    } else {
        window.settingsData.familyId = window.settingsData.familyId || null;
    }

    if (user) {
        currentUserUID = user.uid;
        if (userEmailDisplay) userEmailDisplay.textContent = `Connecté: ${user.email}`;
        
        console.log("User logged in (auth.js):", user.email, "UID:", user.uid);

        try {
            const userDocRef = firebase.firestore().collection('users').doc(user.uid);
            const userDoc = await userDocRef.get();

            if (userDoc.exists) {
                const userData = userDoc.data();
                currentFamilyId = userData.familyId; 
                console.log("onAuthStateChanged: currentFamilyId (local var) successfully set to:", currentFamilyId, "for user:", user.email);
                
                if (!currentFamilyId) {
                    console.error(`User ${user.uid} (email: ${userData.email}) exists but has no familyId. Signing out.`);
                    if (authError) authError.textContent = "Erreur: Compte utilisateur incomplet (ID de famille manquant). Veuillez vous réinscrire ou contacter le support.";
                    await firebase.auth().signOut(); 
                    return; 
                }
                
                window.settingsData.familyId = currentFamilyId; 
                console.log("onAuthStateChanged: window.settingsData.familyId set to:", window.settingsData.familyId);


                const familySettingsDocRef = firebase.firestore().collection('families').doc(currentFamilyId).collection('settings').doc('config');
                const familySettingsDoc = await familySettingsDocRef.get();
                
                if (familySettingsDoc.exists) {
                    const familySettings = familySettingsDoc.data();
                    window.settingsData = { ...window.settingsData, ...familySettings }; 
                    console.log("Initial family settings loaded for familyId:", currentFamilyId);
                } else {
                    console.error(`Critical error: Settings document ('config') missing for familyId: ${currentFamilyId}. User: ${user.uid}. Signing out.`);
                    if (authError) authError.textContent = "Erreur critique: Configuration de famille introuvable. Déconnexion.";
                    await firebase.auth().signOut(); 
                    return; 
                }
            } else {
                console.error(`User ${user.uid} (email: ${user.email}) authenticated but no user document found in Firestore. Signing out.`);
                if (authError) authError.textContent = "Profil utilisateur non trouvé. Votre inscription est peut-être incomplète. Veuillez vous réinscrire ou contacter le support.";
                await firebase.auth().signOut(); 
                return; 
            }
        } catch (err) {
            console.error("Error during user data/settings processing in onAuthStateChanged (auth.js):", err);
            if (authError) authError.textContent = "Erreur lors du chargement des données du profil. Veuillez réessayer.";
            await firebase.auth().signOut(); 
            return;
        }
        
        if (typeof window.loadFirebaseData === 'function') await window.loadFirebaseData();
        if (typeof window.updateGlobalParentNameDisplays === 'function') window.updateGlobalParentNameDisplays();

        if (mainAppHeader) mainAppHeader.classList.remove('hidden');

        mainTabContentIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.remove('hidden');
        });
        settingsContentWrapperIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.remove('hidden');
        });
        
        if (loginForm) loginForm.classList.add('hidden');
        if (registrationForm) registrationForm.classList.add('hidden');
        if (userDetails) userDetails.classList.remove('hidden');
        if (authError) authError.textContent = '';
        if (registrationError) registrationError.textContent = '';

        console.log("onAuthStateChanged: User login processing complete. UI visible. appIsReady will be set to true next.");
        window.appIsReady = true;
        console.log("onAuthStateChanged: appIsReady set to true. currentFamilyId (local var):", currentFamilyId, "window.settingsData.familyId:", window.settingsData.familyId);
        setButtonsDisabledState(false); // Enable buttons

        if (typeof window.switchTab === 'function') {
            window.switchTab('dashboard');
        } else {
            console.error("switchTab function is not defined on window object.");
        }


    } else { // User logged out
        window.appIsReady = false;
        console.log("onAuthStateChanged: User logged out. appIsReady set to false.");
        setButtonsDisabledState(true); // Disable buttons

        detachFirestoreListeners(); 
        currentUserUID = null;
        currentFamilyId = null;

        if (mainAppHeader) mainAppHeader.classList.add('hidden');

        mainTabContentIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.classList.add('hidden');
                el.classList.remove('active'); 
            }
        });
        settingsContentWrapperIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });

        if (userEmailDisplay) userEmailDisplay.textContent = '';
        if (loginForm) loginForm.classList.remove('hidden'); 
        if (registrationForm) registrationForm.classList.add('hidden'); 
        if (userDetails) userDetails.classList.add('hidden');
        
        if (typeof window.settingsData !== 'undefined') {
            const currentTheme = window.settingsData.theme; 
            window.settingsData = {
                parent1Name: 'Parent 1', parent2Name: 'Parent 2',
                defaultTransitionTime: '18:00', defaultTransitionLocationId: null,
                notificationPreferences: { notifyDayBefore: true, notifyHourBefore: true, requestConfirmTransition: true, enableEmail: false, enableBrowser: false },
                theme: currentTheme, defaultCalendarView: 'dayGridMonth',
                parentsColors: { parent1: '#4299e1', parent2: '#ed64a6' },
                custodyModel: 'week-alt', cycleStartDate: new Date().toISOString().split('T')[0],
                transitionLocations: [],
                taskCategories: [ 
                    { id: 'cat_default_medical', name: 'Médical', color: '#ef4444' }, { id: 'cat_default_school', name: 'École', color: '#f59e0b' },
                    { id: 'cat_default_activities', name: 'Activités', color: '#8b5cf6' }, { id: 'cat_default_shopping', name: 'Achats', color: '#10b981' }
                ],
                familyId: null 
            };
        }
        
        window.childrenData = []; window.scheduleData = []; window.transitionsData = []; window.tasksData = []; window.actionHistory = [];

        if (typeof window.updateGlobalParentNameDisplays === 'function') window.updateGlobalParentNameDisplays();
        if (typeof window.renderDashboard === 'function') window.renderDashboard(); 
        if (typeof window.refreshCalendars === 'function') window.refreshCalendars(); 
        if (typeof window.renderTasks === 'function') window.renderTasks(typeof window.currentTaskFilter !== 'undefined' ? window.currentTaskFilter : { status: 'all', categoryId: 'all' }); 
        
        if (typeof window.switchTab === 'function') {
            window.switchTab('settings');
        } else {
            console.error("switchTab function is not defined on window object during logout.");
        }
        console.log("User logged out (auth.js). Listeners detached. App data reset. UI reset for logged-out state.");
    }
});

async function registerFamilyAccount() {
    const familyNameInput = document.getElementById('familyNameInput');
    const p1EmailInput = document.getElementById('parent1EmailInput'); 
    const p1PasswordInput = document.getElementById('parent1PasswordInput'); 
    const p2EmailFormInput = document.getElementById('parent2EmailInput'); 
    const registrationError = document.getElementById('registrationError');

    const familyName = familyNameInput ? familyNameInput.value.trim() : '';
    const emailForRegistration = p1EmailInput ? p1EmailInput.value.trim() : ''; 
    const passwordForRegistration = p1PasswordInput ? p1PasswordInput.value : '';
    const otherParentEmailForInvite = p2EmailFormInput && p2EmailFormInput.value.trim() !== '' ? p2EmailFormInput.value.trim() : null;

    if (registrationError) registrationError.textContent = '';

    if (!emailForRegistration || !passwordForRegistration) {
        if (registrationError) registrationError.textContent = "Email et mot de passe sont requis pour s'inscrire.";
        return;
    }
    if (!emailForRegistration.includes('@')) {
        if (registrationError) registrationError.textContent = "Veuillez fournir une adresse email valide.";
        return;
    }

    const db = firebase.firestore();
    let newAuthUID; 

    try {
        const familiesRef = db.collection('families');
        const invitedParent2Query = familiesRef.where('parent2Email', '==', emailForRegistration)
                                             .where('parent2UID', '==', null); 
        const snapshot = await invitedParent2Query.get();

        if (!snapshot.empty) {
            if (snapshot.docs.length > 1) {
                console.warn(`Multiple pending invitations found for ${emailForRegistration}. Using the first one.`);
            }
            const matchedFamilyDoc = snapshot.docs[0];
            const familyIdToLink = matchedFamilyDoc.id;
            const familyData = matchedFamilyDoc.data();

            console.log(`Parent 2 (${emailForRegistration}) attempting to link to existing family: ${familyIdToLink}`);
            if (registrationError) registrationError.textContent = `Liaison au compte familial de ${familyData.parent1Email}...`;

            const p2UserCredential = await firebase.auth().createUserWithEmailAndPassword(emailForRegistration, passwordForRegistration);
            newAuthUID = p2UserCredential.user.uid; 
            console.log("Parent 2 Auth user created:", newAuthUID);

            const batch = db.batch();
            batch.update(matchedFamilyDoc.ref, { parent2UID: newAuthUID });
            const p2UserDocRef = db.collection('users').doc(newAuthUID);
            batch.set(p2UserDocRef, {
                email: emailForRegistration,
                familyId: familyIdToLink,
                role: "Parent 2",
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            const settingsConfigRef = db.collection('families').doc(familyIdToLink).collection('settings').doc('config');
            const settingsDoc = await settingsConfigRef.get();
            if (settingsDoc.exists && settingsDoc.data().parent2Name === 'Parent 2 (Invitez)') {
                batch.update(settingsConfigRef, { parent2Name: emailForRegistration.split('@')[0] });
            }
            await batch.commit();
            console.log(`Parent 2 (${emailForRegistration}) successfully linked to family ${familyIdToLink}.`);
            return; 
        }

        if (!familyName) {
            if (registrationError) registrationError.textContent = "Le nom de famille est requis pour créer une nouvelle famille.";
            return;
        }
        if (otherParentEmailForInvite && !otherParentEmailForInvite.includes('@')) {
            if (registrationError) registrationError.textContent = "L'email du Parent 2 (pour invitation) n'est pas valide.";
            return;
        }
        
        console.log(`Parent 1 (${emailForRegistration}) creating new family: ${familyName}`);
        if (registrationError) registrationError.textContent = `Création du compte familial ${familyName}...`;

        const userCredential = await firebase.auth().createUserWithEmailAndPassword(emailForRegistration, passwordForRegistration);
        newAuthUID = userCredential.user.uid; 
        console.log("Parent 1 Auth user created for new family:", newAuthUID);

        const batch = db.batch();
        const familyDocRef = db.collection('families').doc();
        const newFamilyId = familyDocRef.id;

        batch.set(familyDocRef, {
            name: familyName,
            parent1UID: newAuthUID,
            parent1Email: emailForRegistration,
            parent2Email: otherParentEmailForInvite, 
            parent2UID: null, 
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        const userDocRef = db.collection('users').doc(newAuthUID);
        batch.set(userDocRef, {
            email: emailForRegistration,
            familyId: newFamilyId,
            role: "Parent 1",
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        const settingsDocRef = db.collection('families').doc(newFamilyId).collection('settings').doc('config');
        const initialSettings = {
            familyName: familyName,
            parent1Name: emailForRegistration.split('@')[0],
            parent2Name: (otherParentEmailForInvite ? otherParentEmailForInvite.split('@')[0] : 'Parent 2 (Invitez)'),
            parent1Email: emailForRegistration,
            parent2Email: otherParentEmailForInvite, 
            custodyModel: 'week-alt',
            cycleStartDate: new Date().toISOString().split('T')[0],
            parentsColors: { parent1: '#4299e1', parent2: '#ed64a6' },
            defaultTransitionTime: '18:00',
            taskCategories: [
                { id: 'cat_default_medical_1', name: 'Médical', color: '#ef4444' },
                { id: 'cat_default_school_2', name: 'École', color: '#f59e0b' },
                { id: 'cat_default_activities_3', name: 'Activités', color: '#8b5cf6' },
                { id: 'cat_default_shopping_4', name: 'Achats', color: '#10b981' }
            ],
            transitionLocations: [],
            notificationPreferences: { notifyDayBefore: true, notifyHourBefore: true, requestConfirmTransition: true, enableEmail: false, enableBrowser: false },
            theme: 'light',
            defaultCalendarView: 'dayGridMonth'
        };
        batch.set(settingsDocRef, initialSettings);

        const collectionsToInit = ['schedule', 'transitions', 'tasks', 'actionHistory'];
        collectionsToInit.forEach(collName => {
            const sharedListDocRef = db.collection('families').doc(newFamilyId).collection(collName).doc('sharedList');
            batch.set(sharedListDocRef, { list: [], initializedAt: firebase.firestore.FieldValue.serverTimestamp(), by: newAuthUID });
        });
        const childrenInitDocRef = db.collection('families').doc(newFamilyId).collection('children').doc('_placeholder');
        batch.set(childrenInitDocRef, { initializedAt: firebase.firestore.FieldValue.serverTimestamp(), by: newAuthUID });

        await batch.commit();
        console.log("New family registration successful. Batch committed.");

    } catch (error) {
        if (registrationError) registrationError.textContent = error.message;
        console.error("Family Registration error (auth.js):", error);

        const createdUser = firebase.auth().currentUser;
        if (newAuthUID && createdUser && createdUser.uid === newAuthUID) {
             if (createdUser.email === emailForRegistration) { 
                try {
                    await createdUser.delete();
                    console.log(`Auth user ${newAuthUID} deleted due to Firestore error during registration.`);
                } catch (deleteError) {
                    console.error(`Error deleting auth user ${newAuthUID} after registration failure:`, deleteError);
                    if (registrationError) registrationError.textContent += " Erreur de nettoyage du compte Auth.";
                }
            } else {
                 console.warn("Skipping auth user deletion: Current user's email does not match the email used in this registration attempt.");
            }
        } else if (newAuthUID && !createdUser) {
             console.warn("Skipping auth user deletion: No current user found, though an Auth UID was generated in this failed attempt.");
        }
    }
}


async function loginUser() {
    const emailInput = document.getElementById('emailInput');
    const passwordInput = document.getElementById('passwordInput');
    const authError = document.getElementById('authError');

    const email = emailInput ? emailInput.value : '';
    const password = passwordInput ? passwordInput.value : '';

    if (authError) authError.textContent = '';

    if (!email || !password) { 
        if (authError) authError.textContent = "Email et mot de passe requis."; 
        return; 
    }
    
    try {
        await firebase.auth().signInWithEmailAndPassword(email, password);
    } catch (error) {
        if (authError) authError.textContent = error.message;
        console.error("Login error (auth.js):", error);
    }
}

async function logoutUser() {
    const authError = document.getElementById('authError');
    if (authError) authError.textContent = ''; 
    try {
        await firebase.auth().signOut();
    } catch (error) {
        if (authError) authError.textContent = error.message;
        console.error("Logout error (auth.js):", error);
    }
}

async function loadFirebaseData() {
    detachFirestoreListeners(); 

    if (!currentUserUID || !currentFamilyId) {
        console.log("loadFirebaseData: No user or familyId, skipping Firestore load. Clearing local data.");
        window.childrenData = []; window.scheduleData = []; window.transitionsData = []; window.tasksData = []; window.actionHistory = [];
        return;
    }

    console.log(`loadFirebaseData: Initializing for familyId: ${currentFamilyId}`);
    const db = firebase.firestore();
    const familyRef = db.collection('families').doc(currentFamilyId);

    try {
        const settingsListener = familyRef.collection('settings').doc('config')
            .onSnapshot(doc => {
                if (doc.exists) {
                    const newSettings = doc.data();
                    const oldTheme = window.settingsData ? window.settingsData.theme : 'light';
                    window.settingsData = { ...window.settingsData, ...newSettings, familyId: currentFamilyId }; 
                    console.log('Settings updated (real-time):', window.settingsData);
                    if (typeof window.updateGlobalParentNameDisplays === 'function') window.updateGlobalParentNameDisplays();
                    if (typeof window.populateAccountSettingsForm === 'function') window.populateAccountSettingsForm();
                    if (typeof window.populateDisplayPreferencesForm === 'function') window.populateDisplayPreferencesForm();
                    if (typeof window.refreshCalendars === 'function') window.refreshCalendars(); 
                    
                    const bodyHasDarkMode = document.body.classList.contains('dark-mode');
                    const settingsIndicateDark = window.settingsData.theme === 'dark';
                    if (bodyHasDarkMode !== settingsIndicateDark) {
                        if (typeof window.setDisplayTheme === 'function') {
                            window.setDisplayTheme(window.settingsData.theme, false); 
                        } else if (typeof window.toggleDarkMode === 'function') {
                            window.toggleDarkMode(); 
                        }
                    }
                } else {
                    console.warn("Settings document 'config' does not exist in Firestore for this family.");
                }
            }, error => console.error("Error listening to settings changes:", error));
        firestoreListeners.push(settingsListener);

        const childrenListener = familyRef.collection('children').orderBy('createdAt', 'asc')
            .onSnapshot(snapshot => {
                window.childrenData = snapshot.docs.filter(doc => doc.id !== '_placeholder').map(doc => ({ id: doc.id, ...doc.data() }));
                console.log('Children updated (real-time):', window.childrenData.length);
                if (typeof window.renderChildrenList === 'function') window.renderChildrenList();
                if (typeof window.renderDashboardChildrenList === 'function') window.renderDashboardChildrenList();
                if (typeof window.showChildProfile === 'function') {
                     const childToDisplay = (window.currentlyEditingChildId && window.childrenData.some(c => c.id === window.currentlyEditingChildId))
                                         ? window.currentlyEditingChildId 
                                         : (window.childrenData.length > 0 ? window.childrenData[0].id : null);
                     window.showChildProfile(childToDisplay);
                }
            }, error => console.error("Error listening to children changes:", error));
        firestoreListeners.push(childrenListener);

        const sharedDataConfigs = [
            { globalVar: 'scheduleData', coll: 'schedule', uiRefresh: ['refreshCalendars', 'renderDashboard'] },
            { globalVar: 'tasksData', coll: 'tasks', uiRefresh: ['renderTasks', 'updateTaskStats', 'renderDashboardTasks'] },
            { globalVar: 'transitionsData', coll: 'transitions', uiRefresh: ['renderTransitions', 'renderDashboardNextTransition'] },
            { globalVar: 'actionHistory', coll: 'actionHistory', uiRefresh: ['renderActionHistory'] }
        ];

        sharedDataConfigs.forEach(config => {
            const listener = familyRef.collection(config.coll).doc('sharedList')
                .onSnapshot(doc => {
                    if (doc.exists) {
                        window[config.globalVar] = doc.data()?.list || [];
                        console.log(`${config.globalVar} updated (real-time):`, window[config.globalVar].length);
                    } else {
                        window[config.globalVar] = [];
                        console.log(`${config.globalVar} 'sharedList' document not found, initialized as empty.`);
                    }
                    config.uiRefresh.forEach(funcName => {
                        if (funcName === 'renderTasks' && typeof window[funcName] === 'function') window[funcName](window.currentTaskFilter);
                        else if (typeof window[funcName] === 'function') window[funcName]();
                    });
                }, error => console.error(`Error listening to ${config.coll} changes:`, error));
            firestoreListeners.push(listener);
        });
        
        console.log("All Firestore listeners attached.");

    } catch (error) {
        console.error("Error setting up Firestore listeners in loadFirebaseData:", error);
        if(document.getElementById('authError')) document.getElementById('authError').textContent = "Erreur de chargement des données en temps réel.";
    }
}


async function addChildToFirestore(childObject) {
    if (!currentFamilyId) throw new Error("No family selected for adding child.");
    const db = firebase.firestore();
    const childWithTimestamps = { ...childObject, createdAt: firebase.firestore.FieldValue.serverTimestamp(), updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
    if (childWithTimestamps.hasOwnProperty('id')) delete childWithTimestamps.id; 
    const docRef = await db.collection('families').doc(currentFamilyId).collection('children').add(childWithTimestamps);
    console.log("Child added to Firestore with ID: ", docRef.id);
    return { ...childObject, id: docRef.id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
}

async function updateChildInFirestore(childId, childObject) {
    if (!currentFamilyId) throw new Error("No family selected for updating child.");
    if (!childId) throw new Error("Child ID is required for update.");
    const db = firebase.firestore();
    const childToUpdate = { ...childObject }; 
    delete childToUpdate.id; 
    childToUpdate.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
    await db.collection('families').doc(currentFamilyId).collection('children').doc(childId).update(childToUpdate);
    console.log("Child updated in Firestore: ", childId);
    return { ...childObject, id: childId, updatedAt: new Date().toISOString() }; 
}

async function deleteChildFromFirestore(childId) {
    if (!currentFamilyId) throw new Error("No family selected for deleting child.");
    if (!childId) throw new Error("Child ID is required for delete.");
    const db = firebase.firestore();
    await db.collection('families').doc(currentFamilyId).collection('children').doc(childId).delete();
    console.log("Child deleted from Firestore: ", childId);
}

// Expose functions to global window object
window.registerFamilyAccount = registerFamilyAccount;
window.loginUser = loginUser;
window.logoutUser = logoutUser;
window.loadFirebaseData = loadFirebaseData;
window.addChildToFirestore = addChildToFirestore;
window.updateChildInFirestore = updateChildInFirestore;
window.deleteChildFromFirestore = deleteChildFromFirestore;
window.detachFirestoreListeners = detachFirestoreListeners;

[end of auth.js]
