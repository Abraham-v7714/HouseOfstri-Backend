import mongoose from 'mongoose';
import dns from 'dns';

// Fix for environments that fail to resolve MongoDB Atlas DNS SRV records
dns.setServers(['8.8.8.8', '8.8.4.4']);

const connectDB = async () => {
  let uri = process.env.MONGODB_URI;

  if (uri && uri.trim() !== uri) {
    uri = uri.trim();
  }

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 20000,
      connectTimeoutMS: 20000,
      family: 4 // Force IPv4
    });
    console.log(`🚀 [SUCCESS] House of Stri Database is now LIVE.`);
    return { success: true };
  } catch (error) {
    console.error(`❌ Error connecting to MongoDB: ${error.message}`);
    
    // Explicit Authentication Check
    if (error.message.includes('Authentication failed') || error.message.includes('bad auth')) {
      console.log(`🔒 AUTHENTICATION ERROR: Please verify that 'mgc7abraham24_db_user' has correct read/write permissions in the Atlas Database Access tab.`);
    }

    console.log(`⚠️ DATABASE DISCONNECTED`);
    return { success: false, error };
  }
};

export default connectDB;
