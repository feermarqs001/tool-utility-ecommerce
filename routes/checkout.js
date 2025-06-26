/**
 * =================================================================
 * |                     PROJETO TOOL UTILITY                      |
 * =================================================================
 * |       Desenvolvido por: Fernando Marques                      |
 * |       Contato: feermarquesc16@icloud.com                        |
 * |       Data da Versão: 26/06/2025                             |
 * |       Descrição: Gerencia o carrinho, cupons e o fluxo de      |
 * |       pagamento com Mercado Pago. (v. Segura)                  |
 * =================================================================
 */

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const crypto = require('crypto'); // Módulo nativo do Node.js para criptografia

const Product = require('../models/Product');
const User = require('../models/User');
const Coupon = require('../models/Coupon');
const Order = require('../models/Order');
const isAuthenticated = require('../middleware/isAuthenticated');

const { Preference, Payment } = require('mercadopago');

// ... (as suas outras rotas como /add-to-cart, /review, etc. continuam aqui, sem alterações) ...
router.post('/add-to-cart/:id', async (req, res) => { /* ...código existente... */ });
router.get('/cart', async (req, res) => { /* ...código existente... */ });
router.get('/review', isAuthenticated, async (req, res) => { /* ...código existente... */ });
router.get('/cart/increase/:id', (req, res) => { /* ...código existente... */ });
router.get('/cart/decrease/:id', (req, res) => { /* ...código existente... */ });
router.get('/cart/remove/:id', (req, res) => { /* ...código existente... */ });
router.post('/apply-coupon', isAuthenticated, async (req, res) => { /* ...código existente... */ });
router.get('/remove-coupon', isAuthenticated, (req, res) => { /* ...código existente... */ });

// ROTA PARA CRIAR A PREFERÊNCIA DE PAGAMENTO
router.post('/create-payment-preference', isAuthenticated, async (req, res) => {
    const sessionCart = req.session.cart || [];
    const userId = req.session.userId;

    if (sessionCart.length === 0) {
        req.flash('error_msg', 'O seu carrinho está vazio.');
        return res.redirect('/checkout/cart');
    }

    try {
        const productIds = sessionCart.map(item => item.productId);
        const productsFromDB = await Product.find({ '_id': { $in: productIds } });

        let subtotal = 0;
        const orderProducts = [];
        for (const item of sessionCart) {
            const productData = productsFromDB.find(p => p._id.toString() === item.productId);
            if (productData) {
                const price = (productData.onSale && productData.salePrice > 0) ? productData.salePrice : productData.price;
                subtotal += price * item.quantity;
                orderProducts.push({ productId: productData._id, quantity: item.quantity, price: price });
            }
        }
        const discountAmount = req.session.discount ? req.session.discount.amount : 0;
        
        const total = (subtotal - discountAmount);
        
        const user = await User.findById(userId);
        if (!user.address || !user.address.street) {
             req.flash('error_msg', 'Por favor, cadastre um endereço de entrega em "Minha Conta" antes de finalizar a compra.');
             return res.redirect('/checkout/review');
        }

        const newOrder = new Order({
            userId: userId, products: orderProducts, totalAmount: total,
            shippingAddress: user.address, status: 'Pendente'
        });
        await newOrder.save();
        
        const preferenceItems = orderProducts.map(item => {
            const productData = productsFromDB.find(p => p._id.equals(item.productId));
            return {
                id: productData._id.toString(), title: productData.name,
                quantity: item.quantity, unit_price: item.price, currency_id: 'BRL'
            };
        });

        if (discountAmount > 0) {
            preferenceItems.push({
                id: 'desconto', title: `Cupom: ${req.session.discount.code}`,
                quantity: 1, unit_price: -discountAmount, currency_id: 'BRL'
            });
        }

        const preferenceBody = {
            items: preferenceItems,
            payer: { name: user.name, email: user.email },
            back_urls: {
                success: `${process.env.BASE_URL}/checkout/payment-success`,
                failure: `${process.env.BASE_URL}/checkout/payment-failure`,
                pending: `${process.env.BASE_URL}/checkout/payment-pending`
            },
            external_reference: newOrder._id.toString(),
            notification_url: `${process.env.BASE_URL}/checkout/webhook`
        };
        
        const mpClient = req.app.get('mpClient');
        const preference = new Preference(mpClient);
        const result = await preference.create({ body: preferenceBody });

        newOrder.paymentId = result.id;
        await newOrder.save();

        res.redirect(result.init_point);

    } catch (error) {
        console.error("Erro ao criar preferência de pagamento:", error);
        req.flash('error_msg', 'Não foi possível iniciar o pagamento. Tente novamente.');
        res.redirect('/checkout/review');
    }
});


