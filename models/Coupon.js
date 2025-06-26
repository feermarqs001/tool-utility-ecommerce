const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const CouponSchema = new Schema({
    // O código que o cliente vai digitar (ex: BEMVINDO40)
    code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true // Salva sempre em maiúsculas para evitar erros
    },

    // O tipo de desconto: porcentagem ou valor fixo
    discountType: {
        type: String,
        required: true,
        enum: ['percentage', 'fixed'] // Só aceita esses dois valores
    },

    // O valor do desconto (ex: 40 para 40%, ou 50 para R$ 50,00)
    discountValue: {
        type: Number,
        required: true
    },

    // Para ativar ou desativar um cupom
    isActive: {
        type: Boolean,
        default: true
    },

    // Regra especial para o cupom de primeira compra
    firstPurchaseOnly: {
        type: Boolean,
        default: false
    },
    
    // Data de expiração opcional
    expiresAt: {
        type: Date
    }

}, { timestamps: true });

module.exports = mongoose.model('Coupon', CouponSchema);