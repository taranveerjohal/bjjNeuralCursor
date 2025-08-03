import React, { useEffect, useRef, useState } from 'react';
import type p5 from 'p5';
import { useML5 } from '../context/ML5Context';
import { useThemeStyles } from '../hooks/useThemeStyles';

const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 480;
const CONFIDENCE_THRESHOLD = 0.3;
const SAMPLES_PER_POSE = 100; // More samples for better accuracy

interface TrainingProps {
  isActive: boolean;
}

interface PoseSession {
  id: string;
  pose: string;
  samples: number;
  timestamp: number;
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
  
  // Simple refs for p5 callbacks
  const isCollectingRef = useRef(false);
  const currentPoseRef = useRef('');
  const samplesCollectedRef = useRef(0);
  const isCountdownActiveRef = useRef(false);
  const countdownTimerRef = useRef<number | null>(null);
  
  // Simplified training state
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Initializing...');
  const [currentPose, setCurrentPose] = useState('');
  const [isCollecting, setIsCollecting] = useState(false);
  const [samplesCollected, setSamplesCollected] = useState(0);
  const [poseSessions, setPoseSessions] = useState<PoseSession[]>([]);
  const [isTraining, setIsTraining] = useState(false);
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [isModelTrained, setIsModelTrained] = useState(false);
  const [countdownTimer, setCountdownTimer] = useState<number | null>(null);
  const [isCountdownActive, setIsCountdownActive] = useState(false);

  // Keep refs in sync with state
  useEffect(() => {
    isCollectingRef.current = isCollecting;
  }, [isCollecting]);
  
  useEffect(() => {
    currentPoseRef.current = currentPose;
  }, [currentPose]);
  
  useEffect(() => {
    samplesCollectedRef.current = samplesCollected;
  }, [samplesCollected]);
  
  useEffect(() => {
    isCountdownActiveRef.current = isCountdownActive;
  }, [isCountdownActive]);
  
  useEffect(() => {
    countdownTimerRef.current = countdownTimer;
  }, [countdownTimer]);

  // Initialize neural network once
  useEffect(() => {
    if (!isReady || neuralNetworkRef.current) return;
    
    try {
      neuralNetworkRef.current = createAdvancedNeuralNetwork();
      console.log('🧠 Neural network initialized');
    } catch (error) {
      console.error('❌ Error initializing neural network:', error);
    }
  }, [isReady, createAdvancedNeuralNetwork]);

  // Simple pose validation
  const isPoseValid = (poses: any[]) => {
    if (!poses || poses.length === 0) return false;
    const pose = poses[0];
    if (!pose?.keypoints) return false;
    const validKeypoints = pose.keypoints.filter((kp: any) => kp.confidence > CONFIDENCE_THRESHOLD);
    return validKeypoints.length >= 10; // Need at least 10 good keypoints
  };

