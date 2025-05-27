/*
Calendar Event Data Model (stored under families/{familyName}/calendarEvents/{eventId}):
- eventId: Unique ID (Firebase push() key)
- type: String - e.g., "gardePapa", "gardeMaman", "vacancesPapa", "vacancesMaman", "evenementSpecial", "jourFerie"
- startDate: String - ISO 8601 date (YYYY-MM-DD).
- endDate: String - ISO 8601 date (YYYY-MM-DD). Inclusive. For single-day events, can be same as startDate.
- title: String (optional) - User-defined title, especially for "evenementSpecial".
- description: String (optional) - More details.
- userId: String (optional) - Firebase uid of the parent, for "gardePapa", "gardeMaman", etc.
*/

let currentDateGlobal = new Date(); // Used for month navigation
let calendarGrid;
let currentMonthYearElement;
// let db; 
// let currentFamilyName; 
let familyCalendarEvents = {}; 
let familyUsersData = {}; // Renamed from familyUsers to avoid conflict with local var in some functions

// Modal Elements
let eventModal, eventForm, eventModalTitle, eventIdInput, eventTypeSelect, eventUserIdSelect;
let eventStartDateInput, eventEndDateInput, eventTitleInput, eventDescriptionInput;
let eventErrorElement, deleteEventBtn, cancelEventBtn, closeEventModalBtn;

// Custody Config Elements
let custodyConfigForm, custodyPatternSelect, custodyStartDateInput, custodyStartingParentRoleSelect;
let custodyDurationMonthsInput, generateCustodyPlanBtn, custodyConfigMessageElement;

// Weekly Recap Elements
let currentGuardianTodayElement, currentGuardianWeekElement, daysRemainingCurrentGardeElement;
let nextTransitionDateElement, nextTransitionParentElement, weeklyEventsListElement;


function initCalendar(databaseService, familyNameFromAuth) {
    db = databaseService;
    currentFamilyName = familyNameFromAuth;

    // Calendar display elements
    const prevMonthBtn = document.getElementById('prev-month-btn');
    const nextMonthBtn = document.getElementById('next-month-btn');
    currentMonthYearElement = document.getElementById('current-month-year');
    calendarGrid = document.getElementById('calendar-grid');

    if (!prevMonthBtn || !nextMonthBtn || !currentMonthYearElement || !calendarGrid) {
        console.error("Calendar UI elements not found."); return;
    }
    if (!db || !currentFamilyName) {
        console.warn("Database service or familyName not provided to initCalendar. Operations will be limited.");
    }

    // Weekly Recap Elements
    currentGuardianTodayElement = document.getElementById('current-guardian-today');
    currentGuardianWeekElement = document.getElementById('current-guardian-week');
    daysRemainingCurrentGardeElement = document.getElementById('days-remaining-current-garde');
    nextTransitionDateElement = document.getElementById('next-transition-date');
    nextTransitionParentElement = document.getElementById('next-transition-parent');
    weeklyEventsListElement = document.getElementById('weekly-events-list');


    // Event Modal Elements (ensure these are initialized before use)
    eventModal = document.getElementById('event-modal');
    eventForm = document.getElementById('event-form');
    // ... (rest of modal elements as before) ...
    if (eventModal && eventForm) { // Basic check
        eventModalTitle = document.getElementById('event-modal-title');
        eventIdInput = document.getElementById('event-id');
        eventTypeSelect = document.getElementById('event-type');
        eventUserIdSelect = document.getElementById('event-userId');
        eventStartDateInput = document.getElementById('event-start-date');
        eventEndDateInput = document.getElementById('event-end-date');
        eventTitleInput = document.getElementById('event-title');
        eventDescriptionInput = document.getElementById('event-description');
        eventErrorElement = document.getElementById('event-error');
        deleteEventBtn = document.getElementById('delete-event-btn');
        cancelEventBtn = document.getElementById('cancel-event-btn');
        closeEventModalBtn = document.getElementById('close-event-modal-btn');

        eventForm.addEventListener('submit', handleEventFormSubmit);
        cancelEventBtn.addEventListener('click', () => toggleEventModal(false));
        closeEventModalBtn.addEventListener('click', () => toggleEventModal(false));
        deleteEventBtn.addEventListener('click', handleDeleteEvent);
        eventTypeSelect.addEventListener('change', () => {
            const selectedType = eventTypeSelect.value;
            const isParentalEvent = ['gardePapa', 'gardeMaman', 'vacancesPapa', 'vacancesMaman'].includes(selectedType);
            eventUserIdSelect.closest('div').style.display = isParentalEvent ? 'block' : 'none';
        });
    } else {
         console.warn("Event modal form elements not fully found. Modal functionality might be affected.");
    }
    
    calendarGrid.addEventListener('click', (e) => {
        const dayCell = e.target.closest('div[data-date]');
        if (dayCell) {
            const date = dayCell.dataset.date;
            const eventId = dayCell.dataset.eventId || dayCell.dataset.specialEventId || dayCell.dataset.jourFerieEventId;
            openEventModal(date, eventId);
        }
    });

    prevMonthBtn.addEventListener('click', () => {
        currentDateGlobal.setMonth(currentDateGlobal.getMonth() - 1);
        renderCalendar();
    });
    nextMonthBtn.addEventListener('click', () => {
        currentDateGlobal.setMonth(currentDateGlobal.getMonth() + 1);
        renderCalendar();
    });

    // Add event listener for the new "Add New Event" button
    const addNewEventButton = document.getElementById('add-new-event-btn');
    if (addNewEventButton) {
        addNewEventButton.addEventListener('click', () => {
            // Option 2: Open with today's date pre-filled
            const today = new Date();
            const localYear = today.getFullYear();
            const localMonth = (today.getMonth() + 1).toString().padStart(2, '0');
            const localDay = today.getDate().toString().padStart(2, '0');
            const todayDateString = `${localYear}-${localMonth}-${localDay}`;
            openEventModal(todayDateString, null); // Passing today's date, and null for eventId
        });
    } else {
        console.warn("Button with ID 'add-new-event-btn' not found. 'Add New Event' functionality will not be available.");
    }

    if (currentFamilyName && db) {
        fetchFamilyUsers(currentFamilyName).then(() => {
            initCustodyConfig(currentFamilyName, db); // Ensuring this is uncommented as per user's prior action
            listenForCalendarEvents(currentFamilyName); // Ensuring this is active
            // Manual calls to renderCalendar and updateWeeklyRecap are removed as listenForCalendarEvents handles it.
        });
    } else {
        renderCalendar(); // Render calendar even if no family data (empty state)
        updateWeeklyRecap(new Date(), {}, {}); // Update recap with empty data
    }
}

