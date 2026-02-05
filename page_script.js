// page_script.js - Injected into the page context
console.log('WebGazer Page Script (Injected) Loaded');

let webgazerInitialized = false;
let gazeListenerActive = false;
let gazeDot = null;
let calibrationMode = false;
let calibrationPoints = [];
let currentCalibrationPoint = 0;

// Create and manage the red gaze dot
function createGazeDot() {
    if (gazeDot) return gazeDot;
    
    gazeDot = document.createElement('div');
    gazeDot.id = 'webgazer-gaze-dot';
    gazeDot.style.position = 'fixed';
    gazeDot.style.width = '12px';
    gazeDot.style.height = '12px';
    gazeDot.style.backgroundColor = 'red';
    gazeDot.style.borderRadius = '50%';
    gazeDot.style.zIndex = '99999';
    gazeDot.style.pointerEvents = 'none';
    gazeDot.style.border = '2px solid white';
    gazeDot.style.boxShadow = '0 0 6px rgba(0,0,0,0.5)';
    gazeDot.style.display = 'none'; // Initially hidden
    gazeDot.style.transform = 'translate(-50%, -50%)'; // Center the dot on coordinates
    
    document.body.appendChild(gazeDot);
    return gazeDot;
}

// Remove the gaze dot
function removeGazeDot() {
    if (gazeDot && gazeDot.parentNode) {
        gazeDot.parentNode.removeChild(gazeDot);
        gazeDot = null;
    }
}

// Calibration functions
function createCalibrationPoints() {
    const points = [];
    const margin = 100;
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    // Create 9-point calibration grid
    const positions = [
        {x: margin, y: margin}, // Top-left
        {x: width/2, y: margin}, // Top-center
        {x: width-margin, y: margin}, // Top-right
        {x: margin, y: height/2}, // Middle-left
        {x: width/2, y: height/2}, // Center
        {x: width-margin, y: height/2}, // Middle-right
        {x: margin, y: height-margin}, // Bottom-left
        {x: width/2, y: height-margin}, // Bottom-center
        {x: width-margin, y: height-margin} // Bottom-right
    ];
    
    positions.forEach((pos, index) => {
        const point = document.createElement('div');
        point.className = 'calibration-point';
        point.style.position = 'fixed';
        point.style.left = pos.x + 'px';
        point.style.top = pos.y + 'px';
        point.style.width = '20px';
        point.style.height = '20px';
        point.style.backgroundColor = '#ff4444';
        point.style.borderRadius = '50%';
        point.style.border = '3px solid white';
        point.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)';
        point.style.cursor = 'pointer';
        point.style.zIndex = '99998';
        point.style.transform = 'translate(-50%, -50%)';
        point.style.display = 'none';
        point.dataset.index = index;
        
        point.addEventListener('click', handleCalibrationClick);
        document.body.appendChild(point);
        points.push(point);
    });
    
    return points;
}

function handleCalibrationClick(event) {
    const pointIndex = parseInt(event.target.dataset.index);
    
    // Record the click for WebGazer calibration
    if (typeof webgazer !== 'undefined') {
        const rect = event.target.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        
        // WebGazer will use this click data for calibration
        console.log(`Calibration click at point ${pointIndex + 1}: x=${x}, y=${y}`);
    }
    
    // Hide current point and show next
    event.target.style.display = 'none';
    currentCalibrationPoint++;
    
    if (currentCalibrationPoint < calibrationPoints.length) {
        // Show next calibration point
        calibrationPoints[currentCalibrationPoint].style.display = 'block';
        updateCalibrationInstructions(`Click on point ${currentCalibrationPoint + 1} of ${calibrationPoints.length}`);
    } else {
        // Calibration complete
        endCalibration();
    }
}

function startCalibration() {
    if (!webgazerInitialized) {
        console.error('Cannot calibrate: WebGazer not initialized');
        return;
    }
    
    calibrationMode = true;
    currentCalibrationPoint = 0;
    
    // Create calibration points
    calibrationPoints = createCalibrationPoints();
    
    // Hide gaze dot during calibration
    if (gazeDot) {
        gazeDot.style.display = 'none';
    }
    
    // Show calibration instructions
    showCalibrationInstructions();
    
    // Show first calibration point
    calibrationPoints[0].style.display = 'block';
    
    console.log('Calibration started - click on each red dot');
}