  useEffect(() => {
    if (!isActive || !isReady || !containerRef.current) return;

    const sketch = (p: p5) => {
      const gotPoses = (results: any) => {
        posesRef.current = results || [];
        
        // Simple data collection when actively collecting (not during countdown)
        if (isCollectingRef.current && 
            !isCountdownActiveRef.current &&
            results?.[0]?.keypoints && 
            samplesCollectedRef.current < SAMPLES_PER_POSE &&
            isPoseValid(results)) {
          
          const features = extractPoseFeatures(results);
          const target = { pose: currentPoseRef.current };
          
          neuralNetworkRef.current.addData(features, target);
          
          setSamplesCollected(prev => {
            const newCount = prev + 1;
            console.log(`📊 Sample ${newCount}/${SAMPLES_PER_POSE} for "${currentPoseRef.current}"`);
            
            if (newCount >= SAMPLES_PER_POSE) {
              setIsCollecting(false);
              
              // Save the session
              const session: PoseSession = {
                id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                pose: currentPoseRef.current,
                samples: SAMPLES_PER_POSE,
                timestamp: Date.now()
              };
              
              setPoseSessions(prev => [...prev, session]);
              setCurrentPose('');
              setSamplesCollected(0);
              console.log(`✅ Completed collection for "${currentPoseRef.current}"`);
            }
            return newCount;
          });
        }
      };

      const getCollectingColor = () => {
        return isCollectingRef.current ? [0, 255, 100] : [255, 255, 255];
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

        // Draw poses with simple, clear visualization
        posesRef.current.forEach((pose) => {
          if (!pose?.keypoints) return;
          
          const [r, g, b] = getCollectingColor();

          // Draw skeleton
          if (connectionsRef.current) {
            connectionsRef.current.forEach(([pointAIndex, pointBIndex]) => {
              const pointA = pose.keypoints[pointAIndex];
              const pointB = pose.keypoints[pointBIndex];
              if (pointA.confidence > CONFIDENCE_THRESHOLD && pointB.confidence > CONFIDENCE_THRESHOLD) {
                p.stroke(r, g, b, isCollectingRef.current ? 255 : 150);
                p.strokeWeight(isCollectingRef.current ? 4 : 2);
                p.line(pointA.x, pointA.y, pointB.x, pointB.y);
              }
            });
          }

          // Draw keypoints
          pose.keypoints.forEach((keypoint: any) => {
            if (keypoint.confidence > CONFIDENCE_THRESHOLD) {
              p.fill(r, g, b, isCollectingRef.current ? 255 : 200);
              p.noStroke();
              p.circle(keypoint.x, keypoint.y, isCollectingRef.current ? 12 : 8);
              
              // White center
              p.fill(255);
              p.circle(keypoint.x, keypoint.y, 4);
            }
          });
        });

        // Draw countdown timer if active
        if (isCountdownActiveRef.current && countdownTimerRef.current !== null) {
          // Large countdown display in center
          p.fill(255, 255, 255, 240);
          p.stroke(255, 0, 0, 255);
          p.strokeWeight(6);
          p.rect(p.width/2 - 100, p.height/2 - 100, 200, 200, 20);
          
          // Countdown number
          p.fill(255, 0, 0);
          p.noStroke();
          p.textSize(80);
          p.textStyle(p.BOLD);
          p.textAlign(p.CENTER, p.CENTER);
          p.text(countdownTimerRef.current.toString(), p.width/2, p.height/2 - 20);
          
          // Instruction text
          p.fill(255, 255, 255);
          p.textSize(16);
          p.text('Get in position!', p.width/2, p.height/2 + 60);
        }

        // Collection indicator
        if (isCollectingRef.current && !isCountdownActiveRef.current) {
          // Pulsing indicator
          const pulse = (Math.sin(p.frameCount * 0.3) + 1) / 2;
          p.fill(0, 255, 0, 150 + pulse * 105);
          p.noStroke();
          p.circle(30, 30, 25 + pulse * 10);
          
          // Collection info
          p.fill(0, 0, 0, 180);
          p.rect(60, 15, 320, 30, 8);
          p.fill(255);
          p.textSize(16);
          p.textAlign(p.LEFT, p.CENTER);
          p.text(`🔴 Collecting "${currentPoseRef.current}": ${samplesCollectedRef.current}/${SAMPLES_PER_POSE}`, 70, 30);
        }

        // Status overlay
        if (posesRef.current.length === 0) {
          p.fill(0, 0, 0, 150);
          p.rect(10, p.height - 60, 300, 50, 8);
          p.fill(255, 165, 0);
          p.textSize(14);
          p.textAlign(p.LEFT, p.CENTER);
          p.text('👤 Position yourself in frame to start training', 20, p.height - 35);
        }

        // Simple status indicator
        if (isCollectingRef.current) {
          const progress = samplesCollectedRef.current / SAMPLES_PER_POSE;
          p.fill(0, 0, 0, 150);
          p.rect(p.width - 160, 15, 150, 40, 8);
          
          // Progress bar
          p.fill(0, 255, 0, 100);
          p.rect(p.width - 150, 35, 130, 8, 4);
          p.fill(0, 255, 0);
          p.rect(p.width - 150, 35, 130 * progress, 8, 4);
          
          p.fill(255);
          p.textSize(12);
          p.textAlign(p.CENTER, p.CENTER);
          p.text(`${Math.round(progress * 100)}% Complete`, p.width - 85, 25);
        }
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
    };
  }, [isActive, isReady]);

  const startCollecting = () => {
    if (!currentPose.trim()) {
      alert('Please enter a pose name first!');
      return;
    }
    
    if (poseSessions.some(session => session.pose === currentPose)) {
      alert('This pose has already been recorded! Use a different name.');
      return;
    }

    // Start countdown timer first
    setIsCountdownActive(true);
    setCountdownTimer(10);
    
    const interval = setInterval(() => {
      setCountdownTimer(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          setIsCountdownActive(false);
          // Start actual data collection after countdown
          setIsCollecting(true);
          setSamplesCollected(0);
          console.log(`🎯 Started collecting data for pose: ${currentPose}`);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const stopCollecting = () => {
    setIsCollecting(false);
    setIsCountdownActive(false);
    setCountdownTimer(null);
    setCurrentPose('');
    setSamplesCollected(0);
    console.log('🛑 Stopped data collection');
  };

  const trainModel = async () => {
    if (poseSessions.length < 2) {
      alert('Please collect data for at least 2 different poses!');
      return;
    }
    
    if (!neuralNetworkRef.current) {
      alert('Neural network not initialized!');
      return;
    }
    
    setIsTraining(true);
    setTrainingProgress(0);
    
    try {
      console.log('🚀 Starting ML5.js neural network training...');
      
      // Normalize data (ML5.js requirement)
      neuralNetworkRef.current.normalizeData();
      console.log('📊 Data normalized');
      
      const options = {
        epochs: 15,
        batchSize: 4
      };
      
      // Train with proper ML5.js callbacks
      neuralNetworkRef.current.train(options, 
        (epoch: number) => {
          const progress = Math.round((epoch / options.epochs) * 100);
          setTrainingProgress(progress);
          console.log(`Training epoch ${epoch}/${options.epochs} (${progress}%)`);
        },
        () => {
          setIsTraining(false);
          setIsModelTrained(true);
          setSharedTrainedModel(neuralNetworkRef.current);
          localStorage.setItem('bjj-pose-model-trained', 'true');
          localStorage.setItem('bjj-pose-model-timestamp', Date.now().toString());
          console.log('🎉 Training complete! Model ready for testing.');
        }
      );
    } catch (error: any) {
      console.error('❌ Training error:', error);
      setIsTraining(false);
      alert(`Training failed: ${error.message || 'Unknown error'}`);
    }
  };

  const resetTraining = () => {
    if (confirm('Reset all training data? This cannot be undone.')) {
      setPoseSessions([]);
      setSamplesCollected(0);
      setCurrentPose('');
      setIsCollecting(false);
      setIsTraining(false);
      setIsModelTrained(false);
      setTrainingProgress(0);
      
      // Create fresh neural network
      if (neuralNetworkRef.current) {
        try {
          neuralNetworkRef.current = createAdvancedNeuralNetwork();
          console.log('🔄 Fresh neural network created');
        } catch (error) {
          console.error('Error creating fresh neural network:', error);
        }
      }
      
      setSharedTrainedModel(null);
      localStorage.removeItem('bjj-pose-model-trained');
      localStorage.removeItem('bjj-pose-model-timestamp');
    }
  };

  const { getCardStyles, getButtonStyles, getInputStyles, colors, theme } = useThemeStyles();

  return (
    <div className="w-full space-y-6">
      {/* Control Panel */}
      <div className={`${getCardStyles()} p-6 space-y-6`}>
        <h3 className={`${colors.primaryText} font-semibold text-xl flex items-center gap-3`}>
          🎯 ML5.js Pose Training
          {isModelTrained && (
            <span className="px-3 py-1 bg-green-500/20 border border-green-400/30 rounded-full text-green-300 text-sm font-medium">
              ✅ Model Ready
            </span>
          )}
        </h3>
        
        {/* Data Collection */}
        <div className="space-y-4">
          <h4 className={`${colors.secondaryText} font-medium`}>Data Collection</h4>
          
          <div className="flex gap-3">
            <input
              type="text"
              value={currentPose}
              onChange={(e) => setCurrentPose(e.target.value)}
              placeholder="Enter pose name (e.g., 'guard', 'mount', 'triangle')"
              className={`flex-1 ${getInputStyles()}`}
              disabled={isCollecting || isTraining}
            />
            {!isCollecting && !isCountdownActive ? (
              <button
                onClick={startCollecting}
                disabled={!currentPose.trim() || isTraining}
                className={`px-6 py-3 ${getButtonStyles('primary')} disabled:opacity-50`}
              >
                🎬 Start Collecting
              </button>
            ) : isCountdownActive ? (
              <button
                onClick={stopCollecting}
                className={`px-6 py-3 ${getButtonStyles('danger')}`}
              >
                ⏰ Countdown: {countdownTimer}s
              </button>
            ) : (
              <button
                onClick={stopCollecting}
                className={`px-6 py-3 ${getButtonStyles('danger')}`}
              >
                🛑 Stop ({samplesCollected}/{SAMPLES_PER_POSE})
              </button>
            )}
          </div>
          
          <div className={`text-sm ${colors.secondaryText}`}>
            💡 Position yourself clearly in frame and click "Start Collecting". Move naturally while holding the pose to collect diverse samples.
          </div>
        </div>
      </div>

      {/* Video and Training Data Layout */}
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
                  <div className="text-purple-300 text-sm">Setting up training environment...</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Training Data */}
        <div className="space-y-4">
          <div className={`${getCardStyles()} p-4`}>
            <h4 className={`${colors.primaryText} font-semibold mb-3`}>
              📊 Collected Data ({poseSessions.length} poses)
            </h4>
            
            {poseSessions.length > 0 ? (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {poseSessions.map((session) => (
                  <div 
                    key={session.id} 
                    className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 ${theme === 'blackwhite' ? 'bg-gradient-to-r from-gray-600 to-gray-800' : 'bg-gradient-to-r from-purple-500 to-pink-500'} rounded-lg flex items-center justify-center text-white font-bold`}>
                        {session.pose.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className={`${colors.primaryText} font-medium`}>{session.pose}</div>
                        <div className={`${colors.accentText} text-sm`}>
                          {session.samples} samples • {new Date(session.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={`${colors.secondaryText} text-center py-8`}>
                No training data collected yet.<br />
                Start by collecting samples for your first pose!
              </div>
            )}
          </div>
        </div>
      </div>


      {/* Training Controls */}
      <div className={`${getCardStyles()} p-6`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className={`${colors.primaryText} font-semibold text-lg`}>🧠 Model Training</h3>
          <div className="flex gap-3">
            <button
              onClick={trainModel}
              disabled={poseSessions.length < 2 || isTraining || isCollecting}
              className={`px-6 py-3 ${getButtonStyles('success')} disabled:opacity-50`}
            >
              {isTraining ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                  Training... {trainingProgress}%
                </>
              ) : poseSessions.length < 2 ? (
                `🎯 Need ${2 - poseSessions.length} more pose${poseSessions.length === 1 ? '' : 's'}`
              ) : (
                '🚀 Train Model (Fast)'
              )}
            </button>
            
            {poseSessions.length > 0 && (
              <button
                onClick={resetTraining}
                disabled={isTraining || isCollecting}
                className={`px-4 py-3 ${getButtonStyles('danger')} disabled:opacity-50`}
              >
                🗑️ Reset
              </button>
            )}
          </div>
        </div>

        {isTraining && (
          <div className="mb-4">
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

        {isModelTrained && (
          <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
            <div className="text-green-300 font-semibold mb-2">🎉 Training Successful!</div>
            <div className="text-green-400/80 text-sm">
              Your ml5.js neural network has been trained with {poseSessions.reduce((sum, session) => sum + session.samples, 0)} total samples. 
              Switch to the Testing tab to try it out!
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-4 text-sm mt-4">
          <div>
            <h4 className={`${colors.accentText} font-medium mb-2`}>How to Use:</h4>
            <ul className={`${colors.secondaryText} space-y-1`}>
              <li>• Enter a pose name and click "Start Collecting"</li>
              <li>• Hold the pose while moving naturally</li>
              <li>• Collect samples for at least 2 different poses</li>
              <li>• Click "Train Model" to create your classifier</li>
            </ul>
          </div>
          <div>
            <h4 className={`${colors.accentText} font-medium mb-2`}>Tips:</h4>
            <ul className={`${colors.secondaryText} space-y-1`}>
              <li>• Collect {SAMPLES_PER_POSE} samples per pose for best results</li>
              <li>• Vary your position and angle slightly</li>
              <li>• Ensure good lighting and clear poses</li>
              <li>• More diverse data = better accuracy</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Training;