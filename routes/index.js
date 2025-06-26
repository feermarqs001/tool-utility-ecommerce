const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const User = require('../models/User');
const isAuthenticated = require('../middleware/isAuthenticated');
const generateFakeReviews = require('../helpers/fakeReviewGenerator');

// Rota da Página Inicial
router.get('/', async (req, res) => {
    try {
        const [products, categories] = await Promise.all([
            Product.find().sort({ createdAt: -1 }),
            Product.distinct('category') 
        ]);
        res.render('index', { pageTitle: 'Tool Utility', products, categories });
    } catch (error) { res.status(500).send("Erro ao carregar a página inicial."); }
});

// Rota de Categoria
router.get('/category/:categoryName', async (req, res) => {
    try {
        const { categoryName } = req.params;
        const products = await Product.find({ category: categoryName });
        const categories = await Product.distinct('category');
        res.render('category', { pageTitle: `Categoria: ${categoryName}`, products, categories, categoryName });
    } catch (error) { res.status(500).send("Erro ao carregar categoria."); }
});

// Rota de Ofertas
router.get('/ofertas', async (req, res) => {
    try {
        const productsOnSale = await Product.find({ onSale: true });
        const categories = await Product.distinct('category');
        res.render('offers', { pageTitle: 'Ofertas', products: productsOnSale, categories });
    } catch (error) { res.status(500).send("Erro ao carregar ofertas."); }
});


// Rota de Detalhes do Produto
router.get('/product/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).send('Produto não encontrado');
        const fakeReviews = generateFakeReviews(product.category);
        res.render('product-detail', { pageTitle: product.name, product, reviews: fakeReviews }); 
    } catch(error) { res.status(500).send('Erro ao buscar produto.'); }
});

// Rota "Minha Conta"
router.get('/minha-conta', isAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        if (!user) return res.redirect('/auth/login');
        res.render('minha-conta', { pageTitle: 'Minha Conta', user: user });
    } catch (error) { res.redirect('/'); }
});

// Rota de Contato
router.get('/contato', (req, res) => { res.render('contact', { pageTitle: 'Fale Conosco' }); });
router.post('/contato', (req, res) => {
    console.log('Mensagem de contato:', req.body);
    req.flash('success_msg', 'Sua mensagem foi enviada com sucesso!');
    res.redirect('/contato');
});

module.exports = router;