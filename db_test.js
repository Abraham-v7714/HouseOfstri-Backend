import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';

dotenv.config();

async function testConnection() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected successfully!');
    
    const usersCount = await User.countDocuments();
    console.log('Number of users in DB:', usersCount);
    
    const testEmail = 'abrahamv7714@gmail.com';
    const user = await User.findOne({ email: testEmail });
    if (user) {
      console.log('User found:', user.email);
    } else {
      console.log('User not found:', testEmail);
    }
  } catch (err) {
    console.error('Connection/Query error:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected.');
  }
}

testConnection();
