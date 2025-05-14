const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const fs = require('fs');
const yaml = require('js-yaml');
const path = require('path');

const commandsConfig = yaml.load(fs.readFileSync('./commands.yml', 'utf8'));
const lang = yaml.load(fs.readFileSync('./lang.yml', 'utf8'));
const config = yaml.load(fs.readFileSync('./config.yml', 'utf8'));

const botName = config.BotName;

function replacePlaceholders(text, placeholders) {
    return text
        .replace(/{botName}/g, placeholders.botName || '')
        .replace(/{category}/g, placeholders.category || '')
        .replace(/{user}/g, placeholders.user || '')
        .replace(/{guild}/g, placeholders.guild || '')
        .replace(/{user-avatar}/g, placeholders.userAvatar || '')
        .replace(/{guild-avatar}/g, placeholders.guildAvatar || '');
}

function extractCommands(commandData, parentName = null, commandsList = []) {
    const commandName = parentName ? `${parentName} ${commandData.name}` : commandData.name;

    if (commandData.options && commandData.options.length > 0) {
        commandData.options.forEach(option => {
            if (option.type === 'SUB_COMMAND' || option.type === 'SUB_COMMAND_GROUP') {
                extractCommands(option, commandName, commandsList);
            }
        });
    } else {
        commandsList.push(commandName);
    }

    return commandsList;
}

function getAllCommands(client) {
    const commands = {};

    client.slashCommands.forEach(command => {
        if (command.data && typeof command.data.toJSON === 'function') {
            const commandJSON = command.data.toJSON();
            const categoryName = command.category || 'Addon';

            if (!commands[categoryName]) {
                commands[categoryName] = [];
            }

            let commandDisplay = `**</${commandJSON.name}:${command.id || 'undefined'}>**`;

            if (commandJSON.options) {
                const subcommands = commandJSON.options.filter(option => option.type === 1);
                if (subcommands.length > 0) {
                    subcommands.forEach(subcommand => {
                        commandDisplay += `\n  ├─ **</${commandJSON.name} ${subcommand.name}:${command.id || 'undefined'}>**`;
                    });
                    commands[categoryName].unshift(commandDisplay);
                } else {
                    commands[categoryName].push(commandDisplay);
                }
            } else {
                commands[categoryName].push(commandDisplay);
            }
        } else {
            console.warn(`Command ${command.data?.name || 'unknown'} is missing the 'data' property or it is not properly formatted.`);
        }
    });

    return commands;
}

function validateURL(url) {
    return url && url.trim().length > 0 && url !== 'null';
}

