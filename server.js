import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dns from 'dns';
import mongoose from 'mongoose';
import cors from 'cors';
import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
import multer from 'multer';
import Product from './models/Product.js';
import connectDB from './config/db.js';
import authRoutes from './routes/auth.js';
import { protect, admin } from './middleware/authMiddleware.js';

// Load environment variables if needed
dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Connect to MongoDB before proceeding
const dbStatus = await connectDB();

if (!dbStatus.success) {
  const error = dbStatus.error;
  console.log('\n--- 🔍 Network Connectivity Diagnostics ---');
  console.log(`Mongoose connection error code: ${error.code || 'N/A'}`);
  console.log(`Mongoose syscall: ${error.syscall || 'N/A'}`);
  
  // DNS internet connection test
  dns.lookup('google.com', (err) => {
    if (err && err.code === 'ENOTFOUND') {
      console.error('Diagnostic: No internet connectivity detected. Check your local network/ethernet.');
    } else {
      console.log('Diagnostic: Internet is ACTIVE. The issue is likely local firewalls or MongoDB IP Whitelisting (Network Access).');
    }
    console.log('-------------------------------------------\n');
  });
}

// Middleware
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000'
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Auth Routes
app.use('/api/auth', authRoutes);

/**
 * @route GET /api/db-test
 * @desc  Temporary debugging route to verify database connectivity from browser
 */
app.get('/api/db-test', (req, res) => {
  res.json({ connected: mongoose.connection.readyState === 1 });
});

/**
 * @route GET /api/health
 * @desc  Visual status route to check DB connectivity
 */
app.get('/api/health', (req, res) => {
  if (mongoose.connection.readyState === 1) {
    res.send('<h2 style="color: green; font-family: sans-serif; padding: 20px;">✅ Database Connected Successfully</h2>');
  } else {
    res.send('<h2 style="color: red; font-family: sans-serif; padding: 20px;">❌ Database Disconnected</h2>');
  }
});

// Cloudinary Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Setup multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

/**
 * @route POST /api/products
 * @desc  Save product details to MongoDB
 */
app.post('/api/products', protect, admin, async (req, res) => {
  console.log("📥 Received Product Data:", req.body);

  // Database Ready-State Check
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ message: "Database not ready" });
  }

  try {
    const { name, category, description, basePrice, quantity, images, addOns } = req.body;
    
    // Create new product instance from the payload
    const newProduct = new Product({
      name,
      category,
      description,
      basePrice,
      quantity,
      images,
      addOns
    });

    const savedProduct = await newProduct.save();
    return res.status(201).json(savedProduct);
  } catch (err) {
    // CRITICAL: Detailed error logging
    console.error("❌ SERVER ERROR:", err.message, err.stack);
    
    // Return the specific error message to the frontend payload
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * @route GET /api/products
 * @desc  Get all products from MongoDB
 */
app.get('/api/products', async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    console.error("❌ GET ERROR:", err.message);
    res.status(500).json({ message: "Server Error" });
  }
});

/**
 * @route GET /api/products/:id
 * @desc  Get a single product by ID
 */
app.get('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json(product);
  } catch (err) {
    console.error("❌ GET SINGLE ERROR:", err.message);
    res.status(500).json({ message: "Server Error" });
  }
});

/**
 * @route PUT /api/products/:id
 * @desc  Update product in MongoDB
 */
app.put('/api/products/:id', protect, admin, async (req, res) => {
  if (mongoose.connection.readyState !== 1) return res.status(503).json({ message: "Database not ready" });
  try {
    const updatedProduct = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updatedProduct) return res.status(404).json({ message: "Product not found" });
    res.json(updatedProduct);
  } catch (err) {
    console.error("❌ PUT ERROR:", err.message);
    res.status(500).json({ message: "Server Error" });
  }
});

/**
 * @route DELETE /api/products/:id
 * @desc  Delete product from MongoDB
 */
app.delete('/api/products/:id', protect, admin, async (req, res) => {
  if (mongoose.connection.readyState !== 1) return res.status(503).json({ message: "Database not ready" });
  try {
    const deletedProduct = await Product.findByIdAndDelete(req.params.id);
    if (!deletedProduct) return res.status(404).json({ message: "Product not found" });
    res.json({ message: "Product deleted" });
  } catch (err) {
    console.error("❌ DELETE ERROR:", err.message);
    res.status(500).json({ message: "Server Error" });
  }
});

/**
 * @route POST /api/upload
 * @desc  Uploads an image to Cloudinary and returns the secure URL
 */
app.post('/api/upload', protect, admin, upload.single('image'), async (req, res) => {
  console.log('--- Incoming upload request to /api/upload ---');
  
  try {
    if (!req.file) {
      console.log('Error: No image provided in the request');
      return res.status(400).json({ error: 'No image provided' });
    }

    console.log(`Received file: ${req.file.originalname} (${req.file.size} bytes)`);

    // Convert buffer to base64
    const fileBase64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;

    console.log('Uploading to Cloudinary...');
    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(fileBase64, {
      folder: 'house_of_stri',
    });

    console.log('Upload successful! Secure URL:', result.secure_url);

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

    // Default 500 error mapping
    res.status(500).json({ 
      error: 'Cloudinary connection issue or internal server error.',
      details: error.message 
    });
  }
});

// -------------------------- DEPLOYMENT --------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (process.env.NODE_ENV === 'production') {
  // Serve static files from the frontend dist folder
  app.use(express.static(path.join(__dirname, './dist')));

  // Handle SPA routing: serve index.html for all non-API routes
  app.get('*', (req, res) => {
    // If it's not an API route, serve index.html
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    }
  });
} else {
  app.get('/', (req, res) => {
    res.send('API is running...');
  });
}
// ----------------------------------------------------------------

app.listen(port, () => {
  console.log(`Backend server running on http://localhost:${port}`);
});
