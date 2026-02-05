// face_landmarker.js - Simplified face gesture detection
console.log('Face Landmarker Module Loading...');
console.log('Current window object:', typeof window);
console.log('Document ready state:', document?.readyState || 'undefined');

class FaceLandmarkerDetector {
    constructor() {
        this.isInitialized = false;
        this.video = null;
        this.canvas = null;
        this.ctx = null;
        this.animationFrame = null;
        
        // Simple gesture detection state
        this.previousEyeState = { left: 'open', right: 'open' };
        this.leftEyeState = { current: 'open', lastChange: Date.now(), blinkStartTime: null };
        this.rightEyeState = { current: 'open', lastChange: Date.now(), blinkStartTime: null };
        this.blinkStartTime = null;
        this.previousMouthHeight = 0;
        this.mouthOpenStartTime = null;
        this.headPositionHistory = [];
        
        // Configuration - Optimized for better performance
        this.config = {
            longBlinkThreshold: 800, // ms for long blink
            leftEyeThreshold: 0.25,  // brightness threshold for left eye
            rightEyeThreshold: 0.25, // brightness threshold for right eye
            bothEyesThreshold: 0.25, // brightness threshold for both eyes blink
            mouthOpenThreshold: 0.4, // brightness threshold (not pixel count)
            headShakeThreshold: 15,  // pixels for head movement
            historySize: 8,          // reduced for faster responsiveness
            analysisInterval: 2,     // Skip frames: 1=every frame, 2=every other frame
            debugLogRate: 0.001      // Reduced debug logging frequency (0.1%)
        };
        
        // Performance optimization: cached eye regions
        this.cachedEyeRegions = null;
        this.lastVideoSize = { width: 0, height: 0 };
        this.frameCounter = 0;
        
        // Callbacks
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
        try {
            console.log('Initializing simplified face gesture detector...');
            this.isInitialized = true;
            console.log('Face gesture detector initialized successfully');
            return true;
        } catch (error) {
            console.error('Failed to initialize face detector:', error);
            return false;
        }
    }

    startDetection(videoElement) {
        if (!this.isInitialized) {
            console.error('Face detector not initialized');
            return false;
        }

        this.video = videoElement;
        console.log('Starting face detection on video element:', videoElement);
        
        // Create canvas for analysis
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        
        this.detectGestures();
        return true;
    }

    detectGestures() {
        if (!this.video || this.video.videoWidth === 0 || this.video.videoHeight === 0) {
            this.animationFrame = requestAnimationFrame(() => this.detectGestures());
            return;
        }

        this.frameCounter++;
        
        // Skip frames for better performance (configurable interval)
        if (this.frameCounter % this.config.analysisInterval !== 0) {
            this.animationFrame = requestAnimationFrame(() => this.detectGestures());
            return;
        }

        try {
            // Only resize canvas if video size changed
            if (this.canvas.width !== this.video.videoWidth || this.canvas.height !== this.video.videoHeight) {
                this.canvas.width = this.video.videoWidth;
                this.canvas.height = this.video.videoHeight;
                this.cachedEyeRegions = null; // Invalidate cache
            }
            
            // Draw current frame
            this.ctx.drawImage(this.video, 0, 0);
            
            // Reduced debug logging for better performance
            if (Math.random() < this.config.debugLogRate) {
                console.log('🔍 Face detection (optimized):', {
                    fps: Math.round(60 / this.config.analysisInterval),
                    videoSize: `${this.video.videoWidth}x${this.video.videoHeight}`,
                    frameSkip: this.config.analysisInterval
                });
            }
            
            // Analyze the frame for gestures
            this.analyzeFrame();
            
        } catch (error) {
            console.error('❌ Frame analysis error:', error);
        }

        this.animationFrame = requestAnimationFrame(() => this.detectGestures());
    }

    analyzeFrame() {
        try {
            // Get image data from canvas
            const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
            
            // Debug: Verify we have image data
            if (!imageData || imageData.data.length === 0) {
                console.warn('⚠️ No image data available for analysis');
                return;
            }
            
            // Simple gesture detection based on pixel analysis
            this.detectBlinkFromPixels(imageData);
            this.detectMouthFromPixels(imageData);
            this.detectHeadMovementFromPixels(imageData);
            
        } catch (error) {
            console.error('❌ Error in frame analysis:', error);
        }
    }

