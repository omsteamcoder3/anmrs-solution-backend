import mongoose from 'mongoose';

const serviceSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  desc: {
    type: String,
    required: true
  },
  image: {
    type: String,
    default: ""
  },
  order: {
    type: Number,
    default: 0
  }
});

const sectionSettingsSchema = new mongoose.Schema({
  sectionTitle: {
    type: String,
    required: true
  },
  sectionMainTitle: {
    type: String,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
});

const whatWeOfferSchema = new mongoose.Schema({
  services: [serviceSchema],
  sectionSettings: {
    type: sectionSettingsSchema,
    required: true
  },
  version: {
    type: Number,
    default: 1
  }
}, {
  timestamps: true
});

whatWeOfferSchema.index({ updatedAt: -1 });

const WhatWeOffer = mongoose.model('WhatWeOffer', whatWeOfferSchema);

export default WhatWeOffer;