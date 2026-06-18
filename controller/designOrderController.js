import DesignOrder from '../models/DesignOrder.js';
import User from '../models/UserModel.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import crypto from 'crypto';
import { 
  sendProcessingStartedEmail, 
  sendReadyForPickupEmail, 
  sendOutForDeliveryEmail,
  sendPaymentLinkEmail
} from '../services/designOrderEmailService.js';
import Razorpay from 'razorpay';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==================== UPLOAD CONFIGURATION ====================
const uploadDir = path.join(__dirname, '../uploads/designs/');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const memoryStorage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedExt = ['.pdf', '.jpg', '.jpeg', '.png', '.ai', '.cdr'];
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedExt.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, JPG, PNG, AI, CDR files are allowed.'), false);
  }
};

const upload = multer({
  storage: memoryStorage,
  fileFilter: fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }
}).fields([
  { name: 'designFile1', maxCount: 1 },
  { name: 'designFile2', maxCount: 1 }
]);

// ==================== FILE PROCESSING ====================
const processAndOptimizeFiles = async (req, res, next) => {
  try {
    if (!req.files || Object.keys(req.files).length === 0) return next();

    const allFiles = [];
    if (req.files.designFile1) allFiles.push(...req.files.designFile1);
    if (req.files.designFile2) allFiles.push(...req.files.designFile2);

    const processedFiles = [];

    for (const file of allFiles) {
      const ext = path.extname(file.originalname).toLowerCase();
      
      if (['.jpg', '.jpeg', '.png'].includes(ext)) {
        try {
          const timestamp = Date.now();
          const randomString = crypto.randomBytes(4).toString('hex');
          const optimizedFilename = `${timestamp}-${randomString}.webp`;
          const optimizedPath = path.join(uploadDir, optimizedFilename);

          const metadata = await sharp(file.buffer).metadata();
          let targetWidth = Math.min(800, metadata.width);
          let targetHeight = Math.round((targetWidth / metadata.width) * metadata.height);
          
          if (targetHeight > 600) {
            targetHeight = 600;
            targetWidth = Math.round((targetHeight / metadata.height) * metadata.width);
          }

          await sharp(file.buffer)
            .resize(targetWidth, targetHeight, { fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 85, effort: 4, nearLossless: false })
            .toFile(optimizedPath);

          const optimizedStats = fs.statSync(optimizedPath);
          
          processedFiles.push({
            filename: optimizedFilename,
            filePath: optimizedPath,
            fileSize: optimizedStats.size,
            mimeType: 'image/webp',
            fileType: 'WEBP'
          });
          
        } catch (error) {
          console.error(`❌ Failed to optimize ${file.originalname}:`, error);
          continue;
        }
      } 
      else if (ext === '.pdf') {
        try {
          const timestamp = Date.now();
          const randomString = crypto.randomBytes(4).toString('hex');
          const finalFilename = `${timestamp}-${randomString}.pdf`;
          const finalPath = path.join(uploadDir, finalFilename);
          
          fs.writeFileSync(finalPath, file.buffer);
          const fileStats = fs.statSync(finalPath);
          
          processedFiles.push({
            filename: finalFilename,
            filePath: finalPath,
            fileSize: fileStats.size,
            mimeType: 'application/pdf',
            fileType: 'PDF'
          });
          
        } catch (error) {
          console.error(`❌ Failed to save PDF ${file.originalname}:`, error);
          continue;
        }
      }
      else if (['.ai', '.cdr'].includes(ext)) {
        try {
          const timestamp = Date.now();
          const randomString = crypto.randomBytes(4).toString('hex');
          const finalFilename = `${timestamp}-${randomString}${ext}`;
          const finalPath = path.join(uploadDir, finalFilename);
          
          fs.writeFileSync(finalPath, file.buffer);
          const fileStats = fs.statSync(finalPath);
          let fileType = ext.substring(1).toUpperCase();
          
          processedFiles.push({
            filename: finalFilename,
            filePath: finalPath,
            fileSize: fileStats.size,
            mimeType: file.mimetype,
            fileType: fileType
          });
          
        } catch (error) {
          console.error(`❌ Failed to save ${file.originalname}:`, error);
          continue;
        }
      }
    }

    if (processedFiles.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid files could be processed. Please upload supported file types.'
      });
    }

    req.processedDesignFiles = processedFiles;
    next();
    
  } catch (err) {
    console.error('❌ File processing failed:', err);
    res.status(500).json({
      success: false,
      message: 'Error processing files',
      error: err.message
    });
  }
};
// ==================== GET RAZORPAY KEYS FROM DATABASE ====================
const getRazorpayKeys = async () => {
  try {
    const Setting = (await import('../models/Setting.js')).default;
    const settings = await Setting.findOne();
    
    if (!settings) {
      console.error('❌ Settings not found in database');
      return null;
    }
    
    if (!settings.razorpayKeyId || !settings.razorpayKeySecret) {
      console.error('❌ Razorpay keys not configured in database');
      return null;
    }
    
    return {
      key_id: settings.razorpayKeyId,
      key_secret: settings.razorpayKeySecret
    };
  } catch (error) {
    console.error('❌ Error fetching Razorpay keys:', error.message);
    return null;
  }
};

