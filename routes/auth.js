const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');

// --- Função para validar o formato do CPF ---
function isCpfValid(cpf) {
    cpf = String(cpf).replace(/[^\d]+/g, '');
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
    let sum = 0;
    let rest;
    for (let i = 1; i <= 9; i++) sum += parseInt(cpf.substring(i - 1, i)) * (11 - i);
    rest = (sum * 10) % 11;
    if ((rest === 10) || (rest === 11)) rest = 0;
    if (rest !== parseInt(cpf.substring(9, 10))) return false;
    sum = 0;
    for (let i = 1; i <= 10; i++) sum += parseInt(cpf.substring(i - 1, i)) * (12 - i);
    rest = (sum * 10) % 11;
    if ((rest === 10) || (rest === 11)) rest = 0;
    if (rest !== parseInt(cpf.substring(10, 11))) return false;
    return true;
}

// ROTA PARA EXIBIR A PÁGINA DE CADASTRO
router.get('/register', (req, res) => {
    res.render('register', { pageTitle: 'Cadastre-se' });
});

// ROTA PARA PROCESSAR O CADASTRO (COM TODAS AS VALIDAÇÕES)
router.post('/register', async (req, res) => {
    const { name, email, password, cpf, telephone, street, number, complement, neighborhood, city, state, zipCode } = req.body;
    
    if (!isCpfValid(cpf)) {
        req.flash('error_msg', 'O CPF informado não é válido.');
        return res.redirect('/auth/register');
    }

    try {
        let user = await User.findOne({ email: email });
        if (user) {
            req.flash('error_msg', 'Este email já está em uso.');
            return res.redirect('/auth/register');
        }
        
        let cpfExists = await User.findOne({ cpf: cpf });
        if (cpfExists) {
            req.flash('error_msg', 'Este CPF já está cadastrado.');
            return res.redirect('/auth/register');
        }
        
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        user = new User({
            name,
            email,
            cpf,
            telephone,
            password: hashedPassword,
            address: { street, number, complement, neighborhood, city, state, zipCode }
        });

        await user.save();
        req.flash('success_msg', 'Cadastro realizado com sucesso! Por favor, faça o login.');
        res.redirect('/auth/login');
    } catch (error) {
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            req.flash('error_msg', messages.join(', '));
        } else {
            req.flash('error_msg', 'Ocorreu um erro inesperado no registro.');
        }
        res.redirect('/auth/register');
    }
});

// ROTA PARA EXIBIR A PÁGINA DE LOGIN
router.get('/login', (req, res) => {
    res.render('login', { pageTitle: 'Faça seu Login' });
});

// ROTA PARA PROCESSAR O LOGIN
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) {
            req.flash('error_msg', 'Email ou senha inválidos.');
            return res.redirect('/auth/login');
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            req.flash('error_msg', 'Email ou senha inválidos.');
            return res.redirect('/auth/login');
        }

        // Salva os dados importantes na sessão
        req.session.isAuthenticated = true;
        req.session.userId = user._id;
        req.session.userName = user.name;
        req.session.userRole = user.role; // Essencial para o acesso de admin
        
        res.redirect('/');
    } catch (error) {
        req.flash('error_msg', 'Ocorreu um erro no servidor.');
        res.redirect('/auth/login');
    }
});

// ROTA PARA FAZER LOGOUT
router.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error("Erro ao fazer logout:", err);
            return res.redirect('/');
        }
        res.clearCookie('connect.sid');
        res.redirect('/');
    });
});

module.exports = router;