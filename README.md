# WebGazer Eye Tracking Chrome Extension

A Chrome extension that integrates **WebGazer.js** to enable real-time eye tracking and gaze prediction on any webpage. Track where users are looking with visual feedback through a red gaze dot that follows eye movements.

## Features

- 🎯 **Real-time Eye Tracking**: Uses your webcam to track eye movements and predict gaze location
- 🔴 **Visual Gaze Indicator**: Red dot shows exactly where you're looking on the page  
- 📊 **Continuous Gaze Data**: Stream of gaze coordinates with timestamps
- 🎛️ **Control Panel**: Easy-to-use popup with tracking controls
- 📹 **Video Feedback**: Optional webcam video display for calibration
- 🎚️ **Kalman Filtering**: Smooth gaze predictions with noise reduction
- 💾 **Session Persistence**: Saves calibration data across browser sessions

## How It Works

The extension injects WebGazer.js into webpages and uses:
- **`webgazer.begin()`**: Starts data collection for gaze predictions
- **`webgazer.setGazeListener()`**: Provides continuous gaze coordinates every few milliseconds
- **`webgazer.getCurrentPrediction()`**: Gets instant gaze prediction on demand

## Setup Instructions

### Prerequisites
- Google Chrome browser
- Webcam access permission

### Installation

1. **Clone or Download** this repository to your local machine:
   ```bash
   git clone [repository-url]
   cd iNTUition-v12.0-Project
   ```

2. **Load the Extension**:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable **Developer mode** (toggle in top right)
   - Click **"Load unpacked"** 
   - Select this project folder

3. **Verify Installation**:
   - The extension should appear in your extensions list
   - You'll see the eye tracking icon in your Chrome toolbar

### Usage

