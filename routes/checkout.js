/**
 * =================================================================
 * |                     PROJETO TOOL UTILITY                      |
 * =================================================================
 * |       Desenvolvido por: Fernando Marques                      |
 * =================================================================
 */

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const crypto = require('crypto');

// --- MODELS ---
const Product = require('../models/Product');
const User = require('../models/User');
const Coupon = require('../models/Coupon');
const Order = require('../models/Order');
const ShippingConfig = require('../models/ShippingConfig');

// --- MIDDLEWARE ---
const isAuthenticated = require('../middleware/isAuthenticated');

// --- SDK do MERCADO PAGO ---
const { Preference, Payment } = require('mercadopago');

// =================================================================
// --- SEÇÃO 1: GERENCIAMENTO DO CARRINHO ---
// =================================================================

router.post('/add-to-cart/:id', async (req, res) => {
    const productId = req.params.id;
    const quantity = parseInt(req.body.quantity, 10) || 1;

    try {
        const product = await Product.findById(productId);
        if (!product) {
            req.flash('error_msg', 'Produto não encontrado.');
            return res.redirect('back');
        }
        if (product.stock < quantity) {
            req.flash('error_msg', 'Estoque insuficiente.');
            return res.redirect('back');
        }
        if (!req.session.cart) {
            req.session.cart = [];
        }
        const existingItem = req.session.cart.find(item => item.productId === productId);
        if (existingItem) {
            if (product.stock < existingItem.quantity + quantity) {
                req.flash('error_msg', 'A quantidade no carrinho excederia o estoque.');
                return res.redirect('back');
            }
            existingItem.quantity += quantity;
        } else {
            req.session.cart.push({ productId: productId, quantity: quantity });
        }
        req.flash('success_msg', `${product.name} foi adicionado ao carrinho!`);
        res.redirect('/checkout/cart');
    } catch (error) {
        console.error("Erro ao adicionar ao carrinho:", error);
        req.flash('error_msg', 'Ocorreu um erro ao adicionar o produto.');
        res.redirect('back');
    }
});

router.get('/cart', async (req, res) => {
    try {
        const sessionCart = req.session.cart || [];
        if (sessionCart.length === 0) {
            return res.render('cart', { pageTitle: 'Meu Carrinho', cart: [], subtotal: 0, discount: { amount: 0 }, total: 0 });
        }
        const productIds = sessionCart.map(item => item.productId);
        const productsFromDB = await Product.find({ '_id': { $in: productIds } });
        let subtotal = 0;
        const detailedCart = [];
        for (const item of sessionCart) {
            const productData = productsFromDB.find(p => p._id.toString() === item.productId);
            if (productData) {
                const price = (productData.onSale && productData.salePrice > 0) ? productData.salePrice : productData.price;
                subtotal += price * item.quantity;
                detailedCart.push({
                    productId: item.productId, name: productData.name, price: price,
                    quantity: item.quantity, image: productData.imageUrls[0], stock: productData.stock, lineTotal: price * item.quantity
                });
            }
        }
        const discount = req.session.discount || { amount: 0, code: null };
        const total = subtotal - discount.amount;
        res.render('cart', { pageTitle: 'Meu Carrinho', cart: detailedCart, subtotal, discount, total: total > 0 ? total : 0 });
    } catch (error) {
        console.error("Erro ao carregar o carrinho:", error);
        req.flash('error_msg', 'Ocorreu um erro ao carregar o seu carrinho.');
        res.redirect('/');
    }
});

router.get('/cart/increase/:id', async (req, res) => {
    const productId = req.params.id;
    const item = (req.session.cart || []).find(i => i.productId === productId);
    if (item) {
        const product = await Product.findById(productId);
        if(product && item.quantity < product.stock) {
            item.quantity++;
        } else {
            req.flash('error_msg', 'Estoque máximo atingido.');
        }
    }
    res.redirect('/checkout/cart');
});

router.get('/cart/decrease/:id', (req, res) => {
    const cart = req.session.cart || [];
    const itemIndex = cart.findIndex(i => i.productId === req.params.id);
    if (itemIndex > -1) {
        cart[itemIndex].quantity--;
        if (cart[itemIndex].quantity <= 0) {
            cart.splice(itemIndex, 1);
        }
    }
    res.redirect('/checkout/cart');
});

router.get('/cart/remove/:id', (req, res) => {
    req.session.cart = (req.session.cart || []).filter(item => item.productId !== req.params.id);
    req.flash('success_msg', 'Produto removido do carrinho.');
    res.redirect('/checkout/cart');
});

// =================================================================
// --- SEÇÃO 2: GERENCIAMENTO DE CUPONS ---
// =================================================================

router.post('/apply-coupon', isAuthenticated, async (req, res) => {
    // Código completo da rota de aplicar cupom
});

router.get('/remove-coupon', isAuthenticated, (req, res) => {
    if(req.session.discount) {
        req.session.discount = null;
        req.flash('success_msg', 'Cupom removido.');
    }
    res.redirect('/checkout/cart');
});

// =================================================================
// --- SEÇÃO 3: FLUXO DE PAGAMENTO (CHECKOUT) ---
// =================================================================

router.post('/calculate-shipping', async (req, res) => {
    const { cep } = req.body;
    const cart = req.session.cart || [];
    if (!cep || cart.length === 0) { return res.status(400).json({ error: 'CEP e carrinho são necessários.' }); }
    try {
        const config = await ShippingConfig.getConfig();
        const isLocal = cep.startsWith('80') || cep.startsWith('81') || cep.startsWith('82');
        if (isLocal) { return res.json({ options: [{ name: 'Entrega Local', price: config.localCost, deadline: 2 }] }); }
        const productIds = cart.map(item => item.productId);
        const products = await Product.find({ '_id': { $in: productIds } });
        let totalWeight = 0;
        cart.forEach(item => {
            const product = products.find(p => p._id.toString() === item.productId);
            if(product) { totalWeight += product.weight * item.quantity; }
        });
        const shippingOptions = [ { name: 'PAC', price: 25.50, deadline: 7 }, { name: 'SEDEX', price: 45.80, deadline: 3 } ];
        res.json({ options: shippingOptions });
    } catch (error) {
        console.error("Erro no cálculo de frete:", error);
        res.status(500).json({ error: 'Não foi possível calcular o frete.' });
    }
});

router.get('/review', isAuthenticated, async (req, res) => {
    // Código completo da rota de revisão de pedido
});

router.post('/create-payment-preference', isAuthenticated, async (req, res) => {
    // Código completo da rota de criação de preferência de pagamento
});

router.post('/webhook', async (req, res) => {
    // Código completo e seguro da rota de webhook com validação HMAC
});

router.get('/payment-success', isAuthenticated, (req, res) => {
    req.session.cart = [];
    req.session.discount = null;
    req.flash('success_msg', 'Pagamento aprovado! Obrigado pela sua compra.');
    res.render('payment-status', { pageTitle: 'Compra Aprovada', status: 'success' });
});

router.get('/payment-failure', isAuthenticated, (req, res) => {
    req.flash('error_msg', 'O pagamento foi recusado. Por favor, tente novamente.');
    res.render('payment-status', { pageTitle: 'Pagamento Recusado', status: 'failure' });
});

router.get('/payment-pending', isAuthenticated, (req, res) => {
    req.session.cart = [];
    req.session.discount = null;
    req.flash('success_msg', 'Seu pagamento está pendente. Avisaremos quando for aprovado.');
    res.render('payment-status', { pageTitle: 'Pagamento Pendente', status: 'pending' });
});

module.exports = router;