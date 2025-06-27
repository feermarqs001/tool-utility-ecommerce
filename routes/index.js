const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const User = require('../models/User');
const Order = require('../models/Order'); // NOVO
const Review = require('../models/Review'); // NOVO
const isAuthenticated = require('../middleware/isAuthenticated');

// Rota da Página Inicial (sem mudanças)
router.get('/', async (req, res) => { /* ...código existente... */ });

// Rota de Categoria (sem mudanças)
router.get('/category/:categoryName', async (req, res) => { /* ...código existente... */ });

// Rota de Ofertas (sem mudanças)
router.get('/ofertas', async (req, res) => { /* ...código existente... */ });

// Rota de Detalhes do Produto (ATUALIZADA)
router.get('/product/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).render('404');

        // [NOVO] Busca as avaliações aprovadas para este produto
        const reviews = await Review.find({ productId: product._id, isApproved: true }).sort({ createdAt: -1 });

        // [NOVO] Verifica se o usuário logado pode avaliar o produto
        let canReview = false;
        if (req.session.isAuthenticated) {
            // Verifica se o usuário já comprou este produto
            const hasPurchased = await Order.findOne({
                userId: req.session.userId,
                'products.productId': product._id,
                status: { $in: ['Entregue', 'Pago', 'Enviado'] } // Regra de negócio: só pode avaliar se já pagou/recebeu
            });

            // Verifica se o usuário já não avaliou este produto
            const hasReviewed = await Review.findOne({
                productId: product._id,
                userId: req.session.userId
            });

            if (hasPurchased && !hasReviewed) {
                canReview = true;
            }
        }

        res.render('product-detail', {
            pageTitle: product.name,
            product: product,
            reviews: reviews, // Enviando avaliações reais
            canReview: canReview // Enviando a permissão para avaliar
        });
    } catch (error) {
        console.error(error);
        res.status(500).render('500');
    }
});


// --- [NOVO] ROTA PARA SUBMETER UMA AVALIAÇÃO ---
router.post('/product/:id/review', isAuthenticated, async (req, res) => {
    try {
        const productId = req.params.id;
        const { rating, comment } = req.body;

        // Repete a verificação de segurança no backend
        const hasPurchased = await Order.findOne({ userId: req.session.userId, 'products.productId': productId });
        if (!hasPurchased) {
            req.flash('error_msg', 'Você só pode avaliar produtos que já comprou.');
            return res.redirect(`/product/${productId}`);
        }

        const existingReview = await Review.findOne({ productId: productId, userId: req.session.userId });
        if (existingReview) {
            req.flash('error_msg', 'Você já avaliou este produto.');
            return res.redirect(`/product/${productId}`);
        }

        const newReview = new Review({
            productId: productId,
            userId: req.session.userId,
            userName: req.session.userName,
            rating: parseInt(rating, 10),
            comment: comment
        });

        await newReview.save();
        req.flash('success_msg', 'Sua avaliação foi enviada e aguarda moderação. Obrigado!');
        res.redirect(`/product/${productId}`);

    } catch (error) {
        req.flash('error_msg', 'Ocorreu um erro ao enviar sua avaliação.');
        res.redirect(`/product/${req.params.id}`);
    }
});


// Rota de Contato e outras rotas existentes...
// ...

module.exports = router;