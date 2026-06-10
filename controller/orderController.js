import Order from '../models/orderModel.js';
import Cart from '../models/cartModel.js';
import Product from '../models/productModel.js';
import Shipping from '../models/shippingModel.js'; // ✅ ADDED
import shippingService from '../services/shippingService.js'; // ✅ ADDED
import Setting from '../models/Setting.js'; // ADD THIS
import { 
  emailTemplates, 
  sendEmail, 
  sendOrderConfirmation, 
  sendOrderStatusUpdate,
  sendOrderCancellationNotification 
} from './emailController.js';
import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';

// Helper functions for stock management
const restoreProductStock = async (products) => {
  for (const item of products) {
    await Product.findByIdAndUpdate(item.product, {
      $inc: { stock: item.quantity }
    });
  }
};

const reduceProductStock = async (products) => {
  for (const item of products) {
    const product = await Product.findById(item.product);
    if (product && product.stock >= item.quantity) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stock: -item.quantity }
      });
    }
  }
};

// ✅ NEW: Auto cancel ShipRocket shipment helper function
const autoCancelShiprocketShipment = async (order, user, reason = 'Order cancelled') => {
  try {
    const shipping = await Shipping.findOne({ orderId: order.orderId });
    
    if (shipping && shipping.shipmentId) {
      console.log(`🚫 Auto-cancelling ShipRocket shipment for order: ${order.orderId}`);
      
      const result = await shippingService.cancelShipment(shipping);
      
      if (result.success) {
        // Update local shipping status
        shipping.shippingStatus = 'cancelled';
        shipping.cancellationReason = reason;
        shipping.cancelledAt = new Date();
        shipping.cancelledBy = user?._id;
        await shipping.save();
        
        console.log('✅ ShipRocket shipment auto-cancelled successfully');
        return { success: true, message: result.message };
      } else {
        throw new Error(result.message);
      }
    }
    return { success: true, message: 'No shipment found to cancel' };
  } catch (error) {
    console.error('❌ Auto ShipRocket cancellation failed:', error.message);
    return { success: false, message: error.message };
  }
};

// Helper function to format receipt data
const formatReceiptData = (order) => {
  // Helper function to clean price (remove '¹')
  const cleanPrice = (price) => {
    if (typeof price === 'string') {
      // Remove '¹' and any other non-numeric characters except decimal point
      const cleaned = price.replace('¹', '').replace(/[^\d.]/g, '');
      return parseFloat(cleaned) || 0;
    }
    return price || 0;
  };

  return {
    receiptNumber: order._id.toString(),
    orderNumber: order.orderId || order._id.toString(),
    date: order.createdAt,
    customer: {
      id: order.user?._id,
      name: order.user?.name || (order.guestUser?.name || 'Guest Customer'),
      email: order.user?.email || (order.guestUser?.email || 'N/A')
    },
    shippingAddress: order.shippingAddress,
    items: order.products.map(item => ({
      name: item.product?.name || 'Product not available',
      quantity: item.quantity,
      price: cleanPrice(item.price),  // ← CHANGED: Clean the price
      total: (item.quantity * cleanPrice(item.price)).toFixed(2),  // ← CHANGED
      image: item.product?.image,
      selectedSize: item.selectedSize,
      // ✅ ADDED: Weight fields for receipt
      // weight: item.weight || 0,
      // weightUnit: item.weightUnit || 'gram'
    })),
    pricing: {
      subtotal: cleanPrice(order.totalAmount) || 0,  // ← CHANGED
      tax: cleanPrice(order.taxAmount) || 0,  // ← CHANGED
      shipping: cleanPrice(order.shippingFee) || 0,  // ← CHANGED
      total: cleanPrice(order.finalAmount) || 0  // ← CHANGED
    },
    payment: {
      method: order.paymentMethod,
      status: order.paymentStatus,
      paidAt: order.paidAt,
    },
   
  };
};

