const { ActivityType, EmbedBuilder, ChannelType } = require('discord.js');
const fs = require('fs');
const yaml = require("js-yaml");
const moment = require('moment-timezone');
const colors = require('ansi-colors');
const packageFile = require('../package.json');
const GuildData = require('../models/guildDataSchema');
const UserData = require('../models/UserData');
const Verification = require('../models/verificationSchema');
const Ticket = require('../models/tickets');
const BotActivity = require('../models/BotActivity');
const { handleVerification, createUnverifiedRoleIfNeeded, handleJoinRoles } = require('../events/Verification/VerificationEvent');
const botStartTime = Date.now();
const config = yaml.load(fs.readFileSync('./config.yml', 'utf8'));
const ChannelStat = require('../models/channelStatSchema');

module.exports = async client => {
    client.on('guildMemberAdd', async member => {
        await handleJoinRoles(member);
    });

    client.guilds.cache.forEach(async guild => {
        try {
            let verificationData = await Verification.findOne({ guildID: guild.id });
            if (!verificationData) {
                verificationData = new Verification({
                    guildID: guild.id,
                    msgID: null,
                    unverifiedRoleID: null
                });
                await verificationData.save();
            }

            await createUnverifiedRoleIfNeeded(guild, verificationData);
            await handleVerification(client, guild);
        } catch (error) {
            console.error(`Failed to initialize verification for guild ${guild.id}: ${error}`);
        }
    });

    let guild = client.guilds.cache.get(client.guilds.cache.first().id);
    if (!guild) {
        console.log('\x1b[31m%s\x1b[0m', `[ERROR] The bot is not in the configured server!`);
        process.exit();
    }

    let guildData = await GuildData.findOne({ guildID: guild.id });
    if (!guildData) {
        guildData = new GuildData({
            guildID: guild.id,
            cases: 0,
            totalMessages: 0,
            stars: {},
            totalSuggestions: 0,
            timesBotStarted: 1
        });
        await guildData.save();
    } else {
        guildData.timesBotStarted++;
        await guildData.save();
    }

    let verificationData = await Verification.findOne({ guildID: guild.id });
    if (!verificationData) {
        verificationData = new Verification({
            guildID: guild.id,
            msgID: null,
            unverifiedRoleID: null
        });
        await verificationData.save();
    }

    async function updateBotActivity(client, index) {
        try {
            const guildId = client.guilds.cache.first().id;
            const botActivityData = await BotActivity.findOne({ guildId });

            if (!botActivityData || botActivityData.activities.length === 0) {
                return;
            }

            const guild = client.guilds.cache.get(guildId);
            if (!guild) {
                console.log(`Guild not found for ID: ${guildId}`);
                return;
            }

            try {
                await guild.members.fetch();
            } catch (error) {
                if (error.code !== 'GuildMembersTimeout') {
                    console.error('Error fetching members:', error);
                }
            }

            await guild.channels.fetch();

            const totalChannels = guild.channels.cache.filter(channel =>
                channel.type === ChannelType.GuildText ||
                channel.type === ChannelType.GuildVoice ||
                channel.type === ChannelType.GuildCategory ||
                channel.type === ChannelType.GuildForum ||
                channel.type === ChannelType.GuildStageVoice
            ).size;

            const onlineMembers = guild.members.cache.filter(member =>
                ['online', 'idle', 'dnd'].includes(member.presence?.status)
            ).size;

            const uptime = getUptime();
            const { totalTickets, openTickets, closedTickets, deletedTickets } = await getTicketStatistics(guildId);

            const formatter = new Intl.NumberFormat('en-US');

            const currentActivity = botActivityData.activities[index];

            const activityString = currentActivity.status
                .replace(/{total-users}/g, formatter.format(guild.memberCount))
                .replace(/{total-channels}/g, formatter.format(totalChannels))
                .replace(/{total-messages}/g, formatter.format(guildData.totalMessages))
                .replace(/{online-members}/g, formatter.format(onlineMembers))
                .replace(/{uptime}/g, uptime)
                .replace(/{total-boosts}/g, formatter.format(guild.premiumSubscriptionCount))
                .replace(/{total-cases}/g, formatter.format(guildData.cases))
                .replace(/{total-suggestions}/g, formatter.format(guildData.totalSuggestions))
                .replace(/{times-bot-started}/g, formatter.format(guildData.timesBotStarted))
                .replace(/{total-tickets}/g, formatter.format(totalTickets))
                .replace(/{open-tickets}/g, formatter.format(openTickets))
                .replace(/{closed-tickets}/g, formatter.format(closedTickets))
                .replace(/{deleted-tickets}/g, formatter.format(deletedTickets));

            let activityType;
            switch (currentActivity.activityType.toUpperCase()) {
                case "WATCHING":
                    activityType = ActivityType.Watching;
                    break;
                case "PLAYING":
                    activityType = ActivityType.Playing;
                    break;
                case "COMPETING":
                    activityType = ActivityType.Competing;
                    break;
                case "STREAMING":
                    activityType = ActivityType.Streaming;
                    break;
                case "CUSTOM":
                    activityType = ActivityType.Custom;
                    break;
                default:
                    console.log(`Invalid Activity Type: ${currentActivity.activityType}`);
                    activityType = ActivityType.Playing;
            }

            const presenceOptions = {
                activities: [{ name: activityString, type: activityType }],
                status: currentActivity.statusType.toLowerCase(),
            };

            if (activityType === ActivityType.Streaming && currentActivity.streamingURL) {
                presenceOptions.activities[0].url = currentActivity.streamingURL;
            }

            await client.user.setPresence(presenceOptions);

            await client.user.setStatus(currentActivity.statusType.toLowerCase());

        } catch (error) {
            console.error('Error updating bot activity:', error);
        }
    }

    async function startActivityUpdateLoop(client) {
        let index = 0;
        let lastUpdate = Date.now();
        const MIN_UPDATE_INTERVAL = 60000;

        setInterval(async () => {
            try {
                const now = Date.now();
                if (now - lastUpdate < MIN_UPDATE_INTERVAL) {
                    return;
                }

                const guildId = client.guilds.cache.first().id;
                const botActivityData = await BotActivity.findOne({ guildId });

                if (botActivityData && botActivityData.activities.length > 0) {
                    await updateBotActivity(client, index);
                    index = (index + 1) % botActivityData.activities.length;
                    lastUpdate = now;
                }
            } catch (error) {
                console.error('Error in activity update loop:', error);
            }
        }, 30000);
    }

    await startActivityUpdateLoop(client);

    client.guilds.cache.forEach(guild => {
        if (!guild.id.includes(guild.id)) {
            guild.leave();
            console.log('\x1b[31m%s\x1b[0m', `[INFO] Someone tried to invite the bot to another server! I automatically left it (${guild.name})`);
        }
    });

    if (guild && !guild.members.me.permissions.has("Administrator")) {
        console.log('\x1b[31m%s\x1b[0m', `[ERROR] The bot doesn't have enough permissions! Please give the bot ADMINISTRATOR permissions in your server or it won't function properly!`);
    }

    try {
        logStartupMessages(client);
    } catch (error) {
        console.error('An error occurred:', error);
    }
};

