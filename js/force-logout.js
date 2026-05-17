// ============ FORCE LOGOUT - DEVICE A SIDE ============
if (!window._forceLogoutInstance) {
    window._forceLogoutInstance = true;
    
    const SUPABASE_URL = 'https://opibntxwagnjazpbtxrv.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_UwyTZU3BYj41z0D7beu9Hg_pIZcLeWN';
    let supabaseClient = null;
    let realtimeChannel = null;
    let heartbeatInterval = null;
    let currentRequestId = null;
    let modalTimer = null;
    let takeOverNotificationShown = false;
    let adminForceLogoutShown = false;
    
    async function init() {
        if (window._supabaseInitialized) return;
        window._supabaseInitialized = true;
        
        // SKIP for guest users
        const isGuest = localStorage.getItem('isGuest') === 'true';
        if (isGuest) {
            console.log('👤 Guest user detected - Force logout disabled');
            return;
        }
        
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
        });
        
        const sessionId = localStorage.getItem('sessionId');
        const loggedIn = localStorage.getItem('loggedIn') === 'true';
        
        if (sessionId && loggedIn) {
            console.log('✅ Force logout initialized - Starting heartbeat and listener');
            startHeartbeat();
            startListening();
        } else {
            console.log('⚠️ No valid session found - Force logout not started');
        }
    }
    
    function startHeartbeat() {
        if (heartbeatInterval) clearInterval(heartbeatInterval);
        heartbeatInterval = setInterval(async () => {
            const sessionId = localStorage.getItem('sessionId');
            const username = localStorage.getItem('username');
            const now = new Date().toISOString();
            
            if (sessionId && supabaseClient && localStorage.getItem('loggedIn') === 'true') {
                try {
                    // Update user_sessions table
                    await supabaseClient
                        .from('user_sessions')
                        .update({ last_activity: now })
                        .eq('session_id', sessionId);
                    
                    // ✅ ALSO update users table for online status
                    if (username) {
                        await supabaseClient
                            .from('users')
                            .update({ 
                                last_activity: now,
                                last_login: now
                            })
                            .eq('username', username);
                    }
                    
                    console.log('💓 Heartbeat sent at:', new Date().toLocaleTimeString());
                } catch (err) {
                    console.error('Heartbeat error:', err);
                }
            }
        }, 10000);
    }

