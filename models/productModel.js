// models/Product.js
import mongoose from 'mongoose';
import slugify from 'slugify';

const productSchema = new mongoose.Schema({
    // ✅ Auto Increment Serial No
    sNo: {
        type: Number,
        unique: true,
        index: true
    },

    // ✅ Basic Info
    name: {
        type: String,
        required: [true, 'Please enter product name'],
        trim: true
    },
    slug: {
        type: String,
        unique: true,
        sparse: true
    },

    basePrice: {  // ✅ Renamed from price to basePrice
        type: Number,
        required: [true, 'Please enter base price']
    },
    // ✅ NEW OFFER FIELDS START
    originalPrice: {
        type: Number
    },
    discountPercentage: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
    },
    hasOffer: {
        type: Boolean,
        default: false
    },
    // ✅ NEW OFFER FIELDS END
    description: {
        type: String,
        required: [true, 'Please enter product description']
    },

    // ✅ Category
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: [true, 'Please select a category']
    },
categoryAttributes: {
  type: Map,
  of: {
    value: mongoose.Schema.Types.Mixed,
    unit: String
  },
  default: {}
},
    // ✅ Product Variants (COMBO PACKS) - NEW
    variants: [
        {
            variantName: {
                type: String,
                required: true,
                trim: true
            },
            variantSlug: {
                type: String,
                trim: true
            },
            price: {
                type: Number,
                required: true
            },
            originalPrice: { // To show discount
                type: Number
            },
            description: {
                type: String,
                trim: true
            },
            // ✅ NEW: Weight fields - number and unit
            weight: {
                type: Number,  // e.g., 50, 100, 250, 1, 2, 0.5
                default: 0
            },
            weightUnit: {
                type: String,
                enum: ['gram', 'kg', 'ml', 'liter', 'piece'],
                default: 'gram'
            },
            stock: {
                type: Number,
                required: true,
                default: 0
            },
            images: [
                {
                    image: {
                        type: String,
                        required: true
                    }
                }
            ],
            sku: {
                type: String,
                trim: true
            },
            isDefault: {
                type: Boolean,
                default: false
            },
            status: {
                type: String,
                enum: ['active', 'inactive', 'out-of-stock'],
                default: 'active'
            },
            discountPercentage: {
                type: Number,
                default: 0
            },
            features: [String] // Features specific to this pack
        }
    ],

    // ✅ Original Specifications
    specifications: [
        {
            key: {
                type: String,
                required: true
            },
            value: {
                type: String,
                required: true
            }
        }
    ],
    
    keyFeatures: [
        {
            type: String,
            trim: true
        }
    ],

    // ✅ Ratings & Reviews
    rating: {
        type: Number,
        default: 0
    },
    numberOfReviews: {
        type: Number,
        default: 0
    },

    // ✅ Main Product Images (for backward compatibility)
    images: [
        {
            image: {
                type: String,
                required: true
            }
        }
    ],

    // ✅ Seller Info
    seller: {
        type: String,
        required: [true, 'Please enter seller name']
    },

    // ✅ Total Stock (calculated from variants)
    stock: {
        type: Number,
        required: [true, 'Please enter stock quantity']
    },

    // ✅ SEO Fields
    metaTitle: { type: String, maxlength: 60 },
    metaDescription: { type: String, maxlength: 160 },
    metaKeywords: { type: [String] },
    canonicalUrl: { type: String },
    ogTitle: { type: String },
    ogDescription: { type: String },
    ogImage: { type: String },

    // ✅ Product Status
    status: {
        type: String,
        enum: ['active', 'inactive', 'out-of-stock'],
        default: 'active'
    },

    // ✅ Featured Product
    featured: {
        type: Boolean,
        default: false
    },

    createdAt: {
        type: Date,
        default: Date.now
    }
});

// ✅ Generate variant slugs and calculate total stock
productSchema.pre('save', async function (next) {
    // Generate main product slug
    if (this.isModified('name')) {
        const baseSlug = slugify(this.name, { lower: true, strict: true });
        let slug = baseSlug;
        let counter = 1;
        let slugExists = true;
        
        while (slugExists) {
            const existingProduct = await this.constructor.findOne({ slug });
            if (!existingProduct || existingProduct._id.equals(this._id)) {
                slugExists = false;
            } else {
                slug = `${baseSlug}-${counter}`;
                counter++;
            }
        }
        this.slug = slug;
    }

    // ✅ Generate variant slugs
    if (this.variants && this.variants.length > 0) {
        this.variants.forEach((variant, index) => {
            if (!variant.variantSlug) {
                const variantSlug = slugify(`${this.name} ${variant.variantName}`, { 
                    lower: true, 
                    strict: true 
                });
                variant.variantSlug = `${variantSlug}-${index + 1}`;
            }
        });
    }

    // ✅ Calculate total stock from variants
    if (this.variants && this.variants.length > 0) {
        const totalStock = this.variants.reduce((sum, variant) => sum + (variant.stock || 0), 0);
        this.stock = totalStock;
    }

    next();
});

// ✅ Auto Increment S.No
productSchema.pre('save', async function (next) {
    if (this.isNew) {
        try {
            const lastProduct = await this.constructor
                .findOne({}, {}, { sort: { sNo: -1 } });
            this.sNo = lastProduct ? lastProduct.sNo + 1 : 1;
        } catch (err) {
            this.sNo = Date.now();
        }
    }
    next();
});

// ✅ Indexes
productSchema.index({ category: 1, status: 1 });
productSchema.index({ featured: 1 });
productSchema.index({ slug: 1, sparse: true });
productSchema.index({ 'variants.sku': 1 }); // Index for variant SKU

export default mongoose.model('Product', productSchema);