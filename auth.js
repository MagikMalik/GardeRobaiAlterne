// auth.js

// Firebase app, auth, and db are assumed to be initialized globally in index.html
// (e.g., const auth = firebase.auth(); const db = firebase.firestore();)

let currentUserUID = null;
let currentFamilyId = null; // To store the family/shared plan ID

// Auth state listener
firebase.auth().onAuthStateChanged(async (user) => {
    const loginForm = document.getElementById('loginForm');
    const userDetails = document.getElementById('userDetails');
    const userEmailDisplay = document.getElementById('userEmailDisplay');
    const authError = document.getElementById('authError');

    // Ensure global settingsData exists
    if (typeof window.settingsData === 'undefined') {
        console.warn('settingsData not defined globally in auth.js onAuthStateChanged. Using fallback.');
        window.settingsData = { theme: 'light', parentsColors: { parent1: '#4299e1', parent2: '#ed64a6' }, parent1Name: 'Parent 1', parent2Name: 'Parent 2', custodyModel: 'week-alt', cycleStartDate: new Date().toISOString().split('T')[0], defaultTransitionTime: '18:00', taskCategories: [], transitionLocations: [] };
    }

    if (user) {
        currentUserUID = user.uid;
        if (userEmailDisplay) userEmailDisplay.textContent = `Connecté: ${user.email}`;
        if (loginForm) loginForm.style.display = 'none';
        if (userDetails) userDetails.style.display = 'block';
        if (authError) authError.textContent = '';
        console.log("User logged in (auth.js):", user.email, "UID:", user.uid);

        try {
            const userDocRef = firebase.firestore().collection('users').doc(user.uid);
            const userDoc = await userDocRef.get();

            if (userDoc.exists) {
                const userData = userDoc.data();
                currentFamilyId = userData.familyId;
                window.settingsData.familyId = currentFamilyId; // Store familyId in settingsData

                if (currentFamilyId) {
                    const familySettingsDocRef = firebase.firestore().collection('families').doc(currentFamilyId).collection('settings').doc('config');
                    const familySettingsDoc = await familySettingsDocRef.get();
                    
                    if (familySettingsDoc.exists) {
                        const familySettings = familySettingsDoc.data();
                        window.settingsData.parent1Name = familySettings.parent1Name || 'Parent 1';
                        window.settingsData.parent2Name = familySettings.parent2Name || 'Parent 2';
                        window.settingsData.custodyModel = familySettings.custodyModel || window.settingsData.custodyModel;
                        window.settingsData.cycleStartDate = familySettings.cycleStartDate || window.settingsData.cycleStartDate;
                        window.settingsData.parentsColors = familySettings.parentsColors || window.settingsData.parentsColors;
                        window.settingsData.defaultTransitionTime = familySettings.defaultTransitionTime || window.settingsData.defaultTransitionTime;
                        window.settingsData.taskCategories = familySettings.taskCategories || window.settingsData.taskCategories || [];
                        window.settingsData.transitionLocations = familySettings.transitionLocations || window.settingsData.transitionLocations || [];
                    } else { 
                        if (userData.role === 'Parent 1') {
                             window.settingsData.parent1Name = user.email.split('@')[0];
                             window.settingsData.parent2Name = window.settingsData.parent2Name || 'Parent 2 (Invitez)';
                             await familySettingsDocRef.set({
                                parent1Name: window.settingsData.parent1Name,
                                parent2Name: window.settingsData.parent2Name,
                                custodyModel: window.settingsData.custodyModel,
                                cycleStartDate: window.settingsData.cycleStartDate,
                                parentsColors: window.settingsData.parentsColors,
                                defaultTransitionTime: window.settingsData.defaultTransitionTime,
                                taskCategories: window.settingsData.taskCategories,
                                transitionLocations: window.settingsData.transitionLocations
                             });
                        } else if (userData.role === 'Parent 2') { 
                             window.settingsData.parent2Name = user.email.split('@')[0];
                             console.warn(`User ${user.email} (P2) logged in, but family settings for ${currentFamilyId} missing.`);
                        }
                    }
                } else { 
                    currentFamilyId = user.uid; 
                    await userDocRef.update({ familyId: currentFamilyId, role: 'Parent 1' });
                    window.settingsData.parent1Name = user.email.split('@')[0];
                    window.settingsData.parent2Name = 'Parent 2 (Invitez)';
                    window.settingsData.familyId = currentFamilyId;
                    await firebase.firestore().collection('families').doc(currentFamilyId).collection('settings').doc('config').set({
                        parent1Name: window.settingsData.parent1Name,
                        parent2Name: window.settingsData.parent2Name,
                        custodyModel: window.settingsData.custodyModel,
                        cycleStartDate: window.settingsData.cycleStartDate,
                        parentsColors: window.settingsData.parentsColors,
                        defaultTransitionTime: window.settingsData.defaultTransitionTime,
                        taskCategories: window.settingsData.taskCategories,
                        transitionLocations: window.settingsData.transitionLocations
                    });
                    console.log(`New family created by P1 with ID: ${currentFamilyId}`);
                }
            } else { 
                currentFamilyId = user.uid;
                await userDocRef.set({
                    email: user.email,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    familyId: currentFamilyId,
                    role: 'Parent 1'
                });
                window.settingsData.parent1Name = user.email.split('@')[0];
                window.settingsData.parent2Name = 'Parent 2 (Invitez)';
                window.settingsData.familyId = currentFamilyId;
                await firebase.firestore().collection('families').doc(currentFamilyId).collection('settings').doc('config').set({
                    parent1Name: window.settingsData.parent1Name,
                    parent2Name: window.settingsData.parent2Name,
                    custodyModel: window.settingsData.custodyModel,
                    cycleStartDate: window.settingsData.cycleStartDate,
                    parentsColors: window.settingsData.parentsColors,
                    defaultTransitionTime: window.settingsData.defaultTransitionTime,
                    taskCategories: window.settingsData.taskCategories,
                    transitionLocations: window.settingsData.transitionLocations
                });
                console.log(`New user registered, userDoc & family created: ${currentFamilyId}`);
            }
        } catch (err) {
            console.error("Error in onAuthStateChanged user data processing (auth.js):", err);
            if (authError) authError.textContent = "Erreur de configuration du profil.";
            if(typeof window.settingsData !== 'undefined'){
                window.settingsData.parent1Name = user.email.split('@')[0] || 'Parent 1';
                window.settingsData.parent2Name = 'Parent 2';
            }
        }
        
        if (typeof window.updateGlobalParentNameDisplays === 'function') window.updateGlobalParentNameDisplays();
        if (typeof window.loadFirebaseData === 'function') await window.loadFirebaseData();

    } else { // User logged out
        currentUserUID = null;
        currentFamilyId = null;
        if (userEmailDisplay) userEmailDisplay.textContent = '';
        if (loginForm) loginForm.style.display = 'block';
        if (userDetails) userDetails.style.display = 'none';
        
        if (typeof window.settingsData !== 'undefined') {
            const currentTheme = window.settingsData.theme;
            window.settingsData = {
                parent1Name: 'Parent 1', parent2Name: 'Parent 2', parent1Email: '', parent2Email: '',
                defaultTransitionTime: '18:00', defaultTransitionLocationId: null,
                notificationPreferences: { notifyDayBefore: true, notifyHourBefore: true, requestConfirmTransition: true, enableEmail: false, enableBrowser: false },
                theme: currentTheme, defaultCalendarView: 'dayGridMonth',
                parentsColors: { parent1: '#4299e1', parent2: '#ed64a6' },
                custodyModel: 'week-alt', cycleStartDate: new Date().toISOString().split('T')[0],
                transitionLocations: [],
                taskCategories: [ 
                    { id: 'cat1', name: 'Médical', color: '#ef4444' }, { id: 'cat2', name: 'Achats', color: '#10b981' },
                    { id: 'cat3', name: 'École', color: '#f59e0b' },  { id: 'cat4', name: 'Activités', color: '#8b5cf6' }
                ],
                familyId: null 
            };
        }
        
        if (typeof window.childrenData !== 'undefined') window.childrenData = [];
        if (typeof window.scheduleData !== 'undefined') window.scheduleData = [];
        if (typeof window.transitionsData !== 'undefined') window.transitionsData = [];
        if (typeof window.tasksData !== 'undefined') window.tasksData = [];
        if (typeof window.actionHistory !== 'undefined') window.actionHistory = [];

        if (typeof window.updateGlobalParentNameDisplays === 'function') window.updateGlobalParentNameDisplays();
        if (typeof window.renderDashboard === 'function') window.renderDashboard();
        if (typeof window.refreshCalendars === 'function') window.refreshCalendars();
        if (typeof window.renderTasks === 'function') window.renderTasks(typeof window.currentTaskFilter !== 'undefined' ? window.currentTaskFilter : { status: 'all', categoryId: 'all' });
        // ... Call other render functions to clear UI ...
        console.log("User logged out (auth.js). App data reset.");
    }
});

