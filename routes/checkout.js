/**
 * =================================================================
 * |                     PROJETO TOOL UTILITY                      |
 * =================================================================
 * |       Desenvolvido por: Fernando Marques                      |
 * |       Contato: feermarquesc16@icloud.com                        |
 * |       Data da Versão: 26/06/2025                                |
 * |       Descrição: Gerencia o carrinho, cupons e o fluxo de      |
 * |       pagamento com Mercado Pago. (v. Segura e Completa)       |
 * =================================================================
 */

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const crypto = require('crypto'); // Para a validação do Webhook

// --- MODELS ---
const Product = require('../models/Product');
const User = require('../models/User');
const Coupon = require('../models/Coupon');
const Order = require('../models/Order');

// --- MIDDLEWARE ---
const isAuthenticated = require('../middleware/isAuthenticated');

// --- SDK do MERCADO PAGO ---
const { Preference, Payment } = require('mercadopago');


// =================================================================
// --- SEÇÃO 1: GERENCIAMENTO DO CARRINHO ---
// =================================================================

// ADICIONAR PRODUTO AO CARRINHO
router.post('/add-to-cart/:id', async (req, res) => {
    const productId = req.params.id;
    const quantity = parseInt(req.body.quantity, 10) || 1; // Pega a quantidade do form, ou 1 por padrão

    try {
        const product = await Product.findById(productId);
        if (!product) {
            req.flash('error_msg', 'Produto não encontrado.');
            return res.redirect('back');
        }

        if (product.stock < quantity) {
            req.flash('error_msg', 'Estoque insuficiente para a quantidade desejada.');
            return res.redirect('back');
        }

        if (!req.session.cart) {
            req.session.cart = [];
        }

        const existingItem = req.session.cart.find(item => item.productId === productId);

        if (existingItem) {
            // Verifica se a nova quantidade não ultrapassa o estoque
            if (product.stock < existingItem.quantity + quantity) {
                req.flash('error_msg', 'Não é possível adicionar. A quantidade no carrinho excederia o estoque.');
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

// EXIBIR PÁGINA DO CARRINHO
router.get('/cart', async (req, res) => {
    try {
        const sessionCart = req.session.cart || [];

        if (sessionCart.length === 0) {
            return res.render('cart', {
                pageTitle: 'Meu Carrinho',
                cart: [], subtotal: 0,
                discount: req.session.discount || { amount: 0, code: null },
                total: 0
            });
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
                    quantity: item.quantity, image: productData.imageUrls[0] || '/images/placeholder.png',
                    stock: productData.stock, lineTotal: price * item.quantity
                });
            }
        }
        
        const discount = req.session.discount || { amount: 0, code: null };
        const total = subtotal - discount.amount;

        res.render('cart', {
            pageTitle: 'Meu Carrinho',
            cart: detailedCart, subtotal: subtotal,
            discount: discount, total: total > 0 ? total : 0
        });
    } catch (error) {
        console.error("Erro ao carregar o carrinho:", error);
        req.flash('error_msg', 'Ocorreu um erro ao carregar o seu carrinho.');
        res.redirect('/');
    }
});

// AUMENTAR QUANTIDADE
router.get('/cart/increase/:id', async (req, res) => {
    const productId = req.params.id;
    const cart = req.session.cart || [];
    const item = cart.find(i => i.productId === productId);

    if (item) {
        const product = await Product.findById(productId);
        if(product && item.quantity < product.stock) {
            item.quantity++;
        } else {
            req.flash('error_msg', 'Estoque máximo atingido para este produto.');
        }
    }
    res.redirect('/checkout/cart');
});

// DIMINUIR QUANTIDADE
router.get('/cart/decrease/:id', (req, res) => {
    const productId = req.params.id;
    const cart = req.session.cart || [];
    const itemIndex = cart.findIndex(i => i.productId === productId);

    if (itemIndex > -1) {
        cart[itemIndex].quantity--;
        if (cart[itemIndex].quantity <= 0) {
            cart.splice(itemIndex, 1); // Remove o item se a quantidade for 0 ou menor
        }
    }
    res.redirect('/checkout/cart');
});

// REMOVER ITEM DO CARRINHO
router.get('/cart/remove/:id', (req, res) => {
    const productId = req.params.id;
    req.session.cart = (req.session.cart || []).filter(item => item.productId !== productId);
    req.flash('success_msg', 'Produto removido do carrinho.');
    res.redirect('/checkout/cart');
});


// =================================================================
// --- SEÇÃO 2: GERENCIAMENTO DE CUPONS ---
// =================================================================

// APLICAR CUPOM DE DESCONTO
router.post('/apply-coupon', isAuthenticated, async (req, res) => {
    const { code } = req.body;
    const sessionCart = req.session.cart || [];
    
    if (sessionCart.length === 0) {
        req.flash('error_msg', 'Adicione produtos ao carrinho antes de aplicar um cupom.');
        return res.redirect('/checkout/cart');
    }

    try {
        const coupon = await Coupon.findOne({ code: code.toUpperCase() });

        if (!coupon) {
            req.flash('error_msg', 'Cupom inválido.');
            return res.redirect('/checkout/cart');
        }
        if (coupon.expiresAt && coupon.expiresAt < new Date()) {
            req.flash('error_msg', 'Este cupom expirou.');
            return res.redirect('/checkout/cart');
        }
        if(coupon.firstPurchaseOnly) {
            const orderCount = await Order.countDocuments({ userId: req.session.userId });
            if(orderCount > 0) {
                req.flash('error_msg', 'Este cupom é válido apenas para a primeira compra.');
                return res.redirect('/checkout/cart');
            }
        }
        
        const productIds = sessionCart.map(item => item.productId);
        const productsFromDB = await Product.find({ '_id': { $in: productIds } });
        let subtotal = 0;
        for (const item of sessionCart) {
            const productData = productsFromDB.find(p => p._id.toString() === item.productId);
            if (productData) {
                const price = (productData.onSale && productData.salePrice > 0) ? productData.salePrice : productData.price;
                subtotal += price * item.quantity;
            }
        }

        let discountAmount = 0;
        if(coupon.discountType === 'percentage') {
            discountAmount = (subtotal * coupon.discountValue) / 100;
        } else { // fixed
            discountAmount = coupon.discountValue;
        }
        
        req.session.discount = { code: coupon.code, amount: discountAmount };
        req.flash('success_msg', 'Cupom aplicado com sucesso!');
        res.redirect('/checkout/cart');

    } catch (error) {
        console.error("Erro ao aplicar cupom:", error);
        req.flash('error_msg', 'Ocorreu um erro ao aplicar o cupom.');
        res.redirect('/checkout/cart');
    }
});

// REMOVER CUPOM DE DESCONTO
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

// ROTA DE REVISÃO DO PEDIDO ANTES DO PAGAMENTO
router.get('/review', isAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        if (!user) {
            req.flash('error_msg', 'Usuário não encontrado.');
            return res.redirect('/auth/login');
        }

        // Reutiliza a mesma lógica do carrinho para obter os detalhes e totais
        const sessionCart = req.session.cart || [];
        if (sessionCart.length === 0) {
            req.flash('error_msg', 'Seu carrinho está vazio.');
            return res.redirect('/checkout/cart');
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
                detailedCart.push({ name: productData.name, price: price, quantity: item.quantity });
            }
        }
        
        const discount = req.session.discount || { amount: 0, code: null };
        const total = subtotal > discount.amount ? subtotal - discount.amount : 0;

        res.render('review', {
            pageTitle: 'Revisar Pedido',
            user: user,
            cart: detailedCart,
            subtotal: subtotal,
            discount: discount,
            total: total
        });

    } catch (error) {
        console.error("Erro ao carregar página de revisão:", error);
        req.flash('error_msg', 'Ocorreu um erro. Tente novamente.');
        res.redirect('/checkout/cart');
    }
});

