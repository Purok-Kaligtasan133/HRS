// session-manager.js - Session Manager for All Pages
class SessionManager {
    constructor() {
        this.checkInterval = null;
        this.SESSION_CHECK_INTERVAL = 30000; // 30 seconds
        this.initialized = false;
        this.activityEvents = ['click', 'keydown', 'mousemove', 'scroll'];
        this.idleCheckInterval = null;
    }

    // Initialize on page load (except index.html)
    async initialize() {
        // Don't run on login page
        if (window.location.pathname.includes('index.html') || 
            window.location.pathname.includes('index')) {
            return;
        }
        
        // Prevent double initialization
        if (this.initialized) {
            return;
        }
        
        console.log("Session Manager: Checking session...");
        
        // SET USERNAME IMMEDIATELY before session validation
        this.setUserNameImmediately();
        
        const isValid = await this.validateSession();
        
        if (!isValid) {
            console.log("Session Manager: Invalid session, redirecting to login");
            window.location.href = 'index.html?session=expired';
            return;
        }
        
        this.startSessionMonitoring();
        this.updateUI();
        
        // ADD THIS - Force guest restrictions immediately
        this.forceGuestRestrictions();
        
        this.initialized = true;
        console.log("Session Manager: Session valid, user logged in");
    }

    // Set user name immediately on page load
    setUserNameImmediately() {
        const fullName = localStorage.getItem('staffName');
        const username = localStorage.getItem('username');
        const displayName = fullName || username || 'User';
        
        const userNameElement = document.getElementById('userName');
        if (userNameElement) {
            userNameElement.textContent = displayName;
        }
        
        document.querySelectorAll('.username-display, [data-username]').forEach(el => {
            el.textContent = displayName;
        });
        
        const userFullNameElement = document.getElementById('userFullName');
        if (userFullNameElement) {
            userFullNameElement.textContent = displayName;
        }
        
        console.log("Session Manager: Set immediate username:", displayName);
    }

    // Check if user is guest
    isGuest() {
        return localStorage.getItem('isGuest') === 'true' || 
               sessionStorage.getItem('isGuest') === 'true';
    }

    // Validate session with server
   async validateSession() {
    const loggedIn = localStorage.getItem('loggedIn');
    const username = localStorage.getItem('username');
    const sessionId = sessionStorage.getItem('sessionId');
    const loginTime = localStorage.getItem('loginTime');
    const isGuest = this.isGuest();
    
    // Basic checks
    if (loggedIn !== 'true' || !username || !sessionId || !loginTime) {
        console.log("Session Manager: Missing session data");
        this.clearSession();
        this.showSessionExpiredMessage();  // ← ADD THIS LINE
        return false;
    }
    
    // Check local timeout (30 minutes)
    const sessionAge = Date.now() - parseInt(loginTime);
    if (sessionAge > 30 * 60 * 1000) {
        console.log("Session Manager: Session expired locally");
        this.clearSession();
        this.showSessionExpiredMessage();  // ← ADD THIS LINE
        return false;
    }
    
    // Skip server validation for guest users
    if (isGuest) {
        console.log("Session Manager: Guest user, skipping server validation");
        localStorage.setItem('lastActivity', Date.now().toString());
        return true;
    }
    
    try {
        const API_URL = window.API_URL || "https://script.google.com/macros/s/AKfycbymKmfbcn3uQmsljJlt8V-ziD_wf1H6Pm6ejMqEeRwxhqHB0vktP3My7OcXVCWVMvnhCg/exec";
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const formData = new FormData();
        formData.append('action', 'validateSession');
        formData.append('username', username);
        formData.append('sessionId', sessionId);
        
        const response = await fetch(API_URL, {
            method: 'POST',
            body: formData,
            signal: controller.signal,
            mode: 'cors'
        });
        
        clearTimeout(timeoutId);
        
        try {
            const data = await response.json();
            if (data.success && data.isLoggedIn) {
                localStorage.setItem('lastActivity', Date.now().toString());
                return true;
            } else {
                console.log("Session Manager: Server validation failed", data.message);
                this.clearSession();
                this.showSessionExpiredMessage();  // ← ADD THIS LINE
                return false;
            }
        } catch (parseError) {
            console.log("Session Manager: Could not parse response, but request succeeded");
            localStorage.setItem('lastActivity', Date.now().toString());
            return true;
        }
        
    } catch (error) {
        console.log("Session Manager: Validation error, continuing with local session", error.name);
        localStorage.setItem('lastActivity', Date.now().toString());
        return true;
    }
}

