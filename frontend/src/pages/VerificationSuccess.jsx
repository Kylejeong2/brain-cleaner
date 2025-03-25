import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import './VerificationSuccess.css';

const BACKEND_URL = import.meta.env.BACKEND_URL;

const VerificationSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('verifying');
  const token = searchParams.get('token');
  const hasAttempted = useRef(false);

  useEffect(() => {
    const verifyEmail = async () => {
      try {
        const response = await fetch(`http://localhost:3000/api/v1/auth/verify-email?token=${token}`);
        const data = await response.json();
        
        if (!response.ok) {
          if (data.message.includes('Invalid or expired')) {
            setStatus('invalid');
          } else {
            setStatus('error');
          }
        } else {
          setStatus('success');
        }
      } catch (error) {
        console.error('Verification error:', error);
        setStatus('error');
      }
    };

    if (token && !hasAttempted.current) {
      hasAttempted.current = true;
      verifyEmail();
    } else if (!token) {
      setStatus('invalid');
    }
  }, [token]);

  const getContent = () => {
    switch (status) {
      case 'verifying':
        return {
          title: 'Verifying Your Email...',
          message: 'Please wait while we verify your email address.',
          icon: '⌛'
        };
      case 'success':
        return {
          title: 'Email Verified!',
          message: 'Your account is now ready to use.',
          icon: '✅'
        };
      case 'invalid':
        return {
          title: 'Invalid Link',
          message: 'This verification link is invalid or has expired.',
          icon: '❌'
        };
      case 'error':
        return {
          title: 'Something went wrong',
          message: 'Please try logging in or contact support.',
          icon: '❌'
        };
      default:
        return {
          title: 'Something went wrong',
          message: 'Please try logging in or contact support.',
          icon: '❌'
        };
    }
  };

  const content = getContent();

  return (
    <div className="verification-container">
      <div className="verification-card">
        <div className="verification-icon">{content.icon}</div>
        <h1>{content.title}</h1>
        <p>{content.message}</p>
        <button 
          className="continue-button"
          onClick={() => navigate('/login')}
        >
          Continue to Login
        </button>
      </div>
    </div>
  );
};

export default VerificationSuccess;
