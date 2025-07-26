# BJJ Pose Detection App

A browser-based web application for real-time pose detection and pose classification training using ml5.js, React, and TypeScript.

## Features

### 🎯 Live Pose Detection
- Real-time pose detection using MoveNet model
- Multiple person detection support
- Skeleton visualization with confidence indicators
- FPS monitoring and performance metrics

### 🏋️ Pose Training
- Collect pose samples for custom poses (e.g., "Armbar", "Triangle Choke")
- Real-time pose recording with visual feedback
- Neural network training using ml5.js
- Training progress monitoring and logging
- Model saving and persistence

### 🧠 Pose Testing
- Load trained models for pose classification
- Real-time pose prediction with confidence scores
- Visual feedback for detected poses
- Activity logging and status monitoring

## Tech Stack

- **Frontend Framework**: React with TypeScript
- **Pose Detection**: ml5.js MoveNet model
- **Neural Network**: ml5.js NeuralNetwork API
- **Camera Access**: HTML5 getUserMedia
- **UI Routing**: React Router
- **Styling**: Custom CSS with modern design

## Installation

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
```

4. Open your browser and navigate to `http://localhost:3000`

## Usage

### Live Detection Tab
1. Click "Start Detection" to activate your webcam
2. The app will automatically detect poses and draw skeletons
3. Monitor FPS and detection metrics in the status panel
4. Click "Stop Detection" to end the session

### Pose Training Tab
1. Enter a pose label (e.g., "Armbar", "Triangle Choke", "Guard Pass")
2. Click "Start Video" to activate your webcam
3. Click "Start Recording" to begin collecting pose samples
4. Perform the pose multiple times to collect sufficient data
5. Click "Stop Recording" when done
6. Repeat for different poses
7. Click "Train Model" to train the neural network
8. Monitor training progress in the log section

### Pose Testing Tab
1. Ensure you have trained a model in the Training tab
2. Click "Start Detection" to activate your webcam
3. Click "Start Classification" to begin pose prediction
4. Perform poses to see real-time classification results
5. Monitor confidence scores and predictions

## Data Format

### Input to Classifier
- Flattened array of 34 values (17 keypoints × x and y coordinates)
- Example: `[nose_x, nose_y, leftEye_x, leftEye_y, ... rightAnkle_x, rightAnkle_y]`

### Output
- String label (e.g., "Triangle Choke")
- Confidence score (0 to 1)

## Key Features

### Multi-Person Detection
- Supports detection of multiple people simultaneously
- Individual skeleton tracking for each person
- Confidence-based visualization

### Real-Time Performance
- Optimized for real-time processing
- FPS monitoring and performance metrics
- Efficient canvas rendering

### Model Persistence
- Trained models are automatically saved to browser storage
- Models persist between sessions
- No backend required - everything runs client-side

### Visual Feedback
- Color-coded skeleton joints (red for high confidence, orange for medium)
- Real-time pose confidence indicators
- Training progress visualization
- Classification results with confidence scores

## Browser Compatibility

- Chrome (recommended)
- Firefox
- Safari
- Edge

**Note**: Requires camera permissions and WebGL support.

## Troubleshooting

### Camera Access Issues
- Ensure camera permissions are granted
- Try refreshing the page
- Check browser settings for camera access

### Model Loading Issues
- Ensure stable internet connection for initial model download
- Check browser console for error messages
- Try refreshing the page

### Performance Issues
- Close other browser tabs
- Reduce video resolution if needed
- Ensure adequate system resources

## Development

### Project Structure
```
frontend/
├── public/
│   └── index.html
├── src/
│   ├── components/
│   │   ├── LiveDetection.tsx
│   │   ├── PoseTraining.tsx
│   │   └── PoseTesting.tsx
│   ├── App.tsx
│   ├── App.css
│   ├── index.tsx
│   └── index.css
├── package.json
└── tsconfig.json
```

### Key Dependencies
- `react`: UI framework
- `react-router-dom`: Navigation
- `ml5.js`: Machine learning library (loaded via CDN)
- `typescript`: Type safety

## License

This project is open source and available under the MIT License. 