// ==================== GET RAZORPAY INSTANCE ====================
const getRazorpayInstance = async () => {
  const keys = await getRazorpayKeys();
  if (!keys) {
    throw new Error('Razorpay keys not configured');
  }
  return new Razorpay({
    key_id: keys.key_id,
    key_secret: keys.key_secret
  });
};

// ==================== ORDER SUBMISSION ====================
export const submitDesignOrder = async (req, res) => {
  try {
    upload(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ success: false, message: err.message });
      }

      await processAndOptimizeFiles(req, res, async () => {
        const processedFiles = req.processedDesignFiles || [];

        if (processedFiles.length === 0) {
          return res.status(400).json({ success: false, message: 'Please upload at least one valid design file' });
        }

        // ✅ ONLY ONE DECLARATION - Keep this one
        const { 
          quantity, size, customWidth, customHeight, material, 
          cardHolderName, designation, companyName, specialInstructions,
          userId, userName, userEmail, userPhone, deliveryMethod, paymentMethod
        } = req.body;

        const user = await User.findById(userId);
        if (!user) {
          processedFiles.forEach(file => {
            if (file.filePath && fs.existsSync(file.filePath)) {
              try { fs.unlinkSync(file.filePath); } catch(e) {}
            }
          });
          return res.status(401).json({ success: false, message: 'User not found. Please login again.', redirectToLogin: true });
        }

        const designFilesArray = processedFiles.map(file => ({
          fileName: file.filename,
          filePath: file.filePath,
          fileSize: file.fileSize,
          mimeType: file.mimeType,
          fileType: file.fileType
        }));

        let sizeValue = size;
        let customSizeObj = null;
        if (size === 'Custom') {
          customSizeObj = {
            width: parseFloat(customWidth),
            height: parseFloat(customHeight),
            unit: 'mm'
          };
          sizeValue = 'Custom';
        }

        // ✅ Determine initial payment status based on payment method
        let initialPaymentStatus = 'pending';
        if (paymentMethod === 'razorpay') {
          initialPaymentStatus = 'pending'; // Will be updated after payment
        } else if (paymentMethod === 'cod') {
          initialPaymentStatus = 'pending'; // Will be updated after cash collection
        }

        // ✅ REMOVED price fields from here - default to 0, admin will set later
        const designOrder = new DesignOrder({
          user: user._id,
          userEmail: userEmail || user.email,
          userName: userName || user.name || user.email,
          userPhone: userPhone || user.phone || '',
          designFiles: designFilesArray,
          quantity: parseInt(quantity),
          productPrice: 0,  // ✅ Default to 0 - Admin will set later
          deliveryCharge: 0, // ✅ Default to 0 - Admin will set later
          totalPrice: 0,     // ✅ Default to 0 - Admin will set later
          size: sizeValue,
          customSize: customSizeObj,
          material: material,
          deliveryMethod: deliveryMethod || 'pickup',
          paymentMethod: paymentMethod || 'cod',
          deliveryAddress: req.body.deliveryAddress ? JSON.parse(req.body.deliveryAddress) : null,
          paymentStatus: initialPaymentStatus,
          additionalText: {
            cardHolderName: cardHolderName || '',
            designation: designation || '',
            companyName: companyName || '',
            specialInstructions: specialInstructions || ''
          },
          status: 'pending',
          statusHistory: [{
            status: 'pending',
            timestamp: new Date(),
            comment: `Order submitted successfully with ${processedFiles.length} file(s)`
          }]
        });

        await designOrder.save();

        res.status(201).json({
          success: true,
          message: 'Design order submitted successfully',
          order: {
            orderNumber: designOrder.orderNumber,
            id: designOrder._id,
            status: designOrder.status,
            totalFiles: processedFiles.length
          }
        });
      });
    });
  } catch (error) {
    console.error('Submit design order error:', error);
    res.status(500).json({ success: false, message: 'Server error while submitting design order', error: error.message });
  }
};

