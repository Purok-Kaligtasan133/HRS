const API_URL = "https://script.google.com/macros/s/AKfycbxdAGmjmDECdLxCsXCvnnnLktsGXLpUKrrM7t_ZZ9aEwiJ_mB0k-CVF57khbAqU2hlX2w/exec";


// Session timeout (30 minutes = 1800000 ms)
const SESSION_TIMEOUT = 30 * 60 * 1000;
let sessionCheckInterval = null;
let sessionActivityInterval = null;

// ===== AGGRESSIVE LOGIN FIELD CLEARING =====
(function() {
    'use strict';
    
    console.log("Login field cleaner loaded");
    
    // Method 1: Clear immediately
    function clearFields() {
        const usernameField = document.getElementById('username');
        const passwordField = document.getElementById('password');
        
        if (usernameField) {
            usernameField.value = '';
            usernameField.removeAttribute('value'); // Remove any hardcoded value attribute
        }
        if (passwordField) {
            passwordField.value = '';
            passwordField.removeAttribute('value');
        }
        console.log("Fields cleared immediately");
    }
    
    // Method 3: Clear on DOMContentLoaded
    document.addEventListener('DOMContentLoaded', function() {
        clearFields();
        console.log("Fields cleared on DOMContentLoaded");
    });
    
    // Method 4: Clear after a short delay (for slow browsers)
    setTimeout(function() {
        clearFields();
        console.log("Fields cleared after timeout");
    }, 500);
    
    // Method 5: Clear on window load (after all resources loaded)
    window.addEventListener('load', function() {
        clearFields();
        console.log("Fields cleared on window load");
    });
    
    // Method 6: Clear on page show (for back/forward cache)
    window.addEventListener('pageshow', function(event) {
        clearFields();
        console.log("Fields cleared on pageshow");
    });
    
    // Method 7: Clear when the page becomes visible (for mobile browsers)
    document.addEventListener('visibilitychange', function() {
        if (!document.hidden) {
            clearFields();
            console.log("Fields cleared on visibility change");
        }
    });
    
    // Method 8: Force clear with MutationObserver (detects when browser changes the field)
    function setupMutationObserver() {
        const usernameField = document.getElementById('username');
        const passwordField = document.getElementById('password');
        
        if (usernameField) {
            const observer = new MutationObserver(function(mutations) {
                mutations.forEach(function(mutation) {
                    if (mutation.type === 'attributes' && mutation.attributeName === 'value') {
                        // Browser changed the value, clear it again
                        setTimeout(() => {
                            usernameField.value = '';
                        }, 10);
                    }
                });
            });
            
            observer.observe(usernameField, { attributes: true });
        }
        
        if (passwordField) {
            const observer = new MutationObserver(function(mutations) {
                mutations.forEach(function(mutation) {
                    if (mutation.type === 'attributes' && mutation.attributeName === 'value') {
                        // Browser changed the value, clear it again
                        setTimeout(() => {
                            passwordField.value = '';
                        }, 10);
                    }
                });
            });
            
            observer.observe(passwordField, { attributes: true });
        }
    }
    
    // Try to setup MutationObserver after a delay
    setTimeout(setupMutationObserver, 200);
})();

// Initialize everything when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
    console.log("Login page loaded");
    
    // Check browser compatibility first
    if (!checkBrowserCompatibility()) {
        return;
    }
    
    // Setup basic UI interactions
    setupUI();
    
    // Setup login form
    const form = document.getElementById("loginForm");
    if (form) {
        console.log("Login form found");
        form.addEventListener("submit", handleLogin);
    }
    
    // Test API connection on load
    setTimeout(testAPIConnection, 1000);
    
    // Check if user was previously logged in
    checkPreviousSession();
});
// Guest login handler
document.addEventListener('DOMContentLoaded', function() {
    const guestBtn = document.getElementById('guestLoginBtn');
    if (guestBtn) {
        guestBtn.addEventListener('click', handleGuestLogin);
    }
});

