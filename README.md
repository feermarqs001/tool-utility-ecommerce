# Tool Utility - E-commerce Completo

![Licença](https://img.shields.io/badge/license-MIT-blue.svg)
![Tecnologia](https://img.shields.io/badge/stack-Node.js%20/%20Express%20/%20MongoDB-green)

Projeto de e-commerce completo desenvolvido como uma vitrine de habilidades em desenvolvimento back-end com Node.js. A plataforma "Tool Utility" simula uma loja virtual de ferramentas e utilidades, com um conjunto robusto de funcionalidades tanto para clientes quanto para administradores.

---

###  डेमो ao Vivo (Live Demo)

* **URL:** `http://link-para-o-projeto-no-ar.com` (Substituir pela URL de produção)

### Capturas de Tela (Screenshots)

*(Aqui seriam inseridas imagens da aplicação, como: Home Page, Página de Produto, Carrinho e Painel de Admin)*

---

### ➤ Tecnologias Utilizadas

Este projeto foi construído com uma stack moderna e robusta de JavaScript:

* **Back-end:** Node.js, Express.js
* **Banco de Dados:** MongoDB com Mongoose ODM para modelagem de dados.
* **View Engine:** EJS (Embedded JavaScript templates) para renderização do lado do servidor.
* **Autenticação & Sessão:** Express Session, Connect-Mongo e Bcrypt.js.
* **Validação de Dados:** Express-validator para segurança e integridade dos inputs.
* **Gateway de Pagamento:** Integração com a API do Mercado Pago.
* **Utilitários:** `dotenv` para variáveis de ambiente, `connect-flash` for mensagens de notificação, e `nodemon` para desenvolvimento.

---

### ➤ Funcionalidades Principais

#### Para Clientes:
* ✅ Cadastro e Login de Usuários com senha criptografada.
* ✅ Painel "Minha Conta" para gerenciar dados pessoais e ver histórico de pedidos.
* ✅ Navegação por produtos e categorias.
* ✅ Página de detalhes do produto com galeria de imagens e especificações.
* ✅ Sistema de Avaliações (Reviews) com nota e comentários (com moderação do admin).
* ✅ Carrinho de compras persistente com sessão.
* ✅ Cálculo de Frete dinâmico (simulado).
* ✅ Aplicação de Cupons de Desconto (`fixo` ou `percentual`).
* ✅ Checkout transparente com integração do Mercado Pago.
* ✅ Design 100% responsivo para dispositivos móveis.

#### Para Administradores:
* ✅ Dashboard seguro (`/admin`) com estatísticas de vendas e contadores.
* ✅ Gerenciamento completo de Produtos (CRUD - Criar, Ler, Atualizar, Deletar).
* ✅ Gerenciamento de Pedidos.
* ✅ Moderação de Avaliações de clientes (Aprovar/Reprovar).
* ✅ Configuração de Frete (custo para entrega local).
* ✅ Sistema de permissões (somente usuários com `role: 'admin'` podem acessar).

---

### 🚀 Como Executar o Projeto Localmente

Siga os passos abaixo para configurar e rodar o projeto em seu ambiente de desenvolvimento.

**1. Pré-requisitos:**
* [Node.js](https://nodejs.org/) (versão 18 ou superior)
* [npm](https://www.npmjs.com/)
* [MongoDB](https://www.mongodb.com/try/download/community) (servidor rodando localmente ou uma string de conexão do Atlas)

**2. Clone o Repositório:**
```bash
git clone [https://github.com/seu-usuario/toolutility.git](https://github.com/seu-usuario/toolutility.git)
cd toolutility