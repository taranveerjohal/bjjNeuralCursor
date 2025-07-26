import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';
import { prisma } from '../index.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure multer for video uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../../uploads/videos'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['video/mp4', 'video/webm', 'video/avi', 'video/mov'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only MP4, WebM, AVI, and MOV files are allowed.'));
    }
  },
});

// Middleware to extract user from JWT token
const authenticateUser = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // For now, we'll use a simple user ID from headers
    // In production, you'd verify the JWT token
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

// Upload video
router.post('/upload', authenticateUser, upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video file provided' });
    }

    const user = (req as any).user;
    const { duration, width, height } = req.body;

    const video = await prisma.video.create({
      data: {
        filename: req.file.filename,
        originalName: req.file.originalname,
        filePath: req.file.path,
        fileSize: req.file.size,
        duration: duration ? parseFloat(duration) : null,
        width: width ? parseInt(width) : null,
        height: height ? parseInt(height) : null,
        userId: user.id,
      },
    });

    res.status(201).json({
      message: 'Video uploaded successfully',
      video: {
        id: video.id,
        filename: video.filename,
        originalName: video.originalName,
        fileSize: video.fileSize,
        duration: video.duration,
        width: video.width,
        height: video.height,
        uploadedAt: video.uploadedAt,
      },
    });
  } catch (error) {
    console.error('Video upload error:', error);
    res.status(500).json({ error: 'Failed to upload video' });
  }
});

// Get user's videos
router.get('/', authenticateUser, async (req, res) => {
  try {
    const user = (req as any).user;
    const videos = await prisma.video.findMany({
      where: { userId: user.id },
      orderBy: { uploadedAt: 'desc' },
      select: {
        id: true,
        filename: true,
        originalName: true,
        fileSize: true,
        duration: true,
        width: true,
        height: true,
        uploadedAt: true,
        _count: {
          select: {
            poseData: true,
            analyses: true,
          },
        },
      },
    });

    res.json({ videos });
  } catch (error) {
    console.error('Get videos error:', error);
    res.status(500).json({ error: 'Failed to fetch videos' });
  }
});

// Get specific video
router.get('/:id', authenticateUser, async (req, res) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;

    const video = await prisma.video.findFirst({
      where: { id, userId: user.id },
      include: {
        poseData: {
          orderBy: { frameIndex: 'asc' },
          take: 100, // Limit to first 100 frames for preview
        },
        analyses: {
          orderBy: { createdAt: 'desc' },
          take: 5, // Latest 5 analyses
        },
      },
    });

    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    res.json({ video });
  } catch (error) {
    console.error('Get video error:', error);
    res.status(500).json({ error: 'Failed to fetch video' });
  }
});

// Save pose data for a video
router.post('/:id/pose-data', authenticateUser, async (req, res) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    const { poseData } = req.body;

    const poseDataSchema = z.array(z.object({
      frameIndex: z.number(),
      keypoints: z.array(z.object({
        x: z.number(),
        y: z.number(),
        confidence: z.number(),
      })),
      timestamp: z.number(),
    }));

    const validatedPoseData = poseDataSchema.parse(poseData);

    // Verify video belongs to user
    const video = await prisma.video.findFirst({
      where: { id, userId: user.id },
    });

    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    // Save pose data
    const savedPoseData = await prisma.poseData.createMany({
      data: validatedPoseData.map(data => ({
        videoId: id,
        frameIndex: data.frameIndex,
        keypoints: JSON.stringify(data.keypoints),
        timestamp: data.timestamp,
      })),
    });

    res.json({
      message: 'Pose data saved successfully',
      count: savedPoseData.count,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid pose data format', details: error.errors });
    }
    console.error('Save pose data error:', error);
    res.status(500).json({ error: 'Failed to save pose data' });
  }
});

// Delete video
router.delete('/:id', authenticateUser, async (req, res) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;

    const video = await prisma.video.findFirst({
      where: { id, userId: user.id },
    });

    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    await prisma.video.delete({
      where: { id },
    });

    res.json({ message: 'Video deleted successfully' });
  } catch (error) {
    console.error('Delete video error:', error);
    res.status(500).json({ error: 'Failed to delete video' });
  }
});

export default router; 