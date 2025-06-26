const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require('path');
const flash = require('connect-flash');
require('dotenv').config();

const { MercadoPagoConfig } = require('mercadopago');

// Importações das Rotas
const indexRoutes = require('./routes/index');
const adminRoutes = require('./routes/admin');
const checkoutRoutes = require('./routes/checkout');
const authRoutes = require('./routes/auth');
const accountRoutes = require('./routes/account');

const startServer = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            family: 4
        });
        console.log("✅ Conexão com o MongoDB estabelecida com sucesso!");

        const app = express();

        // --- MELHORIA DE SEGURANÇA 1: Desativar cabeçalho X-Powered-By ---
        app.disable('x-powered-by');

        // Middleware para o webhook antes do body-parser, se necessário
        // (Será usado na validação do webhook)
        app.use('/checkout/webhook', express.raw({ type: 'application/json' }));

        app.use(express.json());
        app.use(express.urlencoded({ extended: true }));

        const mpClient = new MercadoPagoConfig({
            accessToken: process.env.MP_ACCESS_TOKEN,
            options: { timeout: 5000 }
        });
        app.set('mpClient', mpClient);

        app.set('view engine', 'ejs');
        app.set('views', path.join(__dirname, 'views'));
        app.use(express.static(path.join(__dirname, 'public')));

        // --- MELHORIA DE SEGURANÇA 2: Configuração segura dos cookies de sessão ---
        app.use(session({
            secret: process.env.SESSION_SECRET,
            resave: false,
            saveUninitialized: false,
            store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
            cookie: { 
                maxAge: 1000 * 60 * 60 * 24, // 1 dia
                httpOnly: true, // Impede que o cookie seja acedido por scripts no navegador
                secure: process.env.NODE_ENV === 'production' // Garante que o cookie só é enviado em HTTPS
            }
        }));

        app.use(flash());
        app.use((req, res, next) => {
            res.locals.isAuthenticated = req.session.isAuthenticated || false;
            res.locals.userName = req.session.userName || null;
            res.locals.userId = req.session.userId || null;
            res.locals.userRole = req.session.userRole || 'user';
            
            if (req.session.cart && req.session.cart.length > 0) {
                res.locals.cartCount = req.session.cart.reduce((sum, item) => sum + item.quantity, 0);
            } else {
                res.locals.cartCount = 0;
            }

            res.locals.success_msg = req.flash('success_msg');
            res.locals.error_msg = req.flash('error_msg');
            next();
        });
        
        app.use('/', indexRoutes);
        app.use('/admin', adminRoutes);
        app.use('/checkout', checkoutRoutes);
        app.use('/auth', authRoutes);
        app.use('/account', accountRoutes);
        
        const PORT = process.env.PORT || 3000;
        app.listen(PORT, () => console.log(`🚀 Tool Utility a rodar na porta ${PORT}`));

    } catch (error) {
        console.error("❌ Erro ao conectar ao MongoDB ou iniciar a aplicação.", error);
        process.exit(1);
    }
};

startServer();
