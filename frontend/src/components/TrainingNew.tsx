import React, { useEffect, useRef, useState } from 'react';
import type p5 from 'p5';
import { useML5 } from '../context/ML5Context';
import { useThemeStyles } from '../hooks/useThemeStyles';

const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 480;
const CONFIDENCE_THRESHOLD = 0.3;

interface TrainingProps {
  isActive: boolean;
}

interface TrainingData {
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
  
  // Refs for accessing current state in p5 callbacks
  const isCollectingRef = useRef(false);
  const currentPoseRef = useRef('');
  const samplesCollectedRef = useRef(0);
  
  // Training state
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Initializing...');
  const [currentPose, setCurrentPose] = useState('');
  const [isCollecting, setIsCollecting] = useState(false);
  const [samplesCollected, setSamplesCollected] = useState(0);
  const [trainingData, setTrainingData] = useState<TrainingData[]>([]);
  const [isTraining, setIsTraining] = useState(false);
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [isModelTrained, setIsModelTrained] = useState(false);
  const [showTrainingProgress, setShowTrainingProgress] = useState(true);

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

  // Initialize neural network once
  useEffect(() => {
    if (!isReady || neuralNetworkRef.current) return;
    
    try {
      console.log('🧠 Creating ml5.js neural network for pose classification');
      neuralNetworkRef.current = createAdvancedNeuralNetwork();
      console.log('✅ Neural network created successfully');
    } catch (error) {
      console.error('❌ Error creating neural network:', error);
    }
  }, [isReady, createAdvancedNeuralNetwork]);

