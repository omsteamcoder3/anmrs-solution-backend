import express from 'express';
import {
  submitDesignOrder,
  getUserDesignOrders,
  getDesignOrderById,
  updateOrderStatus
} from '../controller/designOrderController.js';

const router = express.Router();

router.post('/submit', submitDesignOrder);
router.get('/user/:userId', getUserDesignOrders);
router.get('/:orderId', getDesignOrderById);
router.put('/:orderId/status', updateOrderStatus);

export default router;