1. **Navigate** to any regular website (avoid chrome:// pages)
2. **Click** the extension icon to open the control popup
3. **Click "Start Tracking"** to begin eye tracking
4. **Grant camera permission** when prompted
5. **Look around** - the red dot will follow your gaze!

### Controls
- **Start/Stop Tracking**: Enable/disable eye tracking
- **Show Video Feedback**: Toggle webcam video display
- **Show Prediction Dot**: Toggle the red gaze indicator
- **Continuous Gaze Tracking**: Enable/disable real-time gaze stream
- **Get Current Prediction**: Grab single gaze coordinate

## File Structure

```
├── manifest.json          # Extension configuration
├── popup.html/popup.js     # User interface controls
├── content.js              # Injects scripts into webpages  
├── page_script.js          # WebGazer integration & gaze tracking
├── background.js           # Extension service worker
├── webgazer.js            # WebGazer.js library
└── icons/                 # Extension icons
```

## Development

### Making Changes
1. Edit the relevant files
2. Go to `chrome://extensions/`
3. Click the **refresh icon** next to your extension
4. Test your changes

### Key Components
- **WebGazer Integration**: Implemented in `page_script.js`
- **UI Controls**: Defined in `popup.html` and `popup.js`
- **Script Injection**: Handled by `content.js`
- **Permissions**: Configured in `manifest.json`

## 👨‍💻 Developer Integration

### WebGazer Data Stream API

The extension provides a **global data stream object** that developers can use to access real-time eye tracking and gesture data from any webpage where the extension is active.

#### Accessing the Data Stream

```javascript
// The global object is available at:
window.WebGazerDataStream

// Current data structure:
{
    currentGaze: { x: number, y: number },    // Real-time gaze coordinates
    lastGesture: string,                      // Most recent gesture: "longBlink", "mouthOpen", "nod", "shakeHead", ""
    lastUpdate: number,                       // Timestamp of last update (Date.now())
    isTracking: boolean                       // Whether WebGazer is actively tracking
}
```

#### Real-time Event Listening

```javascript
// Listen for gaze coordinate updates (fires ~30-60 times per second)
window.addEventListener('webgazer-gaze-update', (event) => {
    const { x, y, timestamp } = event.detail;
    console.log(`User looking at: (${x}, ${y}) at ${timestamp}`);
    
    // Your code here - highlight elements, trigger animations, etc.
    highlightElementAtPosition(x, y);
});

// Listen for gesture detection
window.addEventListener('webgazer-gesture-detected', (event) => {
    const { gesture, timestamp } = event.detail;
    console.log(`Gesture detected: ${gesture} at ${timestamp}`);
    
    // Handle different gestures
    switch(gesture) {
        case 'longBlink':
            // User did a long blink - trigger action
            performLongBlinkAction();
            break;
        case 'mouthOpen':
            // User opened mouth - maybe pause/play video
            toggleVideoPlayback();
            break;
        case 'nod':
            // User nodded - confirm action
            confirmCurrentSelection();
            break;
        case 'shakeHead':
            // User shook head - cancel action
            cancelCurrentAction();
            break;
    }
});
```

#### Polling-based Access

```javascript
// For applications that prefer polling over events
function checkGazeData() {
    const dataStream = window.WebGazerDataStream;
    
    if (!dataStream.isTracking) {
        console.log('Eye tracking not active');
        return;
    }
    
    const { x, y } = dataStream.currentGaze;
    const timeSinceUpdate = Date.now() - dataStream.lastUpdate;
    
    if (timeSinceUpdate < 100) { // Data is fresh (within 100ms)
        // Use the gaze coordinates
        updateUIBasedOnGaze(x, y);
    }
    
    if (dataStream.lastGesture) {
        console.log(`Recent gesture: ${dataStream.lastGesture}`);
        // Handle gesture...
        
        // Clear gesture after handling (optional)
        // Note: gesture will be overwritten by next detected gesture
    }
}

// Poll every 50ms
setInterval(checkGazeData, 50);
```

#### Practical Use Cases

**1. Interactive Web Applications**
```javascript
// Highlight elements based on gaze
window.addEventListener('webgazer-gaze-update', (event) => {
    const { x, y } = event.detail;
    const element = document.elementFromPoint(x, y);
    
    // Remove previous highlights
    document.querySelectorAll('.gaze-highlight').forEach(el => {
        el.classList.remove('gaze-highlight');
    });
    
    // Highlight current element
    if (element) {
        element.classList.add('gaze-highlight');
    }
});
```

**2. Gesture-controlled Navigation**
```javascript
window.addEventListener('webgazer-gesture-detected', (event) => {
    const { gesture } = event.detail;
    
    switch(gesture) {
        case 'longBlink':
            // Click the currently gazed-at element
            const { x, y } = window.WebGazerDataStream.currentGaze;
            const target = document.elementFromPoint(x, y);
            if (target && target.click) {
                target.click();
            }
            break;
            
        case 'nod':
            // Scroll down
            window.scrollBy(0, 300);
            break;
            
        case 'shakeHead':
            // Go back in history
            window.history.back();
            break;
    }
});
```

**3. Accessibility Features**
```javascript
// Voice-activated gaze clicking for accessibility
let gazeClickMode = false;

// Toggle gaze click mode with voice command or other input
function toggleGazeClickMode() {
    gazeClickMode = !gazeClickMode;
    console.log('Gaze click mode:', gazeClickMode ? 'ON' : 'OFF');
}

window.addEventListener('webgazer-gesture-detected', (event) => {
    if (!gazeClickMode) return;
    
    if (event.detail.gesture === 'longBlink') {
        // Perform click at current gaze position
        const { x, y } = window.WebGazerDataStream.currentGaze;
        const element = document.elementFromPoint(x, y);
        
        if (element) {
            // Visual feedback
            element.style.outline = '3px solid #ff0000';
            setTimeout(() => element.style.outline = '', 200);
            
            // Trigger click
            element.click();
        }
    }
});
```

#### Error Handling

```javascript
// Check if extension is available
function checkWebGazerAvailability() {
    if (typeof window.WebGazerDataStream === 'undefined') {
        console.warn('WebGazer Data Stream not available. Extension may not be installed or active.');
        return false;
    }
    
    if (!window.WebGazerDataStream.isTracking) {
        console.info('WebGazer is installed but not currently tracking.');
        return false;
    }
    
    return true;
}

// Use with error handling
function safeGazeAction() {
    if (!checkWebGazerAvailability()) {
        // Fallback behavior
        useMouseBasedInteraction();
        return;
    }
    
    // Use gaze data
    const { x, y } = window.WebGazerDataStream.currentGaze;
    // ... your code
}
```

### Integration Best Practices

1. **Always check availability** before using the data stream
2. **Handle missing data gracefully** - provide mouse/keyboard fallbacks  
3. **Respect user privacy** - don't store or transmit gaze data without consent
4. **Optimize performance** - avoid heavy processing in gaze update handlers
5. **Test thoroughly** - eye tracking accuracy varies between users and setups

## Troubleshooting

### Common Issues
- **"Content script not detected"**: Refresh the webpage and try again
- **Camera not working**: Check browser camera permissions
- **Extension won't load**: Verify all files are present and check console errors
- **Gaze tracking inaccurate**: Look directly at the screen during initial calibration

### Debug Console
Check browser console (F12) for detailed logging:
- Gaze coordinates and timestamps
- WebGazer initialization status  
- Error messages and debugging info

## Attribution & Credits

### WebGazer.js
This extension uses **WebGazer.js** - an open source eye tracking library:
- **Authors**: Alexandra Papoutsaki, Patsorn Sangkloy, James Laskey, Nediyana Daskalova, Jeff Huang, and James Hays
- **Paper**: "WebGazer: Scalable Webcam Eye Tracking Using User Interactions" (IJCAI 2016)
- **License**: GPL-3.0
- **Repository**: https://github.com/brownhci/WebGazer
- **Website**: https://webgazer.cs.brown.edu/

### Citation
If you use this extension in research, please cite the original WebGazer.js paper:
```bibtex
@inproceedings{papoutsaki2016webgazer,
  title={WebGazer: Scalable Webcam Eye Tracking Using User Interactions},
  author={Papoutsaki, Alexandra and Sangkloy, Patsorn and Laskey, James and Daskalova, Nediyana and Huang, Jeff and Hays, James},
  booktitle={Proceedings of the Twenty-Fifth International Joint Conference on Artificial Intelligence-IJCAI 2016},
  year={2016},
  organization={IJCAI}
}
```

## Privacy & Security

- **Camera Access**: Only used locally for eye tracking, no data sent to servers
- **No Data Collection**: Gaze data stays in your browser session
- **Local Processing**: All eye tracking computation happens on your device
- **Session Storage**: Calibration data saved locally to improve accuracy

## License

This Chrome extension implementation is provided as-is for educational and research purposes. WebGazer.js is licensed under GPL-3.0. Please respect the original licenses when using or redistributing.

## Contributing

Feel free to submit issues, feature requests, or pull requests to improve the extension!

---

*Built with ❤️ using WebGazer.js for real-time eye tracking in the browser*