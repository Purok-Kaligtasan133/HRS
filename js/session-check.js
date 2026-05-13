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
    
    // ✅ ENHANCED: Function to validate session with server
    async function validateSessionWithServer() {
        // Try to get supabase client from various possible locations
        let client = window.supabaseClient;
        
        if (!client && typeof supabaseClient !== 'undefined') {
            client = supabaseClient;
        }
        
        if (!client) {
            console.log('Supabase client not available yet - skipping validation');
            return true;
        }
        
        try {
            const { data, error } = await client
                .from('user_sessions')
                .select('is_active, session_id')
                .eq('session_id', sessionId)
                .eq('user_id', userId)
                .eq('is_active', true)
                .maybeSingle();
            
            if (error || !data) {
                console.log('❌ Server session validation failed - session not active');
                localStorage.clear();
                sessionStorage.clear();
                window.location.replace('index.html?session=expired');
                return false;
            }
            
            console.log('✅ Server session validation passed');
            return true;
        } catch (err) {
            console.error('Session validation error:', err);
            // Don't redirect on network error, let it try again later
            return true;
        }
    }
    
    // Prevent back button cache - Force reload from server
    window.addEventListener('pageshow', function(event) {
        if (event.persisted) {
            // Page was loaded from cache (back button was pressed)
            console.log('Page loaded from cache - checking session');
            
            const stillLoggedIn = localStorage.getItem('loggedIn') === 'true';
            const stillHasSession = localStorage.getItem('sessionId');
            
            if (!stillLoggedIn || !stillHasSession) {
                window.location.replace('index.html');
            } else {
                // Validate with server on cache load
                validateSessionWithServer();
            }
        }
    });
    
    // ✅ Run server validation on page load (after a short delay to ensure Supabase is ready)
    setTimeout(() => {
        validateSessionWithServer();
    }, 500);
    
    // ✅ Also validate every 60 seconds to catch sessions terminated by other devices
    setInterval(() => {
        if (localStorage.getItem('loggedIn') === 'true' && !localStorage.getItem('isGuest')) {
            validateSessionWithServer();
        }
    }, 60000);
    
    console.log('✅ Session check active - User is logged in');
})();
