const express = require('express');
const router = express.Router();
const User = require('../models/User');
const isAuthenticated = require('../middleware/isAuthenticated');

// Todas as rotas neste arquivo são para usuários já logados
router.use(isAuthenticated);

// ROTA PARA EXIBIR O FORMULÁRIO DE EDIÇÃO DE ENDEREÇO (GET)
router.get('/edit-address', async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        res.render('edit-address', {
            pageTitle: 'Editar Meu Endereço',
            user: user
        });
    } catch (error) {
        req.flash('error_msg', 'Erro ao carregar a página de edição.');
        res.redirect('/minha-conta');
    }
});

// ROTA PARA PROCESSAR A ATUALIZAÇÃO DO ENDEREÇO (POST)
router.post('/update-address', async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        if (!user) {
            req.flash('error_msg', 'Usuário não encontrado.');
            return res.redirect('/');
        }
        const { street, number, complement, neighborhood, city, state, zipCode } = req.body;
        user.address = { street, number, complement, neighborhood, city, state, zipCode };
        await user.save();
        req.flash('success_msg', 'Endereço atualizado com sucesso!');
        res.redirect('/minha-conta');
    } catch (error) {
        req.flash('error_msg', 'Ocorreu um erro ao atualizar seu endereço.');
        res.redirect('/account/edit-address');
    }
});

module.exports = router;