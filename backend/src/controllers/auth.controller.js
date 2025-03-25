const db = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sendVerificationEmail } = require('../utils/email');

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

exports.register = async (req, res) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      console.log('Missing email or password');
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const existingUser = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    console.log('Generated token:', verificationToken);
    console.log('Token expires:', tokenExpires);

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert new user into the database with verification token
    const result = await db.query(
      'INSERT INTO users (email, password, verification_token, verification_token_expires) VALUES ($1, $2, $3, $4) RETURNING id, email, verification_token',
      [email, hashedPassword, verificationToken, tokenExpires]
    );
    
    console.log('Stored user:', result.rows[0]);
    
    // Send verification email
    await sendVerificationEmail(email, verificationToken);
    
    // Generate JWT token
    const payload = { id: result.rows[0].id, email: result.rows[0].email };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });

    return res.status(201).json({
      message: 'User registered successfully. Please check your email to verify your account.',
      token,
      user: {
        id: result.rows[0].id,
        email: result.rows[0].email,
        isVerified: false
      }
    });
  } catch (err) {
    console.error('Error during registration:', err);
    return res.status(500).json({ message: 'Error registering user' });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check if email is verified
    if (!user.is_verified && !user.google_id) {
      return res.status(401).json({ 
        message: 'Please verify your email before logging in',
        needsVerification: true
      });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        isVerified: user.is_verified
      }
    });
  } catch (err) {
    console.error('Error during login:', err);
    res.status(500).json({ message: 'Error logging in' });
  }
};

exports.verifyEmail = async (req, res) => {
  const { token } = req.query;

  try {
    console.log('Verifying token:', token);

    // Find user with matching token that hasn't been used
    const result = await db.query(
      'SELECT * FROM users WHERE verification_token = $1 AND verification_token IS NOT NULL',
      [token]
    );

    if (result.rows.length === 0) {
      console.log('No user found with token');
      return res.status(400).json({ message: 'Invalid or expired verification token' });
    }

    const user = result.rows[0];
    console.log('Found user:', { id: user.id, email: user.email, is_verified: user.is_verified });

    // Check if token has expired
    if (user.verification_token_expires && new Date(user.verification_token_expires) < new Date()) {
      console.log('Token expired:', user.verification_token_expires);
      return res.status(400).json({ message: 'Invalid or expired verification token' });
    }

    // Check if already verified
    if (user.is_verified) {
      console.log('User already verified');
      return res.status(400).json({ message: 'Invalid or expired verification token' });
    }

    // Update user as verified and invalidate token
    await db.query(
      'UPDATE users SET is_verified = true, verification_token = NULL, verification_token_expires = NULL WHERE id = $1 AND verification_token = $2',
      [user.id, token]
    );

    console.log('User verified successfully');
    return res.json({ message: 'Email verified successfully' });
  } catch (err) {
    console.error('Error during email verification:', err);
    return res.status(500).json({ message: 'Error verifying email' });
  }
};

exports.resendVerification = async (req, res) => {
  const { email } = req.body;

  try {
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = result.rows[0];
    if (user.is_verified) {
      return res.status(400).json({ message: 'Email is already verified' });
    }

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Update user's verification token
    await db.query(
      'UPDATE users SET verification_token = $1, verification_token_expires = $2 WHERE id = $3',
      [verificationToken, tokenExpires, user.id]
    );

    // Send new verification email
    await sendVerificationEmail(email, verificationToken);

    return res.json({ message: 'Verification email sent successfully' });
  } catch (err) {
    console.error('Error resending verification:', err);
    return res.status(500).json({ message: 'Error resending verification email' });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const user = await db.query('SELECT id, email FROM users WHERE id = $1', [req.user.id]);
    if (user.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    return res.status(200).json({ user: user.rows[0] });
  } catch (err) {
    console.error('Error fetching profile:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};