    detectBlinkFromPixels(imageData) {
        // Individual eye detection using brightness changes in separate eye regions
        const width = imageData.width;
        const height = imageData.height;
        const now = Date.now();
        
        // Cache eye regions for better performance
        if (!this.cachedEyeRegions || this.lastVideoSize.width !== width || this.lastVideoSize.height !== height) {
            this.cachedEyeRegions = {
                eyeRegionTop: Math.floor(height * 0.35),
                eyeRegionBottom: Math.floor(height * 0.5),
                leftEyeLeft: Math.floor(width * 0.3),
                leftEyeRight: Math.floor(width * 0.45),
                rightEyeLeft: Math.floor(width * 0.55),
                rightEyeRight: Math.floor(width * 0.7)
            };
            this.lastVideoSize = { width, height };
        }
        
        const { eyeRegionTop, eyeRegionBottom, leftEyeLeft, leftEyeRight, rightEyeLeft, rightEyeRight } = this.cachedEyeRegions;
        
        // Calculate brightness for each eye separately (optimized)
        let leftEyeBrightness = this.calculateRegionBrightnessFast(imageData, leftEyeLeft, eyeRegionTop, leftEyeRight, eyeRegionBottom);
        let rightEyeBrightness = this.calculateRegionBrightnessFast(imageData, rightEyeLeft, eyeRegionTop, rightEyeRight, eyeRegionBottom);
        
        // Normalize brightness (0-1 range) - inline for performance
        leftEyeBrightness = leftEyeBrightness * 0.00392157; // 1/255
        rightEyeBrightness = rightEyeBrightness * 0.00392157; // 1/255
        
        // Detect individual eye states
        const leftEyeClosed = leftEyeBrightness < this.config.leftEyeThreshold;
        const rightEyeClosed = rightEyeBrightness < this.config.rightEyeThreshold;
        
        // Reduced debug logging for better performance
        if (Math.random() < this.config.debugLogRate) {
            console.log('👁️ Eye brightness (fast):', {
                left: leftEyeBrightness.toFixed(3),
                right: rightEyeBrightness.toFixed(3),
                states: `L:${this.leftEyeState.current} R:${this.rightEyeState.current}`
            });
        }
        
        // Handle LEFT EYE state changes
        if (leftEyeClosed && this.leftEyeState.current === 'open') {
            this.leftEyeState.current = 'closed';
            this.leftEyeState.lastChange = now;
            this.leftEyeState.blinkStartTime = now;
            
            console.log('👁️ LEFT eye closed');
            this.triggerLeftEyeClosed();
            if (this.onLeftEyeClosed) {
                this.onLeftEyeClosed(now);
            }
            
        } else if (!leftEyeClosed && this.leftEyeState.current === 'closed') {
            const closedDuration = now - this.leftEyeState.blinkStartTime;
            this.leftEyeState.current = 'open';
            this.leftEyeState.lastChange = now;
            
            console.log(`👁️ LEFT eye opened (was closed for ${closedDuration}ms)`);
            this.triggerLeftEyeOpened(closedDuration);
            if (this.onLeftEyeOpened) {
                this.onLeftEyeOpened(closedDuration);
            }
        }
        
        // Handle RIGHT EYE state changes
        if (rightEyeClosed && this.rightEyeState.current === 'open') {
            this.rightEyeState.current = 'closed';
            this.rightEyeState.lastChange = now;
            this.rightEyeState.blinkStartTime = now;
            
            console.log('👁️ RIGHT eye closed');
            this.triggerRightEyeClosed();
            if (this.onRightEyeClosed) {
                this.onRightEyeClosed(now);
            }
            
        } else if (!rightEyeClosed && this.rightEyeState.current === 'closed') {
            const closedDuration = now - this.rightEyeState.blinkStartTime;
            this.rightEyeState.current = 'open';
            this.rightEyeState.lastChange = now;
            
            console.log(`👁️ RIGHT eye opened (was closed for ${closedDuration}ms)`);
            this.triggerRightEyeOpened(closedDuration);
            if (this.onRightEyeOpened) {
                this.onRightEyeOpened(closedDuration);
            }
        }
        
        // Handle traditional BOTH-EYES blink detection for long blinks
        const bothEyesClosed = leftEyeClosed && rightEyeClosed;
        const avgEyeBrightness = (leftEyeBrightness + rightEyeBrightness) / 2;
        
        if (bothEyesClosed && !this.blinkStartTime) {
            this.blinkStartTime = now;
            console.log('👁️ Both eyes closed - long blink timer started');
        } else if (!bothEyesClosed && this.blinkStartTime) {
            const blinkDuration = now - this.blinkStartTime;
            this.blinkStartTime = null;
            
            console.log(`👁️ Both eyes opened - duration: ${blinkDuration}ms`);
            if (blinkDuration > this.config.longBlinkThreshold) {
                console.log('🎯 Long blink detected!');
                this.triggerLongBlink(blinkDuration);
            }
        }
        
        // Update previous eye state for compatibility
        this.previousEyeState = {
            left: leftEyeClosed ? 'closed' : 'open',
            right: rightEyeClosed ? 'closed' : 'open'
        };
    }