  useEffect(() => {
    if (!isActive || !isReady || !containerRef.current) return;

    const sketch = (p: p5) => {
      const gotPoses = (results: any) => {
        posesRef.current = results || [];
        
        // Collect data when actively collecting
        if (isCollectingRef.current && results && results.length > 0 && neuralNetworkRef.current) {
          const pose = results[0];
          if (pose?.keypoints) {
            // Extract features using ml5.js pattern
            const inputs = extractPoseFeatures(results);
            const target = currentPoseRef.current;
            
            // Add data to neural network (ml5.js addData pattern)
            neuralNetworkRef.current.addData(inputs, { pose: target });
            
            console.log(`📊 Added sample ${samplesCollectedRef.current + 1} for pose: ${target}`);
            
            setSamplesCollected(prev => prev + 1);
          }
        }
      };

      p.setup = () => {
        const canvas = p.createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
        canvas.parent(containerRef.current!);
        
        // Cleanup existing video elements
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

        setLoadingMessage('Requesting camera access...');
        videoRef.current = p.createCapture(constraints);
        videoRef.current.size(CANVAS_WIDTH, CANVAS_HEIGHT);
        videoRef.current.hide();

        videoRef.current.elt.addEventListener('error', (error: any) => {
          console.error('📹 Video error:', error);
          setLoadingMessage('Camera access failed. Please check permissions.');
        });

        videoRef.current.elt.addEventListener('loadeddata', async () => {
          try {
            setLoadingMessage('Waiting for stable video...');
            
            setTimeout(async () => {
              try {
                setLoadingMessage('Initializing pose detection...');
                const detector = await initializePoseDetection(videoRef.current.elt);
                poseDetectorRef.current = detector;
                
                if (detector && detector.getSkeleton) {
                  connectionsRef.current = detector.getSkeleton();
                }
                
                detector.detectStart(videoRef.current.elt, gotPoses);
                setIsLoading(false);
                console.log('✅ Training setup complete');
              } catch (error) {
                console.error('❌ Error initializing pose detection:', error);
                setLoadingMessage('Error initializing pose detection.');
              }
            }, 1000);
          } catch (error) {
            console.error('❌ Error in loadeddata handler:', error);
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

        // Draw poses
        posesRef.current.forEach((pose) => {
          if (!pose?.keypoints) return;

          // Draw skeleton
          if (connectionsRef.current) {
            connectionsRef.current.forEach(([pointAIndex, pointBIndex]) => {
              const pointA = pose.keypoints[pointAIndex];
              const pointB = pose.keypoints[pointBIndex];
              if (pointA.confidence > CONFIDENCE_THRESHOLD && pointB.confidence > CONFIDENCE_THRESHOLD) {
                p.stroke(255, 255, 255, isCollectingRef.current ? 255 : 150);
                p.strokeWeight(isCollectingRef.current ? 4 : 2);
                p.line(pointA.x, pointA.y, pointB.x, pointB.y);
              }
            });
          }

          // Draw keypoints
          pose.keypoints.forEach((keypoint: any) => {
            if (keypoint.confidence > CONFIDENCE_THRESHOLD) {
              p.fill(isCollectingRef.current ? 255 : 200, isCollectingRef.current ? 100 : 255, 100, 240);
              p.noStroke();
              p.circle(keypoint.x, keypoint.y, isCollectingRef.current ? 12 : 8);
              
              // White center
              p.fill(255);
              p.circle(keypoint.x, keypoint.y, isCollectingRef.current ? 4 : 3);
            }
          });
        });

        // Recording indicator
        if (isCollectingRef.current) {
          // Pulsing red circle
          const pulse = (Math.sin(p.frameCount * 0.3) + 1) / 2;
          p.fill(255, 0, 0, 150 + pulse * 105);
          p.noStroke();
          p.circle(30, 30, 25 + pulse * 10);
          
          // Recording text
          p.fill(0, 0, 0, 180);
          p.rect(60, 15, 320, 30, 8);
          p.fill(255);
          p.textSize(16);
          p.textAlign(p.LEFT, p.CENTER);
          p.text(`🔴 Collecting "${currentPoseRef.current}": ${samplesCollectedRef.current} samples`, 70, 30);
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
      };
    };

    // Cleanup previous instances
    if (poseDetectorRef.current) {
      try {
        poseDetectorRef.current.detectStop();
      } catch (e) {
        console.log('Error stopping previous detector:', e);
      }
    }
    
    if (videoRef.current?.elt?.srcObject) {
      const tracks = videoRef.current.elt.srcObject.getTracks();
      tracks.forEach((track: MediaStreamTrack) => track.stop());
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
    
    if (trainingData.some(data => data.pose === currentPose)) {
      alert('This pose has already been recorded! Use a different name.');
      return;
    }

    setIsCollecting(true);
    setSamplesCollected(0);
    console.log(`🎯 Started collecting data for pose: ${currentPose}`);
  };

  const stopCollecting = () => {
    setIsCollecting(false);
    
    if (samplesCollected > 0) {
      const newData: TrainingData = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        pose: currentPose,
        samples: samplesCollected,
        timestamp: Date.now()
      };
      
      setTrainingData(prev => [...prev, newData]);
      console.log(`✅ Saved ${samplesCollected} samples for pose: ${currentPose}`);
    }
    
    setCurrentPose('');
    setSamplesCollected(0);
  };

  const trainModel = async () => {
    if (trainingData.length < 2) {
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
      console.log('🚀 Starting ml5.js neural network training...');
      
      // Normalize data (ml5.js requirement)
      neuralNetworkRef.current.normalizeData();
      console.log('📊 Data normalized');
      
      const options = {
        epochs: 10,
        batchSize: 4
      };
      
      // Train with proper ml5.js callbacks
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
      setTrainingData([]);
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
            {!isCollecting ? (
              <button
                onClick={startCollecting}
                disabled={!currentPose.trim() || isTraining}
                className={`px-6 py-3 ${getButtonStyles('primary')} disabled:opacity-50`}
              >
                🎬 Start Collecting
              </button>
            ) : (
              <button
                onClick={stopCollecting}
                className={`px-6 py-3 ${getButtonStyles('danger')}`}
              >
                🛑 Stop ({samplesCollected} samples)
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
              📊 Collected Data ({trainingData.length} poses)
            </h4>
            
            {trainingData.length > 0 ? (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {trainingData.map((data) => (
                  <div 
                    key={data.id} 
                    className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 ${theme === 'blackwhite' ? 'bg-gradient-to-r from-gray-600 to-gray-800' : 'bg-gradient-to-r from-purple-500 to-pink-500'} rounded-lg flex items-center justify-center text-white font-bold`}>
                        {data.pose.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className={`${colors.primaryText} font-medium`}>{data.pose}</div>
                        <div className={`${colors.accentText} text-sm`}>
                          {data.samples} samples • {new Date(data.timestamp).toLocaleTimeString()}
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
              disabled={trainingData.length < 2 || isTraining || isCollecting}
              className={`px-6 py-3 ${getButtonStyles('success')} disabled:opacity-50`}
            >
              {isTraining ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                  Training... {trainingProgress}%
                </>
              ) : trainingData.length < 2 ? (
                `🎯 Need ${2 - trainingData.length} more pose${trainingData.length === 1 ? '' : 's'}`
              ) : (
                '🚀 Train Model (Fast)'
              )}
            </button>
            
            {isTraining && (
              <button
                onClick={() => setShowTrainingProgress(!showTrainingProgress)}
                className={`px-3 py-2 ${getButtonStyles('secondary')} text-sm`}
              >
                {showTrainingProgress ? '👁️ Hide Progress' : '👁️ Show Progress'}
              </button>
            )}
            
            {trainingData.length > 0 && (
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

        {isTraining && showTrainingProgress && (
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
              Your ml5.js neural network has been trained with {trainingData.reduce((sum, data) => sum + data.samples, 0)} total samples. 
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
              <li>• Collect 50-100 samples per pose for best results</li>
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