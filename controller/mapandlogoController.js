import MapAndLogo from '../models/MapAndLogo.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.join(__dirname, '../uploads');

// Ensure uploads directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// @desc    Get map and logo settings
// @route   GET /api/admin/map-logo
// @access  Private/Admin
export const getMapAndLogoSettings = async (req, res) => {
  try {
    let settings = await MapAndLogo.findOne();
    if (!settings) {
      settings = await MapAndLogo.create({});
    }
    
    res.status(200).json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('Error fetching map/logo settings:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Update map and logo settings
// @route   PUT /api/admin/map-logo
// @access  Private/Admin
export const updateMapAndLogoSettings = async (req, res) => {
  try {
    const {
      logoAlt,
      logoLink,
      mapEmbedUrl,
      isActive
    } = req.body;

    let settings = await MapAndLogo.findOne();
    if (!settings) {
      settings = new MapAndLogo();
    }

    // Update ALL fields including mapEmbedUrl
    settings.logoAlt = logoAlt !== undefined ? logoAlt : settings.logoAlt;
    settings.logoLink = logoLink !== undefined ? logoLink : settings.logoLink;
    settings.mapEmbedUrl = mapEmbedUrl !== undefined ? mapEmbedUrl : settings.mapEmbedUrl;
    settings.isActive = isActive !== undefined ? (isActive === 'true' || isActive === true) : settings.isActive;

    await settings.save();
    
    res.status(200).json({
      success: true,
      data: settings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
// @desc    Upload logo image
// @route   POST /api/admin/map-logo/upload/logo
// @access  Private/Admin
export const uploadLogo = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    let settings = await MapAndLogo.findOne();
    if (!settings) {
      settings = new MapAndLogo();
    }

    // Delete old logo if exists
    if (settings.logo && settings.logo !== '') {
      const oldFilePath = path.join(uploadDir, settings.logo);
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
        console.log(`✅ Deleted old logo: ${settings.logo}`);
      }
    }

    const file = req.files[0];
    settings.logo = file.filename;
    
    if (req.user && req.user._id) {
      settings.updatedBy = req.user._id;
    }
    
    await settings.save();
    
    res.status(200).json({
      success: true,
      message: 'Logo uploaded successfully',
      data: {
        imageUrl: file.filename
      }
    });
  } catch (error) {
    console.error('Error uploading logo:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Delete logo
// @route   DELETE /api/admin/map-logo/logo
// @access  Private/Admin
export const deleteLogo = async (req, res) => {
  try {
    let settings = await MapAndLogo.findOne();
    if (!settings) {
      return res.status(404).json({
        success: false,
        message: 'Settings not found'
      });
    }
    
    // Delete the file from uploads directory
    if (settings.logo && settings.logo !== '') {
      const filePath = path.join(uploadDir, settings.logo);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`✅ Deleted logo: ${settings.logo}`);
      }
      
      // Clear the field in database
      settings.logo = '';
      await settings.save();
    }
    
    res.status(200).json({
      success: true,
      message: 'Logo deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting logo:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get public settings
// @route   GET /api/public/map-logo
// @access  Public
export const getPublicMapAndLogoSettings = async (req, res) => {
  try {
    let settings = await MapAndLogo.findOne();
    if (!settings) {
      settings = await MapAndLogo.create({});
    }
    
    const publicData = {
      logo: settings.logo,
      logoAlt: settings.logoAlt,
      logoLink: settings.logoLink,
      mapEmbedUrl: settings.mapEmbedUrl,
      isActive: settings.isActive
    };
    
    res.status(200).json({
      success: true,
      data: publicData
    });
  } catch (error) {
    console.error('Error fetching public settings:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};