function showAdminForceLogoutModal() {
    if (adminForceLogoutShown) return;
    adminForceLogoutShown = true;
    
    console.log('🚨 SHOWING ADMIN FORCE LOGOUT MODAL');
    
    let modal = document.getElementById('adminForceLogoutModal');
    
    if (!modal) {
        const modalHTML = `
            <div id="adminForceLogoutModal" style="position: fixed; inset: 0; background: rgba(0, 0, 0, 0.3); backdrop-filter: blur(2px); display: flex; align-items: center; justify-content: center; z-index: 10004; padding: 16px;">
                <div style="background: white; border-radius: 12px; max-width: 280px; width: 100%; box-shadow: 0 15px 30px rgba(0, 0, 0, 0.1); animation: modalSlideUp 0.2s ease; overflow: hidden;">
                    <div style="padding: 20px 20px 12px 20px; text-align: center;">
                        <div style="margin-bottom: 8px;">
                            <i class="fas fa-user-shield" style="font-size: 1.6rem; color: #ff7a00; opacity: 0.7;"></i>
                        </div>
                        <h3 style="margin: 0 0 4px 0; color: #1e293b; font-size: 1rem; font-weight: 600;">Account Logged Out by Admin</h3>
                        <p style="margin: 0 0 8px 0; color: #64748b; font-size: 0.8rem; line-height: 1.4;">
                            An administrator has logged you out from all devices.
                        </p>
                        <div style="margin-top: 12px; background: #fff8e1; padding: 8px; border-radius: 8px;">
                            <div style="font-size: 0.7rem; color: #ff7a00; font-weight: 500;">You will be redirected to login</div>
                            <div style="font-size: 1.5rem; font-weight: 700; color: #ff7a00;" id="adminForceLogoutCountdown">5</div>
                            <div style="font-size: 0.7rem; color: var(--text-light);">seconds</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        modal = document.getElementById('adminForceLogoutModal');
    }
    
    const countdownEl = document.getElementById('adminForceLogoutCountdown');
    
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
    }
    
    modal.style.display = 'flex';
    let countdown = 5;
    if (countdownEl) countdownEl.textContent = countdown;
    
    const countdownInterval = setInterval(() => {
        countdown--;
        if (countdownEl) countdownEl.textContent = countdown;
        if (countdown <= 0) {
            clearInterval(countdownInterval);
            localStorage.clear();
            sessionStorage.clear();
            document.cookie = "session_id=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
            window.location.href = 'index.html?adminlogout=true';
        }
    }, 1000);
}

function showTakeOverNotification(terminatedReason) {
    if (terminatedReason === 'admin_force_logout' || terminatedReason === 'admin_force_logout_all') {
        showAdminForceLogoutModal();
        return;
    }
    
    if (takeOverNotificationShown) return;
    takeOverNotificationShown = true;
    
    console.log('🚨 SHOWING TAKE OVER MODAL');
    
    const modal = document.getElementById('sessionTakenOverModal');
    const countdownEl = document.getElementById('takeOverCountdown');
    
    if (!modal) {
        console.error('Modal not found!');
        return;
    }
    
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
    }
    
    modal.style.display = 'flex';
    let countdown = 5;
    if (countdownEl) countdownEl.textContent = countdown;
    
    const countdownInterval = setInterval(() => {
        countdown--;
        if (countdownEl) countdownEl.textContent = countdown;
        if (countdown <= 0) {
            clearInterval(countdownInterval);
            localStorage.clear();
            sessionStorage.clear();
            document.cookie = "session_id=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
            window.location.href = 'index.html?takeover=true';
        }
    }, 1000);
}
    
function startListening(retryCount = 0) {
    const sessionId = localStorage.getItem('sessionId');
    const userId = localStorage.getItem('userId');
    
    if (!sessionId || !userId) {
        console.log('⚠️ Cannot start listening: missing sessionId or userId');
        return;
    }
    
    if (!supabaseClient) {
        console.log('⚠️ Supabase client not ready, retrying in 1 second...');
        if (retryCount < 10) {
            setTimeout(() => startListening(retryCount + 1), 1000);
        }
        return;
    }
    
    console.log('🎧 Starting realtime listener for session:', sessionId);
    
    if (realtimeChannel) {
        try { supabaseClient.removeChannel(realtimeChannel); } catch(e) {}
    }
    
    const channelName = `force_listener_${sessionId}`;
    
    realtimeChannel = supabaseClient
        .channel(channelName)
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'force_logout_requests'
        }, (payload) => {
            console.log('🔥🔥🔥 FORCE LOGOUT REQUEST RECEIVED! 🔥🔥🔥');
            console.log('Target session:', payload.new.target_session_id);
            console.log('My session:', sessionId);
            
            if (payload.new.target_session_id === sessionId && payload.new.status === 'pending' && !currentRequestId) {
                console.log('✅✅✅ MATCH! Showing force logout modal! ✅✅✅');
                currentRequestId = payload.new.id;
                showModal();
            }
        })
        .subscribe((status) => {
            console.log('📡 Realtime status for', channelName, ':', status);
            if (status === 'SUBSCRIBED') {
                console.log('✅ Successfully subscribed to force_logout_requests!');
            }
        });
}
    
    function showModal() {
        // First try to find existing modal
        let modal = document.getElementById('forceLogoutModal');
        
        // If modal doesn't exist, create it with the original styling
        if (!modal) {
            const modalHTML = `
                <div id="forceLogoutModal" style="position: fixed; inset: 0; background: rgba(0, 0, 0, 0.3); backdrop-filter: blur(2px); display: none; align-items: center; justify-content: center; z-index: 10000; padding: 16px;">
                    <div style="background: white; border-radius: 12px; max-width: 280px; width: 100%; box-shadow: 0 15px 30px rgba(0, 0, 0, 0.1), 0 3px 8px rgba(0, 0, 0, 0.05); animation: modalSlideUp 0.2s ease; overflow: hidden;">
                        <div style="padding: 20px 20px 12px 20px; text-align: center;">
                            <div style="margin-bottom: 8px;">
                                <i class="fas fa-exclamation-triangle" style="font-size: 1.6rem; color: #ff7a00; opacity: 0.7;"></i>
                            </div>
                            <h3 style="margin: 0 0 4px 0; color: #1e293b; font-size: 1rem; font-weight: 600; letter-spacing: -0.01em;">Force Logout Request</h3>
                            <p style="margin: 0 0 8px 0; color: #64748b; font-size: 0.8rem; line-height: 1.4; font-weight: 400;">Someone is trying to log in to your account from another device.</p>
                            <p style="margin: 0; color: #1e293b; font-size: 0.8rem; font-weight: 500;">Do you want to allow force logout?</p>
                            <div style="margin-top: 8px; font-size: 0.7rem; color: #ff7a00;" id="requestTimer">This request will expire in 30 seconds</div>
                        </div>
                        <div style="display: flex; gap: 8px; padding: 4px 20px 20px 20px;">
                            <button id="denyForceLogoutBtn" style="flex: 1; padding: 6px 10px; border-radius: 6px; font-weight: 500; font-size: 0.75rem; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 4px; transition: all 0.15s ease; outline: none; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05); letter-spacing: 0.3px; border: 1.5px solid #ef4444; background: transparent; color: #ef4444;">
                                <i class="fas fa-times"></i> Deny
                            </button>
                            <button id="allowForceLogoutBtn" style="flex: 1; padding: 6px 10px; border-radius: 6px; font-weight: 500; font-size: 0.75rem; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 4px; transition: all 0.15s ease; outline: none; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05); letter-spacing: 0.3px; border: 1.5px solid #0f7a4a; background: transparent; color: #0f7a4a;">
                                <i class="fas fa-check"></i> Allow
                            </button>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            modal = document.getElementById('forceLogoutModal');
        }
        
        const allowBtn = document.getElementById('allowForceLogoutBtn');
        const denyBtn = document.getElementById('denyForceLogoutBtn');
        const timerEl = document.getElementById('requestTimer');
        
        // Remove old listeners to prevent duplicates
        const newAllowBtn = allowBtn.cloneNode(true);
        const newDenyBtn = denyBtn.cloneNode(true);
        if (allowBtn) allowBtn.parentNode.replaceChild(newAllowBtn, allowBtn);
        if (denyBtn) denyBtn.parentNode.replaceChild(newDenyBtn, denyBtn);
        
        const handleAllow = () => respond('allow');
        const handleDeny = () => respond('deny');
        
        newAllowBtn.onclick = handleAllow;
        newDenyBtn.onclick = handleDeny;
        
        modal.style.display = 'flex';
        
        let timeLeft = 30;
        if (modalTimer) clearInterval(modalTimer);
        modalTimer = setInterval(() => {
            timeLeft--;
            if (timerEl) timerEl.textContent = `This request will expire in ${timeLeft} seconds`;
            if (timeLeft <= 0) {
                clearInterval(modalTimer);
                modal.style.display = 'none';
                respond('deny');
            }
        }, 1000);
    }
    
    async function respond(response) {
        if (!currentRequestId) return;
        
        try {
            await supabaseClient
                .from('force_logout_requests')
                .update({ 
                    status: response === 'allow' ? 'approved' : 'denied', 
                    responded_at: new Date().toISOString() 
                })
                .eq('id', currentRequestId);
            
            const modal = document.getElementById('forceLogoutModal');
            if (modal) modal.style.display = 'none';
            if (modalTimer) clearInterval(modalTimer);
            
            if (response === 'allow') {
                const sessionId = localStorage.getItem('sessionId');
                const userId = localStorage.getItem('userId');
                
                // Deactivate the current session
                await supabaseClient
                    .from('user_sessions')
                    .update({ is_active: false, terminated_at: new Date().toISOString() })
                    .eq('session_id', sessionId);
                
                // Also mark any other active sessions for this user as inactive
                await supabaseClient
                    .from('user_sessions')
                    .update({ is_active: false, terminated_at: new Date().toISOString() })
                    .eq('user_id', userId)
                    .eq('is_active', true);
                
                if (heartbeatInterval) clearInterval(heartbeatInterval);
                if (realtimeChannel) supabaseClient.removeChannel(realtimeChannel);
                localStorage.clear();
                sessionStorage.clear();
                
                // ✅ DELETE COOKIE HERE
                document.cookie = "session_id=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
                
                window.location.href = 'index.html';
            }
        } catch (err) {
            console.error('Error responding to force logout:', err);
        }
        
        currentRequestId = null;
    }
    
    // terminateSession function for manual logout
    async function terminateSession() {
        console.log('🔄 Manual session termination requested');
        const sessionId = localStorage.getItem('sessionId');
        
        if (sessionId && supabaseClient) {
            try {
                const { error } = await supabaseClient
                    .from('user_sessions')
                    .update({ 
                        is_active: false, 
                        terminated_at: new Date().toISOString() 
                    })
                    .eq('session_id', sessionId);
                
                if (error) {
                    console.error('Failed to terminate session:', error);
                } else {
                    console.log('✅ Session terminated successfully');
                }
            } catch (err) {
                console.error('Termination error:', err);
            }
        }
        
        if (heartbeatInterval) clearInterval(heartbeatInterval);
        if (realtimeChannel && supabaseClient) {
            supabaseClient.removeChannel(realtimeChannel);
        }
    }
    
    // Clean up on page unload (only for manual logout, not refresh)
    let isManualLogout = false;
    
    window.addEventListener('beforeunload', async function() {
        // Only cleanup if user is actually logging out, not just refreshing
        if (isManualLogout && supabaseClient) {
            const sessionId = localStorage.getItem('sessionId');
            if (sessionId) {
                try {
                    await supabaseClient
                        .from('user_sessions')
                        .update({ 
                            is_active: false, 
                            terminated_at: new Date().toISOString() 
                        })
                        .eq('session_id', sessionId);
                    console.log('Session cleaned up on manual logout');
                } catch(err) {}
            }
        }
        
        if (heartbeatInterval) clearInterval(heartbeatInterval);
        if (realtimeChannel && supabaseClient) {
            supabaseClient.removeChannel(realtimeChannel);
        }
    });
    
    // ============ GLOBAL LOGOUT FUNCTION FOR SESSION TIMER ==========
    window.performLogout = async function() {
        console.log('🔄 Global logout called');
        const sessionId = localStorage.getItem('sessionId');
        
        if (sessionId && supabaseClient) {
            try {
                await supabaseClient
                    .from('user_sessions')
                    .update({ is_active: false, terminated_at: new Date().toISOString() })
                    .eq('session_id', sessionId);
                console.log('✅ Session deactivated from global logout');
            } catch (err) {
                console.error('Logout error:', err);
            }
        }
        
        localStorage.clear();
        sessionStorage.clear();
        
        // ✅ DELETE COOKIE HERE
        document.cookie = "session_id=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
        
        window.location.href = 'index.html';
    };
    
    // Expose functions globally
    window.ForceLogout = { 
        init: init,
        terminateSession: terminateSession,
        setManualLogout: function(val) { isManualLogout = val; }
    };
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}
