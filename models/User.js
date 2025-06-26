const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const UserSchema = new Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    
    // CAMPOS QUE AGORA SÃO OBRIGATÓRIOS
    cpf: { type: String, required: [true, 'O CPF é obrigatório.'], unique: true },
    telephone: { type: String, required: [true, 'O Telefone é obrigatório.'] },

    address: {
        street: { type: String, required: true },
        number: { type: String, required: true },
        complement: { type: String }, // Complemento é opcional
        neighborhood: { type: String, required: true },
        city: { type: String, required: true },
        state: { type: String, required: true },
        zipCode: { type: String, required: true }
    }
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);