function addEmbedFields(embed, fields, placeholders = {}) {
    const cleanPlaceholders = Object.fromEntries(
        Object.entries(placeholders).filter(([_, value]) => value != null && value !== 'null')
    );

    if (fields.Title && fields.Title.trim()) {
        embed.setTitle(replacePlaceholders(fields.Title, cleanPlaceholders));
    }
    if (fields.Description && fields.Description.length > 0) {
        embed.setDescription(fields.Description.map(line => replacePlaceholders(line, cleanPlaceholders)).join('\n'));
    }
    if (fields.Color && fields.Color.trim()) {
        embed.setColor(fields.Color);
    }
    if (fields.Thumbnail) {
        const thumbnailUrl = replacePlaceholders(fields.Thumbnail, cleanPlaceholders);
        if (validateURL(thumbnailUrl)) {
            embed.setThumbnail(thumbnailUrl);
        }
    }
    if (fields.Image) {
        embed.setImage(fields.Image);
    }
    if (fields.Footer && fields.Footer.Text && fields.Footer.Text.trim()) {
        embed.setFooter({
            text: replacePlaceholders(fields.Footer.Text, cleanPlaceholders),
            iconURL: validateURL(fields.Footer.Icon) ? replacePlaceholders(fields.Footer.Icon, cleanPlaceholders) : undefined
        });
    }
    if (fields.Author && fields.Author.Text && fields.Author.Text.trim()) {
        const authorName = replacePlaceholders(fields.Author.Text, cleanPlaceholders);
        if (authorName.trim()) {
            embed.setAuthor({
                name: authorName,
                iconURL: validateURL(fields.Author.Icon) ? replacePlaceholders(fields.Author.Icon, cleanPlaceholders) : undefined
            });
        }
    }
    embed.setTimestamp();
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('View a list of all the commands'),
    category: 'General',
    async execute(interaction, client) {
        try {
            if (!client.commandsReady) {
                return await interaction.reply({
                    content: 'Commands are still registering. Please try again in a few moments.',
                    ephemeral: true
                });
            }

            await interaction.deferReply();

            const user = interaction.user.username;
            const userAvatar = interaction.user.displayAvatarURL();
            const guild = interaction.guild.name;
            const guildAvatar = interaction.guild.iconURL();

            const placeholders = {
                botName,
                user,
                guild,
                userAvatar,
                guildAvatar
            };

            const commandCategories = getAllCommands(client);

            const categoryOptions = Object.keys(commandCategories).map(category => ({
                label: lang.HelpCommand.Categories[category]?.Name || category,
                value: category,
                emoji: lang.HelpCommand.Categories[category]?.Emoji || '❓',
                description: lang.HelpCommand.Categories[category]?.Description || 'Various commands'
            }));

            const helpEmbed = new EmbedBuilder();
            addEmbedFields(helpEmbed, lang.HelpCommand.MainEmbed, placeholders);

            const baseRow = new ActionRowBuilder()
                .addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId(`category_select_${interaction.id}`)
                        .setPlaceholder(lang.HelpCommand.CategorySelectPlaceholder)
                        .addOptions(categoryOptions)
                );

            const backButton = new ButtonBuilder()
                .setCustomId(`back_${interaction.id}`)
                .setLabel(lang.HelpCommand.BackButtonLabel)
                .setStyle(ButtonStyle.Primary);

            await interaction.editReply({ embeds: [helpEmbed], components: [baseRow] });

            const collector = interaction.channel.createMessageComponentCollector({
                componentType: ComponentType.StringSelectMenu,
                time: 300000,
                filter: i => i.user.id === interaction.user.id && i.customId === `category_select_${interaction.id}`
            });

            collector.on('collect', async i => {
                if (i.customId === `category_select_${interaction.id}`) {
                    const selectedCategory = i.values[0];
                    const commands = commandCategories[selectedCategory].join('\n');

                    const categoryEmbed = new EmbedBuilder();
                    addEmbedFields(categoryEmbed, {
                        ...lang.HelpCommand.CategoryEmbed,
                        Title: replacePlaceholders(lang.HelpCommand.CategoryEmbed.Title, {
                            ...placeholders,
                            category: lang.HelpCommand.Categories[selectedCategory]?.Name || selectedCategory
                        }),
                        Description: [commands]
                    }, placeholders);

                    await i.deferUpdate();
                    await i.editReply({ embeds: [categoryEmbed], components: [new ActionRowBuilder().addComponents(backButton)] });
                }
            });

            const backCollector = interaction.channel.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 300000,
                filter: i => i.user.id === interaction.user.id && i.customId === `back_${interaction.id}`
            });

            backCollector.on('collect', async i => {
                if (i.customId === `back_${interaction.id}`) {
                    await i.deferUpdate();
                    await i.editReply({ embeds: [helpEmbed], components: [baseRow] });
                }
            });

            collector.on('end', async () => {
                try {
                    await interaction.editReply({ components: [] });
                } catch (error) {
                    console.error('Failed to remove components after collector end:', error);
                }
            });

            backCollector.on('end', async () => {
                try {
                    await interaction.editReply({ components: [] });
                } catch (error) {
                    console.error('Failed to remove components after back collector end:', error);
                }
            });

        } catch (error) {
            console.error(`An error occurred while executing the help command: ${error.message}`);
            try {
                if (interaction.deferred) {
                    await interaction.editReply('There was an error trying to execute that command! Please try again later.');
                } else if (!interaction.replied) {
                    await interaction.reply('There was an error trying to execute that command! Please try again later.');
                }
            } catch (replyError) {
                console.error('Failed to send error message:', replyError);
            }
        }
    }
};