async function registerUser() {
    const email = document.getElementById('emailInput').value;
    const password = document.getElementById('passwordInput').value;
    const authError = document.getElementById('authError');
    if (!email || !password) { if (authError) authError.textContent = "Email et mot de passe requis."; return; }
    if (authError) authError.textContent = '';
    try {
        const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
        console.log("User registered (auth.js):", userCredential.user.uid);
    } catch (error) {
        if (authError) authError.textContent = error.message;
        console.error("Registration error (auth.js):", error);
    }
}

async function loginUser() {
    const email = document.getElementById('emailInput').value;
    const password = document.getElementById('passwordInput').value;
    const authError = document.getElementById('authError');
    if (!email || !password) { if (authError) authError.textContent = "Email et mot de passe requis."; return; }
    if (authError) authError.textContent = '';
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
    if (!currentUserUID || !currentFamilyId) {
        console.log("loadFirebaseData (auth.js): No user or familyId, skipping Firestore load.");
        if (typeof window.childrenData !== 'undefined') window.childrenData = [];
        if (typeof window.scheduleData !== 'undefined') window.scheduleData = [];
        if (typeof window.transitionsData !== 'undefined') window.transitionsData = [];
        if (typeof window.tasksData !== 'undefined') window.tasksData = [];
        if (typeof window.actionHistory !== 'undefined') window.actionHistory = [];
        
        if (typeof window.renderChildrenList === 'function') window.renderChildrenList();
        if (typeof window.renderDashboard === 'function') window.renderDashboard();
        if (typeof window.refreshCalendars === 'function') window.refreshCalendars();
        if (typeof window.renderTransitions === 'function') window.renderTransitions();
        if (typeof window.renderTasks === 'function') window.renderTasks(typeof window.currentTaskFilter !== 'undefined' ? window.currentTaskFilter : { status: 'all', categoryId: 'all' });
        if (typeof window.populateAccountSettingsForm === 'function') window.populateAccountSettingsForm();
        return;
    }
    console.log(`loadFirebaseData (auth.js): Loading all data for familyId: ${currentFamilyId}`);
    try {
        const db = firebase.firestore();
        const childrenSnapshot = await db.collection('families').doc(currentFamilyId).collection('children').orderBy('createdAt', 'asc').get();
        window.childrenData = childrenSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log('Children loaded (auth.js):', window.childrenData.length);

        // Initialize other data arrays for now, to be populated in later steps
        window.scheduleData = []; 
        window.transitionsData = [];
        window.tasksData = [];
        window.actionHistory = []; // This also needs to be loaded from Firestore eventually

        // Call all relevant rendering functions from the main script
        if (typeof window.renderAllComponents === 'function') { 
            window.renderAllComponents();
        } else { 
            if (typeof window.renderChildrenList === 'function') window.renderChildrenList();
            if (typeof window.renderDashboard === 'function') window.renderDashboard();
            if (typeof window.refreshCalendars === 'function') window.refreshCalendars();
            if (typeof window.renderTransitions === 'function') window.renderTransitions();
            if (typeof window.renderTasks === 'function') window.renderTasks(typeof window.currentTaskFilter !== 'undefined' ? window.currentTaskFilter : { status: 'all', categoryId: 'all' });
            if (typeof window.populateAccountSettingsForm === 'function') window.populateAccountSettingsForm();
            if (typeof window.populateStatsFilters === 'function') window.populateStatsFilters();
            if (typeof window.renderStatistics === 'function') window.renderStatistics();
            if (typeof window.renderActionHistory === 'function') window.renderActionHistory();
        }
    } catch (error) {
        console.error("Error loading data in loadFirebaseData (auth.js):", error);
        window.childrenData = []; window.scheduleData = []; 
    }
}
window.loadFirebaseData = loadFirebaseData;

