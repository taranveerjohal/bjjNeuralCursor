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
  const [fps, setFps] = useState<number>(0);
  const [predictionHistory, setPredictionHistory] = useState<Prediction[]>([]);

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

  // Enhanced skeleton drawing for testing with classification feedback
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

    // Dynamic colors based on prediction confidence
    let skeletonColor = '#2ed573'; // Default green
    let jointColor = '#26de81';
    
    if (prediction && isClassifying) {
      if (prediction.confidence > 0.8) {
        skeletonColor = '#00d2d3'; // High confidence - cyan
        jointColor = '#00a8b3';
      } else if (prediction.confidence > 0.6) {
        skeletonColor = '#ffa726'; // Medium confidence - orange
        jointColor = '#ff9800';
      } else {
        skeletonColor = '#ff4757'; // Low confidence - red
        jointColor = '#ff3838';
      }
    }

    // Draw connections with enhanced visualization
    ctx.strokeStyle = skeletonColor;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    
    connections.forEach(([start, end]) => {
      const startPoint = keypoints.find(kp => kp.name === start);
      const endPoint = keypoints.find(kp => kp.name === end);
      
      if (startPoint && endPoint && startPoint.score > 0.3 && endPoint.score > 0.3) {
        const avgConfidence = (startPoint.score + endPoint.score) / 2;
        ctx.globalAlpha = Math.max(0.7, avgConfidence);
        
        ctx.beginPath();
        ctx.moveTo(startPoint.x, startPoint.y);
        ctx.lineTo(endPoint.x, endPoint.y);
        ctx.stroke();
      }
    });

    ctx.globalAlpha = 1.0;

    // Draw keypoints with enhanced visualization
    keypoints.forEach(keypoint => {
      if (keypoint.score > 0.3) {
        const radius = keypoint.score > 0.7 ? 7 : 5;
        
        // Outer circle
        ctx.fillStyle = jointColor;
        ctx.beginPath();
        ctx.arc(keypoint.x, keypoint.y, radius, 0, 2 * Math.PI);
        ctx.fill();
        
        // Inner circle
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(keypoint.x, keypoint.y, radius - 2, 0, 2 * Math.PI);
        ctx.fill();
      }
    });
    
    // Draw classification indicator
    if (isClassifying) {
      // Pulsing classification indicator
      const pulseSize = 12 + Math.sin(Date.now() / 300) * 3;
      ctx.fillStyle = prediction ? '#00d2d3' : '#6c757d';
      ctx.beginPath();
      ctx.arc(30, 30, pulseSize, 0, 2 * Math.PI);
      ctx.fill();
      
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px Arial';
      ctx.fillText('AI', 25, 35);
    }
    
    // Draw pose info overlay
    const overlayHeight = prediction ? 100 : 60;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(10, ctx.canvas.height - overlayHeight - 10, 280, overlayHeight);
    
    // Pose confidence
    ctx.fillStyle = '#ffffff';
    ctx.font = '14px Arial';
    ctx.fillText(`Pose Confidence: ${Math.round(pose.score * 100)}%`, 20, ctx.canvas.height - overlayHeight + 5);
    
    // FPS
    ctx.fillText(`FPS: ${fps}`, 20, ctx.canvas.height - overlayHeight + 25);
    
    // Classification result
    if (prediction && isClassifying) {
      ctx.font = 'bold 16px Arial';
      const confidenceColor = prediction.confidence > 0.8 ? '#00d2d3' : 
                              prediction.confidence > 0.6 ? '#ffa726' : '#ff4757';
      ctx.fillStyle = confidenceColor;
      ctx.fillText(`Detected: ${prediction.label}`, 20, ctx.canvas.height - overlayHeight + 50);
      
      ctx.font = '12px Arial';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`Confidence: ${Math.round(prediction.confidence * 100)}%`, 20, ctx.canvas.height - overlayHeight + 70);
    } else if (isClassifying) {
      ctx.fillStyle = '#ffa726';
      ctx.fillText('Analyzing pose...', 20, ctx.canvas.height - overlayHeight + 50);
    }
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
        const newPrediction = {
          label: topResult.label,
          confidence: topResult.confidence
        };
        
        setPrediction(newPrediction);
        
        // Add to prediction history for analysis
        setPredictionHistory(prev => {
          const newHistory = [...prev, newPrediction].slice(-10); // Keep last 10 predictions
          return newHistory;
        });
        
        // Log high-confidence predictions
        if (topResult.confidence > 0.8) {
          addLog(`🎯 High confidence detection: ${topResult.label} (${Math.round(topResult.confidence * 100)}%)`);
        }
      }
    } catch (error) {
      console.error('Error classifying pose:', error);
    }
  };

  // Pose detection and classification loop with FPS tracking
  useEffect(() => {
    let animationId: number;
    let lastTime = 0;
    let frameCount = 0;

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
        
        // Calculate FPS
        const currentTime = performance.now();
        frameCount++;
        if (currentTime - lastTime >= 1000) {
          setFps(Math.round((frameCount * 1000) / (currentTime - lastTime)));
          frameCount = 0;
          lastTime = currentTime;
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
        <h3>📊 Testing Status</h3>
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem'}}>
          <div>
            <strong>Models:</strong> <span style={{color: isModelLoaded ? '#28a745' : '#dc3545'}}>
              {isModelLoaded ? '✅ Loaded' : '❌ Not Found'}
            </span>
          </div>
          <div>
            <strong>Detection:</strong> <span style={{color: isDetecting ? '#28a745' : '#6c757d'}}>
              {isDetecting ? '📹 Active' : '⚫ Inactive'}
            </span>
          </div>
          <div>
            <strong>Classification:</strong> <span style={{color: isClassifying ? '#007bff' : '#6c757d'}}>
              {isClassifying ? '🤖 Active' : '💤 Inactive'}
            </span>
          </div>
          <div>
            <strong>FPS:</strong> <span style={{color: fps > 15 ? '#28a745' : fps > 10 ? '#ffc107' : '#dc3545'}}>
              📹 {fps}
            </span>
          </div>
        </div>
        
        {currentPose && (
          <div style={{marginTop: '1rem', padding: '0.5rem', background: '#f8f9fa', borderRadius: '5px'}}>
            <strong>Current Pose:</strong>
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.5rem', marginTop: '0.5rem'}}>
              <div>Confidence: <span style={{color: currentPose.score > 0.7 ? '#28a745' : currentPose.score > 0.5 ? '#ffc107' : '#dc3545'}}>
                {Math.round(currentPose.score * 100)}%
              </span></div>
              <div>Keypoints: {currentPose.keypoints.filter(kp => kp.score > 0.3).length}/{currentPose.keypoints.length}</div>
            </div>
          </div>
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
        <div className="pose-info" style={{
          background: prediction.confidence > 0.8 ? '#e8f5e8' : 
                     prediction.confidence > 0.6 ? '#fff3e0' : '#ffebee',
          border: `2px solid ${prediction.confidence > 0.8 ? '#4caf50' : 
                               prediction.confidence > 0.6 ? '#ff9800' : '#f44336'}`
        }}>
          <div className="pose-label" style={{
            color: prediction.confidence > 0.8 ? '#2e7d32' : 
                   prediction.confidence > 0.6 ? '#f57c00' : '#c62828'
          }}>
            🎯 Detected: {prediction.label}
          </div>
          <div className="confidence-score" style={{
            background: prediction.confidence > 0.8 ? '#4caf50' : 
                       prediction.confidence > 0.6 ? '#ff9800' : '#f44336'
          }}>
            {Math.round(prediction.confidence * 100)}%
          </div>
        </div>
      )}
      
      {predictionHistory.length > 0 && isClassifying && (
        <div className="status-display">
          <h3>📈 Recent Predictions</h3>
          <div style={{display: 'grid', gap: '0.5rem', maxHeight: '150px', overflowY: 'auto'}}>
            {predictionHistory.slice(-5).reverse().map((pred, index) => (
              <div key={index} style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '0.25rem 0.5rem',
                background: pred.confidence > 0.7 ? '#d4edda' : '#fff3cd',
                borderRadius: '3px',
                fontSize: '0.9rem'
              }}>
                <span>{pred.label}</span>
                <span>{Math.round(pred.confidence * 100)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!isModelLoaded && (
        <div className="status-display" style={{background: '#ffebee', border: '1px solid #f44336'}}>
          <h3 style={{color: '#c62828'}}>⚠️ No Trained Model Found</h3>
          <p>Please go to the <strong>"Pose Training"</strong> tab to train a model first.</p>
          <div style={{marginTop: '1rem', padding: '1rem', background: '#f8f9fa', borderRadius: '5px'}}>
            <h4 style={{marginBottom: '0.5rem'}}>📝 Quick Start Guide:</h4>
            <ol style={{marginLeft: '1rem'}}>
              <li>Go to the "Pose Training" tab</li>
              <li>Start your video and enter pose labels (e.g., "Guard", "Mount", "Side Control")</li>
              <li>Record 10+ samples for each pose you want to detect</li>
              <li>Train the model by clicking "Train Model"</li>
              <li>Return here to test your trained model!</li>
            </ol>
          </div>
        </div>
      )}

      <div className="log-section">
        <h3>📝 Activity Log</h3>
        <div style={{maxHeight: '200px', overflowY: 'auto'}}>
          {logs.length === 0 ? (
            <p style={{color: '#6c757d', fontStyle: 'italic'}}>No activity yet. Start detection and classification to see logs here.</p>
          ) : (
            logs.map((log, index) => (
              <div key={index} style={{
                padding: '0.25rem 0',
                borderBottom: index < logs.length - 1 ? '1px solid #eee' : 'none',
                fontSize: '0.9rem'
              }}>
                {log}
              </div>
            ))
          )}
        </div>
        {logs.length > 0 && (
          <button 
            className="btn btn-secondary" 
            onClick={() => setLogs([])} 
            style={{marginTop: '0.5rem', fontSize: '0.8rem', padding: '0.25rem 0.5rem'}}
          >
            Clear Log
          </button>
        )}
      </div>
    </div>
  );
};

export default PoseTesting; 