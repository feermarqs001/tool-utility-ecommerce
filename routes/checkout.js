const express = require('express');
const router = express.Router();
// ... outras importações ...
const ShippingConfig = require('../models/ShippingConfig'); // NOVO

// ... rotas existentes de gerenciamento do carrinho ...


// --- [NOVO] ROTA PARA CÁLCULO DE FRETE ---
router.post('/calculate-shipping', async (req, res) => {
    const { cep } = req.body;
    const cart = req.session.cart || [];

    if (!cep || cart.length === 0) {
        return res.status(400).json({ error: 'CEP e carrinho são necessários.' });
    }

    try {
        const config = await ShippingConfig.getConfig();

        // Lógica Simplificada para Entrega Local (Ex: Curitiba)
        // Uma implementação real usaria uma faixa de CEPs.
        const isLocal = cep.startsWith('80') || cep.startsWith('81') || cep.stattswith('82'); // Exemplo para CEPs de Curitiba

        if (isLocal) {
            return res.json({
                options: [{
                    name: 'Entrega Local',
                    price: config.localCost,
                    deadline: 2 // em dias
                }]
            });
        }

        // --- LÓGICA PARA API EXTERNA (EX: CORREIOS) ---
        // 1. Consolidar peso e dimensões do pacote
        let totalWeight = 0;
        // Lógica mais complexa para dimensões seria necessária aqui
        const productIds = cart.map(item => item.productId);
        const products = await Product.find({ '_id': { $in: productIds } });

        cart.forEach(item => {
            const product = products.find(p => p._id.toString() === item.productId);
            if(product) {
                totalWeight += product.weight * item.quantity;
            }
        });

        // 2. Chamar a API dos Correios (ou outra) com os dados
        // const shippingOptions = await CorreiosAPI.calculate(cep, totalWeight, dimensions...);
        // Por enquanto, retornamos um valor fixo para simulação
        const shippingOptions = [
            { name: 'PAC', price: 25.50, deadline: 7 },
            { name: 'SEDEX', price: 45.80, deadline: 3 }
        ];

        res.json({ options: shippingOptions });

    } catch (error) {
        console.error("Erro no cálculo de frete:", error);
        res.status(500).json({ error: 'Não foi possível calcular o frete.' });
    }
});


// ROTA DE REVISÃO DO PEDIDO (precisaria ser atualizada para incluir o frete)
// ...

// CRIAR PREFERÊNCIA DE PAGAMENTO NO MERCADO PAGO (ATUALIZADA)
router.post('/create-payment-preference', isAuthenticated, async (req, res) => {
    // [NOVO] Pega o frete escolhido que deve ser salvo na sessão na etapa anterior
    const shipping = req.session.shipping || { price: 0, method: 'Não definido' };

    // ... lógica existente para buscar produtos e calcular subtotal ...
    const discountAmount = req.session.discount ? req.session.discount.amount : 0;
    const total = (subtotal - discountAmount) + shipping.price; // [NOVO] Adiciona o frete ao total

    // ...
    const newOrder = new Order({
        userId: userId, products: orderProducts, totalAmount: total,
        shippingAddress: user.address, status: 'Pendente',
        shippingMethod: shipping.method, // [NOVO] Salva o método de frete
        shippingCost: shipping.price     // [NOVO] Salva o custo do frete
    });
    // ...

    // [NOVO] Adiciona o frete como um item na preferência do Mercado Pago
    if (shipping.price > 0) {
        preferenceItems.push({
            id: 'frete', title: `Frete: ${shipping.method}`,
            quantity: 1, unit_price: shipping.price, currency_id: 'BRL'
        });
    }

    // ... resto da lógica para criar a preferência e redirecionar ...
});


// ... resto das rotas de checkout ...

module.exports = router;