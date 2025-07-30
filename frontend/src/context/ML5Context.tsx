import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import p5 from 'p5';

// Declare ml5 as a global variable since we're loading it from CDN
declare global {
  interface Window {
    ml5: any;
  }
}

interface P5InstanceManager {
  createInstance: (containerElement: HTMLElement, sketch: (p: p5) => void) => p5;
  removeInstance: (instance: p5) => void;
  instances: Set<p5>;
}

interface ML5ContextType {
  isReady: boolean;
  loadingStatus: string;
  ml5Instance: any;
  p5Manager: P5InstanceManager;
  initializePoseDetection: (videoElement: HTMLVideoElement) => Promise<any>;
  stopPoseDetection: () => void;
  createNeuralNetwork: (options?: any) => any;
  createAdvancedNeuralNetwork: (options?: any) => any;
  bodyPoseOptions: any;
  enhancedPoseOptions: any;
  classifyPose: (poses: any[], network: any) => Promise<any>;
  extractPoseFeatures: (poses: any[]) => number[];
  normalizeKeypoints: (keypoints: any[], canvasWidth: number, canvasHeight: number) => number[];
  sharedTrainedModel: any;
  setSharedTrainedModel: (model: any) => void;
}

const ML5Context = createContext<ML5ContextType | null>(null);

