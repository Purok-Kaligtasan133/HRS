// ============ SECURITY - HIDE CONSOLE LOGS IN PRODUCTION ============
(function() {
    // Check if we're in production (not localhost)
    const isProduction = window.location.hostname !== 'localhost' && 
                         !window.location.hostname.includes('127.0.0.1') &&
                         !window.location.hostname.includes('192.168.') &&
                         !window.location.hostname.includes('.test');
    
    if (isProduction) {
        // Store original console methods
        const noop = function() {};
        
        // Override console methods with empty functions
        console.log = noop;
        console.debug = noop;
        console.info = noop;
        console.warn = noop;
        console.table = noop;
        console.trace = noop;
        console.group = noop;
        console.groupCollapsed = noop;
        console.groupEnd = noop;
        
        // Keep error logs for debugging (optional - can also disable)
        // console.error is kept by default to catch real errors
        
        console.log('🔒 Console logs disabled for security (production mode)');
    } else {
        console.log('🔓 Console logs enabled (development mode)');
    }
})();