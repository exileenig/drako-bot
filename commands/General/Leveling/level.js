const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const UserData = require('../../../models/UserData');
const fs = require('fs');
const yaml = require('js-yaml');
const config = yaml.load(fs.readFileSync('./config.yml', 'utf8'));
const lang = yaml.load(fs.readFileSync('./lang.yml', 'utf8'));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('level')
        .setDescription('Manage user levels and XP')
        .addSubcommand(subcommand =>
            subcommand.setName('give')
                .setDescription('Give XP or Levels to a user')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user to give XP or Levels to')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('type')
                        .setDescription('Choose XP or Level')
                        .setRequired(true)
                        .addChoices(
                            { name: 'XP', value: 'xp' },
                            { name: 'Level', value: 'level' }
                        ))
                .addIntegerOption(option =>
                    option.setName('amount')
                        .setDescription('Amount of XP or Levels to give')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand.setName('remove')
                .setDescription('Remove XP or Levels from a user')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user to remove XP or Levels from')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('type')
                        .setDescription('Choose XP or Level')
                        .setRequired(true)
                        .addChoices(
                            { name: 'XP', value: 'xp' },
                            { name: 'Level', value: 'level' }
                        ))
                .addIntegerOption(option =>
                    option.setName('amount')
                        .setDescription('Amount of XP or Levels to remove')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand.setName('set')
                .setDescription('Set the XP or Level of a user')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user to set XP or Level for')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('type')
                        .setDescription('Choose XP or Level')
                        .setRequired(true)
                        .addChoices(
                            { name: 'XP', value: 'xp' },
                            { name: 'Level', value: 'level' }
                        ))
                .addIntegerOption(option =>
                    option.setName('amount')
                        .setDescription('Set the amount of XP or Level')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand.setName('check')
                .setDescription('Check the XP and level of a user')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user to check XP and level for')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand.setName('reset')
                .setDescription('Reset all users\' levels and XP in the server')
                .addStringOption(option =>
                    option.setName('type')
                        .setDescription('Choose what to reset')
                        .setRequired(true)
                        .addChoices(
                            { name: 'XP Only', value: 'xp' },
                            { name: 'Level Only', value: 'level' },
                            { name: 'Both XP and Level', value: 'both' }
                        ))),
    category: 'General',
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        if (subcommand !== 'check') {
            const requiredRoles = config.LevelingSystem.Permission;
            const hasPermission = interaction.member.permissions.has(PermissionsBitField.Flags.Administrator) ||
                requiredRoles.some(roleId => interaction.member.roles.cache.has(roleId));

            if (!hasPermission) {
                await interaction.reply({ content: lang.Levels.NoPermission, ephemeral: true });
                return;
            }
        }

        if (subcommand === 'reset') {
            const type = interaction.options.getString('type');
            
            const confirmEmbed = new EmbedBuilder()
                .setTitle('⚠️ Level System Reset Confirmation')
                .setDescription(`Are you sure you want to reset ${type === 'both' ? 'both XP and levels' : type} for all users in this server?\n\nThis action cannot be undone!`)
                .setColor('#FFA500');

            const confirmButton = new ButtonBuilder()
                .setCustomId('confirm_level_reset')
                .setLabel('Confirm Reset')
                .setStyle(ButtonStyle.Danger);

            const cancelButton = new ButtonBuilder()
                .setCustomId('cancel_level_reset')
                .setLabel('Cancel')
                .setStyle(ButtonStyle.Secondary);

            const row = new ActionRowBuilder()
                .addComponents(confirmButton, cancelButton);

            const response = await interaction.reply({
                embeds: [confirmEmbed],
                components: [row],
                ephemeral: true
            });

            try {
                const confirmation = await response.awaitMessageComponent({
                    filter: i => i.user.id === interaction.user.id,
                    time: 30000
                });

                if (confirmation.customId === 'cancel_level_reset') {
                    return confirmation.update({
                        content: 'Reset cancelled.',
                        embeds: [],
                        components: []
                    });
                }

                if (confirmation.customId === 'confirm_level_reset') {
                    await confirmation.update({
                        content: 'Processing reset...',
                        embeds: [],
                        components: []
                    });

                    const updateQuery = {};
                    if (type === 'xp' || type === 'both') {
                        updateQuery.xp = 0;
                    }
                    if (type === 'level' || type === 'both') {
                        updateQuery.level = 0;
                    }

                    try {
                        const result = await UserData.updateMany(
                            { guildId: interaction.guild.id },
                            { $set: updateQuery }
                        );

                        const resultEmbed = new EmbedBuilder()
                            .setDescription(`Successfully reset ${type === 'both' ? 'XP and levels' : type} for ${result.modifiedCount} users.`)
                            .setColor('#FF0000');

                        return confirmation.editReply({
                            content: '',
                            embeds: [resultEmbed]
                        });
                    } catch (error) {
                        console.error('Error resetting levels:', error);
                        return confirmation.editReply({
                            content: 'An error occurred while resetting the levels.',
                            embeds: []
                        });
                    }
                }
            } catch (error) {
                if (error.code === 'InteractionCollectorError') {
                    await interaction.editReply({
                        content: 'Confirmation timed out. Please try again.',
                        embeds: [],
                        components: []
                    });
                } else {
                    console.error('Error in confirmation handling:', error);
                    await interaction.editReply({
                        content: 'An error occurred while processing the confirmation.',
                        embeds: [],
                        components: []
                    });
                }
            }
            return;
        }

        const user = interaction.options.getUser('user') || interaction.user;
        let userData = await UserData.findOne({ userId: user.id, guildId: guildId });
        if (!userData) {
            userData = new UserData({ userId: user.id, guildId: guildId, xp: 0, level: 1 });
        }

        switch (subcommand) {
            case 'give':
            case 'remove':
            case 'set':
                const type = interaction.options.getString('type');
                const amount = interaction.options.getInteger('amount');

                if (type === 'xp') {
                    let newXP = (subcommand === 'set') ? amount : 
                               (subcommand === 'give') ? userData.xp + amount : 
                               Math.max(0, userData.xp - amount);

                    let currentLevel = userData.level;
                    let currentXP = newXP;
                    let levelChanged = false;
                    
                    while (currentXP >= config.LevelingSystem.XPNeeded * currentLevel) {
                        currentXP -= config.LevelingSystem.XPNeeded * currentLevel;
                        currentLevel++;
                        levelChanged = true;
                    }

                    userData.level = currentLevel;
                    userData.xp = currentXP;
                    await userData.save();

                    if (levelChanged) {
                        await interaction.reply({
                            content: lang.Levels.UpdatedXPAndLevel
                                .replace('{user}', user.username)
                                .replace('{xp}', currentXP)
                                .replace('{level}', currentLevel),
                            ephemeral: true
                        });
                    } else {
                        await interaction.reply({
                            content: lang.Levels.UpdatedXP
                                .replace('{user}', user.username)
                                .replace('{xp}', currentXP),
                            ephemeral: true
                        });
                    }
                } else {
                    userData.level = (subcommand === 'set') ? amount : 
                                   (subcommand === 'give') ? userData.level + amount : 
                                   Math.max(1, userData.level - amount);

                    await userData.save();
                    await interaction.reply({
                        content: lang.Levels.UpdatedLevel
                            .replace('{user}', user.username)
                            .replace('{level}', userData.level),
                        ephemeral: true
                    });
                }
                break;
            case 'check':
                if (!userData) {
                    await interaction.reply({ 
                        content: lang.Levels.DataNotFound.replace('{user}', user.username), 
                        ephemeral: true 
                    });
                    return;
                }
                await interaction.reply({
                    content: lang.Levels.CurrentLevelAndXP
                        .replace('{user}', user.username)
                        .replace('{level}', userData.level)
                        .replace('{xp}', userData.xp),
                    ephemeral: true
                });
                break;
        }
    }
};