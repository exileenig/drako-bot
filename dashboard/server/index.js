const path = require('path');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { Server } = require('socket.io');
const { MemoryChecker } = require('../../utils/memoryChecker.js');
const ticketRoutes = require('./api/tickets/routes.js');
const settingsRoutes = require('./api/settings/routes.js');
const channelsRoutes = require('./api/channels/routes.js');
const { setDiscordClient, setSocketIO } = require('./bot/index.js');
const yaml = require('js-yaml');
const fs = require('fs');
const mongoose = require('mongoose');
const MongoStore = require('connect-mongo');
const auth = require('./middleware/auth.js');
const originCheck = require('./middleware/origin-check.js');
const { verifyCsrfToken, setCsrfToken } = require('./middleware/csrf.js');
const templatesRoutes = require('./api/templates/routes');
const suggestionsRoutes = require('./api/suggestions/routes');
const apiRoutes = require('./api');
const session = require('express-session');
const crypto = require('crypto');
const { 
    STATIC_FILE_PATTERN, 
    PUBLIC_PATHS, 
    getCookieSettings, 
    errorHandler 
} = require('./middleware/shared');
const http = require('http');
const WebSocket = require('ws');

let botMemory = 0;

global.updateBotMemory = (memory) => {
    if (memory !== undefined && !isNaN(parseFloat(memory))) {
        botMemory = Math.round(parseFloat(memory) * 100) / 100;
    }
};

