const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../../../models/UserData');
const fs = require('fs');
const yaml = require('js-yaml');
const lang = yaml.load(fs.readFileSync('./lang.yml', 'utf8'));
const { replacePlaceholders } = require('./Utility/helpers');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('booster')
        .setDescription('Manage your boosters')
        .addSubcommand(subcommand =>
            subcommand
                .setName('view')
                .setDescription('View your active boosters')),
    category: 'Economy',
    async execute(interaction) {
        const user = await User.findOne(
            { userId: interaction.user.id, guildId: interaction.guild.id },
            { boosters: 1 }
        );

        if (!user) {
            return interaction.reply({ content: lang.Economy.Messages.error, ephemeral: true });
        }

        if (interaction.options.getSubcommand() === 'view') {
            if (user.boosters.length === 0) {
                return interaction.reply({ content: lang.Economy.Messages.noBoosters, ephemeral: true });
            }

            const boosterList = user.boosters.map(booster => {
                const placeholders = {
                    type: booster.type,
                    multiplier: booster.multiplier,
                    endTime: Math.floor(booster.endTime / 1000),
                };
                return replacePlaceholders(lang.Economy.Other.Boosters.description, placeholders);
            }).join('\n');

            const embed = new EmbedBuilder()
                .setTitle(lang.Economy.Other.Boosters.title)
                .setDescription(boosterList)
                .setColor('#00FF00');

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
    },
};