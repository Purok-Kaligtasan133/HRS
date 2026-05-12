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
    
    // If not logged in, redirect to login page
    if (!loggedIn || !sessionId || !userId) {
        console.log('Session check failed - Redirecting to login');
        window.location.replace('index.html');
        return;
    }
    
    // Function to validate session with server (optional but more secure)
    async function validateSessionWithServer() {
        if (!window.supabaseClient) return true;
        
        try {
            const { data, error } = await window.supabaseClient
                .from('user_sessions')
                .select('is_active')
                .eq('session_id', sessionId)
                .eq('is_active', true)
                .maybeSingle();
            
            if (error || !data) {
                console.log('Server session validation failed');
                localStorage.clear();
                sessionStorage.clear();
                window.location.replace('index.html');
                return false;
            }
            return true;
        } catch (err) {
            console.error('Session validation error:', err);
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
                // Optional: Force reload to get fresh page
                window.location.reload();
            }
        }
    });
    
    // Optional: Validate with server (uncomment if you want server-side validation)
    // validateSessionWithServer();
    
    console.log('✅ Session check active - User is logged in');
})();