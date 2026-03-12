import Product from '../models/productModel.js';
import Category from '../models/CategoryModel.js';
import slugify from 'slugify';
import path from 'path';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';

import fs from 'fs'; // ✅ ADDED for file deletion

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper function to delete image files
// Helper function to delete image files - FIXED version
const deleteImageFile = (imagePath) => {
  if (!imagePath) return false;

  try {
    console.log('🔍 Attempting to delete:', imagePath);

    // Get the absolute path to your uploads folder
    const uploadsFolder = path.join(process.cwd(), 'uploads');

    // Extract the filename correctly - KEEP THE FULL NAME with -2- or -3-
    let filename = '';

    if (imagePath.includes('/uploads/')) {
      // Split by /uploads/ and take the last part
      const parts = imagePath.split('/uploads/');
      filename = parts[parts.length - 1]; // Gets "1771417229932-3-images.webp"

      // Remove any leading/trailing slashes or spaces
      filename = filename.replace(/^[/\\]+|[/\\]+$/g, '');
    } else {
      // If no /uploads/ in path, just use basename
      filename = path.basename(imagePath);
    }

    // Build the EXACT file path
    const exactFilePath = path.join(uploadsFolder, filename);

    console.log(`   Looking for EXACT file: ${filename}`);
    console.log(`   Full path: ${exactFilePath}`);

    // Check if file exists at this exact location
    if (fs.existsSync(exactFilePath)) {
      fs.unlinkSync(exactFilePath);
      console.log(`   ✅ DELETED: ${filename}`);
      return true;
    } else {
      console.log(`   ❌ File not found: ${filename}`);

      // Debug: Show all files in folder for comparison
      if (fs.existsSync(uploadsFolder)) {
        const files = fs.readdirSync(uploadsFolder);
        console.log(`   Files in uploads folder (${files.length}):`);
        files.slice(0, 10).forEach(f => {
          const match = f === filename ? '← TARGET' : '';
          console.log(`      - ${f} ${match}`);
        });
      }

      return false;
    }
  } catch (error) {
    console.error('❌ Error deleting file:', error);
    return false;
  }
};


