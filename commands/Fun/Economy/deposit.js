const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../../../models/UserData');
const fs = require('fs');
const yaml = require('js-yaml');
const config = yaml.load(fs.readFileSync('./config.yml', 'utf8'));
const lang = yaml.load(fs.readFileSync('./lang.yml', 'utf8'));
const { replacePlaceholders } = require('./Utility/helpers');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('deposit')
        .setDescription('Deposit coins into the bank')
        .addIntegerOption(option => option.setName('amount').setDescription('Amount to deposit').setRequired(true)),
    category: 'Economy',
    async execute(interaction) {
        try {
            const amount = interaction.options.getInteger('amount');

            const user = await User.findOne(
                { userId: interaction.user.id, guildId: interaction.guild.id },
                { balance: 1, bank: 1, transactionLogs: 1 }
            );

            if (amount <= 0) {
                const embed = new EmbedBuilder()
                    .setDescription(lang.Economy.Messages.betAmountError || "The deposit amount must be greater than 0.")
                    .setColor('#FF0000');
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            if (!user || user.balance < amount) {
                const embed = new EmbedBuilder()
                    .setDescription(lang.Economy.Messages.noMoney || "You don't have enough money to deposit.")
                    .setColor('#FF0000');
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            user.balance -= amount;
            user.bank += amount;

            user.transactionLogs.push({
                type: 'deposit',
                amount: amount,
                timestamp: new Date()
            });

            await user.save();

            const placeholders = {
                user: `<@${interaction.user.id}>`,
                balance: amount,
                bankBalance: user.bank
            };

            const description = replacePlaceholders(lang.Economy.Messages.deposit, placeholders);
            const footer = replacePlaceholders(lang.Economy.Messages.footer, { balance: user.balance });

            const embed = new EmbedBuilder()
                .setDescription(description)
                .setFooter({ text: footer })
                .setColor('#00FF00');

            return interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error("Error in deposit command: ", error);
            interaction.reply({ content: lang.Economy.Messages.error, ephemeral: true });
        }
    },
};