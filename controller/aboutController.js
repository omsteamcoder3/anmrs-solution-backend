import About from '../models/aboutModel.js';

/**
 * Get about content (single document)
 * Returns the active about content or creates default if none exists
 */
export const getAboutContent = async (req, res) => {
  try {
    let aboutContent = await About.findOne({ isActive: true });
    
    // If no content exists, create default
    if (!aboutContent) {
      aboutContent = await About.create({});
    }
    
    res.status(200).json({
      success: true,
      data: aboutContent
    });
  } catch (error) {
    console.error('Error fetching about content:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching about content',
      error: error.message
    });
  }
};

/**
 * Create or update about content
 * Uses upsert to either update existing or create new
 */
export const updateAboutContent = async (req, res) => {
  try {
    const {
      mainTitle,
      badgeText,
      paragraph1,
      paragraph2,
      buttonText,
      buttonLink,
      mainImage,
      floatingImage,
      floatingBadgeText,
      metaTitle,
      metaDescription,
      isActive
    } = req.body;

    // Find and update, or create if doesn't exist
    const updatedContent = await About.findOneAndUpdate(
      { isActive: true },
      {
        mainTitle,
        badgeText,
        paragraph1,
        paragraph2,
        buttonText,
        buttonLink,
        mainImage,
        floatingImage,
        floatingBadgeText,
        metaTitle,
        metaDescription,
        isActive,
        $inc: { version: 1 } // Increment version for cache busting
      },
      {
        new: true, // Return updated document
        upsert: true, // Create if doesn't exist
        setDefaultsOnInsert: true // Apply schema defaults on insert
      }
    );

    res.status(200).json({
      success: true,
      message: 'About content updated successfully',
      data: updatedContent
    });
  } catch (error) {
    console.error('Error updating about content:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating about content',
      error: error.message
    });
  }
};

/**
 * Update specific field only (partial update)
 */
export const patchAboutContent = async (req, res) => {
  try {
    const updates = req.body;
    
    // Prevent updating createdAt and other protected fields
    delete updates.createdAt;
    delete updates.updatedAt;
    delete updates.__v;
    
    // Add version increment
    updates.$inc = { version: 1 };
    
    const updatedContent = await About.findOneAndUpdate(
      { isActive: true },
      updates,
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true
      }
    );

    res.status(200).json({
      success: true,
      message: 'About content patched successfully',
      data: updatedContent
    });
  } catch (error) {
    console.error('Error patching about content:', error);
    res.status(500).json({
      success: false,
      message: 'Error patching about content',
      error: error.message
    });
  }
};

/**
 * Upload main image (with optimization middleware)
 * This uses your existing multer and optimization setup
 */
export const uploadMainImage = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No image file uploaded'
      });
    }

    const uploadedFile = req.files[0];
    const imageUrl = `/uploads/${uploadedFile.filename}`;

    // Update database with new image URL
    const updatedContent = await About.findOneAndUpdate(
      { isActive: true },
      {
        mainImage: imageUrl,
        $inc: { version: 1 }
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true
      }
    );

    res.status(200).json({
      success: true,
      message: 'Main image uploaded successfully',
      data: {
        imageUrl: imageUrl,
        filename: uploadedFile.filename,
        size: uploadedFile.size,
        aboutContent: updatedContent
      }
    });
  } catch (error) {
    console.error('Error uploading main image:', error);
    res.status(500).json({
      success: false,
      message: 'Error uploading main image',
      error: error.message
    });
  }
};

/**
 * Upload floating image (with optimization middleware)
 */
export const uploadFloatingImage = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No image file uploaded'
      });
    }

    const uploadedFile = req.files[0];
    const imageUrl = `/uploads/${uploadedFile.filename}`;

    // Update database with new image URL
    const updatedContent = await About.findOneAndUpdate(
      { isActive: true },
      {
        floatingImage: imageUrl,
        $inc: { version: 1 }
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true
      }
    );

    res.status(200).json({
      success: true,
      message: 'Floating image uploaded successfully',
      data: {
        imageUrl: imageUrl,
        filename: uploadedFile.filename,
        size: uploadedFile.size,
        aboutContent: updatedContent
      }
    });
  } catch (error) {
    console.error('Error uploading floating image:', error);
    res.status(500).json({
      success: false,
      message: 'Error uploading floating image',
      error: error.message
    });
  }
};

/**
 * Reset to default content
 */
export const resetToDefault = async (req, res) => {
  try {
    // Delete all about documents
    await About.deleteMany({});
    
    // Create new default document
    const defaultContent = await About.create({});
    
    res.status(200).json({
      success: true,
      message: 'About content reset to default successfully',
      data: defaultContent
    });
  } catch (error) {
    console.error('Error resetting about content:', error);
    res.status(500).json({
      success: false,
      message: 'Error resetting about content',
      error: error.message
    });
  }
};

/**
 * Get about content version (for cache management)
 */
export const getAboutVersion = async (req, res) => {
  try {
    const aboutContent = await About.findOne({ isActive: true }).select('version updatedAt');
    
    res.status(200).json({
      success: true,
      data: {
        version: aboutContent?.version || 1,
        lastUpdated: aboutContent?.updatedAt || new Date()
      }
    });
  } catch (error) {
    console.error('Error fetching about version:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching about version',
      error: error.message
    });
  }
};
const fetchAboutContent = async () => {
  try {
    setLoading(true)
    setError(null)
    
    const API_URL = process.env.NEXT_PUBLIC_API_URL 
    // ✅ CHANGE THIS URL
    const response = await fetch(`${API_URL}/api/public/about`)
    
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`)
    }
    
    const data = await response.json()
    
    if (data.success && data.data) {
      setAboutData(data.data)
    } else {
      throw new Error('No data received from server')
    }
  } catch (error) {
    console.error('Error fetching about content:', error)
    setError(error instanceof Error ? error.message : 'Failed to load content')
    setAboutData(null)
  } finally {
    setLoading(false)
  }
}