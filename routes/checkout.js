/**
 * =================================================================
 * |                     PROJETO TOOL UTILITY                      |
 * =================================================================
 * |       Desenvolvido por: Fernando Marques                      |
 * |       Contato: feermarquesc16@icloud.com                        |
 * |       Data da Versão: 25/06/2025                             |
 * |       Descrição: Gerencia o carrinho, cupons e o fluxo de      |
 * |       pagamento com Mercado Pago.                              |
 * =================================================================
 */

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Product = require('../models/Product');
const User = require('../models/User');
const Coupon = require('../models/Coupon');
const Order = require('../models/Order');
const isAuthenticated = require('../middleware/isAuthenticated');

// --- IMPORTAÇÕES DO MERCADO PAGO ---
const { Preference, Payment } = require('mercadopago');

// ... (todas as outras rotas de carrinho e cupom continuam aqui, sem alterações) ...
router.post('/add-to-cart/:id', async (req, res) => {
    const productId = req.params.id;
    if (!req.session.cart) {
        req.session.cart = [];
    }
    try {
        const cart = req.session.cart;
        const productInCart = cart.find(item => item.productId === productId);
        if (productInCart) {
            productInCart.quantity++;
        } else {
            cart.push({ productId: productId, quantity: 1 });
        }
        req.flash('success_msg', 'Produto adicionado ao carrinho!');
        res.redirect(req.get('referer') || '/');
    } catch (err) {
        req.flash('error_msg', 'Não foi possível adicionar o produto.');
        res.redirect(req.get('referer') || '/');
    }
});

router.get('/cart', async (req, res) => {
    const sessionCart = req.session.cart || [];
    if (sessionCart.length === 0) {
        return res.render('cart', { cart: [], total: 0, pageTitle: 'Carrinho de Compras' });
    }
    try {
        const productIds = sessionCart.map(item => item.productId).filter(id => mongoose.Types.ObjectId.isValid(id));
        const productsFromDB = await Product.find({ '_id': { $in: productIds } });

        let total = 0;
        const detailedCart = sessionCart.map(item => {
            const productData = productsFromDB.find(p => p._id.toString() === item.productId);
            if (productData) {
                const price = (productData.onSale && productData.salePrice > 0) ? productData.salePrice : productData.price;
                total += price * item.quantity;
                return { product: productData, quantity: item.quantity };
            }
            return null;
        }).filter(item => item !== null);

        req.session.cart = detailedCart.map(item => ({ productId: item.product._id.toString(), quantity: item.quantity }));

        res.render('cart', {
            cart: detailedCart,
            total: total,
            pageTitle: 'Carrinho de Compras'
        });
    } catch (error) {
        console.error("Erro ao montar o carrinho:", error);
        res.redirect('/');
    }
});

router.get('/review', isAuthenticated, async (req, res) => {
    const sessionCart = req.session.cart || [];
    if (sessionCart.length === 0) return res.redirect('/');

    try {
        const user = await User.findById(req.session.userId);
        const productIds = sessionCart.map(item => item.productId).filter(id => mongoose.Types.ObjectId.isValid(id));
        const productsFromDB = await Product.find({ '_id': { $in: productIds } });

        let subtotal = 0;
        const detailedCart = sessionCart.map(item => {
            const productData = productsFromDB.find(p => p._id.toString() === item.productId);
            if (productData) {
                const price = (productData.onSale && productData.salePrice > 0) ? productData.salePrice : productData.price;
                subtotal += price * item.quantity;
                return { product: productData, quantity: item.quantity };
            }
            return null;
        }).filter(item => item !== null);

        req.session.cart = detailedCart.map(item => ({ productId: item.product._id.toString(), quantity: item.quantity }));

        let discountAmount = req.session.discount ? req.session.discount.amount : 0;
        const total = subtotal - discountAmount;

        res.render('review-order', {
            pageTitle: 'Revisão do Pedido', user, cart: detailedCart, subtotal, discount: discountAmount,
            total: total, appliedCoupon: req.session.discount ? req.session.discount.code : null
        });
    } catch (error) {
        req.flash('error_msg', 'Erro ao carregar a página de revisão.');
        res.redirect('/checkout/cart');
    }
});

router.get('/cart/increase/:id', (req, res) => {
    const cart = req.session.cart || [];
    const item = cart.find(i => i.productId === req.params.id);
    if (item) item.quantity++;
    res.redirect('/checkout/cart');
});

router.get('/cart/decrease/:id', (req, res) => {
    const cart = req.session.cart || [];
    const item = cart.find(i => i.productId === req.params.id);
    if (item && item.quantity > 1) {
        item.quantity--;
    } else {
        req.session.cart = cart.filter(i => i.productId !== req.params.id);
    }
    res.redirect('/checkout/cart');
});

router.get('/cart/remove/:id', (req, res) => {
    req.session.cart = (req.session.cart || []).filter(i => i.productId !== req.params.id);
    req.flash('success_msg', 'Produto removido do carrinho.');
    res.redirect('/checkout/cart');
});

