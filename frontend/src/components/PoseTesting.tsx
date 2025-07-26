import React, { useEffect, useRef, useState } from 'react';

interface PoseKeypoint {
  x: number;
  y: number;
  score: number;
  name: string;
}

interface Pose {
  keypoints: PoseKeypoint[];
  score: number;
}

interface Prediction {
  label: string;
  confidence: number;
}

declare global {
  interface Window {
    ml5: any;
  }
}

const PoseTesting: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [poseNet, setPoseNet] = useState<any>(null);
  const [neuralNetwork, setNeuralNetwork] = useState<any>(null);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [currentPose, setCurrentPose] = useState<Pose | null>(null);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [isClassifying, setIsClassifying] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  // Initialize models
  useEffect(() => {
    const initModels = async () => {
      try {
        if (window.ml5) {
          // Initialize MoveNet
          const poseModel = await window.ml5.pose('MoveNet', {
            modelType: 'lightning',
            enableSmoothing: true,
            enableTracking: true,
            minPoseScore: 0.3
          });
          setPoseNet(poseModel);

          // Try to load existing neural network model
          try {
            const nn = window.ml5.neuralNetwork('bjj-pose-model', () => {
              setNeuralNetwork(nn);
              setIsModelLoaded(true);
              addLog('Trained model loaded successfully');
            }, () => {
              addLog('No trained model found. Please train a model first.');
              setIsModelLoaded(false);
            });
          } catch (error) {
            addLog('Error loading trained model: ' + error);
            setIsModelLoaded(false);
          }
        }
      } catch (error) {
        console.error('Error loading models:', error);
        addLog('Error loading models: ' + error);
      }
    };

    initModels();
  }, []);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  // Start video stream
  const startVideo = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: 640,
          height: 480,
          facingMode: 'user'
        }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setIsDetecting(true);
        addLog('Video stream started');
      }
    } catch (error) {
      console.error('Error accessing webcam:', error);
      addLog('Error accessing webcam: ' + error);
    }
  };

  // Stop video stream
  const stopVideo = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setIsDetecting(false);
      setCurrentPose(null);
      setPrediction(null);
      addLog('Video stream stopped');
    }
  };

  // Draw skeleton on canvas
  const drawSkeleton = (ctx: CanvasRenderingContext2D, pose: Pose) => {
    const keypoints = pose.keypoints;
    
    const connections = [
      ['nose', 'leftEye'], ['nose', 'rightEye'],
      ['leftEye', 'leftEar'], ['rightEye', 'rightEar'],
      ['leftShoulder', 'rightShoulder'],
      ['leftShoulder', 'leftElbow'], ['rightShoulder', 'rightElbow'],
      ['leftElbow', 'leftWrist'], ['rightElbow', 'rightWrist'],
      ['leftShoulder', 'leftHip'], ['rightShoulder', 'rightHip'],
      ['leftHip', 'rightHip'],
      ['leftHip', 'leftKnee'], ['rightHip', 'rightKnee'],
      ['leftKnee', 'leftAnkle'], ['rightKnee', 'rightAnkle']
    ];

    // Draw connections
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;
    
    connections.forEach(([start, end]) => {
      const startPoint = keypoints.find(kp => kp.name === start);
      const endPoint = keypoints.find(kp => kp.name === end);
      
      if (startPoint && endPoint && startPoint.score > 0.3 && endPoint.score > 0.3) {
        ctx.beginPath();
        ctx.moveTo(startPoint.x, startPoint.y);
        ctx.lineTo(endPoint.x, endPoint.y);
        ctx.stroke();
      }
    });

    // Draw keypoints
    keypoints.forEach(keypoint => {
      if (keypoint.score > 0.3) {
        ctx.fillStyle = keypoint.score > 0.7 ? '#ff0000' : '#ffaa00';
        ctx.beginPath();
        ctx.arc(keypoint.x, keypoint.y, 4, 0, 2 * Math.PI);
        ctx.fill();
      }
    });
  };

  // Classify pose
  const classifyPose = async (pose: Pose) => {
    if (!neuralNetwork || !isClassifying) {
      return;
    }

    try {
      const keypoints = pose.keypoints;
      const input = keypoints.flatMap(kp => [kp.x, kp.y]); // Flatten to 34 values
      
      const result = await neuralNetwork.classify(input);
      
      if (result && result.length > 0) {
        const topResult = result[0];
        setPrediction({
          label: topResult.label,
          confidence: topResult.confidence
        });
      }
    } catch (error) {
      console.error('Error classifying pose:', error);
    }
  };

  // Pose detection and classification loop
  useEffect(() => {
    let animationId: number;

    const detectAndClassify = async () => {
      if (!poseNet || !videoRef.current || !canvasRef.current) {
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      if (!ctx || video.readyState !== 4) {
        animationId = requestAnimationFrame(detectAndClassify);
        return;
      }

      // Set canvas size
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      try {
        // Detect poses
        const detectedPoses = await poseNet.predict(video);
        
        if (detectedPoses.length > 0) {
          const pose = detectedPoses[0]; // Use first detected pose
          setCurrentPose(pose);
          
          // Draw skeleton
          drawSkeleton(ctx, pose);

          // Classify pose if model is loaded and classification is enabled
          if (isModelLoaded && isClassifying && pose.score > 0.5) {
            await classifyPose(pose);
          }
        } else {
          setCurrentPose(null);
          setPrediction(null);
        }

      } catch (error) {
        console.error('Error detecting pose:', error);
      }

      animationId = requestAnimationFrame(detectAndClassify);
    };

    if (isDetecting) {
      detectAndClassify();
    }

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [poseNet, isDetecting, isModelLoaded, isClassifying]);

  // Toggle classification
  const toggleClassification = () => {
    setIsClassifying(!isClassifying);
    if (!isClassifying) {
      addLog('Pose classification started');
    } else {
      addLog('Pose classification stopped');
      setPrediction(null);
    }
  };

  // Reset classification
  const resetClassification = () => {
    setPrediction(null);
    addLog('Classification reset');
  };

  return (
    <div className="component-container">
      <h2>Pose Testing</h2>
      
      <div className="status-display">
        <h3>Status</h3>
        <p>Models: {isModelLoaded ? 'Loaded' : 'Not Found'}</p>
        <p>Detection: {isDetecting ? 'Active' : 'Inactive'}</p>
        <p>Classification: {isClassifying ? 'Active' : 'Inactive'}</p>
        {currentPose && (
          <p>Pose Confidence: {Math.round(currentPose.score * 100)}%</p>
        )}
      </div>

      <div className="controls">
        {!isDetecting ? (
          <button className="btn btn-primary" onClick={startVideo}>
            Start Detection
          </button>
        ) : (
          <button className="btn btn-danger" onClick={stopVideo}>
            Stop Detection
          </button>
        )}
        {isModelLoaded && (
          <button 
            className={`btn ${isClassifying ? 'btn-danger' : 'btn-success'}`}
            onClick={toggleClassification}
            disabled={!isDetecting}
          >
            {isClassifying ? 'Stop Classification' : 'Start Classification'}
          </button>
        )}
        <button 
          className="btn btn-secondary" 
          onClick={resetClassification}
          disabled={!isClassifying}
        >
          Reset
        </button>
      </div>

      <div className="video-container">
        <video
          ref={videoRef}
          className="video-element"
          autoPlay
          muted
          playsInline
        />
        <canvas
          ref={canvasRef}
          className="canvas-overlay"
        />
      </div>

      {prediction && (
        <div className="pose-info">
          <div className="pose-label">
            Detected: {prediction.label}
          </div>
          <div className="confidence-score">
            {Math.round(prediction.confidence * 100)}%
          </div>
        </div>
      )}

      {!isModelLoaded && (
        <div className="status-display">
          <h3>No Trained Model Found</h3>
          <p>Please go to the "Pose Training" tab to train a model first.</p>
        </div>
      )}

      <div className="log-section">
        <h3>Activity Log</h3>
        {logs.map((log, index) => (
          <div key={index}>{log}</div>
        ))}
      </div>
    </div>
  );
};

export default PoseTesting; 