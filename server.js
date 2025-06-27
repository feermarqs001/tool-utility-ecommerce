const express = require('express');
const mongoose =require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require('path');
const flash = require('connect-flash');
require('dotenv').config();

// --- [NOVO] Log para verificar o ambiente ---
console.log(`✅ Servidor iniciando em modo: ${process.env.NODE_ENV || 'development'}`);

const { MercadoPagoConfig } = require('mercadopago');

// Importações das Rotas
const indexRoutes = require('./routes/index');
const adminRoutes = require('./routes/admin');
const checkoutRoutes = require('./routes/checkout');
const authRoutes = require('./routes/auth');
const accountRoutes = require('./routes/account');

const startServer = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("✅ Conexão com o MongoDB estabelecida com sucesso!");

        const app = express();

        app.disable('x-powered-by');
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

        app.use(session({
            secret: process.env.SESSION_SECRET,
            resave: false,
            saveUninitialized: false,
            store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
            cookie: {
                maxAge: 1000 * 60 * 60 * 24 * 7, // Sessão de 7 dias
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production' // ESSA LINHA AGORA FUNCIONARÁ CORRETAMENTE
            }
        }));

        app.use(flash());

        app.use((req, res, next) => {
            res.locals.isAuthenticated = req.session.isAuthenticated || false;
            res.locals.userName = req.session.userName || null;
            res.locals.userId = req.session.userId || null;
            res.locals.userRole = req.session.userRole || 'user';
            res.locals.cart = req.session.cart || [];
            res.locals.cartCount = res.locals.cart.reduce((sum, item) => sum + item.quantity, 0);
            res.locals.success_msg = req.flash('success_msg');
            res.locals.error_msg = req.flash('error_msg');
            next();
        });
        
        // --- ROTAS DA APLICAÇÃO ---
        app.use('/', indexRoutes);
        app.use('/admin', adminRoutes);
        app.use('/checkout', checkoutRoutes);
        app.use('/auth', authRoutes);
        app.use('/account', accountRoutes);
        
        app.use((req, res, next) => {
            res.status(404).render('404', { pageTitle: 'Página Não Encontrada' });
        });

        app.use((error, req, res, next) => {
            console.error("❌ ERRO 500 CAPTURADO:", error);
            res.status(500).render('500', { pageTitle: 'Erro no Servidor' });
        });
        
        const PORT = process.env.PORT || 3000;
        app.listen(PORT, () => console.log(`🚀 Tool Utility a rodar na porta ${PORT}`));

    } catch (error) {
        console.error("❌ ERRO CRÍTICO AO INICIAR A APLICAÇÃO:", error);
        process.exit(1);
    }
};

startServer();