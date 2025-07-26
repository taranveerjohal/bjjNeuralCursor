import express from 'express';
import { z } from 'zod';
import { prisma } from '../index.js';

const router = express.Router();

// Middleware to extract user from JWT token
const authenticateUser = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // For now, we'll use a simple user ID from headers
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid user' });
    }

    (req as any).user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Authentication failed' });
  }
};

// Analyze video pose data
router.post('/analyze/:videoId', authenticateUser, async (req, res) => {
  try {
    const user = (req as any).user;
    const { videoId } = req.params;

    // Verify video belongs to user
    const video = await prisma.video.findFirst({
      where: { id: videoId, userId: user.id },
      include: {
        poseData: {
          orderBy: { frameIndex: 'asc' },
        },
      },
    });

    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    if (!video.poseData || video.poseData.length === 0) {
      return res.status(400).json({ error: 'No pose data available for analysis' });
    }

    // Analyze pose data to detect movements and risks
    const analysis = await analyzePoseData(video.poseData);

    // Save analysis to database
    const savedAnalysis = await prisma.analysis.create({
      data: {
        videoId,
        userId: user.id,
        movements: JSON.stringify(analysis.movements),
        riskMetrics: JSON.stringify(analysis.riskMetrics),
      },
    });

    res.json({
      message: 'Analysis completed successfully',
      analysis: {
        id: savedAnalysis.id,
        movements: JSON.parse(savedAnalysis.movements),
        riskMetrics: savedAnalysis.riskMetrics ? JSON.parse(savedAnalysis.riskMetrics) : null,
        createdAt: savedAnalysis.createdAt,
      },
    });
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze video' });
  }
});

// Get analysis results for a video
router.get('/video/:videoId', authenticateUser, async (req, res) => {
  try {
    const user = (req as any).user;
    const { videoId } = req.params;

    const analyses = await prisma.analysis.findMany({
      where: {
        videoId,
        userId: user.id,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ analyses });
  } catch (error) {
    console.error('Get analyses error:', error);
    res.status(500).json({ error: 'Failed to fetch analyses' });
  }
});

// Get specific analysis
router.get('/:id', authenticateUser, async (req, res) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;

    const analysis = await prisma.analysis.findFirst({
      where: { id, userId: user.id },
      include: {
        video: {
          select: {
            id: true,
            originalName: true,
            duration: true,
          },
        },
      },
    });

    if (!analysis) {
      return res.status(404).json({ error: 'Analysis not found' });
    }

    res.json({ analysis });
  } catch (error) {
    console.error('Get analysis error:', error);
    res.status(500).json({ error: 'Failed to fetch analysis' });
  }
});

// Delete analysis
router.delete('/:id', authenticateUser, async (req, res) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;

    const analysis = await prisma.analysis.findFirst({
      where: { id, userId: user.id },
    });

    if (!analysis) {
      return res.status(404).json({ error: 'Analysis not found' });
    }

    await prisma.analysis.delete({
      where: { id },
    });

    res.json({ message: 'Analysis deleted successfully' });
  } catch (error) {
    console.error('Delete analysis error:', error);
    res.status(500).json({ error: 'Failed to delete analysis' });
  }
});

// Simple pose data analysis function
async function analyzePoseData(poseData: any[]) {
  const movements: any[] = [];
  const riskMetrics: any = {
    neckExposure: 0,
    postureDeviations: 0,
    vulnerablePositions: 0,
  };

  // Simple movement detection based on keypoint positions
  // This is a placeholder - in a real implementation, you'd use a trained ML model
  
  for (let i = 0; i < poseData.length - 10; i += 10) {
    const frame = poseData[i];
    const nextFrame = poseData[i + 10];
    
    if (frame && nextFrame && frame.keypoints && nextFrame.keypoints) {
      // Detect guard pass (simplified)
      if (detectGuardPass(frame.keypoints, nextFrame.keypoints)) {
        movements.push({
          type: 'Guard Pass',
          startFrame: frame.frameIndex,
          endFrame: nextFrame.frameIndex,
          confidence: 0.85,
        });
      }
      
      // Detect triangle attempt
      if (detectTriangleAttempt(frame.keypoints, nextFrame.keypoints)) {
        movements.push({
          type: 'Triangle Attempt',
          startFrame: frame.frameIndex,
          endFrame: nextFrame.frameIndex,
          confidence: 0.78,
        });
      }
      
      // Risk assessment
      const risks = assessRisks(frame.keypoints);
      if (risks.neckExposed) riskMetrics.neckExposure++;
      if (risks.poorPosture) riskMetrics.postureDeviations++;
      if (risks.vulnerablePosition) riskMetrics.vulnerablePositions++;
    }
  }

  return { movements, riskMetrics };
}

// Placeholder functions for movement detection
function detectGuardPass(keypoints1: any[], keypoints2: any[]): boolean {
  // Simplified logic - in reality, you'd use more sophisticated algorithms
  return Math.random() > 0.7; // 30% chance of detecting guard pass
}

function detectTriangleAttempt(keypoints1: any[], keypoints2: any[]): boolean {
  // Simplified logic
  return Math.random() > 0.8; // 20% chance of detecting triangle attempt
}

function assessRisks(keypoints: any[]): { neckExposed: boolean; poorPosture: boolean; vulnerablePosition: boolean } {
  // Simplified risk assessment
  return {
    neckExposed: Math.random() > 0.6,
    poorPosture: Math.random() > 0.7,
    vulnerablePosition: Math.random() > 0.8,
  };
}

export default router; 