import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../App";
import "./SavedVideos.css";

const SavedVideos = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [videos, setVideos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleDeleteVideo = (index) => {
    // Ask for confirmation
    if (!confirm("Are you sure you want to delete this video?")) {
      return;
    }

    try {
      // Get current videos
      const savedVideos = JSON.parse(localStorage.getItem('savedVideos') || '[]');
      
      // Remove the video at the specified index
      savedVideos.splice(index, 1);
      
      // Save back to localStorage
      localStorage.setItem('savedVideos', JSON.stringify(savedVideos));
      
      // Update state to reflect changes
      setVideos(savedVideos.filter(video => {
        const userId = user.id || user.sub;
        return userId ? video.userId === userId : true;
      }));
      
      console.log('Video deleted');
    } catch (err) {
      console.error('Error deleting video:', err);
    }
  };

  useEffect(() => {
    const fetchUserVideos = async () => {
      if (!user) return;
      
      try {
        setIsLoading(true);
        
        // Get videos from localStorage
        const savedVideos = JSON.parse(localStorage.getItem('savedVideos') || '[]');
        
        // Filter videos for current user if needed
        const userId = user.id || user.sub;
        const userVideos = userId 
          ? savedVideos.filter(video => video.userId === userId)
          : savedVideos;
        
        console.log('Fetched videos from localStorage:', userVideos);
        setVideos(userVideos || []);
      } catch (err) {
        console.error('Error loading videos from localStorage:', err);
        // Don't show error to user
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchUserVideos();
  }, [user]);

  return (
    <div className="saved-videos">
      <nav className="nav-bar">
        <div className="nav-left">
          <Link to="/main" className="nav-link">Home</Link>
          <Link to="/saved-videos" className="nav-link active">Saved</Link>
        </div>
        <div className="nav-right">
          <span className="user-email">{user?.email}</span>
          <button onClick={handleLogout} className="logout-btn">
            Logout
          </button>
        </div>
      </nav>

      <h1 className="page-title">my videos</h1>

      {isLoading ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading your videos...</p>
        </div>
      ) : videos.length > 0 ? (
        <div className="video-grid">
          {videos.map((video, index) => (
            <div key={index} className="video-card">
              <div className="video-thumbnail">
                <video 
                  controls
                  width="100%"
                  height="100%"
                  poster={video.thumbnail || ''}
                >
                  <source src={video.s3Url} type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              </div>
              <div className="video-card-footer">
                <h3 className="video-title">{video.title || 'Untitled Video'}</h3>
                <button 
                  className="delete-video-btn" 
                  onClick={() => handleDeleteVideo(index)}
                  title="Delete video"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="no-videos">
          <h2>No videos yet!</h2>
          <p>Go to the home page to create your first video</p>
          <Link to="/main" className="create-link">Create a video</Link>
        </div>
      )}
    </div>
  );
};

export default SavedVideos;
