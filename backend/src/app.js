const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const pdftoroute = require('./routes/pdftobrainrot.routes');
const uploadURL = require('./routes/uploadURL.routes');
const authRoutes = require('./routes/auth.routes');
const videosRoutes = require('./routes/videos.routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Increase request size limit
app.use(bodyParser.json({ limit: "100mb" }));
app.use(bodyParser.urlencoded({ limit: "100mb", extended: true }));

app.use(cors());
app.use(bodyParser.json());
app.use('/api/v1/pdftobrainrot', pdftoroute);
app.use('/api/v1/upload-url', uploadURL);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/videos', videosRoutes);

app.get('/', (req, res) => {
    res.send('Brain Cleaner Backend is running.');
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

module.exports = app;
