/*
TodoList Task Data Model (stored under families/{familyName}/todoList/{taskId}):
- taskId: Unique ID from Firebase push().
- title: String, required.
- description: String, optional.
- dueDate: String (YYYY-MM-DD), optional.
- priority: String ("Haute", "Moyenne", "Basse"), default "Moyenne".
- assignedTo: String - Role ("Papa", "Maman") or "LesDeux".
- status: String ("À faire", "En cours", "Terminé"), default "À faire".
- createdAt: Timestamp (e.g., firebase.database.ServerValue.TIMESTAMP or new Date().toISOString()).
- createdBy: String, Firebase uid of the user who created the task.
*/

let dbTodo;
let currentFamilyNameTodo;
let currentUserIdTodo;
let familyUsersDataTodo = {};
let allTasksData = {}; // Local cache for tasks

let addTaskBtn;
let taskModal, taskForm, taskIdInput, taskTitleInput, taskDescriptionInput, taskDueDateInput;
let taskPrioritySelect, taskAssignedToSelect, taskStatusSelect, taskErrorElement;
let closeTaskModalBtn, cancelTaskBtn;

let tasksTodoColumn, tasksInProgressColumn, tasksDoneColumn;

function initTodo(database, familyName, userId, usersData) {
    dbTodo = database;
    currentFamilyNameTodo = familyName;
    currentUserIdTodo = userId;
    familyUsersDataTodo = usersData || {};

    addTaskBtn = document.getElementById('add-task-btn');
    taskModal = document.getElementById('task-modal');
    taskForm = document.getElementById('task-form');
    taskIdInput = document.getElementById('task-id');
    taskTitleInput = document.getElementById('task-title');
    taskDescriptionInput = document.getElementById('task-description');
    taskDueDateInput = document.getElementById('task-due-date');
    taskPrioritySelect = document.getElementById('task-priority');
    taskAssignedToSelect = document.getElementById('task-assigned-to');
    taskStatusSelect = document.getElementById('task-status');
    taskErrorElement = document.getElementById('task-error');
    closeTaskModalBtn = document.getElementById('close-task-modal-btn');
    cancelTaskBtn = document.getElementById('cancel-task-btn');

    tasksTodoColumn = document.getElementById('tasks-todo');
    tasksInProgressColumn = document.getElementById('tasks-inprogress');
    tasksDoneColumn = document.getElementById('tasks-done');

    if (!addTaskBtn || !taskModal || !taskForm || !tasksTodoColumn || !tasksInProgressColumn || !tasksDoneColumn) {
        console.error("One or more TodoList UI elements are missing.");
        return;
    }

    addTaskBtn.addEventListener('click', () => openTaskModal());
    taskForm.addEventListener('submit', handleTaskFormSubmit);
    if(closeTaskModalBtn) closeTaskModalBtn.addEventListener('click', () => toggleTaskModal(false));
    if(cancelTaskBtn) cancelTaskBtn.addEventListener('click', () => toggleTaskModal(false));

    populateAssignedToDropdown();

    if (dbTodo && currentFamilyNameTodo) {
        listenForTasks();
    } else {
        console.warn("DB service or family name not available for TodoList.");
    }
}

function populateAssignedToDropdown() {
    if (!taskAssignedToSelect) return;
    taskAssignedToSelect.innerHTML = '';
    const lesDeuxOption = document.createElement('option');
    lesDeuxOption.value = "LesDeux"; lesDeuxOption.textContent = "Les Deux";
    taskAssignedToSelect.appendChild(lesDeuxOption);
    for (const uid in familyUsersDataTodo) {
        const user = familyUsersDataTodo[uid];
        if (user.role === 'Papa' || user.role === 'Maman') {
            const option = document.createElement('option');
            option.value = user.role; option.textContent = user.role;
            taskAssignedToSelect.appendChild(option);
        }
    }
}

function toggleTaskModal(show) {
    if (!taskModal || !taskForm || !taskErrorElement) return;
    if (show) {
        taskForm.reset();
        taskErrorElement.textContent = '';
        taskModal.classList.remove('hidden');
    } else {
        taskModal.classList.add('hidden');
    }
}

