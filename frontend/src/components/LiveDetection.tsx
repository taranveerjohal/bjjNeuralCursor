import React, { useEffect, useRef, useState } from 'react';

interface PoseKeypoint {
  x: number;
  y: number;
  score: number;
  name: string;
}

interface Pose {
  keypoints: PoseKeypoint[];
  keypoints3D?: PoseKeypoint[];
  score: number;
}

declare global {
  interface Window {
    ml5: any;
  }
}

const LiveDetection: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [poseNet, setPoseNet] = useState<any>(null);
  const [poses, setPoses] = useState<Pose[]>([]);
  const [fps, setFps] = useState(0);
  const [isModelLoaded, setIsModelLoaded] = useState(false);

  // Initialize MoveNet model
  useEffect(() => {
    const initModel = async () => {
      try {
        if (window.ml5) {
          const model = await window.ml5.pose('MoveNet', {
            modelType: 'lightning',
            enableSmoothing: true,
            enableTracking: true,
            minPoseScore: 0.3,
            multiPoseMaxDimension: 256
          });
          setPoseNet(model);
          setIsModelLoaded(true);
          console.log('MoveNet model loaded successfully');
        }
      } catch (error) {
        console.error('Error loading MoveNet model:', error);
      }
    };

    initModel();
  }, []);

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
      }
    } catch (error) {
      console.error('Error accessing webcam:', error);
      alert('Error accessing webcam. Please make sure you have granted camera permissions.');
    }
  };

  // Stop video stream
  const stopVideo = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setIsDetecting(false);
      setPoses([]);
    }
  };

  // Draw skeleton on canvas
  const drawSkeleton = (ctx: CanvasRenderingContext2D, pose: Pose, videoWidth: number, videoHeight: number) => {
    const keypoints = pose.keypoints;
    
    // Define connections between keypoints (skeleton structure)
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

    // Draw connections (bones)
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

    // Draw keypoints (joints)
    keypoints.forEach(keypoint => {
      if (keypoint.score > 0.3) {
        ctx.fillStyle = keypoint.score > 0.7 ? '#ff0000' : '#ffaa00';
        ctx.beginPath();
        ctx.arc(keypoint.x, keypoint.y, 4, 0, 2 * Math.PI);
        ctx.fill();
      }
    });
  };

  // Pose detection loop
  useEffect(() => {
    let animationId: number;
    let lastTime = 0;
    let frameCount = 0;

    const detectPose = async () => {
      if (!poseNet || !videoRef.current || !canvasRef.current || !isDetecting) {
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      if (!ctx || video.readyState !== 4) {
        animationId = requestAnimationFrame(detectPose);
        return;
      }

      // Set canvas size to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      try {
        // Detect poses
        const detectedPoses = await poseNet.predict(video);
        setPoses(detectedPoses);

        // Draw skeletons for all detected poses
        detectedPoses.forEach((pose: Pose) => {
          drawSkeleton(ctx, pose, video.videoWidth, video.videoHeight);
        });

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

      animationId = requestAnimationFrame(detectPose);
    };

    if (isDetecting && isModelLoaded) {
      detectPose();
    }

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [poseNet, isDetecting, isModelLoaded]);

  return (
    <div className="component-container">
      <h2>Live Pose Detection</h2>
      
      <div className="status-display">
        <h3>Status</h3>
        <p>Model: {isModelLoaded ? 'Loaded' : 'Loading...'}</p>
        <p>Detection: {isDetecting ? 'Active' : 'Inactive'}</p>
        <p>FPS: {fps}</p>
        <p>People Detected: {poses.length}</p>
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

      {poses.length > 0 && (
        <div className="status-display">
          <h3>Detected Poses</h3>
          {poses.map((pose, index) => (
            <div key={index}>
              <p>Person {index + 1}: Confidence {Math.round(pose.score * 100)}%</p>
              <p>Keypoints: {pose.keypoints.filter(kp => kp.score > 0.3).length}/{pose.keypoints.length}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LiveDetection; 