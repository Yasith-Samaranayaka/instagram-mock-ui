// Login Page JavaScript

const API_URL = 'http://localhost:3001';

// Check if already authenticated
async function checkAuth() {
    try {
        const response = await fetch(`${API_URL}/auth/status`, {
            credentials: 'include'
        });
        const data = await response.json();

        if (data.authenticated) {
            // Already logged in, redirect to dashboard
            window.location.href = '/index.html';
        }
    } catch (error) {
        console.error('Error checking auth:', error);
    }
}

// Login with Google
function loginWithGoogle() {
    // Redirect to Google OAuth
    window.location.href = `${API_URL}/auth/google`;
}

// Check auth on page load
checkAuth();
