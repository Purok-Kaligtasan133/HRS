// data-broadcaster.js
// Centralized real-time data change notification system
(function() {
    'use strict';
    
    const DATA_BROADCASTER_VERSION = '1.0.0';
    const BROADCAST_ALLOWED_ACTIONS = ['Update Household', 'Create Record', 'Delete Household', 'Force Refresh'];
    
    class DataBroadcaster {
        constructor() {
            this.channel = null;
            this.listeners = new Set();
            this.initialize();
        }
        
        initialize() {
            // Initialize BroadcastChannel if supported
            if (typeof BroadcastChannel !== 'undefined') {
                this.channel = new BroadcastChannel('purok_data_updates');
                this.setupChannelListeners();
            }
            
            console.log(`📡 DataBroadcaster v${DATA_BROADCASTER_VERSION} initialized`);
            
            // Also listen to localStorage events for older browsers
            window.addEventListener('storage', (event) => {
                if (event.key === 'purok_data_update') {
                    try {
                        const data = JSON.parse(event.newValue);
                        this.handleMessage(data);
                    } catch (e) {
                        console.error('Error parsing storage event:', e);
                    }
                }
            });
        }
        
        setupChannelListeners() {
            if (this.channel) {
                this.channel.addEventListener('message', (event) => {
                    this.handleMessage(event.data);
                });
            }
        }
        
        handleMessage(data) {
            if (data.type === 'DATA_CHANGED' && BROADCAST_ALLOWED_ACTIONS.includes(data.action)) {
                console.log('📢 Data change broadcast received:', data);
                
                // Notify all registered listeners
                this.listeners.forEach(listener => {
                    try {
                        listener(data);
                    } catch (error) {
                        console.error('Error in listener:', error);
                    }
                });
                
                // Trigger custom event for DOM listeners
                const event = new CustomEvent('purokDataChanged', { detail: data });
                window.dispatchEvent(event);
            }
        }
        
        // Broadcast a data change to all tabs/pages
        broadcastChange(action, details = '', metadata = {}) {
            if (!BROADCAST_ALLOWED_ACTIONS.includes(action)) {
                console.warn(`Action "${action}" not in allowed list`);
                return;
            }
            
            const broadcastData = {
                type: 'DATA_CHANGED',
                action: action,
                details: details,
                actor: localStorage.getItem('staffName') || localStorage.getItem('username') || 'Unknown',
                timestamp: new Date().toISOString(),
                page: window.location.pathname.split('/').pop(),
                ...metadata
            };
            
            console.log('📢 Broadcasting data change:', broadcastData);
            
            // Method 1: BroadcastChannel (modern browsers)
            if (this.channel) {
                this.channel.postMessage(broadcastData);
            }
            
            // Method 2: localStorage (works in all browsers, across tabs)
            localStorage.setItem('purok_data_update', JSON.stringify(broadcastData));
            
            // Method 3: Trigger storage event manually (for same-tab listeners)
            setTimeout(() => {
                localStorage.removeItem('purok_data_update');
            }, 100);
            
            // Method 4: Log to server
            this.logToServer(broadcastData);
            
            // Method 5: Store in activity log
            this.storeActivity(broadcastData);
        }
        
        logToServer(data) {
            // Log activity to Google Sheets
            const formData = new FormData();
            formData.append("action", "logActivity");
            formData.append("username", data.actor);
            formData.append("action", data.action);
            formData.append("details", data.details);
            formData.append("page", data.page);
            formData.append("timestamp", data.timestamp);
            
            // Fire and forget - don't wait for response
            fetch("https://script.google.com/macros/s/AKfycbxdAGmjmDECdLxCsXCvnnnLktsGXLpUKrrM7t_ZZ9aEwiJ_mB0k-CVF57khbAqU2hlX2w/exec", {
                method: "POST",
                body: formData
            }).catch(() => { /* ignore errors */ });
        }
        
        storeActivity(data) {
            // Store in localStorage for activity log
            const activities = JSON.parse(localStorage.getItem('purok_activities') || '[]');
            activities.unshift(data);
            if (activities.length > 50) activities.length = 50;
            localStorage.setItem('purok_activities', JSON.stringify(activities));
            
            // Also store as latest activity
            localStorage.setItem('purok_last_activity', JSON.stringify(data));
        }
        
        // Register a callback for data changes
        onDataChange(callback) {
            this.listeners.add(callback);
            return () => this.listeners.delete(callback);
        }
        
        // Get latest activity
        getLatestActivity() {
            try {
                const last = localStorage.getItem('purok_last_activity');
                return last ? JSON.parse(last) : null;
            } catch (e) {
                return null;
            }
        }
        
        // Get recent activities
        getRecentActivities(limit = 10) {
            try {
                const activities = JSON.parse(localStorage.getItem('purok_activities') || '[]');
                return activities.slice(0, limit);
            } catch (e) {
                return [];
            }
        }
        
        // Clear cache and force refresh
        forceRefresh() {
            console.log('🔄 Forcing data refresh');
            localStorage.removeItem('dashboardDataCache');
            this.broadcastChange('Force Refresh', 'Manual refresh triggered');
        }
        
        // Cleanup
        destroy() {
            if (this.channel) {
                this.channel.close();
            }
            this.listeners.clear();
        }
    }
    
    // Create global instance
    window.PurokDataBroadcaster = new DataBroadcaster();
})();