function endCalibration() {
    calibrationMode = false;
    
    // Remove all calibration points
    calibrationPoints.forEach(point => {
        if (point.parentNode) {
            point.parentNode.removeChild(point);
        }
    });
    calibrationPoints = [];
    
    // Remove calibration instructions
    removeCalibrationInstructions();
    
    // Show gaze dot again if listener is active
    if (gazeDot && gazeListenerActive) {
        gazeDot.style.display = 'block';
    }
    
    // Notify popup that calibration is complete
    window.postMessage({
        source: 'webgazer-calibration-complete'
    }, '*');
    
    showStatusIndicator('Calibration Complete! ✓', 'rgba(0,128,0,0.8)', 3000);
    console.log('Calibration completed');
}

function showCalibrationInstructions() {
    const instructions = document.createElement('div');
    instructions.id = 'calibration-instructions';
    instructions.style.position = 'fixed';
    instructions.style.top = '20px';
    instructions.style.left = '50%';
    instructions.style.transform = 'translateX(-50%)';
    instructions.style.zIndex = '99997';
    instructions.style.padding = '15px 25px';
    instructions.style.backgroundColor = 'rgba(0,0,0,0.9)';
    instructions.style.color = 'white';
    instructions.style.borderRadius = '10px';
    instructions.style.fontFamily = 'Arial, sans-serif';
    instructions.style.fontSize = '16px';
    instructions.style.textAlign = 'center';
    instructions.style.boxShadow = '0 4px 20px rgba(0,0,0,0.5)';
    instructions.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 10px;">🎯 Calibration Mode</div>
        <div id="calibration-step">Click on point 1 of ${calibrationPoints.length}</div>
        <div style="font-size: 12px; margin-top: 10px; opacity: 0.8;">Look directly at each red dot before clicking</div>
    `;
    
    document.body.appendChild(instructions);
}

function updateCalibrationInstructions(text) {
    const stepElement = document.getElementById('calibration-step');
    if (stepElement) {
        stepElement.textContent = text;
    }
}

function removeCalibrationInstructions() {
    const instructions = document.getElementById('calibration-instructions');
    if (instructions && instructions.parentNode) {
        instructions.parentNode.removeChild(instructions);
    }
}

// WebGazer gaze prediction callback
function gazeListener(data, elapsedTime) {
    if (data == null) return;
    
    const x = data.x;
    const y = data.y;
    
    // Update the red dot position
    if (!gazeDot) {
        createGazeDot();
    }
    
    if (gazeDot) {
        gazeDot.style.left = x + 'px';
        gazeDot.style.top = y + 'px';
        gazeDot.style.display = 'block';
    }
    
    // Log gaze data (you can customize this based on your needs)
    console.log(`Gaze prediction: x=${x.toFixed(0)}, y=${y.toFixed(0)}, time=${elapsedTime}ms`);
    
    // Optional: Send gaze data to content script or extension
    window.postMessage({
        source: 'webgazer-gaze-data',
        x: x,
        y: y,
        timestamp: Date.now(),
        elapsedTime: elapsedTime
    }, '*');
}

// Initialize WebGazer
async function initializeWebGazer() {
    if (typeof webgazer === 'undefined') {
        console.error('WebGazer is not available in page context');
        showStatusIndicator('WebGazer: Not Available', 'rgba(255,0,0,0.8)', 3000);
        return false;
    }

    if (webgazerInitialized) {
        console.log('WebGazer already initialized');
        showStatusIndicator('WebGazer: Already Active', 'rgba(0,128,0,0.8)', 2000);
        return true;
    }

    try {
        console.log('Initializing WebGazer...');
        
        // Show status indicator
        showStatusIndicator('WebGazer: Initializing...', 'rgba(255,165,0,0.8)');
        
        // Configure WebGazer settings
        webgazer.setRegression('ridge')
            .setTracker('clmtrackr')
            .saveDataAcrossSessions(true);
        
        // Start WebGazer - this is the key method as mentioned in requirements
        // Don't await this to prevent hanging
        webgazer.begin().then(() => {
            console.log('WebGazer.begin() completed successfully');
            
            // Set up the gaze listener - the second key method from requirements
            webgazer.setGazeListener(gazeListener);
            
            // Configure display options
            webgazer.showVideo(false);
            webgazer.showPredictionPoints(true);
            webgazer.applyKalmanFilter(true);
            
            webgazerInitialized = true;
            gazeListenerActive = true;
            
            showStatusIndicator('WebGazer: Active', 'rgba(0,128,0,0.8)', 3000);
            console.log('WebGazer initialized successfully with gaze listener');
        }).catch((error) => {
            console.error('WebGazer.begin() failed:', error);
            showStatusIndicator('WebGazer: Init Failed', 'rgba(255,0,0,0.8)', 3000);
        });
        
        // Return true immediately to prevent popup timeout
        return true;
    } catch (error) {
        console.error('Failed to initialize WebGazer:', error);
        showStatusIndicator('WebGazer: Failed', 'rgba(255,0,0,0.8)', 3000);
        return false;
    }
}

// Stop WebGazer
function stopWebGazer() {
    if (typeof webgazer !== 'undefined' && webgazerInitialized) {
        webgazer.end();
        webgazerInitialized = false;
        gazeListenerActive = false;
        
        // Hide the gaze dot when stopping
        removeGazeDot();
        
        console.log('WebGazer stopped');
        showStatusIndicator('WebGazer: Stopped', 'rgba(128,128,128,0.8)', 2000);
    }
}

// Get current gaze prediction
function getCurrentGazePrediction() {
    if (typeof webgazer !== 'undefined' && webgazerInitialized) {
        return webgazer.getCurrentPrediction();
    }
    return null;
}

// Show status indicator
function showStatusIndicator(message, backgroundColor, autoRemoveAfter = null) {
    let statusDiv = document.getElementById('webgazer-status-indicator');
    if (!statusDiv) {
        statusDiv = document.createElement('div');
        statusDiv.id = 'webgazer-status-indicator';
        statusDiv.style.position = 'fixed';
        statusDiv.style.top = '10px';
        statusDiv.style.right = '10px';
        statusDiv.style.zIndex = '99999';
        statusDiv.style.padding = '10px';
        statusDiv.style.color = 'white';
        statusDiv.style.borderRadius = '5px';
        statusDiv.style.fontFamily = 'Arial, sans-serif';
        statusDiv.style.fontSize = '12px';
        statusDiv.style.boxShadow = '0 2px 10px rgba(0,0,0,0.3)';
        document.body.appendChild(statusDiv);
    }
    
    statusDiv.innerText = message;
    statusDiv.style.background = backgroundColor;
    
    if (autoRemoveAfter) {
        setTimeout(() => {
            if (statusDiv && statusDiv.parentNode) {
                statusDiv.remove();
            }
        }, autoRemoveAfter);
    }
}

// Listen for messages from extension
window.addEventListener('message', async (event) => {
    // Only accept messages from ourselves (the content script)
    if (event.source !== window || !event.data || event.data.source !== 'webgazer-extension-content') return;

    const { action, value } = event.data;
    console.log('Page context received command:', action, value);

    switch (action) {
        case 'start':
            await initializeWebGazer();
            break;
            
        case 'stop':
            stopWebGazer();
            break;
            
        case 'toggleVideo':
            if (typeof webgazer !== 'undefined' && webgazerInitialized) {
                webgazer.showVideo(value);
            }
            break;
            
        case 'togglePoints':
            if (typeof webgazer !== 'undefined' && webgazerInitialized) {
                webgazer.showPredictionPoints(value);
            }
            break;
            
        case 'getCurrentPrediction':
            if (typeof webgazer !== 'undefined' && webgazerInitialized) {
                const prediction = getCurrentGazePrediction();
                console.log('Current gaze prediction:', prediction);
                if (prediction) {
                    console.log(`Current gaze: X=${prediction.x.toFixed(0)}, Y=${prediction.y.toFixed(0)}`);
                } else {
                    console.log('No gaze prediction available');
                }
            } else {
                console.log('WebGazer not initialized - cannot get prediction');
            }
            break;
            
        case 'toggleGazeListener':
            if (typeof webgazer !== 'undefined' && webgazerInitialized) {
                if (gazeListenerActive) {
                    webgazer.clearGazeListener();
                    gazeListenerActive = false;
                    // Hide the gaze dot when listener is disabled
                    if (gazeDot) {
                        gazeDot.style.display = 'none';
                    }
                    console.log('Gaze listener deactivated');
                } else {
                    webgazer.setGazeListener(gazeListener);
                    gazeListenerActive = true;
                    // Create gaze dot if it doesn't exist
                    createGazeDot();
                    console.log('Gaze listener activated');
                }
            }
            break;
            
        case 'startCalibration':
            if (typeof webgazer !== 'undefined' && webgazerInitialized) {
                startCalibration();
            } else {
                console.error('Cannot start calibration: WebGazer not initialized');
            }
            break;
    }
});

// Auto-initialize WebGazer when script loads (optional)
// Uncomment the next line if you want WebGazer to start automatically on every page
// setTimeout(initializeWebGazer, 1000);