async function handleGuestLogin() {
    console.log("=== Guest login attempt started ===");
    
    const msg = document.getElementById("statusText");
    const loginBtn = document.getElementById("loginButton");
    const guestBtn = document.getElementById("guestLoginBtn");
    
    if (msg) msg.innerText = "Logging in as guest...";
    if (msg) msg.style.color = "green";
    
    // Disable buttons
    if (loginBtn) loginBtn.disabled = true;
    if (guestBtn) guestBtn.disabled = true;
    
    try {
        // Generate a unique guest session ID
        const sessionId = 'guest_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        // Store guest session data
        storeGuestSessionData(sessionId);
        
        // ADD THIS: Set a flag that guest should still show logout confirmation
        localStorage.setItem('guestShowConfirmation', 'true');
        
        // Log guest login to API (fire and forget)
        try {
            const formData = new FormData();
            formData.append('action', 'logActivity');
            formData.append('username', 'guest_user');
            formData.append('actor', 'Guest User');
            formData.append('action', 'Guest Login');
            
            fetch(API_URL, {
                method: 'POST',
                body: formData
            }).catch(() => {});
        } catch (e) {
            // Ignore API logging errors
        }
        
        // Redirect DIRECTLY to dashboard.html (NOT main.html)
        console.log("Redirecting guest directly to dashboard.html...");
        setTimeout(() => {
            window.location.replace("dashboard.html");
        }, 1000);
        
    } catch (error) {
        console.error("Guest login error:", error);
        showError("Guest login failed. Please try again.");
        
        // Re-enable buttons
        if (loginBtn) loginBtn.disabled = false;
        if (guestBtn) guestBtn.disabled = false;
    }
}

function storeGuestSessionData(sessionId) {
    // Clear any existing storage
    localStorage.clear();
    sessionStorage.clear();
    
    // Store in sessionStorage
    sessionStorage.setItem('sessionId', sessionId);
    sessionStorage.setItem('sessionExpiry', (Date.now() + SESSION_TIMEOUT).toString());
    sessionStorage.setItem('authenticated', 'true');
    sessionStorage.setItem('isGuest', 'true');
    
    // Store in localStorage
    localStorage.setItem('loggedIn', 'true');
    localStorage.setItem('username', 'guest_user');
    localStorage.setItem('staffName', 'Guest User');
    localStorage.setItem('userRole', 'Guest');
    localStorage.setItem('role', 'Guest');
    localStorage.setItem('assignedBarangay', 'All Barangays (View Only)');
    localStorage.setItem('pwHash', 'guest_' + Date.now());
    localStorage.setItem('loginTime', Date.now().toString());
    localStorage.setItem('lastActivity', Date.now().toString());
    localStorage.setItem('isGuest', 'true');
    localStorage.setItem('deviceInfo', JSON.stringify(getDeviceInfo()));

    console.log("Guest session data stored");
}
// --------------------------
// Browser Compatibility Check
// --------------------------
function checkBrowserCompatibility() {
    const requiredFeatures = [
        'Promise' in window,
        'fetch' in window,
        'crypto' in window && 'subtle' in crypto,
        'localStorage' in window,
        'sessionStorage' in window
    ];
    
    if (requiredFeatures.some(feature => !feature)) {
        console.error("Browser lacks required features");
        const errorDiv = document.getElementById("loginError");
        if (errorDiv) {
            errorDiv.innerHTML = `
                <div style="background: #ffebee; border-left: 4px solid #f44336; padding: 12px; border-radius: 4px; margin: 10px 0;">
                    <strong><i class="fas fa-exclamation-triangle"></i> Browser Compatibility Issue</strong><br>
                    <div style="margin-top: 8px; font-size: 0.9rem;">
                        Your browser is missing required features for this application.<br>
                        Please use one of these modern browsers:<br>
                        • Chrome 58+<br>
                        • Firefox 52+<br>
                        • Safari 10.1+<br>
                        • Edge 16+
                    </div>
                </div>
            `;
            errorDiv.style.display = "block";
        }
        return false;
    }
    return true;
}

