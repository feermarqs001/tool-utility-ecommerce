/**
 * =================================================================
 * |                       PROJETO TOOL UTILITY                      |
 * =================================================================
 * |           Desenvolvido por: Fernando Marques                  |
 * =================================================================
 */

const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const { Payment, Preference } = require('mercadopago');

// Middlewares e Models
const isAuthenticated = require('../middleware/isAuthenticated');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Coupon = require('../models/Coupon');
const User = require('../models/User');
const ShippingConfig = require('../models/ShippingConfig');


// ROTA PARA EXIBIR O CARRINHO
router.get('/cart', async (req, res, next) => {
    try {
        const cart = req.session.cart || [];
        const productIds = cart.map(item => item.productId);
        const productsInDb = await Product.find({ '_id': { $in: productIds } });
        let cartSubtotal = 0;

        const cartWithDetails = cart.map(item => {
            const product = productsInDb.find(p => p._id.toString() === item.productId);
            if (!product) return null;
            const priceToUse = (product.onSale && product.salePrice > 0) ? product.salePrice : product.price;
            const lineTotal = item.quantity * priceToUse;
            cartSubtotal += lineTotal;
            return { ...item, product, lineTotal };
        }).filter(item => item !== null);

        req.session.cart = cartWithDetails.map(item => ({ productId: item.productId, quantity: item.quantity }));

        res.render('checkout/cart', {
            pageTitle: 'Meu Carrinho',
            cart: cartWithDetails,
            subtotal: cartSubtotal,
            discount: req.session.discount || null,
            shipping: req.session.shipping || null
        });
    } catch (error) {
        next(error);
    }
});

// ADICIONAR ITEM AO CARRINHO
router.post('/add-to-cart', [
    body('productId', 'ID do produto inválido').isMongoId(),
    body('quantity', 'Quantidade inválida').isInt({ min: 1 }).toInt()
], async (req, res, next) => {
    const { productId, quantity } = req.body;
    const cart = req.session.cart || [];
    try {
        const product = await Product.findById(productId);
        if (!product) {
            req.flash('error_msg', 'Produto não encontrado.');
            return res.redirect(req.header('Referer') || '/');
        }
        const itemIndex = cart.findIndex(item => item.productId === productId);
        if (itemIndex > -1) {
            cart[itemIndex].quantity += quantity;
        } else {
            cart.push({ productId, quantity });
        }
        req.session.cart = cart;
        req.flash('success_msg', `"${product.name}" foi adicionado ao seu carrinho!`);
        res.redirect(req.header('Referer') || '/');
    } catch (error) {
        next(error);
    }
});

// ATUALIZAR QUANTIDADE NO CARRINHO
router.post('/update-cart/:productId', [
    param('productId').isMongoId(),
    body('quantity').isInt({ min: 1 }).toInt()
], (req, res) => {
    const { productId } = req.params;
    const { quantity } = req.body;
    const cart = req.session.cart || [];
    const itemIndex = cart.findIndex(item => item.productId === productId);
    if (itemIndex > -1) {
        cart[itemIndex].quantity = quantity;
    }
    req.session.cart = cart;
    res.redirect('/checkout/cart');
});

// REMOVER ITEM DO CARRINHO
router.get('/remove-from-cart/:productId', [
    param('productId').isMongoId()
], (req, res) => {
    const { productId } = req.params;
    let cart = req.session.cart || [];
    cart = cart.filter(item => item.productId !== productId);
    req.session.cart = cart;
    req.flash('success_msg', 'Produto removido do carrinho.');
    res.redirect('/checkout/cart');
});

