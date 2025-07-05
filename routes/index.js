const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');

// Models e Middleware
const Product = require('../models/Product');
const Review = require('../models/Review');
const Order = require('../models/Order');
const isAuthenticated = require('../middleware/isAuthenticated');

// ===============================================
// ||         ROTAS DE PÁGINAS PRINCIPAIS       ||
// ===============================================

// ROTA DA PÁGINA INICIAL (VERSÃO DE DEBUG)
router.get('/', async (req, res, next) => {
    console.log("--- [DEBUG] Acessando a rota da página inicial ---");
    try {
        const [featuredProducts, recentProducts] = await Promise.all([
            Product.find().limit(8),
            Product.find().sort({ createdAt: -1 }).limit(8)
        ]);

        // --- [DEBUG] Vamos inspecionar o que o banco de dados retornou ---
        console.log("Quantidade de Produtos em Destaque Encontrados:", featuredProducts.length);
        console.log("Produtos em Destaque (dados):", featuredProducts);
        
        console.log("Quantidade de Produtos Recentes Encontrados:", recentProducts.length);
        console.log("Produtos Recentes (dados):", recentProducts);

        res.render('index', { 
            pageTitle: 'Página Inicial',
            featuredProducts,
            recentProducts
        });
    } catch (error) {
        console.error("--- [DEBUG] Ocorreu um erro na rota inicial ---", error);
        next(error);
    }
});

// ROTA DE CATEGORIA
router.get('/category/:categoryName', async (req, res, next) => {
    try {
        const { categoryName } = req.params;
        const products = await Product.find({ category: categoryName });
        res.render('category', {
            pageTitle: `Categoria: ${categoryName}`,
            products,
            categoryName
        });
    } catch (error) {
        next(error);
    }
});

// ROTA PARA PÁGINA "SOBRE NÓS"
router.get('/sobre', (req, res) => {
    res.render('about', { pageTitle: 'Sobre Nós' });
});

// ROTA PARA PÁGINA DE CONTATO (GET)
router.get('/contato', (req, res) => {
    res.render('contact', { pageTitle: 'Contato' });
});

// ===============================================
// ||         ROTA DE OFERTAS (ADICIONADA)      ||
// ===============================================

// ROTA PARA A PÁGINA DE OFERTAS
router.get('/offers', async (req, res, next) => {
    try {
        // Encontra no banco de dados todos os produtos onde 'onSale' é verdadeiro
        const saleProducts = await Product.find({ onSale: true });

        // Renderiza o arquivo 'offers.ejs' e passa os produtos para ele
        res.render('offers', { 
            pageTitle: 'Ofertas Imperdíveis',
            products: saleProducts 
        });
    } catch (error) {
        // Se der algum erro no processo, ele será capturado aqui
        next(error);
    }
});


// ===============================================
// ||         ROTAS DE PRODUTO E AVALIAÇÕES     ||
// ===============================================

// ROTA DE DETALHES DO PRODUTO (OTIMIZADA)
router.get('/product/:id', [
    param('id', 'ID de produto inválido').isMongoId()
], async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(404).render('404', { pageTitle: 'Página Não Encontrada' });
    }

    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).render('404', { pageTitle: 'Página Não Encontrada' });
        }

        const [reviews, hasPurchased, hasReviewed] = await Promise.all([
            Review.find({ productId: product._id, isApproved: true }).sort({ createdAt: -1 }),
            req.session.isAuthenticated ? Order.findOne({
                userId: req.session.userId,
                'products.productId': product._id,
                status: { $in: ['Entregue', 'Pago', 'Enviado'] }
            }) : Promise.resolve(null),
            req.session.isAuthenticated ? Review.findOne({
                productId: product._id,
                userId: req.session.userId
            }) : Promise.resolve(null)
        ]);

        const canReview = !!(hasPurchased && !hasReviewed);

        res.render('product-detail', {
            pageTitle: product.name,
            product: product,
            reviews: reviews,
            canReview: canReview
        });
    } catch (error) {
        next(error);
    }
});

// ROTA PARA SUBMETER UMA AVALIAÇÃO (COM VALIDAÇÃO)
router.post('/product/:id/review', isAuthenticated, [
    param('id', 'ID de produto inválido').isMongoId(),
    body('rating', 'Por favor, selecione uma nota de 1 a 5.').isInt({ min: 1, max: 5 }),
    body('comment', 'O comentário não pode estar vazio.').trim().notEmpty()
], async (req, res, next) => {
    const productId = req.params.id;
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        req.flash('error_msg', errors.array().map(e => e.msg).join(', '));
        return res.redirect(`/product/${productId}`);
    }

    try {
        const { rating, comment } = req.body;
        const [hasPurchased, existingReview] = await Promise.all([
            Order.findOne({ userId: req.session.userId, 'products.productId': productId, status: { $in: ['Entregue', 'Pago', 'Enviado'] } }),
            Review.findOne({ productId: productId, userId: req.session.userId })
        ]);
        if (!hasPurchased) {
            req.flash('error_msg', 'Você só pode avaliar produtos que já comprou.');
            return res.redirect(`/product/${productId}`);
        }
        if (existingReview) {
            req.flash('error_msg', 'Você já avaliou este produto.');
            return res.redirect(`/product/${productId}`);
        }
        await Review.create({
            productId,
            userId: req.session.userId,
            userName: req.session.userName,
            rating: parseInt(rating, 10),
            comment
        });
        req.flash('success_msg', 'Sua avaliação foi enviada e aguarda moderação. Obrigado!');
        res.redirect(`/product/${productId}`);
    } catch (error) {
        next(error);
    }
});


// ===============================================
// ||         ROTA DE FORMULÁRIO DE CONTATO     ||
// ===============================================

// ROTA PARA PROCESSAR FORMULÁRIO DE CONTATO (POST)
router.post('/contato', [
    body('name', 'O nome é obrigatório.').trim().notEmpty(),
    body('email', 'Por favor, insira um email válido.').isEmail().normalizeEmail(),
    body('message', 'A mensagem não pode estar vazia.').trim().notEmpty()
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        req.flash('error_msg', errors.array().map(e => e.msg).join(', '));
        return res.redirect('/contato');
    }
    
    const { name, email, message } = req.body;

    // Em um projeto real, aqui você usaria um serviço como Nodemailer ou SendGrid para enviar um email.
    // Para nosso projeto-vitrine, vamos simular o sucesso e logar os dados no console.
    console.log('--- Nova Mensagem de Contato ---');
    console.log(`Nome: ${name}`);
    console.log(`Email: ${email}`);
    console.log(`Mensagem: ${message}`);
    console.log('--------------------------------');

    req.flash('success_msg', 'Sua mensagem foi enviada com sucesso! Entraremos em contato em breve.');
    res.redirect('/contato');
});


module.exports = router;