async function logStartupMessages(client) {
    try {
        const guild = client.guilds.cache.first();
        const updatedGuildData = await GuildData.findOne({ guildID: guild.id });
        const totalTickets = await Ticket.countDocuments({});
        const used = process.memoryUsage();

        console.log(colors.cyan(`
██████╗ ██████╗  █████╗ ██╗  ██╗ ██████╗ 
██╔══██╗██╔══██╗██╔══██╗██║ ██╔╝██╔═══██╗
██║  ██║██████╔╝██████║█████╔╝ ██║     ██║
██║  ██║██╔══██╗██╔══██║██╔═██╗ ██║   ██║
██████╔╝██║  ██║██║  ██║██║  ██╗╚██████╔╝
╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝ `));

        console.log(colors.gray('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
        console.log(`${colors.blue('■')} Bot v${packageFile.version} ${colors.gray(`(${(used.heapUsed / 1024 / 1024).toFixed(2)} MB)`)} ${colors.white(`| Node ${process.version}`)}`);
        console.log(colors.gray(''));
        console.log(`${colors.magenta('■')} Support: ${colors.white('discord.drakodevelopment.net')}`);
        console.log(`${colors.magenta('■')} Docs: ${colors.white('docs.drakodevelopment.net')}`);

        if (config.Statistics !== false) {
            console.log(colors.gray('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
            console.log(`${colors.yellow('■')} Cases: ${colors.white(updatedGuildData.cases)} ${colors.gray('|')} Users: ${colors.white(client.users.cache.size)} ${colors.gray('|')} Commands: ${colors.white(client.slashCommands.size)}`);
            console.log(`${colors.yellow('■')} Messages: ${colors.white(updatedGuildData.totalMessages)} ${colors.gray('|')} Tickets: ${colors.white(totalTickets)} ${colors.gray('|')} Suggestions: ${colors.white(updatedGuildData.totalSuggestions)}`);
        }

        if (updatedGuildData.timesBotStarted === 1) {
            console.log(colors.gray('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
            console.log(colors.yellow('First-time Setup - Need help? Visit our Discord support server'));
            console.log(colors.red('Important: Leaking or redistributing our products is prohibited'));
        }

        console.log(colors.gray('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
        console.log(colors.green.bold('Bot is now online and ready!'));
        console.log(colors.gray(`Started: ${new Date().toLocaleString()}`));

        fs.appendFile("./logs.txt", `\n[${new Date().toLocaleString()}] [READY] Bot is now online and ready!`, 
            (e) => e && console.error('Error writing to log file:', e));

    } catch (error) {
        console.error('Error in startup logging:', error);
    }
}

function getUptime() {
    const duration = moment.duration(Date.now() - botStartTime);
    let uptimeString = '';

    const years = duration.years();
    const months = duration.months();
    const weeks = duration.weeks();
    const days = duration.days();
    const hours = duration.hours();
    const minutes = duration.minutes();
    const seconds = duration.seconds();

    if (years > 0) {
        uptimeString += `${years}y `;
    }

    if (years > 0 || months > 0) {
        uptimeString += `${months}mo `;
    }

    if ((years > 0 || months > 0 || weeks > 0) && !days) {
        uptimeString += `${weeks}w `;
    }

    if (years > 0 || months > 0 || weeks > 0 || days > 0) {
        uptimeString += `${days}d `;
    }
    uptimeString += `${hours}h ${minutes}m ${seconds}s`;

    return uptimeString.trim();
}

async function getTicketStatistics(guildId) {
    const totalTickets = await Ticket.countDocuments({ guildId });
    const openTickets = await Ticket.countDocuments({ guildId, status: 'open' });
    const closedTickets = await Ticket.countDocuments({ guildId, status: 'closed' });
    const deletedTickets = await Ticket.countDocuments({ guildId, status: 'deleted' });
    return { totalTickets, openTickets, closedTickets, deletedTickets };
}