﻿const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../../../models/UserData');
const fs = require('fs');
const yaml = require("js-yaml");
const config = yaml.load(fs.readFileSync('./config.yml', 'utf8'));
const lang = yaml.load(fs.readFileSync('./lang.yml', 'utf8'));
const parseDuration = require('./Utility/parseDuration');
const { checkActiveBooster, replacePlaceholders } = require('./Utility/helpers');

function getRandomMessage(messages) {
    return messages[Math.floor(Math.random() * messages.length)];
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('coinflip')
        .setDescription('Flip a coin and test your luck!')
        .addIntegerOption(option => option.setName('bet').setDescription('Bet amount').setRequired(true))
        .addStringOption(option => option.setName('guess').setDescription('Guess the outcome: heads or tails').setRequired(true).addChoices(
            { name: 'Heads', value: 'heads' },
            { name: 'Tails', value: 'tails' }
        )),
    category: 'Economy',
    async execute(interaction) {
        try {
            const cooldown = parseDuration(config.Economy.Coinflip.cooldown);

            let user = await User.findOne(
                { userId: interaction.user.id, guildId: interaction.guild.id },
                { balance: 1, 'commandData.lastCoinflip': 1, transactionLogs: 1, boosters: 1 }
            );

            if (!user) {
                user = new User({
                    userId: interaction.user.id,
                    guildId: interaction.guild.id,
                    balance: 0,
                    commandData: {},
                    boosters: []
                });
            }

            const now = new Date();

            if (cooldown > 0 && user.commandData.lastCoinflip) {
                const nextCoinflip = new Date(user.commandData.lastCoinflip.getTime() + cooldown);
                if (now < nextCoinflip) {
                    const embed = new EmbedBuilder()
                        .setDescription(replacePlaceholders(lang.Economy.Messages.cooldown, { nextUse: Math.floor(nextCoinflip.getTime() / 1000) }))
                        .setColor('#FF0000')
                        .setFooter({ text: replacePlaceholders(lang.Economy.Messages.footer, { balance: user.balance }) });
                    return interaction.reply({ embeds: [embed] });
                }
            }

            const bet = interaction.options.getInteger('bet');
            const guess = interaction.options.getString('guess').toLowerCase();

            if (bet <= 0) {
                return interaction.reply({ content: lang.Economy.Messages.betAmountError, ephemeral: true });
            }

            if (user.balance < bet) {
                const embed = new EmbedBuilder()
                    .setDescription(lang.Economy.Messages.noMoney)
                    .setColor('#FF0000');
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            const result = Math.random() > 0.5 ? 'heads' : 'tails';
            const win = guess === result;
            const multiplier = checkActiveBooster(user, 'Money');
            const amount = win ? bet * multiplier : -bet;

            user.balance += amount;
            user.commandData.lastCoinflip = now;
            user.transactionLogs.push({
                type: 'coinflip',
                amount: amount,
                timestamp: now
            });

            await user.save();

            const placeholders = {
                user: `<@${interaction.user.id}>`,
                balance: Math.abs(amount),
                nextUse: Math.floor(now.getTime() / 1000)
            };

            const coinflipTitle = replacePlaceholders(lang.Economy.Games.Coinflip.Title, { result: win ? lang.Economy.Messages.win : lang.Economy.Messages.lose });

            const winMessage = replacePlaceholders(getRandomMessage(lang.Economy.Games.Coinflip.Win), placeholders);
            const loseMessage = replacePlaceholders(getRandomMessage(lang.Economy.Games.Coinflip.Lose), placeholders);
            const description = win ? winMessage : loseMessage;

            const yourGuess = guess === 'heads' ? '🪙 ' + lang.Economy.Games.Coinflip.heads : '🔄 ' + lang.Economy.Games.Coinflip.tails;
            const resultText = result === 'heads' ? '🪙 ' + lang.Economy.Games.Coinflip.heads : '🔄 ' + lang.Economy.Games.Coinflip.tails;

            const fields = [
                { name: lang.Economy.Messages.guess, value: yourGuess, inline: true },
                { name: lang.Economy.Messages.result, value: resultText, inline: true }
            ];

            const embed = new EmbedBuilder()
                .setTitle(coinflipTitle)
                .setColor(win ? '#00FF00' : '#FF0000')
                .setDescription(description)
                .addFields(fields)
                .setFooter({ text: replacePlaceholders(lang.Economy.Messages.footer, { balance: user.balance }) });

            interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error("Error in coinflip command: ", error);
            interaction.reply({ content: lang.Economy.Messages.error, ephemeral: true });
        }
    }
};