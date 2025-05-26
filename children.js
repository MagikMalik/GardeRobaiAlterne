let db;
let currentFamilyName;
let childrenListElement;
let addChildModalElement;
let addChildFormElement;
let addChildErrorElement;

function initChildren(databaseService, familyNameFromAuth) {
    db = databaseService;
    currentFamilyName = familyNameFromAuth;

    if (!db || !currentFamilyName) {
        console.error("Children module initialized without database service or family name.");
        return;
    }

    const addChildBtn = document.getElementById('add-child-btn');
    addChildModalElement = document.getElementById('add-child-modal');
    const closeAddChildModalBtn = document.getElementById('close-add-child-modal-btn');
    const cancelAddChildBtn = document.getElementById('cancel-add-child-btn');
    addChildFormElement = document.getElementById('add-child-form');
    childrenListElement = document.getElementById('children-list');
    addChildErrorElement = document.getElementById('add-child-error');

    if (!addChildBtn || !addChildModalElement || !closeAddChildModalBtn || !cancelAddChildBtn || !addChildFormElement || !childrenListElement || !addChildErrorElement) {
        console.error("One or more child management UI elements are missing. Check IDs in index.html.");
        return;
    }

    addChildBtn.addEventListener('click', () => toggleAddChildModal(true));
    closeAddChildModalBtn.addEventListener('click', () => toggleAddChildModal(false));
    cancelAddChildBtn.addEventListener('click', () => toggleAddChildModal(false));
    addChildFormElement.addEventListener('submit', handleAddChildFormSubmit);

    console.log(`Initializing children management for family: ${currentFamilyName}`);
    listenForChildrenUpdates();
}

function toggleAddChildModal(show) {
    if (!addChildModalElement || !addChildFormElement || !addChildErrorElement) {
        console.error("Modal elements not found in toggleAddChildModal");
        return;
    }
    if (show) {
        addChildFormElement.reset(); // Clear form fields
        addChildErrorElement.textContent = ''; // Clear previous errors
        addChildModalElement.classList.remove('hidden');
    } else {
        addChildModalElement.classList.add('hidden');
    }
}

async function handleAddChildFormSubmit(event) {
    event.preventDefault();
    if (!addChildErrorElement || !addChildFormElement) {
        console.error("Form or error element not found in handleAddChildFormSubmit");
        return;
    }

    const childNameInput = document.getElementById('child-name');
    const childDobInput = document.getElementById('child-dob');

    if (!childNameInput || !childDobInput) {
        console.error("Child name or DOB input not found.");
        addChildErrorElement.textContent = "Erreur de formulaire.";
        return;
    }

    const childName = childNameInput.value.trim();
    const childDob = childDobInput.value;
    addChildErrorElement.textContent = '';

    if (!childName || !childDob) {
        addChildErrorElement.textContent = 'Le nom et la date de naissance sont requis.';
        return;
    }

    if (!currentFamilyName) {
        console.error("currentFamilyName is not set. Cannot add child.");
        addChildErrorElement.textContent = 'Erreur: Nom de famille non défini. Veuillez vous reconnecter.';
        return;
    }
    if (!db) {
        console.error("Database service (db) is not initialized.");
        addChildErrorElement.textContent = 'Erreur: Service de base de données non initialisé.';
        return;
    }

    const childData = { name: childName, dob: childDob };

    try {
        // Note: Using firebase.database().ref directly as db might be the service, not the root.
        // If db is firebase.database() itself, then db.ref(...) is correct.
        // Assuming db is firebase.database() based on typical usage.
        const newChildRef = db.ref(`families/${currentFamilyName}/children`).push();
        await newChildRef.set(childData);
        console.log("Child added successfully, ref:", newChildRef.key);
        toggleAddChildModal(false);
        // listenForChildrenUpdates will refresh the list
    } catch (error) {
        console.error("Error adding child:", error);
        addChildErrorElement.textContent = `Erreur lors de l'ajout: ${error.message}`;
    }
}

function listenForChildrenUpdates() {
    if (!currentFamilyName) {
        console.error("currentFamilyName is not set. Cannot listen for children updates.");
        if (childrenListElement) childrenListElement.innerHTML = '<p class="text-gray-500">Erreur: Nom de famille non défini.</p>';
        return;
    }
    if (!db) {
        console.error("Database service (db) is not initialized. Cannot listen for children updates.");
        if (childrenListElement) childrenListElement.innerHTML = '<p class="text-gray-500">Erreur: Service DB non initialisé.</p>';
        return;
    }
    if (!childrenListElement) {
        console.error("childrenListElement not found for updates.");
        return;
    }

    const childrenRef = db.ref(`families/${currentFamilyName}/children`);
    childrenRef.on('value', snapshot => {
        childrenListElement.innerHTML = ''; // Clear current list

        const children = snapshot.val();
        if (children) {
            let count = 0;
            for (const childId in children) {
                const child = children[childId];
                const childItem = document.createElement('div');
                childItem.classList.add('child-item', 'p-2', 'border-b');
                childItem.dataset.childId = childId;

                const nameElement = document.createElement('p');
                nameElement.innerHTML = `<strong>Nom:</strong> ${escapeHTML(child.name)}`;
                childItem.appendChild(nameElement);

                const dobElement = document.createElement('p');
                // Format DOB if needed, for now, directly display
                const formattedDob = child.dob ? new Date(child.dob).toLocaleDateString('fr-FR') : 'N/A';
                dobElement.innerHTML = `<strong>Né(e) le:</strong> ${formattedDob}`;
                childItem.appendChild(dobElement);
                
                // Placeholder buttons container
                const buttonsContainer = document.createElement('div');
                buttonsContainer.classList.add('mt-1');

                const editButton = document.createElement('button');
                editButton.classList.add('text-xs', 'text-blue-500', 'mr-1', 'edit-child-btn');
                editButton.textContent = 'Modifier';
                editButton.addEventListener('click', () => console.log("Edit child:", childId)); // Placeholder
                buttonsContainer.appendChild(editButton);

                const deleteButton = document.createElement('button');
                deleteButton.classList.add('text-xs', 'text-red-500', 'delete-child-btn');
                deleteButton.textContent = 'Supprimer';
                deleteButton.addEventListener('click', () => console.log("Delete child:", childId)); // Placeholder
                buttonsContainer.appendChild(deleteButton);
                
                childItem.appendChild(buttonsContainer);

                childrenListElement.appendChild(childItem);
                count++;
            }
            if (count === 0) { // Should not happen if children object is not null/undefined
                 childrenListElement.innerHTML = '<p class="text-gray-500">Aucun enfant ajouté.</p>';
            }
        } else {
            childrenListElement.innerHTML = '<p class="text-gray-500">Aucun enfant ajouté.</p>';
        }
    }, error => {
        console.error("Error listening for children updates:", error);
        childrenListElement.innerHTML = `<p class="text-red-500">Erreur de chargement des enfants: ${error.message}</p>`;
    });
}

// Helper function to prevent XSS
function escapeHTML(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}
