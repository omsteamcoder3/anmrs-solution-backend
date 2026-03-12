// models/Order.js - UPDATED TO HANDLE VARIANTS
import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema(
  {
    // ✅ S.No Field
    sNo: {
      type: Number,
      unique: true,
      index: true
    },

    // 🧑 Registered User (optional)
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },

    // 👤 Guest user reference (optional)
    guestUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GuestUser',
      required: false,
    },

    // 🚀 Unique order identifier (AUTO-GENERATED - not required)
    orderId: {
      type: String,
      unique: true,
      required: false,
    },

    // 💳 Payment fields
    razorpayOrderId: { type: String },
    paymentId: { type: String },
    paymentSignature: { type: String },

    // 🛒 Ordered products - UPDATED FOR VARIANTS
    products: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product',
          required: true,
        },
        variantId: {  // ✅ ADDED: Store which variant was selected
          type: String,
          default: null
        },
        variantName: {  // ✅ ADDED: Store variant name for display
          type: String,
          default: ''
        },
        // ✅ ADDED: Weight fields
        weight: {
          type: Number,
          default: 0
        },
        weightUnit: {
          type: String,
          default: 'gram'
        },
        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
        price: {  // ✅ This should be the actual price paid (variant price or base price)
          type: Number,
          required: true,
        },
        originalPrice: {  // ✅ ADDED: Store original price for discount display
          type: Number
        },
        discountPercentage: {  // ✅ ADDED: Store discount percentage
          type: Number,
          default: 0
        },
        name: { 
          type: String,
          required: true 
        }, // Product name
        image: {  // ✅ ADDED: Store product/variant image for order history
          type: String,
          default: ''
        },
        sku: {  // ✅ ADDED: Store SKU for inventory management
          type: String,
          default: ''
        }
      },
    ],

    // 📦 Shipping details
    shippingAddress: {
      firstName: { type: String },
      lastName: { type: String },
      fullName: { type: String },
      address: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      pincode: { type: String },
      postalCode: { type: String, required: true },
      country: { type: String, required: true },
      phone: { type: String, required: true },
      email: { type: String }  // ✅ ADDED: Email for guest orders
    },

    // 💰 Payment info
    paymentMethod: {
      type: String,
      enum: ['razorpay', 'stripe', 'cod', 'paypal'],  // ✅ Added paypal
      required: true,
      default: 'cod',
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded', 'partially_refunded'],
      default: 'pending',
    },

    // 📊 Amount breakdown
    subtotal: {  // ✅ RENAMED: Price before discounts
      type: Number, 
      required: true,
      default: 0
    },
    discountAmount: {  // ✅ ADDED: Total discount amount
      type: Number,
      default: 0
    },
    shippingFee: { 
      type: Number, 
      default: 0 
    },
    taxAmount: { 
      type: Number, 
      default: 0 
    },
    finalAmount: {  // ✅ Final amount after all adjustments
      type: Number, 
      required: true 
    },

    // 🧾 Order status
    orderStatus: {
      type: String,
      enum: [
        'pending',
        'confirmed',
        'processing',
        'shipped',
        'delivered',
        'cancelled',
        'refunded',
        'partially_refunded'
      ],
      default: 'pending',
    },

    // 🚫 Cancellation fields
    cancelledAt: { type: Date },
    cancelledBy: { 
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    cancellationReason: { type: String },

    // 💰 Refund history
    refunds: [{
      refundId: { type: String, required: true },
      amount: { type: Number, required: true },
      razorpayPaymentId: { type: String, required: true },
      type: { 
        type: String, 
        enum: ['full', 'partial'],
        required: true 
      },
      createdAt: { type: Date, default: Date.now },
      notes: { type: Object }
    }],

    // ⏰ Timestamps
    paidAt: { type: Date },
    deliveredAt: { type: Date },

    // 👥 Guest order flag
    isGuestOrder: {
      type: Boolean,
      default: false,
    },

    // 📝 Order notes
    notes: {  // ✅ ADDED: For customer/admin notes
      type: String,
      default: ''
    }
  },
  { timestamps: true }
);

// 🆔 Auto-generate clean unique orderId (ORD-YYYYMMDD-XXXXXX)
orderSchema.pre('save', async function (next) {
  if (this.isNew && !this.orderId) {
    try {
      let unique = false;
      let attempts = 0;
      const maxAttempts = 10;
      
      while (!unique && attempts < maxAttempts) {
        const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
        const id = `ORD-${datePart}-${randomPart}`;
        
        const exists = await mongoose.model('Order').findOne({ orderId: id });
        if (!exists) {
          this.orderId = id;
          unique = true;
        }
        attempts++;
      }
      
      if (!unique) {
        this.orderId = `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      }
    } catch (err) {
      console.error('Order ID generation failed:', err);
      this.orderId = `ORD-${Date.now()}`;
    }
  }
  next();
});

// 🔢 Auto-increment S.No before saving new orders
orderSchema.pre('save', async function (next) {
  if (this.isNew) {
    try {
      const lastOrder = await this.constructor.findOne({}, {}, { sort: { 'sNo': -1 } });
      this.sNo = lastOrder ? lastOrder.sNo + 1 : 1;
    } catch (error) {
      console.error('S.No generation failed:', error);
      this.sNo = Date.now();
    }
  }
  next();
});

// ✅ Calculate amounts before saving
orderSchema.pre('save', function (next) {
  // Calculate subtotal (sum of price * quantity for all products)
  if (this.products && this.products.length > 0) {
    this.subtotal = this.products.reduce((total, item) => {
      return total + (item.price * item.quantity);
    }, 0);
    
    // Calculate discount amount if originalPrice exists
    this.discountAmount = this.products.reduce((total, item) => {
      if (item.originalPrice && item.originalPrice > item.price) {
        return total + ((item.originalPrice - item.price) * item.quantity);
      }
      return total;
    }, 0);
    
    // Calculate final amount
    this.finalAmount = this.subtotal + this.shippingFee + this.taxAmount;
    
    // For backward compatibility, set totalAmount as subtotal
    if (!this.totalAmount) {
      this.totalAmount = this.subtotal;
    }
  }
  next();
});

// ✅ Indexes for better performance
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ orderId: 1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ orderStatus: 1 });
orderSchema.index({ isGuestOrder: 1 });
orderSchema.index({ 'shippingAddress.email': 1 }); // For guest order lookup

const Order = mongoose.model('Order', orderSchema);
export default Order;