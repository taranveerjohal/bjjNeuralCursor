export interface PoseKeypoint {
  x: number;
  y: number;
  score: number;
  name: string;
}

export interface Pose {
  keypoints: PoseKeypoint[];
  score: number;
}

export interface TrainingData {
  id: string;
  label: string;
  poseData: PoseKeypoint[];
  timestamp: number;
}

export interface PredictionResult {
  label: string;
  confidence: number;
}

export interface PoseDetectionState {
  isDetecting: boolean;
  poses: Pose[];
  confidence: number;
}

export interface TrainingState {
  isRecording: boolean;
  countdown: number;
  recordedData: TrainingData[];
  currentLabel: string;
}

export interface ModelState {
  isTrained: boolean;
  isTraining: boolean;
  accuracy: number;
  predictions: PredictionResult[];
} 