// Helper function to generate PDF
const generateReceiptPDF = async (res, receiptData) => {
  try {

    const settings = await Setting.findOne().lean();
    const doc = new PDFDocument({ margin: 50 });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=receipt-${receiptData.orderNumber}.pdf`);
    
    doc.pipe(res)

    // Add PDF content
    addHeader(settings,doc, receiptData);
    addCustomerInfo(settings,doc, receiptData);
    addItemsTable(doc, receiptData);
    addTotals(doc, receiptData);
    addPaymentInfo(doc, receiptData);
    addFooter(doc, receiptData);

    doc.end();
  } catch (error) {
    throw new Error(`PDF generation failed: ${error.message}`);
  }
};

// PDF generation functions
// PDF generation functions
const addHeader = (settings,doc, data) => {
  // Company name - GLAINIC
  doc.fontSize(24)
     .font('Helvetica-Bold')
     .fillColor('#1a237e')
     .text(settings.siteName || 'GLAINIC', { align: 'center' })
     .moveDown(0.3);
  
  // Company tagline
  doc.fontSize(10)
     .font('Helvetica')
     .fillColor('#666')
     .text('Sustainable Solutions', { align: 'center' })
     .moveDown(1.5);
};

const addCustomerInfo = (settings,doc, data) => {
  const startX = 50;
  const startY = doc.y;
  
  // FROM: GLAINIC Company Address (first column - left)
  doc.fontSize(10)
     .font('Helvetica-Bold')
     .fillColor('#000')
     .text('FROM:', startX, startY)
     .moveDown(0.3);
  
  doc.font('Helvetica')
     .fontSize(9);
  
  // Calculate positions without .moveDown()
  let currentY = doc.y;
  
  doc.text(`${settings.siteName} `, startX, currentY);
  currentY += 12;
  
const addressLines = (settings.companyAddress).split(', ');
addressLines.forEach(line => {
    doc.text(line, startX, currentY);
    currentY += 12;
});
  
 doc.text(`Phone: ${settings.contactNumber || '+91 720007422'}`, startX, currentY);
  currentY += 12;
  
 doc.text(`Email: ${settings.contactEmail || 'billing@glainic.com'}`, startX, currentY);
  currentY += 12;
  
  // ORDER RECEIPT section in middle (second column)
  const orderColumnX = startX + 200;
  
  doc.fontSize(14)
     .font('Helvetica-Bold')
     .fillColor('#000')
     .text('ORDER RECEIPT', orderColumnX, startY);
  
  let orderY = startY + 25; // Position for order details
  
  doc.fontSize(10)
     .font('Helvetica')
     .fillColor('#333')
     .text(`Order #: ${data.orderNumber}`, orderColumnX, orderY);
  
  orderY += 12;
  doc.text(`Date: ${new Date(data.date).toLocaleDateString()}`, orderColumnX, orderY);
  
  // TO: Customer Address (third column - right)
  const toColumnX = startX + 390;
  
  doc.fontSize(10)
     .font('Helvetica-Bold')
     .fillColor('#000')
     .text('TO:', toColumnX, startY);
  
  doc.font('Helvetica')
     .fontSize(9);
  
  const toWidth = 200;
  let toY = startY + 15;
  
  doc.text(data.customer.name || 'Customer Name', toColumnX, toY, { width: toWidth });
  toY += 12;
  
  if (data.shippingAddress) {
    if (data.shippingAddress.street) {
      doc.text(data.shippingAddress.street, toColumnX, toY, { width: toWidth });
      toY += 12;
    }
    if (data.shippingAddress.city || data.shippingAddress.state || data.shippingAddress.postalCode) {
      const cityStateZip = [
        data.shippingAddress.city,
        data.shippingAddress.state,
        data.shippingAddress.postalCode
      ].filter(Boolean).join(', ');
      doc.text(cityStateZip, toColumnX, toY, { width: toWidth });
      toY += 12;
    }
    if (data.shippingAddress.country) {
      doc.text(data.shippingAddress.country, toColumnX, toY, { width: toWidth });
      toY += 12;
    }
  } else {
    doc.text('No shipping address provided', toColumnX, toY, { width: toWidth });
    toY += 12;
  }
  
  if (data.customer.email) {
    doc.text(`Email: ${data.customer.email}`, toColumnX, toY, { width: toWidth });
    toY += 12;
  }
  
  // Move cursor down for next section
  const fromHeight = currentY - startY;
  const orderHeight = 60;
  const toHeight = toY - startY;
  const maxHeight = Math.max(fromHeight, orderHeight, toHeight);
  
  doc.y = startY + maxHeight + 20;
};

const addItemsTable = (doc, data) => {
  const tableTop = doc.y + 10;
  
  // Table header - UPDATED to include Weight column
  doc.font('Helvetica-Bold')
     .fontSize(10)
     .text('PRODUCT', 50, tableTop)
     .text('QTY', 200, tableTop)
    //  .text('WEIGHT', 250, tableTop)  // ✅ ADDED: Weight column
     .text('PRICE', 320, tableTop)
     .text('TOTAL', 420, tableTop);
  
  // Line under header
  doc.moveTo(50, tableTop + 15)
     .lineTo(550, tableTop + 15)
     .stroke();
  
  let yPosition = tableTop + 25;
  
  // Table rows
  data.items.forEach((item) => {
    if (yPosition > 700) {
      doc.addPage();
      yPosition = 50;
    }
    
    doc.font('Helvetica')
       .fontSize(9)
       .text(item.name, 50, yPosition, { width: 140 })
       .text(item.quantity.toString(), 200, yPosition)
      //  .text(`${item.weight || 0} ${item.weightUnit || 'gram'}`, 250, yPosition, { width: 60 })  // ✅ ADDED: Display weight
       .text(`${item.price}`, 320, yPosition)
       .text(`${item.total}`, 420, yPosition)
    
    yPosition += 20;
  });
  
  doc.y = yPosition + 10;
};

const addTotals = (doc, data) => {
  const totalsTop = doc.y;
  
  doc.font('Helvetica')
     .fontSize(10)
     .text(`Subtotal: ${data.pricing.subtotal.toFixed(2)}`, 400, totalsTop)
     .text(`Tax: ${data.pricing.tax.toFixed(2)}`, 400, totalsTop + 15)
     .text(`Shipping: ${data.pricing.shipping.toFixed(2)}`, 400, totalsTop + 30);
  
  doc.moveTo(400, totalsTop + 45)
     .lineTo(500, totalsTop + 45)
     .stroke();
  
  doc.font('Helvetica-Bold')
     .text(`TOTAL: ${data.pricing.total.toFixed(2)}`, 400, totalsTop + 55);
};

const addPaymentInfo = (doc, data) => {
  doc.moveDown(2)
     .font('Helvetica')
     .fontSize(10)
     .text(`Payment Method: ${data.payment.method}`, 50, doc.y)
     .text(`Payment Status: ${data.payment.status}`, 50, doc.y + 15);
  
  if (data.payment.paidAt) {
    doc.text(`Paid On: ${new Date(data.payment.paidAt).toLocaleDateString()}`, 50, doc.y + 30);
  }
};

const addFooter = (doc, data) => {
  doc.y = 700;
  doc.fontSize(8)
     .fillColor('#666666')
     .text(data.notes, { align: 'center', width: 500 })
     .moveDown(0.5)
     .text('Thank you for your business!', { align: 'center' });
};

// Helper function to generate PDF buffer
const generateReceiptPDFBuffer = (receiptData) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const buffers = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      // Add PDF content
      addHeader(doc, receiptData);
      addCustomerInfo(doc, receiptData);
      addItemsTable(doc, receiptData);
      addTotals(doc, receiptData);
      addPaymentInfo(doc, receiptData);
      addFooter(doc, receiptData);

      doc.end();

    } catch (error) {
      reject(error);
    }
  });
};

