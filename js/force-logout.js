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
            if (sessionId && supabaseClient && localStorage.getItem('loggedIn') === 'true') {
                try {
                    await supabaseClient
                        .from('user_sessions')
                        .update({ last_activity: new Date().toISOString() })
                        .eq('session_id', sessionId);
                    console.log('💓 Heartbeat sent');
                } catch (err) {}
            }
        }, 10000);
    }
    
    function startListening() {
        const userId = localStorage.getItem('userId');
        const sessionId = localStorage.getItem('sessionId');
        if (!userId || !sessionId) return;
        
        if (realtimeChannel) {
            supabaseClient.removeChannel(realtimeChannel);
        }
        
        realtimeChannel = supabaseClient
            .channel(`force_logout_${userId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'force_logout_requests',
                filter: `user_id=eq.${userId}`
            }, async (payload) => {
                const request = payload.new;
                console.log('🔥 Force logout request received!', request);
                
                if (request.target_session_id === sessionId && request.status === 'pending' && !currentRequestId) {
                    currentRequestId = request.id;
                    showModal();
                }
            })
            .subscribe((status) => {
                console.log('📡 Realtime subscription status:', status);
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
                await supabaseClient
                    .from('user_sessions')
                    .update({ is_active: false, terminated_at: new Date().toISOString() })
                    .eq('session_id', sessionId);
                
                if (heartbeatInterval) clearInterval(heartbeatInterval);
                if (realtimeChannel) supabaseClient.removeChannel(realtimeChannel);
                localStorage.clear();
                sessionStorage.clear();
                window.location.href = 'index.html';
            }
        } catch (err) {
            console.error('Error responding to force logout:', err);
        }
        
        currentRequestId = null;
    }
    
    // Clean up on page unload
    window.addEventListener('beforeunload', function() {
        if (heartbeatInterval) clearInterval(heartbeatInterval);
        if (realtimeChannel && supabaseClient) {
            supabaseClient.removeChannel(realtimeChannel);
        }
    });
    
    window.ForceLogout = { init: init };
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}