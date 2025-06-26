const express = require('express');
const router = express.Router();
const isAuthenticated = require('../middleware/isAuthenticated');
const isAdmin = require('../middleware/isAdmin');

// Importação de todos os Models necessários
const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');
const Coupon = require('../models/Coupon');

// Aplica a segurança a TODAS as rotas de admin
router.use(isAuthenticated, isAdmin);

// --- ROTA PRINCIPAL: DASHBOARD ---
router.get('/', async (req, res) => {
    try {
        const [productCount, orderCount, userCount, recentOrders] = await Promise.all([
            Product.countDocuments(),
            Order.countDocuments(),
            User.countDocuments(),
            Order.find().sort({ createdAt: -1 }).limit(5).populate('userId', 'name')
        ]);
        res.render('admin/dashboard', {
            pageTitle: 'Dashboard',
            productCount,
            orderCount,
            userCount,
            recentOrders
        });
    } catch (error) {
        console.error("Erro ao carregar dashboard:", error);
        res.status(500).send("Erro ao carregar o dashboard.");
    }
});

// --- ROTAS DE PRODUTOS (CRUD COMPLETO) ---

// 1. READ: Listar todos os produtos
router.get('/products', async (req, res) => {
    try {
        const products = await Product.find().sort({ createdAt: -1 });
        res.render('admin/products', { pageTitle: 'Gerenciar Produtos', products });
    } catch (error) { res.status(500).send("Erro ao buscar produtos."); }
});

// 2. CREATE: Formulário para adicionar
router.get('/products/add', (req, res) => {
    res.render('admin/add-product', { pageTitle: 'Adicionar Produto' });
});

// Processar adição (com lógica de ofertas)
router.post('/products/add', async (req, res) => {
    try {
        const { name, description, price, category, stock, imageUrls, specifications, onSale, salePrice } = req.body;
        const images = imageUrls ? imageUrls.split('\n').map(url => url.trim()).filter(url => url) : [];
        const specsMap = new Map();
        if (specifications) {
            specifications.split('\n').forEach(line => {
                const [key, ...valueParts] = line.split(':');
                const value = valueParts.join(':');
                if (key && value) specsMap.set(key.trim(), value.trim());
            });
        }
        const newProduct = new Product({ 
            name, description, price, category, stock, 
            imageUrls: images, 
            specifications: specsMap,
            onSale: onSale === 'on',
            salePrice: salePrice || null
        });
        await newProduct.save();
        req.flash('success_msg', 'Produto criado com sucesso!');
        res.redirect('/admin/products');
    } catch (error) {
        req.flash('error_msg', 'Erro ao salvar produto.');
        res.redirect('/admin/products/add');
    }
});

// 3. UPDATE: Formulário para editar
router.get('/products/edit/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).send('Produto não encontrado.');
        res.render('admin/edit-product', { pageTitle: 'Editar Produto', product });
    } catch (error) { res.status(500).send("Erro ao buscar produto para edição."); }
});

// Processar edição (com lógica de ofertas)
router.post('/products/edit/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) { return res.status(404).send("Produto não encontrado."); }
        
        const { name, description, price, category, stock, imageUrls, specifications, onSale, salePrice } = req.body;
        
        product.specifications.clear();
        if (specifications) {
            specifications.split('\n').forEach(line => {
                const [key, ...valueParts] = line.split(':');
                const value = valueParts.join(':');
                if (key && value) { product.specifications.set(key.trim(), value.trim()); }
            });
        }
        
        product.name = name;
        product.description = description;
        product.price = price;
        product.category = category;
        product.stock = stock;
        product.imageUrls = imageUrls ? imageUrls.split('\n').map(url => url.trim()).filter(url => url) : [];
        product.onSale = onSale === 'on';
        product.salePrice = salePrice || null;

        await product.save();
        req.flash('success_msg', 'Produto atualizado com sucesso!');
        res.redirect('/admin/products');
    } catch (error) {
        req.flash('error_msg', 'Erro ao atualizar produto.');
        res.redirect(`/admin/products/edit/${req.params.id}`);
    }
});

// 4. DELETE: Deletar um produto
router.post('/products/delete/:id', async (req, res) => {
    try {
        await Product.findByIdAndDelete(req.params.id);
        req.flash('success_msg', 'Produto deletado com sucesso.');
        res.redirect('/admin/products');
    } catch (error) {
        req.flash('error_msg', 'Erro ao deletar produto.');
        res.redirect('/admin/products');
    }
});


// --- ROTAS DE PEDIDOS, USUÁRIOS E CUPONS ---
router.get('/orders', async (req, res) => { try { const orders = await Order.find().sort({ createdAt: -1 }).populate('userId', 'name email'); res.render('admin/orders', { pageTitle: 'Gerenciar Pedidos', orders }); } catch (error) { res.status(500).send("Erro ao buscar pedidos."); } });
router.get('/users', async (req, res) => { try { const users = await User.find().sort({ createdAt: -1 }); res.render('admin/users', { pageTitle: 'Gerenciar Usuários', users }); } catch (error) { res.status(500).send("Erro ao buscar usuários."); } });
router.get('/coupons', async (req, res) => { try { const coupons = await Coupon.find().sort({ createdAt: -1 }); res.render('admin/coupons', { pageTitle: 'Gerenciar Cupons', coupons }); } catch (error) { res.status(500).send("Erro ao buscar cupons."); } });
router.get('/coupons/add', (req, res) => { res.render('admin/add-coupon', { pageTitle: 'Adicionar Novo Cupom' }); });
router.post('/coupons/add', async (req, res) => { try { const { code, discountType, discountValue, firstPurchaseOnly, expiresAt } = req.body; await new Coupon({ code, discountType, discountValue, firstPurchaseOnly: firstPurchaseOnly === 'on', expiresAt: expiresAt || null }).save(); req.flash('success_msg', 'Cupom criado com sucesso!'); res.redirect('/admin/coupons'); } catch (error) { req.flash('error_msg', 'Erro ao criar cupom. O código já pode existir.'); res.redirect('/admin/coupons/add'); } });
router.post('/coupons/delete/:id', async (req, res) => { try { await Coupon.findByIdAndDelete(req.params.id); req.flash('success_msg', 'Cupom deletado com sucesso.'); res.redirect('/admin/coupons'); } catch (error) { req.flash('error_msg', 'Erro ao deletar cupom.'); res.redirect('/admin/coupons'); } });

// --- [NOVO] ROTA PARA MARCAR PEDIDO COMO ENVIADO ---
router.post('/orders/ship/:id', async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);

        if (!order) {
            req.flash('error_msg', 'Pedido não encontrado.');
            return res.redirect('/admin/orders');
        }

        // Apenas pedidos com status "Pago" podem ser marcados como enviados
        if (order.status === 'Pago') {
            order.status = 'Enviado';
            await order.save();
            req.flash('success_msg', 'Pedido marcado como "Enviado" com sucesso!');
        } else {
            req.flash('error_msg', 'Apenas pedidos com status "Pago" podem ser marcados como enviados.');
        }

        res.redirect('/admin/orders');

    } catch (error) {
        console.error('Erro ao marcar pedido como enviado:', error);
        req.flash('error_msg', 'Ocorreu um erro no servidor ao tentar atualizar o pedido.');
        res.redirect('/admin/orders');
    }
});


module.exports = router;
