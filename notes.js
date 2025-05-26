/*
Notes Data Model (stored under families/{familyName}/notes/{noteId}):
- noteId: Unique ID from Firebase push().
- content: String, required, the actual text of the note.
- timestamp: Timestamp (e.g., firebase.database.ServerValue.TIMESTAMP or new Date().toISOString()).
- authorId: String, Firebase uid of the user who created the note.
- authorRole: String, ("Papa" or "Maman"), stored for easy display.
- childId: String, optional. UID of a child if the note is specifically about them.
*/

// Global variables for the Notes module
let dbNotes;
let currentFamilyNameNotes;
let currentUserIdNotes; // Logged-in user's UID
let currentUserRoleNotes;
let familyChildrenDataNotes = {};

// DOM Elements for Notes (Add Note)
let addNoteForm, noteContentInput, noteChildLinkSelect, addNoteBtn, notesListElement, noteErrorElement;

// DOM Elements for Notes (Edit Note Modal)
let editNoteModal, editNoteForm, editNoteIdInput, editNoteContentInput, editNoteChildLinkSelect, editNoteErrorElement;
let closeEditNoteModalBtn, cancelEditNoteBtn;


function initNotes(database, familyName, userId, userRole, childrenData) {
    dbNotes = database;
    currentFamilyNameNotes = familyName;
    currentUserIdNotes = userId; 
    currentUserRoleNotes = userRole;
    familyChildrenDataNotes = childrenData || {};

    // Add Note elements
    addNoteForm = document.getElementById('add-note-form');
    noteContentInput = document.getElementById('note-content');
    noteChildLinkSelect = document.getElementById('note-child-link');
    // addNoteBtn is the submit button within addNoteForm
    notesListElement = document.getElementById('notes-list');
    noteErrorElement = document.getElementById('note-error');

    if (!addNoteForm || !noteContentInput || !noteChildLinkSelect || !notesListElement || !noteErrorElement) {
        console.error("One or more Add Notes UI elements are missing.");
    } else {
        addNoteForm.addEventListener('submit', handleAddNoteSubmit);
    }

    populateChildrenDropdown(noteChildLinkSelect, familyChildrenDataNotes); // For add note form

    if (dbNotes && currentFamilyNameNotes) {
        listenForNotes();
    } else {
        console.warn("DB service or family name not available for Notes. Note listening skipped.");
    }
    
    initEditNoteModal(); // Initialize edit modal elements and listeners
}

function initEditNoteModal() {
    editNoteModal = document.getElementById('edit-note-modal');
    editNoteForm = document.getElementById('edit-note-form');
    editNoteIdInput = document.getElementById('edit-note-id');
    editNoteContentInput = document.getElementById('edit-note-content');
    editNoteChildLinkSelect = document.getElementById('edit-note-child-link');
    editNoteErrorElement = document.getElementById('edit-note-error');
    closeEditNoteModalBtn = document.getElementById('close-edit-note-modal-btn');
    cancelEditNoteBtn = document.getElementById('cancel-edit-note-btn'); 

    if (!editNoteModal || !editNoteForm || !editNoteIdInput || !editNoteContentInput || !editNoteChildLinkSelect || !editNoteErrorElement || !closeEditNoteModalBtn || !cancelEditNoteBtn) {
        console.error("One or more Edit Note Modal UI elements are missing. Edit functionality will be affected.");
        return; // Stop if critical elements are missing
    }

    editNoteForm.addEventListener('submit', handleEditNoteSubmit);
    closeEditNoteModalBtn.addEventListener('click', () => toggleEditNoteModal(false));
    cancelEditNoteBtn.addEventListener('click', () => toggleEditNoteModal(false));
    
    // Populate children dropdown for edit modal too - this ensures it's ready when modal opens
    populateChildrenDropdown(editNoteChildLinkSelect, familyChildrenDataNotes);
}