function getUserRole(uid, users) {
    if (users && users[uid] && users[uid].role) {
        return users[uid].role; // 'Papa' or 'Maman'
    }
    return 'Parent inconnu';
}

function updateWeeklyRecap(currentActualDate, events, users) {
    // Construct YYYY-MM-DD string from local date components for currentActualDate (today)
    const localTodayYear = currentActualDate.getFullYear();
    const localTodayMonth = (currentActualDate.getMonth() + 1).toString().padStart(2, '0');
    const localTodayDay = currentActualDate.getDate().toString().padStart(2, '0');
    const todayString = `${localTodayYear}-${localTodayMonth}-${localTodayDay}`;
    let currentGardeEventToday = null;
    let parentToday = "-";
    let parentWeek = "-"; // Using today's parent as proxy for week's parent
    let daysRemaining = "-";
    let nextTransitionString = "-";
    let nextTransitionParentRole = "-";

    // Find current garde event for today
    for (const eventId in events) {
        const event = events[eventId];
        if ((event.type === 'gardePapa' || event.type === 'gardeMaman' || event.type === 'vacancesPapa' || event.type === 'vacancesMaman') &&
            event.startDate <= todayString && event.endDate >= todayString) {
            currentGardeEventToday = event;
            break;
        }
    }

    if (currentGardeEventToday) {
        parentToday = getUserRole(currentGardeEventToday.userId, users);
        parentWeek = parentToday; // Proxy

        const endDate = new Date(currentGardeEventToday.endDate + 'T23:59:59'); // Ensure end of day
        const diffTime = Math.max(endDate - currentActualDate, 0); // Use currentActualDate here
        daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (currentActualDate.toISOString().split('T')[0] === currentGardeEventToday.endDate) {
             daysRemaining = 1; // If it's the last day, 1 day remaining.
        } else if (new Date(currentActualDate.toISOString().split('T')[0]) > new Date(currentGardeEventToday.endDate)) {
             daysRemaining = 0; // If somehow current date is past end date of "today's event"
        }


        // Find next transition
        const transitionDate = new Date(endDate);
        transitionDate.setDate(endDate.getDate() + 1); // Day after current garde ends
        const transitionDateString = transitionDate.toISOString().split('T')[0];
        nextTransitionString = transitionDate.toLocaleDateString('fr-FR');

        let nextGardeEvent = null;
        let minStartDateDiff = Infinity;

        for (const eventId in events) {
            const event = events[eventId];
            if ((event.type === 'gardePapa' || event.type === 'gardeMaman' || event.type === 'vacancesPapa' || event.type === 'vacancesMaman') &&
                event.startDate >= transitionDateString) {
                const eventStartDate = new Date(event.startDate);
                const diff = eventStartDate - transitionDate;
                if (diff < minStartDateDiff) {
                    minStartDateDiff = diff;
                    nextGardeEvent = event;
                }
            }
        }
        if (nextGardeEvent) {
            nextTransitionParentRole = getUserRole(nextGardeEvent.userId, users);
            // If the nextGardeEvent starts later than the immediate transitionDate, update the date string
            if (nextGardeEvent.startDate !== transitionDateString) {
                 nextTransitionString = new Date(nextGardeEvent.startDate + 'T00:00:00').toLocaleDateString('fr-FR');
            }
        }
    }

    // Update DOM
    if (currentGuardianTodayElement) currentGuardianTodayElement.textContent = parentToday;
    if (currentGuardianWeekElement) currentGuardianWeekElement.textContent = parentWeek;
    if (daysRemainingCurrentGardeElement) daysRemainingCurrentGardeElement.textContent = daysRemaining.toString();
    if (nextTransitionDateElement) nextTransitionDateElement.textContent = nextTransitionString;
    if (nextTransitionParentElement) nextTransitionParentElement.textContent = nextTransitionParentRole;

    // Events this week
    if (weeklyEventsListElement) {
        weeklyEventsListElement.innerHTML = ''; // Clear existing
        const startOfWeek = new Date(currentActualDate);
        startOfWeek.setDate(currentActualDate.getDate() - (currentActualDate.getDay() + 6) % 7); // Monday
        startOfWeek.setHours(0,0,0,0);
        
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6); // Sunday
        endOfWeek.setHours(23,59,59,999);

        // Construct YYYY-MM-DD string from local date components for startOfWeek
        const localSOWYear = startOfWeek.getFullYear();
        const localSOWMonth = (startOfWeek.getMonth() + 1).toString().padStart(2, '0');
        const localSOWDay = startOfWeek.getDate().toString().padStart(2, '0');
        const startOfWeekString = `${localSOWYear}-${localSOWMonth}-${localSOWDay}`;

        // Construct YYYY-MM-DD string from local date components for endOfWeek
        const localEOWYear = endOfWeek.getFullYear();
        const localEOWMonth = (endOfWeek.getMonth() + 1).toString().padStart(2, '0');
        const localEOWDay = endOfWeek.getDate().toString().padStart(2, '0');
        const endOfWeekString = `${localEOWYear}-${localEOWMonth}-${localEOWDay}`;
        
        // ADD THIS LOG:
        console.log(`[updateWeeklyRecap] Checking for events between ${startOfWeekString} and ${endOfWeekString}`);
        console.log("[updateWeeklyRecap] All events being considered:", JSON.stringify(events));


        let eventsFoundThisWeek = false;

        for (const eventId in events) { // 'events' here is familyCalendarEvents
            const event = events[eventId];
            // ADD THIS LOG (can be verbose, but useful for debugging):
            // console.log(`[updateWeeklyRecap] Checking event: ${event.title || event.type} (${event.startDate} to ${event.endDate})`);

            // Check if event overlaps with the current week
            if (event.startDate <= endOfWeekString && event.endDate >= startOfWeekString) {
                 if (event.type === 'evenementSpecial' || event.type === 'jourFerie' || event.type.startsWith('vacances')) {
                    const li = document.createElement('li');
                    let eventDateDisplay = new Date(event.startDate + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' });
                    if (event.startDate !== event.endDate) {
                        eventDateDisplay += ` - ${new Date(event.endDate + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })}`;
                    }
                    li.textContent = `${event.title || event.type} (${eventDateDisplay})`;
                    weeklyEventsListElement.appendChild(li);
                    eventsFoundThisWeek = true;
                }
            }
        }
        if (!eventsFoundThisWeek) {
            weeklyEventsListElement.innerHTML = '<li>Aucun événement spécial programmé</li>';
        }
    }
}


