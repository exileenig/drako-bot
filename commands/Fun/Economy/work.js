const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../../../models/UserData');
const fs = require('fs');
const yaml = require('js-yaml');
const config = yaml.load(fs.readFileSync('./config.yml', 'utf8'));
const lang = yaml.load(fs.readFileSync('./lang.yml', 'utf8'));
const parseDuration = require('./Utility/parseDuration');
const { checkActiveBooster, replacePlaceholders } = require('./Utility/helpers');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('work')
        .setDescription('Work to earn coins'),
    category: 'Economy',
    async execute(interaction) {
        let user = await User.findOne(
            { userId: interaction.user.id, guildId: interaction.guild.id },
            { balance: 1, 'commandData.lastWork': 1, transactionLogs: 1, boosters: 1 }
        );
        const now = new Date();

        const cooldown = parseDuration(config.Economy.Work.cooldown);
        if (user && user.commandData.lastWork) {
            const nextWork = new Date(user.commandData.lastWork.getTime() + cooldown);
            if (now < nextWork) {
                const embed = new EmbedBuilder()
                    .setDescription(replacePlaceholders(lang.Economy.Messages.cooldown, { nextUse: Math.floor(nextWork.getTime() / 1000) }))
                    .setColor('#FF0000');
                return interaction.reply({ embeds: [embed] });
            }
        }

        let earnings = Math.floor(Math.random() * (config.Economy.Work.max - config.Economy.Work.min + 1)) + config.Economy.Work.min;
        const multiplier = checkActiveBooster(user, 'Money');
        earnings *= multiplier;

        if (!user) {
            user = new User({ userId: interaction.user.id, guildId: interaction.guild.id, balance: earnings, commandData: { lastWork: now } });
        } else {
            user.balance += earnings;
            user.commandData.lastWork = now;
            user.transactionLogs.push({
                type: 'work',
                amount: earnings,
                timestamp: now
            });
        }

        await user.save();

        const placeholders = {
            user: `<@${interaction.user.id}>`,
            balance: earnings
        };

        const embed = new EmbedBuilder()
            .setTitle(lang.Economy.Actions.Work.Title || '')
            .setDescription(replacePlaceholders(lang.Economy.Actions.Work.Messages[Math.floor(Math.random() * lang.Economy.Actions.Work.Messages.length)], placeholders))
            .setColor('#00FF00')
            .setFooter({ text: replacePlaceholders(lang.Economy.Messages.footer, { balance: user.balance }) });

        return interaction.reply({ embeds: [embed] });
    },
};