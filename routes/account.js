const express = require('express');
const router = express.Router();
const isAuthenticated = require('../middleware/isAuthenticated');
const User = require('../models/User');
const Order = require('../models/Order');

// Todas as rotas aqui são protegidas, o utilizador precisa de estar logado
router.use(isAuthenticated);

// ROTA PRINCIPAL DA CONTA: GET /account
// Esta rota resolve o erro "Cannot GET /account"
router.get('/', async (req, res) => {
    try {
        // Busca os dados mais recentes do utilizador para mostrar na página
        const user = await User.findById(req.session.userId);
        if (!user) {
            req.flash('error_msg', 'Utilizador não encontrado.');
            return res.redirect('/auth/login');
        }
        res.render('account/index', { // Vai renderizar a view 'index.ejs' que vamos criar
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
// Esta rota recebe os dados do formulário da página "Minha Conta"
router.post('/', async (req, res) => {
    try {
        const { name, email, street, number, complement, neighborhood, city, state, zipCode } = req.body;
        
        // Atualiza todos os dados no banco de dados de uma vez
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

// ROTA "MEUS PEDIDOS": GET /account/orders
// Esta rota resolve o erro "Cannot GET /meus-pedidos"
router.get('/orders', async (req, res) => {
    try {
        // Busca todos os pedidos do utilizador logado, do mais recente para o mais antigo
        const orders = await Order.find({ userId: req.session.userId }).sort({ createdAt: -1 });
        
        res.render('account/orders', { // Vai renderizar a view 'orders.ejs' que vamos criar
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