function initCustodyConfig(familyName, database) {
    custodyConfigForm = document.getElementById('custody-config-form');
    custodyPatternSelect = document.getElementById('custody-pattern');
    custodyStartDateInput = document.getElementById('custody-start-date');
    custodyStartingParentRoleSelect = document.getElementById('custody-starting-parent-role');
    custodyDurationMonthsInput = document.getElementById('custody-duration-months');
    generateCustodyPlanBtn = document.getElementById('generate-custody-plan-btn');
    custodyConfigMessageElement = document.getElementById('custody-config-message');

    if (!custodyConfigForm || !generateCustodyPlanBtn || !custodyStartingParentRoleSelect || !custodyConfigMessageElement) {
        console.error("Custody config form elements not found. Check IDs."); return;
    }

    generateCustodyPlanBtn.addEventListener('click', handleGenerateCustodyPlan);
    custodyStartingParentRoleSelect.innerHTML = ''; 
    let rolesFound = 0;
    for (const uid in familyUsersData) { // Use familyUsersData
        const user = familyUsersData[uid];
        if (user.role === 'Papa' || user.role === 'Maman') {
            const option = document.createElement('option');
            option.value = user.role; 
            option.textContent = user.role;
            custodyStartingParentRoleSelect.appendChild(option);
            rolesFound++;
        }
    }
    if (rolesFound < 2) {
         custodyConfigMessageElement.textContent = "Info: Les deux parents (Papa et Maman) doivent être enregistrés pour générer un planning.";
    }
    if (rolesFound === 0) { 
         ['Papa', 'Maman'].forEach(role => {
            const option = document.createElement('option'); option.value = role;
            option.textContent = role + " (non trouvé)"; option.disabled = true;
            custodyStartingParentRoleSelect.appendChild(option);
        });
    }
}

