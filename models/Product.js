import mongoose from 'mongoose';

const ProductSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
  },
  category: {
    type: String,
  },
  basePrice: {
    type: Number,
  },
  quantity: {
    type: Number,
  },
  images: {
    type: [String],
  },
  addOns: {
    type: Array,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  }
});

const Product = mongoose.model('Product', ProductSchema);

export default Product;