    // Update user info from server
    async updateUserInfo(username) {
        try {
            const API_URL = window.API_URL || "https://script.google.com/macros/s/AKfycbymKmfbcn3uQmsljJlt8V-ziD_wf1H6Pm6ejMqEeRwxhqHB0vktP3My7OcXVCWVMvnhCg/exec";
            
            const response = await fetch(`${API_URL}?action=users&t=${Date.now()}`);
            const data = await response.json();
            
            if (data.success && data.users) {
                const user = data.users.find(u => u.Username === username);
                if (user) {
                    localStorage.setItem('staffName', user.FullName);
                    localStorage.setItem('userRole', user.Role);
                    localStorage.setItem('assignedBarangay', user.AssignedBarangay);
                    
                    console.log("Session Manager: User info updated", {
                        name: user.FullName,
                        role: user.Role,
                        barangay: user.AssignedBarangay
                    });
                    
                    this.updateUI();
                }
            }
        } catch (error) {
            console.error("Session Manager: Failed to update user info", error);
        }
    }

    // Start session monitoring
    startSessionMonitoring() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
        }
        
        this.checkInterval = setInterval(async () => {
            const isValid = await this.validateSession();
            if (!isValid) {
                this.showSessionExpiredMessage();
            }
        }, this.SESSION_CHECK_INTERVAL);
        
        console.log("Session Manager: Started session monitoring");
        this.setupActivityMonitoring();
    }

    // Monitor user activity for idle timeout
    setupActivityMonitoring() {
        this.cleanupActivityMonitoring();
        
        const updateActivity = () => {
            localStorage.setItem('lastActivity', Date.now().toString());
        };
        
        this.activityEvents.forEach(event => {
            document.addEventListener(event, updateActivity, { passive: true });
        });
        
        if (this.idleCheckInterval) {
            clearInterval(this.idleCheckInterval);
        }
        
this.idleCheckInterval = setInterval(() => {
    const lastActivity = localStorage.getItem('lastActivity');
    if (lastActivity) {
        const idleTime = Date.now() - parseInt(lastActivity);
        if (idleTime > 30 * 60 * 1000) {
            console.log("Session Manager: User idle for 30+ minutes");
            this.showSessionExpiredMessage();  // ← ADD THIS LINE
        }
    }
}, 60000);
        
        console.log("Session Manager: Started activity monitoring");
    }

    // Clean up activity monitoring
    cleanupActivityMonitoring() {
        const updateActivity = () => {};
        this.activityEvents.forEach(event => {
            document.removeEventListener(event, updateActivity);
        });
        
        if (this.idleCheckInterval) {
            clearInterval(this.idleCheckInterval);
            this.idleCheckInterval = null;
        }
    }

    // NEW METHOD: Force guest restrictions - ONLY SHOW DASHBOARD
    forceGuestRestrictions() {
        const isGuest = this.isGuest();
        
        if (isGuest) {
            console.log("Session Manager: Force applying guest restrictions - hiding all tabs except Dashboard");
            
            // Hide ALL navigation items first
            document.querySelectorAll('.nav-item, .mobile-nav-item, .sidebar li, .sidebar a, .main-nav a, [data-page]').forEach(el => {
                // Skip if it's dashboard
                const href = el.getAttribute?.('href') || '';
                const dataPage = el.getAttribute?.('data-page') || '';
                const text = el.textContent || '';
                
                const isDashboard = href.includes('dashboard') || 
                                    dataPage === 'dashboard' || 
                                    text.includes('Dashboard');
                
                if (!isDashboard) {
                    if (el.style) el.style.display = 'none';
                    // Also hide parent li if exists
                    if (el.closest('li')) {
                        el.closest('li').style.display = 'none';
                    }
                    if (el.closest('.mobile-nav-item')) {
                        el.closest('.mobile-nav-item').style.display = 'none';
                    }
                }
            });
            
            // Force show dashboard
            document.querySelectorAll('a[href*="dashboard"], [data-page="dashboard"]').forEach(el => {
                el.style.display = '';
                if (el.closest('li')) {
                    el.closest('li').style.display = '';
                }
                if (el.closest('.mobile-nav-item')) {
                    el.closest('.mobile-nav-item').style.display = 'flex';
                }
                if (el.closest('.nav-item')) {
                    el.closest('.nav-item').style.display = 'flex';
                }
            });
            
            // Also find by text content
            document.querySelectorAll('.mobile-nav-item, .nav-item, .sidebar li a').forEach(el => {
                const text = el.textContent || '';
                if (text.includes('Dashboard')) {
                    el.style.display = '';
                    if (el.closest('li')) el.closest('li').style.display = '';
                }
            });
            
            // Add guest badge
            this.addGuestBadge();
        }
    }

    // Update UI with user info and handle guest restrictions
    updateUI() {
        const fullName = localStorage.getItem('staffName');
        const role = localStorage.getItem('userRole');
        const barangay = localStorage.getItem('assignedBarangay');
        const username = localStorage.getItem('username');
        const isGuest = this.isGuest();
        
        console.log("Session Manager: Updating UI with", { fullName, role, barangay, username, isGuest });
        
        // Update username display
        const usernameElements = document.querySelectorAll('#userName, .username-display, [data-username]');
        usernameElements.forEach(el => {
            if (el) {
                el.textContent = fullName || username || 'User';
                el.style.display = 'inline';
            }
        });
        
        // Handle guest visibility - ONLY SHOW DASHBOARD FOR GUESTS
        if (isGuest) {
            console.log("Session Manager: Guest user - hiding all tabs except Dashboard");
            
            // Hide ALL navigation items first
            document.querySelectorAll('.nav-item, .mobile-nav-item, .sidebar li a').forEach(el => {
                const link = el.closest('a') || el;
                const parent = link.closest('li') || link;
                
                // Hide everything
                if (parent) parent.style.display = 'none';
                if (link) link.style.display = 'none';
                
                // Also hide the element itself
                el.style.display = 'none';
            });
            
            // ONLY show dashboard tab
            const dashboardSelectors = [
                '[data-page="dashboard"]',
                'a[href*="dashboard.html"]',
                '.sidebar li a[title="Dashboard"]'
            ];
            
            dashboardSelectors.forEach(selector => {
                try {
                    document.querySelectorAll(selector).forEach(el => {
                        const link = el.closest('a') || el;
                        const parent = link.closest('li') || link;
                        
                        if (parent) parent.style.display = '';
                        if (link) link.style.display = '';
                        el.style.display = '';
                        
                        console.log("Session Manager: Showing dashboard element", el);
                    });
                } catch (e) {
                    // Ignore complex selector errors
                }
            });
            
            // Also try to find by text content for mobile nav
            document.querySelectorAll('.mobile-nav-item').forEach(item => {
                const text = item.textContent || '';
                if (text.includes('Dashboard')) {
                    item.style.display = 'flex';
                } else {
                    item.style.display = 'none';
                }
            });
            
            // Add guest badge to header
            this.addGuestBadge();
            
        } else {
            // Regular user - show all navigation
            console.log("Session Manager: Regular user - showing all tabs");
            
            document.querySelectorAll('.nav-item, .mobile-nav-item, .sidebar li a').forEach(el => {
                const link = el.closest('a') || el;
                const parent = link.closest('li') || link;
                
                if (parent) parent.style.display = '';
                if (link) link.style.display = '';
                el.style.display = '';
            });
            
            // Check for admin role
            const isAdmin = role && role.toLowerCase() === 'admin';
            document.querySelectorAll('.admin-only').forEach(el => {
                if (isAdmin) {
                    el.classList.add('admin-visible');
                    el.style.display = '';
                } else {
                    el.classList.remove('admin-visible');
                    el.style.display = 'none';
                }
            });
        }
        
        // Update additional elements if they exist
        const userFullNameElement = document.getElementById('userFullName');
        if (userFullNameElement) {
            userFullNameElement.textContent = fullName || username || 'User';
        }
        
        const userRoleElement = document.getElementById('userRole');
        if (userRoleElement) {
            userRoleElement.textContent = isGuest ? 'Guest (View Only)' : (role || 'Staff');
            userRoleElement.style.display = 'inline';
        }
        
        const userBarangayElement = document.getElementById('userBarangay');
        if (userBarangayElement && barangay) {
            userBarangayElement.textContent = isGuest ? '• View Only Mode' : `• ${barangay}`;
            userBarangayElement.style.display = 'inline';
        }
    }

    // Add guest badge to header
    addGuestBadge() {
        const existingBadge = document.querySelector('.guest-badge');
        if (existingBadge) {
            existingBadge.remove();
        }
        
        const headerRight = document.querySelector('.header-right, .user-info, .topbar .user-info, .brand + div');
        if (headerRight) {
            const guestBadge = document.createElement('span');
            guestBadge.className = 'guest-badge';
            guestBadge.innerHTML = '<i class="fas fa-eye"></i> View Only';
            guestBadge.style.cssText = `
                background: #ff9800;
                color: white;
                padding: 4px 10px;
                border-radius: 20px;
                font-size: 0.75rem;
                font-weight: 600;
                margin-left: 10px;
                display: inline-flex;
                align-items: center;
                gap: 5px;
            `;
            headerRight.appendChild(guestBadge);
        } else {
            // Try alternative selector
            const userName = document.getElementById('userName');
            if (userName && userName.parentNode) {
                const guestBadge = document.createElement('span');
                guestBadge.className = 'guest-badge';
                guestBadge.innerHTML = '<i class="fas fa-eye"></i> View Only';
                guestBadge.style.cssText = `
                    background: #ff9800;
                    color: white;
                    padding: 4px 10px;
                    border-radius: 20px;
                    font-size: 0.75rem;
                    font-weight: 600;
                    margin-left: 10px;
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                `;
                userName.parentNode.insertBefore(guestBadge, userName.nextSibling);
            }
        }
    }
        