async function fetchFamilyMemberUids(familyName) {
    if (!db) return {};
    const usersRef = db.ref(`families/${familyName}/users`);
    try {
        const snapshot = await usersRef.once('value');
        const users = snapshot.val() || {};
        const uids = {};
        for (const uid in users) {
            if (users[uid].role === 'Papa') uids.Papa = uid;
            if (users[uid].role === 'Maman') uids.Maman = uid;
        }
        return uids;
    } catch (error) { console.error("Error fetching family member UIDs:", error); return {}; }
}

async function handleGenerateCustodyPlan(event) {
    event.preventDefault();
    custodyConfigMessageElement.textContent = '';
    const pattern = custodyPatternSelect.value;
    const startDateString = custodyStartDateInput.value;
    const startingParentRole = custodyStartingParentRoleSelect.value;
    const durationMonths = parseInt(custodyDurationMonthsInput.value, 10);

    if (!pattern || !startDateString || !startingParentRole || !durationMonths) {
        custodyConfigMessageElement.textContent = "Erreur: Tous les champs sont requis.";
        custodyConfigMessageElement.className = 'text-red-500 text-xs mt-1'; return;
    }
    if (durationMonths < 1 || durationMonths > 24) {
        custodyConfigMessageElement.textContent = "Erreur: La durée doit être entre 1 et 24 mois.";
        custodyConfigMessageElement.className = 'text-red-500 text-xs mt-1'; return;
    }

    const memberUids = await fetchFamilyMemberUids(currentFamilyName);
    if (!memberUids.Papa || !memberUids.Maman) {
        custodyConfigMessageElement.textContent = "Erreur: Les UIDs pour Papa et Maman non trouvés.";
        custodyConfigMessageElement.className = 'text-red-500 text-xs mt-1'; return;
    }

    let firstParentUid = (startingParentRole === 'Papa') ? memberUids.Papa : memberUids.Maman;
    let secondParentUid = (startingParentRole === 'Papa') ? memberUids.Maman : memberUids.Papa;
    
    const updates = {};
    const eventsRefPath = `families/${currentFamilyName}/calendarEvents`;
    const startDate = new Date(startDateString + 'T00:00:00');
    const endDateForGeneration = new Date(startDate);
    endDateForGeneration.setMonth(startDate.getMonth() + durationMonths);

    if (!confirm(`Générer un nouveau planning pour ${durationMonths} mois à partir du ${startDate.toLocaleDateString('fr-FR')}? Attention: Ceci ne supprime pas les événements existants.`)) {
        custodyConfigMessageElement.textContent = "Génération annulée.";
        custodyConfigMessageElement.className = 'text-blue-500 text-xs mt-1'; return;
    }

    let currentProcessingDate = new Date(startDate);
    let currentParentIsFirst = true;

    if (pattern === 'alternating_week') {
        while (currentProcessingDate < endDateForGeneration) {
            const periodStart = new Date(currentProcessingDate);
            const periodEnd = new Date(periodStart); periodEnd.setDate(periodStart.getDate() + 6);
            const currentParentUidForEvent = currentParentIsFirst ? firstParentUid : secondParentUid;
            const eventType = (currentParentUidForEvent === memberUids.Papa) ? "gardePapa" : "gardeMaman";
            const newEventKey = db.ref(eventsRefPath).push().key;

            // Format periodStart to YYYY-MM-DD using local components
            const localPeriodStartYear = periodStart.getFullYear();
            const localPeriodStartMonth = (periodStart.getMonth() + 1).toString().padStart(2, '0');
            const localPeriodStartDay = periodStart.getDate().toString().padStart(2, '0');
            const periodStartDateString = `${localPeriodStartYear}-${localPeriodStartMonth}-${localPeriodStartDay}`;

            // Format periodEnd to YYYY-MM-DD using local components
            const localPeriodEndYear = periodEnd.getFullYear();
            const localPeriodEndMonth = (periodEnd.getMonth() + 1).toString().padStart(2, '0');
            const localPeriodEndDay = periodEnd.getDate().toString().padStart(2, '0');
            const periodEndDateString = `${localPeriodEndYear}-${localPeriodEndMonth}-${localPeriodEndDay}`;

            updates[`${eventsRefPath}/${newEventKey}`] = {
                type: eventType, 
                startDate: periodStartDateString, // Use formatted local string
                endDate: periodEndDateString,   // Use formatted local string
                userId: currentParentUidForEvent,
                title: (eventType === "gardePapa" ? "Garde Papa" : "Garde Maman"), description: "Généré automatiquement"
            };
            currentProcessingDate.setDate(periodStart.getDate() + 7);
            currentParentIsFirst = !currentParentIsFirst;
        }
    } else if (pattern === '2255') {
        const parents = [firstParentUid, secondParentUid]; // parents[0] is starting parent (P1), parents[1] is other (P2)
        
        // New cycle: P1(2), P2(2), P1(5), P2(5)
        const custodyCycle = [
            { duration: 2, parent: parents[0] }, // P1 for 2 days
            { duration: 2, parent: parents[1] }, // P2 for 2 days
            { duration: 5, parent: parents[0] }, // P1 for 5 days
            { duration: 5, parent: parents[1] }  // P2 for 5 days
        ];
        
        let currentSegmentIndex = 0; // Index for iterating through the custodyCycle

        while (currentProcessingDate < endDateForGeneration) {
            const segment = custodyCycle[currentSegmentIndex % custodyCycle.length];
            
            const periodStart = new Date(currentProcessingDate);
            const periodEnd = new Date(periodStart);
            periodEnd.setDate(periodStart.getDate() + segment.duration - 1);

            // Ensure the event does not exceed the overall generation end date
            if (periodEnd >= endDateForGeneration) {
                // Adjust periodEnd to be the day before endDateForGeneration if it overshoots
                // This means the last event might be shorter than its typical segment duration.
                const tempEndDate = new Date(endDateForGeneration);
                tempEndDate.setDate(endDateForGeneration.getDate() -1); // Make it inclusive of the last day
                
                // Only create event if periodStart is still valid
                if (periodStart <= tempEndDate) {
                     periodEnd.setTime(tempEndDate.getTime()); // Set periodEnd to the adjusted end date
                } else {
                    break; // Stop if the current periodStart is already past the generation end
                }
            }

            const currentParentUidForEvent = segment.parent;
            const eventType = (currentParentUidForEvent === memberUids.Papa) ? "gardePapa" : "gardeMaman";
            const newEventKey = db.ref(eventsRefPath).push().key;
            
            // Format periodStart to YYYY-MM-DD using local components
            const localPeriodStartYear = periodStart.getFullYear();
            const localPeriodStartMonth = (periodStart.getMonth() + 1).toString().padStart(2, '0');
            const localPeriodStartDay = periodStart.getDate().toString().padStart(2, '0');
            const periodStartDateString = `${localPeriodStartYear}-${localPeriodStartMonth}-${localPeriodStartDay}`;

            // Format periodEnd to YYYY-MM-DD using local components
            const localPeriodEndYear = periodEnd.getFullYear();
            const localPeriodEndMonth = (periodEnd.getMonth() + 1).toString().padStart(2, '0');
            const localPeriodEndDay = periodEnd.getDate().toString().padStart(2, '0');
            const periodEndDateString = `${localPeriodEndYear}-${localPeriodEndMonth}-${localPeriodEndDay}`;
            
            updates[`${eventsRefPath}/${newEventKey}`] = {
                type: eventType,
                startDate: periodStartDateString, // Use formatted local string
                endDate: periodEndDateString,   // Use formatted local string
                userId: currentParentUidForEvent,
                title: (eventType === "gardePapa" ? "Garde Papa" : "Garde Maman"),
                description: "Généré automatiquement (2/2/5/5)" // Updated description
            };
            
            currentProcessingDate.setDate(periodStart.getDate() + segment.duration);
            currentSegmentIndex++; 
        }
    } else if (pattern === 'custom') {
        custodyConfigMessageElement.textContent = "Info: Schéma 'Personnalisé', ajoutez événements manuellement.";
        custodyConfigMessageElement.className = 'text-blue-500 text-xs mt-1'; return;
    }

    if (Object.keys(updates).length > 0) {
        try {
            await db.ref().update(updates);
            custodyConfigMessageElement.textContent = "Planning de garde généré!";
            custodyConfigMessageElement.className = 'text-green-500 text-xs mt-1';
        } catch (error) {
            console.error("Error generating custody plan:", error);
            custodyConfigMessageElement.textContent = `Erreur: ${error.message}`;
            custodyConfigMessageElement.className = 'text-red-500 text-xs mt-1';
        }
    } else {
        custodyConfigMessageElement.textContent = "Aucun événement à générer.";
        custodyConfigMessageElement.className = 'text-blue-500 text-xs mt-1';
    }
}

