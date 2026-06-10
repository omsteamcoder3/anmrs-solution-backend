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

// ✅ PUBLIC ROUTES - NO AUTH (for /api/public/map-logo)
router.get('/', getPublicMapAndLogoSettings);
router.get('/public', getPublicMapAndLogoSettings);

// ✅ ADMIN ROUTES - WITH AUTH (for /api/admin/map-logo)
router.get('/', protect, authorize('admin'), getMapAndLogoSettings);
router.put('/', protect, authorize('admin'), updateMapAndLogoSettings);
router.post('/upload/logo', protect, authorize('admin'), upload.array('images', 1), extremeOptimization, uploadLogo);
router.delete('/logo', protect, authorize('admin'), deleteLogo);

export default router;