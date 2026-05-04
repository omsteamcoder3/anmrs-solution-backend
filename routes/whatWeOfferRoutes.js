import express from 'express';
import upload, { extremeOptimization } from '../middleware/uploadMiddleware.js';
import {
  getWhatWeOfferContent,
  updateWhatWeOfferContent,
  uploadServiceImage,
  deleteServiceImage
} from '../controller/whatWeOfferController.js';

const router = express.Router();

// Public route (no auth)
router.get('/', getWhatWeOfferContent);

// Protected routes (require auth)
router.put('/', updateWhatWeOfferContent);
router.post('/upload-image', 
  upload.array('images', 1), 
  extremeOptimization, 
  uploadServiceImage
);
router.delete('/image', deleteServiceImage);

export default router;