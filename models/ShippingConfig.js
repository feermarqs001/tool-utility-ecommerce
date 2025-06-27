const mongoose = require('mongoose');

// Usamos um nome de schema fixo para garantir que haja apenas um documento de configuração
const CONFIG_ID = "667d8a6e99d3e5b153e37158"; // ID Fixo e único

const shippingConfigSchema = new mongoose.Schema({
  _id: { type: String, default: CONFIG_ID },
  localCity: { type: String, default: 'Curitiba' },
  localCost: { type: Number, default: 0 },
  // Futuramente, podemos adicionar chaves de API aqui
  // correiosContract: { type: String },
  // correiosPassword: { type: String }
}, { timestamps: true });


// Método estático para garantir/criar a configuração
shippingConfigSchema.statics.getConfig = async function() {
  let config = await this.findById(CONFIG_ID);
  if (!config) {
    console.log('Nenhuma configuração de frete encontrada, criando uma padrão.');
    config = await this.create({ _id: CONFIG_ID });
  }
  return config;
};

module.exports = mongoose.model('ShippingConfig', shippingConfigSchema);