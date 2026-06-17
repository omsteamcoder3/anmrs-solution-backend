import express from 'express';
import {
  submitDesignOrder,
  getUserDesignOrders,
  getDesignOrderById,
  updateOrderStatus,
  getAllDesignOrders,
  startOrderProcessing,
  markOrderOutForDelivery,
  markOrderReadyForPickup,
  markPaymentAsPaid,
  markOrderAsPaidCOD,checkRazorpayPayment,
  sendPaymentReminderEmail,verifyRazorpayPayment,getPaymentStatus,createRazorpayPaymentLink,updateOrderPrices
} from '../controller/designOrderController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// ==================== PUBLIC ROUTES ====================
router.post('/submit', submitDesignOrder);

// ==================== USER ROUTES ====================
router.get('/user/:userId',  getUserDesignOrders);

// ==================== ADMIN ROUTES ====================
router.get('/all', protect, authorize('admin'), getAllDesignOrders);
router.get('/:orderId', getDesignOrderById);
router.put('/:orderId/status', updateOrderStatus);

// Email Routes
router.post('/start-processing', protect, authorize('admin'), startOrderProcessing);
router.post('/ready-for-pickup', protect, authorize('admin'), markOrderReadyForPickup);
router.post('/out-for-delivery', protect, authorize('admin'), markOrderOutForDelivery);

// ✅ PAYMENT ROUTES
router.post('/mark-payment-paid', protect, authorize('admin'), markPaymentAsPaid);
router.post('/mark-cod-paid', protect, authorize('admin'), markOrderAsPaidCOD);
router.post('/send-payment-reminder', protect, authorize('admin'), sendPaymentReminderEmail);

// Payment Routes
router.post('/create-payment-link', protect, authorize('admin'), createRazorpayPaymentLink);
router.post('/verify-payment', verifyRazorpayPayment);
router.get('/payment-status/:orderId', protect, getPaymentStatus);
router.put('/update-prices', protect, authorize('admin'), updateOrderPrices);

router.get('/check-razorpay-payment/:orderId', protect, authorize('admin'), checkRazorpayPayment);


export default router;