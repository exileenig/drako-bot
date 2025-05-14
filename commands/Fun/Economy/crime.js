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
        .setName('crime')
        .setDescription('Attempt to commit a crime'),
    category: 'Economy',
    async execute(interaction) {
        try {
            let user = await User.findOne(
                { userId: interaction.user.id, guildId: interaction.guild.id },
                { balance: 1, 'commandData.lastCrime': 1, transactionLogs: 1, boosters: 1 }
            );

            const now = new Date();

            const cooldown = parseDuration(config.Economy.Crime.cooldown);
            if (user && user.commandData.lastCrime) {
                const nextCrime = new Date(user.commandData.lastCrime.getTime() + cooldown);
                if (now < nextCrime) {
                    const embed = new EmbedBuilder()
                        .setDescription(replacePlaceholders(lang.Economy.Messages.cooldown, { nextUse: Math.floor(nextCrime.getTime() / 1000) }))
                        .setColor('#FF0000')
                        .setFooter({ text: replacePlaceholders(lang.Economy.Messages.footer, { balance: user.balance }) });
                    return interaction.reply({ embeds: [embed] });
                }
            }

            let amount = Math.floor(Math.random() * (config.Economy.Crime.max - config.Economy.Crime.min + 1)) + config.Economy.Crime.min;
            const multiplier = checkActiveBooster(user, 'Money');
            amount *= multiplier;
            const success = amount > 0;

            if (!user) {
                user = new User({
                    userId: interaction.user.id,
                    guildId: interaction.guild.id,
                    balance: success ? amount : 0,
                    commandData: { lastCrime: now },
                    transactionLogs: []
                });
            } else {
                user.balance += amount;

                if (user.balance < 0) {
                    user.balance = 0;
                }

                user.commandData.lastCrime = now;
            }

            user.transactionLogs.push({
                type: 'crime',
                amount: amount,
                timestamp: now
            });

            await user.save();

            const placeholders = {
                user: `<@${interaction.user.id}>`,
                balance: Math.abs(amount)
            };

            const crimeTitle = replacePlaceholders(lang.Economy.Games.Crime.Title, { result: success ? lang.Economy.Messages.win : lang.Economy.Messages.lose });
            const description = success
                ? replacePlaceholders(lang.Economy.Games.Crime.Win[Math.floor(Math.random() * lang.Economy.Games.Crime.Win.length)], placeholders)
                : replacePlaceholders(lang.Economy.Games.Crime.Lose[Math.floor(Math.random() * lang.Economy.Games.Crime.Lose.length)], placeholders);

            const embed = new EmbedBuilder()
                .setTitle(crimeTitle)
                .setDescription(description)
                .setFooter({ text: replacePlaceholders(lang.Economy.Messages.footer, { balance: user.balance }) })
                .setColor(success ? '#00FF00' : '#FF0000');

            return interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error("Error in crime command: ", error);
            interaction.reply({ content: lang.Economy.Messages.error, ephemeral: true });
        }
    },
};