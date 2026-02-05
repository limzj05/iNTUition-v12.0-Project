// page_script.js - Injected into the page context
console.log('WebGazer Page Script (Injected) Loaded');

let webgazerInitialized = false;
let gazeListenerActive = false;
let gazeDot = null;
let calibrationMode = false;
let calibrationPoints = [];
let currentCalibrationPoint = 0;

// Face landmarker for trigger detection
let faceLandmarkerDetector = null;
let faceTriggersEnabled = true;
let webgazerVideoElement = null;

// Debug screen
let debugScreen = null;
let debugScreenEnabled = false;
let debugUpdateInterval = null;

// Optimized weighted average filter for faster gaze response
let gazeBuffer = [];
let filterEnabled = true;
const BUFFER_SIZE = 6; // Reduced for faster response time
const FILTER_WEIGHTS = [0.4, 0.25, 0.15, 0.1, 0.06, 0.04]; // Optimized weights for 6 predictions (more weight on recent)

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

// Weighted average filter functions
function addToGazeBuffer(x, y) {
    gazeBuffer.unshift({x: x, y: y, timestamp: Date.now()});
    
    // Keep buffer size limited
    if (gazeBuffer.length > BUFFER_SIZE) {
        gazeBuffer = gazeBuffer.slice(0, BUFFER_SIZE);
    }
}

function calculateWeightedAverage() {
    if (gazeBuffer.length === 0) return null;
    
    let totalWeightedX = 0;
    let totalWeightedY = 0;
    let totalWeight = 0;
    
    for (let i = 0; i < Math.min(gazeBuffer.length, FILTER_WEIGHTS.length); i++) {
        const weight = FILTER_WEIGHTS[i];
        const point = gazeBuffer[i];
        
        totalWeightedX += point.x * weight;
        totalWeightedY += point.y * weight;
        totalWeight += weight;
    }
    
    // Normalize if we don't have full buffer
    if (totalWeight > 0) {
        return {
            x: totalWeightedX / totalWeight,
            y: totalWeightedY / totalWeight
        };
    }
    
    return gazeBuffer[0]; // Fallback to most recent if weights don't work
}

function applyGazeFilter(rawX, rawY) {
    if (!filterEnabled) {
        return {x: rawX, y: rawY};
    }
    
    // Add raw prediction to buffer
    addToGazeBuffer(rawX, rawY);
    
    // Calculate filtered position
    return calculateWeightedAverage() || {x: rawX, y: rawY};
}

function clearGazeBuffer() {
    gazeBuffer = [];
}

function toggleGazeFilter(enabled) {
    filterEnabled = enabled;
    if (!enabled) {
        clearGazeBuffer();
    }
    console.log('Gaze filter', enabled ? 'enabled' : 'disabled');
}