router.post('/apply-coupon', isAuthenticated, async (req, res) => {
    const { couponCode } = req.body;
    const cart = req.session.cart || [];
    if (cart.length === 0) return res.redirect('/checkout/review');
    try {
        const coupon = await Coupon.findOne({ code: couponCode.toUpperCase(), isActive: true });
        if (!coupon || (coupon.expiresAt && coupon.expiresAt < new Date())) {
            req.flash('error_msg', 'Cupom inválido ou expirado.');
            delete req.session.discount;
            return res.redirect('/checkout/review');
        }
        if (coupon.firstPurchaseOnly) {
            const pastOrders = await Order.findOne({ userId: req.session.userId });
            if (pastOrders) {
                req.flash('error_msg', 'Este cupom é válido apenas para a primeira compra.');
                return res.redirect('/checkout/review');
            }
        }

        const productIds = cart.map(item => item.productId);
        const products = await Product.find({ '_id': { $in: productIds } });
        const subtotal = cart.reduce((sum, item) => {
            const productData = products.find(p => p._id.toString() === item.productId);
            const price = (productData.onSale && productData.salePrice > 0) ? productData.salePrice : productData.price;
            return sum + (price * item.quantity);
        }, 0);
        let discountAmount = 0;
        if (coupon.discountType === 'percentage') {
            discountAmount = (subtotal * coupon.discountValue) / 100;
        } else {
            discountAmount = coupon.discountValue > subtotal ? subtotal : coupon.discountValue;
        }
        req.session.discount = { code: coupon.code, amount: discountAmount };
        req.flash('success_msg', 'Cupom aplicado com sucesso!');
        res.redirect('/checkout/review');
    } catch (error) {
        req.flash('error_msg', 'Ocorreu um erro ao aplicar o cupom.');
        res.redirect('/checkout/review');
    }
});

router.get('/remove-coupon', isAuthenticated, (req, res) => {
    delete req.session.discount;
    req.flash('success_msg', 'Cupom removido.');
    res.redirect('/checkout/review');
});

// ===================================================================
// ===================================================================
// --- INÍCIO DA LÓGICA DE PAGAMENTO COM MERCADO PAGO ---
// ===================================================================
// ===================================================================

// ROTA PARA CRIAR A PREFERÊNCIA DE PAGAMENTO
router.post('/create-payment-preference', isAuthenticated, async (req, res) => {
    const sessionCart = req.session.cart || [];
    const userId = req.session.userId;

    if (sessionCart.length === 0) {
        req.flash('error_msg', 'Seu carrinho está vazio.');
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
        
        let shippingCost = 0; // Frete é grátis, mas preparado para o futuro
        const total = (subtotal - discountAmount) + shippingCost;
        
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
        
        // --- [CORRIGIDO] ADICIONAMOS OS DOIS LOGS ---
        console.log('PEDIDO CRIADO COM external_reference:', newOrder._id.toString());
        
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

        // LOG PARA O ID DA PREFERÊNCIA, CASO PRECISEMOS DELE
        console.log('PREFERÊNCIA CRIADA COM SUCESSO. ID DA PREFERÊNCIA:', result.id);

        newOrder.paymentId = result.id;
        await newOrder.save();

        res.redirect(result.init_point);

    } catch (error) {
        console.error("Erro ao criar preferência de pagamento:", error);
        req.flash('error_msg', 'Não foi possível iniciar o pagamento. Tente novamente.');
        res.redirect('/checkout/review');
    }
});


// ROTA DE WEBHOOK PARA RECEBER NOTIFICAÇÕES DO MERCADO PAGO
router.post('/webhook', async (req, res) => {
    const notification = req.body;
    if (notification.type === 'payment') {
        const paymentId = notification.data.id;
        console.log(`Webhook recebido para o pagamento: ${paymentId}`);
        try {
            const mpClient = req.app.get('mpClient');
            const payment = new Payment(mpClient);
            const paymentDetails = await payment.get({ id: paymentId });
            
            const order = await Order.findById(paymentDetails.external_reference);

            if (order && order.status === 'Pendente') { // Processa apenas se o pedido ainda estiver pendente
                if (paymentDetails.status === 'approved') {
                    order.status = 'Pago';
                    
                    // LÓGICA CRÍTICA DE CONTROLE DE ESTOQUE
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
        } catch (error) {
            console.error('Erro ao processar webhook do Mercado Pago:', error);
            return res.sendStatus(500);
        }
    }
    res.sendStatus(200);
});


// ROTAS DE RETORNO APÓS PAGAMENTO
router.get('/payment-success', isAuthenticated, (req, res) => {
    req.session.cart = [];
    delete req.session.discount;
    req.flash('success_msg', 'Pagamento aprovado com sucesso! Seu pedido está sendo preparado.');
    res.redirect('/account');
});

router.get('/payment-failure', isAuthenticated, (req, res) => {
    req.flash('error_msg', 'Ocorreu uma falha no pagamento. Por favor, tente novamente.');
    res.redirect('/checkout/review');
});

router.get('/payment-pending', isAuthenticated, (req, res) => {
    req.session.cart = [];
    delete req.session.discount;
    req.flash('success_msg', 'Seu pagamento está pendente. Avisaremos assim que for aprovado!');
    res.redirect('/account');
});


module.exports = router;
