import React, { useEffect, useRef, useState } from 'react';
import type p5 from 'p5';
import { useML5 } from '../context/ML5Context';
import { useThemeStyles } from '../hooks/useThemeStyles';

const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 480;
const CONFIDENCE_THRESHOLD = 0.3;
const SAMPLES_PER_POSE = 30;

interface TrainingProps {
  isActive: boolean;
}

interface TrainingSession {
  id: string;
  pose: string;
  samplesCollected: number;
  timestamp: number;
  quality: 'excellent' | 'good' | 'fair' | 'poor';
  features?: number[][]; // Store the actual feature data
}

const Training: React.FC<TrainingProps> = ({ isActive }) => {
  const { 
    isReady, 
    initializePoseDetection, 
    stopPoseDetection, 
    p5Manager, 
    createAdvancedNeuralNetwork,
    extractPoseFeatures,
    setSharedTrainedModel
  } = useML5();
  
  const containerRef = useRef<HTMLDivElement>(null);
  const p5Ref = useRef<p5>();
  const videoRef = useRef<any>(null);
  const poseDetectorRef = useRef<any>(null);
  const neuralNetworkRef = useRef<any>(null);
  const posesRef = useRef<any[]>([]);
  const connectionsRef = useRef<any[]>([]);
  const qualityCheckInterval = useRef<NodeJS.Timeout>();
  
  // Refs for accessing current state in p5 callbacks
  const isRecordingRef = useRef(false);
  const samplesCollectedRef = useRef(0);
  const currentPoseRef = useRef('');
  const countdownRef = useRef(0);
  
  // Training state
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Initializing...');
  const [currentPose, setCurrentPose] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [samplesCollected, setSamplesCollected] = useState(0);
  const [trainingSessions, setTrainingSessions] = useState<TrainingSession[]>([]);
  const [trainingStatus, setTrainingStatus] = useState<'collecting' | 'training' | 'complete'>('collecting');
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [poseQuality, setPoseQuality] = useState<'excellent' | 'good' | 'fair' | 'poor'>('fair');
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [showTrainingProgress, setShowTrainingProgress] = useState(true);
  const [networkSettings, setNetworkSettings] = useState({
    epochs: 15,
    learningRate: 0.03,
    hiddenUnits: 12,
    batchSize: 4
  });

  // Keep refs in sync with state
  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);
  
  useEffect(() => {
    samplesCollectedRef.current = samplesCollected;
  }, [samplesCollected]);
  
  useEffect(() => {
    currentPoseRef.current = currentPose;
  }, [currentPose]);
  
  useEffect(() => {
    countdownRef.current = countdown;
  }, [countdown]);

  // Initialize advanced neural network - only once, don't recreate on settings change
  useEffect(() => {
    if (!isReady || neuralNetworkRef.current) return;
    
    try {
      neuralNetworkRef.current = createAdvancedNeuralNetwork({
        epochs: networkSettings.epochs,
        learningRate: networkSettings.learningRate,
        hiddenUnits: networkSettings.hiddenUnits,
        batchSize: networkSettings.batchSize
      });
      console.log('Advanced neural network initialized');
    } catch (error) {
      console.error('Error initializing neural network:', error);
    }
  }, [isReady, createAdvancedNeuralNetwork]); // Remove networkSettings dependency

  // Quality assessment for poses
  const assessPoseQuality = (poses: any[]) => {
    if (!poses || poses.length === 0) {
      setPoseQuality('poor');
      return 'poor';
    }
    
    const pose = poses[0];
    if (!pose?.keypoints) {
      setPoseQuality('poor');
      return 'poor';
    }
    
    const validKeypoints = pose.keypoints.filter((kp: any) => kp.confidence > CONFIDENCE_THRESHOLD);
    const completeness = validKeypoints.length / pose.keypoints.length;
    const avgConfidence = validKeypoints.reduce((sum: number, kp: any) => sum + kp.confidence, 0) / validKeypoints.length;
    
    let quality: 'excellent' | 'good' | 'fair' | 'poor' = 'poor';
    
    if (completeness > 0.9 && avgConfidence > 0.8) {
      quality = 'excellent';
    } else if (completeness > 0.8 && avgConfidence > 0.7) {
      quality = 'good';
    } else if (completeness > 0.6 && avgConfidence > 0.5) {
      quality = 'fair';
    }
    
    setPoseQuality(quality);
    return quality;
  };

  useEffect(() => {
    if (!isActive || !isReady || !containerRef.current) return;

    const sketch = (p: p5) => {
      const gotPoses = (results: any) => {
        posesRef.current = results || [];
        
        // Assess pose quality in real-time
        assessPoseQuality(results);
        
        // Only collect data when actively recording with good quality
        if (isRecordingRef.current && results?.[0]?.keypoints && samplesCollectedRef.current < SAMPLES_PER_POSE) {
          const quality = assessPoseQuality(results);
          
          // Only collect samples with fair quality or better
          if (quality !== 'poor') {
            const features = extractPoseFeatures(results);
            const target = { pose: currentPoseRef.current };
            
            neuralNetworkRef.current.addData(features, target);
            
            setSamplesCollected(prev => {
              const newCount = prev + 1;
              if (newCount >= SAMPLES_PER_POSE) {
                setIsRecording(false);
                
                // Store the session with collected features
                setTrainingSessions(prevSessions => {
                  const session: TrainingSession = {
                    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    pose: currentPoseRef.current,
                    samplesCollected: SAMPLES_PER_POSE,
                    timestamp: Date.now(),
                    quality: quality,
                    features: [] // Will be populated during collection
                  };
                  return [...prevSessions, session];
                });
                
                setCurrentPose('');
                setSamplesCollected(0);
              }
              return newCount;
            });
          }
        }
      };

      const getQualityColor = (quality: string) => {
        switch (quality) {
          case 'excellent': return [0, 255, 0]; // Green
          case 'good': return [173, 255, 47]; // Green-yellow
          case 'fair': return [255, 165, 0]; // Orange
          case 'poor': return [255, 0, 0]; // Red
          default: return [128, 128, 128]; // Gray
        }
      };

      p.setup = () => {
        const canvas = p.createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
        canvas.parent(containerRef.current!);
        
        // Clean up existing video elements
        if (videoRef.current?.elt) {
          const tracks = videoRef.current.elt.srcObject?.getTracks() || [];
          tracks.forEach((track: MediaStreamTrack) => track.stop());
          videoRef.current.remove();
          videoRef.current = null;
        }
        
        const existingVideos = containerRef.current!.querySelectorAll('video');
        existingVideos.forEach(video => video.remove());
        
        const constraints = {
          video: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT, facingMode: "user" },
          audio: false
        };

        setLoadingMessage('Initializing camera...');
        videoRef.current = p.createCapture(constraints);
        videoRef.current.size(CANVAS_WIDTH, CANVAS_HEIGHT);
        videoRef.current.hide();

        videoRef.current.elt.addEventListener('error', (error: any) => {
          console.error('Video error:', error);
          setLoadingMessage('Camera access failed. Please check permissions.');
        });

        videoRef.current.elt.addEventListener('loadeddata', async () => {
          try {
            setLoadingMessage('Waiting for stable video...');
            
            // Wait for video to stabilize
            setTimeout(async () => {
              try {
                setLoadingMessage('Loading pose detection...');
                const detector = await initializePoseDetection(videoRef.current.elt);
                poseDetectorRef.current = detector;
                
                if (detector && detector.getSkeleton) {
                  connectionsRef.current = detector.getSkeleton();
                }
                
                try {
                  detector.detectStart(videoRef.current.elt, gotPoses);
                  setIsLoading(false);
                } catch (startError) {
                  console.error('Error starting detection:', startError);
                  setLoadingMessage('Error starting pose detection. Please refresh.');
                }
              } catch (error) {
                console.error('Error initializing pose detection:', error);
                setLoadingMessage('Error initializing pose detection.');
              }
            }, 1000);
          } catch (error) {
            console.error('Error in loadeddata handler:', error);
            setLoadingMessage('Error preparing video.');
          }
        });
      };

      p.draw = () => {
        if (!videoRef.current?.elt) return;
        
        p.background(0);
        
        // Draw video
        if (videoRef.current.elt.videoWidth > 0 && videoRef.current.elt.videoHeight > 0) {
          p.image(videoRef.current, 0, 0, p.width, p.height);
        }

        // Draw poses with quality-based coloring
        posesRef.current.forEach((pose) => {
          if (!pose?.keypoints) return;
          
          const [r, g, b] = getQualityColor(poseQuality);

          // Draw skeleton with quality-based colors
          if (connectionsRef.current) {
            connectionsRef.current.forEach(([pointAIndex, pointBIndex]) => {
              const pointA = pose.keypoints[pointAIndex];
              const pointB = pose.keypoints[pointBIndex];
              if (pointA.confidence > CONFIDENCE_THRESHOLD && pointB.confidence > CONFIDENCE_THRESHOLD) {
                p.stroke(r, g, b, 200);
                p.strokeWeight(3);
                p.line(pointA.x, pointA.y, pointB.x, pointB.y);
              }
            });
          }

          // Draw keypoints
          pose.keypoints.forEach((keypoint: any) => {
            if (keypoint.confidence > CONFIDENCE_THRESHOLD) {
              p.fill(r, g, b, 240);
              p.noStroke();
              p.circle(keypoint.x, keypoint.y, 10);
              
              // White center for better visibility
              p.fill(255);
              p.circle(keypoint.x, keypoint.y, 4);
            }
          });
        });

        // Recording indicator and countdown
        if (isRecordingRef.current) {
          // Recording pulse
          const pulse = (Math.sin(p.frameCount * 0.3) + 1) / 2;
          p.fill(255, 0, 0, 150 + pulse * 105);
          p.noStroke();
          p.circle(30, 30, 20 + pulse * 10);
          
          // Recording info
          p.fill(0, 0, 0, 150);
          p.rect(60, 15, 250, 30, 5);
          p.fill(255);
          p.textSize(14);
          p.textAlign(p.LEFT, p.CENTER);
          p.text(`Recording "${currentPoseRef.current}": ${samplesCollectedRef.current}/${SAMPLES_PER_POSE}`, 70, 30);
        }

        // Countdown overlay
        if (countdownRef.current > 0) {
          p.fill(0, 0, 0, 200);
          p.rect(p.width/2 - 60, p.height/2 - 40, 120, 80, 10);
          p.fill(255, 255, 0);
          p.textSize(48);
          p.textAlign(p.CENTER, p.CENTER);
          p.text(countdownRef.current.toString(), p.width/2, p.height/2);
        }

        // Quality indicator
        const [qr, qg, qb] = getQualityColor(poseQuality);
        p.fill(0, 0, 0, 150);
        p.rect(p.width - 140, 15, 125, 30, 5);
        p.fill(qr, qg, qb);
        p.textSize(12);
        p.textAlign(p.CENTER, p.CENTER);
        p.text(`Quality: ${poseQuality.toUpperCase()}`, p.width - 77, 30);
      };
    };

    // Cleanup previous video and detector
    if (poseDetectorRef.current) {
      try {
        poseDetectorRef.current.detectStop();
        console.log('Stopped previous pose detector in Training');
      } catch (e) {
        console.log('Error stopping previous detector:', e);
      }
    }
    
    if (videoRef.current?.elt?.srcObject) {
      const tracks = videoRef.current.elt.srcObject.getTracks();
      tracks.forEach((track: MediaStreamTrack) => track.stop());
      console.log('Stopped previous video tracks in Training');
    }
    
    videoRef.current = null;
    poseDetectorRef.current = null;
    posesRef.current = [];
    connectionsRef.current = [];

    p5Ref.current = p5Manager.createInstance(containerRef.current, sketch);

    return () => {
      if (poseDetectorRef.current) {
        try { poseDetectorRef.current.detectStop(); } catch (e) {}
      }
      stopPoseDetection();
      if (videoRef.current?.elt?.srcObject) {
        videoRef.current.elt.srcObject.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      }
      if (p5Ref.current) {
        p5Manager.removeInstance(p5Ref.current);
      }
      if (qualityCheckInterval.current) {
        clearInterval(qualityCheckInterval.current);
      }
    };
  }, [isActive, isReady]);

  const startRecording = () => {
    if (!currentPose.trim()) {
      alert('Please enter a pose name first!');
      return;
    }
    
    if (trainingSessions.some(session => session.pose === currentPose)) {
      alert('This pose has already been recorded! Use a different name.');
      return;
    }

    // Start countdown
    setCountdown(3);
    const countdownInterval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          setIsRecording(true);
          setSamplesCollected(0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const startTraining = async () => {
    // Check for unique pose names
    const uniquePoses = [...new Set(trainingSessions.map(session => session.pose))];
    if (uniquePoses.length < 2) {
      alert(`Please record at least 2 different poses! You currently have ${uniquePoses.length} unique pose(s): ${uniquePoses.join(', ')}`);
      return;
    }
    
    // Check if we have enough training data
    const totalSamples = trainingSessions.reduce((sum, session) => sum + session.samplesCollected, 0);
    if (totalSamples < uniquePoses.length * SAMPLES_PER_POSE) {
      alert(`Insufficient training data. Expected ${uniquePoses.length * SAMPLES_PER_POSE} samples, but only have ${totalSamples}.`);
      return;
    }
    
    // Ensure we have a neural network (should already exist from initialization)
    if (!neuralNetworkRef.current) {
      console.log('Creating neural network for training...');
      neuralNetworkRef.current = createAdvancedNeuralNetwork({
        epochs: networkSettings.epochs,
        learningRate: networkSettings.learningRate,
        hiddenUnits: networkSettings.hiddenUnits,
        batchSize: networkSettings.batchSize
      });
    }
    
    setTrainingStatus('training');
    setTrainingProgress(0);
    
    try {
      console.log('Starting training with', totalSamples, 'samples for', uniquePoses.length, 'poses');
      
      // Try to normalize data
      neuralNetworkRef.current.normalizeData();
      console.log('Data normalized successfully');
      
      const options = {
        epochs: networkSettings.epochs,
        batchSize: networkSettings.batchSize
      };
      
      neuralNetworkRef.current.train(options, 
        (epoch: number) => {
          const progress = Math.round((epoch / options.epochs) * 100);
          setTrainingProgress(progress);
          console.log(`Training epoch ${epoch}/${options.epochs} (${progress}%)`);
        },
        () => {
          setTrainingStatus('complete');
          // Share the trained model with other components
          setSharedTrainedModel(neuralNetworkRef.current);
          // Mark that we have a trained model available
          localStorage.setItem('bjj-pose-model-trained', 'true');
          localStorage.setItem('bjj-pose-model-timestamp', Date.now().toString());
          console.log('Advanced training complete, model shared and available for testing');
        }
      );
    } catch (error: any) {
      console.error('Training error:', error);
      setTrainingStatus('collecting');
      
      // More specific error messages
      if (error?.message && error.message.includes('undefined')) {
        alert('Training failed: No training data found. Please record some poses first.');
      } else if (error.message && error.message.includes('depth must be >=2')) {
        alert('Training failed: Need at least 2 different pose types to train the model.');
      } else {
        alert(`Training failed: ${error.message || 'Unknown error'}. Please try again.`);
      }
    }
  };

  const clearSession = (sessionId: string) => {
    setTrainingSessions(prev => prev.filter(s => s.id !== sessionId));
  };

  const resetAllTrainingData = () => {
    if (confirm('This will clear all recorded poses and reset the neural network. Are you sure?')) {
      // Clear all training sessions
      setTrainingSessions([]);
      
      // Reset training status
      setTrainingStatus('collecting');
      setTrainingProgress(0);
      
      // Create a fresh neural network
      try {
        neuralNetworkRef.current = createAdvancedNeuralNetwork({
          epochs: networkSettings.epochs,
          learningRate: networkSettings.learningRate,
          hiddenUnits: networkSettings.hiddenUnits,
          batchSize: networkSettings.batchSize
        });
        console.log('Fresh neural network created');
      } catch (error) {
        console.error('Error creating fresh neural network:', error);
      }
      
      // Clear any shared model
      setSharedTrainedModel(null);
      
      // Clear localStorage flags
      localStorage.removeItem('bjj-pose-model-trained');
      localStorage.removeItem('bjj-pose-model-timestamp');
      
      console.log('All training data reset');
    }
  };

  const { getCardStyles, getButtonStyles, getInputStyles, getQualityBadgeStyles, colors, theme } = useThemeStyles();

  const getQualityBadgeColor = (quality: string) => {
    return getQualityBadgeStyles(quality);
  };

  return (
    <div className="w-full space-y-6">
      {/* Enhanced Control Panel */}
      <div className={`${getCardStyles()} p-6 space-y-6`}>
        {/* Recording Controls */}
        <div className="space-y-4">
          <h3 className={`${colors.primaryText} font-semibold text-lg flex items-center gap-2`}>
            🎯 Pose Recording
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getQualityBadgeColor(poseQuality)}`}>
              {poseQuality.toUpperCase()}
            </span>
          </h3>
          
          <div className="flex gap-3">
            <input
              type="text"
              value={currentPose}
              onChange={(e) => setCurrentPose(e.target.value)}
              placeholder="Enter pose name (e.g., 'guard', 'mount', 'triangle')"
              className={`flex-1 ${getInputStyles()}`}
              disabled={isRecording || countdown > 0 || trainingStatus !== 'collecting'}
            />
            <button
              onClick={startRecording}
              disabled={isRecording || countdown > 0 || !currentPose.trim() || trainingStatus !== 'collecting'}
              className={`px-6 py-3 ${getButtonStyles('primary')} disabled:from-gray-500 disabled:to-gray-600 disabled:cursor-not-allowed`}
            >
              {countdown > 0 ? `Starting in ${countdown}...` : isRecording ? '🔴 Recording...' : '🎬 Record Pose'}
            </button>
          </div>
          
          <div className={`text-sm ${colors.secondaryText}`}>
            💡 Hold the pose steady for {SAMPLES_PER_POSE} samples (about 3-5 seconds). Higher quality poses improve model accuracy.
          </div>
        </div>

        {/* Advanced Settings */}
        <div className={`border-t ${colors.primaryBorder} pt-4`}>
          <button
            onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
            className={`flex items-center gap-2 ${colors.secondaryText} hover:${colors.primaryText} transition-colors`}
          >
            <span className={`transition-transform ${showAdvancedSettings ? 'rotate-90' : ''}`}>▶️</span>
            Advanced Neural Network Settings
          </button>
          
          {showAdvancedSettings && (
            <div className="mt-4 grid md:grid-cols-3 gap-4">
              <div>
                <label className={`block ${colors.secondaryText} text-sm mb-2`}>Training Epochs</label>
                <input
                  type="number"
                  value={networkSettings.epochs}
                  onChange={(e) => setNetworkSettings(prev => ({...prev, epochs: parseInt(e.target.value)}))}
                  className={getInputStyles()}
                  min="5" max="100"
                />
              </div>
              <div>
                <label className={`block ${colors.secondaryText} text-sm mb-2`}>Learning Rate</label>
                <input
                  type="number"
                  value={networkSettings.learningRate}
                  onChange={(e) => setNetworkSettings(prev => ({...prev, learningRate: parseFloat(e.target.value)}))}
                  className={getInputStyles()}
                  min="0.001" max="0.1" step="0.001"
                />
              </div>
              <div>
                <label className={`block ${colors.secondaryText} text-sm mb-2`}>Hidden Units</label>
                <input
                  type="number"
                  value={networkSettings.hiddenUnits}
                  onChange={(e) => setNetworkSettings(prev => ({...prev, hiddenUnits: parseInt(e.target.value)}))}
                  className={getInputStyles()}
                  min="8" max="64"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Training Progress & Video Layout */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Video Canvas */}
        <div className="flex justify-center">
          <div 
            ref={containerRef} 
            className="relative bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/10"
            style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
          >
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                <div className="text-center">
                  <div className="w-16 h-16 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-4"></div>
                  <div className="text-white text-lg font-medium mb-2">{loadingMessage}</div>
                  <div className="text-purple-300 text-sm">Setting up your training environment...</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Real-time Training Status */}
        <div className="space-y-4">
          {/* Current Status */}
          <div className={`${getCardStyles()} p-4`}>
            <h3 className={`${colors.primaryText} font-semibold text-lg mb-3`}>📊 Training Status</h3>
            
            {isRecording && (
              <div className="mb-4 p-4 bg-red-500/20 border border-red-500/30 rounded-xl">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                  <span className="text-red-300 font-medium">Recording "{currentPose}"</span>
                </div>
                <div className={`${colors.primaryText} text-sm`}>
                  Progress: {samplesCollected}/{SAMPLES_PER_POSE} samples
                </div>
                <div className="w-full bg-red-900/30 rounded-full h-2 mt-2">
                  <div 
                    className="bg-red-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(samplesCollected / SAMPLES_PER_POSE) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {countdown > 0 && (
              <div className="mb-4 p-4 bg-yellow-500/20 border border-yellow-500/30 rounded-xl text-center">
                <div className="text-yellow-300 font-medium mb-1">Get Ready!</div>
                <div className="text-3xl font-bold text-yellow-400">{countdown}</div>
              </div>
            )}

            {/* Pose Quality Indicator */}
            <div className="flex items-center justify-between mb-4">
              <span className={colors.secondaryText}>Current Pose Quality:</span>
              <span className={getQualityBadgeStyles(poseQuality)}>
                {poseQuality.toUpperCase()}
              </span>
            </div>

            {/* Unique Poses Count */}
            <div className="flex items-center justify-between">
              <span className={colors.secondaryText}>Unique Poses Recorded:</span>
              <span className={`${colors.primaryText} font-bold`}>
                {[...new Set(trainingSessions.map(session => session.pose))].length}/2 minimum
              </span>
            </div>
          </div>

          {/* Training Sessions */}
          {trainingSessions.length > 0 && (
            <div className={`${getCardStyles()} p-4`}>
              <h4 className={`${colors.primaryText} font-semibold mb-3`}>
                📝 Recorded Poses ({trainingSessions.length})
              </h4>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {trainingSessions.map((session) => (
                  <div 
                    key={session.id} 
                    className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 ${theme === 'blackwhite' ? 'bg-gradient-to-r from-gray-600 to-gray-800' : 'bg-gradient-to-r from-purple-500 to-pink-500'} rounded-lg flex items-center justify-center text-white text-xs font-bold`}>
                        {session.pose.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className={`${colors.primaryText} font-medium`}>{session.pose}</div>
                        <div className={`${colors.accentText} text-xs`}>
                          {session.samplesCollected} samples • {new Date(session.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={getQualityBadgeStyles(session.quality)}>
                        {session.quality}
                      </span>
                      <button
                        onClick={() => clearSession(session.id)}
                        className="p-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
                        title="Remove this training session"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>


      {/* Training Controls */}
      <div className={`${getCardStyles()} p-6`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className={`${colors.primaryText} font-semibold text-lg`}>🧠 Model Training</h3>
          {trainingStatus === 'complete' && (
            <span className="px-4 py-2 bg-green-500/20 border border-green-400/30 rounded-full text-green-300 text-sm font-medium">
              ✅ Training Complete
            </span>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={startTraining}
            disabled={trainingSessions.length < 2 || trainingStatus !== 'collecting'}
            className={`flex-1 px-6 py-4 ${getButtonStyles('success')} disabled:from-gray-500 disabled:to-gray-600 disabled:cursor-not-allowed`}
          >
            {trainingStatus === 'training' ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Training Model... {trainingProgress}%
              </>
            ) : trainingSessions.length < 2 ? (
              `🎯 Record ${2 - trainingSessions.length} more pose${trainingSessions.length === 1 ? '' : 's'} to train`
            ) : (
              '🚀 Train Fast Model'
            )}
          </button>
          
          {trainingStatus === 'training' && (
            <button
              onClick={() => setShowTrainingProgress(!showTrainingProgress)}
              className={`px-3 py-2 ${getButtonStyles('secondary')} text-sm`}
            >
              {showTrainingProgress ? '👁️ Hide Progress' : '👁️ Show Progress'}
            </button>
          )}
          
          {trainingSessions.length > 0 && (
            <button
              onClick={resetAllTrainingData}
              disabled={trainingStatus === 'training'}
              className={`px-4 py-4 ${getButtonStyles('danger')} disabled:cursor-not-allowed`}
              title="Reset all training data and start fresh"
            >
              🗑️ Reset
            </button>
          )}
        </div>

        {trainingStatus === 'training' && showTrainingProgress && (
          <div className="mt-4">
            <div className={`flex justify-between text-sm ${colors.secondaryText} mb-2`}>
              <span>Training Progress</span>
              <span>{trainingProgress}%</span>
            </div>
            <div className={`w-full h-3 ${colors.inputBg} rounded-full overflow-hidden`}>
              <div 
                className={`h-full ${theme === 'blackwhite' ? 'bg-gradient-to-r from-green-700 to-green-900' : 'bg-gradient-to-r from-green-500 to-emerald-500'} transition-all duration-500 ease-out`}
                style={{ width: `${trainingProgress}%` }}
              />
            </div>
          </div>
        )}

        {trainingStatus === 'complete' && (
          <div className="mt-4 p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
            <div className="text-green-300 font-semibold mb-2">🎉 Training Successful!</div>
            <div className="text-green-400/80 text-sm">
              Your advanced neural network model has been trained and saved. Switch to the Testing tab to try it out!
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Training;