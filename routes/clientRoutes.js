// routes/clientRoutes.js
import express from 'express';
import multer from 'multer';
import upload, { extremeOptimization } from '../middleware/uploadMiddleware.js';
import {
  getAllClients,
  getClientById,
  getClientBySlug,
  createClient,
  updateClient,
  deleteClient,
  deleteAllClients,
  getClientsCount
} from '../controller/clientController.js';

const router = express.Router();

// ✅ Use the existing upload from middleware (it already has diskStorage configured)
// Don't create a new multer instance with memoryStorage

// Routes
router.get('/', getAllClients);
router.get('/count', getClientsCount);
router.get('/slug/:slug', getClientBySlug);
router.get('/:id', getClientById);

// ✅ Use the upload from middleware (not a new multer instance)
router.post('/', upload.array('image', 1), extremeOptimization, createClient);
router.put('/:id', upload.array('image', 1), extremeOptimization, updateClient);
router.delete('/:id', deleteClient);
router.delete('/', deleteAllClients);

export default router;