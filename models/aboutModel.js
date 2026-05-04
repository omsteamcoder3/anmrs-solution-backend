import mongoose from 'mongoose';

const aboutSchema = new mongoose.Schema({
  // Main section title (YOUR ONE-STOP SECURITY & ID SOLUTIONS STORE)
  mainTitle: {
    type: String,
    required: true,
    default: "YOUR ONE-STOP SECURITY & ID SOLUTIONS STORE"
  },
  
  // Subtitle/Badge text (ANMRS IT SOLUTIONS E-COMMERCE)
  badgeText: {
    type: String,
    required: true,
    default: "ANMRS IT SOLUTIONS E-COMMERCE"
  },
  
  // First paragraph content
  paragraph1: {
    type: String,
    required: true,
    default: "Welcome to our comprehensive e-commerce platform for ID card manufacturing, RFID technology, and security systems. Browse our extensive catalog of PVC cards, RFID cards, NFC cards, access cards, and customizable lanyards - all available for online purchase with secure payment options."
  },
  
  // Second paragraph content
  paragraph2: {
    type: String,
    required: true,
    default: "Our online store features simple and variable products with complete stock control, category management, special offers and discounts. From multi-color lanyards to flex printing services, from CCTV systems to graphic design - everything you need is just a few clicks away with Razorpay, UPI, Net Banking, and COD payment options."
  },
  
  // Button text
  buttonText: {
    type: String,
    required: true,
    default: "SHOP OUR PRODUCTS"
  },
  
  // Button link
  buttonLink: {
    type: String,
    required: true,
    default: "/shop"
  },
  
  // Main image URL
mainImage: {
  type: String,
  default: ""
},
floatingImage: {
  type: String,
  default: ""
},
  
  // Floating badge text
  floatingBadgeText: {
    type: String,
    required: true,
    default: "⚡ Fast Shipping • Secure Payments"
  },
  
  // SEO Meta Title
  metaTitle: {
    type: String,
    default: "About Us - ANMRS IT Solutions E-Commerce | Security & ID Solutions Store"
  },
  
  // SEO Meta Description
  metaDescription: {
    type: String,
    default: "Learn about ANMRS IT Solutions e-commerce platform for ID card manufacturing, RFID technology, security systems, PVC cards, and more. Shop online with secure payments."
  },
  
  // Status (active/inactive)
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Version for cache busting
  version: {
    type: Number,
    default: 1
  }
}, {
  timestamps: true
});

// Create index for better query performance
aboutSchema.index({ isActive: 1 });
aboutSchema.index({ updatedAt: -1 });

const About = mongoose.model('About', aboutSchema);

export default About;