// CRIAR PREFERÊNCIA DE PAGAMENTO NO MERCADO PAGO
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
             return res.redirect('/account'); // Redireciona para a conta, onde ele pode adicionar o endereço
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

        newOrder.paymentId = result.id; // Salva o ID da *preferência* no pedido
        await newOrder.save();

        res.redirect(result.init_point);

    } catch (error) {
        console.error("Erro ao criar preferência de pagamento:", error);
        req.flash('error_msg', 'Não foi possível iniciar o pagamento. Tente novamente.');
        res.redirect('/checkout/review');
    }
});


// WEBHOOK SEGURO PARA RECEBER NOTIFICAÇÕES DE PAGAMENTO
router.post('/webhook', async (req, res) => {
    try {
        const webhookSecret = process.env.MP_WEBHOOK_SECRET;
        const signature = req.get('x-signature');
        const receivedBody = req.body;

        if (!signature || !webhookSecret) {
            console.warn('Webhook ignorado: Assinatura ou segredo em falta.');
            return res.sendStatus(400);
        }

        const parts = signature.split(',').reduce((acc, part) => {
            const [key, value] = part.split('=');
            acc[key.trim()] = value.trim();
            return acc;
        }, {});
        
        const manifest = `id:${receivedBody.data.id};ts:${parts.ts};`;
        const hmac = crypto.createHmac('sha256', webhookSecret).update(manifest).digest('hex');

        if (hmac !== parts.v1) {
            console.warn('Webhook ignorado: Assinatura inválida.');
            return res.sendStatus(400);
        }
        
        console.log('Assinatura do webhook validada com sucesso.');

        if (receivedBody.type === 'payment') {
            const paymentId = receivedBody.data.id;
            console.log(`Webhook recebido para o pagamento: ${paymentId}`);

            const mpClient = req.app.get('mpClient');
            const payment = new Payment(mpClient);
            const paymentDetails = await payment.get({ id: paymentId });
            
            const order = await Order.findById(paymentDetails.external_reference);

            if (order && order.status === 'Pendente') {
                if (paymentDetails.status === 'approved') {
                    order.status = 'Pago';
                    order.paymentDetails = { // Salva detalhes importantes do pagamento
                        paymentId: paymentId,
                        status: paymentDetails.status,
                        payment_method_id: paymentDetails.payment_method_id,
                        payment_type_id: paymentDetails.payment_type_id,
                    };
                    
                    for (const item of order.products) {
                        await Product.updateOne({ _id: item.productId }, { $inc: { stock: -item.quantity } });
                    }
                    console.log(`Estoque do pedido ${order._id} atualizado.`);
                } else if (['rejected', 'cancelled'].includes(paymentDetails.status)) {
                    order.status = 'Cancelado';
                }
                await order.save();
                console.log(`Pedido ${order._id} atualizado para ${order.status}.`);
            } else {
                 console.log(`Webhook ignorado: Pedido ${paymentDetails.external_reference} não encontrado ou já processado.`);
            }
        }
        
        res.sendStatus(200);

    } catch (error) {
        console.error('Erro grave ao processar webhook do Mercado Pago:', error);
        res.sendStatus(500);
    }
});


// ROTAS DE RETORNO APÓS TENTATIVA DE PAGAMENTO
router.get('/payment-success', isAuthenticated, (req, res) => {
    // Limpa o carrinho e o cupom da sessão após uma compra bem-sucedida
    req.session.cart = [];
    req.session.discount = null;
    req.flash('success_msg', 'Pagamento aprovado! Obrigado pela sua compra.');
    res.render('payment-status', { pageTitle: 'Compra Aprovada', status: 'success' });
});

router.get('/payment-failure', isAuthenticated, (req, res) => {
    req.flash('error_msg', 'O pagamento foi recusado. Por favor, tente novamente com outro método de pagamento.');
    res.render('payment-status', { pageTitle: 'Pagamento Recusado', status: 'failure' });
});

router.get('/payment-pending', isAuthenticated, (req, res) => {
    req.session.cart = [];
    req.session.discount = null;
    req.flash('success_msg', 'Seu pagamento está pendente. Avisaremos quando for aprovado.');
    res.render('payment-status', { pageTitle: 'Pagamento Pendente', status: 'pending' });
});

module.exports = router;