async function fetchFamilyUsers(familyName) { 
    if (!db) return;
    const usersRef = db.ref(`families/${familyName}/users`);
    try {
        const snapshot = await usersRef.once('value');
        familyUsersData = snapshot.val() || {}; 
        console.log("Family users fetched/updated:", familyUsersData);
        if (eventUserIdSelect) populateUserDropdown(); 
    } catch (error) {
        console.error("Error fetching family users:", error);
        familyUsersData = {};
    }
}

function populateUserDropdown() {
    if (!eventUserIdSelect) return; 
    eventUserIdSelect.innerHTML = '<option value="">Sélectionner un parent</option>'; 
    for (const uid in familyUsersData) { // Use familyUsersData
        const user = familyUsersData[uid];
        const option = document.createElement('option');
        option.value = uid;
        option.textContent = user.role || 'Parent'; 
        eventUserIdSelect.appendChild(option);
    }
}

function toggleEventModal(show) {
    if (!eventModal) return;
    eventModal.style.display = show ? 'flex' : 'none'; // Using style.display for flex container
}

function openEventModal(date, eventId) {
    if (!eventForm || !eventModalTitle || !eventIdInput || !deleteEventBtn || !eventErrorElement || !eventStartDateInput || !eventEndDateInput || !eventTypeSelect || !eventTitleInput || !eventDescriptionInput) {
        console.error("Modal form elements not found in openEventModal."); return;
    }
    eventForm.reset();
    eventErrorElement.textContent = '';
    populateUserDropdown(); 

    if (eventId) {
        eventModalTitle.textContent = 'Modifier un Événement';
        const eventData = familyCalendarEvents[eventId];
        if (eventData) {
            eventIdInput.value = eventId;
            eventTypeSelect.value = eventData.type;
            eventStartDateInput.value = eventData.startDate;
            eventEndDateInput.value = eventData.endDate;
            eventTitleInput.value = eventData.title || '';
            eventDescriptionInput.value = eventData.description || '';
            if (eventData.userId) eventUserIdSelect.value = eventData.userId;
            eventTypeSelect.dispatchEvent(new Event('change'));
            deleteEventBtn.style.display = 'block'; // Show delete button
        } else {
            console.error("Event data not found for ID:", eventId);
            eventErrorElement.textContent = "Données de l'événement non trouvées."; return; 
        }
    } else {
        eventModalTitle.textContent = 'Ajouter un Événement';
        eventIdInput.value = ''; 
        eventStartDateInput.value = date; 
        eventEndDateInput.value = date;   
        eventTypeSelect.value = 'gardePapa'; 
        eventTypeSelect.dispatchEvent(new Event('change')); 
        deleteEventBtn.style.display = 'none'; // Hide delete button
    }
    toggleEventModal(true);
}

