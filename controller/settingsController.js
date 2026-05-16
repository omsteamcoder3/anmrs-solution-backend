// controllers/settingsController.js
import Setting from '../models/Setting.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';

// Configure multer for file uploads
const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `${Date.now()}-${file.fieldname}${ext}`;
    cb(null, filename);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'image/gif'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

export const upload = multer({ 
  storage, 
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Middleware to handle file uploads for settings
export const handleFileUpload = upload.fields([
  { name: 'phonePeQrImage', maxCount: 1 },
  { name: 'googlePayQrImage', maxCount: 1 }
]);

// @desc    Get all settings
// @route   GET /api/admin/settings
// @access  Private/Admin
export const getSettings = async (req, res) => {
  try {
    const settings = await Setting.getSettings();
    
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

// @desc    Update settings (with file upload support)
// @route   PUT /api/admin/settings
// @access  Private/Admin
export const updateSettings = async (req, res) => {
  try {
    // Get text fields from req.body
    const {
      razorpayEnabled,
      razorpayKeyId,
      razorpayKeySecret,
      cashOnDeliveryEnabled,
      businessHours,
      // BANK ACCOUNT DETAILS
      bankName,
      accountHolderName,
      accountNumber,
      accountType,
      bankBranch,
      ifscCode,
      swiftCode,
      bankAddress,
      micrCode,
      upiId,
      
      // NEW DIGITAL PAYMENT FIELDS
      phonePeNumber,
      googlePayNumber,
      
      contactNumber,
      whatsappNumber,
      callNumber,
      contactEmail,
      companyAddress,
      siteName,
      siteTitle,
      siteDescription,
      footerText,
      footerLinks,
      facebookUrl,
      twitterUrl,
      instagramUrl,
      youtubeUrl,
      linkedinUrl,
      maintenanceMode,
      metaKeywords,
      googleAnalyticsId,
      
      // SCRIPT TAGS SECTION
      headerScripts,
      bodyScripts,
      footerScripts,
      
      // Shipping fields
      shippingInfo,
      orderProcessingTime,
      standardShippingDelivery,
      standardShippingCost,
      standardFreeShippingThreshold,
      expressShippingDelivery,
      expressShippingCost,
      expressFreeShippingThreshold,
      overnightShippingDelivery,
      overnightShippingCost,
      internationalShippingDelivery,
      internationalShippingNote,
      
      // Returns & Refunds Policy fields
      returnsPolicyTitle,
      returnsPolicyDescription,
      returnProcessSteps,
      returnTimeframe,
      returnConditions,
      customerShippingResponsibility,
      nonReturnableItems,
      defectiveItemsNote,
      refundProcessingTime,
      refundNote,
      refundAmountFormula,
      refundAmountDescription,
      exchangePolicy,
      
      // Privacy Policy fields
      privacyPolicyTitle,
      privacyPolicyLastUpdated,
      privacyPolicyEffectiveImmediately,
      privacyPolicyIntroduction,
      dataWeCollect,
      howWeUseInformation,
      privacyIntroductionSection,
      informationWeCollectSection,
      howWeUseInformationSection,
      dataSecuritySection,
      dataProtectionRightsSection,
      contactUsSection,
      dataProtectionRightsList,
      securityMeasuresSection,
      
      // Terms of Service fields
      termsOfServiceTitle,
      termsOfServiceLastUpdated,
      termsImportantNotice,
      termsUserRequirements,
      termsSections,
      termsIntellectualProperty,
      termsLimitationLiability,
      termsChangesNotice,
      termsContactInfo
    } = req.body;

    console.log('Received data:', req.body); // Debug log
    console.log('Received files:', req.files); // Debug log

    // Find existing settings or create new
    let settings = await Setting.findOne();
    
    if (!settings) {
      settings = new Setting();
    }

    // Update all text fields
    if (typeof razorpayEnabled !== 'undefined') {
      settings.razorpayEnabled = razorpayEnabled;
    }
    
    if (razorpayKeyId !== undefined) {
      settings.razorpayKeyId = razorpayKeyId;
    }
    
    if (razorpayKeySecret !== undefined) {
      settings.razorpayKeySecret = razorpayKeySecret;
    }
    
    if (typeof cashOnDeliveryEnabled !== 'undefined') {
      settings.cashOnDeliveryEnabled = cashOnDeliveryEnabled;
    }
    
    // Update BANK ACCOUNT DETAILS
    if (bankName !== undefined) settings.bankName = bankName;
    if (accountHolderName !== undefined) settings.accountHolderName = accountHolderName;
    if (accountNumber !== undefined) settings.accountNumber = accountNumber;
    if (accountType !== undefined) settings.accountType = accountType;
    if (bankBranch !== undefined) settings.bankBranch = bankBranch;
    if (ifscCode !== undefined) settings.ifscCode = ifscCode;
    if (swiftCode !== undefined) settings.swiftCode = swiftCode;
    if (bankAddress !== undefined) settings.bankAddress = bankAddress;
    if (micrCode !== undefined) settings.micrCode = micrCode;
    if (upiId !== undefined) settings.upiId = upiId;
    
    // UPDATE NEW DIGITAL PAYMENT FIELDS
    if (phonePeNumber !== undefined) settings.phonePeNumber = phonePeNumber;
    if (googlePayNumber !== undefined) settings.googlePayNumber = googlePayNumber;
    
    // Handle QR code file uploads
    if (req.files) {
      // PhonePe QR Code
      if (req.files.phonePeQrImage && req.files.phonePeQrImage[0]) {
        const phonePeFile = req.files.phonePeQrImage[0];
        settings.phonePeQrImage = phonePeFile.filename;
        console.log('PhonePe QR uploaded:', phonePeFile.filename);
      }
      
      // Google Pay QR Code
      if (req.files.googlePayQrImage && req.files.googlePayQrImage[0]) {
        const googlePayFile = req.files.googlePayQrImage[0];
        settings.googlePayQrImage = googlePayFile.filename;
        console.log('Google Pay QR uploaded:', googlePayFile.filename);
      }
    }
    
    // Also handle if QR image paths are sent as text (for deleting/replacing)
    if (req.body.phonePeQrImage !== undefined && !req.files?.phonePeQrImage) {
      settings.phonePeQrImage = req.body.phonePeQrImage;
    }
    
    if (req.body.googlePayQrImage !== undefined && !req.files?.googlePayQrImage) {
      settings.googlePayQrImage = req.body.googlePayQrImage;
    }
    
    // Update contact fields
    if (contactNumber !== undefined) settings.contactNumber = contactNumber;
    if (whatsappNumber !== undefined) settings.whatsappNumber = whatsappNumber;
    if (callNumber !== undefined) settings.callNumber = callNumber;
    if (contactEmail !== undefined) settings.contactEmail = contactEmail;
    if (companyAddress !== undefined) settings.companyAddress = companyAddress;
    if (businessHours !== undefined) settings.businessHours = businessHours;
    if (siteName !== undefined) settings.siteName = siteName;
    if (siteTitle !== undefined) settings.siteTitle = siteTitle;
    if (siteDescription !== undefined) settings.siteDescription = siteDescription;
    if (footerText !== undefined) settings.footerText = footerText;
    if (footerLinks !== undefined) settings.footerLinks = footerLinks;
    if (facebookUrl !== undefined) settings.facebookUrl = facebookUrl;
    if (twitterUrl !== undefined) settings.twitterUrl = twitterUrl;
    if (instagramUrl !== undefined) settings.instagramUrl = instagramUrl;
    if (youtubeUrl !== undefined) settings.youtubeUrl = youtubeUrl; 
    if (linkedinUrl !== undefined) settings.linkedinUrl = linkedinUrl;
    
    if (typeof maintenanceMode !== 'undefined') {
      settings.maintenanceMode = maintenanceMode;
    }
    
    if (metaKeywords !== undefined) settings.metaKeywords = metaKeywords;
    if (googleAnalyticsId !== undefined) settings.googleAnalyticsId = googleAnalyticsId;
    
    // Update SCRIPT TAGS SECTION
    if (headerScripts !== undefined) settings.headerScripts = headerScripts;
    if (bodyScripts !== undefined) settings.bodyScripts = bodyScripts;
    if (footerScripts !== undefined) settings.footerScripts = footerScripts;
    
    // Update shipping fields
    if (shippingInfo !== undefined) settings.shippingInfo = shippingInfo;
    if (orderProcessingTime !== undefined) settings.orderProcessingTime = orderProcessingTime;
    if (standardShippingDelivery !== undefined) settings.standardShippingDelivery = standardShippingDelivery;
    if (standardShippingCost !== undefined) settings.standardShippingCost = standardShippingCost;
    if (standardFreeShippingThreshold !== undefined) settings.standardFreeShippingThreshold = standardFreeShippingThreshold;
    if (expressShippingDelivery !== undefined) settings.expressShippingDelivery = expressShippingDelivery;
    if (expressShippingCost !== undefined) settings.expressShippingCost = expressShippingCost;
    if (expressFreeShippingThreshold !== undefined) settings.expressFreeShippingThreshold = expressFreeShippingThreshold;
    if (overnightShippingDelivery !== undefined) settings.overnightShippingDelivery = overnightShippingDelivery;
    if (overnightShippingCost !== undefined) settings.overnightShippingCost = overnightShippingCost;
    if (internationalShippingDelivery !== undefined) settings.internationalShippingDelivery = internationalShippingDelivery;
    if (internationalShippingNote !== undefined) settings.internationalShippingNote = internationalShippingNote;
    
    // Update returns policy fields
    if (returnsPolicyTitle !== undefined) settings.returnsPolicyTitle = returnsPolicyTitle;
    if (returnsPolicyDescription !== undefined) settings.returnsPolicyDescription = returnsPolicyDescription;
    if (returnProcessSteps !== undefined) settings.returnProcessSteps = returnProcessSteps;
    if (returnTimeframe !== undefined) settings.returnTimeframe = returnTimeframe;
    if (returnConditions !== undefined) settings.returnConditions = returnConditions;
    if (customerShippingResponsibility !== undefined) settings.customerShippingResponsibility = customerShippingResponsibility;
    if (nonReturnableItems !== undefined) settings.nonReturnableItems = nonReturnableItems;
    if (defectiveItemsNote !== undefined) settings.defectiveItemsNote = defectiveItemsNote;
    if (refundProcessingTime !== undefined) settings.refundProcessingTime = refundProcessingTime;
    if (refundNote !== undefined) settings.refundNote = refundNote;
    if (refundAmountFormula !== undefined) settings.refundAmountFormula = refundAmountFormula;
    if (refundAmountDescription !== undefined) settings.refundAmountDescription = refundAmountDescription;
    if (exchangePolicy !== undefined) settings.exchangePolicy = exchangePolicy;
    
    // Update privacy policy fields
    if (privacyPolicyTitle !== undefined) settings.privacyPolicyTitle = privacyPolicyTitle;
    if (privacyPolicyLastUpdated !== undefined) settings.privacyPolicyLastUpdated = privacyPolicyLastUpdated;
    if (typeof privacyPolicyEffectiveImmediately !== 'undefined') {
      settings.privacyPolicyEffectiveImmediately = privacyPolicyEffectiveImmediately;
    }
    if (privacyPolicyIntroduction !== undefined) settings.privacyPolicyIntroduction = privacyPolicyIntroduction;
    if (dataWeCollect !== undefined) settings.dataWeCollect = dataWeCollect;
    if (howWeUseInformation !== undefined) settings.howWeUseInformation = howWeUseInformation;
    if (privacyIntroductionSection !== undefined) settings.privacyIntroductionSection = privacyIntroductionSection;
    if (informationWeCollectSection !== undefined) settings.informationWeCollectSection = informationWeCollectSection;
    if (howWeUseInformationSection !== undefined) settings.howWeUseInformationSection = howWeUseInformationSection;
    if (dataSecuritySection !== undefined) settings.dataSecuritySection = dataSecuritySection;
    if (dataProtectionRightsSection !== undefined) settings.dataProtectionRightsSection = dataProtectionRightsSection;
    if (contactUsSection !== undefined) settings.contactUsSection = contactUsSection;
    if (dataProtectionRightsList !== undefined) settings.dataProtectionRightsList = dataProtectionRightsList;
    if (securityMeasuresSection !== undefined) settings.securityMeasuresSection = securityMeasuresSection;
    
    // Update terms of service fields
    if (termsOfServiceTitle !== undefined) settings.termsOfServiceTitle = termsOfServiceTitle;
    if (termsOfServiceLastUpdated !== undefined) settings.termsOfServiceLastUpdated = termsOfServiceLastUpdated;
    if (termsImportantNotice !== undefined) settings.termsImportantNotice = termsImportantNotice;
    if (termsUserRequirements !== undefined) settings.termsUserRequirements = termsUserRequirements;
    if (termsSections !== undefined) settings.termsSections = termsSections;
    if (termsIntellectualProperty !== undefined) settings.termsIntellectualProperty = termsIntellectualProperty;
    if (termsLimitationLiability !== undefined) settings.termsLimitationLiability = termsLimitationLiability;
    if (termsChangesNotice !== undefined) settings.termsChangesNotice = termsChangesNotice;
    if (termsContactInfo !== undefined) settings.termsContactInfo = termsContactInfo;
    
    // Track who updated
    if (req.user && req.user._id) {
      settings.updatedBy = req.user._id;
    }
    settings.updatedAt = Date.now();

    console.log('Saving settings:', settings); // Debug log
    
    await settings.save();

    res.status(200).json({
      success: true,
      message: 'Settings updated successfully',
      data: settings
    });
  } catch (error) {
    console.error('Error updating settings:', error); // Debug log
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get public settings (for frontend)
// @route   GET /api/settings/public
// @access  Public
export const getPublicSettings = async (req, res) => {
  try {
    const publicSettings = await Setting.getPublicSettings();
    
    res.status(200).json({
      success: true,
      data: publicSettings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
// controllers/settingsController.js - Add these functions

// @desc    Delete QR code
// @route   DELETE /api/admin/settings/qr-code/:type
// @access  Private/Admin
export const deleteQrCode = async (req, res) => {
  try {
    const { type } = req.params; // 'phonePeQrImage' or 'googlePayQrImage'
    
    const settings = await Setting.findOne();
    if (!settings) {
      return res.status(404).json({
        success: false,
        message: 'Settings not found'
      });
    }
    
    // Delete the file from uploads directory
    if (settings[type]) {
      const filePath = path.join(uploadDir, settings[type]);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      
      // Clear the field in database
      settings[type] = '';
      await settings.save();
    }
    
    res.status(200).json({
      success: true,
      message: `${type.replace('QrImage', '')} QR code deleted successfully`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Upload QR code
// @route   POST /api/admin/settings/qr-code/:type
// @access  Private/Admin
export const uploadQrCode = async (req, res) => {
  try {
    const { type } = req.params; // 'phonePeQrImage' or 'googlePayQrImage'
    
    if (!req.files || !req.files[type]) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }
    
    const settings = await Setting.findOne();
    if (!settings) {
      return res.status(404).json({
        success: false,
        message: 'Settings not found'
      });
    }
    
    // Delete old file if exists
    if (settings[type]) {
      const oldFilePath = path.join(uploadDir, settings[type]);
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
      }
    }
    
    // Save new file
    const file = req.files[type][0];
    settings[type] = file.filename;
    
    // Track who updated
    if (req.user && req.user._id) {
      settings.updatedBy = req.user._id;
    }
    settings.updatedAt = Date.now();
    
    await settings.save();
    
    res.status(200).json({
      success: true,
      message: `${type.replace('QrImage', '')} QR code uploaded successfully`,
      data: {
        [type]: file.filename
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};