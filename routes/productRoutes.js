// productRoutes.js - FIXED VERSION with imported multer config
import express from 'express';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// Import controllers
import { 
  getAllProducts, 
  getProductById, 
  getProductBySlug,
  createProduct,
  updateProduct,
  deleteProduct,
  getFeaturedProducts,
  getFeaturedPriceRanges,
  getFilteredFeaturedProducts,
  searchProducts,
  quickSearchProducts, 
  uploadVariantImages ,
  getOfferProducts
} from '../controller/productController.js';

// Import upload and optimization from middleware
import upload, { extremeOptimization } from '../middleware/uploadMiddleware.js';

// ✅ Routes - Specific first, parameter routes last
router.get('/', getAllProducts);
router.get('/featured', getFeaturedProducts);
router.get('/featured/price-ranges', getFeaturedPriceRanges);
router.get('/featured/filter', getFilteredFeaturedProducts);
router.get('/search', searchProducts);
router.get('/quick-search', quickSearchProducts);
router.get('/offers', getOfferProducts);

// ✅ Create product with image upload
router.post('/', 
  upload.any(),
  // extremeOptimization,
  createProduct
);

// ✅ Update product with image upload
router.put('/:id', 
  upload.any(),
  // extremeOptimization,
  updateProduct
);

// ✅ Upload variant images
router.post('/:productId/variants/:variantIndex/images', 
  upload.array('images', 20),
  extremeOptimization,
  uploadVariantImages
);

// ✅ Parameter routes - LAST
router.get('/:id', getProductById);
router.get('/slug/:slug', getProductBySlug);
router.delete('/:id', deleteProduct);

export default router;