// productController.js - Updated createProduct function
// productController.js - Updated createProduct function with OG Image fix
export const createProduct = async (req, res) => {
  try {
    const {
      name,
      basePrice,
      description,
      category,
      rating,
      seller,
      stock,
      numberOfReviews,
      specifications,
      keyFeatures,
      variants,
        categoryAttributes,
      // ✅ SEO FIELDS HERE
      metaTitle,
      metaDescription,
      metaKeywords,
      canonicalUrl,
      ogTitle,
      ogDescription
      // ❌ REMOVED: ogImage from destructuring - will be handled from files
    } = req.body;

    console.log('📥 Received product data:', req.body);
    console.log('📁 Uploaded files:', req.files?.map(f => ({
      fieldname: f.fieldname,
      filename: f.filename,
      originalname: f.originalname
    })));

    // ✅ NEW: Offer System Variables (ADDED HERE)
    let finalBasePrice = parseFloat(basePrice);
    let finalOriginalPrice = parseFloat(basePrice);
    let finalDiscountPercentage = 0;
    let finalHasOffer = false;

    // ✅ LOGIC 1: If hasOffer is true but only basePrice is provided, calculate from originalPrice
    if (req.body.hasOffer === true || req.body.hasOffer === 'true') {
      // If user provides both originalPrice and basePrice, calculate discountPercentage
      if (req.body.originalPrice && req.body.basePrice) {
        const original = parseFloat(req.body.originalPrice);
        const base = parseFloat(req.body.basePrice);

        // Calculate discount percentage
        const discountAmount = original - base;
        const discountPercentage = (discountAmount / original) * 100;

        finalHasOffer = true;
        finalOriginalPrice = original;
        finalBasePrice = base;
        finalDiscountPercentage = Math.round(discountPercentage * 100) / 100; // Round to 2 decimals

        console.log('🎯 Offer calculated from both prices:', {
          originalPrice: finalOriginalPrice,
          basePrice: finalBasePrice,
          discountPercentage: finalDiscountPercentage + '%',
          discountAmount
        });
      }
      // ✅ LOGIC 2: If user provides originalPrice and discountPercentage
      else if (req.body.originalPrice && req.body.discountPercentage) {
        finalHasOffer = true;
        finalOriginalPrice = parseFloat(req.body.originalPrice);
        finalDiscountPercentage = parseFloat(req.body.discountPercentage);

        // Calculate discounted price
        const discountAmount = (finalOriginalPrice * finalDiscountPercentage) / 100;
        finalBasePrice = finalOriginalPrice - discountAmount;

        console.log('🎯 Offer Applied:', {
          originalPrice: finalOriginalPrice,
          discountPercentage: finalDiscountPercentage + '%',
          discountAmount,
          finalPrice: finalBasePrice
        });
      }
      // ✅ LOGIC 3: If user only provides basePrice with hasOffer true
      else if (req.body.basePrice && !req.body.originalPrice && !req.body.discountPercentage) {
        // Assume originalPrice is 25% higher than basePrice (you can adjust this)
        const assumedMarkup = 1.25; // 25% markup
        finalBasePrice = parseFloat(req.body.basePrice);
        finalOriginalPrice = finalBasePrice * assumedMarkup;

        // Calculate discount percentage: (1 - 1/1.25) * 100 = 20%
        finalDiscountPercentage = ((assumedMarkup - 1) / assumedMarkup) * 100;
        finalHasOffer = true;

        console.log('🎯 Offer auto-calculated with assumed markup:', {
          basePrice: finalBasePrice,
          assumedOriginalPrice: finalOriginalPrice,
          discountPercentage: finalDiscountPercentage + '%'
        });
      }
      // ✅ LOGIC 4: If hasOffer is true but no pricing data, set as no offer
      else {
        finalHasOffer = false;
        finalBasePrice = parseFloat(basePrice);
        finalOriginalPrice = finalBasePrice;
        finalDiscountPercentage = 0;

        console.log('⚠️ hasOffer is true but no pricing data provided. Setting hasOffer to false.');
      }
    }

    // ✅ Required field validation
    const missingFields = [];
    if (!name) missingFields.push('name');
    if (!basePrice) missingFields.push('basePrice');
    if (!description) missingFields.push('description');
    if (!seller) missingFields.push('seller');
    if (!category) missingFields.push('category');

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`,
        missingFields
      });
    }

    // ✅ Parse Specifications
    let parsedSpecifications = [];
    if (specifications) {
      parsedSpecifications = typeof specifications === 'string'
        ? JSON.parse(specifications)
        : specifications;
    }

    // ✅ Parse Key Features
    let parsedKeyFeatures = [];
    if (keyFeatures) {
      if (typeof keyFeatures === 'string') {
        try {
          parsedKeyFeatures = JSON.parse(keyFeatures);
        } catch (error) {
          parsedKeyFeatures = keyFeatures
            .split(',')
            .map(feature => feature.trim())
            .filter(feature => feature !== '');
        }
      } else if (Array.isArray(keyFeatures)) {
        parsedKeyFeatures = keyFeatures
          .map(feature => typeof feature === 'string' ? feature.trim() : feature)
          .filter(feature => feature && feature !== '');
      }
    }

    // ✅ Parse Meta Keywords if provided as string
    let parsedMetaKeywords = [];
    if (metaKeywords) {
      if (typeof metaKeywords === 'string') {
        try {
          parsedMetaKeywords = JSON.parse(metaKeywords);
        } catch (error) {
          // If it's a comma-separated string
          parsedMetaKeywords = metaKeywords
            .split(',')
            .map(keyword => keyword.trim())
            .filter(keyword => keyword !== '');
        }
      } else if (Array.isArray(metaKeywords)) {
        parsedMetaKeywords = metaKeywords.filter(keyword => keyword && keyword.trim() !== '');
      }
    }

    // ✅ Parse Variants with weight support
    let parsedVariants = [];
    if (variants) {
      try {
        parsedVariants = typeof variants === 'string'
          ? JSON.parse(variants)
          : variants;

        // Validate each variant
        parsedVariants = parsedVariants.map((variant, index) => ({
          variantName: variant.variantName || `Pack ${index + 1}`,
          price: parseFloat(variant.price) || parseFloat(basePrice),
          originalPrice: variant.originalPrice ? parseFloat(variant.originalPrice) : undefined,
          description: variant.description || '',
          // ✅ NEW: Weight and weightUnit
          weight: variant.weight ? parseFloat(variant.weight) : 0,
          weightUnit: variant.weightUnit || 'gram',
          stock: parseInt(variant.stock) || 0,
          images: variant.images || [], // Will be updated with actual images below
          sku: variant.sku || '',
          isDefault: variant.isDefault || (index === 0), // First variant is default
          status: variant.status || 'active',
          discountPercentage: variant.discountPercentage || 0,
          features: variant.features || []
        }));
      } catch (error) {
        console.error('❌ Error parsing variants:', error);
        parsedVariants = [];
      }
    }
  let parsedCategoryAttributes = {};
    if (categoryAttributes) {
      try {
        parsedCategoryAttributes = typeof categoryAttributes === 'string' 
          ? JSON.parse(categoryAttributes) 
          : categoryAttributes;
        console.log('📦 Parsed category attributes:', parsedCategoryAttributes);
      } catch (error) {
        console.error('❌ Error parsing categoryAttributes:', error);
      }
    }
    // ✅ Handle Main Images
    const mainImages = req.files
      ? req.files
        .filter(file => file.fieldname === 'images') // Only main product images
        .map(file => ({
          image: `/uploads/${file.filename}`
        }))
      : [];

    // ✅ Handle OG Image (Social Media Image) - FIXED
    let ogImagePath = null;
    if (req.files) {
      // Look for OG Image specifically
      const ogImageFile = req.files.find(file => file.fieldname === 'ogImage');
      if (ogImageFile) {
        ogImagePath = `/uploads/${ogImageFile.filename}`;
        console.log('✅ OG Image found and saved:', ogImagePath);
      } else if (req.body.ogImage && typeof req.body.ogImage === 'string' && req.body.ogImage.trim() !== '') {
        // If ogImage is provided as a URL string (not a file)
        ogImagePath = req.body.ogImage;
        console.log('✅ OG Image provided as URL:', ogImagePath);
      } else if (mainImages.length > 0) {
        // Fallback to first main image
        ogImagePath = mainImages[0].image;
        console.log('ℹ️ OG Image not provided, using first main image as fallback:', ogImagePath);
      } else {
        console.log('ℹ️ OG Image not provided and no main images available');
      }
    } else if (req.body.ogImage && typeof req.body.ogImage === 'string' && req.body.ogImage.trim() !== '') {
      // If no files uploaded but ogImage is provided as URL
      ogImagePath = req.body.ogImage;
      console.log('✅ OG Image provided as URL (no files uploaded):', ogImagePath);
    }

    // ✅ Handle Variant Images (NEW)
    const variantImagesMap = {};

    if (req.files && parsedVariants.length > 0) {
      req.files.forEach(file => {
        // Check if file is for variant (format: variants[0].images, variants[1].images, etc.)
        const variantMatch = file.fieldname.match(/variants\[(\d+)\]\.images/);
        if (variantMatch) {
          const variantIndex = parseInt(variantMatch[1]);

          if (!variantImagesMap[variantIndex]) {
            variantImagesMap[variantIndex] = [];
          }

          variantImagesMap[variantIndex].push({
            image: `/uploads/${file.filename}`
          });
        }
      });

      // Assign variant images to parsedVariants
      parsedVariants = parsedVariants.map((variant, index) => ({
        ...variant,
        images: variantImagesMap[index] || variant.images || []
      }));
    }

    // ✅ Calculate total stock from variants
    const totalStock = parsedVariants.length > 0
      ? parsedVariants.reduce((sum, variant) => sum + (variant.stock || 0), 0)
      : parseInt(stock) || 0;

    if (totalStock <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Total stock must be greater than 0'
      });
    }

    console.log('📊 Final product data:', {
      name,
      variantsCount: parsedVariants.length,
      variantImages: parsedVariants.map(v => v.images.length),
      mainImagesCount: mainImages.length,
      hasOffer: finalHasOffer,
      originalPrice: finalOriginalPrice,
      discountPercentage: finalDiscountPercentage,
      finalPrice: finalBasePrice,
      // ✅ SEO Data log
      metaTitle: metaTitle || '(not set)',
      metaDescriptionLength: metaDescription ? metaDescription.length : 0,
      metaKeywordsCount: parsedMetaKeywords.length,
      ogImagePath: ogImagePath || '(none)'
    });

    // ✅ CREATE PRODUCT with SEO fields
    const product = new Product({
      name,
      basePrice: finalBasePrice,  // ✅ Use calculated price
      originalPrice: finalOriginalPrice,  // ✅ NEW
      discountPercentage: finalDiscountPercentage,  // ✅ NEW
      hasOffer: finalHasOffer,  // ✅ NEW
      description,
      category: category || null,
      categoryAttributes: parsedCategoryAttributes,
      rating: rating || 0,
      seller,
      stock: totalStock,
      numberOfReviews: numberOfReviews || 0,
      specifications: parsedSpecifications,
      keyFeatures: parsedKeyFeatures,
      variants: parsedVariants,  // ✅ Store variants WITH images and weight
      images: mainImages,
      // ✅ SEO FIELDS
      metaTitle: metaTitle || '',
      metaDescription: metaDescription || '',
      metaKeywords: parsedMetaKeywords,
      canonicalUrl: canonicalUrl || '',
      ogTitle: ogTitle || '',
      ogDescription: ogDescription || '',
      ogImage: ogImagePath,  // ✅ Use the extracted ogImagePath
      status: 'active',
      featured: false
    });

    const savedProduct = await product.save();

    console.log('✅ Product created with variants:', {
      id: savedProduct._id,
      variantImages: savedProduct.variants.map(v => v.images.length),
      hasOffer: savedProduct.hasOffer,
      priceDetails: {
        original: savedProduct.originalPrice,
        discount: savedProduct.discountPercentage + '%',
        final: savedProduct.basePrice
      },
      // ✅ SEO Data saved
      seoSaved: {
        metaTitle: savedProduct.metaTitle ? 'Yes' : 'No',
        metaDescription: savedProduct.metaDescription ? 'Yes' : 'No',
        metaKeywords: savedProduct.metaKeywords?.length || 0,
        ogImage: savedProduct.ogImage ? 'Yes' : 'No'
      }
    });

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: savedProduct
    });

  } catch (error) {
    console.error('❌ Create Product Error:', error);

    let errorMessage = error.message;
    if (error.name === 'ValidationError') {
      errorMessage = Object.values(error.errors)
        .map(err => err.message)
        .join(', ');
    } else if (error.code === 11000) {
      if (error.keyPattern && error.keyPattern.slug) {
        errorMessage = 'A product with this name already exists.';
      } else if (error.keyPattern && error.keyPattern.sNo) {
        errorMessage = 'Serial number conflict.';
      } else if (error.keyPattern && error.keyPattern['variants.sku']) {
        errorMessage = 'Variant SKU already exists.';
      } else {
        errorMessage = 'Duplicate entry error.';
      }
    }

    res.status(400).json({
      success: false,
      message: errorMessage,
      errorType: error.name,
      errorCode: error.code
    });
  }
};

// ✅ Update Product function with variant support
// ✅ Update Product function with variant support and OG Image fix AND IMAGE DELETION
// ✅ UPDATE PRODUCT - Delete images when removed during edit
export const updateProduct = async (req, res) => {
  try {
    const id = req.params.id?.trim();
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or missing product ID.',
      });
    }

    const existingProduct = await Product.findById(id);
    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        message: 'Product not found.',
      });
    }

    // ✅ FIX: Handle stock field properly
    if (req.body.stock) {
      if (Array.isArray(req.body.stock)) {
        console.log('⚠️ Stock received as array:', req.body.stock);
        req.body.stock = parseInt(req.body.stock[0]) || 0;
      } else {
        req.body.stock = parseInt(req.body.stock);
      }
      console.log('✅ Processed stock value:', req.body.stock);
    }

    // ✅ TRACK IF ANY CHANGES WERE MADE TO IMAGES
    let imagesChanged = false;

// ✅ Handle deleted main images - ENHANCED DEBUG FOR MULTIPLE IMAGES
if (req.body.deletedMainImages) {
  try {
    let deletedImages = req.body.deletedMainImages;
    
    console.log('\n📥========== DELETED MAIN IMAGES DEBUG START ==========');
    console.log('📥 Raw deletedMainImages:', deletedImages);
    console.log('📥 Type of deletedMainImages:', typeof deletedImages);
    console.log('📥 Stringified:', JSON.stringify(deletedImages));

    // Parse the deleted images
    if (typeof deletedImages === 'string') {
      console.log('📥 Processing string input...');
      
      // First check if it's a JSON array string
      if (deletedImages.trim().startsWith('[') && deletedImages.trim().endsWith(']')) {
        try {
          deletedImages = JSON.parse(deletedImages);
          console.log('📦 Parsed as JSON array:', deletedImages);
        } catch (e) {
          console.log('⚠️ JSON parse failed, trying split method');
          // Split by comma and clean each item
          deletedImages = deletedImages.split(',').map(img => {
            return img.trim().replace(/^["']|["']$/g, '');
          });
          console.log('📦 After split and clean:', deletedImages);
        }
      } else {
        // Single image or comma-separated list
        deletedImages = deletedImages.split(',').map(img => {
          return img.trim().replace(/^["']|["']$/g, '');
        });
        console.log('📦 After split (comma-separated):', deletedImages);
      }
    }

    // Ensure it's an array
    if (!Array.isArray(deletedImages)) {
      console.log('⚠️ Converting to array (was not array)');
      deletedImages = [deletedImages];
    }

    // Filter out any empty strings
    deletedImages = deletedImages.filter(img => img && img.trim() !== '');
    
    console.log(`\n📦 FINAL DELETED IMAGES ARRAY (${deletedImages.length} images):`);
    console.log('   Index | Filename');
    console.log('   ------|--------');
    deletedImages.forEach((img, idx) => {
      console.log(`   [${idx}]   | "${img}" (length: ${img.length})`);
    });

    // 🔍 CHECK EACH IMAGE INDIVIDUALLY
    console.log('\n🔍========== CHECKING EACH IMAGE IN UPLOADS FOLDER ==========');
    
    const uploadsFolder = path.join(process.cwd(), 'uploads');
    console.log(`📁 Uploads folder path: ${uploadsFolder}`);
    
    if (fs.existsSync(uploadsFolder)) {
      const filesInFolder = fs.readdirSync(uploadsFolder);
      console.log(`📊 Total files in uploads folder: ${filesInFolder.length}`);
      
      // Show first 20 files for reference
      console.log('\n📋 Sample of files in folder (first 20):');
      filesInFolder.slice(0, 20).forEach((f, i) => {
        console.log(`   ${i+1}. "${f}"`);
      });
      
      if (filesInFolder.length > 20) {
        console.log(`   ... and ${filesInFolder.length - 20} more`);
      }
      
      console.log('\n🔎 CHECKING EACH DELETED IMAGE:');
      console.log('   ' + '='.repeat(60));
      
      deletedImages.forEach((filename, index) => {
        console.log(`\n   🔍 IMAGE ${index + 1}: "${filename}"`);
        console.log(`      Length: ${filename.length}`);
        console.log(`      Character codes: ${filename.split('').map(c => c.charCodeAt(0)).join(' ')}`);
        
        // Clean the filename for checking
        let cleanName = filename;
        
        // Remove surrounding quotes if present
        if ((cleanName.startsWith('"') && cleanName.endsWith('"')) || 
            (cleanName.startsWith("'") && cleanName.endsWith("'"))) {
          cleanName = cleanName.slice(1, -1);
          console.log(`      After removing quotes: "${cleanName}"`);
        }
        
        // Check for exact match
        const exactMatch = filesInFolder.find(f => f === cleanName);
        console.log(`      Exact match: ${exactMatch ? '✅ FOUND' : '❌ NOT FOUND'}`);
        
        if (exactMatch) {
          const filePath = path.join(uploadsFolder, exactMatch);
          const stats = fs.statSync(filePath);
          console.log(`      File size: ${stats.size} bytes (${(stats.size/1024).toFixed(2)}KB)`);
          console.log(`      Modified: ${stats.mtime}`);
        } else {
          // Try case-insensitive match
          const caseInsensitiveMatch = filesInFolder.find(f => 
            f.toLowerCase() === cleanName.toLowerCase()
          );
          console.log(`      Case-insensitive match: ${caseInsensitiveMatch ? '✅ FOUND' : '❌ NOT FOUND'}`);
          
          if (caseInsensitiveMatch) {
            console.log(`      Actual file: "${caseInsensitiveMatch}"`);
          }
          
          // Try without the random string part (check by timestamp)
          const timestamp = cleanName.split('-')[0];
          if (timestamp && timestamp.length > 10) {
            const timestampMatches = filesInFolder.filter(f => f.startsWith(timestamp));
            if (timestampMatches.length > 0) {
              console.log(`      Files with same timestamp (${timestamp}):`);
              timestampMatches.forEach(f => {
                const isMatch = f === cleanName ? '← EXACT TARGET' : '';
                console.log(`         - "${f}" ${isMatch}`);
              });
            }
          }
        }
      });
    } else {
      console.log(`❌ Uploads folder does NOT exist: ${uploadsFolder}`);
    }
    
    console.log('\n========== DELETED MAIN IMAGES DEBUG END ==========\n');

    // Clean up each image path to ensure consistent format for actual deletion
    deletedImages = deletedImages.map(img => {
      // Remove any quotes
      img = img.replace(/^["']|["']$/g, '');
      
      // Extract just the filename if it's a full path
      if (img.includes('/uploads/')) {
        const parts = img.split('/uploads/');
        img = parts[parts.length - 1];
      }
      
      // Remove any leading/trailing slashes or spaces
      img = img.replace(/^[/\\]+|[/\\]+$/g, '').trim();
      
      return img;
    });

    console.log('🧹 Cleaned filenames ready for deletion:', deletedImages);

    if (deletedImages.length > 0) {
      console.log('\n🗑️ ATTEMPTING TO DELETE FILES:');
      
      // DELETE each image from upload folder
      deletedImages.forEach((filename, idx) => {
        console.log(`\n   🗑️ [${idx}] Deleting: "${filename}"`);
        const deleted = deleteImageFile(filename);
        console.log(`      Result: ${deleted ? '✅ SUCCESS' : '❌ FAILED'}`);
      });

      // Filter out deleted images from the product
      const originalCount = existingProduct.images.length;
      console.log(`\n📸 Original product images (${originalCount}):`);
      existingProduct.images.forEach((img, i) => {
        console.log(`   [${i}] ${img.image}`);
      });

      existingProduct.images = existingProduct.images.filter(img => {
        let imageFilename = img.image;
        if (imageFilename.includes('/uploads/')) {
          const parts = imageFilename.split('/uploads/');
          imageFilename = parts[parts.length - 1];
        }
        
        // Clean the image filename for comparison
        imageFilename = imageFilename.replace(/^[/\\]+|[/\\]+$/g, '').trim();

        const shouldKeep = !deletedImages.includes(imageFilename);
        console.log(`   Image: "${img.image}" → filename: "${imageFilename}" → ${shouldKeep ? 'KEEP' : 'REMOVE'}`);
        return shouldKeep;
      });

      console.log(`\n📊 Main images after filtering: ${existingProduct.images.length}`);
      imagesChanged = true;
    }
  } catch (error) {
    console.error('❌ Error in deletedMainImages processing:', error);
  }
}

if (req.body.deletedVariantImages) {
  try {
    let deletedVariantImages = req.body.deletedVariantImages;
    
    console.log('\n📥========== DELETED VARIANT IMAGES DEBUG START ==========');
    console.log('📥 Raw deletedVariantImages:', deletedVariantImages);
    console.log('📥 Type of deletedVariantImages:', typeof deletedVariantImages);

    // Parse the deleted variant images
    if (typeof deletedVariantImages === 'string') {
      try {
        deletedVariantImages = JSON.parse(deletedVariantImages);
        console.log('📦 Parsed as JSON object:', deletedVariantImages);
      } catch (e) {
        console.log('⚠️ JSON parse failed for variant images');
        deletedVariantImages = {};
      }
    }

    // Process each variant's deleted images
    if (deletedVariantImages && typeof deletedVariantImages === 'object') {
      Object.entries(deletedVariantImages).forEach(([variantIndex, images]) => {
        const idx = parseInt(variantIndex);
        
        if (!Array.isArray(images)) {
          images = [images];
        }
        
        // Filter out empty strings
        images = images.filter(img => img && img.trim() !== '');
        
        console.log(`\n🔍 Processing variant ${idx} - ${images.length} images to delete:`);
        
        if (images.length === 0) return;
        
        // Clean up each image path
        const cleanedImages = images.map(img => {
          // Remove any quotes
          img = img.replace(/^["']|["']$/g, '');
          
          // Extract just the filename if it's a full path
          if (img.includes('/uploads/')) {
            const parts = img.split('/uploads/');
            img = parts[parts.length - 1];
          }
          
          // Remove any leading/trailing slashes or spaces
          img = img.replace(/^[/\\]+|[/\\]+$/g, '').trim();
          
          return img;
        });
        
        console.log(`🧹 Cleaned filenames for variant ${idx}:`, cleanedImages);
        
        // DELETE each image from upload folder
        cleanedImages.forEach((filename, imgIdx) => {
          console.log(`   🗑️ [${idx}:${imgIdx}] Deleting: "${filename}"`);
          const deleted = deleteImageFile(filename);
          console.log(`      Result: ${deleted ? '✅ SUCCESS' : '❌ FAILED'}`);
        });

        // Remove these images from the variant
        if (existingProduct.variants && existingProduct.variants[idx]) {
          const originalCount = existingProduct.variants[idx].images?.length || 0;
          
          if (originalCount > 0) {
            console.log(`\n📸 Original variant ${idx} images (${originalCount}):`);
            existingProduct.variants[idx].images.forEach((img, i) => {
              console.log(`   [${i}] ${img.image}`);
            });

            existingProduct.variants[idx].images = existingProduct.variants[idx].images.filter(img => {
              let imageFilename = img.image;
              if (imageFilename.includes('/uploads/')) {
                const parts = imageFilename.split('/uploads/');
                imageFilename = parts[parts.length - 1];
              }
              
              // Clean the image filename for comparison
              imageFilename = imageFilename.replace(/^[/\\]+|[/\\]+$/g, '').trim();
              
              // Check if this image should be kept (not in deleted list)
              const shouldKeep = !cleanedImages.includes(imageFilename);
              console.log(`   Image: "${img.image}" → filename: "${imageFilename}" → ${shouldKeep ? 'KEEP' : 'REMOVE'}`);
              return shouldKeep;
            });
            
            console.log(`   📊 Variant ${idx} images: ${originalCount} → ${existingProduct.variants[idx].images.length}`);
            imagesChanged = true;
          }
        }
      });
    }
    
    console.log('========== DELETED VARIANT IMAGES DEBUG END ==========\n');
    
  } catch (error) {
    console.error('❌ Error processing deletedVariantImages:', error);
  }
}
    // Add this after your other image deletion sections (around line 200-250)

    // ✅ Handle deleted OG image
    if (req.body.deletedOgImage) {
      try {
        let deletedOgImage = req.body.deletedOgImage;
        console.log('🗑️ Processing deleted OG image:', deletedOgImage);

        // Clean up the path
        if (typeof deletedOgImage === 'string') {
          // Remove any quotes
          deletedOgImage = deletedOgImage.replace(/^["']|["']$/g, '');

          // Ensure it has the correct format
          if (!deletedOgImage.startsWith('/uploads/') && !deletedOgImage.startsWith('http')) {
            deletedOgImage = `/uploads/${deletedOgImage}`;
          }

          // Only delete if it's a local file (not external URL)
          if (deletedOgImage.startsWith('/uploads/')) {
            console.log(`   Deleting OG image: ${deletedOgImage}`);
            deleteImageFile(deletedOgImage);

            // Clear the OG image from product
            existingProduct.ogImage = null;
            imagesChanged = true;
          }
        }
      } catch (error) {
        console.error('❌ Error processing deletedOgImage:', error);
      }
    }

    // Also update the OG Image handling when new file is uploaded:
    if (req.files && req.files.length > 0) {
      // Handle OG Image specifically
      const ogImageFile = req.files.find(file => file.fieldname === 'ogImage');
      if (ogImageFile) {
        // Delete old OG image if exists (AND it's a file, not URL)
        if (existingProduct.ogImage && existingProduct.ogImage.startsWith('/uploads/')) {
          console.log('🗑️ Deleting old OG image before update:', existingProduct.ogImage);
          deleteImageFile(existingProduct.ogImage);
        }
        existingProduct.ogImage = `/uploads/${ogImageFile.filename}`;
        console.log('✅ Updated OG Image from file:', existingProduct.ogImage);
      }
    }

    // If ogImage is provided as URL in body (not as file)
  // If ogImage is provided as URL in body (not as file)
// ✅ Handle OG Image update - ONLY update if actually changed
if (req.body.ogImage !== undefined) {
  
  // CASE 1: New OG image is empty/null - remove it
  if (!req.body.ogImage || req.body.ogImage.trim() === '') {
    if (existingProduct.ogImage && existingProduct.ogImage.startsWith('/uploads/')) {
      console.log('🗑️ Deleting OG image (removed by user):', existingProduct.ogImage);
      deleteImageFile(existingProduct.ogImage);
    }
    existingProduct.ogImage = null;
    console.log('✅ OG Image removed');
  }
  
  // CASE 2: New OG image is DIFFERENT from current
  else if (existingProduct.ogImage !== req.body.ogImage) {
    // Delete old OG image if it's a local file
    if (existingProduct.ogImage && existingProduct.ogImage.startsWith('/uploads/')) {
      console.log('🗑️ Deleting old OG image (replaced with new):', existingProduct.ogImage);
      deleteImageFile(existingProduct.ogImage);
    }
    existingProduct.ogImage = req.body.ogImage;
    console.log('✅ Updated OG Image to:', req.body.ogImage);
  }
  
  // CASE 3: Same OG image - do nothing
  else {
    console.log('⏭️ OG Image unchanged, keeping:', existingProduct.ogImage);
  }
}

    // ✅ Handle Offer Update
    if (req.body.hasOffer !== undefined) {
      if (req.body.hasOffer === 'true' || req.body.hasOffer === true) {
        if (req.body.originalPrice && req.body.basePrice) {
          const original = parseFloat(req.body.originalPrice);
          const base = parseFloat(req.body.basePrice);
          const discountPercentage = ((original - base) / original) * 100;

          existingProduct.basePrice = base;
          existingProduct.originalPrice = original;
          existingProduct.discountPercentage = Math.round(discountPercentage * 100) / 100;
          existingProduct.hasOffer = true;

          console.log('🎯 Update: Offer calculated from both prices');
        }
        else if (req.body.originalPrice && req.body.discountPercentage) {
          const originalPrice = parseFloat(req.body.originalPrice);
          const discountPercentage = parseFloat(req.body.discountPercentage);
          const discountAmount = (originalPrice * discountPercentage) / 100;

          existingProduct.basePrice = originalPrice - discountAmount;
          existingProduct.originalPrice = originalPrice;
          existingProduct.discountPercentage = discountPercentage;
          existingProduct.hasOffer = true;

          console.log('🎯 Update: Offer applied with discount');
        }
        else if (req.body.basePrice) {
          if (existingProduct.originalPrice && existingProduct.originalPrice !== existingProduct.basePrice) {
            const newBasePrice = parseFloat(req.body.basePrice);
            const discountPercentage = ((existingProduct.originalPrice - newBasePrice) / existingProduct.originalPrice) * 100;

            existingProduct.basePrice = newBasePrice;
            existingProduct.discountPercentage = Math.round(discountPercentage * 100) / 100;
            existingProduct.hasOffer = true;

            console.log('🎯 Update: Offer calculated from existing originalPrice');
          } else {
            const assumedMarkup = 1.25;
            const newBasePrice = parseFloat(req.body.basePrice);
            const assumedOriginalPrice = newBasePrice * assumedMarkup;
            const discountPercentage = ((assumedMarkup - 1) / assumedMarkup) * 100;

            existingProduct.basePrice = newBasePrice;
            existingProduct.originalPrice = assumedOriginalPrice;
            existingProduct.discountPercentage = discountPercentage;
            existingProduct.hasOffer = true;

            console.log('🎯 Update: Offer auto-calculated with assumed markup');
          }
        }
        else if (req.body.discountPercentage) {
          const discountPercentage = parseFloat(req.body.discountPercentage);
          const referencePrice = existingProduct.originalPrice || existingProduct.basePrice;
          const discountAmount = (referencePrice * discountPercentage) / 100;

          existingProduct.basePrice = referencePrice - discountAmount;
          existingProduct.originalPrice = referencePrice;
          existingProduct.discountPercentage = discountPercentage;
          existingProduct.hasOffer = true;

          console.log('🎯 Update: Offer applied with discount only');
        }
      } else {
        if (req.body.basePrice !== undefined) {
          existingProduct.basePrice = parseFloat(req.body.basePrice);
          existingProduct.originalPrice = existingProduct.basePrice;
          existingProduct.discountPercentage = 0;
          existingProduct.hasOffer = false;

          console.log('🔚 Update: Offer turned off, resetting prices');
        }
      }
    }

    // ✅ Handle new image uploads
    if (req.files && req.files.length > 0) {
      // Handle main images
      const newMainImages = req.files
        .filter(file => file.fieldname === 'images')
        .map(file => ({
          image: `/uploads/${file.filename}`
        }));

      if (newMainImages.length > 0) {
        existingProduct.images = [...existingProduct.images, ...newMainImages];
        imagesChanged = true;
        console.log(`✅ Added ${newMainImages.length} new main images`);
      }

      // Handle OG Image specifically
      const ogImageFile = req.files.find(file => file.fieldname === 'ogImage');
      if (ogImageFile) {
        // Delete old OG image if exists (AND it's a file, not URL)
        if (existingProduct.ogImage && existingProduct.ogImage.startsWith('/uploads/')) {
          deleteImageFile(existingProduct.ogImage);
        }
        existingProduct.ogImage = `/uploads/${ogImageFile.filename}`;
        console.log('✅ Updated OG Image from file:', existingProduct.ogImage);
      }

      // Handle variant images
      const variantImagesMap = {};
      req.files.forEach(file => {
        const variantMatch = file.fieldname.match(/variants\[(\d+)\]\.images/);
        if (variantMatch) {
          const variantIndex = parseInt(variantMatch[1]);
          if (!variantImagesMap[variantIndex]) {
            variantImagesMap[variantIndex] = [];
          }
          variantImagesMap[variantIndex].push({
            image: `/uploads/${file.filename}`
          });
        }
      });

      // Add variant images to existing variants
      if (Object.keys(variantImagesMap).length > 0) {
        Object.entries(variantImagesMap).forEach(([index, images]) => {
          const variantIdx = parseInt(index);
          if (existingProduct.variants[variantIdx]) {
            if (!existingProduct.variants[variantIdx].images) {
              existingProduct.variants[variantIdx].images = [];
            }
            existingProduct.variants[variantIdx].images = [
              ...existingProduct.variants[variantIdx].images,
              ...images
            ];
            imagesChanged = true;
          }
        });
        console.log('✅ Added variant images:', Object.keys(variantImagesMap).length);
      }
    }
if (req.body.categoryAttributes !== undefined) {
  let parsedCategoryAttributes = {};
  if (typeof req.body.categoryAttributes === 'string') {
    try {
      parsedCategoryAttributes = JSON.parse(req.body.categoryAttributes);
    } catch (error) {
      console.error('❌ Error parsing categoryAttributes:', error);
    }
  } else {
    parsedCategoryAttributes = req.body.categoryAttributes;
  }
  existingProduct.categoryAttributes = parsedCategoryAttributes;
  console.log('✅ Updated category attributes:', parsedCategoryAttributes);
}


    // ✅ Update other SEO fields if provided
    const seoTextFields = ['metaTitle', 'metaDescription', 'canonicalUrl', 'ogTitle', 'ogDescription'];
    seoTextFields.forEach(field => {
      if (req.body[field] !== undefined && req.body[field] !== null && req.body[field] !== '') {
        existingProduct[field] = req.body[field];
      }
    });

    // ✅ Update metaKeywords if provided 
    if (req.body.metaKeywords !== undefined) {
      let parsedKeywords = [];
      if (typeof req.body.metaKeywords === 'string') {
        try {
          parsedKeywords = JSON.parse(req.body.metaKeywords);
        } catch (error) {
          parsedKeywords = req.body.metaKeywords
            .split(',')
            .map(keyword => keyword.trim())
            .filter(keyword => keyword !== '');
        }
      } else if (Array.isArray(req.body.metaKeywords)) {
        parsedKeywords = req.body.metaKeywords.filter(keyword => keyword && keyword.trim() !== '');
      }
      existingProduct.metaKeywords = parsedKeywords;
    }

    // ✅ Handle variants update with weight support
    if (req.body.variants !== undefined) {
      let parsedVariants = req.body.variants;

      if (typeof parsedVariants === 'string') {
        try {
          parsedVariants = JSON.parse(parsedVariants);
        } catch (error) {
          console.error('❌ Error parsing variants:', error);
        }
      }

      if (Array.isArray(parsedVariants)) {
        // Preserve existing images for variants that weren't deleted
        existingProduct.variants = parsedVariants.map((variant, index) => {
          const existingVariant = existingProduct.variants[index] || {};
          return {
            ...variant,
            // Keep existing images that weren't deleted (already filtered above)
            images: existingVariant.images || [],
            // Ensure weight fields are properly set
            weight: variant.weight ? parseFloat(variant.weight) : 0,
            weightUnit: variant.weightUnit || 'gram',
            variantSlug: variant.variantSlug ||
              slugify(`${existingProduct.name} ${variant.variantName || `Pack ${index + 1}`}`, {
                lower: true,
                strict: true
              }) + `-${index + 1}`
          };
        });
        imagesChanged = true;
      }
    }

    // ✅ Update other fields
    for (const [key, value] of Object.entries(req.body)) {
     if (value !== undefined && value !== null && value !== '' &&
    key !== 'variants' && !seoTextFields.includes(key) &&
    key !== 'metaKeywords' && key !== 'ogImage' &&
    key !== 'deletedMainImages' && key !== 'deletedVariantImages' &&
    key !== 'categoryAttributes') { // Skip categoryAttributes here, we handled it above

        // Handle special fields
        if (key === 'specifications') {
          let parsedSpecifications = typeof value === 'string' ? JSON.parse(value) : value;
          existingProduct[key] = parsedSpecifications;
        } else if (key === 'keyFeatures') {
          let parsedKeyFeatures = [];
          if (typeof value === 'string') {
            try {
              parsedKeyFeatures = JSON.parse(value);
            } catch (error) {
              parsedKeyFeatures = value
                .split(',')
                .map(feature => feature.trim())
                .filter(feature => feature !== '');
            }
          } else if (Array.isArray(value)) {
            parsedKeyFeatures = value
              .map(feature => typeof feature === 'string' ? feature.trim() : feature)
              .filter(feature => feature && feature !== '');
          }
          existingProduct[key] = parsedKeyFeatures;
        } else if (key !== 'slug') {
          existingProduct[key] = value;
        }
      }
    }
if (req.body.categoryAttributes !== undefined) {
  let parsedCategoryAttributes = {};
  if (typeof req.body.categoryAttributes === 'string') {
    try {
      parsedCategoryAttributes = JSON.parse(req.body.categoryAttributes);
    } catch (error) {
      console.error('❌ Error parsing categoryAttributes:', error);
    }
  } else {
    parsedCategoryAttributes = req.body.categoryAttributes;
  }
  existingProduct.categoryAttributes = parsedCategoryAttributes;
  console.log('✅ Updated category attributes:', parsedCategoryAttributes);
}
    // ✅ Update slug if name changes
    if (req.body.name && req.body.name !== existingProduct.name) {
      existingProduct.name = req.body.name;
    }

    // ✅ CRITICAL: Save the product with all changes
    const updatedProduct = await existingProduct.save();

    console.log('✅ Product updated with image deletions:', {
      id: updatedProduct._id,
      mainImagesCount: updatedProduct.images?.length || 0,
      variantImages: updatedProduct.variants.map(v => v.images?.length || 0),
      imagesChanged: imagesChanged,
      hasOffer: updatedProduct.hasOffer,
      deletedMainCount: existingProduct.deletedMainCount || 0,
      deletedVariantCount: existingProduct.deletedVariantCount || 0
    });

    res.status(200).json({
      success: true,
      message: 'Product updated successfully.',
      data: updatedProduct,
    });

  } catch (error) {
    console.error('❌ Update Product Error:', error);

    let errorMessage = error.message;
    if (error.code === 11000) {
      if (error.keyPattern && error.keyPattern.slug) {
        errorMessage = 'A product with similar name already exists.';
      } else if (error.keyPattern && error.keyPattern['variants.sku']) {
        errorMessage = 'Variant SKU already exists.';
      }
    }

    res.status(500).json({
      success: false,
      message: errorMessage || 'Failed to update product.',
      errorCode: error.code
    });
  }
};

// ✅ DELETE PRODUCT - Delete ALL images from upload folder when product is deleted
export const deleteProduct = async (req, res) => {
  try {
    const id = req.params.id?.trim();

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID.',
      });
    }

    // First get the product to access its images
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found.',
      });
    }

    // ✅ Delete ALL product images from server BEFORE deleting from DB
    let deletedCount = 0;

    // Delete main images
    if (product.images && product.images.length > 0) {
      product.images.forEach(img => {
        if (deleteImageFile(img.image)) {
          deletedCount++;
        }
      });
      console.log(`🗑️ Deleted ${product.images.length} main images from upload folder`);
    }

    // Delete variant images
    if (product.variants && product.variants.length > 0) {
      let variantImageCount = 0;
      product.variants.forEach(variant => {
        if (variant.images && variant.images.length > 0) {
          variant.images.forEach(img => {
            if (deleteImageFile(img.image)) {
              variantImageCount++;
            }
          });
        }
      });
      deletedCount += variantImageCount;
      console.log(`🗑️ Deleted ${variantImageCount} variant images from upload folder`);
    }

    // Delete OG image if exists (and it's a file, not external URL)
    if (product.ogImage && product.ogImage.startsWith('/uploads/')) {
      if (deleteImageFile(product.ogImage)) {
        deletedCount++;
        console.log('🗑️ Deleted OG image from upload folder');
      }
    }

    // ✅ Now delete the product from database
    await Product.findByIdAndDelete(id);

    console.log(`✅ Total deleted: ${deletedCount} image files from upload folder`);
    console.log(`✅ Product deleted from database: ${id}`);

    res.status(200).json({
      success: true,
      message: `Product deleted successfully. Removed ${deletedCount} image files from server.`,
      deletedImages: deletedCount
    });

  } catch (error) {
    console.error('❌ Delete Product Error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


// ✅ Add this new function for handling variant images
export const uploadVariantImages = async (req, res) => {
  try {
    const { productId, variantIndex } = req.params;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No images uploaded'
      });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const index = parseInt(variantIndex);
    if (index < 0 || index >= product.variants.length) {
      return res.status(400).json({
        success: false,
        message: 'Invalid variant index'
      });
    }

    // Add images to variant
    const newImages = req.files.map(file => ({
      image: `/uploads/${file.filename}`
    }));

    if (!product.variants[index].images) {
      product.variants[index].images = [];
    }

    product.variants[index].images.push(...newImages);
    await product.save();

    res.status(200).json({
      success: true,
      message: 'Variant images uploaded successfully',
      data: product.variants[index]
    });

  } catch (error) {
    console.error('❌ Upload Variant Images Error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


// ✅ Get All Products
// ✅ Get All Products - UPDATED to handle hasOffer filter
export const getAllProducts = async (req, res) => {
  try {
    const {
      category,
      categorySlug,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      hasOffer // ✅ ADD THIS
    } = req.query;

    // Build filter object
    let filter = {};

    // ✅ Handle hasOffer filter (NEW)
    if (hasOffer !== undefined && hasOffer !== '') {
      if (hasOffer === 'true' || hasOffer === true) {
        filter.hasOffer = true;
        console.log('🎯 Filtering products with offers only');
      } else if (hasOffer === 'false' || hasOffer === false) {
        filter.hasOffer = false;
        console.log('🎯 Filtering products without offers');
      }
    }

    // ✅ Handle category filtering by slug
    const categoryFilter = categorySlug || category;

    if (categoryFilter && categoryFilter !== 'undefined' && categoryFilter !== 'all') {
      // Check if it's a valid ObjectId (for backward compatibility)
      if (mongoose.Types.ObjectId.isValid(categoryFilter)) {
        filter.category = categoryFilter;
      } else {
        // If it's a slug, find the category first
        const categoryDoc = await Category.findOne({
          slug: categoryFilter,
       
        });

        if (categoryDoc) {
          filter.category = categoryDoc._id;
        } else {
          // If category not found, return empty results
          return res.status(200).json({
            success: true,
            data: [],
            count: 0,
            message: 'No products found for this category'
          });
        }
      }
    }

    // Build sort configuration
    const sortConfig = {};

    // Handle different sort fields
    switch (sortBy) {
      case 'price':
      case 'rating':
      case 'createdAt':
      case 'name':
        sortConfig[sortBy] = sortOrder === 'desc' ? -1 : 1;
        break;
      default:
        sortConfig.createdAt = -1; // Default sort
    }

    console.log('🔍 Product filter:', filter);
    console.log('🔄 Sort config:', sortConfig);

    // ✅ REMOVED .select() to return all fields
    const products = await Product.find(filter)
      .populate('category', 'name slug')
      .sort(sortConfig);

    // ✅ Debug log to verify all fields are included
    if (products.length > 0) {
      console.log('📊 Sample product fields:', Object.keys(products[0].toObject()));
      console.log('📊 Has offer:', products[0].hasOffer); // ✅ Log offer status
      console.log('📊 Total products found:', products.length);
    }

    res.status(200).json({
      success: true,
      count: products.length,
      data: products,
    });
  } catch (error) {
    console.error(' Get all products error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ Get Product by ID
export const getProductById = async (req, res) => {
  try {
    const id = req.params.id?.trim();

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID.',
      });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found.',
      });
    }

    res.status(200).json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};



// ✅ Get Product by Slug
export const getProductBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const product = await Product.findOne({ slug })
      .populate('category', 'name slug');
    // Remove the .select() line - it's filtering out fields
    // .select('+metaTitle +metaDescription +metaKeywords +canonicalUrl +ogTitle +ogDescription +ogImage')

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found.',
      });
    }

    res.status(200).json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ Get featured products with price range filtering
export const getFeaturedProducts = async (req, res) => {
  try {
    const { priceRange, category, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    // Build filter object
    let filter = { featured: true, status: 'active' };

    // Add category filter if provided
    if (category && category !== 'all') {
      filter.category = category;
    }

    // Handle price range filtering
    let priceFilter = {};
    if (priceRange && priceRange !== 'all') {
      switch (priceRange) {
        case '100-200':
          priceFilter = { price: { $gte: 100, $lte: 200 } };
          break;
        case '200-300':
          priceFilter = { price: { $gte: 200, $lte: 300 } };
          break;
        case '300-400':
          priceFilter = { price: { $gte: 300, $lte: 400 } };
          break;
        case '400-500':
          priceFilter = { price: { $gte: 400, $lte: 500 } };
          break;
        case '500-600':
          priceFilter = { price: { $gte: 500, $lte: 600 } };
          break;
        case 'above-600':
          priceFilter = { price: { $gt: 600 } };
          break;
        default:
          priceFilter = {};
      }
    }

    // Combine filters
    const finalFilter = { ...filter, ...priceFilter };

    // Sort configuration
    const sortConfig = {};
    sortConfig[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query
    const products = await Product.find(finalFilter)
      .populate('category', 'name slug')
      .sort(sortConfig)
      .lean();

    res.status(200).json({
      success: true,
      count: products.length,
      data: products
    });

  } catch (error) {
    console.error('Featured products error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching featured products',
      error: error.message
    });
  }
};

// ✅ Get all available price ranges for featured products (for filter options)
export const getFeaturedPriceRanges = async (req, res) => {
  try {
    const priceRanges = await Product.aggregate([
      {
        $match: {
          featured: true,
          status: 'active',
          price: { $exists: true, $ne: null }
        }
      },
      {
        $bucket: {
          groupBy: "$price",
          boundaries: [0, 100, 200, 300, 400, 500, 600, Number.MAX_SAFE_INTEGER],
          default: "above-600",
          output: {
            count: { $sum: 1 },
            minPrice: { $min: "$price" },
            maxPrice: { $max: "$price" }
          }
        }
      },
      {
        $project: {
          _id: 0,
          range: {
            $switch: {
              branches: [
                { case: { $eq: ["$_id", 0] }, then: "under-100" },
                { case: { $eq: ["$_id", 100] }, then: "100-200" },
                { case: { $eq: ["$_id", 200] }, then: "200-300" },
                { case: { $eq: ["$_id", 300] }, then: "300-400" },
                { case: { $eq: ["$_id", 400] }, then: "400-500" },
                { case: { $eq: ["$_id", 500] }, then: "500-600" },
                { case: { $eq: ["$_id", 600] }, then: "above-600" }
              ],
              default: "above-600"
            }
          },
          count: 1,
          minPrice: 1,
          maxPrice: 1
        }
      },
      {
        $match: {
          count: { $gt: 0 }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: priceRanges
    });

  } catch (error) {
    console.error('Price ranges error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching price ranges',
      error: error.message
    });
  }
};

// ✅ Get featured products with multiple filters
export const getFilteredFeaturedProducts = async (req, res) => {
  try {
    const {
      priceRanges,
      categories,
      minPrice,
      maxPrice,
      page = 1,
      limit = 12,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build base filter
    let filter = { featured: true, status: 'active' };

    // Category filter
    if (categories && categories !== 'all') {
      const categoryArray = Array.isArray(categories) ? categories : [categories];
      filter.category = { $in: categoryArray };
    }

    // Price filter - multiple approaches
    let priceFilter = {};

    // Approach 1: Specific price ranges
    if (priceRanges && priceRanges !== 'all') {
      const rangeArray = Array.isArray(priceRanges) ? priceRanges : [priceRanges];
      const rangeConditions = [];

      rangeArray.forEach(range => {
        switch (range) {
          case '100-200':
            rangeConditions.push({ price: { $gte: 100, $lte: 200 } });
            break;
          case '200-300':
            rangeConditions.push({ price: { $gte: 200, $lte: 300 } });
            break;
          case '300-400':
            rangeConditions.push({ price: { $gte: 300, $lte: 400 } });
            break;
          case '400-500':
            rangeConditions.push({ price: { $gte: 400, $lte: 500 } });
            break;
          case '500-600':
            rangeConditions.push({ price: { $gte: 500, $lte: 600 } });
            break;
          case 'above-600':
            rangeConditions.push({ price: { $gt: 600 } });
            break;
        }
      });

      if (rangeConditions.length > 0) {
        priceFilter = { $or: rangeConditions };
      }
    }

    // Approach 2: Min/Max price range
    if (minPrice || maxPrice) {
      priceFilter = {};
      if (minPrice) priceFilter.$gte = parseInt(minPrice);
      if (maxPrice) priceFilter.$lte = parseInt(maxPrice);
      priceFilter = { price: priceFilter };
    }

    // Combine filters
    const finalFilter = priceFilter ? { ...filter, ...priceFilter } : filter;

    // Sort configuration
    const sortConfig = {};
    sortConfig[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query with pagination
    const [products, totalCount] = await Promise.all([
      Product.find(finalFilter)
        .populate('category', 'name slug')
        .sort(sortConfig)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Product.countDocuments(finalFilter)
    ]);

    res.status(200).json({
      success: true,
      data: products,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalProducts: totalCount,
        hasNext: skip + products.length < totalCount,
        hasPrev: parseInt(page) > 1
      }
    });

  } catch (error) {
    console.error('Filtered featured products error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching filtered featured products',
      error: error.message
    });
  }
};

// ✅ Search Products with multiple filters
export const searchProducts = async (req, res) => {
  try {
    const {
      search,
      category,
      categorySlug,
      minPrice,
      maxPrice,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = 1,
      limit = 12
    } = req.query;

    // Build filter object
    let filter = { status: 'active' };

    // ✅ Search by name or description
    if (search && search.trim() !== '') {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // ✅ Handle category filtering by slug
    const categoryFilter = categorySlug || category;

    if (categoryFilter && categoryFilter !== 'all' && categoryFilter !== 'undefined') {
      if (mongoose.Types.ObjectId.isValid(categoryFilter)) {
        filter.category = categoryFilter;
      } else {
        const categoryDoc = await Category.findOne({
          slug: categoryFilter,
        
        });

        if (categoryDoc) {
          filter.category = categoryDoc._id;
        }
      }
    }

    // Price range filter
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseFloat(minPrice);
      if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
    }

    // Sort configuration
    const sortConfig = {};
    sortConfig[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query
    const [products, totalCount] = await Promise.all([
      Product.find(filter)
        .populate('category', 'name slug')
        .sort(sortConfig)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Product.countDocuments(filter)
    ]);

    res.status(200).json({
      success: true,
      data: products,
      count: products.length,
      totalCount,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalProducts: totalCount,
        hasNext: skip + products.length < totalCount,
        hasPrev: parseInt(page) > 1
      }
    });

  } catch (error) {
    console.error('❌ Search Products Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error searching products',
      error: error.message
    });
  }
};

// ✅ Quick Search for Real-time Suggestions (for dropdown)
export const quickSearchProducts = async (req, res) => {
  try {
    const { q: searchQuery, limit = 5 } = req.query;

    console.log('🔍 Quick search query:', searchQuery);

    if (!searchQuery || searchQuery.trim() === '') {
      return res.status(200).json({
        success: true,
        data: [],
        message: 'Please enter a search term'
      });
    }

    // ✅ Search products by name
    const products = await Product.find({
      name: { $regex: searchQuery.trim(), $options: 'i' },
      status: 'active'
    })
      .select('name slug price images ogImage category featured')
      .populate('category', 'name slug')
      .limit(parseInt(limit))
      .lean();

    console.log('📦 Found products:', products.length);

    // Format the response for frontend
    const formattedProducts = products.map(product => {
      // Handle image URL
      let imageUrl = null;
      if (product.images && product.images.length > 0 && product.images[0].image) {
        imageUrl = product.images[0].image;
      } else if (product.ogImage) {
        imageUrl = product.ogImage;
      }

      return {
        _id: product._id,
        name: product.name,
        slug: product.slug,
        price: product.price,
        image: imageUrl,
        category: product.category?.name || 'Uncategorized',
        featured: product.featured || false
      };
    });

    res.status(200).json({
      success: true,
      data: formattedProducts,
      count: formattedProducts.length
    });

  } catch (error) {
    console.error('❌ Quick Search Products Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error searching products',
      error: error.message
    });
  }
};

// ✅ Get products with active offers
export const getOfferProducts = async (req, res) => {
  try {
    const {
      category,
      minDiscount = 0,
      maxDiscount = 100,
      limit = 20,
      sort = 'discount-desc' // discount-desc, price-asc, price-desc, new
    } = req.query;

    // Build filter
    const filter = {
      hasOffer: true,
      discountPercentage: {
        $gte: parseFloat(minDiscount),
        $lte: parseFloat(maxDiscount)
      },
      status: 'active'
    };

    // Add category filter
    if (category && category !== 'all') {
      if (mongoose.Types.ObjectId.isValid(category)) {
        filter.category = category;
      } else {
        const categoryDoc = await Category.findOne({ slug: category, status: 'active' });
        if (categoryDoc) {
          filter.category = categoryDoc._id;
        }
      }
    }

    // Build sort
    let sortConfig = {};
    switch (sort) {
      case 'discount-desc':
        sortConfig = { discountPercentage: -1 };
        break;
      case 'price-asc':
        sortConfig = { basePrice: 1 };
        break;
      case 'price-desc':
        sortConfig = { basePrice: -1 };
        break;
      case 'new':
        sortConfig = { createdAt: -1 };
        break;
      default:
        sortConfig = { discountPercentage: -1 };
    }

    const products = await Product.find(filter)
      .populate('category', 'name slug')
      .sort(sortConfig)
      .limit(parseInt(limit))
      .lean();

    // Format products
    const formattedProducts = products.map(product => ({
      ...product,
      savingsAmount: product.originalPrice - product.basePrice,
      hasOffer: true
    }));

    res.status(200).json({
      success: true,
      count: products.length,
      data: formattedProducts
    });

  } catch (error) {
    console.error('❌ Get Offer Products Error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};