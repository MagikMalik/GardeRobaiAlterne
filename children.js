/*
Children Data Model (stored under families/{familyName}/children/{childId}):
- childId: Unique ID from Firebase push().
- name: String, required.
- dob: String (YYYY-MM-DD), required.
- schoolInfo: Object, optional.
  - schoolName: String, optional.
  - className: String, optional.
  - teacherName: String, optional.
- activitiesText: String, optional (for simplified activities list).
- medicalInfo: Object, optional.
  - allergies: String, optional.
  - medications: String, optional.
  - doctorName: String, optional.
  - doctorPhone: String, optional.
- privateNotes: Object, optional. (Root for private notes per child)
  - {parentUid1}: Object (Container for notes by parent1)
    - {privateNoteId1}: { content: "...", timestamp: ... }
    - {privateNoteId2}: { content: "...", timestamp: ... }
  - {parentUid2}: Object (Container for notes by parent2)
    - {privateNoteId3}: { content: "...", timestamp: ... }
*/

let db;
let currentFamilyName;
let currentUserIdChildren; // Store the logged-in user's UID
let childrenListElement;
let addChildModalElement; 
let addChildFormElement;  
let addChildErrorElement;
let editChildIdInput; 

function initChildren(databaseService, familyNameFromAuth, userIdFromAuth) { // Added userIdFromAuth
    db = databaseService;
    currentFamilyName = familyNameFromAuth;
    currentUserIdChildren = userIdFromAuth; // Store the current user's ID

    if (!db || !currentFamilyName || !currentUserIdChildren) { // Check for userIdChildren
        console.error("Children module initialized without database service, family name, or user ID.");
        return;
    }

    const addChildBtn = document.getElementById('add-child-btn');
    addChildModalElement = document.getElementById('add-child-modal');
    const closeAddChildModalBtn = document.getElementById('close-add-child-modal-btn');
    const cancelAddChildBtn = document.getElementById('cancel-add-child-btn');
    addChildFormElement = document.getElementById('add-child-form');
    childrenListElement = document.getElementById('children-list');
    addChildErrorElement = document.getElementById('add-child-error');
    editChildIdInput = document.getElementById('edit-child-id'); 

    if (!addChildBtn || !addChildModalElement || !closeAddChildModalBtn || !cancelAddChildBtn || !addChildFormElement || !childrenListElement || !addChildErrorElement || !editChildIdInput) {
        console.error("One or more child management UI elements are missing.");
        return;
    }

    addChildBtn.addEventListener('click', () => toggleAddChildModal(true, null)); 
    closeAddChildModalBtn.addEventListener('click', () => toggleAddChildModal(false));
    cancelAddChildBtn.addEventListener('click', () => toggleAddChildModal(false));
    addChildFormElement.addEventListener('submit', handleAddChildFormSubmit);

    listenForChildrenUpdates();
}

async function toggleAddChildModal(show, childIdToEdit = null) {
    if (!addChildModalElement || !addChildFormElement || !addChildErrorElement || !editChildIdInput) {
        console.error("Modal elements not found in toggleAddChildModal");
        return;
    }
    const modalTitle = document.getElementById('child-modal-title'); 
    const privateNoteContentElement = document.getElementById('child-private-note-content');

    if (show) {
        addChildFormElement.reset(); 
        if(privateNoteContentElement) privateNoteContentElement.value = ''; // Clear private note field specifically
        addChildErrorElement.textContent = ''; 
        
        if (childIdToEdit) {
            if(modalTitle) modalTitle.textContent = "Modifier l'enfant";
            editChildIdInput.value = childIdToEdit;
            try {
                const snapshot = await db.ref(`families/${currentFamilyName}/children/${childIdToEdit}`).once('value');
                const childData = snapshot.val();
                if (childData) {
                    document.getElementById('child-name').value = childData.name || '';
                    document.getElementById('child-dob').value = childData.dob || '';
                    document.getElementById('child-school-name').value = childData.schoolInfo?.schoolName || '';
                    document.getElementById('child-class-name').value = childData.schoolInfo?.className || '';
                    document.getElementById('child-teacher-name').value = childData.schoolInfo?.teacherName || '';
                    document.getElementById('child-activities-text').value = childData.activitiesText || '';
                    document.getElementById('child-allergies').value = childData.medicalInfo?.allergies || '';
                    document.getElementById('child-medications').value = childData.medicalInfo?.medications || '';
                    document.getElementById('child-doctor-name').value = childData.medicalInfo?.doctorName || '';
                    document.getElementById('child-doctor-phone').value = childData.medicalInfo?.doctorPhone || '';
                    // Private note textarea (#child-private-note-content) is intentionally kept clear for *adding new* notes.
                    // Displaying existing private notes (e.g., in #child-private-note-display) is deferred.
                } else {
                    addChildErrorElement.textContent = "Données de l'enfant non trouvées.";
                }
            } catch (error) {
                console.error("Error fetching child data for edit:", error);
                addChildErrorElement.textContent = "Erreur lors de la récupération des données.";
            }
        } else {
            if(modalTitle) modalTitle.textContent = "Ajouter un Enfant";
            editChildIdInput.value = ''; 
        }
        addChildModalElement.classList.remove('hidden');
    } else {
        addChildModalElement.classList.add('hidden');
    }
}

