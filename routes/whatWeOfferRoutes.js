// In whatWeOfferRoutes.js
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
router.get('/public', getWhatWeOfferContent);

// Protected routes (require auth)
router.put('/', updateWhatWeOfferContent);
router.put('/update', updateWhatWeOfferContent);

// Image upload - make sure this endpoint is correct
router.post('/upload-image', 
  upload.array('images', 1), 
  extremeOptimization, 
  uploadServiceImage
);

// Alternative endpoint without admin prefix
router.post('/upload', 
  upload.array('images', 1), 
  extremeOptimization, 
  uploadServiceImage
);

router.delete('/image', deleteServiceImage);

export default router;