// ===================================================================
// --- ROTA DE WEBHOOK COM VALIDAÇÃO DE SEGURANÇA ---
// ===================================================================
router.post('/webhook', async (req, res) => {
    try {
        // --- 1. Validação da Assinatura (Segurança Crítica) ---
        const webhookSecret = process.env.MP_WEBHOOK_SECRET;
        const signature = req.get('x-signature');
        const receivedBody = req.body;

        if (!signature || !webhookSecret) {
            console.warn('Webhook ignorado: Assinatura ou segredo em falta.');
            return res.sendStatus(400);
        }

        // Para validar, precisamos de recriar a 'manifest' que o MP usa.
        const parts = signature.split(',').reduce((acc, part) => {
            const [key, value] = part.split('=');
            acc[key.trim()] = value.trim();
            return acc;
        }, {});
        
        const manifest = `id:${receivedBody.data.id};ts:${parts.ts};`;

        // Criamos o nosso 'hash' usando o segredo
        const hmac = crypto.createHmac('sha256', webhookSecret).update(manifest).digest('hex');

        // Comparamos o nosso hash com o hash que o Mercado Pago enviou
        if (hmac !== parts.v1) {
            console.warn('Webhook ignorado: Assinatura inválida. A notificação pode ser falsa.');
            return res.sendStatus(400); // Assinatura não corresponde.
        }
        
        console.log('Assinatura do webhook validada com sucesso.');

        // --- 2. Processamento da Notificação (Se a assinatura for válida) ---
        if (receivedBody.type === 'payment') {
            const paymentId = receivedBody.data.id;
            console.log(`Webhook recebido e validado para o pagamento: ${paymentId}`);

            const mpClient = req.app.get('mpClient');
            const payment = new Payment(mpClient);
            const paymentDetails = await payment.get({ id: paymentId });
            
            const order = await Order.findById(paymentDetails.external_reference);

            if (order && order.status === 'Pendente') {
                if (paymentDetails.status === 'approved') {
                    order.status = 'Pago';
                    
                    for (const item of order.products) {
                        await Product.updateOne(
                            { _id: item.productId },
                            { $inc: { stock: -item.quantity } }
                        );
                    }
                    console.log(`Estoque dos produtos do pedido ${order._id} foi atualizado.`);
                    
                    await order.save();
                    console.log(`Pedido ${order._id} atualizado para PAGO.`);
                } else if (['rejected', 'cancelled'].includes(paymentDetails.status)) {
                    order.status = 'Cancelado';
                    await order.save();
                    console.log(`Pedido ${order._id} atualizado para CANCELADO.`);
                }
            } else {
                 console.log(`Webhook ignorado: Pedido ${paymentDetails.external_reference} não encontrado ou já processado.`);
            }
        }
        
        // --- 3. Confirmação para o Mercado Pago ---
        res.sendStatus(200);

    } catch (error) {
        console.error('Erro grave ao processar webhook do Mercado Pago:', error);
        res.sendStatus(500);
    }
});


// ROTAS DE RETORNO APÓS PAGAMENTO
router.get('/payment-success', isAuthenticated, (req, res) => { /* ...código existente... */ });
router.get('/payment-failure', isAuthenticated, (req, res) => { /* ...código existente... */ });
router.get('/payment-pending', isAuthenticated, (req, res) => { /* ...código existente... */ });


module.exports = router;