// --------------------------
// UI Setup Functions
// --------------------------
function setupUI() {
    // Password visibility toggle
    const togglePassword = document.getElementById('togglePassword');
    if (togglePassword) {
        togglePassword.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const passwordInput = document.getElementById('password');
            const icon = this.querySelector('i');
            
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
                this.setAttribute('aria-label', 'Hide password');
            } else {
                passwordInput.type = 'password';
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
                this.setAttribute('aria-label', 'Show password');
            }
            
            // Prevent any layout shift
            passwordInput.focus();
        });
    }
    
    // Set status message
    const statusText = document.getElementById('statusText');
    if (statusText) {
        const hour = new Date().getHours();
        
        if (hour < 12) {
            statusText.textContent = 'Good morning! Please login to continue.';
        } else if (hour < 18) {
            statusText.textContent = 'Good afternoon! Please login to continue.';
        } else {
            statusText.textContent = 'Good evening! Please login to continue.';
        }
        
        // Focus on username field
        const usernameInput = document.getElementById('username');
        if (usernameInput) {
            usernameInput.focus();
        }
    }
    
    // Add enter key navigation
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            const focused = document.activeElement;
            if (focused.id === 'username') {
                const passwordInput = document.getElementById('password');
                if (passwordInput) {
                    passwordInput.focus();
                    e.preventDefault();
                }
            }
        }
    });
    
    // Prevent zoom on iOS
    document.addEventListener('touchstart', function(event) {
        if (event.touches.length > 1) {
            event.preventDefault();
        }
    }, { passive: false });
    
    // Prevent double-tap zoom
    let lastTouchEnd = 0;
    document.addEventListener('touchend', function(event) {
        const now = (new Date()).getTime();
        if (now - lastTouchEnd <= 300) {
            event.preventDefault();
        }
        lastTouchEnd = now;
    }, false);
    
    // Handle iOS Safari 100vh issue
    function setAppHeight() {
        const doc = document.documentElement;
        doc.style.setProperty('--app-height', `${window.innerHeight}px`);
    }
    
    window.addEventListener('resize', setAppHeight);
    window.addEventListener('orientationchange', setAppHeight);
    setAppHeight();
    
    // Prevent form zoom on focus for iOS
    if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
        document.addEventListener('focus', function(event) {
            if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
                setTimeout(function() {
                    event.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 100);
            }
        }, true);
    }
}

// --------------------------
// Get Device Information
// --------------------------
function getDeviceInfo() {
    return {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        screenResolution: `${screen.width}x${screen.height}`,
        deviceType: /Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ? 'Mobile' : 'Desktop',
        timestamp: new Date().toISOString(),
        browser: getBrowserName(),
        os: getOSName()
    };
}

function getBrowserName() {
    const userAgent = navigator.userAgent;
    if (userAgent.includes("Chrome") && !userAgent.includes("Edg")) return "Chrome";
    if (userAgent.includes("Firefox")) return "Firefox";
    if (userAgent.includes("Safari") && !userAgent.includes("Chrome")) return "Safari";
    if (userAgent.includes("Edg")) return "Edge";
    if (userAgent.includes("Opera") || userAgent.includes("OPR")) return "Opera";
    return "Unknown";
}

function getOSName() {
    const userAgent = navigator.userAgent;
    if (userAgent.includes("Windows")) return "Windows";
    if (userAgent.includes("Mac")) return "MacOS";
    if (userAgent.includes("Linux")) return "Linux";
    if (userAgent.includes("Android")) return "Android";
    if (userAgent.includes("iOS") || userAgent.includes("iPhone") || userAgent.includes("iPad")) return "iOS";
    return "Unknown";
}

// --------------------------
// SHA-256 Hash Function
// --------------------------
async function sha256(str) {
    const utf8 = new TextEncoder().encode(str);
    const hashBuffer = await crypto.subtle.digest("SHA-256", utf8);
    return Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");
}

// --------------------------
// Check Previous Session - UPDATED
// --------------------------
function checkPreviousSession() {
    const loggedIn = localStorage.getItem("loggedIn");
    const loginTime = localStorage.getItem("loginTime");
    const sessionId = sessionStorage.getItem("sessionId");
    
    if (loggedIn === "true" && loginTime && sessionId) {
        const currentTime = Date.now();
        const loginTimestamp = parseInt(loginTime);
        const sessionAge = currentTime - loginTimestamp;
        
        // Check if session expired locally first
        if (sessionAge < SESSION_TIMEOUT) {
            // Session might still be valid, check with server
            checkSessionWithServer(localStorage.getItem("username"), sessionId);
        } else {
            // Session expired, clear storage
            console.log("Previous session expired, clearing storage...");
            clearSessionData();
        }
    }
}

