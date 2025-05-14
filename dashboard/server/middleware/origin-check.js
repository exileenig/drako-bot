const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');

let config;
try {
    config = yaml.load(fs.readFileSync('./config.yml', 'utf8'));
} catch (e) {
    console.error('[ERROR] Error loading config.yml:', e);
    process.exit(1);
}

const dashboardUrl = config.Dashboard?.Url || 'http://localhost:3000';
const vitePort = process.env.VITE_PORT || config.Dashboard?.VitePort || 3001;
const allowedOrigins = [`http://localhost:${vitePort}`, dashboardUrl];

function originCheck(req, res, next) {
    const origin = req.headers.origin;
    const referer = req.headers.referer;

    if (origin && allowedOrigins.includes(origin)) {
        next();
    } else if (referer && allowedOrigins.some(allowed => referer.startsWith(allowed))) {
        next();
    } else {
        console.warn('[SECURITY] Blocked request from unauthorized source:', { origin, referer });
        res.status(403).json({ error: 'Access denied' });
    }
}

module.exports = originCheck;