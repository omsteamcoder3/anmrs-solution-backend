// controllers/categoryController.js
import Category from '../models/CategoryModel.js';
import Product from '../models/productModel.js';
import slugify from 'slugify';
import mongoose from 'mongoose';
import asyncHandler from 'express-async-handler';

// ✅ Create Category
export const createCategory = async (req, res) => {
    try {
        const { name,description, fields } = req.body;

        if (!name) {
            return res.status(400).json({
                success: false,
                message: 'Category name is required'
            });
        }

        // Generate slug from name
        const slug = slugify(name, { lower: true, strict: true });

        // Check if category already exists
        const existingCategory = await Category.findOne({ 
            $or: [
                { name: name.trim() },
                { slug }
            ]
        });

        if (existingCategory) {
            return res.status(400).json({
                success: false,
                message: 'Category with this name already exists'
            });
        }

        // Validate and format fields
        const formattedFields = fields ? fields
            .filter(f => f.label && f.label.trim())
            .map(f => ({
                label: f.label.trim(),
                type: f.type || 'text',
                unit: f.type === 'number' ? (f.unit || '') : '',
                options: f.type === 'select' 
                    ? (Array.isArray(f.options) ? f.options : [])
                    : []
            })) : [];

        const category = new Category({
            name: name.trim(),
            slug,
            description,
            fields: formattedFields
        });

        const savedCategory = await category.save();

        res.status(201).json({
            success: true,
            message: 'Category created successfully',
            data: savedCategory
        });
    } catch (error) {
        console.error('❌ Create Category Error:', error);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// ✅ Get All Categories
export const getAllCategories = async (req, res) => {
    try {
        const categories = await Category.find({})
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: categories.length,
            data: categories
        });
    } catch (error) {
        console.error('❌ Get Categories Error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// ✅ Get Category by Slug
export const getCategoryBySlug = async (req, res) => {
    try {
        const { slug } = req.params;
        
        const category = await Category.findOne({ slug });

        if (!category) {
            return res.status(404).json({
                success: false,
                message: 'Category not found'
            });
        }

        res.status(200).json({
            success: true,
            data: category
        });
    } catch (error) {
        console.error('❌ Get Category Error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// ✅ Update Category
export const updateCategory = async (req, res) => {
    try {
        const { slug } = req.params;
        const { name,description, fields } = req.body;

        const category = await Category.findOne({ slug });
        if (!category) {
            return res.status(404).json({
                success: false,
                message: 'Category not found'
            });
        }

        // If name is being updated, check for duplicates
        if (name && name !== category.name) {
            const newSlug = slugify(name, { lower: true, strict: true });
            const existingCategory = await Category.findOne({
                $and: [
                    { slug: { $ne: slug } },
                    { 
                        $or: [
                            { name: name.trim() },
                            { slug: newSlug }
                        ]
                    }
                ]
            });

            if (existingCategory) {
                return res.status(400).json({
                    success: false,
                    message: 'Category with this name already exists'
                });
            }

            // Update name and slug
            category.name = name.trim();
            category.slug = newSlug;
        }
   if (description !== undefined) {
            category.description = description; // ✅ update
        }

        // Update fields if provided
        if (fields) {
            const formattedFields = fields
                .filter(f => f.label && f.label.trim())
                .map(f => ({
                    label: f.label.trim(),
                    type: f.type || 'text',
                    unit: f.type === 'number' ? (f.unit || '') : '',
                    options: f.type === 'select' 
                        ? (Array.isArray(f.options) ? f.options : [])
                        : []
                }));
            
            category.fields = formattedFields;
        }

        const updatedCategory = await category.save();

        res.status(200).json({
            success: true,
            message: 'Category updated successfully',
            data: updatedCategory
        });
    } catch (error) {
        console.error('❌ Update Category Error:', error);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// ✅ Delete Category
export const deleteCategory = async (req, res) => {
    try {
        const { slug } = req.params;

        const category = await Category.findOne({ slug });
        if (!category) {
            return res.status(404).json({
                success: false,
                message: 'Category not found'
            });
        }

        // Check if category has products
        const productsCount = await Product.countDocuments({ category: category._id });
        if (productsCount > 0) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete category with associated products. Please reassign or delete products first.'
            });
        }

        await Category.findByIdAndDelete(category._id);

        res.status(200).json({
            success: true,
            message: 'Category deleted successfully'
        });
    } catch (error) {
        console.error('❌ Delete Category Error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// ✅ Get Category Products
export const getCategoryProducts = async (req, res) => {
    try {
        const { slug } = req.params;
        const { page = 1, limit = 12, sort = '-createdAt' } = req.query;

        const category = await Category.findOne({ slug });

        if (!category) {
            return res.status(404).json({
                success: false,
                message: 'Category not found'
            });
        }

        const products = await Product.find({ 
            category: category._id,
            status: 'active'
        })
        .populate('category', 'name slug fields')
        .sort(sort)
        .limit(limit * 1)
        .skip((page - 1) * limit);

        const total = await Product.countDocuments({ 
            category: category._id,
            status: 'active'
        });

        res.status(200).json({
            success: true,
            data: {
                category,
                products,
                pagination: {
                    current: parseInt(page),
                    pages: Math.ceil(total / limit),
                    total
                }
            }
        });
    } catch (error) {
        console.error('❌ Get Category Products Error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// ✅ Get Categories with Field Information
export const getCategoriesWithFields = async (req, res) => {
    try {
        const categories = await Category.find({})
            .select('name slug fields createdAt updatedAt')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: categories.length,
            data: categories
        });
    } catch (error) {
        console.error('❌ Get Categories With Fields Error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// ✅ Get Category Fields Only
export const getCategoryFields = async (req, res) => {
    try {
        const { slug } = req.params;
        
        const category = await Category.findOne({ slug }).select('fields');

        if (!category) {
            return res.status(404).json({
                success: false,
                message: 'Category not found'
            });
        }

        res.status(200).json({
            success: true,
            data: category.fields
        });
    } catch (error) {
        console.error('❌ Get Category Fields Error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};