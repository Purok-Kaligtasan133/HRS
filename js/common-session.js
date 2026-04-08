// common-session.js - Instant Logout Handler with Professional Modal Confirmation
const COMMON_API_URL = window.SCRIPT_URL || "https://script.google.com/macros/s/AKfycbymKmfbcn3uQmsljJlt8V-ziD_wf1H6Pm6ejMqEeRwxhqHB0vktP3My7OcXVCWVMvnhCg/exec";

// ===== DEBUG LOGOUT FLOW =====
console.log("=== common-session.js LOADED ===");

// Override console.log to make logout messages more visible
const originalLog = console.log;
console.log = function(...args) {
    if (args[0] && typeof args[0] === 'string' && args[0].includes('🚪')) {
        originalLog('%c🔴 LOGOUT: ' + args[0], 'background: #ff0000; color: white; font-size: 14px; padding: 2px;', ...args.slice(1));
    } else {
        originalLog.apply(console, args);
    }
};

// Setup logout button
function setupLogoutButton() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        // Remove any existing listeners to prevent duplicates
        logoutBtn.removeEventListener('click', handleLogoutWithConfirmation);
        
        // Add new listener with confirmation
        logoutBtn.addEventListener('click', handleLogoutWithConfirmation);
        
        // Update button text/icon for immediate feedback
        logoutBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i> Logout';
        logoutBtn.disabled = false;
    }
}

// Wrapper function that shows confirmation before logout
async function handleLogoutWithConfirmation(e) {
    e.preventDefault();
    e.stopPropagation();
    
    console.log("🚪 Logout clicked - showing confirmation...");
    
    // ALWAYS show confirmation modal for ALL users
    const confirmed = await showLogoutConfirmation();
    
    if (!confirmed) {
        console.log("🚪 Logout cancelled by user");
        return; // User clicked Cancel - do nothing
    }
    
    console.log("🚪 Logout confirmed, proceeding...");
    
    // Proceed with logout - call the performLogout function
    await performLogout();
}