async function handleEventFormSubmit(event) {
    event.preventDefault();
    if (!db || !currentFamilyName || !eventErrorElement || !eventTypeSelect || !eventStartDateInput || !eventEndDateInput || !eventUserIdSelect || !eventTitleInput || !eventDescriptionInput) {
        eventErrorElement.textContent = "Erreur de configuration du formulaire."; return;
    }

    const eventTypeValue = eventTypeSelect.value;
    const startDateValue = eventStartDateInput.value;
    const endDateValue = eventEndDateInput.value;
    let userIdValue = eventUserIdSelect.value;
    const titleValue = eventTitleInput.value.trim();
    const descriptionValue = eventDescriptionInput.value.trim();
    const existingEventId = eventIdInput.value;
    eventErrorElement.textContent = '';

    if (!eventTypeValue || !startDateValue || !endDateValue) {
        eventErrorElement.textContent = "Type, date de début et date de fin sont requis."; return;
    }
    if (new Date(endDateValue) < new Date(startDateValue)) {
        eventErrorElement.textContent = "La date de fin ne peut pas être avant la date de début."; return;
    }
    const needsUser = ['gardePapa', 'gardeMaman', 'vacancesPapa', 'vacancesMaman'].includes(eventTypeValue);
    if (needsUser && !userIdValue) {
        eventErrorElement.textContent = "Veuillez sélectionner le parent concerné."; return;
    }
    if (eventTypeValue === 'evenementSpecial' && !titleValue) {
        eventErrorElement.textContent = "Le titre est requis pour un événement spécial."; return;
    }
    if (!needsUser) userIdValue = null; 

    const eventData = {
        type: eventTypeValue, startDate: startDateValue, endDate: endDateValue,
        title: titleValue, description: descriptionValue, userId: userIdValue || null 
    };

    // ADD THIS LOG:
    console.log("[handleEventFormSubmit] Event data being saved:", JSON.stringify(eventData));

    try {
        const eventsRef = db.ref(`families/${currentFamilyName}/calendarEvents`);
        if (existingEventId) {
            await eventsRef.child(existingEventId).update(eventData);
            // ADD THIS LOG:
            console.log("[handleEventFormSubmit] Event updated successfully. Event ID:", existingEventId);
        } else {
            const newEventRef = await eventsRef.push(eventData);
            // ADD THIS LOG:
            console.log("[handleEventFormSubmit] Event pushed successfully. Event ID:", newEventRef.key);
        }
        toggleEventModal(false);
    } catch (error) {
        // MODIFY THIS LOG:
        console.error("[handleEventFormSubmit] Error saving event to Firebase:", error);
        eventErrorElement.textContent = `Erreur d'enregistrement: ${error.message}`;
    }
}

