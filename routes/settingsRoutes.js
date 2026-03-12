// routes/settingsRoutes.js
import express from 'express';
import {
  getSettings,
  updateSettings,
  getPublicSettings,
  handleFileUpload,
  deleteQrCode,       // ADD THIS
  uploadQrCode        // ADD THIS
} from '../controller/settingsController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public route for frontend
router.get('/public', getPublicSettings);

// QR code specific routes - ADD THESE
router.delete('/qr-code/:type', protect, authorize('admin'), deleteQrCode);
router.post('/qr-code/:type', protect, authorize('admin'), handleFileUpload, uploadQrCode);

// Admin routes
router.route('/')
  .get(protect, authorize('admin'), getSettings)
  .put(protect, authorize('admin'), handleFileUpload, updateSettings);

export default router;