import nodemailer from 'nodemailer';

// Create email transporter (reuse existing configuration)
const createTransporter = () => {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('⚠️ SMTP configuration missing.');
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
};

// Format date helper
const formatDate = (date) => {
  if (!date) return 'Not specified';
  return new Date(date).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
};

const formatDateWithTime = (date) => {
  if (!date) return 'Not specified';
  return new Date(date).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// ============================================
// EMAIL TEMPLATES FOR DESIGN ORDERS
// ============================================

const templates = {
  // Template 1: Order Processing Started
  processingStarted: (order, expectedDate, companySettings) => ({
    subject: `🎨 Your Design Order #${order.orderNumber} is Being Processed`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
        <div style="background: linear-gradient(135deg, #f97316, #ea580c); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">🎨 Order Processing Started!</h1>
          <p style="color: #fed7aa; margin-top: 8px;">Your custom design is now in production</p>
        </div>
        <div style="padding: 30px;">
          <p>Dear <strong>${order.userName}</strong>,</p>
          <p>Great news! Our team has reviewed your design and started working on your order.</p>
          
          <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; color: #92400e;"><strong>📅 Expected Completion Date:</strong> ${formatDate(expectedDate)}</p>
          </div>
          
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr><td style="padding: 8px 0;"><strong>Order ID:</strong></td><td>#${order.orderNumber}</td></tr>
            <tr><td style="padding: 8px 0;"><strong>Quantity:</strong></td><td>${order.quantity} cards</td></tr>
            <tr><td style="padding: 8px 0;"><strong>Material:</strong></td><td>${order.material}</td></tr>
          </table>
          
          <a href="${process.env.FRONTEND_URL}/order-tracking/${order._id}" style="display: inline-block; background: #f97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px;">Track Your Order</a>
        </div>
      </div>
    `
  }),

  // Template 2: Ready for Pickup - UPDATED with company address and phone
  readyForPickup: (order, companySettings) => ({
    subject: `📦 Your Design Order #${order.orderNumber} is Ready for Pickup!`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
        <div style="background: linear-gradient(135deg, #10b981, #059669); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">📦 Order Ready for Pickup!</h1>
          <p style="color: #d1fae5; margin-top: 8px;">Your custom design order is ready</p>
        </div>
        <div style="padding: 30px;">
          <p>Dear <strong>${order.userName}</strong>,</p>
          <p>Great news! Your order is now complete and ready for pickup at our office.</p>
          
          <div style="background: #d1fae5; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0 0 8px 0;"><strong>📍 Pickup Address:</strong></p>
            <p style="margin: 0 0 4px 0; color: #065f46;">${companySettings?.companyAddress || 'Please contact us for pickup address'}</p>
            ${companySettings?.contactNumber ? `<p style="margin: 4px 0 0 0; color: #065f46;"><strong>📞 Phone:</strong> ${companySettings.contactNumber}</p>` : ''}
            ${companySettings?.businessHours ? `<p style="margin: 4px 0 0 0; color: #065f46;"><strong>⏰ Business Hours:</strong> ${companySettings.businessHours}</p>` : ''}
          </div>
          
          <div style="background: #fef3c7; padding: 12px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; color: #92400e;">⚠️ Please bring your order ID (${order.orderNumber}) for verification.</p>
          </div>
          
          <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 4px 0;"><strong>Order ID:</strong></td><td style="padding: 4px 0; text-align: right;">#${order.orderNumber}</td></tr>
              <tr><td style="padding: 4px 0;"><strong>Quantity:</strong></td><td style="padding: 4px 0; text-align: right;">${order.quantity} cards</td></tr>
              <tr><td style="padding: 4px 0;"><strong>Material:</strong></td><td style="padding: 4px 0; text-align: right;">${order.material}</td></tr>
            </table>
          </div>
          
          <a href="${process.env.FRONTEND_URL}/order-tracking/${order._id}" style="display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px;">View Order Details</a>
          
          <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 20px; text-align: center;">
            <p style="color: #9ca3af; font-size: 11px;">Thank you for choosing ${companySettings?.siteName || 'ANMRS IT Solutions'}!</p>
          </div>
        </div>
      </div>
    `
  }),

  // Template 3: Out for Delivery
  outForDelivery: (order, deliveryDateTime) => ({
    subject: `🚚 Your Design Order #${order.orderNumber} is Out for Delivery!`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
        <div style="background: linear-gradient(135deg, #3b82f6, #2563eb); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">🚚 Order Out for Delivery!</h1>
          <p style="color: #bfdbfe; margin-top: 8px;">Your package is on its way</p>
        </div>
        <div style="padding: 30px;">
          <p>Dear <strong>${order.userName}</strong>,</p>
          <p>Great news! Your order has been dispatched and is out for delivery!</p>
          
          <div style="background: #dbeafe; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p><strong>📅 Delivery Date & Time:</strong> ${formatDateWithTime(deliveryDateTime)}</p>
            ${order.deliveryAddress ? `<p><strong>📍 Delivery Address:</strong><br>${order.deliveryAddress.street}, ${order.deliveryAddress.city}, ${order.deliveryAddress.state} - ${order.deliveryAddress.pincode}</p>` : ''}
          </div>
          
          <div style="background: #fef3c7; padding: 12px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; color: #92400e;">📞 Keep your phone handy for delivery updates from our delivery partner.</p>
          </div>
          
          <a href="${process.env.FRONTEND_URL}/order-tracking/${order._id}" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px;">Track Your Order</a>
          
          <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 20px; text-align: center;">
            <p style="color: #9ca3af; font-size: 11px;">Thank you for choosing ANMRS IT Solutions!</p>
          </div>
        </div>
      </div>
    `
  }),

  // Template 4: Payment Link (Razorpay)
  paymentLink: (order, paymentLink) => ({
    subject: `💳 Complete Payment for Order #${order.orderNumber}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
        <div style="background: linear-gradient(135deg, #8b5cf6, #7c3aed); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">💳 Payment Required</h1>
          <p style="color: #c4b5fd; margin-top: 8px;">Complete your payment to start production</p>
        </div>
        <div style="padding: 30px;">
          <p>Dear <strong>${order.userName}</strong>,</p>
          <p>Please complete your payment to start production on your custom design order.</p>
          
          <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h4 style="margin: 0 0 10px 0; color: #374151;">Order Summary</h4>
            <div style="display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #e5e7eb;">
              <span>${order.quantity} Cards</span>
              <span>₹${order.productPrice || 0}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #e5e7eb;">
              <span>Delivery Charge</span>
              <span>₹${order.deliveryCharge || 0}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 10px 0 0 0; font-weight: bold; font-size: 18px;">
              <span>Total Amount</span>
              <span>₹${order.totalPrice || 0}</span>
            </div>
          </div>
          
          <div style="background: #ede9fe; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
            <p style="font-size: 24px; font-weight: bold; color: #5b21b6; margin: 0;">₹${order.totalPrice || 0}</p>
          </div>
          
          <a href="${paymentLink}" style="display: inline-block; background: #8b5cf6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px;">Pay Now via Razorpay</a>
          
          <div style="background: #fef3c7; padding: 12px; border-radius: 8px; margin-top: 20px;">
            <p style="margin: 0; color: #92400e; font-size: 12px;">⚠️ This link expires in 24 hours.</p>
          </div>
        </div>
      </div>
    `
  })
};

// ============================================
// MAIN FUNCTION TO SEND DESIGN ORDER EMAILS
// ============================================

export const sendDesignOrderEmail = async (order, emailType, additionalData = {}) => {
  try {
    // Get company settings if needed
    let companySettings = null;
    if (emailType === 'ready_for_pickup' || emailType === 'processing_started') {
      try {
        console.log(`🔍 Fetching company settings for ${emailType}...`);
        // ✅ FIXED: Correct model import path
        const Setting = (await import('../models/Setting.js')).default;
        companySettings = await Setting.findOne();
        
        console.log('📊 Company Settings found:', companySettings ? 'YES' : 'NO');
        if (companySettings) {
          console.log('🏢 Company Address:', companySettings.companyAddress);
          console.log('📞 Contact Number:', companySettings.contactNumber);
          console.log('⏰ Business Hours:', companySettings.businessHours);
          console.log('🏷️ Site Name:', companySettings.siteName);
        } else {
          console.warn('⚠️ No company settings found in database. Creating default settings...');
          // Create default settings if none exist
          const defaultSettings = new Setting({
            companyAddress: "No.4A 3rd Street, Sanjay Gandhi Nagar, Chromepet, Chennai, Tamil Nadu - 600044",
            contactNumber: "+91 8071639282",
            businessHours: "Mon–Sun · 9AM–6PM",
            siteName: "ANMRS IT Solutions"
          });
          companySettings = await defaultSettings.save();
          console.log('✅ Default settings created');
        }
      } catch (error) {
        console.error('❌ Error fetching company settings:', error.message);
        console.error('Stack:', error.stack);
        // Fallback to hardcoded values if database fails
        companySettings = {
          companyAddress: "No.4A 3rd Street, Sanjay Gandhi Nagar, Chromepet, Chennai, Tamil Nadu - 600044",
          contactNumber: "+91 8071639282",
          businessHours: "Mon–Sun · 9AM–6PM",
          siteName: "ANMRS IT Solutions"
        };
        console.log('📧 Using fallback hardcoded settings');
      }
    }
    
    let emailContent;
    switch(emailType) {
      case 'processing_started':
        emailContent = templates.processingStarted(order, additionalData.expectedDate, companySettings);
        break;
      case 'ready_for_pickup':
        emailContent = templates.readyForPickup(order, companySettings);
        break;
      case 'out_for_delivery':
        emailContent = templates.outForDelivery(order, additionalData.deliveryDateTime);
        break;
      case 'payment_link':
      case 'payment_reminder':
        emailContent = templates.paymentLink(order, additionalData.paymentLink);
        break;
      default:
        throw new Error(`Invalid email type: ${emailType}`);
    }
    
    const transporter = createTransporter();
    
    if (!transporter) {
      console.log(`📧 [DEV] Design Order Email to ${order.userEmail}: ${emailContent.subject}`);
      return { success: true, development: true };
    }
    
    const mailOptions = {
      from: `"${process.env.COMPANY_NAME || 'Design Studio'}" <${process.env.SMTP_FROM_EMAIL}>`,
      to: order.userEmail,
      subject: emailContent.subject,
      html: emailContent.html
    };
    
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Design order email sent to ${order.userEmail} - Type: ${emailType}`);
    
    try {
      const DesignOrder = (await import('../models/DesignOrder.js')).default;
      await DesignOrder.findByIdAndUpdate(order._id, {
        $push: {
          emailNotifications: {
            type: emailType,
            sentAt: new Date(),
            status: 'sent'
          }
        }
      });
    } catch (error) {
      console.warn('Could not update email log:', error.message);
    }
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Design order email failed:', error);
    return { success: false, error: error.message };
  }
};

// ============================================
// HELPER FUNCTIONS FOR SPECIFIC SCENARIOS
// ============================================

export const sendProcessingStartedEmail = async (order, expectedDate) => {
  return await sendDesignOrderEmail(order, 'processing_started', { expectedDate });
};

export const sendReadyForPickupEmail = async (order) => {
  return await sendDesignOrderEmail(order, 'ready_for_pickup');
};

export const sendOutForDeliveryEmail = async (order, deliveryDateTime) => {
  return await sendDesignOrderEmail(order, 'out_for_delivery', { deliveryDateTime });
};

export const sendPaymentLinkEmail = async (order, paymentLink) => {
  return await sendDesignOrderEmail(order, 'payment_link', { paymentLink });
};

export const testDesignOrderEmailConfig = async () => {
  try {
    const transporter = createTransporter();
    if (!transporter) {
      console.log('❌ Design order email service not configured');
      return false;
    }
    await transporter.verify();
    console.log('✅ Design order email service configured successfully');
    return true;
  } catch (error) {
    console.error('❌ Design order email config error:', error.message);
    return false;
  }
};

export default {
  sendDesignOrderEmail,
  sendProcessingStartedEmail,
  sendReadyForPickupEmail,
  sendOutForDeliveryEmail,
  sendPaymentLinkEmail,
  testDesignOrderEmailConfig
};