import DesignOrder from '../models/DesignOrder.js';
import User from '../models/UserModel.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import crypto from 'crypto';
import { promisify } from 'util';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads folder exists
const uploadDir = path.join(__dirname, '../uploads/designs/');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer to use memory storage instead of disk storage
// This prevents saving original files to disk at all
const memoryStorage = multer.memoryStorage();

// File filter for design files
const fileFilter = (req, file, cb) => {
  const allowedExt = ['.pdf', '.jpg', '.jpeg', '.png', '.ai', '.cdr'];
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedExt.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, JPG, PNG, AI, CDR files are allowed.'), false);
  }
};

// Configure multer with memory storage (no original files saved to disk)
const upload = multer({
  storage: memoryStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB per file
  }
}).fields([
  { name: 'designFile1', maxCount: 1 },
  { name: 'designFile2', maxCount: 1 }
]);

// Process and optimize files directly from memory (no temporary files)
const processAndOptimizeFiles = async (req, res, next) => {
  try {
    if (!req.files || Object.keys(req.files).length === 0) {
      return next();
    }

    const allFiles = [];
    if (req.files.designFile1) allFiles.push(...req.files.designFile1);
    if (req.files.designFile2) allFiles.push(...req.files.designFile2);

    const processedFiles = [];

    for (const file of allFiles) {
      const ext = path.extname(file.originalname).toLowerCase();
      
      // Process image files (JPG, JPEG, PNG) - convert to WebP
      if (['.jpg', '.jpeg', '.png'].includes(ext)) {
        try {
          const timestamp = Date.now();
          const randomString = crypto.randomBytes(4).toString('hex');
          const optimizedFilename = `${timestamp}-${randomString}.webp`;
          const optimizedPath = path.join(uploadDir, optimizedFilename);

          // Get image metadata from buffer
          const metadata = await sharp(file.buffer).metadata();
          console.log(`🖼️ Optimizing image: ${file.originalname}`);
          console.log(`   Original size: ${(file.size / 1024).toFixed(2)}KB`);

          // Calculate optimal dimensions for ID cards
          let targetWidth = Math.min(800, metadata.width);
          let targetHeight = Math.round((targetWidth / metadata.width) * metadata.height);
          
          if (targetHeight > 600) {
            targetHeight = 600;
            targetWidth = Math.round((targetHeight / metadata.height) * metadata.width);
          }

          // Convert to WebP directly from buffer and save
          await sharp(file.buffer)
            .resize(targetWidth, targetHeight, {
              fit: 'inside',
              withoutEnlargement: true
            })
            .webp({ 
              quality: 85,
              effort: 4,
              nearLossless: false
            })
            .toFile(optimizedPath);

          const optimizedStats = fs.statSync(optimizedPath);
          const savings = ((file.size - optimizedStats.size) / file.size * 100).toFixed(2);
          
          console.log(`   ✅ Optimized: ${optimizedFilename}`);
          console.log(`   New size: ${(optimizedStats.size / 1024).toFixed(2)}KB (${savings}% reduction)`);
          
          // Store ONLY optimized file info
          processedFiles.push({
            filename: optimizedFilename,
            filePath: optimizedPath,
            fileSize: optimizedStats.size,
            mimeType: 'image/webp',
            fileType: 'WEBP'
          });
          
        } catch (error) {
          console.error(`❌ Failed to optimize ${file.originalname}:`, error);
          // Skip this file
          continue;
        }
      } 
      // Process PDF files
      else if (ext === '.pdf') {
        try {
          const timestamp = Date.now();
          const randomString = crypto.randomBytes(4).toString('hex');
          const finalFilename = `${timestamp}-${randomString}.pdf`;
          const finalPath = path.join(uploadDir, finalFilename);
          
          // Save PDF directly from buffer
          fs.writeFileSync(finalPath, file.buffer);
          
          const fileStats = fs.statSync(finalPath);
          
          processedFiles.push({
            filename: finalFilename,
            filePath: finalPath,
            fileSize: fileStats.size,
            mimeType: 'application/pdf',
            fileType: 'PDF'
          });
          
          console.log(`📄 Saved PDF: ${finalFilename} (${(fileStats.size / 1024).toFixed(2)}KB)`);
          
        } catch (error) {
          console.error(`❌ Failed to save PDF ${file.originalname}:`, error);
          continue;
        }
      }
      // Process AI and CDR files
      else if (['.ai', '.cdr'].includes(ext)) {
        try {
          const timestamp = Date.now();
          const randomString = crypto.randomBytes(4).toString('hex');
          const finalFilename = `${timestamp}-${randomString}${ext}`;
          const finalPath = path.join(uploadDir, finalFilename);
          
          // Save AI/CDR directly from buffer
          fs.writeFileSync(finalPath, file.buffer);
          
          const fileStats = fs.statSync(finalPath);
          let fileType = ext.substring(1).toUpperCase();
          
          processedFiles.push({
            filename: finalFilename,
            filePath: finalPath,
            fileSize: fileStats.size,
            mimeType: file.mimetype,
            fileType: fileType
          });
          
          console.log(`🎨 Saved ${fileType} file: ${finalFilename} (${(fileStats.size / 1024).toFixed(2)}KB)`);
          
        } catch (error) {
          console.error(`❌ Failed to save ${file.originalname}:`, error);
          continue;
        }
      }
    }

    if (processedFiles.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid files could be processed. Please upload supported file types.'
      });
    }

    req.processedDesignFiles = processedFiles;
    next();
    
  } catch (err) {
    console.error('❌ File processing failed:', err);
    res.status(500).json({
      success: false,
      message: 'Error processing files',
      error: err.message
    });
  }
};

