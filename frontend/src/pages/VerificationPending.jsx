import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import './VerificationPending.css';

const BACKEND_URL = import.meta.env.BACKEND_URL;

const VerificationPending = () => {
  const [isResending, setIsResending] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const location = useLocation();
  const email = location.state?.email || 'your email';

  const handleResendEmail = async () => {
    setIsResending(true);
    try {
      const response = await fetch(`http://localhost:3000/api/v1/auth/resend-verification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();
      if (response.ok) {
        setResendMessage('Verification email sent successfully!');
      } else {
        setResendMessage(data.message || 'Failed to resend verification email');
      }
    } catch (error) {
      setResendMessage('Error sending verification email');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="verification-container">
      <div className="verification-box">
        <h1>Check Your Email! ✉️</h1>
        <p className="verification-text">
          We sent a verification link to:
          <br />
          <strong>{email}</strong>
        </p>
        <button 
          className="resend-button" 
          onClick={handleResendEmail}
          disabled={isResending}
        >
          {isResending ? 'Sending...' : 'Resend Email'}
        </button>
        {resendMessage && (
          <p className={`resend-message ${resendMessage.includes('success') ? 'success' : 'error'}`}>
            {resendMessage}
          </p>
        )}
        <div className="help-text">
          <p>Haven't received it?</p>
          <ul>
            <li>Check your spam folder</li>
            <li>Make sure the email address is correct</li>
            <li>Allow a few minutes for delivery</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default VerificationPending;
