const express = require('express');
const router = express.Router();

const authRoutes = require('./auth/routes');
const suggestionsRoutes = require('./suggestions/routes');

router.use('/auth', authRoutes);
router.use('/suggestions', suggestionsRoutes);

module.exports = router; 