// ==================== GET ORDERS ====================
export const getUserDesignOrders = async (req, res) => {
  try {
    const { userId } = req.params;
    const orders = await DesignOrder.find({ user: userId }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, orders: orders });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching orders', error: error.message });
  }
};

export const getDesignOrderById = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await DesignOrder.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    res.status(200).json({ success: true, order: order });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching order', error: error.message });
  }
};

export const getAllDesignOrders = async (req, res) => {
  try {
    const orders = await DesignOrder.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: orders.length, orders: orders });
  } catch (error) {
    console.error('Error fetching all orders:', error);
    res.status(500).json({ success: false, message: 'Error fetching orders', error: error.message });
  }
};

// ==================== UPDATE ORDER STATUS ====================
export const updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, comment } = req.body;
    
    const order = await DesignOrder.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    
    order.status = status;
    order.statusHistory.push({
      status: status,
      timestamp: new Date(),
      comment: comment || `Status updated to ${status}`
    });
    
    if (status === 'approved') order.approvedAt = new Date();
    if (status === 'completed') order.completedAt = new Date();
    
    await order.save();
    
    res.status(200).json({ success: true, message: 'Order status updated', order: order });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating order status', error: error.message });
  }
};

// ==================== PAYMENT MANAGEMENT ====================