module.exports = function startDashboardServer() {
    const envPath = path.join(__dirname, '..', '.env');
    require('dotenv').config({ path: envPath });

    let config;
    try {
        config = yaml.load(fs.readFileSync('./config.yml', 'utf8'));
    } catch (e) {
        console.error('[ERROR] Error loading config.yml:', e);
        process.exit(1);
    }

    const dashboardUrl = config.Dashboard?.Url || 'http://localhost:3000';
    const vitePort = process.env.VITE_PORT || config.Dashboard?.VitePort || 3001;
    const viteDevUrl = `http://localhost:${vitePort}`;
    const allowedOrigins = [dashboardUrl];
    
    if (process.env.NODE_ENV !== 'production') {
        allowedOrigins.push(viteDevUrl);
    }

    if (!process.env.NODE_ENV || process.env.NODE_ENV === 'development') {
        allowedOrigins.push('http://localhost:5000');
    }

    const app = express();
    const server = http.createServer(app);
    const wss = new WebSocket.Server({ server });

    app.use(cookieParser());
    app.use(express.json({ limit: '1mb' }));

    app.set('trust proxy', 'loopback');

    app.use(cors({
        origin: function(origin, callback) {
            callback(null, true);
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-XSRF-TOKEN', 'X-Requested-With', 'Cookie'],
        exposedHeaders: ['Set-Cookie'],
        maxAge: 86400
    }));
    
    const sessionSecret = process.env.SESSION_SECRET || 'your-secret-key';
    const mongoUrl = process.env.MONGODB_URI || 'mongodb://localhost:27017/drakobot';

    if (!mongoUrl) {
        console.error('[SESSION] MongoDB URL is not configured');
        process.exit(1);
    }

    try {
        const sessionStore = MongoStore.create({
            mongoUrl: mongoUrl,
            ttl: 7 * 24 * 60 * 60,
            autoRemove: 'native',
            crypto: {
                secret: sessionSecret
            },
            touchAfter: 24 * 3600,
            collectionName: 'sessions',
            stringify: false,
            autoRemoveInterval: 10,
            ttlMonitor: true
        });
        
        const sessionMiddleware = session({
            secret: sessionSecret,
            resave: false,
            rolling: true,
            saveUninitialized: false,
            store: sessionStore,
            proxy: true,
            cookie: {
                secure: false,
                httpOnly: true,
                sameSite: 'lax',
                maxAge: 7 * 24 * 60 * 60 * 1000,
                path: '/'
            },
            name: 'connect.sid'
        });

        app.use(sessionMiddleware);

        app.use((req, res, next) => {
            if (!req.session.initialized) {
                req.session.initialized = true;
                req.session.createdAt = new Date();
            }
            next();
        });

        app.use((req, res, next) => {
            if (req.path.startsWith('/api/')) {
                const debugInfo = {
                    path: req.path,
                    method: req.method,
                    sessionID: req.sessionID,
                    hasSession: !!req.session,
                    isSecure: req.secure,
                    protocol: req.protocol,
                    headers: {
                        'x-forwarded-proto': req.get('x-forwarded-proto'),
                        'x-forwarded-for': req.get('x-forwarded-for'),
                        host: req.get('host')
                    },
                    cookies: {
                        ...req.cookies,
                        'connect.sid': req.cookies['connect.sid'] ? '[present]' : '[missing]'
                    }
                };
            }
            next();
        });

        app.use(async (req, res, next) => {
            if (!req.path.startsWith('/api/') || STATIC_FILE_PATTERN.test(req.path)) {
                return next();
            }

            if (PUBLIC_PATHS.includes(req.path)) {
                return next();
            }

            if (!req.session) {
                return res.status(403).json({ error: 'No session found' });
            }

            if (!req.session.csrfToken && !req.path.startsWith('/api/auth/')) {
                req.session.csrfToken = crypto.randomBytes(32).toString('hex');
                
                res.cookie('XSRF-TOKEN', req.session.csrfToken, {
                    secure: false,
                    httpOnly: false,
                    sameSite: 'lax',
                    maxAge: 7 * 24 * 60 * 60 * 1000,
                    path: '/'
                });

                req.session.save((err) => {
                    if (err) {
                        console.error('[SESSION] Save error:', err);
                        return next(err);
                    }
                    next();
                });
            } else {
                next();
            }
        });

        const rateLimit = require('express-rate-limit');
        const apiLimiter = rateLimit({
            windowMs: 15 * 60 * 1000,
            max: 1000,
            message: { error: 'Too many requests, please try again later' },
            standardHeaders: true,
            legacyHeaders: false,
            skip: (req) => PUBLIC_PATHS.includes(req.path)
        });

        app.use('/api/', apiLimiter);

        const hasAuthConfig = process.env.DISCORD_CLIENT_ID &&
            process.env.DISCORD_CLIENT_SECRET &&
            process.env.DISCORD_REDIRECT_URI;

        if (hasAuthConfig) {
            const authRoutes = require('./api/auth/routes.js');
            app.use('/api/auth', authRoutes);
        } else {
            console.warn('[WARNING] Auth routes disabled - missing OAuth2 configuration');
        }

        app.use('/api', originCheck);

        app.use('/api/tickets', ticketRoutes);
        app.use('/api/settings', settingsRoutes);
        app.use('/api/channels', channelsRoutes);
        app.use('/api/templates', templatesRoutes);
        app.use('/api/suggestions', suggestionsRoutes);

        app.get('/api/memory', (req, res) => {
            try {
                const expressMemory = Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100;
                res.json({
                    usage: {
                        express: expressMemory,
                        react: 0,
                        bot: botMemory
                    },
                    total: expressMemory + botMemory
                });
            } catch (error) {
                console.error('[MEMORY] Error getting memory usage:', error);
                res.status(500).json({ error: 'Failed to get memory usage' });
            }
        });

        app.get('/api/health', auth, (req, res) => {
            res.json({ status: 'ok' });
        });

        app.use('/api', apiRoutes);

        const distPath = path.join(__dirname, '..', 'dist');
        app.use(express.static(distPath));
        app.use(express.static(path.join(__dirname, '../build')));

        app.get('*', (req, res) => {
            res.sendFile(path.join(distPath, 'index.html'));
        });

        app.use(errorHandler);

        const memoryChecker = new MemoryChecker('Backend Server');
        memoryChecker.start();

        const args = process.argv.slice(2);
        const portIndex = args.indexOf('--port');
        const PORT = portIndex !== -1 ? parseInt(args[portIndex + 1]) : (config.Dashboard?.Port || process.env.PORT || 3000);

        const server = app.listen(PORT, () => {
            if (!hasAuthConfig) {
                console.log('[SERVER] Running in limited mode - authentication disabled');
            }
        });

        const io = new Server(server, {
            cors: {
                origin: config.Dashboard?.Url || 'http://localhost:7000',
                methods: ['GET', 'POST'],
                credentials: true
            },
            transports: ['websocket', 'polling']
        });

        io.on('connection', (socket) => {
            socket.on('disconnect', () => {});
        });

        setSocketIO(io);

        if (global.client) {
            setDiscordClient(global.client);
        } else {
            const configClient = {
                user: { id: config.Dashboard.ClientID },
                application: { id: config.Dashboard.ClientID }
            };
            setDiscordClient(configClient);
        }

        const gracefulShutdown = async () => {
            console.log(' Starting graceful shutdown...');

            io.close(() => {
            });

            server.close(() => {
            });

            if (memoryChecker) {
                memoryChecker.stop();
            }
        };

        process.on('SIGTERM', gracefulShutdown);
        process.on('SIGINT', gracefulShutdown);

        return server;
    } catch (error) {
        process.exit(1);
    }
};