// CÁLCULO DE FRETE (LÓGICA SIMULADA)
router.post('/calculate-shipping', [
    body('zipcode', 'Por favor, insira um CEP válido.').trim().isPostalCode('BR')
], async (req, res) => {
    const { zipcode } = req.body;
    try {
        const config = await ShippingConfig.findOne();
        let shippingOptions = [];
        if (zipcode && config) {
            if (zipcode.startsWith('80') || zipcode.startsWith('81')) {
                shippingOptions.push({ type: 'Entrega Local', cost: config.localCost || 10.00, days: 1 });
            } else {
                shippingOptions.push({ type: 'SEDEX', cost: 45.50, days: 3 });
                shippingOptions.push({ type: 'PAC', cost: 25.70, days: 7 });
            }
        }
        req.session.shippingOptions = shippingOptions;
        res.redirect('/checkout/cart');
    } catch (error) {
        req.flash('error_msg', 'Não foi possível calcular o frete.');
        res.redirect('/checkout/cart');
    }
});

// SELECIONAR OPÇÃO DE FRETE
router.post('/select-shipping', (req, res) => {
    const { shippingType, shippingCost } = req.body;
    if (shippingType && shippingCost) {
        req.session.shipping = {
            type: shippingType,
            cost: parseFloat(shippingCost)
        };
    }
    res.redirect('/checkout/cart');
});

// APLICAR CUPOM DE DESCONTO
router.post('/apply-coupon', [
    body('couponCode', 'Código do cupom inválido.').trim().notEmpty().escape()
], async (req, res) => {
    const { couponCode } = req.body;
    try {
        const coupon = await Coupon.findOne({ code: couponCode.toUpperCase(), isActive: true, expiryDate: { $gte: new Date() } });
        if (!coupon) {
            req.flash('error_msg', 'Cupom inválido ou expirado.');
            return res.redirect('/checkout/cart');
        }
        req.session.discount = { code: coupon.code, type: coupon.discountType, value: coupon.discountValue };
        req.flash('success_msg', `Cupom "${coupon.code}" aplicado com sucesso!`);
        res.redirect('/checkout/cart');
    } catch (error) {
        req.flash('error_msg', 'Não foi possível aplicar o cupom.');
        res.redirect('/checkout/cart');
    }
});

// ROTA DE REVISÃO DO PEDIDO
router.get('/review', isAuthenticated, async (req, res, next) => {
    try {
        const cart = req.session.cart || [];
        if (cart.length === 0) {
            req.flash('error_msg', 'Seu carrinho está vazio.');
            return res.redirect('/');
        }
        const user = await User.findById(req.session.userId);
        if (!user) {
            req.flash('error_msg', 'Usuário não encontrado.');
            return res.redirect('/auth/login');
        }
        const productIds = cart.map(item => item.productId);
        const productsInDb = await Product.find({ '_id': { $in: productIds } });
        let subtotal = 0;
        const cartWithDetails = cart.map(item => {
            const product = productsInDb.find(p => p._id.toString() === item.productId);
            if (!product) return null;
            const priceToUse = (product.onSale && product.salePrice > 0) ? product.salePrice : product.price;
            const lineTotal = item.quantity * priceToUse;
            subtotal += lineTotal;
            return { ...item, product, lineTotal };
        }).filter(Boolean);

        const discountInfo = req.session.discount || null;
        const shippingInfo = req.session.shipping || null;
        let finalTotal = subtotal;
        let discountAmount = 0;
        if (discountInfo) {
            discountAmount = (discountInfo.type === 'Percentage') ? (subtotal * discountInfo.value) / 100 : discountInfo.value;
            finalTotal -= discountAmount;
        }
        if (shippingInfo) {
            finalTotal += shippingInfo.cost;
        }

        res.render('checkout/review', {
            pageTitle: 'Revisão do Pedido',
            cart: cartWithDetails,
            subtotal, discountAmount,
            shipping: shippingInfo,
            total: finalTotal,
            discount: discountInfo,
            user: user
        });
    } catch (error) {
        next(error);
    }
});

