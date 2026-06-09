import mongoose from 'mongoose';

const mapAndLogoSchema = new mongoose.Schema({
  // Logo settings
  logo: {
    type: String,
    default: '',
  },
  logoAlt: {
    type: String,
    default: 'Company Logo',
  },
  logoLink: {
    type: String,
    default: '/',
  },
  
  // Map settings - just the embed URL
  mapEmbedUrl: {
    type: String,
    default: '',
  },
  
  // Status
  isActive: {
    type: Boolean,
    default: true,
  },
  
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, {
  timestamps: true,
});

// Singleton pattern - only one document
mapAndLogoSchema.statics.getSettings = async function() {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

const MapAndLogo = mongoose.model('MapAndLogo', mapAndLogoSchema);
export default MapAndLogo;