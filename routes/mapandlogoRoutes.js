// routes/mapandlogoRoutes.js
import express from 'express';
import upload, { extremeOptimization } from '../middleware/uploadMiddleware.js';
import {
  getMapAndLogoSettings,
  updateMapAndLogoSettings,
  uploadLogo,
  deleteLogo,
  getPublicMapAndLogoSettings
} from '../controller/mapandlogoController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// ✅ PUBLIC ROUTES - NO AUTH (these work without token)
router.get('/', getPublicMapAndLogoSettings);  // This will be accessible at /api/public/map-logo
router.get('/public', getPublicMapAndLogoSettings);

// ✅ ADMIN ROUTES - WITH AUTH
router.get('/admin', protect, authorize('admin'), getMapAndLogoSettings);
router.put('/admin', protect, authorize('admin'), updateMapAndLogoSettings);
router.post('/upload/logo', protect, authorize('admin'), upload.array('images', 1), extremeOptimization, uploadLogo);
router.delete('/logo', protect, authorize('admin'), deleteLogo);

export default router;