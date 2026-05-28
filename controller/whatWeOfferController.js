import WhatWeOffer from '../models/whatWeOfferModel.js';

// Get what we offer content
export const getWhatWeOfferContent = async (req, res) => {
  try {
    const content = await WhatWeOffer.findOne();
    
    if (!content) {
      return res.status(404).json({
        success: false,
        message: 'No content found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: content
    });
  } catch (error) {
    console.error('Error fetching content:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching content',
      error: error.message
    });
  }
};

// Update what we offer content
// Update what we offer content
export const updateWhatWeOfferContent = async (req, res) => {
  try {
    const { services, sectionSettings } = req.body;
    
    console.log('Received update request:', JSON.stringify(req.body, null, 2));
    
    let content = await WhatWeOffer.findOne();
    
    if (!content) {
      console.log('No existing content found, creating new');
      content = new WhatWeOffer();
    }
    
    // Update fields
    if (services) {
      // Remove _id from services to avoid duplicate key errors
      const cleanedServices = services.map(service => {
        const { _id, ...cleanService } = service;
        return cleanService;
      });
      content.services = cleanedServices;
    }
    
    if (sectionSettings) {
      content.sectionSettings = sectionSettings;
    }
    
    content.version += 1;
    await content.save();
    
    console.log('Content saved successfully:', content);
    
    res.status(200).json({
      success: true,
      message: 'Content updated successfully',
      data: content
    });
  } catch (error) {
    console.error('Error updating content:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating content',
      error: error.message
    });
  }
};


// Upload service image
export const uploadServiceImage = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No image file uploaded'
      });
    }

    const uploadedFile = req.files[0];

    // SAVE ONLY RELATIVE PATH
    const imageUrl = `/uploads/${uploadedFile.filename}`;

    res.status(200).json({
      success: true,
      message: 'Image uploaded successfully',
      data: {
        imageUrl,
        filename: uploadedFile.filename
      }
    });

  } catch (error) {
    console.error('Error uploading image:', error);

    res.status(500).json({
      success: false,
      message: 'Error uploading image',
      error: error.message
    });
  }
};

// Delete service image
export const deleteServiceImage = async (req, res) => {
  try {
    const { imageUrl } = req.body;
    
    if (!imageUrl) {
      return res.status(400).json({
        success: false,
        message: 'Image URL is required'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Image deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting image:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting image',
      error: error.message
    });
  }
};