    detectMouthFromPixels(imageData) {
        // Improved mouth detection using brightness in mouth region
        const width = imageData.width;
        const height = imageData.height;
        
        // Mouth region (lower portion of face) - better positioning
        const mouthTop = Math.floor(height * 0.65);
        const mouthBottom = Math.floor(height * 0.85);
        const mouthLeft = Math.floor(width * 0.35);
        const mouthRight = Math.floor(width * 0.65);
        
        // Calculate average brightness in mouth region
        let mouthBrightness = 0;
        let pixelCount = 0;
        
        for (let y = mouthTop; y < mouthBottom; y++) {
            for (let x = mouthLeft; x < mouthRight; x++) {
                const idx = (y * width + x) * 4;
                const brightness = (imageData.data[idx] + imageData.data[idx + 1] + imageData.data[idx + 2]) / 3;
                mouthBrightness += brightness;
                pixelCount++;
            }
        }
        
        const avgMouthBrightness = pixelCount > 0 ? mouthBrightness / pixelCount / 255 : 1;
        const mouthOpen = avgMouthBrightness < this.config.mouthOpenThreshold;
        
        // Debug occasionally
        if (Math.random() < 0.005) {
            console.log('👄 Mouth brightness:', {
                brightness: avgMouthBrightness.toFixed(3),
                threshold: this.config.mouthOpenThreshold,
                open: mouthOpen
            });
        }
        
        if (mouthOpen && !this.mouthOpenStartTime) {
            this.mouthOpenStartTime = Date.now();
            console.log('👄 Mouth opened');
        } else if (!mouthOpen && this.mouthOpenStartTime) {
            const duration = Date.now() - this.mouthOpenStartTime;
            console.log(`👄 Mouth closed after ${duration}ms`);
            if (duration > 500) { // Must be open for at least 500ms
                this.triggerMouthOpen(duration);
            }
            this.mouthOpenStartTime = null;
        }
    }

    detectHeadMovementFromPixels(imageData) {
        // Improved head movement detection using face center region
        const width = imageData.width;
        const height = imageData.height;
        
        // Focus on central face region for better tracking
        const centerX = Math.floor(width * 0.5);
        const centerY = Math.floor(height * 0.5);
        const regionSize = Math.floor(Math.min(width, height) * 0.1);
        
        let totalBrightness = 0;
        let weightedX = 0;
        let weightedY = 0;
        
        for (let y = centerY - regionSize; y < centerY + regionSize; y++) {
            for (let x = centerX - regionSize; x < centerX + regionSize; x++) {
                if (x >= 0 && x < width && y >= 0 && y < height) {
                    const idx = (y * width + x) * 4;
                    const brightness = (imageData.data[idx] + imageData.data[idx + 1] + imageData.data[idx + 2]) / 3;
                    totalBrightness += brightness;
                    weightedX += x * brightness;
                    weightedY += y * brightness;
                }
            }
        }
        
        if (totalBrightness > 0) {
            const faceCenterX = weightedX / totalBrightness;
            const faceCenterY = weightedY / totalBrightness;
            
            // Add to history
            this.headPositionHistory.push({ x: faceCenterX, y: faceCenterY, timestamp: Date.now() });
            
            // Debug occasionally
            if (Math.random() < 0.002) {
                console.log('🗣️ Head position:', {
                    x: faceCenterX.toFixed(1),
                    y: faceCenterY.toFixed(1),
                    historySize: this.headPositionHistory.length
                });
            }
            
            // Keep history limited
            if (this.headPositionHistory.length > this.config.historySize) {
                this.headPositionHistory.shift();
            }
            
            // Analyze movement pattern with improved detection
            if (this.headPositionHistory.length >= this.config.historySize) {
                this.analyzeHeadMovement();
            }
        }
    }

