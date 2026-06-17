// routes/razorpayWebhook.js
import express from 'express';
import crypto from 'crypto';
import DesignOrder from '../models/DesignOrder.js';

const router = express.Router();

// Razorpay webhook endpoint
router.post('/razorpay-webhook', async (req, res) => {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers['x-razorpay-signature'];
    
    // Verify webhook signature
    const body = JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');
    
    if (signature !== expectedSignature) {
      return res.status(400).json({ error: 'Invalid signature' });
    }
    
    const event = req.body.event;
    
    // Handle payment captured event
    if (event === 'payment.captured') {
      const paymentId = req.body.payload.payment.entity.id;
      const orderId = req.body.payload.payment.entity.notes?.orderId;
      
      if (orderId) {
        // Update order payment status
        const order = await DesignOrder.findById(orderId);
        if (order) {
          order.paymentStatus = 'paid';
          order.razorpayPaymentId = paymentId;
          await order.save();
          
          console.log(`✅ Payment confirmed for order ${order.orderNumber}`);
        }
      }
    }
    
    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;