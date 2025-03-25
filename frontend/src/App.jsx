import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation
} from "react-router-dom";
import { useState, createContext, useContext, useEffect } from "react";
import "./App.css";
import LoginPage from "./pages/LoginPage";
import MainPage from "./pages/MainPage";
import LoadingPage from "./pages/LoadingPage";
import SavedVideos from "./pages/SavedVideos";
import VerificationPending from "./pages/VerificationPending";
import VerificationSuccess from "./pages/VerificationSuccess";
import { jwtDecode } from "jwt-decode";
import { googleLogout } from '@react-oauth/google';

export const AuthContext = createContext(null);
const BACKEND_URL = import.meta.env.BACKEND_URL

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

const API_URL = `http://localhost:3000/api/v1`;

// This component wraps our app and persists the current route
const RouteTracker = ({ children }) => {
  const location = useLocation();
  
  useEffect(() => {
    // Store the current path whenever it changes
    if (location.pathname !== '/' && location.pathname !== '/login') {
      localStorage.setItem('lastRoute', location.pathname);
    }
  }, [location]);
  
  return children;
};

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [lastRoute, setLastRoute] = useState('/main');

  useEffect(() => {
    // Check if user is already logged in
    const token = localStorage.getItem('token');
    const googleToken = localStorage.getItem('googleToken');
    
    // Get last route if available
    const storedRoute = localStorage.getItem('lastRoute');
    if (storedRoute) {
      setLastRoute(storedRoute);
    }
    
    if (googleToken) {
      try {
        const decoded = jwtDecode(googleToken);
        // Check if token is expired
        const currentTime = Date.now() / 1000;
        if (decoded.exp && decoded.exp > currentTime) {
          setUser(decoded);
          setIsAuthenticated(true);
        } else {
          localStorage.removeItem('googleToken');
        }
      } catch (error) {
        console.error('Error with Google token:', error);
        localStorage.removeItem('googleToken');
      }
    } else if (token) {
      checkAuthStatus(token);
    }
  }, []);

  const checkAuthStatus = async (token) => {
    try {
      const decoded = jwtDecode(token);
      if (decoded) {
        setUser(decoded);
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
      localStorage.removeItem('token');
    }
  };

  const login = async (email, password) => {
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('token', data.token);
        setUser(data.user);
        setIsAuthenticated(true);
        return { success: true };
      } else {
        return { success: false, error: data.message };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  };

  const handleGoogleLogin = (credentialResponse) => {
    try {
      const decoded = jwtDecode(credentialResponse.credential);
      setUser(decoded);
      setIsAuthenticated(true);
      localStorage.setItem('googleToken', credentialResponse.credential);
      return { success: true };
    } catch (error) {
      console.error('Google login error:', error);
      return { success: false, error: 'Failed to process Google login' };
    }
  };

  const register = async (email, password) => {
    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('token', data.token);
        setIsAuthenticated(true);
        setUser(data.user);
        return { success: true };
      }
      return { success: false, error: data.message || 'Registration failed' };
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  };

  const logout = () => {
    // Handle Google logout
    if (localStorage.getItem('googleToken')) {
      googleLogout();
      localStorage.removeItem('googleToken');
    }
    // Handle regular logout
    localStorage.removeItem('token');
    localStorage.removeItem('lastRoute'); // Clear the last route on logout
    setIsAuthenticated(false);
    setUser(null);
  };

  const authContextValue = {
    isAuthenticated,
    user,
    login,
    register,
    logout,
    handleGoogleLogin,
  };

  return (
    <AuthContext.Provider value={authContextValue}>
      <Router>
        <RouteTracker>
          <Routes>
            <Route
              path="/"
              element={
                isAuthenticated ? (
                  <Navigate to={lastRoute} />
                ) : (
                  <LoadingPage />
                )
              }
            />
            <Route
              path="/login"
              element={
                isAuthenticated ? (
                  <Navigate to={lastRoute} />
                ) : (
                  <LoginPage />
                )
              }
            />
            <Route
              path="/verify-pending"
              element={<VerificationPending />}
            />
            <Route
              path="/verify-email"
              element={<VerificationSuccess />}
            />
            <Route
              path="/main"
              element={
                isAuthenticated ? (
                  <MainPage />
                ) : (
                  <Navigate to="/" />
                )
              }
            />
            <Route
              path="/saved-videos"
              element={
                isAuthenticated ? (
                  <SavedVideos />
                ) : (
                  <Navigate to="/" />
                )
              }
            />
          </Routes>
        </RouteTracker>
      </Router>
    </AuthContext.Provider>
  );
}

export default App;