function openTaskModal(taskId = null) {
    toggleTaskModal(true); // Reset and show
    const modalTitle = document.getElementById('task-modal-title');

    if (taskId && allTasksData[taskId]) {
        modalTitle.textContent = "Modifier la Tâche";
        const taskData = allTasksData[taskId];
        taskIdInput.value = taskId;
        taskTitleInput.value = taskData.title;
        taskDescriptionInput.value = taskData.description || '';
        taskDueDateInput.value = taskData.dueDate || '';
        taskPrioritySelect.value = taskData.priority || 'Moyenne';
        taskAssignedToSelect.value = taskData.assignedTo || 'LesDeux';
        taskStatusSelect.value = taskData.status || 'À faire';
    } else {
        modalTitle.textContent = "Ajouter une Tâche";
        taskIdInput.value = ''; // Clear task ID for new task
        taskPrioritySelect.value = "Moyenne";
        taskStatusSelect.value = "À faire";
        // Other fields are cleared by form.reset() in toggleTaskModal
    }
}

async function handleTaskFormSubmit(event) {
    event.preventDefault();
    if (!dbTodo || !currentFamilyNameTodo || !currentUserIdTodo) {
        taskErrorElement.textContent = "Erreur de configuration."; return;
    }

    const title = taskTitleInput.value.trim();
    const description = taskDescriptionInput.value.trim();
    const dueDate = taskDueDateInput.value;
    const priority = taskPrioritySelect.value;
    const assignedTo = taskAssignedToSelect.value;
    const status = taskStatusSelect.value; // Now getting status from form
    const existingTaskId = taskIdInput.value;

    if (!title) { taskErrorElement.textContent = "Le titre est requis."; return; }

    const taskData = {
        title, description,
        dueDate: dueDate || null,
        priority, assignedTo, status,
        // For new tasks, add createdBy and createdAt. For updates, these are preserved.
    };

    try {
        if (existingTaskId) { // Editing existing task
            // We don't update createdBy or createdAt for existing tasks
            await dbTodo.ref(`families/${currentFamilyNameTodo}/todoList/${existingTaskId}`).update(taskData);
        } else { // Creating new task
            taskData.createdAt = firebase.database.ServerValue.TIMESTAMP;
            taskData.createdBy = currentUserIdTodo;
            await dbTodo.ref(`families/${currentFamilyNameTodo}/todoList`).push(taskData);
        }
        toggleTaskModal(false);
    } catch (error) {
        console.error("Error saving task:", error);
        taskErrorElement.textContent = `Erreur d'enregistrement: ${error.message}`;
    }
}

async function handleDeleteTask(taskId) {
    if (!dbTodo || !currentFamilyNameTodo || !taskId) {
        console.error("Cannot delete task: missing DB service, family name, or task ID.");
        return;
    }
    if (confirm("Supprimer cette tâche?")) {
        try {
            await dbTodo.ref(`families/${currentFamilyNameTodo}/todoList/${taskId}`).remove();
            console.log("Task deleted:", taskId);
            // UI will update via listenForTasks
        } catch (error) {
            console.error("Error deleting task:", error);
            // Optionally, display an error to the user
        }
    }
}

