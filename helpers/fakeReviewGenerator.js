// Nomes e Títulos continuam os mesmos
const nomes = ["Lucas M.", "Juliana S.", "Pedro Andrade", "Camila R.", "Gustavo F.", "Beatriz Lima", "Rafael Oliveira", "Larissa C.", "Matheus Pires", "Sofia B.", "Thiago Dias", "Isabela G.", "Vinicius Torres", "Manuela V.", "Rodrigo Nunes", "Amanda J."];
const titulos = ["Excelente produto!", "Superou minhas expectativas", "Recomendo a todos!", "Qualidade impressionante", "Bom custo-benefício", "Muito funcional e prático", "Comprarei novamente", "Satisfeito com a aquisição", "Entrega muito rápida", "Atendimento nota 10"];

// --- BANCO DE DADOS DE FRASES SEPARADO POR CATEGORIA ---
const comentariosPorCategoria = {
    "Ferramentas Elétricas": [
        "A potência dessa furadeira é incrível, facilitou muito o trabalho aqui em casa.",
        "A bateria dura bastante, consegui montar todos os móveis sem precisar recarregar.",
        "Vem com uma maleta muito prática que ajuda a manter tudo organizado. Ferramenta de primeira.",
        "Mais robusta do que eu esperava. Passa muita confiança no manuseio.",
        "Para uso doméstico, é mais do que suficiente. Ótimo torque e acabamento."
    ],
    "Monitores": [
        "A qualidade da imagem é espetacular, as cores são muito vivas e o contraste é ótimo.",
        "Zero dead pixels, ufa! A taxa de atualização de 144Hz faz toda a diferença nos jogos.",
        "O suporte é bem firme e permite um bom ajuste de altura e inclinação. Gostei muito.",
        "Ótimo para trabalhar e para jogar. O tamanho da tela é perfeito para produtividade.",
        "Chegou sem nenhum arranhão, muito bem protegido na caixa. A imagem é nítida."
    ],
    // Categoria genérica para produtos que não se encaixam nas outras
    "default": [
        "A entrega foi muito mais rápida do que o esperado e o produto veio perfeitamente embalado.",
        "Estou usando há algumas semanas e até agora não tive problemas. Cumpre o que promete.",
        "O design é bonito e moderno. Fica ótimo no ambiente e é muito fácil de usar.",
        "Um ótimo custo-benefício, vale cada centavo investido. Recomendo.",
        "A compra foi tranquila e o processo de checkout bem simples. O produto chegou em perfeitas condições."
    ]
};

// --- FUNÇÃO GERADORA ATUALIZADA ---
function generateFakeReviews(category) {
    const reviews = [];
    const reviewCount = Math.floor(Math.random() * 4) + 2; // Gera de 2 a 5 avaliações

    // Seleciona a piscina de comentários correta. Se a categoria não existir, usa a 'default'.
    const comentariosDisponiveis = [...(comentariosPorCategoria[category] || comentariosPorCategoria['default'])];
    const nomesDisponiveis = [...nomes];
    const titulosDisponiveis = [...titulos];

    const maxPossibleReviews = Math.min(reviewCount, nomesDisponiveis.length, titulosDisponiveis.length, comentariosDisponiveis.length);

    for (let i = 0; i < maxPossibleReviews; i++) {
        // Sorteia e remove um item de cada piscina para garantir que não haja repetição
        const autor = nomesDisponiveis.splice(Math.floor(Math.random() * nomesDisponiveis.length), 1)[0];
        const titulo = titulosDisponiveis.splice(Math.floor(Math.random() * titulosDisponiveis.length), 1)[0];
        const comentario = comentariosDisponiveis.splice(Math.floor(Math.random() * comentariosDisponiveis.length), 1)[0];
        
        let stars = 5;
        const starRoll = Math.random();
        if (starRoll > 0.75) { stars = 4; }

        reviews.push({
            author: autor,
            title: titulo,
            body: comentario,
            stars: stars,
            date: new Date(Date.now() - Math.floor(Math.random() * 60) * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR')
        });
    }
    return reviews;
}

module.exports = generateFakeReviews;