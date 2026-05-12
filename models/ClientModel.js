// models/ClientModel.js
import mongoose from 'mongoose';

const clientSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  slug: {
    type: String,
    unique: true,
    trim: true
  },
  imageUrl: {
    type: String,
    required: true
  },
  imageSize: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update timestamp on save
clientSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Create slug from name before saving
clientSchema.pre('save', function(next) {
  if (this.isModified('name')) {
    this.slug = this.name.toLowerCase().replace(/\s+/g, '-');
  }
  next();
});

const Client = mongoose.model('Client', clientSchema);

export default Client;