export const ML5Provider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isReady, setIsReady] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('Initializing...');
  const [sharedTrainedModel, setSharedTrainedModel] = useState<any>(null);
  const ml5InstanceRef = useRef<any>(null);
  const activeDetectorsRef = useRef<Set<any>>(new Set());
  
  // P5 instance management
  const p5ManagerRef = useRef<P5InstanceManager>({
    instances: new Set(),
    createInstance: (containerElement: HTMLElement, sketch: (p: p5) => void): p5 => {
      // Simple and safe cleanup - only remove our own instances
      p5ManagerRef.current.instances.forEach(instance => {
        try {
          instance.remove();
          console.log('Removed existing p5 instance');
        } catch (error) {
          console.error('Error removing p5 instance:', error);
        }
      });
      p5ManagerRef.current.instances.clear();
      
      // Only clean canvases in this specific container
      const existingCanvases = containerElement.querySelectorAll('canvas');
      existingCanvases.forEach(canvas => {
        try {
          if (canvas.parentNode === containerElement) {
            containerElement.removeChild(canvas);
          }
        } catch (error) {
          // Canvas might already be removed, ignore
        }
      });
      
      // Create new instance
      const instance = new p5(sketch, containerElement);
      p5ManagerRef.current.instances.add(instance);
      console.log('Created p5 instance, total instances:', p5ManagerRef.current.instances.size);
      return instance;
    },
    removeInstance: (instance: p5) => {
      if (instance) {
        try {
          instance.remove();
          p5ManagerRef.current.instances.delete(instance);
          console.log('Removed p5 instance, remaining instances:', p5ManagerRef.current.instances.size);
        } catch (error) {
          console.error('Error removing p5 instance:', error);
        }
      }
    }
  });


  // Initialize everything in sequence
  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      try {
        // Step 1: Wait for ML5
        setLoadingStatus('Loading ML5.js...');
        while (!window.ml5) {
          await new Promise(resolve => setTimeout(resolve, 100));
          if (!isMounted) return;
        }
        
        ml5InstanceRef.current = window.ml5;
        if (!isMounted) return;

        // Everything is ready
        setLoadingStatus('Ready');
        setIsReady(true);
      } catch (error) {
        console.error('Error during initialization:', error);
        setLoadingStatus('Error during initialization');
      }
    };

    initialize();

    return () => {
      isMounted = false;
      
      // Stop all active detectors first
      activeDetectorsRef.current.forEach(detector => {
        try {
          detector.detectStop();
        } catch (error) {
          console.error('Error stopping detector:', error);
        }
      });
      activeDetectorsRef.current.clear();
      
      // Cleanup all p5 instances
      p5ManagerRef.current.instances.forEach(instance => {
        try {
          instance.remove();
        } catch (error) {
          console.error('Error removing p5 instance in cleanup:', error);
        }
      });
      p5ManagerRef.current.instances.clear();
    };
  }, []);

  // Simplified bodyPose options to avoid CORS issues
  const bodyPoseOptions = {
    flipHorizontal: false
  };

  // Basic options for stable detection
  const enhancedPoseOptions = {
    flipHorizontal: false,
    maxDetections: 2,
    scoreThreshold: 0.5,
    nmsThreshold: 0.3
  };

  const initializePoseDetection = async (videoElement: HTMLVideoElement): Promise<any> => {
    return new Promise((resolve, reject) => {
      try {
        if (!ml5InstanceRef.current) {
          reject(new Error('ML5 not initialized'));
          return;
        }
        
        console.log('Creating BodyPose detector with basic options...');
        
        // Use simplified initialization with just video element and callback
        const detector = ml5InstanceRef.current.bodyPose(videoElement, bodyPoseOptions, () => {
          console.log('BodyPose model loaded successfully');
          
          // Add a small delay to ensure model is fully ready
          setTimeout(() => {
            activeDetectorsRef.current.add(detector);
            resolve(detector);
          }, 500);
        });
        
        // Add error handling for detector creation
        if (!detector) {
          reject(new Error('Failed to create bodyPose detector'));
          return;
        }
        
      } catch (error) {
        console.error('Error initializing pose detection:', error);
        reject(error);
      }
    });
  };

  // Standard ml5.js neural network for pose classification (2024 best practices)
  const createNeuralNetwork = (options = {}) => {
    if (!ml5InstanceRef.current) {
      throw new Error('ML5 not initialized');
    }
    
    // Based on latest ml5.js examples - simple coordinate-based input
    const defaultOptions = {
      inputs: 34, // 17 keypoints * 2 (x, y coordinates only)
      outputs: 1,
      task: 'classification',
      debug: true
    };
    
    return ml5InstanceRef.current.neuralNetwork({ ...defaultOptions, ...options });
  };

  // Modern ml5.js neural network following 2024 patterns from official examples
  const createAdvancedNeuralNetwork = (options = {}) => {
    if (!ml5InstanceRef.current) {
      throw new Error('ML5 not initialized');
    }
    
    // Following latest ml5.js pose classification patterns
    const defaultOptions = {
      inputs: 34, // 17 keypoints * 2 coordinates (simplified following ml5.js examples)
      outputs: 1, // Single output for classification
      task: 'classification',
      debug: true
    };
    
    return ml5InstanceRef.current.neuralNetwork({ ...defaultOptions, ...options });
  };

  // Enhanced keypoint normalization with feature engineering
  const normalizeKeypoints = (keypoints: any[], canvasWidth: number, canvasHeight: number): number[] => {
    if (!keypoints || keypoints.length === 0) return [];
    
    // Normalize x,y coordinates and include confidence scores
    const normalized = keypoints.flatMap(kp => [
      kp.x / canvasWidth,
      kp.y / canvasHeight,
      kp.confidence || 0
    ]);
    
    return normalized;
  };

  // Simple ml5.js pose feature extraction (2024 best practices)
  const extractPoseFeatures = (poses: any[]): number[] => {
    if (!poses || poses.length === 0) return Array(34).fill(0);
    
    const pose = poses[0]; // Use first pose
    if (!pose?.keypoints) return Array(34).fill(0);
    
    // Following ml5.js examples: simple coordinate pairs only
    const inputs: number[] = [];
    
    // Extract x, y coordinates for all 17 keypoints (34 total values)
    for (let i = 0; i < pose.keypoints.length; i++) {
      const keypoint = pose.keypoints[i];
      if (keypoint) {
        inputs.push(keypoint.x || 0);
        inputs.push(keypoint.y || 0);
      } else {
        inputs.push(0);
        inputs.push(0);
      }
    }
    
    // Ensure exactly 34 inputs (17 keypoints * 2 coordinates)
    while (inputs.length < 34) {
      inputs.push(0);
    }
    
    return inputs.slice(0, 34);
  };

  // Proper ml5.js classification following 2024 patterns
  const classifyPose = async (poses: any[], network: any): Promise<any> => {
    return new Promise((resolve) => {
      try {
        // Validation checks
        if (!network) {
          resolve({ label: 'no_model', confidence: 0 });
          return;
        }
        
        if (!poses || poses.length === 0) {
          resolve({ label: 'no_pose', confidence: 0 });
          return;
        }
        
        // Extract features using simplified approach
        const inputs = extractPoseFeatures(poses);
        
        if (!inputs || inputs.length !== 34) {
          resolve({ label: 'invalid_features', confidence: 0 });
          return;
        }
        
        // Use ml5.js classify method - results come as first parameter
        network.classify(inputs, (results: any) => {
          if (!results) {
            console.error('🚫 Classification error: No results returned');
            resolve({ label: 'classification_error', confidence: 0 });
            return;
          }
          
          if (Array.isArray(results) && results.length > 0) {
            const bestResult = results[0];
            console.log('✅ Classification result:', bestResult.label, (bestResult.confidence * 100).toFixed(1) + '%');
            resolve({
              label: bestResult.label || 'unknown',
              confidence: bestResult.confidence || 0
            });
          } else {
            console.log('❌ No valid classification results');
            resolve({ label: 'no_results', confidence: 0 });
          }
        });
        
      } catch (error) {
        console.error('Classification exception:', error);
        resolve({ label: 'exception', confidence: 0 });
      }
    });
  };

  const stopPoseDetection = () => {
    try {
      // Stop all active detectors
      activeDetectorsRef.current.forEach(detector => {
        try {
          if (detector && typeof detector.detectStop === 'function') {
            detector.detectStop();
          }
        } catch (error) {
          console.error('Error stopping detector:', error);
        }
      });
      activeDetectorsRef.current.clear();
      console.log('All pose detectors stopped');
    } catch (error) {
      console.error('Error stopping pose detection:', error);
    }
  };

  const value = {
    isReady,
    loadingStatus,
    ml5Instance: ml5InstanceRef.current,
    p5Manager: p5ManagerRef.current,
    initializePoseDetection,
    stopPoseDetection,
    createNeuralNetwork,
    createAdvancedNeuralNetwork,
    bodyPoseOptions,
    enhancedPoseOptions,
    classifyPose,
    extractPoseFeatures,
    normalizeKeypoints,
    sharedTrainedModel,
    setSharedTrainedModel
  };

  return (
    <ML5Context.Provider value={value}>
      {!isReady ? (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white p-6 rounded-lg shadow-lg text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
            <div className="text-lg font-semibold">{loadingStatus}</div>
          </div>
        </div>
      ) : children}
    </ML5Context.Provider>
  );
};

export const useML5 = () => {
  const context = useContext(ML5Context);
  if (!context) {
    throw new Error('useML5 must be used within an ML5Provider');
  }
  return context;
}; 