    calculateRegionBrightness(imageData, x1, y1, x2, y2) {
        let totalBrightness = 0;
        let pixelCount = 0;
        
        for (let y = y1; y < y2; y++) {
            for (let x = x1; x < x2; x++) {
                const idx = (y * imageData.width + x) * 4;
                const brightness = (imageData.data[idx] + imageData.data[idx + 1] + imageData.data[idx + 2]) / 3;
                totalBrightness += brightness;
                pixelCount++;
            }
        }
        
        return pixelCount > 0 ? totalBrightness / pixelCount : 0;
    }
    
    // Optimized version for frequent eye detection
    calculateRegionBrightnessFast(imageData, x1, y1, x2, y2) {
        let totalBrightness = 0;
        let pixelCount = 0;
        const data = imageData.data;
        const width = imageData.width;
        const stepSize = 2; // Sample every 2nd pixel for speed
        
        for (let y = y1; y < y2; y += stepSize) {
            for (let x = x1; x < x2; x += stepSize) {
                const idx = (y * width + x) * 4;
                // Use luminance formula for more accurate brightness (but faster than RGB average)
                totalBrightness += data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
                pixelCount++;
            }
        }
        
        return pixelCount > 0 ? totalBrightness / pixelCount : 0;
    }

    analyzeHeadMovement() {
        if (this.headPositionHistory.length < this.config.historySize) return;
        
        // Compare recent vs older positions
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
        
        // Debug head movement analysis
        console.log('🗣️ Head movement analysis:', {
            deltaX: deltaX.toFixed(1),
            deltaY: deltaY.toFixed(1),
            threshold: this.config.headShakeThreshold,
            ratio: deltaX > 0 ? (deltaY / deltaX).toFixed(2) : 'N/A'
        });
        
        // Detect horizontal movement (head shake) - must be predominantly horizontal
        if (deltaX > this.config.headShakeThreshold && deltaX > deltaY * 2) {
            console.log('🗣️ Triggering head shake - deltaX:', deltaX, 'deltaY:', deltaY);
            this.triggerShakeHead();
        }
        // Detect vertical movement (nod) - must be predominantly vertical
        else if (deltaY > this.config.headShakeThreshold && deltaY > deltaX * 2) {
            console.log('🗣️ Triggering head nod - deltaX:', deltaX, 'deltaY:', deltaY);
            this.triggerNod();
        }
    }

    // Trigger methods
    triggerLeftEyeClosed() {
        this.showTriggerIndicator('Left Eye Closed', '#FF6B6B');
        
        // Send event to content script
        window.postMessage({
            source: 'face-trigger',
            type: 'leftEyeClosed',
            timestamp: Date.now()
        }, '*');
    }
    
    triggerLeftEyeOpened(duration) {
        this.showTriggerIndicator(`Left Eye Open (${duration}ms)`, '#4ECDC4');
        
        // Send event to content script
        window.postMessage({
            source: 'face-trigger',
            type: 'leftEyeOpened',
            duration: duration,
            timestamp: Date.now()
        }, '*');
    }
    
    triggerRightEyeClosed() {
        this.showTriggerIndicator('Right Eye Closed', '#FF9F43');
        
        // Send event to content script
        window.postMessage({
            source: 'face-trigger',
            type: 'rightEyeClosed',
            timestamp: Date.now()
        }, '*');
    }
    
