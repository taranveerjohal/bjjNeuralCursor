import React, { useEffect, useRef, useState } from 'react';
import type p5 from 'p5';
import { useML5 } from '../context/ML5Context';
import { useThemeStyles } from '../hooks/useThemeStyles';

const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 480;
const CONFIDENCE_THRESHOLD = 0.3;

interface TestingProps {
  isActive: boolean;
}

interface PredictionResult {
  label: string;
  confidence: number;
  timestamp: number;
}

interface PredictionHistory {
  predictions: PredictionResult[];
  accuracy: number;
  totalPredictions: number;
}

const Testing: React.FC<TestingProps> = ({ isActive }) => {
  const { 
    isReady, 
    initializePoseDetection, 
    stopPoseDetection, 
    p5Manager, 
    createAdvancedNeuralNetwork,
    classifyPose,
    extractPoseFeatures,
    sharedTrainedModel
  } = useML5();
  
  const { getCardStyles, getButtonStyles, colors, theme } = useThemeStyles();
  
  const containerRef = useRef<HTMLDivElement>(null);
  const p5Ref = useRef<p5>();
  const videoRef = useRef<any>(null);
  const poseDetectorRef = useRef<any>(null);
  const neuralNetworkRef = useRef<any>(null);
  const posesRef = useRef<any[]>([]);
  const connectionsRef = useRef<any[]>([]);
  const predictionIntervalRef = useRef<NodeJS.Timeout>();
  
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Initializing...');
  const [modelLoaded, setModelLoaded] = useState(false);
  const [modelStatus, setModelStatus] = useState('Loading...');
  const [currentPrediction, setCurrentPrediction] = useState<PredictionResult | null>(null);
  const [predictionHistory, setPredictionHistory] = useState<PredictionHistory>({
    predictions: [],
    accuracy: 0,
    totalPredictions: 0
  });
  const [showPredictionDetails, setShowPredictionDetails] = useState(true);
  const [predictionSpeed, setPredictionSpeed] = useState(500); // ms between predictions
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.4); // Lowered to see more predictions
  const [showVisualization, setShowVisualization] = useState(true);

  // Initialize neural network and simple prediction loop
  useEffect(() => {
    if (!isReady) return;
    
    // Check if we have a shared trained model from Training component
    if (sharedTrainedModel) {
      neuralNetworkRef.current = sharedTrainedModel;
      setModelLoaded(true);
      setModelStatus('✅ Model loaded from training session!');
      console.log('Using shared trained model from Training component');
      return;
    }
    
    // Otherwise check localStorage for model availability flag
    const modelTrained = localStorage.getItem('bjj-pose-model-trained');
    if (modelTrained === 'true') {
      setModelLoaded(false);
      setModelStatus('❌ Model was trained but not accessible. Please retrain.');
      console.log('Model was trained but not accessible in Testing component');
    } else {
      setModelLoaded(false);
      setModelStatus('❌ No trained model found. Please train a model first.');
      console.log('No trained model found');
    }
    
  }, [isReady, sharedTrainedModel]);

  // Continuous prediction in draw loop - more responsive than setInterval
  const lastPredictionTimeRef = useRef(0);
  const predictionCooldownRef = useRef(predictionSpeed);

  useEffect(() => {
    predictionCooldownRef.current = predictionSpeed;
  }, [predictionSpeed]);

  // Continuous prediction function to be called from draw loop
  const performContinuousPrediction = async () => {
    const now = Date.now();
    if (now - lastPredictionTimeRef.current < predictionCooldownRef.current) return;
    
    if (!modelLoaded || !neuralNetworkRef.current) return;
    
    try {
      // Only classify if we have poses
      if (posesRef.current && posesRef.current.length > 0) {
        lastPredictionTimeRef.current = now;
        
        const result = await classifyPose(posesRef.current, neuralNetworkRef.current);
        
        // Only update if confidence meets threshold
        if (result && 
            result.label && 
            !['no_model', 'no_pose', 'invalid_features', 'classification_error', 'no_results', 'exception'].includes(result.label) &&
            result.confidence >= confidenceThreshold) {
          
          const newPrediction: PredictionResult = {
            label: result.label,
            confidence: result.confidence,
            timestamp: Date.now()
          };
          
          setCurrentPrediction(newPrediction);
          
          setPredictionHistory(prev => ({
            predictions: [newPrediction, ...prev.predictions].slice(0, 50),
            totalPredictions: prev.totalPredictions + 1,
            accuracy: prev.accuracy
          }));
        }
      } else {
        // No poses - clear prediction after delay
        if (currentPrediction && now - currentPrediction.timestamp > 2000) {
          setCurrentPrediction(null);
        }
      }
    } catch (error) {
      console.error('💥 Prediction error:', error);
    }
  };

  useEffect(() => {
    if (!isActive || !isReady || !containerRef.current) return;

    const sketch = (p: p5) => {
      const gotPoses = (results: any) => {
        // Update poses with fresh results each time
        posesRef.current = results || [];
        
        // Simple debug log to verify poses are updating
        if (results && results.length > 0) {
          console.log('✅ Poses detected:', results.length);
        } else {
          console.log('❌ No poses detected');
        }
      };

      const getPredictionColor = (confidence: number) => {
        if (confidence > 0.8) return [0, 255, 0]; // High confidence - Green
        if (confidence > 0.6) return [255, 255, 0]; // Medium confidence - Yellow
        if (confidence > 0.4) return [255, 165, 0]; // Low confidence - Orange
        return [255, 0, 0]; // Very low confidence - Red
      };

      const drawPredictionVisualization = () => {
        // Only show prediction if we have both a prediction AND poses are detected
        if (!currentPrediction || !showVisualization || !posesRef.current || posesRef.current.length === 0) return;

        const [r, g, b] = getPredictionColor(currentPrediction.confidence);
        
        // Prediction overlay background with rounded corners
        p.fill(0, 0, 0, 200);
        p.noStroke();
        p.rect(10, 10, 320, 140, 15);
        
        // Header
        p.fill(255);
        p.textSize(16);
        p.textAlign(p.LEFT, p.TOP);
        p.text('🔮 AI Prediction:', 25, 30);
        
        // Pose name with confidence color - larger and more prominent
        p.fill(r, g, b);
        p.textSize(32);
        p.textStyle(p.BOLD);
        p.text(currentPrediction.label.toUpperCase(), 25, 60);
        
        // Confidence score
        p.fill(255);
        p.textSize(16);
        p.textStyle(p.NORMAL);
        p.text(`Confidence: ${(currentPrediction.confidence * 100).toFixed(1)}%`, 25, 100);
        
        // Enhanced confidence bar
        const barWidth = 280;
        const barHeight = 12;
        // Background bar
        p.fill(255, 255, 255, 80);
        p.rect(25, 120, barWidth, barHeight, 6);
        // Confidence bar with gradient effect
        p.fill(r, g, b, 220);
        p.rect(25, 120, barWidth * currentPrediction.confidence, barHeight, 6);
        
        // Time since prediction
        const timeSince = (Date.now() - currentPrediction.timestamp) / 1000;
        p.fill(255, 255, 255, 180);
        p.textSize(12);
        p.textAlign(p.RIGHT, p.TOP);
        p.text(`${timeSince.toFixed(1)}s ago`, 315, 100);
      };

      const drawPoseOutline = () => {
        // Only draw if we have a current prediction AND poses are detected
        if (!currentPrediction || !showVisualization || !posesRef.current || posesRef.current.length === 0) return;
        
        posesRef.current.forEach((pose) => {
          if (!pose?.keypoints) return;
          
          const [r, g, b] = getPredictionColor(currentPrediction.confidence);
          
          // Draw enhanced pose outline based on prediction confidence
          const validKeypoints = pose.keypoints.filter((kp: any) => kp.confidence > CONFIDENCE_THRESHOLD);
          
          if (validKeypoints.length > 3) {
            // Use normal coordinates (no flipping for now)
            const xs = validKeypoints.map((kp: any) => kp.x);
            const ys = validKeypoints.map((kp: any) => kp.y);
            const minX = Math.min(...xs) - 30;
            const maxX = Math.max(...xs) + 30;
            const minY = Math.min(...ys) - 30;
            const maxY = Math.max(...ys) + 30;
            
            // Glowing outline effect
            for (let i = 0; i < 3; i++) {
              p.stroke(r, g, b, 50 - i * 15);
              p.strokeWeight(8 - i * 2);
              p.noFill();
              p.rect(minX - i, minY - i, (maxX - minX) + i * 2, (maxY - minY) + i * 2, 15);
            }
            
            // Prediction label near pose
            const centerX = (minX + maxX) / 2;
            const labelY = minY - 40;
            
            p.fill(0, 0, 0, 200);
            p.noStroke();
            p.rect(centerX - 60, labelY - 10, 120, 25, 8);
            
            p.fill(r, g, b);
            p.textSize(14);
            p.textAlign(p.CENTER, p.CENTER);
            p.text(currentPrediction.label.toUpperCase(), centerX, labelY + 2);
          }
        });
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
          video: { 
            width: CANVAS_WIDTH,
            height: CANVAS_HEIGHT,
            facingMode: "user"
          },
          audio: false
        };

        console.log('🎥 Creating video capture with constraints:', constraints);
        setLoadingMessage('Requesting camera access...');
        
        // Create video capture using p5.js method
        videoRef.current = p.createCapture(constraints);
        videoRef.current.size(CANVAS_WIDTH, CANVAS_HEIGHT);
        videoRef.current.hide();

        // Set up event listeners for video
        videoRef.current.elt.addEventListener('loadedmetadata', () => {
          console.log('📹 Video metadata loaded:', {
            width: videoRef.current.elt.videoWidth,
            height: videoRef.current.elt.videoHeight,
            readyState: videoRef.current.elt.readyState
          });
          setLoadingMessage('Video stream ready, loading pose detection...');
        });

        videoRef.current.elt.addEventListener('loadeddata', async () => {
          try {
            console.log('🎬 Video data loaded, waiting for stable video stream...');
            setLoadingMessage('Waiting for stable video stream...');
            
            // Wait a moment for video to be fully ready
            setTimeout(async () => {
              try {
                console.log('🎯 Initializing pose detection...');
                setLoadingMessage('Initializing pose detection...');
                
                const detector = await initializePoseDetection(videoRef.current.elt);
                poseDetectorRef.current = detector;
                
                if (detector && detector.getSkeleton) {
                  connectionsRef.current = detector.getSkeleton();
                }
                
                console.log('🚀 Starting pose detection');
                // Add error handling for detectStart
                try {
                  detector.detectStart(videoRef.current.elt, gotPoses);
                  setIsLoading(false);
                  console.log('✅ Testing initialization complete');
                } catch (startError) {
                  console.error('💥 Error starting detection:', startError);
                  setLoadingMessage('Error starting pose detection. Please refresh the page.');
                }
              } catch (error) {
                console.error('💥 Error initializing pose detection:', error);
                setLoadingMessage('Error initializing pose detection: ' + (error instanceof Error ? error.message : 'Unknown error'));
              }
            }, 1000); // Wait 1 second for video to stabilize
          } catch (error) {
            console.error('💥 Error in loadeddata handler:', error);
            setLoadingMessage('Error preparing video. Please refresh the page.');
          }
        });

        videoRef.current.elt.addEventListener('error', (error: any) => {
          console.error('📺 Video error:', error);
          setLoadingMessage('Camera access failed. Please check permissions and refresh.');
        });

        videoRef.current.elt.addEventListener('canplay', () => {
          console.log('▶️ Video can start playing');
        });

        videoRef.current.elt.addEventListener('playing', () => {
          console.log('🎭 Video is now playing');
        });
      };

      p.draw = () => {
        // Early return if video ref is not available
        if (!videoRef.current?.elt) {
          p.background(0);
          p.fill(255);
          p.textAlign(p.CENTER, p.CENTER);
          p.textSize(16);
          p.text('Initializing camera...', p.width/2, p.height/2);
          return;
        }
        
        p.background(0);
        
        // Draw video feed - check if video is ready and loaded
        const video = videoRef.current.elt;
        if (video && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
          // Draw video normally first (no mirror effect for now to debug)
          p.image(videoRef.current, 0, 0, p.width, p.height);
        } else if (video && video.readyState >= 1) {
          // Video metadata is loaded but not enough data to display
          p.fill(255);
          p.textAlign(p.CENTER, p.CENTER);
          p.textSize(16);
          p.text('Preparing video stream...', p.width/2, p.height/2);
          return;
        } else {
          // Show loading state if video isn't ready
          p.fill(255);
          p.textAlign(p.CENTER, p.CENTER);
          p.textSize(16);
          p.text('Loading video...', p.width/2, p.height/2);
          return; // Don't draw anything else if video isn't ready
        }

        // Perform continuous prediction in draw loop for real-time response
        performContinuousPrediction();

        // Draw poses with standard visualization
        posesRef.current.forEach((pose) => {
          if (!pose?.keypoints) return;

          // Draw skeleton - use normal coordinates (no flipping for now)
          if (connectionsRef.current && showVisualization) {
            connectionsRef.current.forEach(([pointAIndex, pointBIndex]) => {
              const pointA = pose.keypoints[pointAIndex];
              const pointB = pose.keypoints[pointBIndex];
              if (pointA.confidence > CONFIDENCE_THRESHOLD && pointB.confidence > CONFIDENCE_THRESHOLD) {
                p.stroke(255, 255, 255, 150);
                p.strokeWeight(2);
                p.line(pointA.x, pointA.y, pointB.x, pointB.y);
              }
            });
          }

          // Draw keypoints - use normal coordinates (no flipping for now)
          if (showVisualization) {
            pose.keypoints.forEach((keypoint: any) => {
              if (keypoint.confidence > CONFIDENCE_THRESHOLD) {
                p.fill(255, 255, 255, 200);
                p.noStroke();
                p.circle(keypoint.x, keypoint.y, 6);
              }
            });
          }
        });

        // Draw prediction-based pose outline
        drawPoseOutline();
        
        // Draw prediction visualization
        drawPredictionVisualization();
        
        // Show status based on current state
        if (modelLoaded) {
          if (!posesRef.current || posesRef.current.length === 0) {
            // No poses detected
            p.fill(0, 0, 0, 150);
            p.noStroke();
            p.rect(10, 10, 280, 80, 10);
            
            p.fill(255, 165, 0);
            p.textSize(14);
            p.textAlign(p.LEFT, p.TOP);
            p.text('👤 No person detected', 20, 25);
            
            p.fill(255, 255, 255, 180);
            p.textSize(12);
            p.text('Step into frame to start AI detection', 20, 45);
            p.text('Minimum confidence: ' + (confidenceThreshold * 100).toFixed(0) + '%', 20, 65);
          } else if (!currentPrediction) {
            // Poses detected but no valid prediction
            p.fill(0, 0, 0, 150);
            p.noStroke();
            p.rect(10, 10, 280, 80, 10);
            
            p.fill(255, 255, 0);
            p.textSize(14);
            p.textAlign(p.LEFT, p.TOP);
            p.text('🤖 AI Analyzing...', 20, 25);
            
            p.fill(255, 255, 255, 180);
            p.textSize(12);
            p.text('Perform a trained pose or adjust confidence', 20, 45);
            p.text('Poses detected: ' + posesRef.current.length, 20, 65);
          }
        }

        // Model status indicator
        if (!modelLoaded) {
          p.fill(255, 0, 0, 150);
          p.noStroke();
          p.rect(p.width - 250, p.height - 40, 240, 30, 5);
          p.fill(255);
          p.textSize(12);
          p.textAlign(p.CENTER, p.CENTER);
          p.text('⚠️ No model loaded - Train a model first', p.width - 130, p.height - 25);
        }
      };
    };

    // Cleanup previous video and detector
    if (poseDetectorRef.current) {
      try {
        poseDetectorRef.current.detectStop();
        console.log('Stopped previous pose detector');
      } catch (e) {
        console.log('Error stopping previous detector:', e);
      }
    }
    
    if (videoRef.current?.elt?.srcObject) {
      const tracks = videoRef.current.elt.srcObject.getTracks();
      tracks.forEach((track: MediaStreamTrack) => track.stop());
      console.log('Stopped previous video tracks');
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
      // Cleanup moved to useEffect cleanup function
    };
  }, [isActive, isReady, modelLoaded, showVisualization, currentPrediction]);

  const clearPredictionHistory = () => {
    setPredictionHistory({
      predictions: [],
      accuracy: 0,
      totalPredictions: 0
    });
    setCurrentPrediction(null);
    console.log('🗑️ Prediction history cleared');
  };

  const clearCurrentPrediction = () => {
    setCurrentPrediction(null);
    console.log('🗑️ Current prediction cleared manually');
  };

  const restartPredictionLoop = () => {
    // Clear existing interval
    if (predictionIntervalRef.current) {
      clearInterval(predictionIntervalRef.current);
      predictionIntervalRef.current = undefined;
    }
    
    // Clear current prediction
    setCurrentPrediction(null);
    
    // Force re-run of the prediction effect
    console.log('🔄 Restarting prediction loop...');
    
    // This will trigger the useEffect to restart
    setPredictionSpeed(prev => prev);
  };

  const clearStoredModel = () => {
    localStorage.removeItem('bjj-pose-model-trained');
    localStorage.removeItem('bjj-pose-model-timestamp');
    neuralNetworkRef.current = null;
    setModelLoaded(false);
    setModelStatus('❌ Model cleared. Please train a new model.');
    console.log('Model references cleared');
  };

  const refreshModel = async () => {
    setModelStatus('🔄 Checking for trained model...');
    
    // Check if we have a shared trained model
    if (sharedTrainedModel) {
      neuralNetworkRef.current = sharedTrainedModel;
      setModelLoaded(true);
      setModelStatus('✅ Model refreshed from training session!');
      console.log('Model refreshed from shared training session');
      return;
    }
    
    // Otherwise check localStorage flag
    const modelTrained = localStorage.getItem('bjj-pose-model-trained');
    if (modelTrained === 'true') {
      setModelLoaded(false);
      setModelStatus('❌ Model was trained but not accessible. Please retrain or stay on the same browser session.');
    } else {
      setModelLoaded(false);
      setModelStatus('❌ No trained model found. Please train a model first.');
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence > 0.8) return 'text-green-400';
    if (confidence > 0.6) return 'text-yellow-400';
    if (confidence > 0.4) return 'text-orange-400';
    return 'text-red-400';
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence > 0.8) return 'bg-green-500/20 border-green-400 text-green-300';
    if (confidence > 0.6) return 'bg-yellow-500/20 border-yellow-400 text-yellow-300';
    if (confidence > 0.4) return 'bg-orange-500/20 border-orange-400 text-orange-300';
    return 'bg-red-500/20 border-red-400 text-red-300';
  };

  return (
    <div className="w-full space-y-6">
      {/* Control Panel */}
      <div className={`${getCardStyles()} p-6 space-y-6`}>
        <div className="flex items-center justify-between">
          <h3 className={`${colors.primaryText} font-semibold text-lg`}>🧠 AI Model Testing</h3>
          <div className={`px-4 py-2 rounded-full text-sm font-medium border ${
            modelLoaded 
              ? 'bg-green-500/20 border-green-400 text-green-300' 
              : 'bg-red-500/20 border-red-400 text-red-300'
          }`}>
            {modelLoaded ? '✅ Model Ready' : '❌ No Model'}
          </div>
        </div>

        {/* Testing Controls */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h4 className={`${colors.secondaryText} font-medium`}>Prediction Settings</h4>
            
            <div>
              <label className={`block ${colors.secondaryText} text-sm mb-2`}>
                Prediction Speed: {predictionSpeed}ms
              </label>
              <input
                type="range"
                min="100"
                max="2000"
                step="100"
                value={predictionSpeed}
                onChange={(e) => setPredictionSpeed(parseInt(e.target.value))}
                className="w-full h-2 bg-white/20 rounded-lg appearance-none slider"
                disabled={!modelLoaded}
              />
              <div className="flex justify-between text-xs text-white/50 mt-1">
                <span>Fast (100ms)</span>
                <span>Slow (2s)</span>
              </div>
            </div>

            <div>
              <label className={`block ${colors.secondaryText} text-sm mb-2`}>
                Confidence Threshold: {(confidenceThreshold * 100).toFixed(0)}%
              </label>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.1"
                value={confidenceThreshold}
                onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
                className="w-full h-2 bg-white/20 rounded-lg appearance-none slider"
                disabled={!modelLoaded}
              />
              <div className="flex justify-between text-xs text-white/50 mt-1">
                <span>Lenient (10%)</span>
                <span>Strict (100%)</span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className={`${colors.secondaryText} font-medium`}>Visualization Options</h4>
            
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={showVisualization}
                onChange={(e) => setShowVisualization(e.target.checked)}
                className="w-4 h-4 text-purple-500 bg-transparent border-2 border-white/30 rounded focus:ring-purple-500"
              />
              <span className={colors.secondaryText}>Show pose visualization</span>
            </label>
            
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={showPredictionDetails}
                onChange={(e) => setShowPredictionDetails(e.target.checked)}
                className="w-4 h-4 text-purple-500 bg-transparent border-2 border-white/30 rounded focus:ring-purple-500"
              />
              <span className={colors.secondaryText}>Show prediction details</span>
            </label>

            <button
              onClick={refreshModel}
              className={`w-full px-4 py-2 ${getButtonStyles('secondary')} mb-2`}
            >
              🔄 Refresh Model
            </button>
            
            <button
              onClick={clearStoredModel}
              className={`w-full px-4 py-2 ${getButtonStyles('danger')} mb-2`}
              disabled={!modelLoaded}
            >
              🗑️ Clear Model
            </button>
            
            <button
              onClick={clearPredictionHistory}
              className={`w-full px-4 py-2 ${getButtonStyles('danger')} mb-2`}
              disabled={predictionHistory.predictions.length === 0}
            >
              🗑️ Clear History
            </button>
            
            <button
              onClick={clearCurrentPrediction}
              className={`w-full px-4 py-2 ${getButtonStyles('secondary')} mb-2`}
              disabled={!currentPrediction}
            >
              🧹 Clear Current Prediction
            </button>
            
            <button
              onClick={restartPredictionLoop}
              className={`w-full px-4 py-2 ${getButtonStyles('primary')}`}
              disabled={!modelLoaded}
            >
              🔄 Restart Detection
            </button>
          </div>
        </div>
      </div>

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
                <div className={`w-16 h-16 border-4 ${theme === 'blackwhite' ? 'border-gray-600/30 border-t-gray-400' : 'border-purple-500/30 border-t-purple-500'} rounded-full animate-spin mx-auto mb-4`}></div>
                <div className={`${colors.primaryText} text-lg font-medium mb-2`}>{loadingMessage}</div>
                <div className={`${colors.accentText} text-sm`}>Preparing AI testing environment...</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Current Prediction Display */}
      {!isLoading && currentPrediction && showPredictionDetails && (
        <div className={`${getCardStyles()} p-6`}>
          <h3 className={`${colors.primaryText} font-semibold text-lg mb-4`}>🔮 Current AI Prediction</h3>
          <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center text-2xl">
                🥋
              </div>
              <div>
                <div className={`text-2xl font-bold ${colors.primaryText}`}>{currentPrediction.label.toUpperCase()}</div>
                <div className={`${colors.secondaryText} text-sm`}>
                  Detected {((Date.now() - currentPrediction.timestamp) / 1000).toFixed(1)}s ago
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className={`text-2xl font-bold ${getConfidenceColor(currentPrediction.confidence)}`}>
                {(currentPrediction.confidence * 100).toFixed(1)}%
              </div>
              <div className={`px-3 py-1 rounded-full text-xs border ${getConfidenceBadge(currentPrediction.confidence)}`}>
                {currentPrediction.confidence > 0.8 ? 'High' : 
                 currentPrediction.confidence > 0.6 ? 'Medium' : 
                 currentPrediction.confidence > 0.4 ? 'Low' : 'Very Low'} Confidence
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Prediction History */}
      {predictionHistory.predictions.length > 0 && showPredictionDetails && (
        <div className={`${getCardStyles()} p-6`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={`${colors.primaryText} font-semibold text-lg`}>
              📊 Prediction History ({predictionHistory.predictions.length})
            </h3>
            <div className={`${colors.secondaryText} text-sm`}>
              Total: {predictionHistory.totalPredictions} predictions
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-2">
            {predictionHistory.predictions.slice(0, 10).map((prediction, index) => (
              <div 
                key={`${prediction.timestamp}-${index}`} 
                className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center text-white text-xs font-bold">
                    {prediction.label.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className={`${colors.primaryText} font-medium`}>{prediction.label}</div>
                    <div className={`${colors.accentText} text-xs`}>
                      {new Date(prediction.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
                <div className={`font-mono ${getConfidenceColor(prediction.confidence)}`}>
                  {(prediction.confidence * 100).toFixed(1)}%
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Model Status & Instructions */}
      <div className={`${getCardStyles()} p-6`}>
        <h3 className={`${colors.primaryText} font-semibold text-lg mb-4`}>📋 Model Status & Instructions</h3>
        
        <div className="mb-4">
          <h4 className={`${colors.accentText} font-medium mb-2`}>Current Status:</h4>
          <p className={`text-sm ${modelLoaded ? 'text-green-400' : 'text-red-400'}`}>
            {modelStatus}
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div>
            <h4 className={`${colors.accentText} font-medium mb-2`}>How to Use:</h4>
            <ul className={`${colors.secondaryText} space-y-1`}>
              <li>• Train a model in the Training tab first</li>
              <li>• Position yourself in front of the camera</li>
              <li>• Perform the poses you trained</li>
              <li>• Watch real-time AI predictions</li>
            </ul>
          </div>
          <div>
            <h4 className={`${colors.accentText} font-medium mb-2`}>Features:</h4>
            <ul className={`${colors.secondaryText} space-y-1`}>
              <li>• Advanced neural network predictions</li>
              <li>• Confidence-based color coding</li>
              <li>• Real-time pose classification</li>
              <li>• Adjustable prediction sensitivity</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Testing;