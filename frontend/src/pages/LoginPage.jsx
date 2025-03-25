import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../App";
import { GoogleLogin } from "@react-oauth/google";
import "./LoginPage.css";

const BACKEND_URL = import.meta.env.BACKEND_URL;

const LoginPage = () => {
  const navigate = useNavigate();
  const { login, register, handleGoogleLogin } = useAuth();
  const [isRegistering, setIsRegistering] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleSuccess = async (credentialResponse) => {
    setError("");
    setIsLoading(true);
    try {
      const result = await handleGoogleLogin(credentialResponse);
      if (result.success) {
        navigate("/main");
      } else {
        setError(result.error || "Google login failed");
      }
    } catch (err) {
      console.error("Google auth error:", err);
      setError("An unexpected error occurred during Google login");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    if (!formData.email || !formData.password) {
      setError("Email and password are required");
      setIsLoading(false);
      return;
    }

    try {
      if (isRegistering) {
        const response = await fetch(
          "http://localhost:3000/api/v1/auth/register",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(formData),
          }
        );

        const data = await response.json();

        if (response.ok) {
          // Instead of logging in directly, redirect to verification pending
          navigate("/verify-pending", { state: { email: formData.email } });
        } else {
          setError(data.message || "Registration failed");
        }
      } else {
        const result = await login(formData.email, formData.password);

        if (result.success) {
          navigate("/main");
        } else {
          setError(result.error || "Login failed");
        }
      }
    } catch (err) {
      console.error("Auth error:", err);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const switchMode = () => {
    setIsRegistering(!isRegistering);
    setError("");
    setFormData({ email: "", password: "" });
  };

  return (
    <div className="login-container">
      <Link to="/" className="back-button">
        back
      </Link>
      <div className="login-box">
        <h2>{isRegistering ? "Create Account" : "Log In"}</h2>

        <div className="google-login-container">
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => {
              setError("Google Login Failed");
            }}
            auto_select
          />
        </div>

        <div className="separator">
          <span>or</span>
        </div>

        {error && <div className="error-message">{error}</div>}

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <input
              type="email"
              id="email"
              placeholder="Email"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
            />
          </div>
          <div className="form-group">
            <input
              type="password"
              id="password"
              placeholder="Password"
              value={formData.password}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
            />
          </div>
          <button type="submit" disabled={isLoading}>
            {isLoading
              ? "Loading..."
              : isRegistering
              ? "Create Account"
              : "Log In"}
          </button>
        </form>

        <div className="auth-switch">
          <span>
            {isRegistering
              ? "Already have an account?"
              : "Don't have an account?"}
          </span>
          <button onClick={switchMode}>
            {isRegistering ? "Log In" : "Sign Up"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
