// content.js - Runs on web pages
console.log('WebGazer Extension Content Script: Loaded');

// Global data stream object - accessible to other scripts
window.WebGazerDataStream = {
    currentGaze: { x: 0, y: 0 },
    lastGesture: "",
    lastUpdate: null,
    isTracking: false,
    
    // Methods to update the data stream
    updateGaze: function(x, y) {
        this.currentGaze.x = x;
        this.currentGaze.y = y;
        this.lastUpdate = Date.now();
        this.isTracking = true;
        
        // Dispatch custom event for external listeners
        window.dispatchEvent(new CustomEvent('webgazer-gaze-update', {
            detail: { x: x, y: y, timestamp: this.lastUpdate }
        }));
        
        // Make available to page context for debug screen
        window.postMessage({
            source: 'webgazer-data-stream-update',
            type: 'gaze',
            data: { x: x, y: y, timestamp: this.lastUpdate }
        }, '*');
    },
    
    updateGesture: function(gesture) {
        this.lastGesture = gesture;
        this.lastUpdate = Date.now();
        
        // Dispatch custom event for external listeners
        window.dispatchEvent(new CustomEvent('webgazer-gesture-detected', {
            detail: { gesture: gesture, timestamp: this.lastUpdate }
        }));
    },
    
    reset: function() {
        this.currentGaze = { x: 0, y: 0 };
        this.lastGesture = "";
        this.lastUpdate = null;
        this.isTracking = false;
    },
    
    // Get current state as JSON
    toJSON: function() {
        return {
            currentGaze: this.currentGaze,
            lastGesture: this.lastGesture,
            lastUpdate: this.lastUpdate,
            isTracking: this.isTracking
        };
    }
};

console.log('WebGazer Data Stream initialized:', window.WebGazerDataStream);

// Function to inject a script into the page context
function injectScript(file) {
    return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        
        // Set explicit type to handle MIME issues
        s.type = 'text/javascript';
        s.src = chrome.runtime.getURL(file);
        
        s.onload = function() {
            console.log(`Injected ${file} successfully.`);
            this.remove();
            resolve();
        };
        
        s.onerror = function(error) {
            console.error(`Failed to inject ${file}:`, error);
            console.log(`Attempting fallback method for ${file}...`);
            this.remove();
            
            // Fallback: try to fetch and inject as text content
            fetchAndInjectScript(file).then(resolve).catch(reject);
        };
        
        (document.head || document.documentElement).appendChild(s);
    });
}

// CSP-compliant function to check WebGazer availability
function checkWebGazerAvailability() {
    return new Promise((resolve) => {
        // Instead of inline scripts, we'll inject our page script and let it report back
        // This is a safer approach that doesn't violate CSP
        
        // Listen for availability message from page script
        const messageHandler = (event) => {
            if (event.data && event.data.source === 'webgazer-availability-check') {
                window.removeEventListener('message', messageHandler);
                resolve(event.data.available);
            }
        };
        
        window.addEventListener('message', messageHandler);
        
        // Timeout after 2 seconds
        setTimeout(() => {
            window.removeEventListener('message', messageHandler);
            resolve(false); // Assume not available if no response
        }, 2000);
        
        // Send message to page script to check availability
        window.postMessage({
            source: 'content-script-check-webgazer',
            action: 'check-availability'
        }, '*');
    });
}

// Enhanced script injection with better error handling
function injectScript(file) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL(file);
        script.type = 'text/javascript';
        
        script.onload = () => {
            console.log(`Script loaded successfully: ${file}`);
            resolve();
        };
        
        script.onerror = (error) => {
            console.error(`Script loading failed for ${file}:`, error);
            reject(new Error(`Failed to load ${file}`));
        };
        
        // Try multiple injection points
        const target = document.head || document.documentElement || document.body;
        if (target) {
            target.appendChild(script);
        } else {
            reject(new Error('No suitable injection target found'));
        }
    });
}

// Inject WebGazer first, then our bridge script with proper timing
async function initializeScripts() {
    try {
        // Check if we're on a compatible page
        const isCompatiblePage = checkPageCompatibility();
        if (!isCompatiblePage) {
            console.log('Page not compatible for WebGazer injection, skipping...');
            return;
        }
        
        console.log('Injecting WebGazer...');
        await injectScript('src/webgazer.js');
        console.log('WebGazer injected, waiting for it to load...');
        
        // Also inject face landmarker before page script
        console.log('Injecting Face Landmarker...');
        try {
            await injectScript('src/face_landmarker.js');
            console.log('Face Landmarker injected successfully');
            
            // Wait a moment for the script to execute and set up globals
            await new Promise(resolve => setTimeout(resolve, 200));
            
        } catch (error) {
            console.error('Face Landmarker injection failed:', error);
            console.log('Error details:', error.message, error.stack);
            // Continue without face landmarker - page script will handle fallback
        }
        
        // Wait longer and check if WebGazer is available
        let retries = 0;
        const maxRetries = 15; // Increased retries for slower sites
        
        while (retries < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 500));
            
            retries++;
            console.log(`Waiting for WebGazer... (${retries}/${maxRetries})`);
            
            // Simple time-based wait - let page script handle WebGazer detection
            if (retries >= 3) { // After 3 retries (1.5 seconds), assume ready
                console.log('Proceeding to inject page script...');
                break;
            }
        }
        
        console.log('Injecting page script...');
        await injectScript('src/page_script.js');
        console.log('All scripts injected successfully');
    } catch (error) {
        console.error('Failed to inject scripts:', error);
        showInjectionError(`Script injection failed: ${error.message}`);
    }
}