function populateChildrenDropdown(selectElement, childrenData) {
    if (!selectElement) {
        console.warn("Select element for children dropdown not provided or found.");
        return;
    }
    selectElement.innerHTML = ''; 

    const defaultOption = document.createElement('option');
    defaultOption.value = "";
    defaultOption.textContent = "Aucun enfant spécifique";
    selectElement.appendChild(defaultOption);

    if (childrenData) {
        for (const childId in childrenData) {
            const child = childrenData[childId];
            const option = document.createElement('option');
            option.value = childId;
            option.textContent = escapeHTML(child.name);
            selectElement.appendChild(option);
        }
    }
}

async function handleAddNoteSubmit(event) {
    event.preventDefault();
    if (!dbNotes || !currentFamilyNameNotes || !currentUserIdNotes || !currentUserRoleNotes) {
        if(noteErrorElement) noteErrorElement.textContent = "Erreur de configuration."; return;
    }
    const content = noteContentInput.value.trim();
    const linkedChildId = noteChildLinkSelect.value;
    if(noteErrorElement) noteErrorElement.textContent = "";
    if (!content) { if(noteErrorElement) noteErrorElement.textContent = "Le contenu de la note ne peut pas être vide."; return; }

    const noteData = {
        content: content, timestamp: firebase.database.ServerValue.TIMESTAMP,
        authorId: currentUserIdNotes, authorRole: currentUserRoleNotes,
        childId: linkedChildId || null
    };
    try {
        await dbNotes.ref(`families/${currentFamilyNameNotes}/notes`).push(noteData);
        noteContentInput.value = ""; noteChildLinkSelect.value = "";
    } catch (error) {
        console.error("Error saving note:", error);
        if(noteErrorElement) noteErrorElement.textContent = `Erreur d'enregistrement: ${error.message}`;
    }
}

function listenForNotes() {
    const notesRef = dbNotes.ref(`families/${currentFamilyNameNotes}/notes`).orderByChild('timestamp');
    notesRef.on('value', snapshot => {
        if (!notesListElement) return;
        notesListElement.innerHTML = '';
        const notes = snapshot.val();
        if (notes) {
            const sortedNoteIds = Object.keys(notes).sort((a, b) => notes[b].timestamp - notes[a].timestamp);
            sortedNoteIds.forEach(noteId => {
                const noteData = notes[noteId];
                const noteCard = renderNoteCard(noteData, noteId);
                notesListElement.appendChild(noteCard);
            });
            if (sortedNoteIds.length === 0) notesListElement.innerHTML = '<p class="text-xs text-gray-500">Aucune note.</p>';
        } else {
            notesListElement.innerHTML = '<p class="text-xs text-gray-500">Aucune note.</p>';
        }
    }, error => {
        console.error("Error listening for notes:", error);
        if (notesListElement) notesListElement.innerHTML = `<p class="text-red-500 text-xs">Erreur de chargement.</p>`;
    });
}

function renderNoteCard(noteData, noteId) {
    const card = document.createElement('div');
    card.className = 'bg-yellow-100 p-3 rounded shadow-sm border border-yellow-200';
    card.dataset.noteId = noteId;

    let linkedChildInfo = '';
    if (noteData.childId) {
        const childName = getChildNameById(noteData.childId);
        linkedChildInfo = ` (Concerne: ${escapeHTML(childName)})`;
    }
    const formattedTimestamp = noteData.timestamp ? 
        new Date(noteData.timestamp).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : 
        'Date inconnue';

    const contentP = document.createElement('p');
    contentP.className = 'text-sm whitespace-pre-wrap';
    contentP.textContent = escapeHTML(noteData.content);
    card.appendChild(contentP);

    const metaP = document.createElement('p');
    metaP.className = 'text-xs text-gray-600 mt-1';
    metaP.innerHTML = `Par: ${escapeHTML(noteData.authorRole)} - Le: ${formattedTimestamp}${linkedChildInfo}`;
    card.appendChild(metaP);

    if (noteData.authorId === currentUserIdNotes) {
        const controlsDiv = document.createElement('div');
        controlsDiv.className = 'flex justify-end space-x-2 mt-1';

        const editButton = document.createElement('button');
        editButton.className = 'text-xs text-blue-500 hover:text-blue-700 edit-note-btn';
        editButton.textContent = 'Modifier';
        editButton.addEventListener('click', (e) => {
            e.stopPropagation(); 
            openEditNoteModal(noteId, noteData.content, noteData.childId);
        });
        controlsDiv.appendChild(editButton);

        const deleteButton = document.createElement('button');
        deleteButton.className = 'text-xs text-red-500 hover:text-red-700 delete-note-btn';
        deleteButton.textContent = 'Supprimer';
        deleteButton.addEventListener('click', (e) => {
            e.stopPropagation(); 
            handleDeleteNote(noteId);
        });
        controlsDiv.appendChild(deleteButton);
        card.appendChild(controlsDiv);
    }
    return card;
}

