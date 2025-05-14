const { SlashCommandBuilder, EmbedBuilder, version: discordVersion } = require('discord.js');
const moment = require('moment');
const os = require('os');
const process = require('process');
const { version } = require('../../package.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('botinfo')
        .setDescription('Get detailed information about the bot'),
    category: 'General',
    async execute(interaction) {
        try {
            const bot = interaction.client;
            const uptimeTimestamp = Math.floor((Date.now() - bot.uptime) / 1000);
            const memoryUsage = process.memoryUsage();
            const totalMemory = (memoryUsage.heapTotal / 1024 / 1024).toFixed(2);
            const usedMemory = (memoryUsage.heapUsed / 1024 / 1024).toFixed(2);

            const totalSystemMemory = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
            const freeSystemMemory = (os.freemem() / 1024 / 1024 / 1024).toFixed(2);
            const usedSystemMemory = (totalSystemMemory - freeSystemMemory).toFixed(2);

            const formatMemory = (total, used) => {
                if (total > 6144) {
                    return `${(used / 1024).toFixed(2)} GB / ${(total / 1024).toFixed(2)} GB`;
                }
                return `${used} MB / ${total} MB`;
            };

            let cpuModel = os.cpus()[0].model;
            const coreCount = os.cpus().length;
            const nodeVersion = process.version;
            const platform = `${os.type()} ${os.release()}`;

            const createdAt = `<t:${Math.floor(bot.user.createdAt / 1000)}:R>`;
            const joinedAt = interaction.guild.members.cache.get(bot.user.id)?.joinedAt
                ? `<t:${Math.floor(interaction.guild.members.cache.get(bot.user.id).joinedAt / 1000)}:R>`
                : 'Unknown';

            await interaction.deferReply();
            const sent = await interaction.fetchReply();
            const pingLatency = sent.createdTimestamp - interaction.createdTimestamp;
            const wsLatency = bot.ws.ping;

            cpuModel = cpuModel.replace(/\s\d+-Core Processor/, '');

            const botInfo = new EmbedBuilder()
                .setAuthor({ name: bot.user.username, iconURL: bot.user.displayAvatarURL() })
                .setTitle('Bot Information')
                .setColor('#0099ff')
                .setThumbnail(bot.user.displayAvatarURL())
                .addFields(
                    { 
                        name: '🤖 Bot Details',
                        value: [
                            `**Name:** ${bot.user.username}`,
                            `**ID:** ${bot.user.id}`,
                            `**Version:** ${version}`,
                            `**Created:** ${createdAt}`,
                            `**Joined Server:** ${joinedAt}`,
                            `**Starts:** ${await getBotStarts(interaction.guild.id)}`
                        ].join('\n'),
                        inline: false
                    },
                    {
                        name: '📊 Statistics',
                        value: [
                            `**Users:** ${bot.users.cache.size}`,
                            `**Channels:** ${bot.channels.cache.size}`,
                            `**Commands:** ${bot.commands.size}`,
                            `**Online Since:** <t:${uptimeTimestamp}:R>`
                        ].join('\n'),
                        inline: true
                    },
                    {
                        name: '🔧 Technical',
                        value: [
                            `**Discord.js:** v${discordVersion}`,
                            `**CPU:** ${cpuModel}`,
                            `**CPU Cores:** ${coreCount}`
                        ].join('\n'),
                        inline: true
                    },
                    {
                        name: '📶 Performance',
                        value: [
                            `**Bot Memory:** ${formatMemory(totalMemory, usedMemory)}`,
                            `**System Memory:** ${usedSystemMemory}GB / ${totalSystemMemory}GB`,
                            `**Ping:** ${pingLatency}ms`,
                        ].join('\n'),
                        inline: false
                    }
                )
                .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
                .setTimestamp();

            await interaction.editReply({ embeds: [botInfo] });
        } catch (error) {
            console.error('Error in botinfo command: ', error);
            await interaction.reply({ 
                content: 'Sorry, there was an error retrieving the bot information.', 
                ephemeral: true 
            });
        }
    }
};

async function getBotStarts(guildId) {
    const GuildData = require('../../models/guildDataSchema');
    const guildData = await GuildData.findOne({ guildID: guildId });
    return guildData ? guildData.timesBotStarted.toString() : '0';
}