// Shared Authentication Utilities

const API_URL = '';

// Check authentication status
async function checkAuth() {
    try {
        const response = await fetch(`${API_URL}/auth/status`, {
            credentials: 'include'
        });
        return await response.json();
    } catch (error) {
        console.error('Error checking auth:', error);
        return { authenticated: false };
    }
}

// Require authentication (redirect to login if not authenticated)
async function requireAuth() {
    console.log('🔐 Checking authentication...');
    const auth = await checkAuth();
    console.log('🔐 Auth response:', auth);

    if (!auth.authenticated) {
        console.log('❌ Not authenticated, redirecting to login');
        window.location.href = '/login.html';
        return null;
    }

    console.log('✅ Authenticated as:', auth.user);
    return auth.user;
}

// Logout
async function logout() {
    try {
        await fetch(`${API_URL}/auth/logout`, {
            method: 'POST',
            credentials: 'include'
        });
        window.location.href = '/login.html';
    } catch (error) {
        console.error('Error logging out:', error);
        // Still redirect to login even if logout fails
        window.location.href = '/login.html';
    }
}

// Add user info to header
function renderUserInfo(user) {
    const headerRight = document.querySelector('.header-right') || document.getElementById('headerRight');
    if (!headerRight) {
        console.warn('Header right element not found');
        return;
    }

    // Check if user info already exists
    const existingUserInfo = headerRight.querySelector('.user-info-container');
    if (existingUserInfo) {
        existingUserInfo.remove();
    }

    // Create user info element
    const userInfoDiv = document.createElement('div');
    userInfoDiv.className = 'user-info-container';
    userInfoDiv.style.cssText = 'display: flex; align-items: center; gap: 12px; margin-left: 16px; padding-left: 16px; border-left: 1px solid var(--border-color);';

    userInfoDiv.innerHTML = `
        <img src="${user.picture}" alt="${user.name}" class="user-avatar" 
             style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; border: 2px solid var(--border-color);">
        <div style="display: flex; flex-direction: column; gap: 2px;">
            <span class="user-name" style="font-size: 13px; font-weight: 600; color: var(--text-primary); line-height: 1;">${user.name}</span>
            <span class="user-email" style="font-size: 11px; color: var(--text-secondary); line-height: 1;">${user.email}</span>
        </div>
        <button onclick="logout()" class="btn-secondary btn-small" style="margin-left: 8px;">
            <i class="fas fa-sign-out-alt"></i> Logout
        </button>
    `;

    // Add user info to header
    headerRight.appendChild(userInfoDiv);

    console.log('✅ User info rendered:', user.name);
}