function openEditChildModal(childId) {
    toggleAddChildModal(true, childId);
}

async function handleAddChildFormSubmit(event) {
    event.preventDefault();
    if (!addChildErrorElement || !addChildFormElement || !db || !currentFamilyName || !editChildIdInput || !currentUserIdChildren) {
        console.error("Form, error element, DB, family name, editChildIdInput, or currentUserIdChildren not available.");
        if(addChildErrorElement) addChildErrorElement.textContent = "Erreur de formulaire.";
        return;
    }

    const childName = document.getElementById('child-name').value.trim();
    const childDob = document.getElementById('child-dob').value;
    const currentEditChildId = editChildIdInput.value;
    addChildErrorElement.textContent = '';

    if (!childName || !childDob) {
        addChildErrorElement.textContent = 'Le nom et la date de naissance sont requis.';
        return;
    }

    const childData = {
        name: childName,
        dob: childDob,
        schoolInfo: {
            schoolName: document.getElementById('child-school-name').value.trim(),
            className: document.getElementById('child-class-name').value.trim(),
            teacherName: document.getElementById('child-teacher-name').value.trim()
        },
        activitiesText: document.getElementById('child-activities-text').value.trim(),
        medicalInfo: {
            allergies: document.getElementById('child-allergies').value.trim(),
            medications: document.getElementById('child-medications').value.trim(),
            doctorName: document.getElementById('child-doctor-name').value.trim(),
            doctorPhone: document.getElementById('child-doctor-phone').value.trim()
        }
        // privateNotes are handled separately after child is saved/updated
    };
    
    if (!childData.schoolInfo.schoolName && !childData.schoolInfo.className && !childData.schoolInfo.teacherName) {
        childData.schoolInfo = null; 
    }
    if (!childData.activitiesText) childData.activitiesText = null;
    if (!childData.medicalInfo.allergies && !childData.medicalInfo.medications && !childData.medicalInfo.doctorName && !childData.medicalInfo.doctorPhone) {
        childData.medicalInfo = null;
    }

    const privateNoteContentElement = document.getElementById('child-private-note-content');
    const privateNoteText = privateNoteContentElement ? privateNoteContentElement.value.trim() : '';

    try {
        let childIdForPrivateNote = currentEditChildId;

        if (currentEditChildId) { 
            await db.ref(`families/${currentFamilyName}/children/${currentEditChildId}`).update(childData);
            console.log("Child updated successfully, ID:", currentEditChildId);
        } else { 
            const newChildRef = await db.ref(`families/${currentFamilyName}/children`).push(childData);
            childIdForPrivateNote = newChildRef.key; // Get the ID of the newly created child
            console.log("Child added successfully, ref:", childIdForPrivateNote);
        }

        // Add private note if text is provided
        if (privateNoteText && childIdForPrivateNote) {
            const privateNoteData = {
                content: privateNoteText,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            };
            await db.ref(`families/${currentFamilyName}/children/${childIdForPrivateNote}/privateNotes/${currentUserIdChildren}`).push(privateNoteData);
            console.log(`Private note added for child ${childIdForPrivateNote} by user ${currentUserIdChildren}`);
            if(privateNoteContentElement) privateNoteContentElement.value = ''; // Clear after saving
        }
        
        toggleAddChildModal(false);
    } catch (error) {
        console.error("Error saving child or private note:", error);
        addChildErrorElement.textContent = `Erreur lors de l'enregistrement: ${error.message}`;
    }
}

