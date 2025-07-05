const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator'); // [NOVO] Importando o validator
const User = require('../models/User');

// --- Função utilitária para validar o formato do CPF (movida para cá para manter o arquivo autocontido) ---
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

// ROTA PARA PROCESSAR O CADASTRO (COM VALIDAÇÃO)
router.post('/register', [
    // --- [NOVO] Bloco de Validação e Sanitização ---
    body('name', 'O nome é obrigatório e precisa ter no mínimo 3 caracteres.').trim().isLength({ min: 3 }),
    body('email', 'Por favor, insira um email válido.').isEmail().normalizeEmail(),
    body('password', 'A senha precisa ter no mínimo 6 caracteres.').isLength({ min: 6 }),
    body('cpf', 'O CPF informado não é válido.').trim().custom(isCpfValid),
    body('telephone', 'O telefone é obrigatório.').trim().notEmpty(),
    body('street', 'O nome da rua é obrigatório.').trim().notEmpty(),
    body('number', 'O número é obrigatório.').trim().notEmpty(),
    body('neighborhood', 'O bairro é obrigatório.').trim().notEmpty(),
    body('city', 'A cidade é obrigatória.').trim().notEmpty(),
    body('state', 'O estado é obrigatório.').trim().notEmpty(),
    body('zipCode', 'O CEP é obrigatório.').trim().isPostalCode('BR').withMessage('O CEP informado não é válido.')

], async (req, res) => {
    
    // --- [NOVO] Checa os resultados da validação ---
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const errorMessages = errors.array().map(err => err.msg);
        req.flash('error_msg', errorMessages.join(', '));
        // [NOVO] Redireciona de volta com os dados preenchidos para não frustrar o usuário
        return res.status(400).render('register', {
            pageTitle: 'Cadastre-se',
            errors: errors.array(),
            formData: req.body // Enviando os dados de volta para o formulário
        });
    }

    try {
        const { name, email, password, cpf, telephone, street, number, complement, neighborhood, city, state, zipCode } = req.body;

        // A verificação de CPF já foi feita na validação, mas a de email é bom manter pelo acesso ao DB
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
            name, email, cpf, telephone,
            password: hashedPassword,
            address: { street, number, complement, neighborhood, city, state, zipCode }
        });

        await user.save();
        req.flash('success_msg', 'Cadastro realizado com sucesso! Por favor, faça o login.');
        res.redirect('/auth/login');

    } catch (error) {
        console.error("Erro ao registrar usuário:", error);
        req.flash('error_msg', 'Ocorreu um erro inesperado no registro.');
        res.redirect('/auth/register');
    }
});

// ROTA PARA EXIBIR A PÁGINA DE LOGIN
router.get('/login', (req, res) => {
    res.render('login', { pageTitle: 'Faça seu Login' });
});

// ROTA PARA PROCESSAR O LOGIN
router.post('/login', [
    // --- [NOVO] Validação básica para o login ---
    body('email', 'Por favor, insira um email válido.').isEmail().normalizeEmail(),
    body('password', 'O campo senha não pode estar em branco.').notEmpty()

], async (req, res) => {

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        req.flash('error_msg', 'Email ou senha inválidos.');
        return res.redirect('/auth/login');
    }

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

        req.session.isAuthenticated = true;
        req.session.userId = user._id;
        req.session.userName = user.name;
        req.session.userRole = user.role;
        
        // [NOVO] Redireciona para o admin se o usuário for admin
        if(user.role === 'admin') {
            return res.redirect('/admin');
        }
        res.redirect('/');

    } catch (error) {
        console.error("Erro no login:", error);
        req.flash('error_msg', 'Ocorreu um erro no servidor.');
        res.redirect('/auth/login');
    }
});

// ROTA PARA FAZER LOGOUT
router.get('/logout', (req, res, next) => { // [NOVO] Adicionado 'next' para o tratamento de erro
    req.session.destroy(err => {
        if (err) {
            console.error("Erro ao fazer logout:", err);
            req.flash('error_msg', 'Não foi possível fazer o logout. Tente novamente.');
            return res.redirect('/');
        }
        res.clearCookie('connect.sid'); // Limpa o cookie da sessão
        res.redirect('/');
    });
});

module.exports = router;