// Check if the current page is compatible with WebGazer
function checkPageCompatibility() {
    const url = window.location.href;
    const hostname = window.location.hostname;
    
    // Skip problematic sites
    const incompatibleSites = [
        'chrome://',
        'chrome-extension://',
        'moz-extension://',
        'about:',
        'data:',
        'javascript:',
        'file://'
    ];
    
    for (const site of incompatibleSites) {
        if (url.startsWith(site)) {
            return false;
        }
    }
    
    // Check for CSP or other restrictive headers
    const metaTags = document.querySelectorAll('meta[http-equiv="Content-Security-Policy"]');
    for (const meta of metaTags) {
        const csp = meta.getAttribute('content');
        if (csp && csp.includes("script-src 'none'")) {
            console.warn('Strict CSP detected, WebGazer may not work');
        }
    }
    
    return true;
}

// Show injection error to user
function showInjectionError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.style.position = 'fixed';
    errorDiv.style.top = '10px';
    errorDiv.style.right = '10px';
    errorDiv.style.zIndex = '99999';
    errorDiv.style.padding = '15px';
    errorDiv.style.backgroundColor = 'rgba(255,0,0,0.9)';
    errorDiv.style.color = 'white';
    errorDiv.style.borderRadius = '5px';
    errorDiv.style.fontFamily = 'Arial, sans-serif';
    errorDiv.style.fontSize = '12px';
    errorDiv.style.maxWidth = '300px';
    errorDiv.style.boxShadow = '0 2px 10px rgba(0,0,0,0.3)';
    
    // Create content without innerHTML to avoid CSP violations
    const titleDiv = document.createElement('div');
    titleDiv.style.fontWeight = 'bold';
    titleDiv.style.marginBottom = '5px';
    titleDiv.textContent = '⚠️ WebGazer Error';
    
    const messageDiv = document.createElement('div');
    messageDiv.textContent = message;
    
    const helpDiv = document.createElement('div');
    helpDiv.style.marginTop = '10px';
    helpDiv.style.fontSize = '10px';
    helpDiv.style.opacity = '0.8';
    helpDiv.textContent = 'Try refreshing the page or use a different website';
    
    errorDiv.appendChild(titleDiv);
    errorDiv.appendChild(messageDiv);
    errorDiv.appendChild(helpDiv);
    
    document.body.appendChild(errorDiv);
    
    // Auto-remove after 8 seconds
    setTimeout(() => {
        if (errorDiv.parentNode) {
            errorDiv.parentNode.removeChild(errorDiv);
        }
    }, 8000);
}

// Start script injection
initializeScripts();

// Listen for gaze data from page context
window.addEventListener('message', (event) => {
    if (event.source === window && event.data) {
        if (event.data.source === 'webgazer-gaze-data') {
            // Update global data stream with gaze coordinates
            const { x, y } = event.data;
            window.WebGazerDataStream.updateGaze(x, y);
            
            // Optional: Log for debugging (reduced frequency)
            // console.log('Gaze data received and updated in data stream');
        } else if (event.data.source === 'webgazer-prediction-response') {
            // Forward prediction response back to popup
            // This will be handled by the popup's message listener
            console.log('Prediction response received:', event.data.prediction);
        } else if (event.data.source === 'webgazer-calibration-complete') {
            // Forward calibration completion to popup
            chrome.runtime.sendMessage({action: 'calibrationComplete'});
            console.log('Calibration completed - notified popup');
        } else if (event.data.source === 'face-trigger') {
            // Update global data stream with detected gesture
            const { type } = event.data;
            window.WebGazerDataStream.updateGesture(type);
            console.log(`Face trigger detected and updated in data stream: ${type}`);
        }
    }
});

// Listen for messages from popup and forward to page context
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Content script forwarding message to page context:', request.action);
    
    // Handle special actions that affect the data stream
    if (request.action === 'stop') {
        window.WebGazerDataStream.reset();
        console.log('Data stream reset on stop');
    }
    
    // Forward to page_script.js via window.postMessage
    window.postMessage({
        source: 'webgazer-extension-content',
        action: request.action,
        value: request.value
    }, '*');

    // Always send a response to prevent timeout
    sendResponse({ status: 'forwarded', action: request.action });
    return true; 
});