async function checkSessionWithServer(username, sessionId) {
    try {
        // Add timeout for session check
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const response = await fetchJSON(API_URL, {
            action: "validateSession",
            username: username,
            sessionId: sessionId
        }, controller.signal);
        
        clearTimeout(timeoutId);
        
        if (response.success && response.isLoggedIn) {
            // ADD: Check session age from localStorage
            const loginTime = localStorage.getItem("loginTime");
            if (loginTime) {
                const sessionAge = Date.now() - parseInt(loginTime);
                if (sessionAge > SESSION_TIMEOUT) {
                    console.log("Session expired locally, clearing...");
                    clearSessionData();
                    return;
                }
            }
            
// Session is still valid, redirect to main page
console.log("Valid session found, redirecting...");
window.location.href = "main.html";
        } else {
            // Session invalid, clear storage
            clearSessionData();
        }
    } catch (error) {
        console.error("Session check failed:", error);
        if (error.name === 'AbortError') {
            console.log("Session check timeout");
        }
        clearSessionData();
    }
}

// --------------------------
// LOGIN HANDLER - UPDATED WITH TIMEOUT
// --------------------------
async function handleLogin(event) {
    event.preventDefault();
    event.stopPropagation();

    console.log("=== Login attempt started ===");
    
    const msg = document.getElementById("statusText");
    const errorDiv = document.getElementById("loginError");
    const loginBtn = document.getElementById("loginButton");
    
    if (msg) msg.innerText = "Please wait… validating account…";
    if (msg) msg.style.color = "green";
    if (errorDiv) errorDiv.style.display = "none";

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;

    console.log("Username entered:", username);
    console.log("Password length:", password.length);

    if (!username || !password) {
        console.log("Missing username or password");
        showError("Please enter username and password.");
        return;
    }

    // Show loading state
    if (loginBtn) {
        loginBtn.classList.add("btn-loading");
        loginBtn.disabled = true;
    }

    try {
        // Generate password hash
        console.log("Generating password hash...");
        const pwHash = await sha256(password);
        console.log("Password hash generated (first 10 chars):", pwHash.substring(0, 10) + "...");
        
        // Get device information
        const deviceInfo = getDeviceInfo();
        console.log("Device info:", deviceInfo);
        
        // Prepare request data
        const requestData = {
            action: "login",
            username: username,
            pwHash: pwHash,
            deviceInfo: JSON.stringify(deviceInfo)
        };
        
        console.log("Sending login request to:", API_URL);
        console.log("Request data:", requestData);

        // Send POST request with timeout
        const startTime = Date.now();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
        
        const response = await fetchJSON(API_URL, requestData, controller.signal);
        
        clearTimeout(timeoutId);
        const endTime = Date.now();
        console.log(`Request completed in ${endTime - startTime}ms`);
        
        if (!response.success) {
            console.log("Login failed:", response.message);
            
            // Handle "already logged in" error
            if (response.code === "ALREADY_LOGGED_IN") {
                // Show custom error with force logout option
                showAlreadyLoggedInError(username, password, response);
            } else {
                showError("Login failed: " + response.message);
            }
            
            if (loginBtn) {
                loginBtn.classList.remove("btn-loading");
                loginBtn.disabled = false;
            }
            return;
        }

        // -------------------------------
        // LOGIN SUCCESS
        // -------------------------------
        console.log("Login successful! User data:", response.user);
        console.log("Session ID:", response.sessionId);
        if (msg) {
            msg.innerText = "Login successful! Redirecting...";
            msg.style.color = "green";
        }

        // Store session data
        storeSessionData(response.user, pwHash, response.sessionId);
        
        // Start session management
        startSessionManagement(response.user.Username, response.sessionId);
        
        // Redirect to main page
console.log("Redirecting to main.html...");
setTimeout(() => {
    window.location.replace("main.html");
}, 1000);

    } catch (err) {
        console.error("FETCH ERROR:", err);
        console.error("Error details:", err.message);
        
        if (err.name === 'AbortError') {
            showError("Connection timeout. Please check your internet and try again.");
        } else {
            showError("Connection error: " + err.message);
        }
        
        if (loginBtn) {
            loginBtn.classList.remove("btn-loading");
            loginBtn.disabled = false;
        }
    }
}

