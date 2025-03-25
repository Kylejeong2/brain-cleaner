const db = require('../db');

/**
 * Save a video to the database
 */
exports.saveVideo = async (req, res) => {
  const { userId, title, s3Key, s3Url, creatomateUrl } = req.body;

  if (!userId || !s3Key) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  try {
    const result = await db.query(
      'INSERT INTO videos (user_id, title, s3_key, s3_url, creatomate_url) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [userId, title || 'Untitled Video', s3Key, s3Url, creatomateUrl]
    );

    res.status(201).json({ 
      message: 'Video saved successfully',
      video: result.rows[0]
    });
  } catch (error) {
    console.error('Error saving video:', error);
    res.status(500).json({ message: 'Failed to save video' });
  }
};

/**
 * Get all videos for a user
 */
exports.getUserVideos = async (req, res) => {
  const userId = req.params.userId;

  if (!userId) {
    return res.status(400).json({ message: 'User ID is required' });
  }

  try {
    const result = await db.query(
      'SELECT * FROM videos WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    res.status(200).json({ videos: result.rows });
  } catch (error) {
    console.error('Error fetching user videos:', error);
    res.status(500).json({ message: 'Failed to fetch videos' });
  }
};

/**
 * Delete a video
 */
exports.deleteVideo = async (req, res) => {
  const { videoId, userId } = req.params;

  if (!videoId || !userId) {
    return res.status(400).json({ message: 'Video ID and User ID are required' });
  }

  try {
    // Check if video belongs to user
    const video = await db.query(
      'SELECT * FROM videos WHERE id = $1 AND user_id = $2',
      [videoId, userId]
    );

    if (video.rows.length === 0) {
      return res.status(404).json({ message: 'Video not found or not authorized' });
    }

    // Delete the video
    await db.query('DELETE FROM videos WHERE id = $1', [videoId]);

    res.status(200).json({ message: 'Video deleted successfully' });
  } catch (error) {
    console.error('Error deleting video:', error);
    res.status(500).json({ message: 'Failed to delete video' });
  }
};
