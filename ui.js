function showLandingPage() {
    const landingPage = document.getElementById('landing-page');
    const appContainer = document.getElementById('app-container');

    if (landingPage) {
        landingPage.classList.remove('hidden');
    } else {
        console.error("Landing page element not found.");
    }

    if (appContainer) {
        appContainer.classList.add('hidden');
    } else {
        console.error("App container element not found.");
    }
    // Ensure logout button is not interactable when landing page is shown
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.removeEventListener('click', handleLogout); // Assuming handleLogout is globally accessible or passed
    }
}

function showAppInterface() {
    const landingPage = document.getElementById('landing-page');
    const appContainer = document.getElementById('app-container');

    if (landingPage) {
        landingPage.classList.add('hidden');
    } else {
        console.error("Landing page element not found.");
    }

    if (appContainer) {
        appContainer.classList.remove('hidden');
    } else {
        console.error("App container element not found.");
    }

    // Re-ensure logout button listener is active when app interface is shown
    // This is more robustly handled in initAuth, but good for clarity
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton && typeof handleLogout === 'function') { // Check if handleLogout is available
        // It's better to ensure initAuth sets this up once.
        // Re-adding here might cause multiple listeners if not careful.
        // For now, initAuth in auth.js should handle this.
    } else if (!logoutButton) {
        console.error("Logout button not found in app container when showing app interface.");
    }
}

// The DOMContentLoaded listener that previously checked localStorage
// has been removed. checkAuthState in auth.js, called from app.js,
// now handles the initial UI state determination.
document.addEventListener('DOMContentLoaded', () => {
    console.log("UI fully loaded. Auth state check will determine view.");
    // Any general UI initializations that are not auth-dependent can go here.
    // For example, setting up theme, language, etc.

    const statsModal = document.getElementById('statistics-modal');
    const showStatsModalBtn = document.getElementById('show-stats-modal-btn');
    const closeStatsModalBtn = document.getElementById('close-stats-modal-btn');

    if (statsModal && showStatsModalBtn && closeStatsModalBtn) {
        showStatsModalBtn.addEventListener('click', () => {
            statsModal.classList.remove('hidden');
        });

        closeStatsModalBtn.addEventListener('click', () => {
            statsModal.classList.add('hidden');
        });

        // Optional: Close modal if background is clicked
        statsModal.addEventListener('click', (event) => {
            if (event.target === statsModal) {
                statsModal.classList.add('hidden');
            }
        });
    } else {
        console.warn("Statistics modal elements not found. Button or modal functionality might be affected.");
    }
});