    triggerRightEyeOpened(duration) {
        this.showTriggerIndicator(`Right Eye Open (${duration}ms)`, '#54A0FF');
        
        // Send event to content script
        window.postMessage({
            source: 'face-trigger',
            type: 'rightEyeOpened',
            duration: duration,
            timestamp: Date.now()
        }, '*');
    }

    triggerLongBlink(duration) {
        console.log(`🎯 GESTURE: Long blink detected (${duration}ms)`);
        if (this.onLongBlink) {
            this.onLongBlink(duration);
        }
        this.showTriggerIndicator('👁️ Long Blink', '#4CAF50');
    }

    triggerMouthOpen(intensity) {
        console.log(`🎯 GESTURE: Mouth open detected (${intensity})`);
        if (this.onMouthOpen) {
            this.onMouthOpen(intensity);
        }
        this.showTriggerIndicator('👄 Mouth Open', '#FF9800');
    }

    triggerNod() {
        console.log('🎯 GESTURE: Head nod detected');
        if (this.onNod) {
            this.onNod();
        }
        this.showTriggerIndicator('↕️ Nod', '#2196F3');
        this.headPositionHistory = []; // Reset to prevent multiple triggers
    }

    triggerShakeHead() {
        console.log('🎯 GESTURE: Head shake detected');
        if (this.onShakeHead) {
            this.onShakeHead();
        }
        this.showTriggerIndicator('↔️ Head Shake', '#E91E63');
        this.headPositionHistory = []; // Reset to prevent multiple triggers
    }

    showTriggerIndicator(text, color) {
        const indicator = document.createElement('div');
        indicator.style.position = 'fixed';
        indicator.style.top = '60px';
        indicator.style.right = '10px';
        indicator.style.zIndex = '99998';
        indicator.style.padding = '10px 15px';
        indicator.style.backgroundColor = color;
        indicator.style.color = 'white';
        indicator.style.borderRadius = '20px';
        indicator.style.fontFamily = 'Arial, sans-serif';
        indicator.style.fontSize = '14px';
        indicator.style.fontWeight = 'bold';
        indicator.style.boxShadow = '0 2px 10px rgba(0,0,0,0.3)';
        indicator.style.transform = 'translateX(100%)';
        indicator.style.transition = 'transform 0.3s ease-out';
        indicator.textContent = text;
        
        document.body.appendChild(indicator);
        
        setTimeout(() => indicator.style.transform = 'translateX(0)', 10);
        
        setTimeout(() => {
            indicator.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (indicator.parentNode) indicator.parentNode.removeChild(indicator);
            }, 300);
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

    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        console.log('🔧 Face detector config updated:', this.config);
    }
    
    // Performance tuning methods
    setHighPerformanceMode() {
        this.updateConfig({
            analysisInterval: 3,     // Skip 2 frames, analyze every 3rd
            historySize: 5,          // Smaller history buffer
            debugLogRate: 0          // No debug logging
        });
        console.log('⚡ High Performance Mode activated - ~20 FPS analysis');
    }
    
    setBalancedMode() {
        this.updateConfig({
            analysisInterval: 2,     // Skip 1 frame, analyze every 2nd
            historySize: 6,          // Medium history buffer
            debugLogRate: 0.001      // Minimal debug logging
        });
        console.log('⚖️ Balanced Mode activated - ~30 FPS analysis');
    }
    
    setHighAccuracyMode() {
        this.updateConfig({
            analysisInterval: 1,     // Analyze every frame
            historySize: 10,         // Larger history buffer
            debugLogRate: 0.005      // More debug logging
        });
        console.log('🎯 High Accuracy Mode activated - ~60 FPS analysis');
    }

    stop() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
        
        this.video = null;
        this.canvas = null;
        this.ctx = null;
        this.blinkStartTime = null;
        this.mouthOpenStartTime = null;
        this.headPositionHistory = [];
        console.log('Face gesture detection stopped');
    }
}

window.FaceLandmarkerDetector = FaceLandmarkerDetector;
console.log('Simplified Face Landmarker Module Loaded Successfully');
console.log('FaceLandmarkerDetector assigned to window:', typeof window.FaceLandmarkerDetector);
console.log('Global FaceLandmarkerDetector available:', typeof FaceLandmarkerDetector);