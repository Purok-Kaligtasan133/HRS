// activity-tracking-final.js - Fixed version with IIFE
(function() {
    'use strict';
    
    // API URL for logging - ADD THIS AT THE TOP
    const ACTIVITY_API_URL = "https://script.google.com/macros/s/AKfycbxvHCGEcQVD020RuGxug3-O8aq3DBPbvFPsNNdcia_FuT81EdICrxKnotHVF2o-59utzg/exec";
    const ALLOWED_ACTIONS = ['Update Household', 'Create Record', 'Delete Household'];

    /* Main function to record user activity - COMPATIBLE WITH DASHBOARD */
    function recordUserActivity(action, details = '') {
        try {
            console.log(`Attempting to record activity: ${action}, Details: ${details}`);
            
            // Get ALLOWED_ACTIONS from window or use local
            const allowedActions = window.ALLOWED_ACTIONS || ALLOWED_ACTIONS;
            
            // Only record allowed actions (for dashboard display)
            if (!allowedActions.includes(action)) {
                console.log(`Skipping activity recording for: ${action} (not in allowed actions)`);
                // Still log to API but don't update dashboard
                logActivityToAPIOnly(action, details);
                return;
            }
            
            const username = localStorage.getItem('staffName') || localStorage.getItem('username') || 'Unknown User';
            const actor = username;
            const timestamp = new Date().toISOString();
            
            const activity = {
                action: action,
                actor: actor,
                details: details,
                timestamp: timestamp
            };
            
            console.log(`Recording dashboard activity: ${action} by ${actor}`);
            
            // 1. Save to localStorage (triggers storage event in other tabs)
            const activityLog = JSON.parse(localStorage.getItem('activityLog') || '[]');
            activityLog.push(activity);
            
            // Keep only last 20 activities to prevent storage bloat
            if (activityLog.length > 20) {
                activityLog.splice(0, activityLog.length - 20);
            }
            
            localStorage.setItem('activityLog', JSON.stringify(activityLog));
            
            // 2. Store as recent activity for immediate access
            localStorage.setItem('recentActivity', JSON.stringify(activity));
            
            // 3. Set a trigger for immediate update
            localStorage.setItem('activityUpdateTrigger', Date.now().toString());
            
            // 4. Log to Google Sheets via API
            logActivityToAPI(username, action, details);
            
            // 5. Broadcast to other tabs using multiple methods
            broadcastActivityUpdate(activity);
            
            // 6. If we're on dashboard, update display immediately
            if (window.location.pathname.includes('dashboard.html')) {
                console.log('On dashboard, updating display immediately');
                // Check if updateActivityDisplay function exists
                if (typeof window.updateActivityDisplay === 'function') {
                    window.updateActivityDisplay(activity);
                } else {
                    // Fallback: reload activity log
                    if (typeof window.loadActivityLog === 'function') {
                        window.loadActivityLog();
                    }
                }
            }
            
        } catch(err) {
            console.error('Error recording activity:', err);
        }
    }

    /* Log activity only to API (for non-dashboard actions) */
    async function logActivityToAPIOnly(action, details = '') {
        try {
            const username = localStorage.getItem('staffName') || localStorage.getItem('username') || 'Unknown User';
            const actor = username;
            
            const formData = new FormData();
            formData.append("action", "logActivity");
            formData.append("username", username);
            formData.append("actor", actor);
            formData.append("action", action);
            formData.append("details", details || '');
            
            // Fire and forget - don't wait for response
            fetch(ACTIVITY_API_URL, {
                method: "POST",
                body: formData
            }).catch(err => console.log('API logging failed:', err));
            
        } catch(err) {
            console.error('Error logging to API only:', err);
        }
    }

    /* Log activity to Google Sheets API */
    async function logActivityToAPI(username, action, details = '') {
        try {
            const actor = username;
            
            const formData = new FormData();
            formData.append("action", "logActivity");
            formData.append("username", username);
            formData.append("actor", actor);
            formData.append("action", action);
            formData.append("details", details || '');
            
            console.log(`Logging to API: ${action} by ${actor}`);
            
            // Fire and forget - don't wait for response
            fetch(ACTIVITY_API_URL, {
                method: "POST",
                body: formData
            }).then(() => {
                console.log('Activity logged to API successfully');
            }).catch(err => {
                console.log('API logging failed:', err);
            });
            
        } catch(err) {
            console.error('Error logging activity to API:', err);
        }
    }

    /* Broadcast activity to other tabs */
    function broadcastActivityUpdate(activity) {
        try {
            console.log('Broadcasting activity update to other tabs');
            
            // Method 1: Update localStorage (triggers storage event)
            const triggerKey = 'activityUpdate_' + Date.now();
            localStorage.setItem(triggerKey, JSON.stringify(activity));
            setTimeout(() => {
                try { localStorage.removeItem(triggerKey); } catch(e) {}
            }, 1000);
            
            // Method 2: Use BroadcastChannel if supported
            if (typeof BroadcastChannel !== 'undefined') {
                try {
                    const channel = new BroadcastChannel('dashboard_activities');
                    channel.postMessage({
                        type: 'activityUpdate',
                        activity: activity,
                        source: window.location.pathname,
                        timestamp: Date.now()
                    });
                    console.log('BroadcastChannel message sent');
                } catch(bcErr) {
                    console.log('BroadcastChannel error:', bcErr);
                }
            }
            
            // Method 3: Use window.postMessage for iframes/child windows
            if (window.opener) {
                window.opener.postMessage({
                    type: 'activity',
                    activity: activity,
                    source: 'activity-tracking'
                }, '*');
            }
            
            // Send to parent if in iframe
            if (window.parent !== window) {
                window.parent.postMessage({
                    type: 'activity',
                    activity: activity,
                    source: 'activity-tracking'
                }, '*');
            }
            
        } catch(err) {
            console.error('Error broadcasting activity:', err);
        }
    }

    /* Setup cross-tab communication listeners */
    function setupActivityCommunication() {
        console.log('Setting up activity communication listeners');
        
        // Listen for localStorage changes (from other tabs)
        window.addEventListener('storage', function(e) {
            console.log('Storage event detected:', e.key);
            
            if (e.key === 'activityLog' || e.key === 'recentActivity' || 
                e.key === 'activityUpdateTrigger' || e.key?.startsWith('activityUpdate_')) {
                
                console.log('Activity-related storage change detected from another tab');
                
                // If we're on dashboard, update the display
                if (window.location.pathname.includes('dashboard.html')) {
                    console.log('On dashboard, updating from storage event');
                    
                    // Try to get the latest activity
                    try {
                        const recentActivity = JSON.parse(localStorage.getItem('recentActivity') || 'null');
                        if (recentActivity && window.updateActivityDisplay) {
                            window.updateActivityDisplay(recentActivity);
                        } else if (window.loadActivityLog) {
                            window.loadActivityLog();
                        }
                    } catch(err) {
                        console.log('Error processing storage event:', err);
                        if (window.loadActivityLog) {
                            window.loadActivityLog();
                        }
                    }
                    
                    // Also refresh dashboard data if needed
                    if (window.loadDashboard && typeof window.loadDashboard === 'function') {
                        setTimeout(() => {
                            window.loadDashboard(false);
                        }, 1000);
                    }
                }
            }
        });
        
        // Listen for BroadcastChannel messages
        if (typeof BroadcastChannel !== 'undefined') {
            try {
                const channel = new BroadcastChannel('dashboard_activities');
                channel.onmessage = function(event) {
                    console.log('BroadcastChannel message received:', event.data);
                    if (event.data.type === 'activityUpdate' && window.location.pathname.includes('dashboard.html')) {
                        if (window.updateActivityDisplay) {
                            window.updateActivityDisplay(event.data.activity);
                        }
                    }
                };
            } catch(err) {
                console.log('BroadcastChannel setup failed:', err);
            }
        }
        
        // Listen for window.postMessage - FIXED THIS SECTION
        window.addEventListener('message', function(event) {
            // Check origin for security (adjust as needed)
            // if (event.origin !== 'https://your-domain.com') return;
            
            if (event.data && event.data.type === 'activity') {
                console.log('postMessage activity received:', event.data);
                
                // Get allowed actions from window or use default
                const allowedActions = window.ALLOWED_ACTIONS || ALLOWED_ACTIONS;
                
                if (allowedActions.includes(event.data.activity.action) && 
                    window.location.pathname.includes('dashboard.html')) {
                    
                    if (window.recordUserActivity) {
                        window.recordUserActivity(event.data.activity.action, event.data.activity.details);
                    }
                }
            }
        });
    }

    /* Helper function for other pages to record activities */
    function recordActivityFromOtherPage(action, details) {
        console.log(`Recording activity from other page: ${action}`);
        
        // Store in sessionStorage for the dashboard to pick up
        sessionStorage.setItem('pendingActivity', JSON.stringify({
            action: action,
            details: details,
            timestamp: new Date().toISOString()
        }));
        
        // Also update localStorage directly for immediate update if dashboard is open
        try {
            const username = localStorage.getItem('staffName') || localStorage.getItem('username') || 'Unknown User';
            const timestamp = new Date().toISOString();
            
            const activity = {
                action: action,
                actor: username,
                details: details,
                timestamp: timestamp
            };
            
            const activityLog = JSON.parse(localStorage.getItem('activityLog') || '[]');
            activityLog.push(activity);
            
            if (activityLog.length > 20) {
                activityLog.splice(0, activityLog.length - 20);
            }
            
            localStorage.setItem('activityLog', JSON.stringify(activityLog));
            localStorage.setItem('recentActivity', JSON.stringify(activity));
            
            // Trigger update
            localStorage.setItem('activityUpdateTrigger', Date.now().toString());
            
        } catch(err) {
            console.error('Error recording activity from other page:', err);
        }
    }

    /* Initialize activity tracking system */
    function initializeActivityTracking() {
        console.log('Initializing activity tracking system');
        
        // Check if user is logged in
        const isLoggedIn = localStorage.getItem('loggedIn') === 'true';
        if (!isLoggedIn) {
            console.log('User not logged in, skipping activity tracking initialization');
            return;
        }
        
        // Setup cross-tab communication
        setupActivityCommunication();
        
        // Check for pending activities from other pages
        const pendingActivity = sessionStorage.getItem('pendingActivity');
        if (pendingActivity) {
            try {
                const activity = JSON.parse(pendingActivity);
                console.log('Processing pending activity:', activity);
                
                // Get allowed actions from window or use default
                const allowedActions = window.ALLOWED_ACTIONS || ALLOWED_ACTIONS;
                
                if (allowedActions.includes(activity.action)) {
                    recordUserActivity(activity.action, activity.details);
                }
                
                sessionStorage.removeItem('pendingActivity');
            } catch(err) {
                console.error('Error processing pending activity:', err);
                sessionStorage.removeItem('pendingActivity');
            }
        }
        
        // Log page view
        const pageName = document.title || window.location.pathname;
        logActivityToAPIOnly(`Viewed ${pageName}`);
        
        console.log('Activity tracking system initialized');
    }

    /* Make functions available globally */
    window.recordUserActivity = recordUserActivity;
    window.recordActivityFromOtherPage = recordActivityFromOtherPage;
    window.logActivityToAPI = logActivityToAPI;
    window.setupActivityCommunication = setupActivityCommunication;
    window.initializeActivityTracking = initializeActivityTracking;
    
    // Expose ALLOWED_ACTIONS globally (optional - only if other scripts need it)
    window.ALLOWED_ACTIONS = ALLOWED_ACTIONS;

    // Auto-initialize when DOM is loaded
    document.addEventListener('DOMContentLoaded', function() {
        // Small delay to ensure other scripts are loaded
        setTimeout(() => {
            initializeActivityTracking();
        }, 500);
    });

    // Also initialize when page becomes visible
    document.addEventListener('visibilitychange', function() {
        if (!document.hidden) {
            setTimeout(() => {
                initializeActivityTracking();
            }, 100);
        }
    });
})();