// Submit design order
export const submitDesignOrder = async (req, res) => {
  try {
    // First handle file upload (to memory)
    upload(req, res, async (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          message: err.message
        });
      }

      // Process and optimize files (no original files ever saved to disk)
      await processAndOptimizeFiles(req, res, async () => {
        
        // Get processed files
        const processedFiles = req.processedDesignFiles || [];

        if (processedFiles.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'Please upload at least one valid design file'
          });
        }

        const { 
          quantity, 
          size, 
          customWidth, 
          customHeight, 
          material, 
          cardHolderName,
          designation,
          companyName,
          specialInstructions,
          userId,
          userName,
          userEmail,
          userPhone
        } = req.body;

        // Find user
        const user = await User.findById(userId);
        if (!user) {
          // Delete uploaded files if user not found
          processedFiles.forEach(file => {
            if (file.filePath && fs.existsSync(file.filePath)) {
              try {
                fs.unlinkSync(file.filePath);
              } catch(e) { console.error('Cleanup error:', e); }
            }
          });
          return res.status(401).json({
            success: false,
            message: 'User not found. Please login again.',
            redirectToLogin: true
          });
        }

        // Create designFiles array with ONLY optimized file info
        const designFilesArray = processedFiles.map(file => ({
          fileName: file.filename,
          filePath: file.filePath,
          fileSize: file.fileSize,
          mimeType: file.mimeType,
          fileType: file.fileType
        }));

        // Handle size
        let sizeValue = size;
        let customSizeObj = null;

        if (size === 'Custom') {
          customSizeObj = {
            width: parseFloat(customWidth),
            height: parseFloat(customHeight),
            unit: 'mm'
          };
          sizeValue = 'Custom';
        }

        // Create design order
        const designOrder = new DesignOrder({
          user: user._id,
          userEmail: userEmail || user.email,
          userName: userName || user.name || user.email,
          userPhone: userPhone || user.phone || '',
          designFiles: designFilesArray,
          quantity: parseInt(quantity),
          size: sizeValue,
          customSize: customSizeObj,
          material: material,
          additionalText: {
            cardHolderName: cardHolderName || '',
            designation: designation || '',
            companyName: companyName || '',
            specialInstructions: specialInstructions || ''
          },
          status: 'pending',
          statusHistory: [{
            status: 'pending',
            timestamp: new Date(),
            comment: `Order submitted successfully with ${processedFiles.length} file(s)`
          }]
        });

        await designOrder.save();

        res.status(201).json({
          success: true,
          message: 'Design order submitted successfully',
          order: {
            orderNumber: designOrder.orderNumber,
            id: designOrder._id,
            status: designOrder.status,
            totalFiles: processedFiles.length
          }
        });
      });
    });
  } catch (error) {
    console.error('Submit design order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while submitting design order',
      error: error.message
    });
  }
};

// Get user's design orders
export const getUserDesignOrders = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const orders = await DesignOrder.find({ user: userId })
      .sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      orders: orders
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching orders',
      error: error.message
    });
  }
};

// Get single design order
export const getDesignOrderById = async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const order = await DesignOrder.findById(orderId);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    res.status(200).json({
      success: true,
      order: order
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching order',
      error: error.message
    });
  }
};

// Update order status
export const updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, comment } = req.body;
    
    const order = await DesignOrder.findById(orderId);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    order.status = status;
    order.statusHistory.push({
      status: status,
      timestamp: new Date(),
      comment: comment || `Status updated to ${status}`
    });
    
    if (status === 'approved') {
      order.approvedAt = new Date();
    }
    if (status === 'completed') {
      order.completedAt = new Date();
    }
    
    await order.save();
    
    res.status(200).json({
      success: true,
      message: 'Order status updated',
      order: order
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating order status',
      error: error.message
    });
  }
};

// Serve optimized images
export const getOptimizedImage = async (req, res) => {
  try {
    const { filename } = req.params;
    const imagePath = path.join(uploadDir, filename);
    
    if (!fs.existsSync(imagePath)) {
      return res.status(404).json({ error: 'Image not found' });
    }
    
    res.sendFile(imagePath);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};