import React, { useEffect, useRef, useState } from 'react';

interface TrainingSample {
  input: number[];
  output: string;
}

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

declare global {
  interface Window {
    ml5: any;
  }
}

const PoseTraining: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [poseNet, setPoseNet] = useState<any>(null);
  const [neuralNetwork, setNeuralNetwork] = useState<any>(null);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTraining, setIsTraining] = useState(false);
  const [poseLabel, setPoseLabel] = useState('');
  const [trainingData, setTrainingData] = useState<TrainingSample[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [currentPose, setCurrentPose] = useState<Pose | null>(null);

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

          // Initialize Neural Network
          const nn = window.ml5.neuralNetwork({
            task: 'classification',
            debug: true
          });
          setNeuralNetwork(nn);
          setIsModelLoaded(true);
          addLog('Models loaded successfully');
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
      addLog('Video stream stopped');
    }
  };

  // Start recording pose samples
  const startRecording = () => {
    if (!poseLabel.trim()) {
      alert('Please enter a pose label first');
      return;
    }
    setIsRecording(true);
    addLog(`Started recording samples for: ${poseLabel}`);
  };

  // Stop recording pose samples
  const stopRecording = () => {
    setIsRecording(false);
    addLog(`Stopped recording. Total samples for ${poseLabel}: ${trainingData.filter(sample => sample.output === poseLabel).length}`);
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

  // Pose detection and recording loop
  useEffect(() => {
    let animationId: number;

    const detectAndRecord = async () => {
      if (!poseNet || !videoRef.current || !canvasRef.current) {
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      if (!ctx || video.readyState !== 4) {
        animationId = requestAnimationFrame(detectAndRecord);
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

          // Record sample if recording
          if (isRecording && pose.score > 0.5) {
            const keypoints = pose.keypoints as PoseKeypoint[];
            const input = keypoints.flatMap(kp => [kp.x, kp.y]); // Flatten to 34 values
            
            const newSample: TrainingSample = {
              input,
              output: poseLabel
            };
            
            setTrainingData(prev => [...prev, newSample]);
          }
        } else {
          setCurrentPose(null);
        }

      } catch (error) {
        console.error('Error detecting pose:', error);
      }

      animationId = requestAnimationFrame(detectAndRecord);
    };

    if (isModelLoaded) {
      detectAndRecord();
    }

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [poseNet, isModelLoaded, isRecording, poseLabel]);

  // Train the neural network
  const trainModel = async () => {
    if (!neuralNetwork || trainingData.length === 0) {
      alert('No training data available. Please record some poses first.');
      return;
    }

    setIsTraining(true);
    addLog('Starting model training...');

    try {
      // Add training data to neural network
      trainingData.forEach((sample, index) => {
        neuralNetwork.addData(sample.input, sample.output);
        if (index % 10 === 0) {
          addLog(`Added ${index + 1}/${trainingData.length} samples`);
        }
      });

      // Train the model
      neuralNetwork.normalizeData();
      
      const trainingOptions = {
        epochs: 50,
        batchSize: 32
      };

      neuralNetwork.train(trainingOptions, (epoch: any) => {
        if (epoch && epoch.logs) {
          addLog(`Epoch ${epoch.epoch}: loss=${epoch.logs.loss.toFixed(4)}, accuracy=${epoch.logs.acc.toFixed(4)}`);
        }
      }, () => {
        addLog('Training completed!');
        setIsTraining(false);
        
        // Save model
        neuralNetwork.save('bjj-pose-model', () => {
          addLog('Model saved successfully');
        });
      });

    } catch (error) {
      console.error('Error training model:', error);
      addLog('Error training model: ' + error);
      setIsTraining(false);
    }
  };

  // Clear training data
  const clearData = () => {
    setTrainingData([]);
    addLog('Training data cleared');
  };

  // Get sample counts by label
  const getSampleCounts = () => {
    const counts: { [key: string]: number } = {};
    trainingData.forEach(sample => {
      counts[sample.output] = (counts[sample.output] || 0) + 1;
    });
    return counts;
  };

  return (
    <div className="component-container">
      <h2>Pose Training</h2>
      
      <div className="status-display">
        <h3>Status</h3>
        <p>Models: {isModelLoaded ? 'Loaded' : 'Loading...'}</p>
        <p>Recording: {isRecording ? 'Active' : 'Inactive'}</p>
        <p>Training: {isTraining ? 'In Progress' : 'Idle'}</p>
        <p>Total Samples: {trainingData.length}</p>
      </div>

      <div className="input-group">
        <label htmlFor="poseLabel">Pose Label:</label>
        <input
          id="poseLabel"
          type="text"
          value={poseLabel}
          onChange={(e) => setPoseLabel(e.target.value)}
          placeholder="e.g., Armbar, Triangle Choke, Guard Pass"
          disabled={isRecording}
        />
      </div>

      <div className="controls">
        <button className="btn btn-primary" onClick={startVideo}>
          Start Video
        </button>
        <button className="btn btn-secondary" onClick={stopVideo}>
          Stop Video
        </button>
        {!isRecording ? (
          <button 
            className="btn btn-success" 
            onClick={startRecording}
            disabled={!poseLabel.trim() || !isModelLoaded}
          >
            Start Recording
          </button>
        ) : (
          <button className="btn btn-danger" onClick={stopRecording}>
            Stop Recording
          </button>
        )}
        <button 
          className="btn btn-primary" 
          onClick={trainModel}
          disabled={trainingData.length === 0 || isTraining}
        >
          {isTraining ? 'Training...' : 'Train Model'}
        </button>
        <button className="btn btn-secondary" onClick={clearData}>
          Clear Data
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

      {currentPose && (
        <div className="status-display">
          <h3>Current Pose</h3>
          <p>Confidence: {Math.round(currentPose.score * 100)}%</p>
          <p>Keypoints: {currentPose.keypoints.filter(kp => kp.score > 0.3).length}/{currentPose.keypoints.length}</p>
        </div>
      )}

      {Object.keys(getSampleCounts()).length > 0 && (
        <div className="status-display">
          <h3>Training Data Summary</h3>
          {Object.entries(getSampleCounts()).map(([label, count]) => (
            <p key={label}>{label}: {count} samples</p>
          ))}
        </div>
      )}

      <div className="log-section">
        <h3>Training Log</h3>
        {logs.map((log, index) => (
          <div key={index}>{log}</div>
        ))}
      </div>
    </div>
  );
};

export default PoseTraining; 