// Face Landmarker functions
async function initializeFaceLandmarker() {
    try {
        // Wait and retry for FaceLandmarkerDetector to be available
        let retries = 0;
        const maxRetries = 10;
        
        while (retries < maxRetries && typeof FaceLandmarkerDetector === 'undefined') {
            console.log(`Waiting for FaceLandmarkerDetector... (${retries + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, 200)); // Reduced from 500ms
            retries++;
        }
        
        if (typeof FaceLandmarkerDetector === 'undefined') {
            console.warn('FaceLandmarkerDetector not available after retries, creating fallback...');
            console.log('USING FALLBACK DETECTOR: External face_landmarker.js failed to load properly');
            // Create a simple fallback detector
            window.FaceLandmarkerDetector = class {
                constructor() {
                    this.isInitialized = false;
                    this.video = null;
                    this.canvas = null;
                    this.ctx = null;
                    this.animationFrame = null;
                    this.previousEyeState = { left: 'open', right: 'open' };
                    this.leftEyeState = { current: 'open', lastChange: Date.now(), blinkStartTime: null };
                    this.rightEyeState = { current: 'open', lastChange: Date.now(), blinkStartTime: null };
                    this.blinkStartTime = null;
                    this.mouthOpenStartTime = null;
                    this.headPositionHistory = [];
                    this.config = { 
                        longBlinkThreshold: 800,
                        leftEyeThreshold: 0.3,    // Brightness threshold for left eye detection
                        rightEyeThreshold: 0.3,   // Brightness threshold for right eye detection
                        mouthOpenThreshold: 0.4,  // Brightness threshold for mouth detection
                        headShakeThreshold: 15,   // Movement threshold for head shake
                        historySize: 6,           // Reduced for faster response
                        analysisInterval: 2,      // Skip every other frame
                        debugLogRate: 0.001       // Minimal debug logging
                    };
                    this.frameCounter = 0;
                    this.cachedRegions = null;
                    this.onLongBlink = null;
                    this.onMouthOpen = null;
                    this.onNod = null;
                    this.onShakeHead = null;
                    this.onLeftEyeClosed = null;
                    this.onRightEyeClosed = null;
                    this.onLeftEyeOpened = null;
                    this.onRightEyeOpened = null;
                }
                
                async initialize() {
                    console.log('Initializing fallback face gesture detector...');
                    this.isInitialized = true;
                    return true;
                }
                
                startDetection(videoElement) {
                    if (!this.isInitialized) return false;
                    this.video = videoElement;
                    this.canvas = document.createElement('canvas');
                    this.ctx = this.canvas.getContext('2d');
                    console.log('Started fallback face detection');
                    this.detectGestures();
                    return true;
                }
                
                detectGestures() {
                    if (!this.video || this.video.videoWidth === 0) {
                        this.animationFrame = requestAnimationFrame(() => this.detectGestures());
                        return;
                    }
                    
                    this.frameCounter++;
                    
                    // Skip frames for better performance
                    if (this.frameCounter % this.config.analysisInterval !== 0) {
                        this.animationFrame = requestAnimationFrame(() => this.detectGestures());
                        return;
                    }
                    
                    try {
                        // Only resize if needed
                        if (this.canvas.width !== this.video.videoWidth || this.canvas.height !== this.video.videoHeight) {
                            this.canvas.width = this.video.videoWidth;
                            this.canvas.height = this.video.videoHeight;
                            this.cachedRegions = null;
                        }
                        
                        this.ctx.drawImage(this.video, 0, 0);
                        
                        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
                        
                        // Analyze different face regions
                        this.analyzeEyes(imageData);
                        this.analyzeMouth(imageData);
                        this.analyzeHeadMovement(imageData);
                        
                    } catch (error) {
                        console.error('Gesture detection error:', error);
                    }
                    
                    this.animationFrame = requestAnimationFrame(() => this.detectGestures());
                }
                
                analyzeEyes(imageData) {
                    const width = imageData.width;
                    const height = imageData.height;
                    const now = Date.now();
                    
                    // Define separate eye regions
                    const eyeRegionTop = Math.floor(height * 0.35);
                    const eyeRegionBottom = Math.floor(height * 0.5);
                    const leftEyeLeft = Math.floor(width * 0.3);
                    const leftEyeRight = Math.floor(width * 0.45);
                    const rightEyeLeft = Math.floor(width * 0.55);
                    const rightEyeRight = Math.floor(width * 0.7);
                    
                    // Calculate brightness for left eye
                    let leftEyeBrightness = 0, leftPixelCount = 0;
                    for (let y = eyeRegionTop; y < eyeRegionBottom; y++) {
                        for (let x = leftEyeLeft; x < leftEyeRight; x++) {
                            const idx = (y * width + x) * 4;
                            leftEyeBrightness += (imageData.data[idx] + imageData.data[idx + 1] + imageData.data[idx + 2]) / 3;
                            leftPixelCount++;
                        }
                    }
                    
                    // Calculate brightness for right eye
                    let rightEyeBrightness = 0, rightPixelCount = 0;
                    for (let y = eyeRegionTop; y < eyeRegionBottom; y++) {
                        for (let x = rightEyeLeft; x < rightEyeRight; x++) {
                            const idx = (y * width + x) * 4;
                            rightEyeBrightness += (imageData.data[idx] + imageData.data[idx + 1] + imageData.data[idx + 2]) / 3;
                            rightPixelCount++;
                        }
                    }
                    
                    const leftAvgBrightness = leftPixelCount > 0 ? leftEyeBrightness / leftPixelCount / 255 : 1;
                    const rightAvgBrightness = rightPixelCount > 0 ? rightEyeBrightness / rightPixelCount / 255 : 1;
                    
                    const leftEyeClosed = leftAvgBrightness < this.config.leftEyeThreshold;
                    const rightEyeClosed = rightAvgBrightness < this.config.rightEyeThreshold;
                    
                    // Handle LEFT EYE state changes
                    if (leftEyeClosed && this.leftEyeState.current === 'open') {
                        this.leftEyeState.current = 'closed';
                        this.leftEyeState.lastChange = now;
                        this.leftEyeState.blinkStartTime = now;
                        
                        console.log('👁️ Fallback: LEFT eye closed');
                        if (this.onLeftEyeClosed) this.onLeftEyeClosed(now);
                        this.showTriggerIndicator('Left Eye Closed', '#FF6B6B');
                        
                    } else if (!leftEyeClosed && this.leftEyeState.current === 'closed') {
                        const duration = now - this.leftEyeState.blinkStartTime;
                        this.leftEyeState.current = 'open';
                        this.leftEyeState.lastChange = now;
                        
                        console.log(`👁️ Fallback: LEFT eye opened (${duration}ms)`);
                        if (this.onLeftEyeOpened) this.onLeftEyeOpened(duration);
                        this.showTriggerIndicator(`Left Eye Open (${duration}ms)`, '#4ECDC4');
                    }
                    
                    // Handle RIGHT EYE state changes
                    if (rightEyeClosed && this.rightEyeState.current === 'open') {
                        this.rightEyeState.current = 'closed';
                        this.rightEyeState.lastChange = now;
                        this.rightEyeState.blinkStartTime = now;
                        
                        console.log('👁️ Fallback: RIGHT eye closed');
                        if (this.onRightEyeClosed) this.onRightEyeClosed(now);
                        this.showTriggerIndicator('Right Eye Closed', '#FF9F43');
                        
                    } else if (!rightEyeClosed && this.rightEyeState.current === 'closed') {
                        const duration = now - this.rightEyeState.blinkStartTime;
                        this.rightEyeState.current = 'open';
                        this.rightEyeState.lastChange = now;
                        
                        console.log(`👁️ Fallback: RIGHT eye opened (${duration}ms)`);
                        if (this.onRightEyeOpened) this.onRightEyeOpened(duration);
                        this.showTriggerIndicator(`Right Eye Open (${duration}ms)`, '#54A0FF');
                    }
                    
                    // Traditional both-eyes blink detection for long blinks
                    const bothEyesClosed = leftEyeClosed && rightEyeClosed;
                    
                    if (bothEyesClosed && !this.blinkStartTime) {
                        this.blinkStartTime = now;
                        console.log('👁️ Fallback: Both eyes closed - long blink timer started');
                    } else if (!bothEyesClosed && this.blinkStartTime) {
                        const duration = now - this.blinkStartTime;
                        if (duration > this.config.longBlinkThreshold) {
                            console.log('🎯 Fallback long blink detected:', duration + 'ms');
                            if (this.onLongBlink) this.onLongBlink(duration);
                            this.showTriggerIndicator('👁️ Long Blink', '#4CAF50');
                        }
                        this.blinkStartTime = null;
                    }
                    
                    // Update previous eye state for compatibility
                    this.previousEyeState = {
                        left: leftEyeClosed ? 'closed' : 'open',
                        right: rightEyeClosed ? 'closed' : 'open'
                    };
                }
                
                analyzeMouth(imageData) {
                    const width = imageData.width;
                    const height = imageData.height;
                    
                    // Mouth region analysis (lower face area)
                    const mouthRegionTop = Math.floor(height * 0.65);
                    const mouthRegionBottom = Math.floor(height * 0.85);
                    const mouthLeft = Math.floor(width * 0.35);
                    const mouthRight = Math.floor(width * 0.65);
                    
                    let mouthBrightness = 0, pixelCount = 0;
                    for (let y = mouthRegionTop; y < mouthRegionBottom; y++) {
                        for (let x = mouthLeft; x < mouthRight; x++) {
                            const idx = (y * width + x) * 4;
                            mouthBrightness += (imageData.data[idx] + imageData.data[idx + 1] + imageData.data[idx + 2]) / 3;
                            pixelCount++;
                        }
                    }
                    
                    const avgMouthBrightness = pixelCount > 0 ? mouthBrightness / pixelCount / 255 : 1;
                    const mouthOpen = avgMouthBrightness < this.config.mouthOpenThreshold;
                    
                    if (mouthOpen && !this.mouthOpenStartTime) {
                        this.mouthOpenStartTime = Date.now();
                    } else if (!mouthOpen && this.mouthOpenStartTime) {
                        const duration = Date.now() - this.mouthOpenStartTime;
                        if (duration > 500) { // Mouth must be open for at least 500ms
                            console.log('🎯 Mouth open detected:', duration + 'ms');
                            if (this.onMouthOpen) this.onMouthOpen(duration);
                            this.showTriggerIndicator('👄 Mouth Open', '#FF9800');
                        }
                        this.mouthOpenStartTime = null;
                    }
                }
                
                analyzeHeadMovement(imageData) {
                    const width = imageData.width;
                    const height = imageData.height;
                    
                    // Track face center using overall brightness distribution
                    const centerX = Math.floor(width * 0.5);
                    const centerY = Math.floor(height * 0.5);
                    const regionSize = Math.floor(Math.min(width, height) * 0.1);
                    
                    let totalBrightness = 0, pixelCount = 0;
                    let weightedX = 0, weightedY = 0;
                    
                    for (let y = centerY - regionSize; y < centerY + regionSize; y++) {
                        for (let x = centerX - regionSize; x < centerX + regionSize; x++) {
                            if (x >= 0 && x < width && y >= 0 && y < height) {
                                const idx = (y * width + x) * 4;
                                const brightness = (imageData.data[idx] + imageData.data[idx + 1] + imageData.data[idx + 2]) / 3;
                                totalBrightness += brightness;
                                weightedX += x * brightness;
                                weightedY += y * brightness;
                                pixelCount++;
                            }
                        }
                    }
                    
                    if (totalBrightness > 0) {
                        const faceCenterX = weightedX / totalBrightness;
                        const faceCenterY = weightedY / totalBrightness;
                        
                        // Add to history
                        this.headPositionHistory.push({ x: faceCenterX, y: faceCenterY, time: Date.now() });
                        
                        // Keep only recent history
                        if (this.headPositionHistory.length > this.config.historySize) {
                            this.headPositionHistory.shift();
                        }
                        
                        // Analyze movement patterns
                        if (this.headPositionHistory.length >= this.config.historySize) {
                            this.detectHeadGestures();
                        }
                    }
                }
                
                detectHeadGestures() {
                    const recent = this.headPositionHistory.slice(-5);
                    const older = this.headPositionHistory.slice(0, 5);
                    
                    if (recent.length < 5 || older.length < 5) return;
                    
                    // Calculate average positions
                    const recentAvgX = recent.reduce((sum, pos) => sum + pos.x, 0) / recent.length;
                    const recentAvgY = recent.reduce((sum, pos) => sum + pos.y, 0) / recent.length;
                    const olderAvgX = older.reduce((sum, pos) => sum + pos.x, 0) / older.length;
                    const olderAvgY = older.reduce((sum, pos) => sum + pos.y, 0) / older.length;
                    
                    const deltaX = Math.abs(recentAvgX - olderAvgX);
                    const deltaY = Math.abs(recentAvgY - olderAvgY);
                    
                    // Detect horizontal movement (head shake)
                    if (deltaX > this.config.headShakeThreshold && deltaX > deltaY * 2) {
                        console.log('🎯 Head shake detected:', deltaX);
                        if (this.onShakeHead) this.onShakeHead();
                        this.showTriggerIndicator('↔️ Head Shake', '#E91E63');
                        this.headPositionHistory = []; // Reset to prevent multiple triggers
                    }
                    // Detect vertical movement (nod)
                    else if (deltaY > this.config.headShakeThreshold && deltaY > deltaX * 2) {
                        console.log('🎯 Head nod detected:', deltaY);
                        if (this.onNod) this.onNod();
                        this.showTriggerIndicator('↕️ Nod', '#2196F3');
                        this.headPositionHistory = []; // Reset to prevent multiple triggers
                    }
                }
                
                showTriggerIndicator(text, color) {
                    const indicator = document.createElement('div');
                    indicator.style.cssText = `
                        position: fixed; top: 60px; right: 10px; z-index: 99998;
                        padding: 10px 15px; background: ${color}; color: white;
                        border-radius: 20px; font: bold 14px Arial; 
                        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
                        transform: translateX(100%); transition: transform 0.3s ease-out;
                    `;
                    indicator.textContent = text;
                    document.body.appendChild(indicator);
                    
                    setTimeout(() => indicator.style.transform = 'translateX(0)', 10);
                    setTimeout(() => {
                        indicator.style.transform = 'translateX(100%)';
                        setTimeout(() => indicator.remove(), 300);
                    }, 2000);
                }
                
                setTriggerCallbacks(callbacks) { 
                    this.onLongBlink = callbacks.onLongBlink;
                    this.onMouthOpen = callbacks.onMouthOpen;
                    this.onNod = callbacks.onNod;
                    this.onShakeHead = callbacks.onShakeHead;
                    this.onLeftEyeClosed = callbacks.onLeftEyeClosed;
                    this.onRightEyeClosed = callbacks.onRightEyeClosed;
                    this.onLeftEyeOpened = callbacks.onLeftEyeOpened;
                    this.onRightEyeOpened = callbacks.onRightEyeOpened;
                }
                updateConfig(config) { this.config = { ...this.config, ...config }; }
                stop() {
                    if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
                    this.video = null; this.canvas = null; this.ctx = null;
                }
            };
            console.log('Fallback FaceLandmarkerDetector created');
        }
        
        console.log('FaceLandmarkerDetector found, initializing...');
        console.log('USING EXTERNAL DETECTOR: face_landmarker.js loaded successfully');
        faceLandmarkerDetector = new FaceLandmarkerDetector();
        
        // Set up trigger callbacks
        faceLandmarkerDetector.setTriggerCallbacks({
            onLongBlink: (duration) => {
                console.log(`🎯 TRIGGER: Long Blink (${duration}ms)`);
                // Send trigger event
                window.postMessage({
                    source: 'face-trigger',
                    type: 'longBlink',
                    data: { duration }
                }, '*');
            },
            onMouthOpen: (intensity) => {
                console.log(`🎯 TRIGGER: Mouth Open (${intensity})`);
                window.postMessage({
                    source: 'face-trigger',
                    type: 'mouthOpen',
                    data: { intensity }
                }, '*');
            },
            onNod: () => {
                console.log('🎯 TRIGGER: Head Nod');
                window.postMessage({
                    source: 'face-trigger',
                    type: 'nod',
                    data: {}
                }, '*');
            },
            onShakeHead: () => {
                console.log('🎯 TRIGGER: Head Shake');
                window.postMessage({
                    source: 'face-trigger',
                    type: 'shakeHead',
                    data: {}
                }, '*');
            },
            onLeftEyeClosed: () => {
                console.log('🎯 TRIGGER: Left Eye Closed');
                window.postMessage({
                    source: 'face-trigger',
                    type: 'leftEyeClosed',
                    data: {}
                }, '*');
            },
            onRightEyeClosed: () => {
                console.log('🎯 TRIGGER: Right Eye Closed');
                window.postMessage({
                    source: 'face-trigger',
                    type: 'rightEyeClosed',
                    data: {}
                }, '*');
            },
            onLeftEyeOpened: (duration) => {
                console.log(`🎯 TRIGGER: Left Eye Opened (${duration}ms)`);
                window.postMessage({
                    source: 'face-trigger',
                    type: 'leftEyeOpened',
                    data: { duration }
                }, '*');
            },
            onRightEyeOpened: (duration) => {
                console.log(`🎯 TRIGGER: Right Eye Opened (${duration}ms)`);
                window.postMessage({
                    source: 'face-trigger',
                    type: 'rightEyeOpened',
                    data: { duration }
                }, '*');
            }
        });
        
        const initialized = await faceLandmarkerDetector.initialize();
        if (initialized) {
            console.log('Face Landmarker initialized for trigger detection');
            
            // Get WebGazer video element and start detection
            startFaceTriggerDetection();
        } else {
            console.error('Face Landmarker initialization failed');
        }
    } catch (error) {
        console.error('Failed to initialize Face Landmarker:', error);
    }
}

function startFaceTriggerDetection() {
    if (!faceLandmarkerDetector || !faceTriggersEnabled) {
        console.log('Face trigger detection not starting: detector unavailable or disabled');
        return;
    }
    
    // Try to get WebGazer's video element with better detection
    const findVideoElement = () => {
        console.log('Searching for WebGazer video element...');
        const videos = document.querySelectorAll('video');
        console.log(`Found ${videos.length} video elements`);
        
        for (const video of videos) {
            console.log('Checking video:', {
                src: video.src,
                srcObject: !!video.srcObject,
                videoWidth: video.videoWidth,
                videoHeight: video.videoHeight,
                readyState: video.readyState
            });
            
            // Check if this is a webcam video (has srcObject with video tracks)
            if (video.srcObject && video.videoWidth > 0 && video.videoHeight > 0) {
                const tracks = video.srcObject.getVideoTracks();
                if (tracks.length > 0) {
                    webgazerVideoElement = video;
                    console.log('Found WebGazer video element for face trigger detection:', {
                        width: video.videoWidth,
                        height: video.videoHeight,
                        tracks: tracks.length
                    });
                    
                    const started = faceLandmarkerDetector.startDetection(video);
                    if (started) {
                        console.log('Face trigger detection started successfully');
                    } else {
                        console.error('Failed to start face trigger detection');
                    }
                    return true;
                }
            }
        }
        console.log('No suitable video element found for face trigger detection');
        return false;
    };
    
    // Try to find video element with multiple retries
    let retries = 0;
    const maxRetries = 15;
    
    const attemptVideoDetection = () => {
        if (findVideoElement()) {
            return; // Success!
        }
        
        retries++;
        if (retries < maxRetries) {
            console.log(`Retrying video element detection (${retries}/${maxRetries})...`);
            setTimeout(attemptVideoDetection, 1000);
        } else {
            console.error('Could not find video element for face trigger detection after maximum retries');
            // Show user-friendly error
            showStatusIndicator('Face Triggers: Video not found', 'rgba(255,165,0,0.8)', 3000);
        }
    };
    
    // Start the detection attempts
    attemptVideoDetection();
}

function toggleFaceTriggers(enabled) {
    faceTriggersEnabled = enabled;
    
    if (!enabled && faceLandmarkerDetector) {
        faceLandmarkerDetector.stop();
        console.log('Face trigger detection stopped');
    } else if (enabled && faceLandmarkerDetector) {
        startFaceTriggerDetection();
        console.log('Face trigger detection started');
    }
}

// Debug Screen Functions
function createDebugScreen() {
    if (debugScreen) return debugScreen;
    
    debugScreen = document.createElement('div');
    debugScreen.id = 'webgazer-debug-screen';
    debugScreen.style.cssText = `
        position: fixed;
        top: 10px;
        left: 10px;
        width: 300px;
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 15px;
        border-radius: 10px;
        font-family: 'Courier New', monospace;
        font-size: 11px;
        z-index: 99997;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        border: 2px solid #333;
        line-height: 1.4;
    `;
    
    debugScreen.innerHTML = `
        <div style="font-weight: bold; font-size: 13px; margin-bottom: 10px; color: #4CAF50;">
            🔍 WebGazer Debug Console
        </div>
        <div id="debug-status" style="margin-bottom: 8px;">Status: Initializing...</div>
        <div id="debug-gaze" style="margin-bottom: 8px;">Gaze: Not tracking</div>
        <div id="debug-gesture" style="margin-bottom: 8px;">Last Gesture: None</div>
        <div id="debug-filter" style="margin-bottom: 8px;">Filter: Unknown</div>
        <div id="debug-triggers" style="margin-bottom: 8px;">Face Triggers: Unknown</div>
        <div id="debug-fps" style="margin-bottom: 8px;">Update Rate: 0 fps</div>
        <div style="font-size: 9px; color: #888; margin-top: 10px; border-top: 1px solid #333; padding-top: 5px;">
            Click to drag • Double-click to minimize
        </div>
    `;
    
    // Make draggable
    let isDragging = false;
    let startX, startY, startLeft, startTop;
    
    debugScreen.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        startLeft = parseInt(window.getComputedStyle(debugScreen).left);
        startTop = parseInt(window.getComputedStyle(debugScreen).top);
        debugScreen.style.cursor = 'move';
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const newLeft = startLeft + (e.clientX - startX);
        const newTop = startTop + (e.clientY - startY);
        debugScreen.style.left = newLeft + 'px';
        debugScreen.style.top = newTop + 'px';
    });
    
    document.addEventListener('mouseup', () => {
        isDragging = false;
        debugScreen.style.cursor = 'default';
    });
    
    // Double-click to minimize
    let isMinimized = false;
    debugScreen.addEventListener('dblclick', () => {
        const content = debugScreen.querySelector('#debug-status').parentElement;
        if (isMinimized) {
            content.style.display = 'block';
            debugScreen.style.height = 'auto';
            isMinimized = false;
        } else {
            content.style.display = 'none';
            debugScreen.style.height = '20px';
            isMinimized = true;
        }
    });
    
    document.body.appendChild(debugScreen);
    return debugScreen;
}

function updateDebugScreen() {
    if (!debugScreen || !debugScreenEnabled) return;
    
    const statusEl = document.getElementById('debug-status');
    const gazeEl = document.getElementById('debug-gaze');
    const gestureEl = document.getElementById('debug-gesture');
    const filterEl = document.getElementById('debug-filter');
    const triggersEl = document.getElementById('debug-triggers');
    const fpsEl = document.getElementById('debug-fps');
    
    if (!statusEl) return; // Debug screen not ready
    
    // Status
    const status = webgazerInitialized ? 
        (gazeListenerActive ? 'Active & Tracking' : 'Active (No Listener)') : 
        'Not Initialized';
    statusEl.innerHTML = `Status: <span style="color: ${webgazerInitialized ? '#4CAF50' : '#f44336'}">${status}</span>`;
    
    // Gaze coordinates (from global data stream if available)
    if (typeof window.WebGazerDataStream !== 'undefined' && window.WebGazerDataStream.isTracking) {
        const { x, y } = window.WebGazerDataStream.currentGaze;
        const age = Date.now() - (window.WebGazerDataStream.lastUpdate || 0);
        gazeEl.innerHTML = `Gaze: <span style="color: #2196F3">X:${Math.round(x)} Y:${Math.round(y)}</span> <span style="color: #999">(${age}ms ago)</span>`;
    } else {
        gazeEl.innerHTML = 'Gaze: <span style="color: #999">Not tracking</span>';
    }
    
    // Last gesture
    if (typeof window.WebGazerDataStream !== 'undefined' && window.WebGazerDataStream.lastGesture) {
        const gesture = window.WebGazerDataStream.lastGesture;
        const gestureAge = Date.now() - (window.WebGazerDataStream.lastUpdate || 0);
        const gestureColors = {
            'longBlink': '#4CAF50',
            'mouthOpen': '#FF9800',
            'nod': '#2196F3',
            'shakeHead': '#E91E63'
        };
        const color = gestureColors[gesture] || '#fff';
        gestureEl.innerHTML = `Last Gesture: <span style="color: ${color}">${gesture}</span> <span style="color: #999">(${gestureAge}ms ago)</span>`;
    } else {
        gestureEl.innerHTML = 'Last Gesture: <span style="color: #999">None detected</span>';
    }
    
    // Filter status
    filterEl.innerHTML = `Filter: <span style="color: ${filterEnabled ? '#4CAF50' : '#f44336'}">${filterEnabled ? 'Enabled' : 'Disabled'}</span> (${gazeBuffer.length}/${BUFFER_SIZE} buffer)`;
    
    // Face triggers
    triggersEl.innerHTML = `Face Triggers: <span style="color: ${faceTriggersEnabled ? '#4CAF50' : '#f44336'}">${faceTriggersEnabled ? 'Enabled' : 'Disabled'}</span>`;
    
    // Calculate FPS (approximate)
    const now = Date.now();
    if (!updateDebugScreen.lastUpdate) {
        updateDebugScreen.lastUpdate = now;
        updateDebugScreen.frameCount = 0;
    }
    updateDebugScreen.frameCount++;
    const timeDiff = now - updateDebugScreen.lastUpdate;
    if (timeDiff >= 1000) {
        const fps = Math.round((updateDebugScreen.frameCount * 1000) / timeDiff);
        fpsEl.innerHTML = `Update Rate: <span style="color: #2196F3">${fps} fps</span>`;
        updateDebugScreen.lastUpdate = now;
        updateDebugScreen.frameCount = 0;
    }
}

function toggleDebugScreen(enabled) {
    debugScreenEnabled = enabled;
    
    if (enabled) {
        createDebugScreen();
        debugScreen.style.display = 'block';
        
        // Start updating every 100ms
        debugUpdateInterval = setInterval(updateDebugScreen, 100);
        console.log('Debug screen enabled');
    } else {
        if (debugScreen) {
            debugScreen.style.display = 'none';
        }
        
        if (debugUpdateInterval) {
            clearInterval(debugUpdateInterval);
            debugUpdateInterval = null;
        }
        console.log('Debug screen disabled');
    }
}

function removeDebugScreen() {
    if (debugScreen && debugScreen.parentNode) {
        debugScreen.parentNode.removeChild(debugScreen);
        debugScreen = null;
    }
    
    if (debugUpdateInterval) {
        clearInterval(debugUpdateInterval);
        debugUpdateInterval = null;
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
    
    const rawX = data.x;
    const rawY = data.y;
    
    // Apply weighted average filter for stabilization
    const filtered = applyGazeFilter(rawX, rawY);
    const x = filtered.x;
    const y = filtered.y;
    
    // Update the red dot position with filtered coordinates
    if (!gazeDot) {
        createGazeDot();
    }
    
    if (gazeDot) {
        gazeDot.style.left = x + 'px';
        gazeDot.style.top = y + 'px';
        gazeDot.style.display = 'block';
    }
    
    // Log both raw and filtered data for debugging
    if (Math.random() < 0.1) { // Log only 10% of predictions to avoid spam
        console.log(`Gaze: Raw(${rawX.toFixed(0)}, ${rawY.toFixed(0)}) -> Filtered(${x.toFixed(0)}, ${y.toFixed(0)})`);
    }
    
    // Optional: Send filtered gaze data to content script or extension
    window.postMessage({
        source: 'webgazer-gaze-data',
        x: x,
        y: y,
        rawX: rawX,
        rawY: rawY,
        timestamp: Date.now(),
        elapsedTime: elapsedTime,
        filtered: filterEnabled
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
        
        // Wait a moment to ensure WebGazer is fully loaded
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Check if WebGazer methods are available
        if (typeof webgazer.setRegression !== 'function' ||
            typeof webgazer.setTracker !== 'function' ||
            typeof webgazer.begin !== 'function') {
            throw new Error('WebGazer methods not available - library may not be fully loaded');
        }
        
        console.log('WebGazer methods confirmed available');
        
        // Configure WebGazer settings
        try {
            webgazer.setRegression('ridge')
                .setTracker('TFFacemesh')  // Use TFFacemesh instead of clmtrackr
                .saveDataAcrossSessions(true);
            console.log('WebGazer configuration set');
        } catch (configError) {
            console.error('WebGazer configuration failed:', configError);
            throw configError;
        }
        
        // Start WebGazer with additional error handling
        console.log('Calling webgazer.begin()...');
        try {
            const beginPromise = webgazer.begin();
            
            // Handle both promise and non-promise returns
            if (beginPromise && typeof beginPromise.then === 'function') {
                await beginPromise;
            } else if (beginPromise && typeof beginPromise.catch === 'function') {
                await beginPromise;
            }
            console.log('webgazer.begin() completed successfully');
        } catch (beginError) {
            console.error('webgazer.begin() failed:', beginError);
            throw beginError;
        }
        
        // Additional delay to ensure WebGazer is ready
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Set up the gaze listener - the second key method from requirements
        try {
            webgazer.setGazeListener(gazeListener);
            console.log('Gaze listener set');
        } catch (listenerError) {
            console.error('Failed to set gaze listener:', listenerError);
            // Don't fail completely if listener setup fails
        }
        
        // Configure display options
        try {
            webgazer.showVideo(false);
            webgazer.showPredictionPoints(true);
            webgazer.applyKalmanFilter(true);
            console.log('WebGazer display options set');
            
            // Initialize face landmarker for trigger detection
            await initializeFaceLandmarker();
            
        } catch (displayError) {
            console.error('Failed to set display options:', displayError);
            // Don't fail completely if display setup fails
        }
        
        webgazerInitialized = true;
        gazeListenerActive = true;
        
        showStatusIndicator('WebGazer: Active ✓', 'rgba(0,128,0,0.8)', 3000);
        console.log('WebGazer initialized successfully');
        
        return true;
    } catch (error) {
        console.error('Failed to initialize WebGazer:', error);
        console.error('Error stack:', error.stack);
        
        // Show detailed error to user
        let errorMsg = 'WebGazer: Init Failed';
        if (error.message) {
            errorMsg += ' - ' + error.message.substring(0, 30);
        }
        
        showStatusIndicator(errorMsg, 'rgba(255,0,0,0.8)', 5000);
        
        // Reset state
        webgazerInitialized = false;
        gazeListenerActive = false;
        
        return false;
    }
}

// Stop WebGazer
function stopWebGazer() {
    if (typeof webgazer !== 'undefined' && webgazerInitialized) {
        webgazer.end();
        webgazerInitialized = false;
        gazeListenerActive = false;
        
        // Clear filter buffer and hide the gaze dot
        clearGazeBuffer();
        removeGazeDot();
        
        // Stop face trigger detection
        if (faceLandmarkerDetector) {
            faceLandmarkerDetector.stop();
        }
        
        // Remove debug screen
        removeDebugScreen();
        
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
            
        case 'toggleFilter':
            toggleGazeFilter(value);
            break;
            
        case 'clearFilterBuffer':
            clearGazeBuffer();
            console.log('Gaze filter buffer cleared');
            break;
            
        case 'toggleFaceTriggers':
            toggleFaceTriggers(value);
            break;
            
        case 'toggleDebugScreen':
            toggleDebugScreen(value);
            break;
    }
});

// Auto-initialize WebGazer when script loads (optional)
// Uncomment the next line if you want WebGazer to start automatically on every page
// setTimeout(initializeWebGazer, 1000);

// ⚡ PERFORMANCE CONTROLS - Available in browser console
window.WebGazerPerformance = {
    // Set high performance mode (faster, less accurate)
    setFast: function() {
        if (faceLandmarkerDetector && faceLandmarkerDetector.setHighPerformanceMode) {
            faceLandmarkerDetector.setHighPerformanceMode();
            console.log('🚀 WebGazer set to FAST mode (~20 FPS analysis)');
        } else {
            console.warn('Face detector not available');
        }
    },
    
    // Set balanced mode (default)
    setBalanced: function() {
        if (faceLandmarkerDetector && faceLandmarkerDetector.setBalancedMode) {
            faceLandmarkerDetector.setBalancedMode();
            console.log('⚖️ WebGazer set to BALANCED mode (~30 FPS analysis)');
        } else {
            console.warn('Face detector not available');
        }
    },
    
    // Set high accuracy mode (slower, more accurate)
    setAccurate: function() {
        if (faceLandmarkerDetector && faceLandmarkerDetector.setHighAccuracyMode) {
            faceLandmarkerDetector.setHighAccuracyMode();
            console.log('🎯 WebGazer set to ACCURATE mode (~60 FPS analysis)');
        } else {
            console.warn('Face detector not available');
        }
    },
    
    // Custom configuration
    setCustom: function(config) {
        if (faceLandmarkerDetector && faceLandmarkerDetector.updateConfig) {
            faceLandmarkerDetector.updateConfig(config);
            console.log('🔧 Custom WebGazer config applied:', config);
        } else {
            console.warn('Face detector not available');
        }
    },
    
    // Get current status
    getStatus: function() {
        if (faceLandmarkerDetector && faceLandmarkerDetector.config) {
            const config = faceLandmarkerDetector.config;
            const fps = Math.round(60 / config.analysisInterval);
            console.log('📊 Current WebGazer Performance:', {
                analysisInterval: config.analysisInterval,
                approximateFPS: fps,
                historySize: config.historySize,
                debugLogRate: config.debugLogRate
            });
            return {
                mode: fps > 50 ? 'HIGH_ACCURACY' : fps > 25 ? 'BALANCED' : 'HIGH_PERFORMANCE',
                fps: fps,
                config: config
            };
        } else {
            console.warn('Face detector not available');
            return null;
        }
    }
};

console.log('⚡ WebGazer Performance Controls Available:');
console.log('- WebGazerPerformance.setFast()     // ~20 FPS, best performance');
console.log('- WebGazerPerformance.setBalanced() // ~30 FPS, good balance');
console.log('- WebGazerPerformance.setAccurate() // ~60 FPS, best accuracy');
console.log('- WebGazerPerformance.getStatus()   // Show current settings');
console.log('- WebGazerPerformance.setCustom({analysisInterval: 2}) // Custom config');
