// Google Identity Services token handling for client-side Drive uploads.
// Persist token per-tab so navigating between pages keeps the session.
let accessToken = null;
let tokenClient = null;

const TOKEN_KEY = 'gdriveAccessToken';
const TOKEN_EXP_KEY = 'gdriveAccessTokenExpiry';

function loadStoredToken() {
    try {
        const stored = sessionStorage.getItem(TOKEN_KEY);
        const exp = Number(sessionStorage.getItem(TOKEN_EXP_KEY));
        if (stored && exp && Date.now() < exp) {
            accessToken = stored;
            // Let listeners update UI
            window.dispatchEvent(new CustomEvent('gdrive-auth-success'));
        } else {
            sessionStorage.removeItem(TOKEN_KEY);
            sessionStorage.removeItem(TOKEN_EXP_KEY);
        }
    } catch (e) {
        console.warn('Drive token restore failed:', e);
    }
}

function persistToken(token, expiresInSeconds) {
    accessToken = token;
    try {
        const ttlMs = (expiresInSeconds || 3600) * 1000; // default 1h
        const exp = Date.now() + Math.max(5 * 60 * 1000, ttlMs - 5 * 60 * 1000); // refresh 5m early
        sessionStorage.setItem(TOKEN_KEY, token);
        sessionStorage.setItem(TOKEN_EXP_KEY, String(exp));
    } catch (e) {
        console.warn('Drive token persist failed:', e);
    }
}

function initGoogleAuth() {
    if (typeof CONFIG === 'undefined' || !CONFIG.GOOGLE_CLIENT_ID) {
        console.warn('CONFIG.GOOGLE_CLIENT_ID is missing. Drive auth is disabled.');
        return;
    }

    if (!window.google || !google.accounts || !google.accounts.oauth2) {
        console.warn('Google Identity Services script not loaded yet.');
        return;
    }

    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CONFIG.GOOGLE_CLIENT_ID,
        scope: CONFIG.OAUTH_SCOPES,
        callback: (response) => {
            if (response && response.access_token) {
                persistToken(response.access_token, response.expires_in);
                window.dispatchEvent(new CustomEvent('gdrive-auth-success'));
                if (typeof onAuthSuccess === 'function') {
                    onAuthSuccess();
                }
            } else {
                window.dispatchEvent(new CustomEvent('gdrive-auth-failure'));
                if (typeof onAuthFailure === 'function') {
                    onAuthFailure();
                }
            }
        }
    });
}

function requestAuth() {
    loadStoredToken(); // Attempt to reuse any existing session token

    if (!tokenClient) {
        console.log('⏳ tokenClient not ready, retrying initGoogleAuth...');
        initGoogleAuth();
        
        // If still not ready, wait and retry
        if (!tokenClient) {
            console.log('⏳ Waiting for Google scripts to load...');
            setTimeout(() => {
                initGoogleAuth();
                if (tokenClient) {
                    tokenClient.requestAccessToken();
                } else {
                    console.error('❌ Google auth client still not initialized after retry');
                }
            }, 500);
            return;
        }
    }

    if (!tokenClient) {
        console.error('❌ Google auth client not initialized.');
        return;
    }

    tokenClient.requestAccessToken();
}

function isAuthenticated() {
    return !!accessToken;
}

function signOut() {
    if (!accessToken) return;
    if (!window.google || !google.accounts || !google.accounts.oauth2) return;

    const tokenToRevoke = accessToken;
    accessToken = null;
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_EXP_KEY);
    google.accounts.oauth2.revoke(tokenToRevoke, () => {
        window.dispatchEvent(new CustomEvent('gdrive-auth-logout'));
    });
}

function onAuthSuccess() {
    // Optional UI hook defined elsewhere.
}

function onAuthFailure() {
    // Optional UI hook defined elsewhere.
}

window.addEventListener('load', () => {
    loadStoredToken();
    initGoogleAuth();
});
