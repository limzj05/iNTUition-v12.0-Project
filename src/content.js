// content.js - Runs on web pages
console.log('WebGazer Extension Content Script: Loaded');

// Function to inject a script into the page context
function injectScript(file) {
    return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = chrome.runtime.getURL(file);
        s.onload = function() {
            console.log(`Injected ${file} successfully.`);
            this.remove();
            resolve();
        };
        s.onerror = function() {
            console.error(`Failed to inject ${file}`);
            this.remove();
            reject();
        };
        (document.head || document.documentElement).appendChild(s);
    });
}

// Inject WebGazer first, then our bridge script with proper timing
async function initializeScripts() {
    try {
        console.log('Injecting WebGazer...');
        await injectScript('webgazer.js');
        console.log('WebGazer injected, waiting before injecting page script...');
        
        // Wait a bit longer to ensure WebGazer is fully loaded
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        console.log('Injecting page script...');
        await injectScript('page_script.js');
        console.log('All scripts injected successfully');
    } catch (error) {
        console.error('Failed to inject scripts:', error);
    }
}

// Start script injection
initializeScripts();

// Listen for gaze data from page context
window.addEventListener('message', (event) => {
    if (event.source === window && event.data) {
        if (event.data.source === 'webgazer-gaze-data') {
            // Handle continuous gaze data stream
            // You can process or forward this data as needed
            // console.log('Gaze data received:', event.data);
        } else if (event.data.source === 'webgazer-prediction-response') {
            // Forward prediction response back to popup
            // This will be handled by the popup's message listener
            console.log('Prediction response received:', event.data.prediction);
        } else if (event.data.source === 'webgazer-calibration-complete') {
            // Forward calibration completion to popup
            chrome.runtime.sendMessage({action: 'calibrationComplete'});
            console.log('Calibration completed - notified popup');
        }
    }
});

// Listen for messages from popup and forward to page context
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Content script forwarding message to page context:', request.action);
    
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