// @desc    Create new order (for registered users) - FIXED VERSION
// @route   POST /api/orders
// @access  Private
// @desc    Create new order (for registered users) - FIXED VERSION
// @route   POST /api/orders
// @access  Private

export const createOrder = async (req, res) => {
  try {
    const { shippingAddress, paymentMethod, paymentId, variantSelections, skipCartClear, products: bodyProducts } = req.body;
    console.log('Creating order for user:', req.user.id);
    console.log('Payment method:', paymentMethod);
    console.log('skipCartClear:', skipCartClear);
    console.log('bodyProducts:', bodyProducts);

    let productsToOrder = [];
    let totalAmount = 0;

    // ✅ FIX: If skipCartClear is true (Buy Now mode), use products from request body
    if (skipCartClear && bodyProducts && bodyProducts.length > 0) {
      console.log('🛒 Buy Now mode - Using products from request body');
      for (const item of bodyProducts) {
        const product = await Product.findById(item.product);
        if (!product) {
          return res.status(400).json({
            success: false,
            message: `Product not found: ${item.product}`
          });
        }

        const price = item.price;
        const variantId = item.variantId;
        const variantName = item.variantName || '';
        let variant = null;
        let originalPrice = price;

        if (variantId && product.variants && product.variants.length > 0) {
          variant = product.variants.find(v => v._id.toString() === variantId);
          if (variant) {
            originalPrice = variant.originalPrice || variant.price || price;
          }
        }

        // Check stock
        if (variant) {
          if (variant.stock < item.quantity) {
            return res.status(400).json({
              success: false,
              message: `Insufficient stock for ${product.name} - ${variantName}`
            });
          }
        } else if (product.stock < item.quantity) {
          return res.status(400).json({
            success: false,
            message: `Insufficient stock for ${product.name}`
          });
        }

        const itemTotal = item.quantity * price;
        totalAmount += itemTotal;

        let discountPercentage = 0;
        if (originalPrice > price) {
          discountPercentage = Math.round(((originalPrice - price) / originalPrice) * 100);
        }

        const productImage = product.images && product.images.length > 0
          ? product.images[0].image
          : null;

        productsToOrder.push({
          product: product._id,
          variantId: variantId,
          variantName: variantName,
          quantity: item.quantity,
          price: price,
          originalPrice: originalPrice,
          discountPercentage: discountPercentage,
          name: product.name,
          image: productImage,
          sku: null
        });

        console.log('Buy Now product added:', {
          name: product.name,
          price: price,
          quantity: item.quantity
        });
      }
    } else {
      // ❌ NORMAL CHECKOUT - Use cart from database
      console.log('🛒 Normal checkout - Using cart from database');
      const cart = await Cart.findOne({ user: req.user.id })
        .populate({
          path: 'items.product',
          model: 'Product',
          select: 'name basePrice stock images variants'
        });

      if (!cart || cart.items.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Cart is empty',
        });
      }

      console.log('Processing cart items:', cart.items.length);

      for (const item of cart.items) {
        if (!item.product || !item.product._id) {
          console.error('Invalid product in cart item:', item);
          return res.status(400).json({
            success: false,
            message: 'Invalid product in cart',
          });
        }

        const product = await Product.findById(item.product._id);
        if (!product) {
          return res.status(400).json({
            success: false,
            message: `Product not found`,
          });
        }

        const price = item.price;
        const variantId = item.variantId;
        const variantName = item.variantName || '';
        let variant = null;
        let originalPrice = price;

        if (variantId && product.variants && product.variants.length > 0) {
          variant = product.variants.find(v => v._id.toString() === variantId);
          if (variant) {
            originalPrice = variant.originalPrice || variant.price || price;
          }
        }

        if (typeof price !== 'number' || isNaN(price) || price <= 0) {
          console.error('Invalid price from cart:', {
            productId: product._id,
            productName: product.name,
            cartPrice: price,
            variantName
          });
          return res.status(400).json({
            success: false,
            message: `Invalid price for ${product.name}`
          });
        }

        if (variant) {
          if (variant.stock < item.quantity) {
            return res.status(400).json({
              success: false,
              message: `Insufficient stock for ${product.name} - ${variantName}`
            });
          }
        } else if (product.stock < item.quantity) {
          return res.status(400).json({
            success: false,
            message: `Insufficient stock for ${product.name}`
          });
        }

        const itemTotal = item.quantity * price;
        totalAmount += itemTotal;

        let discountPercentage = 0;
        if (originalPrice > price) {
          discountPercentage = Math.round(((originalPrice - price) / originalPrice) * 100);
        }

        const productImage = product.images && product.images.length > 0
          ? product.images[0].image
          : null;

        productsToOrder.push({
          product: product._id,
          variantId: variantId,
          variantName: variantName,
          quantity: item.quantity,
          price: price,
          originalPrice: originalPrice,
          discountPercentage: discountPercentage,
          name: product.name,
          image: productImage,
          sku: null
        });

        console.log('Product added to order from cart:', {
          name: product.name,
          variant: variantName || 'None',
          priceFromCart: price,
          quantity: item.quantity,
          itemTotal
        });
      }
    }

    // Validate totalAmount
    if (isNaN(totalAmount) || totalAmount <= 0) {
      console.error('Invalid total amount calculated:', totalAmount);
      return res.status(400).json({
        success: false,
        message: 'Invalid order total calculated'
      });
    }

    console.log('Total amount:', totalAmount);

    // Calculate shipping, tax, and final amount
    const shippingFee = 0;
    const taxAmount = Math.round(totalAmount * 5) / 100;
    const finalAmount = totalAmount + shippingFee + taxAmount;

    console.log('Amount calculations:', {
      totalAmount,
      shippingFee,
      taxAmount,
      finalAmount
    });

    // Create order with the data
    const orderData = {
      user: req.user.id,
      products: productsToOrder,
      shippingAddress,
      paymentMethod,
      paymentId: paymentMethod !== 'cod' ? paymentId : undefined,
      paymentStatus: paymentMethod === 'cod' ? 'pending' : 'pending',
      orderStatus: paymentMethod === 'cod' ? 'pending' : 'pending',
      totalAmount: Number(totalAmount.toFixed(2)),
      shippingFee: Number(shippingFee.toFixed(2)),
      taxAmount: Number(taxAmount.toFixed(2)),
      finalAmount: Number(finalAmount.toFixed(2)),
      subtotal: totalAmount,
      discountAmount: productsToOrder.reduce((sum, item) => {
        if (item.originalPrice > item.price) {
          return sum + ((item.originalPrice - item.price) * item.quantity);
        }
        return sum;
      }, 0)
    };

    console.log('Creating order with data:', {
      productsCount: orderData.products.length,
      totalAmount: orderData.totalAmount,
      finalAmount: orderData.finalAmount,
      taxAmount: orderData.taxAmount
    });

    const order = await Order.create(orderData);

    console.log('✅ Order created:', {
      orderId: order.orderId,
      sNo: order.sNo,
      finalAmount: order.finalAmount,
      products: order.products.map(p => ({
        name: p.name,
        variant: p.variantName,
        price: p.price,
        quantity: p.quantity,
      }))
    });

    // For COD payments, update stock immediately
    if (paymentMethod === 'cod') {
      try {
        for (const item of productsToOrder) {
          const product = await Product.findById(item.product);
          if (product) {
            if (item.variantId && product.variants && product.variants.length > 0) {
              const variantIndex = product.variants.findIndex(v => v._id.toString() === item.variantId);
              if (variantIndex !== -1) {
                product.variants[variantIndex].stock -= item.quantity;
                const totalStock = product.variants.reduce((sum, variant) => sum + (variant.stock || 0), 0);
                product.stock = totalStock;
                await product.save();
                console.log(`Updated variant stock for ${product.name}: -${item.quantity}`);
              }
            } else {
              product.stock -= item.quantity;
              await product.save();
              console.log(`Updated product stock for ${product.name}: -${item.quantity}`);
            }
          }
        }

        try {
          await sendOrderConfirmation(order._id);
          console.log('Order confirmation email sent for COD order');
        } catch (emailError) {
          console.error('Order confirmation email failed:', emailError);
        }
      } catch (stockError) {
        console.error('Stock update failed for COD order:', stockError);
      }
    }

    // Only clear cart if NOT in Buy Now mode
    if (!skipCartClear) {
      await Cart.findOneAndUpdate({ user: req.user.id }, { $set: { items: [] } });
      console.log(`🗑️ Cart cleared for user ${req.user.id} (normal checkout)`);
    } else {
      console.log(`🛒 Buy Now mode - Cart NOT cleared for user ${req.user.id} (cart preserved)`);
    }

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      order,
      requiresPayment: paymentMethod !== 'cod'
    });

  } catch (error) {
    console.error('Create order error:', error);
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      console.error('Validation errors:', validationErrors);
      return res.status(400).json({
        success: false,
        message: 'Order validation failed',
        errors: validationErrors
      });
    }
    if (error.name === 'CastError') {
      console.error('Cast error:', error.message);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};