// --------------------------
// Handle "Already Logged In" Error - UPDATED with modal
// --------------------------
async function showAlreadyLoggedInError(username, password, errorResponse) {
    const errorDiv = document.getElementById("loginError");
    const loginBtn = document.getElementById("loginButton");
    
    // Hide the inline error div
    if (errorDiv) {
        errorDiv.style.display = "none";
    }
    
    // Remove any existing modal
    const existingModal = document.getElementById('alreadyLoggedInModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Create modal overlay
    const modalOverlay = document.createElement('div');
    modalOverlay.id = 'alreadyLoggedInModal';
    modalOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.3);
        backdrop-filter: blur(2px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000000;
        padding: 16px;
        animation: modalFadeIn 0.15s ease;
    `;

    // Create modal box
    const modalBox = document.createElement('div');
    modalBox.style.cssText = `
        background: white;
        border-radius: 12px;
        max-width: 300px;
        width: 100%;
        box-shadow: 0 15px 30px rgba(0, 0, 0, 0.2);
        animation: modalSlideUp 0.2s ease;
        overflow: hidden;
    `;

    // Format session details if available
    let sessionDetailsHtml = '';
    if (errorResponse.lastActivity || errorResponse.sessionStarted) {
        sessionDetailsHtml = `
            <div style="margin: 12px 0; padding: 10px; background: #fff9e6; border-radius: 8px; border-left: 3px solid #ff9800; font-size: 0.75rem; text-align: left;">
                ${errorResponse.sessionStarted ? `<div style="margin-bottom: 4px;"><i class="fas fa-calendar-alt" style="color: #ff9800; width: 16px; margin-right: 6px;"></i> <strong>Session started:</strong> ${errorResponse.sessionStarted}</div>` : ''}
                ${errorResponse.lastActivity ? `<div style="margin-bottom: 4px;"><i class="fas fa-clock" style="color: #ff9800; width: 16px; margin-right: 6px;"></i> <strong>Last activity:</strong> ${errorResponse.lastActivity}</div>` : ''}
                ${errorResponse.inactiveMinutes ? `<div><i class="fas fa-hourglass-half" style="color: #ff9800; width: 16px; margin-right: 6px;"></i> <strong>Inactive for:</strong> ${errorResponse.inactiveMinutes} minutes</div>` : ''}
            </div>
        `;
    }

    // Modal content
    modalBox.innerHTML = `
        <div style="padding: 20px 20px 12px 20px; text-align: center;">
            <div style="margin-bottom: 8px;">
                <i class="fas fa-exclamation-triangle" style="font-size: 1.8rem; color: #ff9800; opacity: 0.7;"></i>
            </div>
            <h3 style="margin: 0 0 4px 0; color: #1e293b; font-size: 1rem; font-weight: 600; letter-spacing: -0.01em;">
                Account Already in Use
            </h3>
            <p style="margin: 0 0 8px 0; color: #64748b; font-size: 0.8rem; line-height: 1.4; font-weight: 400;">
                ${errorResponse.message || 'This account is currently logged in on another device.'}
            </p>
            ${sessionDetailsHtml}
            <p style="margin: 8px 0 0 0; color: #64748b; font-size: 0.75rem; font-style: italic;">
                You can force logout from the other device to continue.
            </p>
        </div>
        <div style="display: flex; gap: 8px; padding: 4px 20px 20px 20px;">
            <button id="modalCancelBtn" style="
                flex: 1;
                padding: 8px 10px;
                border-radius: 6px;
                font-weight: 500;
                font-size: 0.75rem;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 4px;
                transition: all 0.15s ease;
                outline: none;
                box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
                letter-spacing: 0.3px;
                border: 1.5px solid #ef4444;
                background: transparent;
                color: #ef4444;
            ">
                <i class="fas fa-times"></i> Cancel
            </button>
            <button id="modalForceLogoutBtn" style="
                flex: 1;
                padding: 8px 10px;
                border-radius: 6px;
                font-weight: 500;
                font-size: 0.75rem;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 4px;
                transition: all 0.15s ease;
                outline: none;
                box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
                letter-spacing: 0.3px;
                border: 1.5px solid #ff9800;
                background: transparent;
                color: #ff9800;
            ">
                <i class="fas fa-sign-out-alt"></i> Force Logout
            </button>
        </div>
    `;

    // Add animations if not already present
    if (!document.getElementById('modalAnimations')) {
        const style = document.createElement('style');
        style.id = 'modalAnimations';
        style.textContent = `
            @keyframes modalFadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes modalSlideUp {
                from { 
                    opacity: 0;
                    transform: translateY(8px);
                }
                to { 
                    opacity: 1;
                    transform: translateY(0);
                }
            }
        `;
        document.head.appendChild(style);
    }

    modalOverlay.appendChild(modalBox);
    document.body.appendChild(modalOverlay);

    // Get buttons
    const cancelBtn = document.getElementById('modalCancelBtn');
    const forceBtn = document.getElementById('modalForceLogoutBtn');

    // Add hover effects
    // Cancel button hover (red)
    cancelBtn.addEventListener('mouseenter', () => {
        cancelBtn.style.background = '#ef4444';
        cancelBtn.style.color = 'white';
    });
    cancelBtn.addEventListener('mouseleave', () => {
        cancelBtn.style.background = 'transparent';
        cancelBtn.style.color = '#ef4444';
    });

    // Force logout button hover (orange)
    forceBtn.addEventListener('mouseenter', () => {
        forceBtn.style.background = '#ff9800';
        forceBtn.style.color = 'white';
    });
    forceBtn.addEventListener('mouseleave', () => {
        forceBtn.style.background = 'transparent';
        forceBtn.style.color = '#ff9800';
    });

    // Button click handlers
    cancelBtn.addEventListener('click', () => {
        modalOverlay.remove();
        // Re-enable login button
        if (loginBtn) {
            loginBtn.classList.remove("btn-loading");
            loginBtn.disabled = false;
        }
    });

    forceBtn.addEventListener('click', () => {
        modalOverlay.remove();
        // Show loading state on login button
        if (loginBtn) {
            loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Force Logging Out...';
            loginBtn.disabled = true;
        }
        // Call the force logout function
        handleForceLogout(username, password);
    });

    // Close on overlay click
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
            modalOverlay.remove();
            // Re-enable login button
            if (loginBtn) {
                loginBtn.classList.remove("btn-loading");
                loginBtn.disabled = false;
            }
        }
    });

    // Handle ESC key
    const handleEsc = (e) => {
        if (e.key === 'Escape') {
            modalOverlay.remove();
            document.removeEventListener('keydown', handleEsc);
            // Re-enable login button
            if (loginBtn) {
                loginBtn.classList.remove("btn-loading");
                loginBtn.disabled = false;
            }
        }
    };
    document.addEventListener('keydown', handleEsc);
}

// --------------------------
// Force Logout Handler - UPDATED with better feedback
// --------------------------
async function handleForceLogout(username, password) {
    console.log("Force logout requested for:", username);
    
    const errorDiv = document.getElementById("loginError");
    const loginBtn = document.getElementById("loginButton");
    
    try {
        // Show loading state in login button
        if (loginBtn) {
            loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Terminating session...';
            loginBtn.disabled = true;
        }
        
        // Set timeout for force logout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
        
        // Call force logout API
        const response = await fetchJSON(API_URL, {
            action: "forceLogout",
            username: username
        }, controller.signal);
        
        clearTimeout(timeoutId);
        
        if (response.success) {
            console.log("Force logout successful. Request ID:", response.invalidationRequestId);
            
            // Show success message
            if (loginBtn) {
                loginBtn.innerHTML = '<i class="fas fa-check"></i> Session terminated! Logging in...';
            }
            
            // Wait 2 seconds for the other device to detect logout
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Now retry login
            const loginController = new AbortController();
            const loginTimeoutId = setTimeout(() => loginController.abort(), 15000);
            
            try {
                const pwHash = await sha256(password);
                const deviceInfo = getDeviceInfo();
                
                const loginResponse = await fetchJSON(API_URL, {
                    action: "login",
                    username: username,
                    pwHash: pwHash,
                    deviceInfo: JSON.stringify(deviceInfo)
                }, loginController.signal);
                
                clearTimeout(loginTimeoutId);
                
                if (loginResponse.success) {
                    // Login successful
                    storeSessionData(loginResponse.user, pwHash, loginResponse.sessionId);
                    startSessionManagement(username, loginResponse.sessionId);
                    
                    // Show success before redirect
                    if (loginBtn) {
                        loginBtn.innerHTML = '<i class="fas fa-check-circle"></i> Login successful! Redirecting...';
                    }
                    
                    setTimeout(() => {
                        window.location.replace("main.html");
                    }, 1000);
                } else {
                    showError("Login failed after force logout: " + loginResponse.message);
                    if (loginBtn) {
                        loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login to System';
                        loginBtn.disabled = false;
                    }
                }
            } catch (loginErr) {
                clearTimeout(loginTimeoutId);
                if (loginErr.name === 'AbortError') {
                    showError("Login timeout after force logout. Please try again.");
                } else {
                    showError("Login error after force logout: " + loginErr.message);
                }
                if (loginBtn) {
                    loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login to System';
                    loginBtn.disabled = false;
                }
            }
        } else {
            showError("Force logout failed: " + response.message);
            if (loginBtn) {
                loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login to System';
                loginBtn.disabled = false;
            }
        }
    } catch (err) {
        console.error("Force logout error:", err);
        if (err.name === 'AbortError') {
            showError("Force logout timeout. Please try again.");
        } else {
            showError("Error during force logout: " + err.message);
        }
        if (loginBtn) {
            loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login to System';
            loginBtn.disabled = false;
        }
    }
}

// --------------------------
// Session Management
// --------------------------
function startSessionManagement(username, sessionId) {
    // Clear any existing intervals
    if (sessionCheckInterval) {
        clearInterval(sessionCheckInterval);
    }
    if (sessionActivityInterval) {
        clearInterval(sessionActivityInterval);
    }
    
    // Check session validity every 30 seconds
    sessionCheckInterval = setInterval(async () => {
        try {
            const response = await fetchJSON(API_URL, {
                action: "checkSessionStatus",
                username: username,
                sessionId: sessionId
            });
            
            if (!response.success || !response.isLoggedIn) {
                // Session invalid - user was logged out from another device
                console.log("Session invalidated from another device");
                clearSessionData();
                alert("Your session has been terminated from another device. You have been logged out.");
                window.location.href = "index.html";
            }
        } catch (error) {
            console.error("Session check failed:", error);
        }
    }, 30000); // Check every 30 seconds
    
    // Update activity every 5 minutes
    sessionActivityInterval = setInterval(async () => {
        try {
            await fetchJSON(API_URL, {
                action: "logActivity",
                username: username,
                action: "Session Active"
            });
            console.log("Session activity updated");
        } catch (err) {
            console.error("Failed to update session activity:", err);
        }
    }, 5 * 60 * 1000); // 5 minutes
    
    // Also update on user interactions
    const updateActivity = debounce(async () => {
        try {
            await fetchJSON(API_URL, {
                action: "logActivity",
                username: username,
                action: "User Interaction"
            });
        } catch (err) {
            console.error("Failed to update activity on interaction:", err);
        }
    }, 30000); // 30 seconds debounce
    
    ['click', 'keypress', 'mousemove', 'scroll'].forEach(eventType => {
        document.addEventListener(eventType, updateActivity, { passive: true });
    });
}

// --------------------------
// Store Session Data
// --------------------------
function storeSessionData(user, pwHash, sessionId) {
    // Clear any existing storage
    localStorage.clear();
    sessionStorage.clear();
    
    // Store in sessionStorage
    sessionStorage.setItem('sessionId', sessionId);
    sessionStorage.setItem('sessionExpiry', (Date.now() + SESSION_TIMEOUT).toString());
    sessionStorage.setItem('authenticated', 'true');
    
    // NORMALIZE ROLE - ensure consistent case
    const normalizedRole = user.Role ? user.Role.trim() : 'Staff';
    
    // Store in localStorage
    localStorage.setItem('loggedIn', 'true');
    localStorage.setItem('username', user.Username);
    localStorage.setItem('staffName', user.FullName);
    localStorage.setItem('userRole', normalizedRole);
    localStorage.setItem('role', normalizedRole);
    localStorage.setItem('assignedBarangay', user.AssignedBarangay || '');
    localStorage.setItem('pwHash', pwHash);
    localStorage.setItem('loginTime', Date.now().toString());
    localStorage.setItem('lastActivity', Date.now().toString());
    localStorage.setItem('deviceInfo', JSON.stringify(getDeviceInfo()));

    console.log("Session data stored. Role:", normalizedRole, "Full Name:", user.FullName);
}

// --------------------------
// Clear Session Data
// --------------------------
function clearSessionData() {
    if (sessionCheckInterval) {
        clearInterval(sessionCheckInterval);
        sessionCheckInterval = null;
    }
    if (sessionActivityInterval) {
        clearInterval(sessionActivityInterval);
        sessionActivityInterval = null;
    }
    
    localStorage.clear();
    sessionStorage.clear();
    console.log("Session data cleared");
}

// --------------------------
// Close Error Message
// --------------------------
function closeError() {
    const errorDiv = document.getElementById("loginError");
    if (errorDiv) {
        errorDiv.style.display = "none";
        errorDiv.innerHTML = "";
    }
}

// --------------------------
// Debounce Helper
// --------------------------
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// --------------------------
// Helper Functions - UPDATED WITH SIGNAL
// --------------------------
async function fetchJSON(url, data, signal) {
    try {
        // Convert data to FormData for Google Apps Script
        const formData = new FormData();
        for (const key in data) {
            formData.append(key, data[key]);
        }
        
        const response = await fetch(url, {
            method: "POST",
            body: formData,
            signal: signal || null
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const text = await response.text();
        console.log("Response text:", text);
        
        try {
            return JSON.parse(text);
        } catch (e) {
            console.error("Failed to parse JSON:", e);
            return { success: false, message: "Invalid server response" };
        }
    } catch (error) {
        console.error("fetchJSON error:", error);
        if (error.name === 'AbortError') {
            throw error; // Re-throw abort errors
        }
        return { success: false, message: "Connection failed: " + error.message };
    }
}

function showError(message) {
    console.error("Showing error:", message);
    const errorDiv = document.getElementById("loginError");
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = "block";
        
        // Auto-hide error after 8 seconds
        setTimeout(() => {
            errorDiv.style.display = "none";
        }, 8000);
    }
}

async function testAPIConnection() {
    console.log("Testing API connection...");
    try {
        // Test with GET request
        const testUrl = API_URL + "?action=test&t=" + Date.now();
        console.log("Testing URL:", testUrl);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const response = await fetch(testUrl, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        const text = await response.text();
        console.log("API test response:", text);
        
        try {
            const data = JSON.parse(text);
            if (data.success) {
                console.log("✓ API connection successful");
                const statusText = document.getElementById("statusText");
                if (statusText) {
                    statusText.innerText += " (API connected)";
                }
            } else {
                console.log("✗ API returned error:", data.message);
            }
        } catch (e) {
            console.log("✗ API returned non-JSON response:", text);
        }
        
        return text;
    } catch (error) {
        console.error("API test failed:", error);
        const statusText = document.getElementById("statusText");
        if (statusText) {
            statusText.innerText += " (API disconnected)";
        }
        return null;
    }
}

// Make functions available globally
window.handleForceLogout = handleForceLogout;
window.closeError = closeError;
// In your index.js, update the storeSessionData function:
function storeSessionData(user, pwHash, sessionId) {
    // Clear any existing storage
    localStorage.clear();
    sessionStorage.clear();
    
    // Store in sessionStorage
    sessionStorage.setItem('sessionId', sessionId);
    sessionStorage.setItem('sessionExpiry', (Date.now() + SESSION_TIMEOUT).toString());
    sessionStorage.setItem('authenticated', 'true');
    
    // Store in localStorage
    localStorage.setItem('loggedIn', 'true');
    localStorage.setItem('username', user.Username);
    localStorage.setItem('staffName', user.FullName); // This is the Full Name
    localStorage.setItem('userRole', user.Role);
    localStorage.setItem('role', user.Role);
    localStorage.setItem('assignedBarangay', user.AssignedBarangay || '');
    localStorage.setItem('pwHash', pwHash);
    localStorage.setItem('loginTime', Date.now().toString());
    localStorage.setItem('lastActivity', Date.now().toString());
    localStorage.setItem('deviceInfo', JSON.stringify(getDeviceInfo()));

    console.log("Session data stored. Full Name:", user.FullName);
}
