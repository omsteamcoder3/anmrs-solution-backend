// routes/categoryRoutes.js
import express from 'express';
import {
    createCategory,
    getAllCategories,
    getCategoryBySlug,
    updateCategory,
    deleteCategory,
    getCategoryProducts,
    getCategoriesWithFields,
    getCategoryFields
} from '../controller/categoryController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public routes
router.get('/', getAllCategories);
router.get('/with-fields', getCategoriesWithFields);
router.get('/:slug', getCategoryBySlug);
router.get('/:slug/products', getCategoryProducts);
router.get('/:slug/fields', getCategoryFields);

// Admin only routes
router.post('/', protect, admin, createCategory);
router.put('/:slug', protect, admin, updateCategory);
router.delete('/:slug', protect, admin, deleteCategory);

export default router;