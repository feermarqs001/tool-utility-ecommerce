const express = require('express');
const router = express.Router();
const isAuthenticated = require('../middleware/isAuthenticated');
const isAdmin = require('../middleware/isAdmin');

// Importação de todos os Models necessários
const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');
const Coupon = require('../models/Coupon');
const Review = require('../models/Review'); // NOVO
const ShippingConfig = require('../models/ShippingConfig'); // NOVO

// Aplica a segurança a TODAS as rotas de admin
router.use(isAuthenticated, isAdmin);

// --- ROTA PRINCIPAL: DASHBOARD ---
router.get('/', async (req, res) => {
    try {
        // [NOVO] Lógica para dados dos gráficos
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const salesData = await Order.aggregate([
            { $match: { status: 'Pago', createdAt: { $gte: sevenDaysAgo } } },
            { $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                totalSales: { $sum: "$totalAmount" }
            }},
            { $sort: { _id: 1 } }
        ]);

        const [productCount, orderCount, userCount, recentOrders] = await Promise.all([
            Product.countDocuments(),
            Order.countDocuments({ status: 'Pago' }),
            User.countDocuments(),
            Order.find().sort({ createdAt: -1 }).limit(5).populate('userId', 'name')
        ]);
        
        res.render('admin/dashboard', {
            pageTitle: 'Dashboard',
            productCount, orderCount, userCount, recentOrders,
            salesData // Enviando dados para o gráfico
        });
    } catch (error) {
        res.status(500).send("Erro ao carregar o dashboard.");
    }
});

// --- ROTAS DE PRODUTOS (CRUD ATUALIZADO) ---
// Rota de listar (sem mudanças)
router.get('/products', async (req, res) => { /* ...código existente... */ });
// Rota para form de adicionar (sem mudanças)
router.get('/products/add', (req, res) => { /* ...código existente... */ });

// Processar adição (ATUALIZADO com peso/dimensões)
router.post('/products/add', async (req, res) => {
    try {
        // [NOVO] Pegando os campos de peso e dimensões
        const { name, description, price, category, stock, imageUrls, specifications, onSale, salePrice, weight, length, width, height } = req.body;
        
        const newProduct = new Product({ 
            name, description, price, category, stock, onSale: onSale === 'on', salePrice: salePrice || null,
            imageUrls: imageUrls ? imageUrls.split('\n').map(url => url.trim()).filter(url => url) : [],
            specifications: new Map(), // Lógica de specs existente
            // [NOVO] Salvando peso e dimensões
            weight, 
            dimensions: { length, width, height }
        });
        await newProduct.save();
        req.flash('success_msg', 'Produto criado com sucesso!');
        res.redirect('/admin/products');
    } catch (error) {
        // [NOVO] Tratamento de erro de validação mais específico
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            req.flash('error_msg', messages.join(', '));
        } else {
            req.flash('error_msg', 'Erro ao salvar produto.');
        }
        res.redirect('/admin/products/add');
    }
});

// Rota para form de editar (sem mudanças)
router.get('/products/edit/:id', async (req, res) => { /* ...código existente... */ });

// Processar edição (ATUALIZADO com peso/dimensões)
router.post('/products/edit/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) { return res.status(404).send("Produto não encontrado."); }
        
        const { name, description, price, category, stock, imageUrls, onSale, salePrice, weight, length, width, height } = req.body;
        
        // [NOVO] Atualizando os campos de peso e dimensões
        product.weight = weight;
        product.dimensions.length = length;
        product.dimensions.width = width;
        product.dimensions.height = height;

        // ... resto do código de atualização ...
        await product.save();
        req.flash('success_msg', 'Produto atualizado com sucesso!');
        res.redirect('/admin/products');
    } catch (error) {
        // [NOVO] Tratamento de erro de validação
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            req.flash('error_msg', messages.join(', '));
        } else {
            req.flash('error_msg', 'Erro ao atualizar produto.');
        }
        res.redirect(`/admin/products/edit/${req.params.id}`);
    }
});

// Rota de deletar (sem mudanças)
router.post('/products/delete/:id', async (req, res) => { /* ...código existente... */ });


// --- [NOVO] ROTAS DE CONFIGURAÇÃO DE FRETE ---
router.get('/shipping', async (req, res) => {
    try {
        const config = await ShippingConfig.getConfig();
        res.render('admin/shipping', { pageTitle: 'Configurar Frete', config });
    } catch (error) {
        res.status(500).send("Erro ao carregar configurações de frete.");
    }
});

router.post('/shipping', async (req, res) => {
    try {
        const { localCity, localCost } = req.body;
        const config = await ShippingConfig.getConfig();
        config.localCity = localCity;
        config.localCost = localCost;
        await config.save();
        req.flash('success_msg', 'Configurações de frete salvas com sucesso!');
        res.redirect('/admin/shipping');
    } catch (error) {
        req.flash('error_msg', 'Erro ao salvar configurações de frete.');
        res.redirect('/admin/shipping');
    }
});


// --- [NOVO] ROTAS DE MODERAÇÃO DE AVALIAÇÕES ---
router.get('/reviews', async (req, res) => {
    try {
        const reviews = await Review.find().sort({ createdAt: -1 }).populate('productId', 'name');
        res.render('admin/reviews', { pageTitle: 'Moderar Avaliações', reviews });
    } catch (error) {
        res.status(500).send("Erro ao carregar avaliações.");
    }
});

router.post('/reviews/approve/:id', async (req, res) => {
    try {
        await Review.findByIdAndUpdate(req.params.id, { isApproved: true });
        req.flash('success_msg', 'Avaliação aprovada com sucesso.');
        res.redirect('/admin/reviews');
    } catch (error) {
        req.flash('error_msg', 'Erro ao aprovar avaliação.');
        res.redirect('/admin/reviews');
    }
});

router.post('/reviews/delete/:id', async (req, res) => {
    try {
        await Review.findByIdAndDelete(req.params.id);
        req.flash('success_msg', 'Avaliação deletada com sucesso.');
        res.redirect('/admin/reviews');
    } catch (error) {
        req.flash('error_msg', 'Erro ao deletar avaliação.');
        res.redirect('/admin/reviews');
    }
});

// --- ROTAS DE PEDIDOS, USUÁRIOS E CUPONS (sem grandes mudanças, apenas o código existente) ---
// ...

module.exports = router;