async function handleDeleteEvent() {
    const existingEventId = eventIdInput.value;
    if (!existingEventId || !db || !currentFamilyName) {
        eventErrorElement.textContent = "ID d'événement manquant ou erreur de configuration."; return;
    }
    if (confirm("Êtes-vous sûr de vouloir supprimer cet événement?")) {
        try {
            await db.ref(`families/${currentFamilyName}/calendarEvents/${existingEventId}`).remove();
            toggleEventModal(false);
        } catch (error) {
            console.error("Error deleting event:", error);
            eventErrorElement.textContent = `Erreur de suppression: ${error.message}`;
        }
    }
}

function listenForCalendarEvents(familyName) {
    if (!db) return;
    const eventsRef = db.ref(`families/${familyName}/calendarEvents`);
    eventsRef.on('value', snapshot => {
        familyCalendarEvents = snapshot.val() || {};
        // ADD THIS LINE:
        console.log("[listenForCalendarEvents] Events updated from Firebase:", JSON.stringify(familyCalendarEvents));
        renderCalendar(); 
        updateWeeklyRecap(new Date(), familyCalendarEvents, familyUsersData); // Update recap on event changes
    }, error => {
        console.error("[listenForCalendarEvents] Error listening for calendar events:", error); // Enhanced log
        familyCalendarEvents = {}; 
        renderCalendar(); 
        updateWeeklyRecap(new Date(), {}, familyUsersData); // Update recap with empty events
    });
}

