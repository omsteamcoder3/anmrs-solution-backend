import express from 'express';
import {
  createOrder,
  getOrders,
  getUserOrders,
  getOrderById,
  updateOrderStatus,
  getOrderSummary,
  printOrderReceipt,
  printOrderReceiptPDF,
  cancelOrder,
  deleteOrder
} from '../controller/orderController.js';
import { protect, admin } from '../middleware/authMiddleware.js';
import { refundPayment } from '../controller/paymentController.js'; 

const router = express.Router();

router.route('/')
  .post(protect, createOrder)
  .get(protect, admin, getOrders);

router.get('/my-orders', protect, getUserOrders);
router.get('/summary', protect, admin, getOrderSummary);
router.get('/:id', protect, getOrderById);
router.put('/:id/status', protect, admin, updateOrderStatus);
router.delete('/:id', protect, admin, deleteOrder);

// Cancel order endpoint
router.put('/:id/cancel', protect, cancelOrder);

// Receipt endpoints
router.get('/:id/receipt', protect, printOrderReceipt);           // JSON or PDF based on request
router.get('/:id/receipt/pdf', protect, printOrderReceiptPDF);    // Force PDF download



export default router;