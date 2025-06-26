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
        // --- CONEXÃO COM O MONGODB COM OPÇÕES MAIS ROBUSTAS PARA PRODUÇÃO ---
        console.log("Tentando conectar ao MongoDB Atlas...");
        console.log(`Usando MONGO_URI: ${process.env.MONGO_URI ? 'Definida' : 'NÃO DEFINIDA!!!'}`);

        await mongoose.connect(process.env.MONGO_URI, {
            connectTimeoutMS: 10000, // Tenta conectar por 10 segundos
            socketTimeoutMS: 45000,  // Tempo para uma operação de socket
            serverSelectionTimeoutMS: 10000, // Tempo para o driver encontrar um servidor
            family: 4 // Força o uso de IPv4, que pode resolver problemas em algumas redes
        });
        
        console.log("✅ Conexão com o MongoDB estabelecida com sucesso!");

        const app = express();
        
        // O resto da sua configuração...
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
                maxAge: 1000 * 60 * 60 * 24,
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production'
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
        // Este log agora será mais específico sobre o erro de conexão
        console.error("❌ ERRO CRÍTICO AO INICIAR A APLICAÇÃO:", error);
        process.exit(1);
    }
};

startServer();
