const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const isAuthenticated = require('../middleware/isAuthenticated');
const isAdmin = require('../middleware/isAdmin');

// Importação de todos os Models necessários
const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');
const Coupon = require('../models/Coupon');
const Review = require('../models/Review');
const ShippingConfig = require('../models/ShippingConfig');

// Aplica a segurança a TODAS as rotas de admin
router.use(isAuthenticated, isAdmin);

// --- ROTA PRINCIPAL: DASHBOARD ---
router.get('/', async (req, res, next) => {
    try {
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
            salesData
        });
    } catch (error) {
        console.error("Erro ao carregar o dashboard de admin:", error);
        next(error); 
    }
});

// --- REGRAS DE VALIDAÇÃO REUTILIZÁVEIS PARA PRODUTOS ---
const productValidationRules = [
    body('name', 'O nome do produto é obrigatório.').trim().notEmpty(),
    body('description', 'A descrição é obrigatória.').trim().notEmpty(),
    body('price', 'O preço deve ser um número válido.').isFloat({ gt: 0 }).toFloat(),
    body('category', 'A categoria é obrigatória.').trim().notEmpty(),
    body('stock', 'O estoque deve ser um número inteiro.').isInt({ min: 0 }).toInt(),
    body('imageUrls', 'Forneça ao menos uma URL de imagem.').trim().notEmpty(),
    body('weight', 'O peso deve ser um número válido.').optional({ checkFalsy: true }).isFloat({ gt: 0 }).toFloat(),
    body('length', 'O comprimento deve ser um número válido.').optional({ checkFalsy: true }).isFloat({ gt: 0 }).toFloat(),
    body('width', 'A largura deve ser um número válido.').optional({ checkFalsy: true }).isFloat({ gt: 0 }).toFloat(),
    body('height', 'A altura deve ser um número válido.').optional({ checkFalsy: true }).isFloat({ gt: 0 }).toFloat(),
    body('salePrice', 'O preço promocional deve ser um número.').optional({ checkFalsy: true }).isFloat().toFloat()
];

// --- ROTAS DE PRODUTOS ---
router.get('/products', async (req, res, next) => {
    try {
        const products = await Product.find().sort({ createdAt: -1 });
        res.render('admin/products', { pageTitle: 'Gerenciar Produtos', products });
    } catch (error) {
        next(error);
    }
});

router.get('/products/add', (req, res) => {
    res.render('admin/add-product', { pageTitle: 'Adicionar Produto' });
});

router.post('/products/add', productValidationRules, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        req.flash('error_msg', errors.array().map(e => e.msg).join(', '));
        return res.status(400).redirect('/admin/products/add');
    }

    try {
        const { name, description, price, category, stock, imageUrls, onSale, salePrice, weight, length, width, height } = req.body;
        await Product.create({ 
            name, description, price, category, stock, 
            onSale: !!onSale,
            salePrice: !!onSale ? salePrice : null,
            imageUrls: imageUrls.split('\n').map(url => url.trim()).filter(Boolean),
            weight, 
            dimensions: { length, width, height }
        });
        req.flash('success_msg', 'Produto criado com sucesso!');
        res.redirect('/admin/products');
    } catch (error) {
        req.flash('error_msg', 'Erro ao salvar produto. Verifique se os dados estão corretos.');
        res.redirect('/admin/products/add');
    }
});

router.get('/products/edit/:id', [param('id').isMongoId()], async (req, res, next) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            req.flash('error_msg', 'Produto não encontrado.');
            return res.redirect('/admin/products');
        }
        res.render('admin/edit-product', { pageTitle: `Editar: ${product.name}`, product });
    } catch (error) {
        next(error);
    }
});

router.post('/products/edit/:id', [param('id').isMongoId(), ...productValidationRules], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        req.flash('error_msg', errors.array().map(e => e.msg).join(', '));
        return res.status(400).redirect(`/admin/products/edit/${req.params.id}`);
    }

    try {
        const { name, description, price, category, stock, imageUrls, onSale, salePrice, weight, length, width, height } = req.body;
        await Product.findByIdAndUpdate(req.params.id, {
            name, description, price, category, stock,
            onSale: !!onSale,
            salePrice: !!onSale ? salePrice : null,
            imageUrls: imageUrls.split('\n').map(url => url.trim()).filter(Boolean),
            weight,
            dimensions: { length, width, height }
        });
        req.flash('success_msg', 'Produto atualizado com sucesso!');
        res.redirect('/admin/products');
    } catch (error) {
        req.flash('error_msg', 'Erro ao atualizar produto.');
        res.redirect(`/admin/products/edit/${req.params.id}`);
    }
});

router.post('/products/delete/:id', [param('id').isMongoId()], async (req, res) => {
    try {
        await Product.findByIdAndDelete(req.params.id);
        req.flash('success_msg', 'Produto deletado com sucesso.');
        res.redirect('/admin/products');
    } catch (error) {
        req.flash('error_msg', 'Erro ao deletar produto.');
        res.redirect('/admin/products');
    }
});

