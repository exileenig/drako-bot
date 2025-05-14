const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const downloadLogSchema = new Schema({
    userId: { type: String, required: true },
    productName: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    downloadCount: { type: Number, default: 1 }
});

module.exports = mongoose.model('DownloadLog', downloadLogSchema);