// ✅ Mark payment as paid (for Razorpay)
export const markPaymentAsPaid = async (req, res) => {
  try {
    const { orderId, paymentId } = req.body;
    const order = await DesignOrder.findById(orderId);
    
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    
    order.paymentStatus = 'paid';
    if (paymentId) {
      order.razorpayPaymentId = paymentId;
    }
    
    await order.save();
    
    res.json({ 
      success: true, 
      message: 'Payment marked as paid',
      order: order 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ✅ Mark COD order as paid (after cash collection)
export const markOrderAsPaidCOD = async (req, res) => {
  try {
    const { orderId } = req.body;
    const order = await DesignOrder.findById(orderId);
    
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    
    order.paymentStatus = 'paid';
    await order.save();
    
    res.json({ 
      success: true, 
      message: 'COD payment marked as paid',
      order: order 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ==================== EMAIL FUNCTIONS ====================
export const startOrderProcessing = async (req, res) => {
  try {
    const { orderId, expectedDate } = req.body;
    const order = await DesignOrder.findById(orderId);
    
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    
    const emailResult = await sendProcessingStartedEmail(order, expectedDate);
    
    if (emailResult.success) {
      order.status = 'in_process';
      order.expectedCompletionDate = new Date(expectedDate);
      await order.save();
      res.json({ success: true, message: 'Email sent successfully' });
    } else {
      res.status(500).json({ success: false, error: emailResult.error });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const markOrderReadyForPickup = async (req, res) => {
  try {
    const { orderId } = req.body;
    const order = await DesignOrder.findById(orderId);
    
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    
    const emailResult = await sendReadyForPickupEmail(order);
    
    if (emailResult.success) {
      order.status = 'ready_for_pickup';
      await order.save();
      res.json({ success: true, message: 'Pickup notification sent' });
    } else {
      res.status(500).json({ success: false, error: emailResult.error });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const markOrderOutForDelivery = async (req, res) => {
  try {
    const { orderId, deliveryDateTime } = req.body;
    const order = await DesignOrder.findById(orderId);
    
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    
    const parsedDate = new Date(deliveryDateTime);
    const emailResult = await sendOutForDeliveryEmail(order, parsedDate);
    
    if (emailResult.success) {
      order.status = 'out_for_delivery';
      order.actualCompletionDate = parsedDate;
      await order.save();
      res.json({ success: true, message: 'Delivery notification sent' });
    } else {
      res.status(500).json({ success: false, error: emailResult.error });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const sendPaymentReminderEmail = async (req, res) => {
  try {
    const { orderId, paymentLink } = req.body;
    const order = await DesignOrder.findById(orderId);
    
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    
    const emailResult = await sendPaymentLinkEmail(order, paymentLink);
    
    if (emailResult.success) {
      res.json({ success: true, message: 'Payment reminder email sent' });
    } else {
      res.status(500).json({ success: false, error: emailResult.error });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ==================== IMAGE SERVING ====================
export const getOptimizedImage = async (req, res) => {
  try {
    const { filename } = req.params;
    const imagePath = path.join(uploadDir, filename);
    
    if (!fs.existsSync(imagePath)) {
      return res.status(404).json({ error: 'Image not found' });
    }
    
    res.sendFile(imagePath);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== CREATE RAZORPAY PAYMENT LINK ====================
// ==================== CREATE RAZORPAY PAYMENT LINK ====================
export const createRazorpayPaymentLink = async (req, res) => {
  try {
    console.log('🔵 Creating payment link for order...');
    
    const { orderId } = req.body;
    
    if (!orderId) {
      console.log('❌ No orderId provided');
      return res.status(400).json({ 
        success: false, 
        error: 'Order ID is required' 
      });
    }
    
    const order = await DesignOrder.findById(orderId);
    
    if (!order) {
      console.log('❌ Order not found:', orderId);
      return res.status(404).json({ 
        success: false, 
        error: 'Order not found' 
      });
    }
    
    console.log(`📦 Found order: ${order.orderNumber}`);
    console.log(`💰 Total Price: ${order.totalPrice}`);

    const totalAmount = order.totalPrice || 0;
    
    if (totalAmount <= 0) {
      console.log('❌ Invalid total amount:', totalAmount);
      return res.status(400).json({ 
        success: false, 
        error: 'Order amount is invalid. Please set the product price and delivery charge first.' 
      });
    }

    console.log(`💰 Creating payment link for ₹${totalAmount}`);

    // ✅ Get Razorpay instance from database
    const razorpay = await getRazorpayInstance();

    const options = {
      amount: Math.round(totalAmount * 100),
      currency: 'INR',
      accept_partial: false,
      description: `Design Order #${order.orderNumber}`,
      customer: {
        name: order.userName || 'Customer',
        email: order.userEmail || 'customer@email.com',
        contact: order.userPhone || '0000000000'
      },
      notify: {
        email: true,
        sms: true
      },
      reminder_enable: true,
      notes: {
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
        type: 'design_order',
        quantity: order.quantity || 0,
        material: order.material || ''
      },
      callback_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/order-tracking/${order._id}`,
      callback_method: 'get'
    };

    console.log('📤 Sending request to Razorpay...');
    
    const paymentLink = await razorpay.paymentLink.create(options);
    
    console.log('✅ Payment link created:', paymentLink.short_url);
    
    order.razorpayOrderId = paymentLink.id;
    await order.save();

    res.json({
      success: true,
      paymentLink: paymentLink.short_url || paymentLink.url,
      paymentLinkId: paymentLink.id,
      amount: totalAmount
    });

  } catch (error) {
    console.error('❌ Error creating Razorpay payment link:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      stack: error.stack
    });
    
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to create payment link'
    });
  }
};
// ==================== VERIFY RAZORPAY PAYMENT ====================
export const verifyRazorpayPayment = async (req, res) => {
  try {
    const { orderId, paymentId, razorpayPaymentId, razorpaySignature } = req.body;
    
    // Create a crypto instance
    const crypto = require('crypto');
    const secret = process.env.RAZORPAY_KEY_SECRET 
    
    // Generate signature to verify
    const generatedSignature = crypto
      .createHmac('sha256', secret)
      .update(`${razorpayPaymentId}|${orderId}`)
      .digest('hex');
    
    if (generatedSignature === razorpaySignature) {
      // Payment is verified
      const order = await DesignOrder.findById(orderId);
      if (order) {
        order.paymentStatus = 'paid';
        order.razorpayPaymentId = razorpayPaymentId;
        await order.save();
        
        res.json({ 
          success: true, 
          message: 'Payment verified successfully',
          order: order
        });
      } else {
        res.status(404).json({ success: false, message: 'Order not found' });
      }
    } else {
      res.status(400).json({ success: false, message: 'Invalid payment signature' });
    }
  } catch (error) {
    console.error('❌ Payment verification error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ==================== GET PAYMENT STATUS ====================
export const getPaymentStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await DesignOrder.findById(orderId);
    
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    
    res.json({
      success: true,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      razorpayOrderId: order.razorpayOrderId,
      razorpayPaymentId: order.razorpayPaymentId
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
// ==================== UPDATE ORDER PRICES (ADMIN ONLY) ====================
export const updateOrderPrices = async (req, res) => {
  try {
    const { orderId, productPrice, deliveryCharge } = req.body;
    
    const order = await DesignOrder.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    
    order.productPrice = parseFloat(productPrice) || 0;
    order.deliveryCharge = parseFloat(deliveryCharge) || 0;
    order.totalPrice = order.productPrice + order.deliveryCharge;
    
    await order.save();
    
    res.json({
      success: true,
      message: 'Prices updated successfully',
      order: order
    });
  } catch (error) {
    console.error('❌ Error updating prices:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};
// Check Razorpay payment status
// Check Razorpay payment status
export const checkRazorpayPayment = async (req, res) => {
  try {
    const { orderId } = req.params;
    console.log(`🔍 Checking payment for order: ${orderId}`);
    
    const order = await DesignOrder.findById(orderId);
    
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    
    if (order.paymentStatus === 'paid') {
      console.log('✅ Payment already marked as paid in database');
      return res.json({ success: true, paymentStatus: 'paid', message: 'Already paid' });
    }
    
    if (!order.razorpayOrderId) {
      console.log('❌ No Razorpay order ID found');
      return res.json({ 
        success: false, 
        message: 'No payment link created yet. Please create payment link first.' 
      });
    }
    
    console.log(`📦 Razorpay Order ID: ${order.razorpayOrderId}`);
    
    try {
      // ✅ Get Razorpay instance from database
      const razorpay = await getRazorpayInstance();
      
      console.log('📤 Fetching payment link from Razorpay...');
      const paymentLink = await razorpay.paymentLink.fetch(order.razorpayOrderId);
      
      console.log(`📊 Payment Link Status: ${paymentLink.status}`);
      console.log(`📊 Payment Link Data:`, JSON.stringify(paymentLink, null, 2));
      
      const isPaid = paymentLink.status === 'paid' || paymentLink.status === 'captured';
      
      if (isPaid) {
        console.log('✅ Payment is successful! Updating order...');
        
        let paymentId = '';
        if (paymentLink.payments && paymentLink.payments.data && paymentLink.payments.data.length > 0) {
          paymentId = paymentLink.payments.data[0].id;
          console.log(`💳 Payment ID: ${paymentId}`);
        }
        
        order.paymentStatus = 'paid';
        if (paymentId) {
          order.razorpayPaymentId = paymentId;
        }
        await order.save();
        
        return res.json({ 
          success: true, 
          paymentStatus: 'captured',
          message: '✅ Payment found and marked as paid!',
          paymentId: paymentId
        });
      }
      
      console.log(`⏳ Payment status: ${paymentLink.status}`);
      return res.json({ 
        success: true, 
        paymentStatus: paymentLink.status,
        message: `⏳ Payment status: ${paymentLink.status}. Please wait or ask customer to complete payment.`
      });
      
    } catch (razorpayError) {
      console.error('❌ Razorpay API Error:', razorpayError.message);
      console.error('Error details:', razorpayError);
      
      return res.json({ 
        success: false, 
        error: razorpayError.message,
        message: 'Failed to check payment with Razorpay. Please try again or check manually.'
      });
    }
  } catch (error) {
    console.error('❌ checkRazorpayPayment error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      message: 'Server error while checking payment'
    });
  }
};