// Create and show logout confirmation modal
function showLogoutConfirmation() {
    return new Promise((resolve) => {
        // Check if modal already exists
        let modalOverlay = document.getElementById('logoutConfirmModal');
        
        // If modal exists, remove it first
        if (modalOverlay) {
            modalOverlay.remove();
        }
        
        // Create modal overlay
        modalOverlay = document.createElement('div');
        modalOverlay.id = 'logoutConfirmModal';
        modalOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
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
            max-width: 280px;
            width: 100%;
            box-shadow: 0 15px 30px rgba(0, 0, 0, 0.2);
            animation: modalSlideUp 0.2s ease;
            overflow: hidden;
        `;

        // Modal content
        modalBox.innerHTML = `
            <div style="padding: 20px 20px 12px 20px; text-align: center;">
                <div style="margin-bottom: 8px;">
                    <i class="fas fa-sign-out-alt" style="font-size: 1.6rem; color: #0f7a4a;"></i>
                </div>
                <h3 style="margin: 0 0 4px 0; color: #1e293b; font-size: 1rem; font-weight: 600;">
                    Confirm Logout
                </h3>
                <p style="margin: 0; color: #64748b; font-size: 0.8rem; line-height: 1.4;">
                    Are you sure you want to sign out?
                </p>
            </div>
            <div style="display: flex; gap: 8px; padding: 4px 20px 20px 20px;">
                <button id="cancelLogoutBtn" style="
                    flex: 1;
                    padding: 6px 10px;
                    border-radius: 6px;
                    font-weight: 500;
                    font-size: 0.75rem;
                    cursor: pointer;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 4px;
                    border: 1.5px solid #ef4444;
                    background: transparent;
                    color: #ef4444;
                ">
                    <i class="fas fa-times"></i> Cancel
                </button>
                <button id="confirmLogoutBtn" style="
                    flex: 1;
                    padding: 6px 10px;
                    border-radius: 6px;
                    font-weight: 500;
                    font-size: 0.75rem;
                    cursor: pointer;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 4px;
                    border: 1.5px solid #0f7a4a;
                    background: transparent;
                    color: #0f7a4a;
                ">
                    <i class="fas fa-check"></i> OK
                </button>
            </div>
        `;

        // Add animations
        const style = document.createElement('style');
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

        modalOverlay.appendChild(modalBox);
        document.body.appendChild(modalOverlay);

        // Handle button clicks
        const cancelBtn = document.getElementById('cancelLogoutBtn');
        const confirmBtn = document.getElementById('confirmLogoutBtn');

        cancelBtn.addEventListener('click', () => {
            modalOverlay.remove();
            resolve(false);
        });

        confirmBtn.addEventListener('click', () => {
            modalOverlay.remove();
            resolve(true);
        });

        // Close on overlay click
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                modalOverlay.remove();
                resolve(false);
            }
        });

        // Handle ESC key
        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                modalOverlay.remove();
                document.removeEventListener('keydown', handleEsc);
                resolve(false);
            }
        };
        document.addEventListener('keydown', handleEsc);
    });
}

// ===== SINGLE, CORRECTED performLogout FUNCTION =====
async function performLogout() {
    console.log("🚪 Logout triggered - performing actual logout");
    
    // Check if this is a guest - do this BEFORE clearing storage
    const isGuest = localStorage.getItem('isGuest') === 'true';
    const username = localStorage.getItem('username');
    const sessionId = sessionStorage.getItem('sessionId');
    const actor = localStorage.getItem('staffName') || username;
    
    console.log("Is guest?", isGuest);
    
    // Show visual feedback on button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.innerHTML = '<i class="fas fa-check-circle"></i> Logging out...';
        logoutBtn.disabled = true;
    }
    
    // Notify server (only for non-guests)
    if (!isGuest && username && sessionId) {
        try {
            // Log logout activity (fire and forget)
            const activityFormData = new FormData();
            activityFormData.append('action', 'logActivity');
            activityFormData.append('username', username);
            activityFormData.append('actor', actor);
            activityFormData.append('action', 'User Logout');
            
            fetch(COMMON_API_URL, {
                method: 'POST',
                body: activityFormData
            }).catch(() => {});
            
            // Call server logout (fire and forget)
            const logoutFormData = new FormData();
            logoutFormData.append('action', 'logout');
            logoutFormData.append('username', username);
            logoutFormData.append('sessionId', sessionId);
            
            fetch(COMMON_API_URL, {
                method: 'POST',
                body: logoutFormData
            }).catch(() => {});
            
        } catch (error) {
            console.log("Background logout notification failed (non-critical)");
        }
    } else if (isGuest) {
        // For guests, optional logging
        try {
            const activityFormData = new FormData();
            activityFormData.append('action', 'logActivity');
            activityFormData.append('username', 'guest_user');
            activityFormData.append('actor', 'Guest User');
            activityFormData.append('action', 'Guest Logout');
            
            fetch(COMMON_API_URL, {
                method: 'POST',
                body: activityFormData
            }).catch(() => {});
        } catch (error) {
            // Ignore errors
        }
    }
    
    // Stop session monitoring
    if (window.sessionManager && typeof window.sessionManager.clearSession === 'function') {
        window.sessionManager.clearSession();
    }
    
    // Clear all storage AFTER server notifications
    localStorage.clear();
    sessionStorage.clear();
    
    // Update button if it still exists
    if (logoutBtn) {
        logoutBtn.innerHTML = '<i class="fas fa-check-circle"></i> Logged out!';
        logoutBtn.style.background = '#10b981';
    }
    
    // Redirect with cache busting
    setTimeout(() => {
        window.location.replace('index.html?logout=success&t=' + Date.now());
    }, 300);
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    // Only run on protected pages (not index.html)
    if (!window.location.pathname.includes('index.html')) {
        setupLogoutButton();
    }
});

// Make functions available globally
window.handleLogout = handleLogoutWithConfirmation;
window.performLogout = performLogout;

// Also handle browser back button to prevent going back to logged out state
window.addEventListener('pageshow', function(event) {
    if (event.persisted) {
        // If page loaded from cache, check if we should be logged out
        if (!localStorage.getItem('username') && !window.location.pathname.includes('index.html')) {
            window.location.replace('index.html?session=expired');
        }
    }
});

// ===== IMPROVED GLOBAL LOGOUT INTERCEPTOR - WORKS FOR ALL USERS =====
(function() {
    console.log("🔒 Improved global logout interceptor installed - works for ALL users");
    
    // Store original functions
    const originalFunctions = {
        performLogout: window.performLogout,
        handleLogout: window.handleLogout
    };
    
    // IMPROVED: Intercept clicks on logout buttons with preventDefault
    document.addEventListener('click', function(e) {
        const target = e.target.closest('button, a');
        if (!target) return;
        
        // Check if this is a logout button
        const isLogoutButton = 
            target.id === 'logoutBtn' ||
            target.classList.contains('logout-btn') ||
            (target.innerText && target.innerText.includes('Logout')) ||
            (target.innerHTML && target.innerHTML.includes('sign-out')) ||
            (target.closest && target.closest('#logoutBtn'));
        
        if (isLogoutButton) {
            console.log("🚪 Logout button clicked - intercepted at DOM level");
            
            // CRITICAL: Prevent default action AND stop propagation for ALL users
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            
            console.log("🚪 Showing logout confirmation for user");
            
            // Call the existing confirmation modal for EVERYONE
            showLogoutConfirmation().then(confirmed => {
                if (confirmed) {
                    console.log("🚪 Logout confirmed - proceeding with logout");
                    // Call the performLogout function
                    if (window.performLogout) {
                        window.performLogout();
                    } else {
                        // Fallback
                        localStorage.clear();
                        sessionStorage.clear();
                        window.location.replace('index.html?logout=success&t=' + Date.now());
                    }
                } else {
                    console.log("🚪 Logout cancelled");
                }
            });
            
            return false;
        }
    }, true); // Use capture phase to get the event first
})();
