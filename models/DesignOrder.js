import mongoose from 'mongoose';

const designOrderSchema = new mongoose.Schema({
  // User information
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userEmail: {
    type: String,
    required: true
  },
  userName: {
    type: String,
    required: true
  },
  userPhone: {
    type: String
  },

  // Order details
  orderNumber: {
    type: String,
    unique: true
  },

  // Design file information - NO originalName field
  designFiles: [{
    fileName: String,
    filePath: String,
    fileSize: Number,
    mimeType: String,
    fileType: {
      type: String,
      enum: ['PDF', 'WEBP', 'AI', 'CDR']
    }
  }],

  // Order specifications
  quantity: {
    type: Number,
    required: true,
    min: 1,
    default: 1
  },

  size: {
    type: String,
    required: true,
    enum: ['CR80 (85.6mm × 54mm)', 'CR79 (86mm × 54mm)', 'Custom'],
    default: 'CR80 (85.6mm × 54mm)'
  },

  customSize: {
    width: Number,
    height: Number,
    unit: {
      type: String,
      enum: ['mm', 'inches'],
      default: 'mm'
    }
  },

  material: {
    type: String,
    enum: ['Premium Plastic', 'Standard Plastic', 'PVC', 'Composite', 'Paper'],
    default: 'Premium Plastic'
  },

  additionalText: {
    cardHolderName: String,
    designation: String,
    companyName: String,
    specialInstructions: String
  },

  // Status tracking
  status: {
    type: String,
    enum: ['pending', 'design_review', 'approved', 'printing', 'completed', 'cancelled', 'rejected'],
    default: 'pending'
  },

  statusHistory: [{
    status: String,
    timestamp: Date,
    comment: String
  }],

  // File validation
  validationStatus: {
    isValid: {
      type: Boolean,
      default: false
    },
    errors: [String],
    warnings: [String],
    reviewedBy: String,
    reviewedAt: Date
  },

  // Timestamps
  submittedAt: {
    type: Date,
    default: Date.now
  },
  approvedAt: Date,
  completedAt: Date,

  // Admin notes
  adminNotes: String,

  // Tracking
  trackingNumber: String
}, {
  timestamps: true
});

// Generate order number before saving
designOrderSchema.pre('save', function() {
  if (!this.orderNumber) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    this.orderNumber = `DESIGN-${year}${month}${day}-${random}`;
  }
});

// Check if model already exists before creating
const DesignOrder = mongoose.models.DesignOrder || mongoose.model('DesignOrder', designOrderSchema);

export default DesignOrder;