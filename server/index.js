const express = require('express');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Cloudinary Config
cloudinary.config({
  cloud_name: process.env.VITE_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.VITE_CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer Storage
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

/**
 * @route POST /api/upload
 * @desc  Uploads an image to Cloudinary and returns the secure URL
 */
app.post('/api/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image provided' });
    }

    // Convert buffer to base64
    const fileBase64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(fileBase64, {
      folder: 'house_of_stri',
    });

    res.json({
      secure_url: result.secure_url,
      public_id: result.public_id,
    });
  } catch (error) {
    console.error('Cloudinary Upload Error:', error);
    
    // Check if it's an authentication error (401)
    if (error.http_code === 401) {
      return res.status(401).json({ 
        error: 'Cloudinary Authentication failed. Please check your credentials.',
        details: error.message 
      });
    }

    // Default 500 mapping
    res.status(500).json({ 
      error: 'Cloudinary connection issue or internal server error.',
      details: error.message 
    });
  }
});

app.listen(port, () => {
  console.log(`Bespoke Admin Server running at http://localhost:${port}`);
});
