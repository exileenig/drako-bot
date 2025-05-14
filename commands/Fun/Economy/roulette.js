﻿const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../../../models/UserData');
const fs = require('fs');
const yaml = require('js-yaml');
const config = yaml.load(fs.readFileSync('./config.yml', 'utf8'));
const lang = yaml.load(fs.readFileSync('./lang.yml', 'utf8'));
const parseDuration = require('./Utility/parseDuration');
const { checkActiveBooster, replacePlaceholders } = require('./Utility/helpers');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('roulette')
        .setDescription('Play a game of roulette')
        .addIntegerOption(option => option.setName('bet').setDescription('Bet amount').setRequired(true))
        .addStringOption(option =>
            option.setName('color')
                .setDescription('Choose a color')
                .setRequired(true)
                .addChoices(
                    { name: 'Red', value: 'red' },
                    { name: 'Black', value: 'black' },
                    { name: 'Green', value: 'green' }
                )
        ),
    category: 'Economy',
    async execute(interaction) {
        let user = await User.findOne(
            { userId: interaction.user.id, guildId: interaction.guild.id },
            { balance: 1, 'commandData.lastRoulette': 1, transactionLogs: 1, boosters: 1 }
        );

        if (!user) {
            user = new User({
                userId: interaction.user.id,
                guildId: interaction.guild.id,
                balance: 0,
                commandData: {},
                boosters: [],
                transactionLogs: []
            });
        } else if (!Array.isArray(user.transactionLogs)) {
            user.transactionLogs = [];
        }

        const now = new Date();
        const cooldown = parseDuration(config.Economy.Roulette.cooldown);

        if (cooldown > 0 && user.commandData.lastRoulette) {
            const nextRoulette = new Date(user.commandData.lastRoulette.getTime() + cooldown);
            if (now < nextRoulette) {
                const embed = new EmbedBuilder()
                    .setDescription(replacePlaceholders(lang.Economy.Messages.cooldown, { nextUse: Math.floor(nextRoulette.getTime() / 1000) }))
                    .setColor('#FF0000')
                    .setFooter({ text: replacePlaceholders(lang.Economy.Messages.footer, { balance: user.balance }) });
                return interaction.reply({ embeds: [embed] });
            }
        }

        const bet = interaction.options.getInteger('bet');

        if (bet <= 0) {
            return interaction.reply({ content: lang.Economy.Messages.betAmountError, ephemeral: true });
        }

        const color = interaction.options.getString('color').toLowerCase();
        const validColors = ['red', 'black', 'green'];
        const colorEmojis = { red: '🔴', black: '⚫', green: '🟢' };

        if (!validColors.includes(color)) {
            return interaction.reply({ content: lang.Economy.Messages.invalidColor, ephemeral: true });
        }

        if (user.balance < bet) {
            const embed = new EmbedBuilder()
                .setDescription(lang.Economy.Messages.noMoney)
                .setColor('#FF0000');
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        const result = spinRoulette();
        const winMultiplier = getWinMultiplier(color, result);

        user.balance -= bet;
        user.commandData.lastRoulette = now;
        await user.save();

        const resultEmoji = colorEmojis[result];

        const placeholders = {
            user: `<@${interaction.user.id}>`,
            balance: Math.abs(winMultiplier > 0 ? bet * winMultiplier * checkActiveBooster(user, 'Money') : bet),
            rouletteResult: resultEmoji,
            nextUse: Math.floor(now.getTime() / 1000)
        };

        if (winMultiplier > 0) {
            const winnings = bet * winMultiplier * checkActiveBooster(user, 'Money');
            user.balance += winnings;

            user.transactionLogs.push({
                type: 'roulette',
                amount: winnings - bet,
                timestamp: new Date()
            });

            const embed = new EmbedBuilder()
                .setTitle(replacePlaceholders(lang.Economy.Games.Roulette.Title, { result: lang.Economy.Messages.win }))
                .setDescription(replacePlaceholders(getRandomMessage(lang.Economy.Games.Roulette.Win), placeholders))
                .setColor('#00FF00')
                .addFields(
                    { name: lang.Economy.Messages.guess, value: colorEmojis[color], inline: true },
                    { name: lang.Economy.Messages.outcome, value: placeholders.rouletteResult, inline: true }
                )
                .setFooter({ text: replacePlaceholders(lang.Economy.Messages.footer, { balance: user.balance }) });

            await user.save();
            return interaction.reply({ embeds: [embed] });
        } else {
            user.transactionLogs.push({
                type: 'roulette',
                amount: -bet,
                timestamp: new Date()
            });

            const embed = new EmbedBuilder()
                .setTitle(replacePlaceholders(lang.Economy.Games.Roulette.Title, { result: lang.Economy.Messages.lose }))
                .setDescription(replacePlaceholders(getRandomMessage(lang.Economy.Games.Roulette.Lose), placeholders))
                .setColor('#FF0000')
                .addFields(
                    { name: lang.Economy.Messages.guess, value: colorEmojis[color], inline: true },
                    { name: lang.Economy.Messages.outcome, value: placeholders.rouletteResult, inline: true }
                )
                .setFooter({ text: replacePlaceholders(lang.Economy.Messages.footer, { balance: user.balance }) });

            await user.save();
            return interaction.reply({ embeds: [embed] });
        }
    },
};

function spinRoulette() {
    const colors = ['red', 'black', 'green'];
    const chances = [18, 18, 2];
    const totalChances = chances.reduce((a, b) => a + b, 0);
    const random = Math.floor(Math.random() * totalChances);

    let sum = 0;
    for (let i = 0; i < colors.length; i++) {
        sum += chances[i];
        if (random < sum) {
            return colors[i];
        }
    }
}

function getWinMultiplier(color, result) {
    if (color === 'green' && result === 'green') return 14;
    if (color === result) return 2;
    return 0;
}

function getRandomMessage(messages) {
    return messages[Math.floor(Math.random() * messages.length)];
}