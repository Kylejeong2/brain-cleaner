const express = require('express');
const router = express.Router();
const videosController = require('../controllers/videos.controller');
const authMiddleware = require('../middleware/auth.middleware');

// Route to save a video to the database
router.post('/save', authMiddleware.verifyToken, videosController.saveVideo);

// Route to get all videos for a user
router.get('/:userId', authMiddleware.verifyToken, videosController.getUserVideos);

// Route to delete a video
router.delete('/:userId/:videoId', authMiddleware.verifyToken, videosController.deleteVideo);

module.exports = router;
