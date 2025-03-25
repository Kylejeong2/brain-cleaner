import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../App";
import "./MainPage.css";

const BACKEND_URL = import.meta.env.BACKEND_URL;

const MainPage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [selectedFile, setSelectedFile] = useState(null);
  const [previousVideos, setPreviousVideos] = useState([]);
  const [videoUrl, setVideoUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [tempVideoUrl, setTempVideoUrl] = useState(null);
  const [videoData, setVideoData] = useState(null);
  const [uploadStatus, setUploadStatus] = useState('idle'); // 'idle', 'uploading', 'processing', 'completed'

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    setSelectedFile(file);
    
    // Create temporary URL for the uploaded file
    if (file) {
      const tempUrl = URL.createObjectURL(file);
      setTempVideoUrl(tempUrl);
    }
  };

  const getS3UploadURL = async (file) => {
    try {
      const res = await fetch(`http://localhost:3000/api/v1/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, fileType: file.type }),
      });

      console.log("res", res);

      if (!res.ok) throw new Error("Failed to fetch S3 upload URL");
      const { uploadURL } = await res.json();
      return uploadURL;
    } catch (error) {
      console.error("Error getting S3 upload URL:", error);
      return null;
    }
  };

  const uploadFileToS3 = async (uploadURL, file) => {
    try {
      setUploadStatus('uploading');
      await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      console.log("PDF uploaded to S3");
      setUploadStatus('processing');
    } catch (error) {
      console.error("Error uploading file to S3:", error);
      setUploadStatus('idle');
      throw error;
    }
  };

  const handleConversion = async () => {
    if (!selectedFile) return;

    try {
      setIsLoading(true);
      setUploadStatus('idle');
      console.log("handleConversion");
      // Generate a pre-signed (temporary) URL without credentials
      const s3UploadURL = await getS3UploadURL(selectedFile);
      console.log("S3 Upload URL:", s3UploadURL);
      if (!s3UploadURL) throw new Error("Failed to get S3 upload URL");

      // Upload file to S3 using pre-signed URL
      await uploadFileToS3(s3UploadURL, selectedFile);
      const fileUrl = s3UploadURL.split("?")[0]; // Get public file URL (remove query params if any)

      console.log("File URL:", fileUrl);

      // Send file URL to backend for processing
      const response = await fetch(
        "http://localhost:3000/api/v1/pdftobrainrot",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ file: fileUrl, file_name: selectedFile.name }),
        }
      );

      if (!response.ok) throw new Error("Backend processing failed");
  
      const data = await response.json();
      
      if (data.video_url) {
        setVideoUrl(data.video_url);
        setVideoData(data); // Store the full video data for saving
        setUploadStatus('completed');
      }
      
      console.log("Conversion successful:", data);
    } catch (error) {
      console.error("Error during conversion:", error);
      setUploadStatus('idle');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveVideo = async () => {
    if (!videoUrl || !user || !videoData) return;
    
    setIsSaving(true);
    
    try {
      // Instead of saving to the database, we'll store in localStorage
      // This is temporary storage, but good enough for this demo
      const videoInfo = {
        userId: user.sub || user.id || user._id,
        title: selectedFile ? selectedFile.name.replace('.pdf', '') : 'Untitled Video',
        s3Key: videoData.s3_key || `video_${Date.now()}`,
        s3Url: videoUrl,
        creatomateUrl: videoData.creatomate_url || '',
        timestamp: Date.now()
      };
      
      // Get existing videos or start with empty array
      const savedVideos = JSON.parse(localStorage.getItem('savedVideos') || '[]');
      
      // Add new video to the beginning of the array
      savedVideos.unshift(videoInfo);
      
      // Save back to localStorage
      localStorage.setItem('savedVideos', JSON.stringify(savedVideos));
      
      console.log('Video saved to localStorage:', videoInfo);
      
      // Show success message and navigate
      alert('Video saved successfully!');
      navigate('/saved-videos');
      
    } catch (error) {
      console.error('Error saving video:', error);
      alert('Failed to save video. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="main-page">
      <nav className="navbar">
        <div className="nav-left">
          <Link to="/main">Home</Link>
          <Link to="/saved-videos">Saved Videos</Link>
        </div>
        <div className="nav-right">
          <span className="user-email">{user?.email}</span>
          <button onClick={handleLogout} className="logout-btn">
            Logout
          </button>
        </div>
      </nav>

      <div className="converter-section">
        <h1>turn pdfs to brainrot</h1>
        <div className="video-placeholder">
          {videoUrl ? (
            <div className="video-container">
              <video 
                controls
                width="100%"
                height="300px"
              >
                <source src={videoUrl} type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            </div>
          ) : isLoading ? (
            <div className="loading-indicator">
              <h2>Generating Video...</h2>
              <div className="spinner"></div>
              <p>Please wait while we process your file</p>
              {uploadStatus === 'uploading' && <p className="status-message">Uploading PDF to S3...</p>}
            </div>
          ) : tempVideoUrl ? (
            <div className="temp-video-container">
              <h2>Uploaded File Preview</h2>
              <p>Click "Convert to Video" to process</p>
              <object
                data={tempVideoUrl}
                type={selectedFile?.type}
                width="100%"
                height="300px"
              >
                <p>Preview not available</p>
              </object>
            </div>
          ) : (
            <>
              <h2>nothing here!</h2>
              <p>upload a file & convert</p>
            </>
          )}
        </div>
        <div className="upload-container">
          <input
            type="file"
            accept=".pdf"
            onChange={handleFileUpload}
            id="pdf-upload"
          />
          <label htmlFor="pdf-upload" className="upload-btn">
            {selectedFile ? selectedFile.name : "upload"}
          </label>
          {selectedFile && (
            <button 
              onClick={handleConversion} 
              className="convert-btn"
              disabled={isLoading}
            >
              {isLoading ? "Processing..." : "Convert to Video"}
            </button>
          )}
        </div>
        <div className="save-container">
          <button 
            className="save-btn" 
            disabled={!videoUrl || isLoading || isSaving}
            onClick={handleSaveVideo}
          >
            {isSaving ? (
              <>
                <span className="btn-spinner"></span> Saving...
              </>
            ) : (
              "save to my videos"
            )}
          </button>
        </div>
      </div>
      <footer>made possible with chunkr.ai</footer>
    </div>
  );
};

export default MainPage;
