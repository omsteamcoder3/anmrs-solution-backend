import express from 'express';
import About from '../models/aboutModel.js';

const router = express.Router();

// Public about route - NO AUTH NEEDED
router.get('/about', async (req, res) => {
  try {
    let aboutContent = await About.findOne({ isActive: true });
    
    if (!aboutContent) {
      aboutContent = await About.create({});
    }
    
    res.status(200).json({
      success: true,
      data: aboutContent
    });
  } catch (error) {
    console.error('Error fetching about content:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching about content',
      error: error.message
    });
  }
});

export default router;