// @desc    Update order payment success (for Razorpay verification)
// @route   PUT /api/orders/payment-success
// @access  Public (called by Razorpay webhook)
export const updateOrderPaymentSuccess = async (req, res) => {
  try {
    const { orderId, paymentId } = req.body;

    if (!orderId || !paymentId) {
      return res.status(400).json({
        success: false,
        message: 'Order ID and Payment ID are required'
      });
    }

    // Find order by orderId
    const order = await Order.findOne({ orderId })
      .populate('user', 'name email')
      .populate('products.product', 'name price stock');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Update product stock for Razorpay payments
    if (order.paymentMethod === 'razorpay' && order.paymentStatus !== 'completed') {
      for (const item of order.products) {
        if (item.product && item.product.stock >= item.quantity) {
          await Product.findByIdAndUpdate(item.product._id, {
            $inc: { stock: -item.quantity }
          });
          console.log(`Updated stock for product: ${item.product.name}`);
        }
      }
    }

    // Update order status
    order.paymentStatus = 'completed';
    order.orderStatus = 'confirmed';
    order.paymentId = paymentId;
    order.paidAt = new Date();
    await order.save();

    // Send order confirmation email
    try {
      await sendOrderConfirmation(order._id);
      console.log('Order confirmation email sent successfully after Razorpay payment');
    } catch (emailError) {
      console.error('Order confirmation email failed:', emailError);
    }

    res.json({
      success: true,
      message: 'Order payment status updated successfully',
      order
    });

  } catch (error) {
    console.error('Update order payment success error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Update order payment failed
// @route   PUT /api/orders/payment-failed
// @access  Public (called by Razorpay webhook)
export const updateOrderPaymentFailed = async (req, res) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: 'Order ID is required'
      });
    }

    const order = await Order.findOne({ orderId });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    order.paymentStatus = 'failed';
    order.orderStatus = 'cancelled';
    await order.save();

    res.json({
      success: true,
      message: 'Order payment status updated to failed',
      order
    });

  } catch (error) {
    console.error('Update order payment failed error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get order by orderId
// @route   GET /api/orders/order/:orderId
// @access  Public (for payment verification)
export const getOrderByOrderId = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findOne({ orderId })
      .populate('user', 'name email')
      .populate('products.product', 'name image price');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    res.json({
      success: true,
      order
    });

  } catch (error) {
    console.error('Get order by orderId error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get all orders (Admin)
// @route   GET /api/orders
// @access  Private/Admin
export const getOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) ;
    const skip = (page - 1) * limit;

    const orders = await Order.find()
      .populate('user', 'name email')
      .populate('guestUser', 'name email phone')
      .populate('products.product', 'name image')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Order.countDocuments();

    res.json({
      success: true,
      orders,
      pagination: {
        page,
        pages: Math.ceil(total / limit),
        total,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get user's orders
// @route   GET /api/orders/my-orders
// @access  Private
export const getUserOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user.id })
      .populate({
        path: 'products.product',
        select: 'name images', // FIX: Select 'images' not 'image'
        transform: (doc) => {
          if (doc) {
            return {
              _id: doc._id,
              name: doc.name,
              // FIX: Get the first image from the images array
              image: doc.images && doc.images.length > 0 ? doc.images[0].image : null
            };
          }
          return doc;
        }
      })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      orders,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get single order
// @route   GET /api/orders/:id
// @access  Private
export const getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('user', 'name email')
      .populate('guestUser', 'name email phone')
      .populate({
        path: 'products.product',
        select: 'name images', // FIX: Select 'images' not 'image'
        transform: (doc) => {
          if (doc) {
            return {
              _id: doc._id,
              name: doc.name,
              // FIX: Get the first image from the images array
              image: doc.images && doc.images.length > 0 ? doc.images[0].image : null
            };
          }
          return doc;
        }
      });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    res.json({
      success: true,
      order,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
export const deleteOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    await order.deleteOne();
    
    res.json({
      success: true,
      message: 'Order deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
// @desc    Update order status (works for both regular and guest users)
// @route   PUT /api/orders/:id/status
// @access  Private/Admin
export const updateOrderStatus = async (req, res) => {
  try {
    const { orderStatus } = req.body;
    const { id } = req.params;

    // Validate inputs
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Order ID is required'
      });
    }

    if (!orderStatus) {
      return res.status(400).json({
        success: false,
        message: 'Order status is required'
      });
    }

    // Valid order statuses
    const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(orderStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid order status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    console.log('Updating order status for ID:', id);

    // Find order by ID with proper population
    const order = await Order.findById(id)
      .populate('user', 'name email')
      .populate('guestUser', 'name email phone')
      .populate('products.product', 'name image price');

    if (!order) {
      console.log(`Order not found with ID: ${id}`);
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    console.log(`Found order: ${order.orderId}, current status: ${order.orderStatus}, isGuest: ${order.isGuestOrder}`);

    const oldStatus = order.orderStatus;
    
    // Don't update if status is the same
    if (oldStatus === orderStatus) {
      return res.status(400).json({
        success: false,
        message: `Order status is already ${orderStatus}`
      });
    }

    order.orderStatus = orderStatus;

    // Handle specific status transitions
    if (orderStatus === 'delivered') {
      order.deliveredAt = new Date();

      // Auto-complete payment for COD orders
      if (order.paymentMethod === 'cod') {
        order.paymentStatus = 'completed';
        console.log('Auto-completed COD payment for delivered order');
      }
    }

    // ✅ UPDATED: Handle cancelled orders - restore product stock, send admin notification, AND cancel ShipRocket shipment
    if (orderStatus === 'cancelled' && oldStatus !== 'cancelled') {
      await restoreProductStock(order.products);
      console.log('Restored product stock for cancelled order');
      
      // ✅ NEW: Automatically cancel ShipRocket shipment if it exists
      const cancellationResult = await autoCancelShiprocketShipment(
        order, 
        req.user, 
        `Auto-cancelled: Order status changed from ${oldStatus} to ${orderStatus}`
      );
      
      if (!cancellationResult.success) {
        console.warn('⚠️ ShipRocket cancellation had issues:', cancellationResult.message);
      }
      
      // Send admin notification for cancellation via status update
      try {
        const adminNotification = await sendOrderCancellationNotification(
          order, 
          'admin', 
          `Status changed from ${oldStatus} to cancelled`
        );
        console.log(`📧 Admin cancellation notification sent via status update:`, adminNotification.success ? 'Sent' : 'Failed');
      } catch (emailError) {
        console.error('Admin cancellation notification failed in status update:', emailError);
      }
    }

    // Handle moving from cancelled status - reduce stock again
    if (oldStatus === 'cancelled' && orderStatus !== 'cancelled') {
      await reduceProductStock(order.products);
      console.log('Reduced product stock for reactivated order');
    }

    await order.save();
    console.log(`Order status updated from ${oldStatus} to ${orderStatus}`);

    // Get the fully updated order for email
    const updatedOrder = await Order.findById(order._id)
      .populate('user', 'name email')
      .populate('guestUser', 'name email phone')
      .populate('products.product', 'name image price');

    // Send order status update email
    try {
      console.log('Sending order status update email...');
      
      let userEmail;
      let userName;
      
      if (updatedOrder.isGuestOrder) {
        // Guest user order
        userEmail = updatedOrder.guestUser.email;
        userName = updatedOrder.guestUser.name;
        console.log(`Sending to guest user: ${userEmail}`);
      } else {
        // Registered user order
        userEmail = updatedOrder.user.email;
        userName = updatedOrder.user.name;
        console.log(`Sending to registered user: ${userEmail}`);
      }

      if (userEmail) {
        const emailTemplate = emailTemplates.orderStatusUpdate(updatedOrder, oldStatus, orderStatus);
        const emailResult = await sendEmail(userEmail, emailTemplate.subject, emailTemplate.html);
        console.log('Order status update email sent successfully:', emailResult);
      } else {
        console.warn('No email address found for order:', updatedOrder._id);
      }

    } catch (emailError) {
      console.error('Order status update email failed:', emailError);
      // Continue even if email fails
    }

    res.json({
      success: true,
      order: updatedOrder,
      message: `Order status updated from ${oldStatus} to ${orderStatus}`,
      emailSent: true
    });

  } catch (error) {
    console.error('Update order status error:', error);
    
    // More specific error handling
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID format'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error while updating order status',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Update order status by orderId
// @route   PUT /api/orders/order-status/:orderId
// @access  Private/Admin
export const updateOrderStatusByOrderId = async (req, res) => {
  try {
    const { orderStatus } = req.body;
    const { orderId } = req.params;

    console.log('Updating order status for orderId:', orderId);

    // Find order by orderId with proper population
    const order = await Order.findOne({ orderId: orderId })
      .populate('user', 'name email')
      .populate('guestUser', 'name email phone')
      .populate('products.product', 'name image price');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    const oldStatus = order.orderStatus;
    order.orderStatus = orderStatus;

    // Handle delivered orders
    if (orderStatus === 'delivered') {
      order.deliveredAt = new Date();

      // Auto-complete payment for COD orders
      if (order.paymentMethod === 'cod') {
        order.paymentStatus = 'completed';
      }
    }

    // ✅ NEW: Auto-cancel ShipRocket shipment for orderId-based updates too
    if (orderStatus === 'cancelled' && oldStatus !== 'cancelled') {
      await restoreProductStock(order.products);
      
      const cancellationResult = await autoCancelShiprocketShipment(
        order, 
        req.user, 
        `Auto-cancelled: Order status changed from ${oldStatus} to ${orderStatus}`
      );
      
      if (!cancellationResult.success) {
        console.warn('⚠️ ShipRocket cancellation had issues:', cancellationResult.message);
      }
    }

    await order.save();

    // Send order status update email
    try {
      console.log('Sending order status update email...');
      const emailResult = await sendOrderStatusUpdate(order._id, oldStatus, orderStatus);
      console.log('Order status update email result:', emailResult);
    } catch (emailError) {
      console.error('Order status update email failed:', emailError);
    }

    res.json({
      success: true,
      order: {
        orderId: order.orderId,
        orderStatus: order.orderStatus,
        paymentStatus: order.paymentStatus,
        deliveredAt: order.deliveredAt,
      },
      message: `Order status updated from ${oldStatus} to ${orderStatus} and email sent successfully`,
    });
  } catch (error) {
    console.error('Update order status by orderId error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get order summary for user
// @route   GET /api/orders/summary
// @access  Private
export const getOrderSummary = async (req, res) => {
  try {
    const totalOrders = await Order.countDocuments({ user: req.user.id });
    const pendingOrders = await Order.countDocuments({
      user: req.user.id,
      orderStatus: { $in: ['pending', 'confirmed', 'processing'] },
    });
    const deliveredOrders = await Order.countDocuments({
      user: req.user.id,
      orderStatus: 'delivered',
    });

    res.json({
      success: true,
      summary: {
        totalOrders,
        pendingOrders,
        deliveredOrders,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Print order receipt (JSON or PDF based on Accept header)
// @route   GET /api/orders/:id/receipt
// @access  Private
export const printOrderReceipt = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('user', 'name email')
      .populate('guestUser', 'name email phone')
      .populate('products.product', 'name price image');

    if (!order) {
      return res.status(404).json({ 
        success: false,
        message: 'Order not found' 
      });
    }

    // Authorization check
    const isAdmin = req.user.role === 'admin';
    const isOrderOwner = order.user && order.user._id.toString() === req.user.id;
    
    if (!isOrderOwner && !isAdmin) {
      return res.status(403).json({ 
        success: false,
        message: 'Not authorized to view this receipt' 
      });
    }

    const receiptData = formatReceiptData(order);

    // Check if client wants PDF
    const wantsPDF = req.query.format === 'pdf' || 
                    req.headers.accept?.includes('application/pdf');

    if (wantsPDF) {
      return await generateReceiptPDF(res, receiptData);
    }

    // Return JSON by default
    res.json({
      success: true,
      message: 'Receipt generated successfully',
      receipt: receiptData
    });

  } catch (error) {
    console.error('Receipt generation error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error generating receipt', 
      error: error.message 
    });
  }
};

// @desc    Print order receipt PDF and save to uploads folder
// @route   GET /api/orders/:id/receipt/pdf
// @access  Private
// In orderController.js - printOrderReceiptPDF function
export const printOrderReceiptPDF = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('user', 'name email')
      .populate('products.product', 'name price image');

    if (!order) {
      return res.status(404).json({ 
        success: false,
        message: 'Order not found' 
      });
    }

    // Authorization check
    const isAdmin = req.user.role === 'admin';
    const isOrderOwner = order.user && order.user._id.toString() === req.user.id;
    
    if (!isOrderOwner && !isAdmin) {
      return res.status(403).json({ 
        success: false,
        message: 'Not authorized to view this receipt' 
      });
    }

    const receiptData = formatReceiptData(order);
    
    // Set headers for inline PDF display
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="receipt-${order.orderId}.pdf"`);
    
    // Generate and send PDF
    await generateReceiptPDF(res, receiptData);
    
  } catch (error) {
    console.error('PDF receipt generation error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error generating PDF receipt', 
      error: error.message 
    });
  }
};

// @desc    Create guest order
// @route   POST /api/orders/guest
// @access  Public
// @desc    Create guest order
// @route   POST /api/orders/guest
// @access  Public
export const createGuestOrder = async (req, res) => {
  try {
    const {
      products,
      shippingAddress,
      guestUser,
      paymentMethod = 'razorpay'
    } = req.body;

    console.log('Creating guest order via orders route');
    console.log('Guest order products:', products);

    // Process guest order products with weight
    const processedProducts = [];
    let totalAmount = 0;

    for (const item of products) {
      // Find the product
      const product = await Product.findById(item.product);
      
      if (!product) {
        return res.status(404).json({
          success: false,
          message: `Product not found: ${item.product}`
        });
      }

      let variant = null;
      let variantWeight = 0;
      let variantWeightUnit = 'gram';
      let price = item.price || product.basePrice;

      // Get variant details if variantId exists
      if (item.variantId && product.variants && product.variants.length > 0) {
        variant = product.variants.find(v => 
          v._id.toString() === item.variantId
        );
        
        if (variant) {
          variantWeight = variant.weight || 0;
          variantWeightUnit = variant.weightUnit || 'gram';
          price = variant.price || price;
        }
      }

      // Calculate item total
      const itemTotal = (price * item.quantity);
      totalAmount += itemTotal;

      // Get product image
      const productImage = product.images && product.images.length > 0 
        ? product.images[0].image 
        : null;

      processedProducts.push({
        product: product._id,
        variantId: item.variantId || null,
        variantName: item.variantName || '',
        // ✅ ADDED: Weight fields for guest orders
        weight: variantWeight,
        weightUnit: variantWeightUnit,
        quantity: item.quantity,
        price: price,
        originalPrice: variant?.originalPrice || product.originalPrice || price,
        discountPercentage: item.discountPercentage || 0,
        name: product.name,
        image: productImage,
        sku: item.sku || ''
      });

      console.log('Guest order item added:', {
        product: product.name,
        variant: item.variantName || 'None',
        weight: variantWeight,
        weightUnit: variantWeightUnit,
        price: price,
        quantity: item.quantity
      });
    }

    // Calculate shipping, tax, and final amount
    const shippingFee = 0; 
    const taxAmount = Math.round(totalAmount * 5) / 100; // 5% tax
    const finalAmount = totalAmount + shippingFee + taxAmount;

    // Create order data
    const orderData = {
      products: processedProducts,
      shippingAddress,
      guestUser,
      paymentMethod,
      paymentStatus: 'pending',
      orderStatus: 'pending',
      totalAmount: Number(totalAmount.toFixed(2)),
      shippingFee: Number(shippingFee.toFixed(2)),
      taxAmount: Number(taxAmount.toFixed(2)),
      finalAmount: Number(finalAmount.toFixed(2)),
      subtotal: totalAmount,
      isGuestOrder: true,
      discountAmount: processedProducts.reduce((sum, item) => {
        if (item.originalPrice > item.price) {
          return sum + ((item.originalPrice - item.price) * item.quantity);
        }
        return sum;
      }, 0)
    };

    console.log('Creating guest order with data:', {
      productsCount: orderData.products.length,
      totalAmount: orderData.totalAmount,
      finalAmount: orderData.finalAmount
    });

    const order = await Order.create(orderData);

    console.log('✅ Guest order created:', {
      orderId: order.orderId,
      products: order.products.map(p => ({
        name: p.name,
        variant: p.variantName,
        weight: p.weight,
        weightUnit: p.weightUnit,
        price: p.price,
        quantity: p.quantity
      }))
    });

    res.status(201).json({
      success: true,
      message: 'Guest order created successfully',
      order,
      requiresPayment: paymentMethod !== 'cod'
    });

  } catch (error) {
    console.error('Create guest order error:', error);
    
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Order validation failed',
        errors: validationErrors
      });
    }
    
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};

// @desc    Cancel order
// @route   PUT /api/orders/:id/cancel
// @access  Private
export const cancelOrder = async (req, res) => {
  try {
    const { cancellationReason } = req.body;
    const order = await Order.findById(req.params.id)
      .populate('user', 'name email')
      .populate('guestUser', 'name email phone')
      .populate('products.product', 'name price');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check if user is authorized to cancel this order
    // User can cancel their own order, admin can cancel any order
    const isAdmin = req.user.role === 'admin';
    const isOrderOwner = order.user && order.user._id.toString() === req.user.id;
    
    if (!isOrderOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to cancel this order'
      });
    }

    // Check if order can be cancelled (not already cancelled, shipped, or delivered)
    if (order.orderStatus === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Order is already cancelled'
      });
    }

    // Check if order can be cancelled based on current status
    const cancellableStatuses = ['pending', 'confirmed', 'processing'];
    if (!cancellableStatuses.includes(order.orderStatus)) {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel order that is already ${order.orderStatus}`
      });
    }

    // Update order status to cancelled
    order.orderStatus = 'cancelled';
    
    // Add cancellation details
    order.cancelledAt = new Date();
    order.cancelledBy = req.user.id;
    
    if (cancellationReason) {
      order.cancellationReason = cancellationReason;
    }

    // Restore product stock when order is cancelled
    await restoreProductStock(order.products);

    // ✅ NEW: Automatically cancel ShipRocket shipment if it exists
    const cancellationResult = await autoCancelShiprocketShipment(
      order, 
      req.user, 
      cancellationReason || 'Order cancelled by user'
    );
    
    if (!cancellationResult.success) {
      console.warn('⚠️ ShipRocket cancellation had issues:', cancellationResult.message);
    }

    await order.save();

    // Send cancellation email notification to ADMIN
    try {
      const cancelledBy = isAdmin ? 'admin' : 'user';
      const adminNotification = await sendOrderCancellationNotification(
        order, 
        cancelledBy, 
        cancellationReason || 'No reason provided'
      );
      
      console.log(`📧 Admin cancellation notification result:`, adminNotification.success ? 'Sent' : 'Failed');
      
    } catch (emailError) {
      console.error('Cancellation email failed:', emailError);
      // Continue even if email fails
    }

    res.json({
      success: true,
      message: 'Order cancelled successfully',
      order: {
        _id: order._id,
        orderId: order.orderId,
        orderStatus: order.orderStatus,
        cancelledAt: order.cancelledAt,
        cancellationReason: order.cancellationReason
      }
    });

  } catch (error) {
    console.error('Cancel order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while cancelling order',
      error: error.message
    });
  }
};

