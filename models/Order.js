const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  products: [{
      productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
      quantity: { type: Number, default: 1 },
      price: Number // Preço no momento da compra
  }],
  totalAmount: { type: Number, required: true }, // Este é o valor final (produtos + frete - desconto)
  shippingAddress: {
      street: String, number: String, complement: String, neighborhood: String,
      city: String, state: String, zipCode: String
  },
  status: { type: String, default: 'Pendente', enum: ['Pendente', 'Pago', 'Enviado', 'Entregue', 'Cancelado'] },
  paymentId: { type: String },

  // --- [NOVO] CAMPOS DE FRETE ---
  shippingMethod: { type: String }, // Ex: 'SEDEX', 'PAC', 'Entrega Local'
  shippingCost: { type: Number, default: 0 }

}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);