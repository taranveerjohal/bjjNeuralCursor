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
  const [recordingStatus, setRecordingStatus] = useState<'idle' | 'recording' | 'paused'>('idle');
  const [trainingProgress, setTrainingProgress] = useState<number>(0);
  const [sampleCount, setSampleCount] = useState<number>(0);

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
    setRecordingStatus('recording');
    setSampleCount(0);
    addLog(`🔴 Started recording samples for: ${poseLabel}`);
    addLog('💡 Tip: Move through different variations of the pose for better training data');
  };

  // Stop recording pose samples
  const stopRecording = () => {
    setIsRecording(false);
    setRecordingStatus('idle');
    const samplesForThisLabel = trainingData.filter(sample => sample.output === poseLabel).length;
    addLog(`⏹️ Stopped recording. Total samples for ${poseLabel}: ${samplesForThisLabel}`);
    
    if (samplesForThisLabel < 10) {
      addLog('⚠️ Warning: Consider recording more samples (10+ recommended) for better accuracy');
    } else if (samplesForThisLabel >= 50) {
      addLog('✅ Great! You have sufficient samples for good training results');
    }
  };

  // Enhanced skeleton drawing for training with recording indicator
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

    // Change colors based on recording status
    const skeletonColor = isRecording ? '#ff4757' : '#2ed573'; // Red when recording, green otherwise
    const jointColor = isRecording ? '#ff3838' : '#26de81';
    
    // Draw connections with enhanced visibility
    ctx.strokeStyle = skeletonColor;
    ctx.lineWidth = isRecording ? 3 : 2;
    ctx.lineCap = 'round';
    
    connections.forEach(([start, end]) => {
      const startPoint = keypoints.find(kp => kp.name === start);
      const endPoint = keypoints.find(kp => kp.name === end);
      
      if (startPoint && endPoint && startPoint.score > 0.3 && endPoint.score > 0.3) {
        const avgConfidence = (startPoint.score + endPoint.score) / 2;
        ctx.globalAlpha = Math.max(0.6, avgConfidence);
        
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
        const radius = keypoint.score > 0.7 ? 6 : 4;
        
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
    
    // Draw recording indicator and pose info
    if (isRecording) {
      // Pulsing red dot
      const pulseSize = 15 + Math.sin(Date.now() / 200) * 5;
      ctx.fillStyle = '#ff4757';
      ctx.beginPath();
      ctx.arc(30, 30, pulseSize, 0, 2 * Math.PI);
      ctx.fill();
      
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px Arial';
      ctx.fillText('REC', 20, 35);
      
      // Sample count
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(10, 50, 200, 25);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`Samples: ${sampleCount}`, 15, 67);
    }
    
    // Pose confidence and current label
    if (pose.score > 0) {
      const confidenceText = `Confidence: ${Math.round(pose.score * 100)}%`;
      const labelText = poseLabel ? `Training: ${poseLabel}` : 'No label set';
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(10, ctx.canvas.height - 60, 250, 50);
      
      ctx.fillStyle = '#ffffff';
      ctx.font = '12px Arial';
      ctx.fillText(confidenceText, 15, ctx.canvas.height - 40);
      ctx.fillText(labelText, 15, ctx.canvas.height - 25);
    }
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

          // Record sample if recording with enhanced feedback
          if (isRecording && pose.score > 0.5) {
            const keypoints = pose.keypoints as PoseKeypoint[];
            const input = keypoints.flatMap(kp => [kp.x, kp.y]); // Flatten to 34 values
            
            const newSample: TrainingSample = {
              input,
              output: poseLabel
            };
            
            setTrainingData(prev => {
              const newData = [...prev, newSample];
              const currentLabelSamples = newData.filter(s => s.output === poseLabel).length;
              setSampleCount(currentLabelSamples);
              
              // Log milestones
              if (currentLabelSamples % 10 === 0) {
                addLog(`📊 Recorded ${currentLabelSamples} samples for ${poseLabel}`);
              }
              
              return newData;
            });
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
      // Add training data to neural network with progress tracking
      addLog(`📝 Adding ${trainingData.length} samples to neural network...`);
      
      trainingData.forEach((sample, index) => {
        neuralNetwork.addData(sample.input, sample.output);
        const progress = Math.round(((index + 1) / trainingData.length) * 30); // 30% for data loading
        setTrainingProgress(progress);
        
        if (index % 20 === 0 || index === trainingData.length - 1) {
          addLog(`📊 Added ${index + 1}/${trainingData.length} samples (${Math.round(((index + 1) / trainingData.length) * 100)}%)`);
        }
      });

      // Normalize data
      addLog('🔄 Normalizing data...');
      neuralNetwork.normalizeData();
      setTrainingProgress(35);
      
      const trainingOptions = {
        epochs: 50,
        batchSize: 32,
        learningRate: 0.01
      };

      addLog(`🚀 Starting training with ${trainingOptions.epochs} epochs...`);
      
      neuralNetwork.train(trainingOptions, (epoch: any) => {
        if (epoch && epoch.logs) {
          const epochProgress = 35 + Math.round((epoch.epoch / trainingOptions.epochs) * 60); // 60% for training
          setTrainingProgress(epochProgress);
          
          if (epoch.epoch % 5 === 0 || epoch.epoch === trainingOptions.epochs - 1) {
            addLog(`🎯 Epoch ${epoch.epoch + 1}/${trainingOptions.epochs}: loss=${epoch.logs.loss.toFixed(4)}, accuracy=${(epoch.logs.acc * 100).toFixed(1)}%`);
          }
        }
      }, () => {
        setTrainingProgress(95);
        addLog('✅ Training completed successfully!');
        
        // Evaluate training quality
        const uniqueLabels = Array.from(new Set(trainingData.map(s => s.output)));
        addLog(`📋 Model trained on ${uniqueLabels.length} different poses: ${uniqueLabels.join(', ')}`);
        
        // Save model
        addLog('💾 Saving model...');
        neuralNetwork.save('bjj-pose-model', () => {
          setTrainingProgress(100);
          addLog('🎉 Model saved successfully! You can now test it in the "Pose Testing" tab.');
          
          setTimeout(() => {
            setIsTraining(false);
            setTrainingProgress(0);
          }, 2000);
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
        <h3>📊 Training Status</h3>
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem'}}>
          <div>
            <strong>Models:</strong> <span style={{color: isModelLoaded ? '#28a745' : '#ffc107'}}>
              {isModelLoaded ? '✅ Loaded' : '⏳ Loading...'}
            </span>
          </div>
          <div>
            <strong>Recording:</strong> <span style={{color: isRecording ? '#dc3545' : '#6c757d'}}>
              {isRecording ? '🔴 Active' : '⚫ Inactive'}
            </span>
          </div>
          <div>
            <strong>Training:</strong> <span style={{color: isTraining ? '#007bff' : '#6c757d'}}>
              {isTraining ? `🚀 In Progress (${trainingProgress}%)` : '💤 Idle'}
            </span>
          </div>
          <div>
            <strong>Total Samples:</strong> <span style={{color: trainingData.length > 0 ? '#28a745' : '#6c757d'}}>
              📈 {trainingData.length}
            </span>
          </div>
        </div>
        
        {isTraining && (
          <div style={{marginTop: '1rem'}}>
            <div style={{background: '#e9ecef', borderRadius: '10px', height: '20px', overflow: 'hidden'}}>
              <div 
                style={{
                  background: 'linear-gradient(90deg, #667eea, #764ba2)',
                  height: '100%',
                  width: `${trainingProgress}%`,
                  transition: 'width 0.3s ease',
                  borderRadius: '10px'
                }}
              />
            </div>
            <p style={{textAlign: 'center', marginTop: '0.5rem', fontSize: '0.9rem'}}>
              Training Progress: {trainingProgress}%
            </p>
          </div>
        )}
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
          <h3>📚 Training Data Summary</h3>
          <div style={{display: 'grid', gap: '0.5rem'}}>
            {Object.entries(getSampleCounts()).map(([label, count]) => {
              const percentage = Math.round((count / trainingData.length) * 100);
              const isGoodAmount = count >= 10;
              return (
                <div key={label} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.5rem',
                  background: isGoodAmount ? '#d4edda' : '#fff3cd',
                  borderRadius: '5px',
                  border: `1px solid ${isGoodAmount ? '#c3e6cb' : '#ffeaa7'}`
                }}>
                  <span>
                    <strong>{label}</strong>
                    {isGoodAmount ? ' ✅' : ' ⚠️'}
                  </span>
                  <span>
                    {count} samples ({percentage}%)
                    {!isGoodAmount && ' - Need more'}
                  </span>
                </div>
              );
            })}
          </div>
          <div style={{marginTop: '1rem', padding: '0.5rem', background: '#f8f9fa', borderRadius: '5px'}}>
            <strong>💡 Tips:</strong>
            <ul style={{marginLeft: '1rem', fontSize: '0.9rem'}}>
              <li>Aim for 10+ samples per pose for good accuracy</li>
              <li>Record different angles and variations of each pose</li>
              <li>Ensure good lighting and clear pose visibility</li>
              <li>Balance your dataset - similar sample counts work best</li>
            </ul>
          </div>
        </div>
      )}

      <div className="log-section">
        <h3>📝 Training Log</h3>
        <div style={{maxHeight: '300px', overflowY: 'auto'}}>
          {logs.length === 0 ? (
            <p style={{color: '#6c757d', fontStyle: 'italic'}}>No activity yet. Start by loading the video and recording some poses!</p>
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

export default PoseTraining; 