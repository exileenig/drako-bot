const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const suggestionActions = require('../../events/Suggestions/suggestionActions');
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');
const SuggestionBlacklist = require('../../models/SuggestionBlacklist');

const config = yaml.load(fs.readFileSync(path.resolve(__dirname, '../../config.yml'), 'utf8'));
const lang = yaml.load(fs.readFileSync(path.resolve(__dirname, '../..//lang.yml'), 'utf8'));

async function openQuestionModal(interaction) {
    try {
        const modal = new ModalBuilder()
            .setCustomId('suggestionModal')
            .setTitle(lang.Suggestion.ModalTitle);

        const suggestionInput = new TextInputBuilder()
            .setCustomId('suggestionText')
            .setLabel(lang.Suggestion.ModalQuestion)
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

        const firstActionRow = new ActionRowBuilder().addComponents(suggestionInput);
        modal.addComponents(firstActionRow);

        Object.entries(config.SuggestionSettings.AdditionalModalInputs).forEach(([key, inputConfig]) => {
            const additionalInput = new TextInputBuilder()
                .setCustomId(inputConfig.ID)
                .setLabel(inputConfig.Question)
                .setPlaceholder(inputConfig.Placeholder)
                .setStyle(inputConfig.Style === 'Paragraph' ? TextInputStyle.Paragraph : TextInputStyle.Short)
                .setRequired(inputConfig.Required)
                .setMaxLength(inputConfig.maxLength);

            const actionRow = new ActionRowBuilder().addComponents(additionalInput);
            modal.addComponents(actionRow);
        });

        await interaction.showModal(modal);
    } catch (error) {
        console.error("Error in openQuestionModal: ", error);
        if (!interaction.replied) {
            await interaction.reply({ content: lang.Suggestion.Error, ephemeral: true });
        }
    }
}

const command = new SlashCommandBuilder()
    .setName('suggestion')
    .setDescription('Manage suggestions');

const useQuestionModal = config.SuggestionSettings.UseQuestionModal;

if (!useQuestionModal) {
    command.addSubcommand(subcommand =>
        subcommand
            .setName('create')
            .setDescription('Create a new suggestion')
            .addStringOption(option =>
                option.setName('text')
                    .setDescription('The suggestion text')
                    .setRequired(true)
            )
    );
} else {
    command.addSubcommand(subcommand =>
        subcommand
            .setName('create')
            .setDescription('Create a new suggestion')
    );
}

command.addSubcommand(subcommand =>
    subcommand
        .setName('accept')
        .setDescription('Accept a suggestion')
        .addStringOption(option =>
            option.setName('id')
                .setDescription('The ID of the suggestion to accept')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for accepting the suggestion')
                .setRequired(false)
        )
)
    .addSubcommand(subcommand =>
        subcommand
            .setName('deny')
            .setDescription('Deny a suggestion')
            .addStringOption(option =>
                option.setName('id')
                    .setDescription('The ID of the suggestion to deny')
                    .setRequired(true)
            )
            .addStringOption(option =>
                option.setName('reason')
                    .setDescription('Reason for denying the suggestion')
                    .setRequired(false)
            )
    )
    .addSubcommandGroup(group =>
        group
            .setName('blacklist')
            .setDescription('Manage blacklist')
            .addSubcommand(sub =>
                sub
                    .setName('add')
                    .setDescription('Add a user to the blacklist')
                    .addUserOption(option =>
                        option.setName('user')
                            .setDescription('The user to blacklist')
                            .setRequired(true)
                    )
            )
            .addSubcommand(sub =>
                sub
                    .setName('remove')
                    .setDescription('Remove a user from the blacklist')
                    .addUserOption(option =>
                        option.setName('user')
                            .setDescription('The user to remove from the blacklist')
                            .setRequired(true)
                    )
            )
    );

async function checkBlacklistWords(content) {
    const blacklistRegex = config.BlacklistWords.Patterns.map(pattern => convertSimplePatternToRegex(pattern));
    return blacklistRegex.some(regex => regex.test(content));
}

function convertSimplePatternToRegex(simplePattern) {
    let regexPattern = simplePattern
        .replace(/\./g, '\\.')
        .replace(/\*/g, '.*');
    return new RegExp(`^${regexPattern}$`, 'i');
}

