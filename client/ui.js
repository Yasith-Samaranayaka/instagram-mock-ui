// UI Helper Functions - Modal Dialog System

let modalResolve = null;

// Shared loading overlay helpers
function setPageLoading(isLoading, message = 'Loading...') {
    const overlay = document.getElementById('loadingOverlay');
    const msgEl = document.getElementById('loadingMessage');
    if (!overlay) return;

    if (msgEl && message) {
        msgEl.textContent = message;
    }

    overlay.classList.toggle('active', !!isLoading);
}

// Show alert dialog
function showAlert(title, message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('customModal');
        const modalTitle = document.getElementById('modalTitle');
        const modalMessage = document.getElementById('modalMessage');
        const modalInput = document.getElementById('modalInput');
        const modalCancel = document.getElementById('modalCancel');
        const modalOk = document.getElementById('modalOk');

        modalTitle.textContent = title;
        modalMessage.textContent = message;
        modalInput.style.display = 'none';
        modalCancel.style.display = 'none';
        modalOk.textContent = 'OK';
        
        modal.style.display = 'flex';
        modalOk.focus();

        modalResolve = resolve;
    });
}

// Show confirmation dialog
function showConfirm(title, message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('customModal');
        const modalTitle = document.getElementById('modalTitle');
        const modalMessage = document.getElementById('modalMessage');
        const modalInput = document.getElementById('modalInput');
        const modalCancel = document.getElementById('modalCancel');
        const modalOk = document.getElementById('modalOk');

        modalTitle.textContent = title;
        modalMessage.textContent = message;
        modalInput.style.display = 'none';
        modalCancel.style.display = 'inline-block';
        modalOk.textContent = 'OK';
        
        modal.style.display = 'flex';
        modalOk.focus();

        modalResolve = resolve;
    });
}

// Show prompt dialog
function showPrompt(title, message, defaultValue = '') {
    return new Promise((resolve) => {
        const modal = document.getElementById('customModal');
        const modalTitle = document.getElementById('modalTitle');
        const modalMessage = document.getElementById('modalMessage');
        const modalInput = document.getElementById('modalInput');
        const modalCancel = document.getElementById('modalCancel');
        const modalOk = document.getElementById('modalOk');

        modalTitle.textContent = title;
        modalMessage.textContent = message;
        modalInput.style.display = 'block';
        modalInput.value = defaultValue;
        modalCancel.style.display = 'inline-block';
        modalOk.textContent = 'OK';
        
        modal.style.display = 'flex';
        modalInput.focus();
        modalInput.select();

        modalResolve = resolve;
    });
}

// Close modal
function closeModal(result) {
    const modal = document.getElementById('customModal');
    const modalInput = document.getElementById('modalInput');
    
    modal.style.display = 'none';
    
    if (modalResolve) {
        if (modalInput.style.display !== 'none' && result === true) {
            modalResolve(modalInput.value);
        } else {
            modalResolve(result);
        }
        modalResolve = null;
    }
}

// Initialize modal event listeners
function initializeModalListeners() {
    const modal = document.getElementById('customModal');
    const modalCancel = document.getElementById('modalCancel');
    const modalOk = document.getElementById('modalOk');
    const modalInput = document.getElementById('modalInput');

    if (!modal) return;

    // OK button
    modalOk.addEventListener('click', () => closeModal(true));

    // Cancel button
    modalCancel.addEventListener('click', () => closeModal(false));

    // Close on overlay click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal(false);
        }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (modal.style.display === 'flex') {
            if (e.key === 'Enter') {
                e.preventDefault();
                closeModal(true);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                closeModal(false);
            } else if (e.key === ' ' && modalInput.style.display === 'none') {
                e.preventDefault();
                closeModal(true);
            }
        }
    });

    // Enter key in input field
    if (modalInput) {
        modalInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                closeModal(true);
            }
        });
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeModalListeners);
} else {
    // DOM is already loaded
    initializeModalListeners();
}
