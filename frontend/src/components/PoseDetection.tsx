import React, { useEffect, useRef, useState } from 'react';
import type p5 from 'p5';
import { useML5 } from '../context/ML5Context';
import { useThemeStyles } from '../hooks/useThemeStyles';

const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 480;
const CONFIDENCE_THRESHOLD = 0.3;

interface PoseDetectionProps {
  isActive: boolean;
}

interface PoseStats {
  totalPoses: number;
  averageConfidence: number;
  detectionRate: number;
  keyPointsDetected: number;
}

const PoseDetection: React.FC<PoseDetectionProps> = ({ isActive }) => {
  const { isReady, initializePoseDetection, stopPoseDetection, p5Manager } = useML5();
  const { getCardStyles, getCheckboxStyles, getStatsCardStyles, colors, theme } = useThemeStyles();
  const containerRef = useRef<HTMLDivElement>(null);
  const p5Ref = useRef<p5>();
  const videoRef = useRef<any>(null);
  const poseDetectorRef = useRef<any>(null);
  const posesRef = useRef<any[]>([]);
  const connectionsRef = useRef<any[]>([]);
  const frameCountRef = useRef(0);
  const detectionCountRef = useRef(0);
  
  // Refs for accessing current state in p5 callbacks
  const showStatsRef = useRef(false);
  const showSkeletonRef = useRef(true);
  const showKeypointsRef = useRef(true);
  const showLabelsRef = useRef(false);
  
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Initializing...');
  const [showStats, setShowStats] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [showKeypoints, setShowKeypoints] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [poseStats, setPoseStats] = useState<PoseStats>({
    totalPoses: 0,
    averageConfidence: 0,
    detectionRate: 0,
    keyPointsDetected: 0
  });

  // Keep refs in sync with state
  useEffect(() => {
    showStatsRef.current = showStats;
  }, [showStats]);
  
  useEffect(() => {
    showSkeletonRef.current = showSkeleton;
  }, [showSkeleton]);
  
  useEffect(() => {
    showKeypointsRef.current = showKeypoints;
  }, [showKeypoints]);
  
  useEffect(() => {
    showLabelsRef.current = showLabels;
  }, [showLabels]);

  useEffect(() => {
    if (!isActive || !isReady || !containerRef.current) return;

    const sketch = (p: p5) => {
      const gotPoses = (results: any) => {
        posesRef.current = results || [];
      };

      const updatePoseStats = () => {
        const currentPoses = posesRef.current;
        if (currentPoses.length === 0) return;
        
        const totalKeypoints = currentPoses.reduce((sum, pose) => {
          return sum + (pose.keypoints?.filter((kp: any) => kp.confidence > CONFIDENCE_THRESHOLD).length || 0);
        }, 0);
        
        const totalConfidence = currentPoses.reduce((sum, pose) => {
          const validKps = pose.keypoints?.filter((kp: any) => kp.confidence > CONFIDENCE_THRESHOLD) || [];
          return sum + validKps.reduce((kpSum: number, kp: any) => kpSum + kp.confidence, 0);
        }, 0);
        
        setPoseStats({
          totalPoses: currentPoses.length,
          averageConfidence: totalKeypoints > 0 ? totalConfidence / totalKeypoints : 0,
          detectionRate: frameCountRef.current > 0 ? (detectionCountRef.current / frameCountRef.current) * 100 : 0,
          keyPointsDetected: totalKeypoints
        });
      };

      const drawStatsOverlay = (p: p5) => {
        // Semi-transparent background
        p.fill(0, 0, 0, 180);
        p.noStroke();
        p.rect(10, p.height - 120, 200, 110, 8);
        
        // Stats text
        p.fill(255);
        p.textAlign(p.LEFT, p.TOP);
        p.textSize(12);
        p.text('Detection Stats:', 20, p.height - 110);
        p.textSize(10);
        p.text(`Poses: ${poseStats.totalPoses}`, 20, p.height - 95);
        p.text(`Keypoints: ${poseStats.keyPointsDetected}`, 20, p.height - 80);
        p.text(`Avg Confidence: ${(poseStats.averageConfidence * 100).toFixed(1)}%`, 20, p.height - 65);
        p.text(`Detection Rate: ${poseStats.detectionRate.toFixed(1)}%`, 20, p.height - 50);
        p.text(`FPS: ~${p.frameRate().toFixed(0)}`, 20, p.height - 35);
        p.text(`Threshold: ${(CONFIDENCE_THRESHOLD * 100).toFixed(0)}%`, 20, p.height - 20);
      };

      p.setup = () => {
        // Create canvas
        const canvas = p.createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
        canvas.parent(containerRef.current!);
        p.pixelDensity(1);

        // Clean up any existing video elements first
        if (videoRef.current?.elt) {
          const tracks = videoRef.current.elt.srcObject?.getTracks() || [];
          tracks.forEach((track: MediaStreamTrack) => track.stop());
          videoRef.current.remove();
          videoRef.current = null;
        }
        
        // Remove any existing video elements in the container
        const existingVideos = containerRef.current!.querySelectorAll('video');
        existingVideos.forEach(video => video.remove());

        // Create video capture
        const constraints = {
          video: {
            width: { ideal: CANVAS_WIDTH },
            height: { ideal: CANVAS_HEIGHT },
            facingMode: "user"
          },
          audio: false
        };

        setLoadingMessage('Initializing camera...');
        videoRef.current = p.createCapture(constraints);
        videoRef.current.size(CANVAS_WIDTH, CANVAS_HEIGHT);
        videoRef.current.hide(); // Keep hidden since we draw it on canvas

        // Add error handling for video
        videoRef.current.elt.addEventListener('error', (error: any) => {
          console.error('Video error:', error);
          setLoadingMessage('Camera access failed. Please check permissions.');
        });

        // Initialize pose detection after video is ready
        videoRef.current.elt.addEventListener('loadeddata', async () => {
          try {
            console.log('Video ready, dimensions:', videoRef.current.elt.videoWidth, 'x', videoRef.current.elt.videoHeight);
            setLoadingMessage('Initializing pose detection...');
            const detector = await initializePoseDetection(videoRef.current.elt);
            poseDetectorRef.current = detector;
            connectionsRef.current = detector.getSkeleton();
            detector.detectStart(videoRef.current.elt, gotPoses);
            console.log('Pose detection started, setting loading to false');
            setIsLoading(false);
          } catch (error) {
            console.error('Error initializing pose detection:', error);
            setLoadingMessage('Error initializing pose detection. Please refresh the page.');
            setIsLoading(true);
          }
        });
      };

      p.draw = () => {
        if (!videoRef.current?.elt) return;

        // Clear canvas with black background
        p.background(0);

        // Draw video if it's ready and has valid dimensions
        if (videoRef.current.elt.videoWidth > 0 && videoRef.current.elt.videoHeight > 0) {
          p.image(videoRef.current, 0, 0, p.width, p.height);
        } else {
          // Debug: show video state
          p.fill(255);
          p.textAlign(p.CENTER);
          p.text(`Video: ${videoRef.current.elt.videoWidth}x${videoRef.current.elt.videoHeight}`, p.width/2, p.height/2);
          p.text(`Loading: ${isLoading}`, p.width/2, p.height/2 + 20);
        }

        // Only draw poses if detector is ready
        if (!poseDetectorRef.current) return;

        // Update frame counting for stats
        frameCountRef.current++;
        if (posesRef.current.length > 0) {
          detectionCountRef.current++;
        }

        // Update stats every 30 frames (roughly once per second at 30fps)
        if (frameCountRef.current % 30 === 0) {
          updatePoseStats();
        }

        // Draw poses with enhanced visualization
        posesRef.current.forEach((pose, personIndex) => {
          if (!pose?.keypoints) return;

          // Calculate pose confidence
          const validKeypoints = pose.keypoints.filter((kp: any) => kp.confidence > CONFIDENCE_THRESHOLD);
          const poseConfidence = validKeypoints.length > 0 
            ? validKeypoints.reduce((sum: number, kp: any) => sum + kp.confidence, 0) / validKeypoints.length 
            : 0;

          // Dynamic colors based on confidence
          const confidenceColor = {
            r: Math.max(0, 255 - (poseConfidence * 255)),
            g: Math.min(255, poseConfidence * 255),
            b: 100
          };

          // Draw skeleton connections with confidence-based styling
          if (showSkeletonRef.current && connectionsRef.current) {
            connectionsRef.current.forEach(([pointAIndex, pointBIndex]) => {
              const pointA = pose.keypoints[pointAIndex];
              const pointB = pose.keypoints[pointBIndex];

              if (pointA.confidence > CONFIDENCE_THRESHOLD && 
                  pointB.confidence > CONFIDENCE_THRESHOLD) {
                const lineConfidence = (pointA.confidence + pointB.confidence) / 2;
                const alpha = Math.min(255, lineConfidence * 300);
                
                p.stroke(confidenceColor.r, confidenceColor.g, confidenceColor.b, alpha);
                p.strokeWeight(3);
                p.line(pointA.x, pointA.y, pointB.x, pointB.y);
                
                // Add glow effect for high confidence
                if (lineConfidence > 0.8) {
                  p.stroke(255, 255, 255, 100);
                  p.strokeWeight(1);
                  p.line(pointA.x, pointA.y, pointB.x, pointB.y);
                }
              }
            });
          }

          // Draw keypoints with enhanced styling
          if (showKeypointsRef.current) {
            pose.keypoints.forEach((keypoint: any) => {
              if (keypoint.confidence > CONFIDENCE_THRESHOLD) {
                const kpConfidence = keypoint.confidence;
                const kpSize = 6 + (kpConfidence * 8);
                
                // Outer ring
                p.fill(confidenceColor.r, confidenceColor.g, confidenceColor.b, 200);
                p.noStroke();
                p.circle(keypoint.x, keypoint.y, kpSize + 4);
                
                // Inner circle
                p.fill(255, 255, 255, 240);
                p.circle(keypoint.x, keypoint.y, kpSize);
                
                // Center dot
                p.fill(0, 0, 0, 180);
                p.circle(keypoint.x, keypoint.y, 2);

                // Draw keypoint labels if enabled
                if (showLabelsRef.current) {
                  p.fill(0, 0, 0, 200);
                  p.noStroke();
                  p.rect(keypoint.x - 25, keypoint.y - 25, 50, 15, 3);
                  
                  p.fill(255);
                  p.textSize(10);
                  p.textAlign(p.CENTER, p.CENTER);
                  p.text(keypoint.name.replace('_', ' '), keypoint.x, keypoint.y - 18);
                }
              }
            });
          }

          // Enhanced person identification
          const nose = pose.keypoints.find((kp: any) => kp.name === 'nose');
          if (nose?.confidence > CONFIDENCE_THRESHOLD) {
            // Person badge background
            p.fill(0, 0, 0, 150);
            p.noStroke();
            p.rect(nose.x - 45, nose.y - 50, 90, 25, 12);
            
            // Person badge text
            p.fill(255, 255, 255);
            p.textSize(14);
            p.textAlign(p.CENTER, p.CENTER);
            p.text(`Person ${personIndex + 1}`, nose.x, nose.y - 37);
            
            // Confidence indicator
            p.fill(confidenceColor.r, confidenceColor.g, confidenceColor.b);
            p.textSize(10);
            p.text(`${(poseConfidence * 100).toFixed(0)}%`, nose.x, nose.y - 25);
          }

          // Draw pose bounding box
          if (validKeypoints.length > 3) {
            const xs = validKeypoints.map((kp: any) => kp.x);
            const ys = validKeypoints.map((kp: any) => kp.y);
            const minX = Math.min(...xs) - 20;
            const maxX = Math.max(...xs) + 20;
            const minY = Math.min(...ys) - 20;
            const maxY = Math.max(...ys) + 20;
            
            p.stroke(confidenceColor.r, confidenceColor.g, confidenceColor.b, 150);
            p.strokeWeight(2);
            p.noFill();
            p.rect(minX, minY, maxX - minX, maxY - minY, 8);
          }
        });

        // Draw performance overlay
        if (showStatsRef.current) {
          drawStatsOverlay(p);
        }
      };
    };

    // Safe cleanup - only stop video tracks
    if (videoRef.current?.elt?.srcObject) {
      const tracks = videoRef.current.elt.srcObject.getTracks();
      tracks.forEach((track: MediaStreamTrack) => track.stop());
    }
    videoRef.current = null;
    poseDetectorRef.current = null;

    // Use p5Manager to create instance
    p5Ref.current = p5Manager.createInstance(containerRef.current, sketch);

    // Cleanup function
    return () => {
      console.log('PoseDetection cleanup started');
      
      // Stop pose detection first
      if (poseDetectorRef.current) {
        try {
          poseDetectorRef.current.detectStop();
        } catch (error) {
          console.error('Error stopping pose detector:', error);
        }
      }
      stopPoseDetection();
      
      // Stop video tracks
      if (videoRef.current?.elt?.srcObject) {
        const tracks = videoRef.current.elt.srcObject.getTracks();
        tracks.forEach((track: MediaStreamTrack) => {
          track.stop();
          console.log('Video track stopped');
        });
      }
      
      // Remove p5 instance
      if (p5Ref.current) {
        p5Manager.removeInstance(p5Ref.current);
      }
      
      // Clear refs
      videoRef.current = null;
      poseDetectorRef.current = null;
      posesRef.current = [];
      connectionsRef.current = [];
      
      // Reset state
      setIsLoading(true);
      setLoadingMessage('Initializing...');
      
      console.log('PoseDetection cleanup completed');
    };
  }, [isActive, isReady, initializePoseDetection, stopPoseDetection, p5Manager]);

  return (
    <div className="w-full space-y-6">
      {/* Control Panel */}
      <div className={`flex flex-wrap gap-4 p-6 ${getCardStyles()}`}>
        <div className="flex items-center space-x-3">
          <span className={`${colors.primaryText} font-medium`}>Visualization:</span>
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showSkeleton}
              onChange={(e) => setShowSkeleton(e.target.checked)}
              className={getCheckboxStyles()}
            />
            <span className={`${colors.secondaryText} text-sm`}>Skeleton</span>
          </label>
          
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showKeypoints}
              onChange={(e) => setShowKeypoints(e.target.checked)}
              className={getCheckboxStyles()}
            />
            <span className={`${colors.secondaryText} text-sm`}>Keypoints</span>
          </label>
          
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showLabels}
              onChange={(e) => setShowLabels(e.target.checked)}
              className={getCheckboxStyles()}
            />
            <span className={`${colors.secondaryText} text-sm`}>Labels</span>
          </label>
          
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showStats}
              onChange={(e) => setShowStats(e.target.checked)}
              className={getCheckboxStyles()}
            />
            <span className={`${colors.secondaryText} text-sm`}>Stats</span>
          </label>
        </div>
        
        <div className="flex items-center space-x-3 text-sm">
          <span className={colors.accentText}>Confidence Threshold:</span>
          <span className={`px-3 py-1 ${colors.cardBg} rounded-full ${colors.accentText} font-mono`}>
            {(CONFIDENCE_THRESHOLD * 100).toFixed(0)}%
          </span>
        </div>
      </div>

      {/* Video Canvas */}
      <div className="flex justify-center">
        <div 
          ref={containerRef} 
          className="relative bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/10"
          style={{ 
            width: CANVAS_WIDTH, 
            height: CANVAS_HEIGHT,
            minWidth: CANVAS_WIDTH,
            minHeight: CANVAS_HEIGHT
          }}
        >
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm">
              <div className="text-center">
                <div className={`w-16 h-16 border-4 ${theme === 'blackwhite' ? 'border-gray-600/30 border-t-gray-400' : 'border-purple-500/30 border-t-purple-500'} rounded-full animate-spin mx-auto mb-4`}></div>
                <div className={`${colors.primaryText} text-lg font-medium mb-2`}>{loadingMessage}</div>
                <div className={`${colors.accentText} text-sm`}>Please allow camera access when prompted</div>
              </div>
            </div>
          )}
          
          {/* Corner indicators */}
          <div className="absolute top-4 left-4 w-6 h-6 border-l-2 border-t-2 border-purple-500/50"></div>
          <div className="absolute top-4 right-4 w-6 h-6 border-r-2 border-t-2 border-purple-500/50"></div>
          <div className="absolute bottom-4 left-4 w-6 h-6 border-l-2 border-b-2 border-purple-500/50"></div>
          <div className="absolute bottom-4 right-4 w-6 h-6 border-r-2 border-b-2 border-purple-500/50"></div>
        </div>
      </div>

      {/* Real-time Stats Display */}
      {!isLoading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className={getStatsCardStyles('purple')}>
            <div className={`text-2xl font-bold ${colors.primaryText}`}>{poseStats.totalPoses}</div>
            <div className={`${colors.accentText} text-sm`}>Poses Detected</div>
          </div>
          
          <div className={getStatsCardStyles('blue')}>
            <div className={`text-2xl font-bold ${colors.primaryText}`}>{poseStats.keyPointsDetected}</div>
            <div className={`${colors.accentText} text-sm`}>Active Keypoints</div>
          </div>
          
          <div className={getStatsCardStyles('green')}>
            <div className={`text-2xl font-bold ${colors.primaryText}`}>{(poseStats.averageConfidence * 100).toFixed(1)}%</div>
            <div className={`${colors.accentText} text-sm`}>Avg Confidence</div>
          </div>
          
          <div className={getStatsCardStyles('orange')}>
            <div className={`text-2xl font-bold ${colors.primaryText}`}>{poseStats.detectionRate.toFixed(1)}%</div>
            <div className={`${colors.accentText} text-sm`}>Detection Rate</div>
          </div>
        </div>
      )}

      {/* Information Panel */}
      <div className={`p-6 ${getCardStyles()}`}>
        <h3 className={`${colors.primaryText} font-semibold text-lg mb-3`}>Real-time Pose Detection</h3>
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div>
            <h4 className={`${colors.accentText} font-medium mb-2`}>Features:</h4>
            <ul className={`${colors.secondaryText} space-y-1`}>
              <li>• Multi-person pose detection</li>
              <li>• 17 keypoint skeleton tracking</li>
              <li>• Real-time confidence scoring</li>
              <li>• Advanced visualization options</li>
            </ul>
          </div>
          <div>
            <h4 className={`${colors.accentText} font-medium mb-2`}>Controls:</h4>
            <ul className={`${colors.secondaryText} space-y-1`}>
              <li>• Toggle skeleton/keypoint display</li>
              <li>• Enable/disable joint labels</li>
              <li>• View real-time performance stats</li>
              <li>• Confidence-based color coding</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PoseDetection;