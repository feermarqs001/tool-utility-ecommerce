const express = require('express');
const router = express.Router();
const isAuthenticated = require('../middleware/isAuthenticated');
const User = require('../models/User');
const Order = require('../models/Order');

// Todas as rotas aqui são protegidas, o utilizador precisa de estar logado
router.use(isAuthenticated);

// ROTA PRINCIPAL DA CONTA: GET /account
router.get('/', async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        if (!user) {
            req.flash('error_msg', 'Utilizador não encontrado.');
            return res.redirect('/auth/login');
        }
        res.render('account/index', {
            pageTitle: 'Minha Conta',
            user: user
        });
    } catch (error) {
        console.error("Erro ao carregar página da conta:", error);
        req.flash('error_msg', 'Erro ao carregar a sua página.');
        res.redirect('/');
    }
});

// ROTA PARA ATUALIZAR OS DADOS DA CONTA: POST /account
router.post('/', async (req, res) => {
    try {
        const { name, email, street, number, complement, neighborhood, city, state, zipCode } = req.body;
        
        await User.findByIdAndUpdate(req.session.userId, {
            name,
            email,
            address: { street, number, complement, neighborhood, city, state, zipCode }
        });

        req.flash('success_msg', 'Os seus dados foram atualizados com sucesso!');
        res.redirect('/account');
    } catch (error) {
        console.error("Erro ao atualizar dados da conta:", error);
        req.flash('error_msg', 'Ocorreu um erro ao atualizar os seus dados.');
        res.redirect('/account');
    }
});

// ROTA "MEUS PEDIDOS": GET /account/orders (COM A CORREÇÃO)
router.get('/orders', async (req, res) => {
    try {
        // [CORREÇÃO APLICADA AQUI] Adicionamos o .populate para buscar os dados dos produtos
        const orders = await Order.find({ userId: req.session.userId })
            .sort({ createdAt: -1 })
            .populate('products.productId', 'name imageUrls'); // Esta é a linha corrigida
        
        res.render('account/orders', {
            pageTitle: 'Meus Pedidos',
            orders: orders
        });
    } catch (error) {
        console.error("Erro ao buscar pedidos do utilizador:", error);
        req.flash('error_msg', 'Não foi possível carregar os seus pedidos.');
        res.redirect('/account');
    }
});


module.exports = router;