// CRIAR PREFERÊNCIA DE PAGAMENTO NO MERCADO PAGO
router.post('/create-payment-preference', isAuthenticated, async (req, res, next) => {
    try {
        const cart = req.session.cart || [];
        if (cart.length === 0) { return res.redirect('/'); }
        const user = await User.findById(req.session.userId);
        const productIds = cart.map(item => item.productId);
        const productsInDb = await Product.find({ '_id': { $in: productIds } });

        let subtotal = 0;
        const items_for_mp = cart.map(item => {
            const product = productsInDb.find(p => p._id.toString() === item.productId);
            if (!product) throw new Error('Produto no carrinho não foi encontrado.');
            const priceToUse = (product.onSale && product.salePrice > 0) ? product.salePrice : product.price;
            subtotal += item.quantity * priceToUse;
            return { id: product._id, title: product.name, quantity: item.quantity, unit_price: priceToUse, currency_id: 'BRL' };
        });

        // (Lógica de desconto e frete aqui, se houver...)
        let finalTotal = subtotal; 

        const newOrder = new Order({
            userId: req.session.userId,
            products: cart.map(item => ({ productId: item.productId, quantity: item.quantity, price: items_for_mp.find(p => p.id.toString() === item.productId).unit_price })),
            totalAmount: finalTotal, status: 'Pendente', shippingAddress: user.address
        });
        await newOrder.save();

        const mpClient = req.app.get('mpClient');
        const preference = new Preference(mpClient);
        const result = await preference.create({
            body: {
                items: items_for_mp,
                payer: { name: user.name, email: user.email },
                back_urls: {
                    success: `${process.env.BASE_URL}/checkout/status`,
                    failure: `${process.env.BASE_URL}/checkout/status`,
                    pending: `${process.env.BASE_URL}/checkout/status`
                },
                // auto_return: 'approved', // <--- LINHA REMOVIDA
                external_reference: newOrder._id.toString(),
                notification_url: `${process.env.BASE_URL}/checkout/webhook`
            }
        });
        req.session.cart = [];
        req.session.discount = null;
        req.session.shipping = null;
        res.redirect(result.init_point);
    } catch (error) {
        console.error("❌ Erro ao criar preferência de pagamento:", error);
        next(error);
    }
});

// PÁGINA DE STATUS PÓS-PAGAMENTO
router.get('/status', isAuthenticated, async (req, res, next) => {
    try {
        const { payment_id, status, external_reference } = req.query;
        if (!payment_id || !status || !external_reference) {
            req.flash('error_msg', 'Informações de pagamento inválidas.');
            return res.redirect('/');
        }
        const order = await Order.findById(external_reference).populate('userId', 'name');
        if (!order || order.userId._id.toString() !== req.session.userId) {
            req.flash('error_msg', 'Pedido não encontrado.');
            return res.redirect('/account/orders');
        }
        res.render('checkout/status', {
            pageTitle: 'Status do Pedido',
            status: status,
            order: order
        });
    } catch (error) {
        next(error);
    }
});

// WEBHOOK DO MERCADO PAGO
router.post('/webhook', async (req, res) => {
    const { query } = req;
    const topic = query.topic || query.type;
    if (topic === 'payment') {
        const paymentId = query.id || query['data.id'];
        console.log(`🔔 Webhook recebido para o pagamento: ${paymentId}`);
        try {
            const mpClient = req.app.get('mpClient');
            const payment = await new Payment(mpClient).get({ id: paymentId });
            if (payment && payment.external_reference) {
                const order = await Order.findById(payment.external_reference);
                if (order && order.status === 'Pendente') {
                    switch (payment.status) {
                        case 'approved': order.status = 'Pago'; break;
                        case 'cancelled':
                        case 'rejected': order.status = 'Cancelado'; break;
                    }
                    order.paymentId = paymentId;
                    await order.save();
                    console.log(`📦 Pedido ${order._id} atualizado para status: ${order.status}`);
                }
            }
        } catch (error) {
            console.error('❌ Erro no webhook do Mercado Pago:', error);
        }
    }
    res.status(200).send('Webhook recebido.');
});

module.exports = router;