async function addChildToFirestore(childObject) {
    if (!currentFamilyId) throw new Error("No family selected for adding child.");
    const db = firebase.firestore();
    const childWithTimestamps = { ...childObject, createdAt: firebase.firestore.FieldValue.serverTimestamp(), updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
    if (childWithTimestamps.id === null || typeof childWithTimestamps.id === 'undefined') delete childWithTimestamps.id;
    const docRef = await db.collection('families').doc(currentFamilyId).collection('children').add(childWithTimestamps);
    console.log("Child added to Firestore with ID: ", docRef.id);
    return { ...childObject, id: docRef.id, createdAt: new Date(), updatedAt: new Date() };
}
window.addChildToFirestore = addChildToFirestore;

async function updateChildInFirestore(childId, childObject) {
    if (!currentFamilyId) throw new Error("No family selected for updating child.");
    if (!childId) throw new Error("Child ID is required for update.");
    const db = firebase.firestore();
    const childToUpdate = { ...childObject }; 
    delete childToUpdate.id; 
    childToUpdate.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
    await db.collection('families').doc(currentFamilyId).collection('children').doc(childId).update(childToUpdate);
    console.log("Child updated in Firestore: ", childId);
    return { ...childObject, id: childId, updatedAt: new Date() }; 
}
window.updateChildInFirestore = updateChildInFirestore;

async function deleteChildFromFirestore(childId) {
    if (!currentFamilyId) throw new Error("No family selected for deleting child.");
    if (!childId) throw new Error("Child ID is required for delete.");
    const db = firebase.firestore();
    await db.collection('families').doc(currentFamilyId).collection('children').doc(childId).delete();
    console.log("Child deleted from Firestore: ", childId);
}
window.deleteChildFromFirestore = deleteChildFromFirestore;

// Expose functions to global window object
window.registerUser = registerUser;
window.loginUser = loginUser;
window.logoutUser = logoutUser;
// loadFirebaseData, addChildToFirestore etc. are already exposed above
