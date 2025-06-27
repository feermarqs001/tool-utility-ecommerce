const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userName: { // Salvamos o nome para exibir facilmente sem precisar popular sempre
    type: String,
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  comment: {
    type: String,
    required: true,
    maxlength: 1000
  },
  isApproved: { // O admin precisa aprovar antes de aparecer no site
    type: Boolean,
    default: false
  }
}, { timestamps: true });

// Garante que um usuário só possa avaliar um produto uma única vez
reviewSchema.index({ productId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('Review', reviewSchema);