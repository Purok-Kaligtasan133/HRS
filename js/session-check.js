// ============ GLOBAL SESSION CHECK - PREVENT BACK BUTTON AFTER LOGOUT ============

(function() {
    // Check if current page is login page
    const isLoginPage = window.location.pathname.includes('index.html') || 
                        window.location.pathname === '/' || 
                        window.location.pathname.endsWith('/');
    
    // If on login page, no need to check
    if (isLoginPage) return;
    
    // Check session status
    const loggedIn = localStorage.getItem('loggedIn') === 'true';
    const sessionId = localStorage.getItem('sessionId');
    const userId = localStorage.getItem('userId');
    const isGuest = localStorage.getItem('isGuest') === 'true';
    
    // Guest users bypass session check
    if (isGuest) {
        console.log('👤 Guest user - bypassing session check');
        return;
    }
    
    // If not logged in, redirect to login page
    if (!loggedIn || !sessionId || !userId) {
        console.log('Session check failed - Redirecting to login');
        window.location.replace('index.html');
        return;
    }
    
    // ============ SESSION TIMER SYSTEM ==========
    let sessionTimerTimeout = null;
    let sessionWarningTimeout = null;
    let sessionWarningShown = false;
    let sessionExpiredModalShown = false;
    
    // Session duration: 8 hours
    const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;
    // Warning 30 minutes before expiration
    const WARNING_BEFORE_MS = 30 * 60 * 1000;
    
    // Helper to get supabase client
    function getSupabaseClient() {
        let client = window.supabaseClient;
        if (!client && typeof supabaseClient !== 'undefined') {
            client = supabaseClient;
        }
        return client;
    }
    
    // Show warning modal (30 minutes before expiration)
    function showSessionWarningModal() {
        if (sessionWarningShown) return;
        sessionWarningShown = true;
        
        let modal = document.getElementById('sessionWarningModal');
        if (!modal) {
            const modalHTML = `
                <div id="sessionWarningModal" style="position: fixed; inset: 0; background: rgba(0, 0, 0, 0.3); backdrop-filter: blur(2px); display: none; align-items: center; justify-content: center; z-index: 10001; padding: 16px;">
                    <div style="background: white; border-radius: 12px; max-width: 280px; width: 100%; box-shadow: 0 15px 30px rgba(0, 0, 0, 0.1), 0 3px 8px rgba(0, 0, 0, 0.05); animation: modalSlideUp 0.2s ease; overflow: hidden;">
                        <div style="padding: 20px 20px 12px 20px; text-align: center;">
                            <div style="margin-bottom: 8px;">
                                <i class="fas fa-hourglass-half" style="font-size: 1.6rem; color: #ff7a00; opacity: 0.7;"></i>
                            </div>
                            <h3 style="margin: 0 0 4px 0; color: #1e293b; font-size: 1rem; font-weight: 600; letter-spacing: -0.01em;">Session Expiring Soon</h3>
                            <p style="margin: 0 0 8px 0; color: #64748b; font-size: 0.8rem; line-height: 1.4; font-weight: 400;">
                                Your session will end in <strong id="sessionWarningTimer">30 minutes</strong>.
                            </p>
                            <p style="margin: 0; color: #1e293b; font-size: 0.8rem; font-weight: 500;">Click "Extend" to continue working.</p>
                        </div>
                        <div style="display: flex; gap: 8px; padding: 4px 20px 20px 20px;">
                            <button id="sessionWarningDismissBtn" style="flex: 1; padding: 6px 10px; border-radius: 6px; font-weight: 500; font-size: 0.75rem; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 4px; transition: all 0.15s ease; outline: none; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05); letter-spacing: 0.3px; border: 1.5px solid #ef4444; background: transparent; color: #ef4444;">
                                <i class="fas fa-times"></i> Dismiss
                            </button>
                            <button id="sessionWarningExtendBtn" style="flex: 1; padding: 6px 10px; border-radius: 6px; font-weight: 500; font-size: 0.75rem; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 4px; transition: all 0.15s ease; outline: none; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05); letter-spacing: 0.3px; border: 1.5px solid #0f7a4a; background: transparent; color: #0f7a4a;">
                                <i class="fas fa-check"></i> Extend
                            </button>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            modal = document.getElementById('sessionWarningModal');
            
            const extendBtn = document.getElementById('sessionWarningExtendBtn');
            if (extendBtn) {
                extendBtn.onclick = () => {
                    modal.style.display = 'none';
                    resetSessionTimer();
                };
            }
            
            const dismissBtn = document.getElementById('sessionWarningDismissBtn');
            if (dismissBtn) {
                dismissBtn.onclick = () => {
                    modal.style.display = 'none';
                };
            }
            
            modal.onclick = (e) => {
                if (e.target === modal) modal.style.display = 'none';
            };
        }
        
        modal.style.display = 'flex';
        
        let minutesLeft = 30;
        const timerElement = document.getElementById('sessionWarningTimer');
        const countdownInterval = setInterval(() => {
            minutesLeft--;
            if (timerElement) {
                timerElement.textContent = `${minutesLeft} minute${minutesLeft !== 1 ? 's' : ''}`;
            }
            if (minutesLeft <= 0) {
                clearInterval(countdownInterval);
            }
        }, 60000);
    }
    
    // Show session expired modal
    function showSessionExpiredModal() {
        if (sessionExpiredModalShown) return;
        sessionExpiredModalShown = true;
        
        if (sessionTimerTimeout) clearTimeout(sessionTimerTimeout);
        if (sessionWarningTimeout) clearTimeout(sessionWarningTimeout);
        
        let modal = document.getElementById('sessionExpiredModal');
        if (!modal) {
            const modalHTML = `
                <div id="sessionExpiredModal" style="position: fixed; inset: 0; background: rgba(0, 0, 0, 0.3); backdrop-filter: blur(2px); display: none; align-items: center; justify-content: center; z-index: 10002; padding: 16px;">
                    <div style="background: white; border-radius: 12px; max-width: 280px; width: 100%; box-shadow: 0 15px 30px rgba(0, 0, 0, 0.1), 0 3px 8px rgba(0, 0, 0, 0.05); animation: modalSlideUp 0.2s ease; overflow: hidden;">
                        <div style="padding: 20px 20px 12px 20px; text-align: center;">
                            <div style="margin-bottom: 8px;">
                                <i class="fas fa-clock" style="font-size: 1.6rem; color: #dc2626; opacity: 0.7;"></i>
                            </div>
                            <h3 style="margin: 0 0 4px 0; color: #1e293b; font-size: 1rem; font-weight: 600; letter-spacing: -0.01em;">Session Expired</h3>
                            <p style="margin: 0 0 8px 0; color: #64748b; font-size: 0.8rem; line-height: 1.4; font-weight: 400;">
                                Your session has ended for security reasons.
                            </p>
                            <p style="margin: 0; color: #1e293b; font-size: 0.8rem; font-weight: 500;">Please login again to continue.</p>
                        </div>
                        <div style="display: flex; gap: 8px; padding: 4px 20px 20px 20px;">
                            <button id="sessionExpiredLoginBtn" style="flex: 1; padding: 6px 10px; border-radius: 6px; font-weight: 500; font-size: 0.75rem; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 4px; transition: all 0.15s ease; outline: none; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05); letter-spacing: 0.3px; border: 1.5px solid #0f7a4a; background: transparent; color: #0f7a4a;">
                                <i class="fas fa-sign-in-alt"></i> Login Again
                            </button>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            modal = document.getElementById('sessionExpiredModal');
            
            const loginBtn = document.getElementById('sessionExpiredLoginBtn');
            if (loginBtn) {
                loginBtn.onclick = () => {
                    if (window.ForceLogout && window.ForceLogout.terminateSession) {
                        window.ForceLogout.terminateSession().then(() => {
                            localStorage.clear();
                            sessionStorage.clear();
                            window.location.href = 'index.html';
                        });
                    } else {
                        localStorage.clear();
                        sessionStorage.clear();
                        window.location.href = 'index.html';
                    }
                };
            }
            
            modal.onclick = (e) => {
                if (e.target === modal) {
                    if (window.ForceLogout && window.ForceLogout.terminateSession) {
                        window.ForceLogout.terminateSession().then(() => {
                            localStorage.clear();
                            sessionStorage.clear();
                            window.location.href = 'index.html';
                        });
                    } else {
                        localStorage.clear();
                        sessionStorage.clear();
                        window.location.href = 'index.html';
                    }
                }
            };
        }
        
        modal.style.display = 'flex';
        
        // Auto logout after 10 seconds
        setTimeout(() => {
            if (modal.style.display === 'flex') {
                if (window.ForceLogout && window.ForceLogout.terminateSession) {
                    window.ForceLogout.terminateSession().then(() => {
                        localStorage.clear();
                        sessionStorage.clear();
                        window.location.href = 'index.html';
                    });
                } else {
                    localStorage.clear();
                    sessionStorage.clear();
                    window.location.href = 'index.html';
                }
            }
        }, 10000);
    }
    
    // Start the session timer
    function startSessionTimer() {
        if (sessionTimerTimeout) clearTimeout(sessionTimerTimeout);
        if (sessionWarningTimeout) clearTimeout(sessionWarningTimeout);
        sessionWarningShown = false;
        
        const loginTime = parseInt(localStorage.getItem('loginTime'));
        if (!loginTime) {
            // Set initial login time if not exists
            localStorage.setItem('loginTime', Date.now().toString());
            return;
        }
        
        const now = Date.now();
        const elapsed = now - loginTime;
        const timeRemaining = SESSION_DURATION_MS - elapsed;
        
        console.log(`⏰ Time remaining: ${Math.floor(timeRemaining / 60000)} minutes`);
        
        if (timeRemaining <= 0) {
            console.log('⏰ Session already expired');
            showSessionExpiredModal();
            return;
        }
        
        // Show warning 30 minutes before expiration
        if (timeRemaining <= WARNING_BEFORE_MS) {
            console.log('⚠️ Within 30 minutes of expiration, showing warning now');
            setTimeout(() => {
                showSessionWarningModal();
            }, 1000);
        } else {
            const warningDelay = timeRemaining - WARNING_BEFORE_MS;
            console.log(`⏰ Warning will show in ${Math.floor(warningDelay / 60000)} minutes`);
            sessionWarningTimeout = setTimeout(() => {
                showSessionWarningModal();
            }, warningDelay);
        }
        
        // Schedule expiration
        sessionTimerTimeout = setTimeout(() => {
            if (!sessionExpiredModalShown) {
                showSessionExpiredModal();
            }
        }, timeRemaining);
        
        console.log(`⏰ Session expires in ${Math.floor(timeRemaining / 60000)} minutes`);
    }
    
    // Reset session timer on user activity
    function resetSessionTimer() {
        if (sessionExpiredModalShown) return;
        
        localStorage.setItem('loginTime', Date.now().toString());
        
        if (sessionTimerTimeout) clearTimeout(sessionTimerTimeout);
        if (sessionWarningTimeout) clearTimeout(sessionWarningTimeout);
        sessionWarningShown = false;
        
        startSessionTimer();
        console.log('🔄 Session timer reset due to user activity');
    }
    
    // Track user activity
    function trackUserActivity() {
        const events = ['click', 'keypress', 'mousemove', 'scroll', 'touchstart'];
        let activityTimeout = null;
        
        events.forEach(event => {
            document.addEventListener(event, () => {
                if (sessionExpiredModalShown) return;
                if (localStorage.getItem('loggedIn') !== 'true') return;
                if (localStorage.getItem('isGuest') === 'true') return;
                
                if (activityTimeout) clearTimeout(activityTimeout);
                activityTimeout = setTimeout(() => {
                    resetSessionTimer();
                }, 1000);
            });
        });
    }
    
    // Initialize session timer (ONLY timer, no aggressive validation)
    function initSessionTimer() {
        if (loggedIn && !isGuest && !isLoginPage) {
            // Only start timer if loginTime exists, otherwise set it
            if (!localStorage.getItem('loginTime')) {
                localStorage.setItem('loginTime', Date.now().toString());
            }
            startSessionTimer();
            trackUserActivity();
        }
    }
    
    // ============ SIMPLE SESSION VALIDATION (NON-AGGRESSIVE) ==========
    // This only validates on page load, but does NOT auto-redirect aggressively
    async function validateSessionOnce() {
        let client = getSupabaseClient();
        if (!client) return true;
        
        try {
            const { data, error } = await client
                .from('user_sessions')
                .select('is_active')
                .eq('session_id', sessionId)
                .eq('user_id', userId)
                .eq('is_active', true)
                .maybeSingle();
            
            if (error || !data) {
                console.log('⚠️ Session validation: session not active in database');
                // Don't auto-redirect here - let the timer handle it
                return false;
            }
            
            console.log('✅ Session validation passed');
            return true;
        } catch (err) {
            console.error('Session validation error:', err);
            return true;
        }
    }
    
    // ============ EVENT LISTENERS ==========
    window.addEventListener('pageshow', function(event) {
        if (event.persisted) {
            console.log('Page loaded from cache - checking session');
            const stillLoggedIn = localStorage.getItem('loggedIn') === 'true';
            const stillHasSession = localStorage.getItem('sessionId');
            
            if (!stillLoggedIn || !stillHasSession) {
                window.location.replace('index.html');
            }
        }
    });
    
    // Initialize - start timer, but don't aggressively validate
    setTimeout(() => {
        initSessionTimer();
        validateSessionOnce(); // Just log, don't redirect
    }, 500);
    
    console.log('✅ Session check active - User is logged in');

    // ============ PERIODIC SESSION VALIDATION (for Take Over detection) ============
setInterval(async () => {
    const sessionId = localStorage.getItem('sessionId');
    const userId = localStorage.getItem('userId');
    const isGuest = localStorage.getItem('isGuest') === 'true';
    
    // Skip for guest users or if not logged in
    if (isGuest || !sessionId || !userId) return;
    
    try {
        const { data, error } = await supabaseClient
            .from('user_sessions')
            .select('is_active, terminated_reason')
            .eq('session_id', sessionId)
            .eq('user_id', userId)
            .maybeSingle();
        
        // If session is not active in database
        if (error || !data || data.is_active === false) {
            console.log('⚠️ Session no longer active in database! Reason:', data?.terminated_reason);
            
            const terminatedReason = data?.terminated_reason;
            
            // Check if this is admin force logout
            if (terminatedReason === 'admin_force_logout' || terminatedReason === 'admin_force_logout_all') {
                // Show Admin Force Logout modal
                let adminModal = document.getElementById('adminForceLogoutModal');
                const adminCountdownEl = document.getElementById('adminForceLogoutCountdown');
                
                if (adminModal && adminModal.style.display !== 'flex') {
                    adminModal.style.display = 'flex';
                    let countdown = 5;
                    if (adminCountdownEl) adminCountdownEl.textContent = countdown;
                    
                    const countdownInterval = setInterval(() => {
                        countdown--;
                        if (adminCountdownEl) adminCountdownEl.textContent = countdown;
                        if (countdown <= 0) {
                            clearInterval(countdownInterval);
                            localStorage.clear();
                            sessionStorage.clear();
                            document.cookie = "session_id=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
                            window.location.href = 'index.html?adminlogout=true';
                        }
                    }, 1000);
                } else {
                    // Fallback if modal not found
                    setTimeout(() => {
                        localStorage.clear();
                        sessionStorage.clear();
                        document.cookie = "session_id=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
                        window.location.href = 'index.html?adminlogout=true';
                    }, 3000);
                }
            } else {
                // Show regular Session Taken Over modal
                const modal = document.getElementById('sessionTakenOverModal');
                const countdownEl = document.getElementById('takeOverCountdown');
                
                if (modal && modal.style.display !== 'flex') {
                    modal.style.display = 'flex';
                    let countdown = 3;
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
                } else if (!modal) {
                    console.error('sessionTakenOverModal not found in HTML');
                    setTimeout(() => {
                        localStorage.clear();
                        sessionStorage.clear();
                        document.cookie = "session_id=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
                        window.location.href = 'index.html?takeover=true';
                    }, 3000);
                }
            }
        }
    } catch (err) {
        console.error('Session validation error:', err);
    }
}, 15000); // Check every 15 seconds
})();
