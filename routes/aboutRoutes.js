import express from 'express';
import upload, { extremeOptimization } from '../middleware/uploadMiddleware.js';
import {
  getAboutContent,
  updateAboutContent,
  patchAboutContent,
  uploadMainImage,
  uploadFloatingImage,
  resetToDefault,
  getAboutVersion
} from '../controller/aboutController.js';

const router = express.Router();

// Public routes (no auth required)
router.get('/', getAboutContent);
router.get('/version', getAboutVersion);

// Protected routes (add your auth middleware here if needed)
// Example: router.use(yourAuthMiddleware);

// Full update of about content
router.put('/', updateAboutContent);

// Partial update (patch)
router.patch('/', patchAboutContent);

// Image uploads with optimization
router.post('/upload/main-image', 
  upload.array('images', 1), 
  extremeOptimization, 
  uploadMainImage
);

router.post('/upload/floating-image', 
  upload.array('images', 1), 
  extremeOptimization, 
  uploadFloatingImage
);

// Reset to default (be careful with this in production)
router.delete('/reset', resetToDefault);

export default router;