// Show session expired message
showSessionExpiredMessage() {
    if (document.getElementById('sessionExpiredModal')) {
        return;
    }
    
    console.log("Session Manager: Showing session expired message");
    
    // Create modal with the same style as logout modal
    const modalOverlay = document.createElement('div');
    modalOverlay.id = 'sessionExpiredModal';
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
                <i class="fas fa-clock" style="font-size: 1.6rem; color: #ff9800; opacity: 0.7;"></i>
            </div>
            <h3 style="margin: 0 0 4px 0; color: #1e293b; font-size: 1rem; font-weight: 600; letter-spacing: -0.01em;">
                Session Expired
            </h3>
            <p style="margin: 0; color: #64748b; font-size: 0.8rem; line-height: 1.4; font-weight: 400;">
                Your session has expired due to inactivity. Please login again to continue.
            </p>
        </div>
        <div style="display: flex; gap: 8px; padding: 4px 20px 20px 20px;">
            <button id="reLoginBtn" style="
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
                transition: all 0.15s ease;
                outline: none;
                box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
                letter-spacing: 0.3px;
                border: 1.5px solid #0f7a4a;
                background: transparent;
                color: #0f7a4a;
            ">
                <i class="fas fa-sign-in-alt"></i> Return to Login
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

    // Handle button click
    const loginBtn = document.getElementById('reLoginBtn');
    loginBtn.addEventListener('mouseenter', () => {
        loginBtn.style.background = '#0f7a4a';
        loginBtn.style.color = 'white';
    });
    loginBtn.addEventListener('mouseleave', () => {
        loginBtn.style.background = 'transparent';
        loginBtn.style.color = '#0f7a4a';
    });
    
    loginBtn.addEventListener('click', () => {
        console.log("Session Manager: User clicked return to login");
        this.clearSession();
        window.location.href = 'index.html';
    });
    
    // Auto-redirect after 10 seconds
    setTimeout(() => {
        if (document.getElementById('sessionExpiredModal')) {
            console.log("Session Manager: Auto-redirecting to login");
            this.clearSession();
            window.location.href = 'index.html';
        }
    }, 10000);
}

    // Clear session data
    clearSession() {
        console.log("SessionManager: Clearing session and stopping monitoring");
        
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
        
        this.initialized = false;
        this.cleanupActivityMonitoring();
        
        console.log("SessionManager: Session monitoring stopped");
    }

    // Force logout (for logout button)
logout() {
    console.log("SessionManager: Manual logout initiated");
    
    // Use the common logout handler which shows confirmation
    if (window.handleLogout) {
        window.handleLogout(new Event('click'));
    } else {
        // Fallback if common handler not available
        this.clearSession();
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = 'index.html?logout=true';
    }
}

    // Get current session info
    getSessionInfo() {
        return {
            username: localStorage.getItem('username'),
            fullName: localStorage.getItem('staffName'),
            role: localStorage.getItem('userRole'),
            barangay: localStorage.getItem('assignedBarangay'),
            sessionId: sessionStorage.getItem('sessionId'),
            loginTime: localStorage.getItem('loginTime'),
            lastActivity: localStorage.getItem('lastActivity'),
            isGuest: this.isGuest()
        };
    }

    // Check if user is admin
    isAdmin() {
        return localStorage.getItem('userRole') === 'Admin';
    }

    // Get current user's barangay
    getAssignedBarangay() {
        return localStorage.getItem('assignedBarangay');
    }
}

// Create global instance
window.sessionManager = new SessionManager();

// Auto-initialize on protected pages
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.sessionManager.initialize();
    });
} else {
    window.sessionManager.initialize();
}

console.log("Session Manager: Loaded and ready");