function renderCalendar() {
    const year = currentDateGlobal.getFullYear(); // Use global current date for month nav
    const month = currentDateGlobal.getMonth(); 

    if (currentMonthYearElement) {
        currentMonthYearElement.textContent = currentDateGlobal.toLocaleDateString('fr-FR', {
            month: 'long',
            year: 'numeric'
        });
    }
    if (!calendarGrid) return;

    while (calendarGrid.children.length > 7) {
        calendarGrid.removeChild(calendarGrid.lastChild);
    }

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const numDaysInMonth = lastDayOfMonth.getDate();
    let startDayOfWeek = (firstDayOfMonth.getDay() + 6) % 7;

    for (let i = 0; i < startDayOfWeek; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'border p-1 text-center text-gray-400 h-10';
        calendarGrid.appendChild(emptyCell);
    }

    const today = new Date();
    // Construct YYYY-MM-DD string from local date components for today
    const localTodayYear = today.getFullYear();
    const localTodayMonth = (today.getMonth() + 1).toString().padStart(2, '0'); // getMonth() is 0-indexed
    const localTodayDay = today.getDate().toString().padStart(2, '0');
    const todayDateString = `${localTodayYear}-${localTodayMonth}-${localTodayDay}`;

    for (let day = 1; day <= numDaysInMonth; day++) {
        const dayCell = document.createElement('div');
        dayCell.className = 'border p-1 text-center cursor-pointer hover:bg-gray-200 h-10 flex items-center justify-center relative text-sm bg-white';
        dayCell.textContent = day;
        const cellDate = new Date(year, month, day);
        // Construct YYYY-MM-DD string from local date components to avoid timezone issues with toISOString()
        const localYear = cellDate.getFullYear();
        const localMonth = (cellDate.getMonth() + 1).toString().padStart(2, '0'); // getMonth() is 0-indexed
        const localDay = cellDate.getDate().toString().padStart(2, '0');
        const cellDateString = `${localYear}-${localMonth}-${localDay}`;
        dayCell.dataset.date = cellDateString;

        if (cellDateString === todayDateString) {
            dayCell.classList.add('bg-blue-100', 'font-semibold', 'ring-1', 'ring-blue-400');
        }
        
        // Clear previous indicators and event-specific dataset attributes
        delete dayCell.dataset.eventId; delete dayCell.dataset.eventType;
        delete dayCell.dataset.specialEventId; delete dayCell.dataset.specialEventType;
        delete dayCell.dataset.jourFerieEventId; // Add this for jourFerie
        const existingIndicators = dayCell.querySelectorAll('.event-indicator-dot, .jour-ferie-indicator-dot'); // Ensure we select all types
        existingIndicators.forEach(ind => ind.remove());

        let primaryEventStyled = false;
        for (const eventId in familyCalendarEvents) {
            const event = familyCalendarEvents[eventId];
            if (event.startDate <= cellDateString && event.endDate >= cellDateString) {
                if (['gardePapa', 'gardeMaman', 'vacancesPapa', 'vacancesMaman'].includes(event.type)) {
                    if (!primaryEventStyled) { 
                        dayCell.classList.remove('bg-white', 'hover:bg-gray-200', 'bg-blue-300', 'bg-pink-300', 'bg-blue-500', 'bg-pink-500', 'text-white');
                        if (event.type === "gardePapa") dayCell.classList.add('bg-blue-300', 'hover:bg-blue-400');
                        else if (event.type === "gardeMaman") dayCell.classList.add('bg-pink-300', 'hover:bg-pink-400');
                        else if (event.type === "vacancesPapa") dayCell.classList.add('bg-blue-500', 'text-white', 'hover:bg-blue-600');
                        else if (event.type === "vacancesMaman") dayCell.classList.add('bg-pink-500', 'text-white', 'hover:bg-pink-600');
                        dayCell.dataset.eventId = eventId; // This is the primary clickable event for the cell
                        dayCell.dataset.eventType = event.type;
                        primaryEventStyled = true;
                    }
                } else if (event.type === "evenementSpecial") {
                    const indicatorDot = document.createElement('span');
                    // Standardized class for all dots, color controlled by specific class
                    indicatorDot.className = 'event-indicator-dot absolute bottom-1 right-1 w-2 h-2 bg-yellow-500 rounded-full ring-1 ring-white';
                    indicatorDot.title = event.title || 'Événement spécial';
                    dayCell.appendChild(indicatorDot);
                    // Store the ID of the special event separately, if needed for clicking
                    if (!dayCell.dataset.specialEventId) { // To handle click, perhaps store first one
                       dayCell.dataset.specialEventId = eventId;
                       dayCell.dataset.specialEventType = event.type;
                    }
                } else if (event.type === "jourFerie") { // ADD THIS BLOCK
                    const jourFerieDot = document.createElement('span');
                    // Use a different position or slightly different styling if coexisting with specialEventDot
                    // For now, let's assume it can also be at bottom-1, but maybe left-1 if specialEventDot is right-1
                    // Or, they could stack if display allows. For simplicity, let's try a different position if possible,
                    // or just add another dot. If too many dots, UI might need rethink.
                    // Let's use left side for jourFerie dot.
                    jourFerieDot.className = 'jour-ferie-indicator-dot absolute bottom-1 left-1 w-2 h-2 bg-green-500 rounded-full ring-1 ring-white';
                    jourFerieDot.title = event.title || 'Jour férié';
                    dayCell.appendChild(jourFerieDot);
                    // Store the ID of the jour ferie event, if needed for clicking
                     if (!dayCell.dataset.jourFerieEventId) { // To handle click, perhaps store first one
                       dayCell.dataset.jourFerieEventId = eventId;
                    }
                }
            }
        }
        calendarGrid.appendChild(dayCell);
    }
}
