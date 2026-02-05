// Refactored popup.js to ensure WebGazer.js runs properly as part of the extension

document.addEventListener('DOMContentLoaded', function() {
    const startButton = document.getElementById('startButton');
    const stopButton = document.getElementById('stopButton');
    const calibrateButton = document.getElementById('calibrateButton');
    const showVideoCheck = document.getElementById('showVideoCheck');
    const showPointsCheck = document.getElementById('showPointsCheck');
    const gazeListenerCheck = document.getElementById('gazeListenerCheck');
    const getPredictionButton = document.getElementById('getPredictionButton');
    const predictionDisplay = document.getElementById('predictionDisplay');
    
    let isStarted = false;
    let isCalibrating = false;
    let extensionStatus = 'stopped'; // 'stopped', 'starting', 'active', 'calibrating'
    
    // Update UI based on current state
    function updateUIState() {
        switch(extensionStatus) {
            case 'stopped':
                startButton.disabled = false;
                startButton.innerText = 'Start Tracking';
                startButton.style.backgroundColor = '';
                calibrateButton.disabled = true;
                calibrateButton.innerText = 'Calibrate (Start Tracking First)';
                stopButton.disabled = true;
                break;
                
            case 'starting':
                startButton.disabled = true;
                startButton.innerText = 'Initializing...';
                startButton.style.backgroundColor = '#ffa500';
                calibrateButton.disabled = true;
                calibrateButton.innerText = 'Calibrate (Initializing...)';
                stopButton.disabled = false;
                break;
                
            case 'active':
                startButton.disabled = true;
                startButton.innerText = '✓ Tracking Active';
                startButton.style.backgroundColor = '#28a745';
                calibrateButton.disabled = false;
                calibrateButton.innerText = 'Calibrate';
                calibrateButton.style.backgroundColor = '';
                stopButton.disabled = false;
                break;
                
            case 'calibrating':
                startButton.disabled = true;
                startButton.innerText = '✓ Tracking Active';
                startButton.style.backgroundColor = '#28a745';
                calibrateButton.disabled = true;
                calibrateButton.innerText = 'Calibrating... (Click dots on page)';
                calibrateButton.style.backgroundColor = '#ff6b6b';
                stopButton.disabled = true;
                break;
        }
    }

    // Helper to send message to active tab
    function sendMessageToActiveTab(action, value, callback) {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (!tabs[0]) {
                console.error('No active tab found');
                if (callback) callback({status: 'error', message: 'No active tab'});
                return;
            }
            
            const url = tabs[0].url || '';
            if (url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('moz-extension://')) {
                alert('WebGazer cannot run on browser internal pages. Please go to a regular website.');
                if (callback) callback({status: 'error', message: 'Invalid page'});
                return;
            }

            // Set a timeout for the message response
            let responseReceived = false;
            
            const timeoutId = setTimeout(() => {
                if (!responseReceived) {
                    console.warn('Message response timeout for action:', action);
                    if (callback) callback({status: 'timeout'});
                }
            }, 3000);

            chrome.tabs.sendMessage(tabs[0].id, {action, value}, function(response) {
                responseReceived = true;
                clearTimeout(timeoutId);
                
                if (chrome.runtime.lastError) {
                    console.error('Error sending message:', chrome.runtime.lastError.message);
                    
                    if (action === 'start') {
                        alert('Content script not detected. Please REFRESH the page you want to track on.');
                        // Reset UI for start action
                        isStarted = false;
                        startButton.disabled = false;
                        startButton.innerText = 'Start Tracking';
                    }
                    
                    if (callback) callback({status: 'error', error: chrome.runtime.lastError.message});
                } else {
                    console.log('Response from content script:', response);
                    if (callback) callback(response);
                }
            });
        });
    }

    startButton.addEventListener('click', function() {
        if (extensionStatus !== 'stopped') return;
        
        console.log('Requested Start...');
        extensionStatus = 'starting';
        updateUIState();
        
        sendMessageToActiveTab('start', null, (response) => {
            if (response && response.status === 'forwarded') {
                extensionStatus = 'active';
                isStarted = true;
            } else {
                extensionStatus = 'stopped';
                isStarted = false;
            }
            updateUIState();
        });
        
        // Set a backup timeout to update UI even if response is delayed
        setTimeout(() => {
            if (extensionStatus === 'starting') {
                extensionStatus = 'active';
                isStarted = true;
                updateUIState();
            }
        }, 2000);
    });

    stopButton.addEventListener('click', function() {
        if (extensionStatus === 'stopped') return;
        
        sendMessageToActiveTab('stop', null, (response) => {
            extensionStatus = 'stopped';
            isStarted = false;
            isCalibrating = false;
            updateUIState();
        });
        
        // Immediate UI update
        extensionStatus = 'stopped';
        isStarted = false;
        isCalibrating = false;
        updateUIState();
    });

    calibrateButton.addEventListener('click', function() {
        if (extensionStatus !== 'active') {
            alert('Please start tracking first before calibrating.');
            return;
        }
        
        extensionStatus = 'calibrating';
        isCalibrating = true;
        updateUIState();
        
        sendMessageToActiveTab('startCalibration', null, (response) => {
            // Calibration will end automatically when complete
            // Listen for calibration end message or use timeout
            setTimeout(() => {
                if (extensionStatus === 'calibrating') {
                    extensionStatus = 'active';
                    isCalibrating = false;
                    updateUIState();
                }
            }, 15000); // 15 second timeout for calibration
        });
    });

    showVideoCheck.addEventListener('change', (e) => {
        sendMessageToActiveTab('toggleVideo', e.target.checked);
    });

    showPointsCheck.addEventListener('change', (e) => {
        sendMessageToActiveTab('togglePoints', e.target.checked);
    });

    gazeListenerCheck.addEventListener('change', (e) => {
        sendMessageToActiveTab('toggleGazeListener', e.target.checked);
    });

    getPredictionButton.addEventListener('click', () => {
        predictionDisplay.textContent = 'Getting prediction...';
        predictionDisplay.style.color = '#666';
        
        sendMessageToActiveTab('getCurrentPrediction', null, (response) => {
            if (response && response.status === 'error') {
                predictionDisplay.textContent = 'Error: ' + (response.message || 'Unknown error');
                predictionDisplay.style.color = '#cc0000';
                return;
            }
            
            // For getCurrentPrediction, we'll show a simpler response
            // The actual prediction will be logged in the page console
            if (response && response.status === 'forwarded') {
                predictionDisplay.textContent = 'Check browser console for prediction data';
                predictionDisplay.style.color = '#0066cc';
            } else {
                predictionDisplay.textContent = 'Request failed';
                predictionDisplay.style.color = '#cc6600';
            }
        });
    });
    
    // Initialize UI state on load
    updateUIState();
    
    // Listen for messages from content script about calibration completion
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'calibrationComplete') {
            extensionStatus = 'active';
            isCalibrating = false;
            updateUIState();
        }
    });
});