// controllers/ClientController.js
import Client from '../models/ClientModel.js';
import fs from 'fs';
import path from 'path';  
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get all clients
export const getAllClients = async (req, res) => {
  try {
    const clients = await Client.find().sort({ createdAt: -1 });
    res.json({ success: true, clients });
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get single client by ID
export const getClientById = async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }
    res.json({ success: true, client });
  } catch (error) {
    console.error('Error fetching client:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get client by slug
export const getClientBySlug = async (req, res) => {
  try {
    const client = await Client.findOne({ slug: req.params.slug });
    if (!client) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }
    res.json({ success: true, client });
  } catch (error) {
    console.error('Error fetching client:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create new client
export const createClient = async (req, res) => {
  try {
    const { name } = req.body;
    
    console.log('Request body:', req.body);
    console.log('Files:', req.files);
    
    // Validate name
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Client name is required' });
    }
    
    // Validate image
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'Image is required' });
    }
    
    const optimizedImage = req.files[0];
    console.log('Optimized image:', optimizedImage);
    
    // Check if client with same name already exists
    const existingClient = await Client.findOne({ 
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') } 
    });
    
    if (existingClient) {
      return res.status(400).json({ success: false, message: 'Client with this name already exists' });
    }
    
    // Create new client
    const client = new Client({
      name: name.trim(),
      imageUrl: `/uploads/${optimizedImage.filename}`,
      imageSize: optimizedImage.size
    });
    
    await client.save();
    
    res.json({ 
      success: true, 
      message: 'Client added successfully', 
      client 
    });
  } catch (error) {
    console.error('Error creating client:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update client
export const updateClient = async (req, res) => {
  try {
    const { name } = req.body;
    const clientId = req.params.id;
    
    // Validate name
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Client name is required' });
    }
    
    // Find existing client
    const client = await Client.findById(clientId);
    if (!client) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }
    
    // Check if new name conflicts with another client
    const existingClient = await Client.findOne({ 
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
      _id: { $ne: clientId }
    });
    
    if (existingClient) {
      return res.status(400).json({ success: false, message: 'Another client with this name already exists' });
    }
    
    // Update client name
    client.name = name.trim();
    
    // Update image if new one provided
    if (req.files && req.files.length > 0) {
      const optimizedImage = req.files[0];
      
      // Delete old image file if exists
      if (client.imageUrl) {
        const oldImagePath = path.join(process.cwd(), client.imageUrl);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
          console.log(`✅ Deleted old image: ${path.basename(oldImagePath)}`);
        }
      }
      
      client.imageUrl = `/uploads/${optimizedImage.filename}`;
      client.imageSize = optimizedImage.size;
    }
    
    await client.save();
    
    res.json({ 
      success: true, 
      message: 'Client updated successfully', 
      client 
    });
  } catch (error) {
    console.error('Error updating client:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete client
export const deleteClient = async (req, res) => {
  try {
    const client = await Client.findByIdAndDelete(req.params.id);
    
    if (!client) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }
    
    // Delete image file from uploads folder
    if (client.imageUrl) {
      const imagePath = path.join(process.cwd(), client.imageUrl);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
        console.log(`✅ Deleted image: ${path.basename(imagePath)}`);
      }
    }
    
    res.json({ 
      success: true, 
      message: 'Client deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting client:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete all clients (use with caution)
export const deleteAllClients = async (req, res) => {
  try {
    const clients = await Client.find();
    
    // Delete all image files
    for (const client of clients) {
      if (client.imageUrl) {
        const imagePath = path.join(process.cwd(), client.imageUrl);
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
          console.log(`✅ Deleted image: ${path.basename(imagePath)}`);
        }
      }
    }
    
    // Delete all clients from database
    await Client.deleteMany({});
    
    res.json({ 
      success: true, 
      message: 'All clients deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting all clients:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get clients count
export const getClientsCount = async (req, res) => {
  try {
    const count = await Client.countDocuments();
    res.json({ success: true, count });
  } catch (error) {
    console.error('Error getting clients count:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};