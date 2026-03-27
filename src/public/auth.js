// Authentication module for Claude Code Web
class AuthManager {
    constructor() {
        this.token = sessionStorage.getItem('cc-web-token');
        this.userId = localStorage.getItem('cc-web-userid') || sessionStorage.getItem('cc-web-userid');
        this.authRequired = false;
    }

    setUserId(userId) {
        this.userId = userId;
        // Persist to both sessionStorage (for current session) and localStorage (for persistence)
        sessionStorage.setItem('cc-web-userid', userId);
        localStorage.setItem('cc-web-userid', userId);
    }

    getUserId() {
        return this.userId;
    }

    showUserIdPrompt() {
        console.log('[Auth] Showing user ID prompt...');

        const existingOverlay = document.getElementById('userid-overlay');
        if (existingOverlay) {
            existingOverlay.remove();
        }

        const overlay = document.createElement('div');
        overlay.id = 'userid-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.95);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;

        const formDiv = document.createElement('div');
        formDiv.style.cssText = `
            background: var(--bg-secondary, #1c2128);
            border: 1px solid var(--border-color, #30363d);
            border-radius: 12px;
            padding: 32px;
            max-width: 400px;
            width: 90%;
            box-shadow: 0 10px 50px rgba(0, 0, 0, 0.5);
        `;

        formDiv.innerHTML = `
            <h2 style="color: var(--text-primary, #f0f6fc); margin: 0 0 8px 0; font-family: 'Inter', system-ui, -apple-system, Segoe UI, Roboto, 'JetBrains Mono', monospace; display: flex; align-items: center; gap: 8px;">
                <span class="icon" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></span>
                Enter Your Name
            </h2>
            <p style="color: var(--text-secondary, #8b949e); margin: 0 0 24px 0; font-size: 14px;">
                This will create a personal workspace for you.
            </p>
            <form id="userid-form">
                <div style="margin-bottom: 16px;">
                    <label for="userid-input" style="display: block; color: var(--text-secondary, #8b949e); margin-bottom: 8px; font-size: 14px;">
                        Username
                    </label>
                    <input
                        type="text"
                        id="userid-input"
                        placeholder="e.g., alice, bob"
                        pattern="[a-zA-Z0-9_.-]+"
                        title="Letters, numbers, underscore and hyphen only"
                        style="
                            width: 100%;
                            padding: 10px 12px;
                            background: var(--bg-primary, #0d1117);
                            border: 1px solid var(--border-color, #30363d);
                            border-radius: 6px;
                            color: var(--text-primary, #f0f6fc);
                            font-family: 'Inter', system-ui, -apple-system, Segoe UI, Roboto, 'JetBrains Mono', monospace;
                            font-size: 14px;
                            box-sizing: border-box;
                        "
                        autofocus
                        required
                    />
                </div>
                <div id="userid-error" style="color: #f85149; margin-bottom: 16px; font-size: 14px; display: none;"></div>
                <button
                    type="submit"
                    style="
                        width: 100%;
                        padding: 10px 16px;
                        background: var(--accent);
                        color: white;
                        border: none;
                        border-radius: 6px;
                        font-family: 'Inter', system-ui, -apple-system, Segoe UI, Roboto, 'JetBrains Mono', monospace;
                        font-size: 14px;
                        font-weight: 500;
                        cursor: pointer;
                        transition: opacity 0.2s;
                    "
                    onmouseover="this.style.opacity='0.9'"
                    onmouseout="this.style.opacity='1'"
                >
                    Continue
                </button>
            </form>
        `;

        overlay.appendChild(formDiv);
        document.body.appendChild(overlay);

        const form = document.getElementById('userid-form');
        const input = document.getElementById('userid-input');
        const errorDiv = document.getElementById('userid-error');

        // Pre-fill if userId exists
        if (this.userId) {
            input.value = this.userId;
        }

        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const userId = input.value.trim().toLowerCase();
            if (!userId) {
                errorDiv.textContent = 'Please enter a username';
                errorDiv.style.display = 'block';
                return;
            }

            // Validate username format
            if (!/^[a-zA-Z0-9_.-]+$/.test(userId)) {
                errorDiv.textContent = 'Username can only contain letters, numbers, underscore and hyphen';
                errorDiv.style.display = 'block';
                return;
            }

            // Disable form while creating sandbox
            input.disabled = true;
            form.querySelector('button').disabled = true;
            form.querySelector('button').textContent = 'Creating workspace...';

            try {
                // Create user sandbox on server
                const response = await fetch('/api/user/create-sandbox', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ userId })
                });

                const data = await response.json();

                if (data.success || response.status === 200) {
                    this.setUserId(userId);
                    overlay.remove();
                    // Trigger a custom event that app.js can listen to
                    window.dispatchEvent(new CustomEvent('userIdSet', { detail: { userId } }));
                } else {
                    throw new Error(data.message || 'Failed to create workspace');
                }
            } catch (error) {
                errorDiv.textContent = error.message || 'Failed to create workspace. Please try again.';
                errorDiv.style.display = 'block';
                input.disabled = false;
                form.querySelector('button').disabled = false;
                form.querySelector('button').textContent = 'Continue';
            }
        });

        input.focus();
    }

    async checkAuthStatus() {
        try {
            const response = await fetch('/auth-status');
            if (!response.ok) {
                throw new Error('Failed to check auth status');
            }
            const data = await response.json();
            this.authRequired = data.authRequired;
            return data;
        } catch (error) {
            console.error('Failed to check auth status:', error);
            // Assume auth is required if we can't check - safer default
            this.authRequired = true;
            return { authRequired: true, authenticated: false };
        }
    }

    async verifyToken(token) {
        try {
            const response = await fetch('/auth-verify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ token })
            });
            
            const data = await response.json();
            if (data.valid) {
                this.token = token;
                sessionStorage.setItem('cc-web-token', token);
            }
            return data.valid;
        } catch (error) {
            console.error('Failed to verify token:', error);
            return false;
        }
    }

    showLoginPrompt() {
        console.log('[Auth] Showing login prompt...');
        
        // Remove any existing auth overlay
        const existingOverlay = document.getElementById('auth-overlay');
        if (existingOverlay) {
            console.log('[Auth] Removing existing overlay');
            existingOverlay.remove();
        }

        const overlay = document.createElement('div');
        overlay.id = 'auth-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.95);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;

        const loginForm = document.createElement('div');
        loginForm.style.cssText = `
            background: var(--bg-secondary, #1c2128);
            border: 1px solid var(--border-color, #30363d);
            border-radius: 12px;
            padding: 32px;
            max-width: 400px;
            width: 90%;
            box-shadow: 0 10px 50px rgba(0, 0, 0, 0.5);
        `;

        loginForm.innerHTML = `
            <h2 style="color: var(--text-primary, #f0f6fc); margin: 0 0 8px 0; font-family: 'Inter', system-ui, -apple-system, Segoe UI, Roboto, 'JetBrains Mono', monospace; display: flex; align-items: center; gap: 8px;">
                <span class="icon" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="10" width="18" height="11" rx="2"/><path d="M7 10V7a5 5 0 0 1 10 0v3"/></svg></span>
                Authentication Required
            </h2>
            <p style="color: var(--text-secondary, #8b949e); margin: 0 0 24px 0; font-size: 14px;">
                This Claude Code Web instance requires authentication.
            </p>
            <form id="auth-form">
                <div style="margin-bottom: 16px;">
                    <label for="auth-token" style="display: block; color: var(--text-secondary, #8b949e); margin-bottom: 8px; font-size: 14px;">
                        Access Token
                    </label>
                    <input 
                        type="password" 
                        id="auth-token" 
                        placeholder="Enter your access token"
                        style="
                            width: 100%;
                            padding: 10px 12px;
                            background: var(--bg-primary, #0d1117);
                            border: 1px solid var(--border-color, #30363d);
                            border-radius: 6px;
                            color: var(--text-primary, #f0f6fc);
                            font-family: 'Inter', system-ui, -apple-system, Segoe UI, Roboto, 'JetBrains Mono', monospace;
                            font-size: 14px;
                            box-sizing: border-box;
                        "
                        autofocus
                        required
                    />
                </div>
                <div id="auth-error" style="color: #f85149; margin-bottom: 16px; font-size: 14px; display: none;"></div>
                <button 
                    type="submit"
                    style="
                        width: 100%;
                        padding: 10px 16px;
                        background: var(--accent);
                        color: white;
                        border: none;
                        border-radius: 6px;
                        font-family: 'Inter', system-ui, -apple-system, Segoe UI, Roboto, 'JetBrains Mono', monospace;
                        font-size: 14px;
                        font-weight: 500;
                        cursor: pointer;
                        transition: opacity 0.2s;
                    "
                    onmouseover="this.style.opacity='0.9'"
                    onmouseout="this.style.opacity='1'"
                >
                    Authenticate
                </button>
            </form>
            <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border-color, #30363d);">
                <p style="color: var(--text-secondary, #8b949e); font-size: 12px; margin: 0;">
                    The access token was set when starting the server with the <code style="background: var(--bg-primary, #0d1117); padding: 2px 4px; border-radius: 3px;">--auth</code> flag.
                </p>
            </div>
        `;

        overlay.appendChild(loginForm);
        document.body.appendChild(overlay);

        // Handle form submission
        const form = document.getElementById('auth-form');
        const tokenInput = document.getElementById('auth-token');
        const errorDiv = document.getElementById('auth-error');

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const token = tokenInput.value.trim();
            if (!token) {
                errorDiv.textContent = 'Please enter a token';
                errorDiv.style.display = 'block';
                return;
            }

            // Disable form while checking
            tokenInput.disabled = true;
            form.querySelector('button').disabled = true;
            form.querySelector('button').textContent = 'Authenticating...';

            const valid = await this.verifyToken(token);
            
            if (valid) {
                // Success - remove overlay and reload the app
                overlay.remove();
                window.location.reload();
            } else {
                // Failed - show error
                errorDiv.textContent = 'Invalid token. Please try again.';
                errorDiv.style.display = 'block';
                
                // Re-enable form
                tokenInput.disabled = false;
                tokenInput.value = '';
                tokenInput.focus();
                form.querySelector('button').disabled = false;
                form.querySelector('button').textContent = 'Authenticate';
            }
        });

        // Focus the input
        tokenInput.focus();
    }

    getAuthHeaders() {
        if (!this.token) return {};
        return {
            'Authorization': `Bearer ${this.token}`
        };
    }

    getWebSocketUrl(baseUrl) {
        let url = baseUrl;
        const separator = baseUrl.includes('?') ? '&' : '?';

        if (this.token) {
            url = `${url}${separator}token=${encodeURIComponent(this.token)}`;
        }

        if (this.userId) {
            const userIdSeparator = url.includes('?') ? '&' : '?';
            url = `${url}${userIdSeparator}userId=${encodeURIComponent(this.userId)}`;
        }

        return url;
    }

    logout() {
        // Clear token
        this.token = null;
        sessionStorage.removeItem('cc-web-token');

        // Clear user ID
        this.userId = null;
        sessionStorage.removeItem('cc-web-userid');
        localStorage.removeItem('cc-web-userid');

        // Trigger logout event so app can handle session cleanup
        window.dispatchEvent(new CustomEvent('userLogout'));
    }

    async switchUser() {
        // Clear user ID
        this.userId = null;
        sessionStorage.removeItem('cc-web-userid');
        localStorage.removeItem('cc-web-userid');

        // Show user ID prompt
        this.showUserIdPrompt();
    }

    async initialize() {
        console.log('[Auth] Initializing auth manager...');
        console.log('[Auth] Current token:', this.token ? 'exists' : 'none');
        console.log('[Auth] Current userId:', this.userId ? this.userId : 'none');

        // Check if user ID is required
        if (!this.userId) {
            console.log('[Auth] No user ID - showing user ID prompt');
            this.showUserIdPrompt();
            return false;
        }

        const status = await this.checkAuthStatus();
        console.log('[Auth] Auth status:', status);

        if (status.authRequired && !this.token) {
            // Auth required but no token - show login
            console.log('[Auth] Auth required but no token - showing login prompt');
            this.showLoginPrompt();
            return false;
        }

        if (status.authRequired && this.token) {
            // Verify the stored token is still valid
            console.log('[Auth] Auth required and token exists - verifying...');
            const valid = await this.verifyToken(this.token);
            if (!valid) {
                console.log('[Auth] Token invalid - showing login prompt');
                this.token = null;
                sessionStorage.removeItem('cc-web-token');
                this.showLoginPrompt();
                return false;
            }
            console.log('[Auth] Token valid');
        }

        console.log('[Auth] Authentication successful or not required');
        return true;
    }
}

// Create global auth manager instance
window.authManager = new AuthManager();
