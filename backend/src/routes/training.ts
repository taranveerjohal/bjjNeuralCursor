import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';
import { prisma } from '../index.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure multer for training data uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../../uploads/training'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 200 * 1024 * 1024, // 200MB limit for training data
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

// Upload training data
router.post('/upload', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video file provided' });
    }

    const { technique, difficulty, labels } = req.body;

    const trainingDataSchema = z.object({
      technique: z.string(),
      difficulty: z.string().optional(),
      labels: z.array(z.object({
        frameIndex: z.number(),
        keypoints: z.array(z.object({
          x: z.number(),
          y: z.number(),
          confidence: z.number(),
        })),
        technique: z.string(),
        startFrame: z.number(),
        endFrame: z.number(),
      })),
    });

    const validatedData = trainingDataSchema.parse({
      technique,
      difficulty,
      labels: JSON.parse(labels || '[]'),
    });

    const trainingData = await prisma.trainingData.create({
      data: {
        filename: req.file.filename,
        filePath: req.file.path,
        labels: JSON.stringify(validatedData.labels),
        technique: validatedData.technique,
        difficulty: validatedData.difficulty,
      },
    });

    res.status(201).json({
      message: 'Training data uploaded successfully',
      trainingData: {
        id: trainingData.id,
        filename: trainingData.filename,
        technique: trainingData.technique,
        difficulty: trainingData.difficulty,
        createdAt: trainingData.createdAt,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid training data format', details: error.errors });
    }
    console.error('Training data upload error:', error);
    res.status(500).json({ error: 'Failed to upload training data' });
  }
});

// Get all training data
router.get('/', async (req, res) => {
  try {
    const trainingData = await prisma.trainingData.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        filename: true,
        technique: true,
        difficulty: true,
        createdAt: true,
        _count: {
          select: {
            // This would be the count of labeled frames
          },
        },
      },
    });

    res.json({ trainingData });
  } catch (error) {
    console.error('Get training data error:', error);
    res.status(500).json({ error: 'Failed to fetch training data' });
  }
});

// Get training data by technique
router.get('/technique/:technique', async (req, res) => {
  try {
    const { technique } = req.params;

    const trainingData = await prisma.trainingData.findMany({
      where: { technique },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ trainingData });
  } catch (error) {
    console.error('Get training data by technique error:', error);
    res.status(500).json({ error: 'Failed to fetch training data' });
  }
});

// Get specific training data
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const trainingData = await prisma.trainingData.findUnique({
      where: { id },
    });

    if (!trainingData) {
      return res.status(404).json({ error: 'Training data not found' });
    }

    res.json({ trainingData });
  } catch (error) {
    console.error('Get training data error:', error);
    res.status(500).json({ error: 'Failed to fetch training data' });
  }
});

// Delete training data
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const trainingData = await prisma.trainingData.findUnique({
      where: { id },
    });

    if (!trainingData) {
      return res.status(404).json({ error: 'Training data not found' });
    }

    await prisma.trainingData.delete({
      where: { id },
    });

    res.json({ message: 'Training data deleted successfully' });
  } catch (error) {
    console.error('Delete training data error:', error);
    res.status(500).json({ error: 'Failed to delete training data' });
  }
});

// Get training statistics
router.get('/stats/overview', async (req, res) => {
  try {
    const stats = await prisma.trainingData.groupBy({
      by: ['technique'],
      _count: {
        technique: true,
      },
    });

    const totalCount = await prisma.trainingData.count();

    res.json({
      totalVideos: totalCount,
      techniques: stats.map(stat => ({
        technique: stat.technique,
        count: stat._count.technique,
      })),
    });
  } catch (error) {
    console.error('Get training stats error:', error);
    res.status(500).json({ error: 'Failed to fetch training statistics' });
  }
});

export default router; 