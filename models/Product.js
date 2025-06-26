const mongoose = require('mongoose');
const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  price: { type: Number, required: true },
  imageUrls: { type: [String], default: [] }, 
  category: String,
  stock: { type: Number, default: 0 },
  specifications: { type: Map, of: String },
  onSale: { type: Boolean, default: false },
  salePrice: { type: Number }
}, { timestamps: true });

productSchema.virtual('thumbnailUrl').get(function() {
  if (this.imageUrls && this.imageUrls.length > 0) { return this.imageUrls[0]; }
  return 'https://via.placeholder.com/300?text=Sem+Imagem';
});

module.exports = mongoose.model('Product', productSchema);