module.exports = {
    data: command,
    category: 'General',
    async execute(interaction, client) {
        try {
            if (!config.SuggestionSettings.Enabled) {
                await interaction.reply({ content: lang.Suggestion.SuggestionsDisabled, ephemeral: true });
                return;
            }

            const subcommand = interaction.options.getSubcommand();

            if (subcommand === 'create') {
                const allowedRoles = config.SuggestionSettings.AllowedRoles;
                const hasAllowedRole = allowedRoles.length === 0 || allowedRoles.some(roleId => interaction.member.roles.cache.has(roleId));

                if (!hasAllowedRole) {
                    await interaction.reply({ content: lang.NoPermsMessage, ephemeral: true });
                    return;
                }

                const isBlacklisted = await SuggestionBlacklist.findOne({ userId: interaction.user.id });
                if (isBlacklisted) {
                    await interaction.reply({ content: lang.Suggestion.BlacklistMessage, ephemeral: true });
                    return;
                }

                if (useQuestionModal) {
                    await openQuestionModal(interaction);
                } else {
                    const suggestionText = interaction.options.getString('text');

                    if (config.SuggestionSettings.blockBlacklistWords && await checkBlacklistWords(suggestionText)) {
                        const blacklistMessage = lang.BlacklistWords && lang.BlacklistWords.Message
                            ? lang.BlacklistWords.Message.replace(/{user}/g, `${interaction.user}`)
                            : 'Your suggestion contains blacklisted words.';
                        await interaction.reply({ content: blacklistMessage, ephemeral: true });
                        return;
                    }

                    try {
                        await interaction.deferReply({ ephemeral: true });
                        await suggestionActions.createSuggestion(client, interaction, suggestionText);
                        await interaction.editReply({ content: lang.Suggestion.SuggestionCreated });
                    } catch (error) {
                        console.error("Error creating suggestion:", error);
                        if (!interaction.replied) {
                            await interaction.reply({ content: lang.Suggestion.Error, ephemeral: true });
                        } else {
                            await interaction.editReply({ content: lang.Suggestion.Error });
                        }
                    }
                }
            } else if (subcommand === 'accept' || subcommand === 'deny') {
                const acceptDenyRoles = config.SuggestionSettings.SuggestionAcceptDenyRoles;
                const hasAcceptDenyRole = acceptDenyRoles.some(roleId => interaction.member.roles.cache.has(roleId));

                if (!hasAcceptDenyRole) {
                    await interaction.reply({ content: lang.NoPermsMessage, ephemeral: true });
                    return;
                }

                const suggestionId = interaction.options.getString('id');
                const reason = interaction.options.getString('reason') || lang.Suggestion.Reason;

                if (subcommand === 'accept') {
                    await suggestionActions.acceptSuggestion(client, interaction, suggestionId, reason);
                } else {
                    await suggestionActions.denySuggestion(client, interaction, suggestionId, reason);
                }
            } else if (subcommand === 'add' || subcommand === 'remove') {
                const action = subcommand;
                const user = interaction.options.getUser('user');
                const acceptDenyRoles = config.SuggestionSettings.SuggestionAcceptDenyRoles;
                const hasAcceptDenyRole = acceptDenyRoles.some(roleId => interaction.member.roles.cache.has(roleId));

                if (!hasAcceptDenyRole) {
                    await interaction.reply({ content: lang.NoPermsMessage, ephemeral: true });
                    return;
                }

                if (action === 'add') {
                    await SuggestionBlacklist.updateOne({ userId: user.id }, { userId: user.id }, { upsert: true });
                    await interaction.reply({ content: `${user} has been added to the blacklist.`, ephemeral: true });
                } else if (action === 'remove') {
                    await SuggestionBlacklist.deleteOne({ userId: user.id });
                    await interaction.reply({ content: `${user} has been removed from the blacklist.`, ephemeral: true });
                }
            }
        } catch (error) {
            console.error("Error in suggestion command: ", error);
            if (!interaction.replied) {
                await interaction.reply({ content: lang.Suggestion.Error, ephemeral: true });
            }
        }
    },
};