async function handleDeleteChild(childId) {
    // ... (existing implementation)
    if (!db || !currentFamilyName || !childId) {
        console.error("Cannot delete child: missing DB service, family name, or child ID.");
        return;
    }
    if (confirm("Supprimer cet enfant des registres? Cette action est irréversible et supprimera aussi toutes les notes privées associées.")) {
        try {
            // The children node (including privateNotes) will be deleted.
            await db.ref(`families/${currentFamilyName}/children/${childId}`).remove();
            console.log("Child deleted:", childId);
        } catch (error) {
            console.error("Error deleting child:", error);
            alert(`Erreur lors de la suppression: ${error.message}`); 
        }
    }
}

function listenForChildrenUpdates() {
    // ... (existing implementation, no changes needed here for private notes as they are not displayed in the main list)
    if (!currentFamilyName || !db || !childrenListElement) {
        console.error("Cannot listen for children updates: missing familyName, DB, or list element.");
        if (childrenListElement) childrenListElement.innerHTML = '<p class="text-gray-500">Erreur de configuration.</p>';
        return;
    }

    const childrenRef = db.ref(`families/${currentFamilyName}/children`);
    childrenRef.on('value', snapshot => {
        childrenListElement.innerHTML = ''; 
        const children = snapshot.val();
        if (children) {
            let count = 0;
            for (const childId in children) {
                const child = children[childId];
                const childItem = document.createElement('div');
                childItem.classList.add('child-item', 'p-2', 'border-b', 'flex', 'justify-between', 'items-center'); 
                childItem.dataset.childId = childId;

                const infoDiv = document.createElement('div');
                const nameElement = document.createElement('p');
                nameElement.innerHTML = `<strong>${escapeHTML(child.name)}</strong>`;
                infoDiv.appendChild(nameElement);

                const dobElement = document.createElement('p');
                const formattedDob = child.dob ? new Date(child.dob + 'T00:00:00').toLocaleDateString('fr-FR') : 'N/A';
                dobElement.innerHTML = `<span class="text-xs text-gray-600">Né(e) le: ${formattedDob}</span>`;
                infoDiv.appendChild(dobElement);
                childItem.appendChild(infoDiv);
                
                const buttonsContainer = document.createElement('div');
                buttonsContainer.classList.add('space-x-1'); 

                const editButton = document.createElement('button');
                editButton.classList.add('text-xs', 'text-blue-500', 'hover:text-blue-700', 'edit-child-btn', 'px-2', 'py-1', 'border', 'border-blue-500', 'rounded', 'hover:bg-blue-100');
                editButton.textContent = 'Modifier';
                editButton.dataset.childId = childId; 
                editButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openEditChildModal(childId);
                });
                buttonsContainer.appendChild(editButton);

                const deleteButton = document.createElement('button');
                deleteButton.classList.add('text-xs', 'text-red-500', 'hover:text-red-700', 'delete-child-btn', 'px-2', 'py-1', 'border', 'border-red-500', 'rounded', 'hover:bg-red-100');
                deleteButton.textContent = 'Supprimer';
                deleteButton.dataset.childId = childId; 
                deleteButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    handleDeleteChild(childId);
                });
                buttonsContainer.appendChild(deleteButton);
                
                childItem.appendChild(buttonsContainer);
                childrenListElement.appendChild(childItem);
                count++;
            }
            if (count === 0) {
                 childrenListElement.innerHTML = '<p class="text-gray-500">Aucun enfant ajouté.</p>';
            }
        } else {
            childrenListElement.innerHTML = '<p class="text-gray-500">Aucun enfant ajouté.</p>';
        }
    }, error => {
        console.error("Error listening for children updates:", error);
        childrenListElement.innerHTML = `<p class="text-red-500">Erreur de chargement des enfants.</p>`;
    });
}

function escapeHTML(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str || ''));
    return div.innerHTML;
}