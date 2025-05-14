const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../../../models/UserData');
const fs = require('fs');
const yaml = require('js-yaml');
const config = yaml.load(fs.readFileSync('./config.yml', 'utf8'));
const lang = yaml.load(fs.readFileSync('./lang.yml', 'utf8'));
const { replacePlaceholders } = require('./Utility/helpers');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('withdraw')
        .setDescription('Withdraw coins from the bank')
        .addIntegerOption(option => option.setName('amount').setDescription('Amount to withdraw').setRequired(true)),
    category: 'Economy',
    async execute(interaction) {
        const amount = interaction.options.getInteger('amount');

        if (amount <= 0) {
            return interaction.reply({ content: lang.Economy.Messages.invalidAmount, ephemeral: true });
        }

        const user = await User.findOne(
            { userId: interaction.user.id, guildId: interaction.guild.id },
            { bank: 1, balance: 1 }
        );

        if (!user || user.bank < amount) {
            const embed = new EmbedBuilder()
                .setDescription(lang.Economy.Messages.noMoney)
                .setColor('#FF0000');
            return interaction.reply({ embeds: [embed] });
        }

        user.bank -= amount;
        user.balance += amount;
        await user.save();

        const embed = new EmbedBuilder()
            .setDescription(replacePlaceholders(lang.Economy.Messages.withdraw, { coins: amount }))
            .setColor('#00FF00')
            .setFooter({ text: replacePlaceholders(lang.Economy.Messages.footer, { balance: user.balance }) });

        return interaction.reply({ embeds: [embed] });
    },
};