// --- ROTAS DE PEDIDOS ---
router.get('/orders', async (req, res, next) => {
    try {
        const orders = await Order.find().sort({ createdAt: -1 }).populate('userId', 'name');
        res.render('admin/orders', { 
            pageTitle: 'Gerenciar Pedidos', 
            orders: orders 
        });
    } catch (error) {
        next(error);
    }
});

// --- ROTAS DE CUPONS (CRUD COMPLETO) ---
router.get('/coupons', async (req, res, next) => {
    try {
        const coupons = await Coupon.find().sort({ createdAt: -1 });
        res.render('admin/coupons', { 
            pageTitle: 'Gerenciar Cupons', 
            coupons: coupons 
        });
    } catch (error) {
        next(error);
    }
});

router.get('/coupons/add', (req, res) => {
    res.render('admin/add-coupon', { pageTitle: 'Adicionar Cupom' });
});

router.post('/coupons/add', [
    body('code', 'O código do cupom é obrigatório').trim().notEmpty(),
    body('discountType', 'Selecione o tipo de desconto').isIn(['Percentage', 'Fixed']),
    body('discountValue', 'O valor do desconto é obrigatório e deve ser um número').isFloat({ gt: 0 }),
    body('expiryDate', 'A data de expiração é obrigatória').isISO8601().toDate()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        req.flash('error_msg', errors.array().map(e => e.msg).join(', '));
        return res.status(400).redirect('/admin/coupons/add');
    }

    try {
        await Coupon.create(req.body);
        req.flash('success_msg', 'Cupom criado com sucesso!');
        res.redirect('/admin/coupons');
    } catch (error) {
        req.flash('error_msg', 'Erro ao criar cupom. O código já pode existir.');
        res.redirect('/admin/coupons/add');
    }
});

router.post('/coupons/delete/:id', [param('id').isMongoId()], async (req, res) => {
    try {
        await Coupon.findByIdAndDelete(req.params.id);
        req.flash('success_msg', 'Cupom deletado com sucesso.');
        res.redirect('/admin/coupons');
    } catch (error) {
        req.flash('error_msg', 'Erro ao deletar cupom.');
        res.redirect('/admin/coupons');
    }
});

// --- ROTAS DE USUÁRIOS ---
router.get('/users', async (req, res, next) => {
    try {
        const users = await User.find().sort({ createdAt: -1 });
        res.render('admin/users', { 
            pageTitle: 'Gerenciar Usuários', 
            users: users 
        });
    } catch (error) {
        next(error);
    }
});

// --- ROTAS DE CONFIGURAÇÃO DE FRETE ---
router.get('/shipping', async (req, res, next) => {
    try {
        const config = await ShippingConfig.findOne();
        res.render('admin/shipping', { pageTitle: 'Configurar Frete', config: config || {} });
    } catch (error) {
        next(error);
    }
});

router.post('/shipping', [
    body('localCity', 'A cidade para entrega local é obrigatória.').trim().notEmpty(),
    body('localCost', 'O custo local deve ser um número.').isFloat({ min: 0 }).toFloat()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        req.flash('error_msg', errors.array().map(e => e.msg).join(', '));
        return res.status(400).redirect('/admin/shipping');
    }

    try {
        const { localCity, localCost } = req.body;
        await ShippingConfig.findOneAndUpdate({}, { localCity, localCost }, { upsert: true, new: true, setDefaultsOnInsert: true });
        req.flash('success_msg', 'Configurações de frete salvas com sucesso!');
        res.redirect('/admin/shipping');
    } catch (error) {
        req.flash('error_msg', 'Erro ao salvar configurações de frete.');
        res.redirect('/admin/shipping');
    }
});

// --- ROTAS DE MODERAÇÃO DE AVALIAÇÕES ---
router.get('/reviews', async (req, res, next) => {
    try {
        const reviews = await Review.find().sort({ createdAt: -1 }).populate('productId', 'name').populate('userId', 'name');
        res.render('admin/reviews', { pageTitle: 'Moderar Avaliações', reviews });
    } catch (error) {
        next(error);
    }
});

const reviewIdValidation = [ param('id', 'ID da avaliação inválido.').isMongoId() ];

router.post('/reviews/approve/:id', reviewIdValidation, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        req.flash('error_msg', 'ID de avaliação inválido.');
        return res.status(400).redirect('/admin/reviews');
    }
    try {
        await Review.findByIdAndUpdate(req.params.id, { isApproved: true });
        req.flash('success_msg', 'Avaliação aprovada com sucesso.');
        res.redirect('/admin/reviews');
    } catch (error) {
        req.flash('error_msg', 'Erro ao aprovar avaliação.');
        res.redirect('/admin/reviews');
    }
});

router.post('/reviews/delete/:id', reviewIdValidation, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        req.flash('error_msg', 'ID de avaliação inválido.');
        return res.status(400).redirect('/admin/reviews');
    }
    try {
        await Review.findByIdAndDelete(req.params.id);
        req.flash('success_msg', 'Avaliação deletada com sucesso.');
        res.redirect('/admin/reviews');
    } catch (error) {
        req.flash('error_msg', 'Erro ao deletar avaliação.');
        res.redirect('/admin/reviews');
    }
});

module.exports = router;