function getChildNameById(childId) {
    if (familyChildrenDataNotes && familyChildrenDataNotes[childId]) {
        return familyChildrenDataNotes[childId].name || "Enfant inconnu";
    }
    return "Enfant inconnu";
}

function toggleEditNoteModal(show) {
    if (!editNoteModal) { console.error("Edit note modal element not found for toggle."); return; }
    if (show) {
        editNoteModal.classList.remove('hidden');
    } else {
        editNoteModal.classList.add('hidden');
    }
}

function openEditNoteModal(noteId, currentContent, currentChildId) {
    if (!editNoteModal || !editNoteForm || !editNoteIdInput || !editNoteContentInput || !editNoteChildLinkSelect || !editNoteErrorElement) {
        console.error("Edit modal form elements not found for openEditNoteModal.");
        return;
    }
    editNoteForm.reset(); 
    editNoteErrorElement.textContent = '';

    editNoteIdInput.value = noteId;
    editNoteContentInput.value = currentContent;
    
    // Ensure children dropdown is populated (it should be by initEditNoteModal, but good to be sure)
    // populateChildrenDropdown(editNoteChildLinkSelect, familyChildrenDataNotes); 
    editNoteChildLinkSelect.value = currentChildId || ""; 

    toggleEditNoteModal(true);
}

async function handleEditNoteSubmit(event) {
    event.preventDefault();
    if (!dbNotes || !currentFamilyNameNotes || !editNoteIdInput || !editNoteContentInput || !editNoteChildLinkSelect || !editNoteErrorElement) {
        if(editNoteErrorElement) editNoteErrorElement.textContent = "Erreur de configuration du formulaire."; return;
    }

    const noteId = editNoteIdInput.value;
    const newContent = editNoteContentInput.value.trim();
    const newLinkedChildId = editNoteChildLinkSelect.value;
    if(editNoteErrorElement) editNoteErrorElement.textContent = '';

    if (!newContent) {
        if(editNoteErrorElement) editNoteErrorElement.textContent = "Le contenu de la note ne peut pas être vide."; return;
    }
    if (!noteId) {
        if(editNoteErrorElement) editNoteErrorElement.textContent = "ID de la note manquant."; return;
    }

    const updatedNoteData = {
        content: newContent,
        childId: newLinkedChildId || null,
        timestamp: firebase.database.ServerValue.TIMESTAMP 
    };

    try {
        await dbNotes.ref(`families/${currentFamilyNameNotes}/notes/${noteId}`).update(updatedNoteData);
        toggleEditNoteModal(false);
    } catch (error) {
        console.error("Error updating note:", error);
        if(editNoteErrorElement) editNoteErrorElement.textContent = `Erreur de mise à jour: ${error.message}`;
    }
}

async function handleDeleteNote(noteId) {
    if (!dbNotes || !currentFamilyNameNotes || !noteId) {
        console.error("Cannot delete note: missing DB service, family name, or note ID."); return;
    }
    if (confirm("Êtes-vous sûr de vouloir supprimer cette note?")) {
        try {
            await dbNotes.ref(`families/${currentFamilyNameNotes}/notes/${noteId}`).remove();
        } catch (error) {
            console.error("Error deleting note:", error);
            alert(`Erreur lors de la suppression de la note: ${error.message}`);
        }
    }
}

function escapeHTML(str) {
    if (typeof str !== 'string') return '';
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}