function listenForTasks() {
    const tasksRef = dbTodo.ref(`families/${currentFamilyNameTodo}/todoList`);
    tasksRef.on('value', snapshot => {
        if (!tasksTodoColumn || !tasksInProgressColumn || !tasksDoneColumn) return;
        
        tasksTodoColumn.innerHTML = '';
        tasksInProgressColumn.innerHTML = '';
        tasksDoneColumn.innerHTML = '';
        allTasksData = snapshot.val() || {}; // Update local cache

        if (Object.keys(allTasksData).length === 0) {
            tasksTodoColumn.innerHTML = '<p class="text-xs text-gray-500">Aucune tâche.</p>';
            tasksInProgressColumn.innerHTML = '<p class="text-xs text-gray-500">Aucune tâche.</p>';
            tasksDoneColumn.innerHTML = '<p class="text-xs text-gray-500">Aucune tâche.</p>';
            return;
        }
        
        let tasksFoundInTodo = 0, tasksFoundInProgress = 0, tasksFoundInDone = 0;

        for (const taskId in allTasksData) {
            const taskData = allTasksData[taskId];
            const taskCard = renderTaskCard(taskData, taskId);
            if (taskData.status === "À faire") {
                tasksTodoColumn.appendChild(taskCard);
                tasksFoundInTodo++;
            } else if (taskData.status === "En cours") {
                tasksInProgressColumn.appendChild(taskCard);
                tasksFoundInProgress++;
            } else if (taskData.status === "Terminé") {
                tasksDoneColumn.appendChild(taskCard);
                tasksFoundInDone++;
            }
        }
        if (tasksFoundInTodo === 0) tasksTodoColumn.innerHTML = '<p class="text-xs text-gray-500">Aucune tâche.</p>';
        if (tasksFoundInProgress === 0) tasksInProgressColumn.innerHTML = '<p class="text-xs text-gray-500">Aucune tâche.</p>';
        if (tasksFoundInDone === 0) tasksDoneColumn.innerHTML = '<p class="text-xs text-gray-500">Aucune tâche.</p>';

    }, error => {
        console.error("Error listening for tasks:", error);
        tasksTodoColumn.innerHTML = '<p class="text-red-500 text-xs">Erreur de chargement.</p>';
        // Similar for other columns
    });
}

function renderTaskCard(taskData, taskId) {
    const card = document.createElement('div');
    card.className = 'bg-white p-3 rounded shadow-sm border border-gray-200 hover:shadow-md';
    card.dataset.taskId = taskId;

    let priorityColor = 'text-gray-600';
    if (taskData.priority === 'Haute') priorityColor = 'text-red-600 font-semibold';
    else if (taskData.priority === 'Basse') priorityColor = 'text-green-600';

    // Card content
    const titleElement = document.createElement('h4');
    titleElement.className = 'font-semibold text-md mb-1';
    titleElement.textContent = escapeHTML(taskData.title);
    card.appendChild(titleElement);

    if (taskData.description) {
        const descriptionElement = document.createElement('p');
        descriptionElement.className = 'text-sm text-gray-700 mb-2';
        descriptionElement.textContent = escapeHTML(taskData.description);
        card.appendChild(descriptionElement);
    }

    const detailsDiv = document.createElement('div');
    detailsDiv.className = 'text-xs text-gray-500 space-y-0.5 mb-2'; // Added mb-2
    detailsDiv.innerHTML = `
        <p><strong>Échéance:</strong> ${taskData.dueDate ? new Date(taskData.dueDate+'T00:00:00').toLocaleDateString('fr-FR') : '-'}</p>
        <p><strong>Priorité:</strong> <span class="${priorityColor}">${taskData.priority}</span></p>
        <p><strong>Assigné à:</strong> ${escapeHTML(taskData.assignedTo)}</p>
        <p><strong>Statut:</strong> ${escapeHTML(taskData.status)}</p> 
    `; // Display status on card
    card.appendChild(detailsDiv);

    // Controls container
    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'flex justify-end space-x-2 mt-1'; // Added mt-1 for spacing

    const editButton = document.createElement('button');
    editButton.className = 'text-xs text-blue-500 hover:text-blue-700 edit-task-btn';
    editButton.textContent = 'Modifier';
    editButton.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent card click if any
        openTaskModal(taskId);
    });
    controlsDiv.appendChild(editButton);

    const deleteButton = document.createElement('button');
    deleteButton.className = 'text-xs text-red-500 hover:text-red-700 delete-task-btn';
    deleteButton.textContent = 'Supprimer';
    deleteButton.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent card click if any
        handleDeleteTask(taskId);
    });
    controlsDiv.appendChild(deleteButton);
    card.appendChild(controlsDiv);

    // Card itself can also be clickable to open edit modal (optional, if edit button is too small)
    // card.addEventListener('click', () => openTaskModal(taskId)); // Uncomment if whole card should be clickable

    return card;
}

function escapeHTML(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str || ''));
    return div.innerHTML;
}