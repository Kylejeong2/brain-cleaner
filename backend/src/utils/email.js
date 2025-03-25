require('dotenv').config({ path: '../.env' }); 
const nodemailer = require('nodemailer');


// Create reusable transporter
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// Verify connection configuration
transporter.verify(function(error, success) {
  if (error) {
    console.log('Email configuration error:', error);
  } else {
    console.log('Email server is ready');
  }
});

// Send verification email
exports.sendVerificationEmail = async (email, token) => {
  const verificationUrl = `http://localhost:5173/verify-email?token=${token}`;
  
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Verify your Brain Cleaner account',
    html: `
      <h1>Welcome to Brain Cleaner!</h1>
      <p>Please verify your email address by clicking the link below:</p>
      <a href="${verificationUrl}">Verify Email</a>
      <p>This link will expire in 24 hours.</p>
      <p>If you didn't create this account, you can safely ignore this email.</p>
    `
  };

  try {
    console.log('Attempting to send email with config:', {
      host: 'smtp.gmail.com',
      port: 465,
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD ? '***' : 'not set'
    });
    
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.response);
    return true;
  } catch (error) {
    console.error('Error sending verification email:', error);
    throw error;
  }
};
