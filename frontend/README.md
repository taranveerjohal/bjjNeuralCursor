# Pose Detection & Training App

A React application that uses ml5.js BodyPose (MoveNet) for real-time human pose detection and custom pose training.

## Features

- **Real-time Pose Detection**: Detect multiple humans with skeleton overlay
- **Custom Pose Training**: Record 10-second samples of different poses
- **Neural Network Training**: Train a custom classifier using recorded data
- **Live Prediction**: Test trained model with real-time predictions
- **Modern UI**: Built with React, TypeScript, and Tailwind CSS

## Technology Stack

- **Frontend**: React 18 + TypeScript
- **Bundler**: Vite
- **Styling**: Tailwind CSS
- **ML Library**: ml5.js (BodyPose with MoveNet)
- **Pose Detection**: MoveNet model for real-time human pose estimation

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Modern web browser with camera access

### Installation

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
   npm run dev
   ```

4. Open your browser and navigate to `http://localhost:5173`

### Usage

#### 1. Pose Detection
- Start with the "Pose Detection" tab
- Allow camera access when prompted
- Move around to see real-time pose detection with skeleton overlay
- The app can detect multiple people simultaneously

#### 2. Training Data Collection
- Switch to the "Training" tab
- Enter a label for the pose you want to train (e.g., "wave", "jump", "squat")
- Click "Start Recording" to begin a 10-second recording session
- Perform the pose consistently during the countdown
- Repeat for different poses to create a diverse training dataset

#### 3. Model Training
- Go to the "Model" tab
- Review your training data (number of samples and unique poses)
- Click "Train Model" to train the neural network
- Monitor training progress and accuracy

#### 4. Live Prediction
- After training, click "Start Prediction"
- Perform poses in front of the camera
- View real-time predictions with confidence scores
- Stop prediction when done

## Technical Details

### Pose Detection
- Uses ml5.js BodyPose with MoveNet model
- Detects 17 keypoints per person
- Supports multiple people detection
- Real-time skeleton drawing with confidence thresholds

### Training Data
- Records pose keypoints at 10fps during 10-second sessions
- Stores normalized keypoint coordinates (x, y, score)
- Supports multiple pose classes
- Data is stored in memory (not persisted)

### Neural Network
- Uses ml5.js neural network for classification
- Input: Flattened keypoint coordinates
- Output: One-hot encoded pose labels
- Training parameters: 50 epochs, 32 batch size, 20% validation split

### Keypoint Connections
The skeleton drawing connects the following keypoints:
- Head: nose, eyes, ears
- Torso: shoulders, hips
- Arms: shoulders, elbows, wrists
- Legs: hips, knees, ankles

## Browser Compatibility

- Chrome/Chromium (recommended)
- Firefox
- Safari
- Edge

**Note**: Camera access requires HTTPS in production environments.

## Development

### Project Structure
```
src/
├── components/
│   ├── PoseDetection.tsx    # Camera feed and pose detection
│   ├── Training.tsx         # Training data collection
│   └── Model.tsx           # Neural network training and prediction
├── types/
│   └── pose.ts             # TypeScript interfaces
├── App.tsx                 # Main application component
└── main.tsx               # Application entry point
```

### Key Components

#### PoseDetection
- Manages webcam stream
- Initializes ml5.js BodyPose model
- Handles real-time pose detection
- Draws skeleton overlay on canvas

#### Training
- Records pose data during 10-second sessions
- Manages training data collection
- Provides countdown and progress feedback

#### Model
- Initializes ml5.js neural network
- Handles model training with progress tracking
- Manages real-time predictions
- Displays prediction results with confidence scores

## Troubleshooting

### Camera Access Issues
- Ensure your browser supports getUserMedia API
- Check camera permissions in browser settings
- Try refreshing the page if camera doesn't start

### Model Training Issues
- Ensure you have recorded sufficient training data
- Try recording more samples for better accuracy
- Check browser console for error messages

### Performance Issues
- Close other applications using the camera
- Reduce browser window size if needed
- Ensure adequate lighting for better pose detection

## Future Enhancements

- [ ] Persist training data to localStorage
- [ ] Export/import trained models
- [ ] Support for video file upload
- [ ] Advanced pose analysis and scoring
- [ ] Real-time pose comparison
- [ ] Mobile-responsive design improvements
- [ ] Sound alerts and notifications
- [ ] Pose replay functionality

## License

This project is open source and available under the MIT License.

## Acknowledgments

- [ml5.js](https://ml5js.org/) - Machine learning library
- [MoveNet](https://blog.tensorflow.org/2021/05/next-generation-pose-detection-with-movenet-and-tensorflowjs.html) - Pose detection model
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
- [React](https://reactjs.org/) - JavaScript library for building user interfaces
