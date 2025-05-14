const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const productSchema = new Schema({
    name: { type: String, required: true, unique: true },
    description: String,
});

module.exports = mongoose.model('Product', productSchema);