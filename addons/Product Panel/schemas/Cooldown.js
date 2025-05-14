const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const cooldownSchema = new Schema({
    userId: String,
    buttonId: String,
    cooldown: Date
});

module.exports = mongoose.model('Cooldown', cooldownSchema);