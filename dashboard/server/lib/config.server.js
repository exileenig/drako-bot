const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');

function loadConfig() {
    try {
        const configPath = path.join(process.cwd(), 'config.yml');
        const config = yaml.load(fs.readFileSync(configPath, 'utf8'));
        return config;
    } catch (error) {
        console.error('Error loading config:', error);
        return null;
    }
}

module.exports = { loadConfig };