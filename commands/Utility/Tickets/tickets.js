/*
  _____            _           ____        _   
 |  __ \          | |         |  _ \      | |  
 | |  | |_ __ __ _| | _____   | |_) | ___ | |_ 
 | |  | | '__/ _` | |/ / _ \  |  _ < / _ \| __|
 | |__| | | | (_| |   < (_) | | |_) | (_) | |_ 
 |_____/|_|  \__,_|_|\_\___/  |____/ \___/ \__|
                                             
                                        
 Thank you for choosing Drako Bot!

 Should you encounter any issues, require assistance, or have suggestions for improving the bot,
 we invite you to connect with us on our Discord server and create a support ticket: 

 http://discord.drakodevelopment.net
 
*/

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, StringSelectMenuBuilder, PermissionFlagsBits, ButtonStyle } = require('discord.js');
const fs = require('fs');
const yaml = require('js-yaml');
const path = require('path');
const moment = require('moment-timezone');
const Ticket = require('../../../models/tickets');
const Blacklist = require('../../../models/blacklist');

const { handleTicketClose } = require('../../../events/interactionCreate');

const configPath = path.join(__dirname, '../../../config.yml');
const langPath = path.join(__dirname, '../../../lang.yml');

const config = yaml.load(fs.readFileSync(configPath, 'utf8'));
const lang = yaml.load(fs.readFileSync(langPath, 'utf8'));

const channelRenameQueue = new Map();
const RENAME_COOLDOWN = 60000;
const MAX_RETRIES = 5;
let lastRenameTime = 0;
let isProcessing = false;

const priorityChangeCooldowns = new Map();
const PRIORITY_CHANGE_COOLDOWN = 5000;

const PRIORITY_COLORS = {
    'High': '#ff0000',
    'Medium': '#ffff00',
    'Low': '#00ff00'
};

async function processRenameQueue() {
    if (isProcessing) {
        return;
    }
    
    isProcessing = true;

    try {
        const entries = Array.from(channelRenameQueue.entries());
        for (const [channelId, data] of entries) {
            const now = Date.now();
            
            if (now - lastRenameTime < RENAME_COOLDOWN) {
                continue;
            }

            try {
                const freshChannel = await data.channel.guild.channels.fetch(channelId);
                
                const updateData = { name: data.name.toLowerCase() };
                
                if (data.ticket && data.ticketType && data.ticketType.ChannelTopic) {
                    const topic = data.ticketType.ChannelTopic
                        .replace('{ticketType}', data.ticketType.Name)
                        .replace('{userid}', `<@${data.ticket.userId}>`)
                        .replace('{user}', `<@${data.ticket.userId}>`)
                        .replace('{ticket-id}', data.ticket.ticketId)
                        .replace('{priority}', data.ticket.priority)
                        .replace('{created-at}', moment(data.ticket.createdAt).format('MMMM Do YYYY, h:mm:ss a'))
                        .replace('{category}', freshChannel.parent?.name || 'None');
                    
                    updateData.topic = topic;
                }

                let updatedChannel = null;
                let retryCount = 0;
                const maxRetries = 3;

                while (retryCount < maxRetries) {
                    try {
                        updatedChannel = await freshChannel.edit(updateData, 'Ticket priority update');
                        break;
                    } catch (retryError) {
                        console.error(`Retry ${retryCount + 1} failed:`, retryError);
                        retryCount++;
                        if (retryCount < maxRetries) {
                            await new Promise(resolve => setTimeout(resolve, 1000));
                        }
                    }
                }

                if (!updatedChannel) {
                    throw new Error('Failed to update channel after retries');
                }

                if (updatedChannel.name === updateData.name) {
                    lastRenameTime = now;
                    channelRenameQueue.delete(channelId);
                } else {
                    throw new Error('Channel name did not update as expected');
                }
                
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                console.error(`Error updating channel ${channelId}:`, error);
                
                if (error.message.includes('rate limit')) {
                    data.queuedAt = now;
                    data.retries = (data.retries || 0) + 1;
                    
                    if (data.retries > MAX_RETRIES) {
                        channelRenameQueue.delete(channelId);
                    }
                } else {
                    channelRenameQueue.delete(channelId);
                }
            }
        }
    } finally {
        isProcessing = false;
    }
}

async function queueChannelRename(channel, newName, ticket = null, ticketType = null) {
    const now = Date.now();

    if (now - lastRenameTime >= RENAME_COOLDOWN && !isProcessing) {
        try {
            
            const freshChannel = await channel.guild.channels.fetch(channel.id);
            
            const updateData = { name: newName.toLowerCase() };
            
            if (ticket && ticketType && ticketType.ChannelTopic) {
                const topic = ticketType.ChannelTopic
                    .replace('{ticketType}', ticketType.Name)
                    .replace('{userid}', `<@${ticket.userId}>`)
                    .replace('{user}', `<@${ticket.userId}>`)
                    .replace('{ticket-id}', ticket.ticketId)
                    .replace('{priority}', ticket.priority)
                    .replace('{created-at}', moment(ticket.createdAt).format('MMMM Do YYYY, h:mm:ss a'))
                    .replace('{category}', freshChannel.parent?.name || 'None');
                
                updateData.topic = topic;
            }

            let updatedChannel = null;
            let retryCount = 0;
            const maxRetries = 3;

            while (retryCount < maxRetries) {
                try {
                    updatedChannel = await freshChannel.edit(updateData, 'Ticket priority update');
                    break;
                } catch (retryError) {
                    console.error(`Retry ${retryCount + 1} failed:`, retryError);
                    retryCount++;
                    if (retryCount < maxRetries) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }
            }

            if (!updatedChannel) {
                throw new Error('Failed to update channel after retries');
            }


            if (updatedChannel.name === updateData.name) {
                lastRenameTime = now;
                return true;
            } else {
                throw new Error('Channel name did not update as expected');
            }
        } catch (error) {
            console.error('Error during immediate channel update:', error);
            if (error.message.includes('rate limit')) {
            } else {
                console.error('Unexpected error during channel update:', error);
            }

        }
    } else {
    }

    channelRenameQueue.set(channel.id, {
        channel,
        name: newName.toLowerCase(),
        ticket,
        ticketType,
        queuedAt: now,
        retries: 0
    });

    return false;
}

const queueProcessor = setInterval(processRenameQueue, 5000);

process.on('exit', () => {
    clearInterval(queueProcessor);
});

function parseDuration(duration) {
    const timeUnits = {
        s: 1000,
        m: 1000 * 60,
        h: 1000 * 60 * 60,
        d: 1000 * 60 * 60 * 24,
        w: 1000 * 60 * 60 * 24 * 7
    };

    const matches = duration.match(/(\d+\s*[smhdw])/g);
    if (!matches) return 0;

    return matches.reduce((total, match) => {
        const value = parseInt(match.match(/\d+/)[0]);
        const unit = match.match(/[smhdw]/)[0];
        return total + value * timeUnits[unit];
    }, 0);
}

function isValidHttpUrl(string) {
    try {
        const url = new URL(string);
        return url.protocol === "http:" || url.protocol === "https:";
    } catch (_) {
        return false;
    }
}

function hasSupportRole(member, roles) {
    return member.roles.cache.some(role => roles.includes(role.id));
}

function formatDuration(ms) {
    const duration = moment.duration(ms);
    const days = duration.days();
    const hours = duration.hours();
    const minutes = duration.minutes();
    const seconds = duration.seconds();

    if (days > 0) {
        return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
        return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds}s`;
    } else {
        return `${seconds}s`;
    }
}

async function getUserPriority(member) {
    const priorityConfig = config.Priority;
    if (!priorityConfig.Enabled) {
        return priorityConfig.DefaultPriority;
    }

    for (const level of Object.keys(priorityConfig.Levels)) {
        const levelConfig = priorityConfig.Levels[level];
        for (const roleId of levelConfig.Roles) {
            if (member.roles.cache.has(roleId)) {
                return level;
            }
        }
    }

    return priorityConfig.DefaultPriority;
}

const replacePlaceholders = (text, workingHours) => {
    if (!text) return '';
    return text
        .replace('{workinghours_start}', workingHours.start)
        .replace('{workinghours_end}', workingHours.end)
        .replace('{workinghours_start_monday}', workingHours.mondayStart)
        .replace('{workinghours_end_monday}', workingHours.mondayEnd)
        .replace('{workinghours_start_tuesday}', workingHours.tuesdayStart)
        .replace('{workinghours_end_tuesday}', workingHours.tuesdayEnd)
        .replace('{workinghours_start_wednesday}', workingHours.wednesdayStart)
        .replace('{workinghours_end_wednesday}', workingHours.wednesdayEnd)
        .replace('{workinghours_start_thursday}', workingHours.thursdayStart)
        .replace('{workinghours_end_thursday}', workingHours.thursdayEnd)
        .replace('{workinghours_start_friday}', workingHours.fridayStart)
        .replace('{workinghours_end_friday}', workingHours.fridayEnd)
        .replace('{workinghours_start_saturday}', workingHours.saturdayStart)
        .replace('{workinghours_end_saturday}', workingHours.saturdayEnd)
        .replace('{workinghours_start_sunday}', workingHours.sundayStart)
        .replace('{workinghours_end_sunday}', workingHours.sundayEnd);
};

async function updateChannelPermissions(channel, newTicketType, userId) {
    try {
        const permissionOverwrites = [
            {
                id: channel.guild.roles.everyone.id,
                deny: ['SendMessages', 'ViewChannel']
            },
            {
                id: userId,
                allow: ['SendMessages', 'ViewChannel', 'AttachFiles', 'EmbedLinks', 'ReadMessageHistory']
            }
        ];

        newTicketType.SupportRole.forEach(roleId => {
            const role = channel.guild.roles.cache.get(roleId);
            if (role) {
                permissionOverwrites.push({
                    id: role.id,
                    allow: ['SendMessages', 'ViewChannel', 'AttachFiles', 'EmbedLinks', 'ReadMessageHistory']
                });
            }
        });

        await channel.permissionOverwrites.set(permissionOverwrites);
    } catch (error) {
        console.error('Error updating channel permissions:', error);
        throw new Error('Failed to update channel permissions');
    }
}

async function moveChannel(channel, newCategoryId) {
    try {
        await channel.setParent(newCategoryId, { lockPermissions: false });
    } catch (error) {
        console.error('Error moving channel:', error);
        throw new Error('Failed to move channel');
    }
}

async function renameChannel(channel, newName) {
    try {
        await channel.setName(newName);
    } catch (error) {
        console.error('Error renaming channel:', error);
        throw new Error('Failed to rename channel');
    }
}

async function handlePriorityChange(interaction, ticket, newPriority) {
    const now = Date.now();
    const channel = interaction.channel;
    const ticketType = config.TicketTypes[ticket.ticketType];
    const oldPriority = ticket.priority;

    if (!interaction.member.roles.cache.some(role => ticketType.SupportRole.includes(role.id))) {
        throw new Error('NO_PERMISSION');
    }

    const lastChange = priorityChangeCooldowns.get(ticket.channelId);
    if (lastChange && now - lastChange < PRIORITY_CHANGE_COOLDOWN) {
        const remainingTime = Math.ceil((PRIORITY_CHANGE_COOLDOWN - (now - lastChange)) / 1000);
        throw new Error(`COOLDOWN:${remainingTime}`);
    }

    ticket.priority = newPriority;
    await ticket.save();
    priorityChangeCooldowns.set(ticket.channelId, now);

    const member = await interaction.guild.members.fetch(ticket.userId);
    const newName = ticketType.ChannelName
        .replace('{ticket-id}', ticket.ticketId)
        .replace('{user}', member?.user.username || 'unknown')
        .replace('{priority}', newPriority);

    const willBeQueued = now - lastRenameTime < RENAME_COOLDOWN || channelRenameQueue.size > 0;
    const description = `Ticket priority has been changed from **${oldPriority}** to **${newPriority}** by <@${interaction.user.id}>` +
        (willBeQueued ? '\n\n⏳ This action has been queued, it can take up to 1 minute.' : '');

    const responseEmbed = new EmbedBuilder()
        .setColor(PRIORITY_COLORS[newPriority])
        .setDescription(description);

    await interaction.reply({ embeds: [responseEmbed], ephemeral: true });

    await queueChannelRename(channel, newName, ticket, ticketType);

    if (config.Priority.Levels[newPriority]?.MoveTop) {
        const category = channel.parent;
        if (category) {
            const firstPosition = category.children.cache
                .filter(ch => ch.id !== channel.id)
                .first()?.position || 0;
            await channel.setPosition(firstPosition);
        }
    }

    const notificationEmbed = new EmbedBuilder()
        .setColor(PRIORITY_COLORS[newPriority])
        .setDescription(`🔄 **Priority Update**\n\nPriority changed from **${oldPriority}** to **${newPriority}**\nUpdated by: <@${interaction.user.id}>`);

    await channel.send({ embeds: [notificationEmbed] });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tickets')
        .setDescription('Various ticket commands for managing tickets')
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Add a user to the ticket')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user to add to the ticket')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('alert')
                .setDescription('Send an alert about pending ticket closure.')
                .addStringOption(option => 
                    option
                        .setName('reason')
                        .setDescription('Reason for the alert')
                        .setRequired(false)
                )
        )
        .addSubcommandGroup(group =>
            group
                .setName('blacklist')
                .setDescription('Manage the blacklist')
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('add')
                        .setDescription('Blacklist a user from opening tickets')
                        .addUserOption(option =>
                            option.setName('user')
                                .setDescription('The user to blacklist')
                                .setRequired(true)
                        )
                        .addStringOption(option =>
                            option.setName('reason')
                                .setDescription('Reason for blacklisting')
                                .setRequired(false)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('view')
                        .setDescription('View the blacklist reason for a user')
                        .addUserOption(option =>
                            option.setName('user')
                                .setDescription('The user to check')
                                .setRequired(true)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('remove')
                        .setDescription('Remove a user from the blacklist')
                        .addUserOption(option =>
                            option.setName('user')
                                .setDescription('The user to remove from the blacklist')
                                .setRequired(true)
                        )
                )
        )
        .addSubcommand(subcommand => {
            const closeCommand = subcommand
                .setName('close')
                .setDescription('Close the current ticket')
                .addBooleanOption(option =>
                    option
                        .setName('silent')
                        .setDescription('Silently close and delete the ticket without triggering any events')
                        .setRequired(false)
                );

            if (config.TicketSettings.CloseReasons.Enabled) {
                closeCommand.addStringOption(option =>
                    option
                        .setName('reason')
                        .setDescription('Reason for closing the ticket')
                        .setRequired(false)
                        .addChoices(
                            ...config.TicketSettings.CloseReasons.Reasons.map(reason => ({
                                name: `${reason.emoji} ${reason.name}`,
                                value: reason.value
                            }))
                        )
                );

                if (config.TicketSettings.CloseReasons.AllowCustomReason) {
                    closeCommand.addStringOption(option =>
                        option
                            .setName('custom_reason')
                            .setDescription('Custom reason for closing the ticket')
                            .setRequired(false)
                    );
                }
            }

            return closeCommand;
        })
        .addSubcommand(subcommand =>
            subcommand
                .setName('panel')
                .setDescription('Send the ticket panel')
                .addStringOption(option => {
                    option.setName('panel')
                        .setDescription('The panel to display')
                        .setRequired(true);

                    Object.keys(config.TicketPanelSettings).forEach(panel => {
                        option.addChoices({ name: panel, value: panel });
                    });

                    return option;
                })
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove a user from the ticket')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user to remove from the ticket')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('rename')
                .setDescription('Rename the ticket channel')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('The new name for the ticket channel')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('stats')
                .setDescription('Show general ticket stats')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('transfer')
                .setDescription('Transfer a ticket to a new type')
                .addStringOption(option =>
                    option.setName('type')
                        .setDescription('The new ticket type')
                        .setRequired(true)
                        .addChoices(
                            ...Object.keys(config.TicketTypes).map(key => ({
                                name: config.TicketTypes[key].Name,
                                value: key
                            }))
                        )
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('priority')
                .setDescription('Change the priority of the ticket')
                .addStringOption(option => {
                    const priorityOption = option
                        .setName('priority')
                        .setDescription('The new priority level')
                        .setRequired(true);

                    const priorityEmojis = {
                        'Low': '🟢',
                        'Medium': '🟡',
                        'High': '🔴'
                    };

                    const choices = Object.keys(config.Priority.Levels).map(level => ({
                        name: `${priorityEmojis[level] || ''} ${level} Priority`,
                        value: level
                    }));

                    priorityOption.addChoices(...choices);
                    return priorityOption;
                })
        ),
    category: 'Utility',
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const group = interaction.options.getSubcommandGroup(false);

        if (subcommand === 'add' && !group) {
            try {
                const userToAdd = interaction.options.getUser('user');
                const ticket = await Ticket.findOne({ channelId: interaction.channel.id });

                if (!ticket) {
                    return interaction.reply({ content: 'This command can only be used within a ticket channel.', ephemeral: true });
                }

                const supportRoles = config.TicketTypes[ticket.ticketType].SupportRole;
                const hasSupportRole = interaction.member.roles.cache.some(role => supportRoles.includes(role.id));

                if (!hasSupportRole) {
                    return interaction.reply({ content: 'You do not have permissions to use this command.', ephemeral: true });
                }

                const channel = interaction.channel;

                const memberPermissions = channel.permissionsFor(userToAdd);
                if (memberPermissions && memberPermissions.has(PermissionFlagsBits.ViewChannel, false)) {
                    return interaction.reply({ content: 'User is already added to this ticket.', ephemeral: true });
                }

                await channel.permissionOverwrites.create(userToAdd, {
                    ViewChannel: true,
                    SendMessages: true,
                    ReadMessageHistory: true,
                    AttachFiles: true,
                    EmbedLinks: true
                });

                const embed = new EmbedBuilder()
                    .setColor('#00FF00')
                    .setDescription(`Successfully added ${userToAdd.tag} to the ticket.`);

                await interaction.reply({ embeds: [embed], ephemeral: true });

                const notificationEmbed = new EmbedBuilder()
                    .setColor('#00FF00')
                    .setDescription(`<@${userToAdd.id}> has been added to the ticket by <@${interaction.user.id}>.`);

                await channel.send({ embeds: [notificationEmbed] });
            } catch (error) {
                console.error('Error adding user to ticket:', error);
                await interaction.reply({ content: 'An error occurred while adding the user to the ticket. Please try again later.', ephemeral: true });
            }

        } else if (subcommand === 'alert' && !group) {
            const supportRoles = config.TicketTypes.TicketType1.SupportRole;
            if (!interaction.member.roles.cache.some(role => supportRoles.includes(role.id))) {
                return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
            }

            if (!config.Alert.Enabled) {
                return interaction.reply({ content: 'Alert feature is disabled.', ephemeral: true });
            }

            const ticket = await Ticket.findOne({ channelId: interaction.channel.id });
            if (!ticket) {
                return interaction.reply({ content: 'This command can only be used in ticket channels.', ephemeral: true });
            }

            const reason = interaction.options.getString('reason') || 'No reason provided';
            const timeDuration = config.Alert.Time;
            const alertDurationMs = parseDuration(timeDuration);
            const alertTime = new Date(Date.now() + alertDurationMs);
            const discordTimestamp = `<t:${Math.floor(alertTime.getTime() / 1000)}:R>`;

            ticket.alertTime = alertTime;
            ticket.alertReason = reason;
            await ticket.save();

            const alertConfig = config.Alert.Embed;
            const embed = new EmbedBuilder()
                .setDescription(alertConfig.Description.join('\n')
                    .replace('{user}', `<@${ticket.userId}>`)
                    .replace('{time}', discordTimestamp)
                    .replace('{reason}', reason));

            if (alertConfig.Title) embed.setTitle(alertConfig.Title);
            if (alertConfig.Color) embed.setColor(alertConfig.Color);
            if (alertConfig.Footer?.Text) {
                embed.setFooter({
                    text: alertConfig.Footer.Text,
                    iconURL: alertConfig.Footer.Icon || null
                });
            }
            if (alertConfig.Author?.Text) {
                embed.setAuthor({
                    name: alertConfig.Author.Text,
                    iconURL: alertConfig.Author.Icon || null
                });
            }
            if (alertConfig.Image) embed.setImage(alertConfig.Image);
            if (alertConfig.Thumbnail) embed.setThumbnail(alertConfig.Thumbnail);

            const closeButton = new ButtonBuilder()
                .setCustomId(`ticketclose-${ticket.ticketId}`)
                .setLabel(alertConfig.Button?.Label || 'Close Ticket')
                .setStyle(ButtonStyle[alertConfig.Button?.Style || 'Danger'])
                .setEmoji(alertConfig.Button?.Emoji || '🔒');

            const actionRow = new ActionRowBuilder()
                .addComponents(closeButton);

            const tagMessage = await interaction.channel.send(`<@${ticket.userId}>`);
            const alertMessage = await interaction.channel.send({ embeds: [embed], components: [actionRow] });

            setTimeout(() => tagMessage.delete(), 500);

            if (config.Alert.DM?.Enabled) {
                try {
                    const user = await interaction.client.users.fetch(ticket.userId);
                    const guild = interaction.guild;
                    
                    const dmEmbed = new EmbedBuilder();
                    const dmConfig = config.Alert.DM.Embed;

                    if (dmConfig.Title) dmEmbed.setTitle(dmConfig.Title);
                    if (dmConfig.Color) dmEmbed.setColor(dmConfig.Color);
                    
                    const description = dmConfig.Description
                        .join('\n')
                        .replace('{user}', `<@${ticket.userId}>`)
                        .replace('{guild}', guild.name)
                        .replace('{time}', discordTimestamp)
                        .replace('{reason}', reason);
                    
                    dmEmbed.setDescription(description);

                    if (dmConfig.Footer?.Text) {
                        dmEmbed.setFooter({
                            text: dmConfig.Footer.Text,
                            iconURL: dmConfig.Footer.Icon || null
                        });
                    }
                    if (dmConfig.Author?.Text) {
                        dmEmbed.setAuthor({
                            name: dmConfig.Author.Text,
                            iconURL: dmConfig.Author.Icon || null
                        });
                    }
                    if (dmConfig.Image) dmEmbed.setImage(dmConfig.Image);
                    if (dmConfig.Thumbnail) dmEmbed.setThumbnail(dmConfig.Thumbnail);

                    const ticketButton = new ButtonBuilder()
                        .setLabel(dmConfig.Button?.Label || 'Go to Ticket')
                        .setStyle(ButtonStyle.Link)
                        .setURL(`https://discord.com/channels/${guild.id}/${ticket.channelId}`)
                        .setEmoji(dmConfig.Button?.Emoji || '🎫');

                    const dmActionRow = new ActionRowBuilder()
                        .addComponents(ticketButton);

                    await user.send({
                        embeds: [dmEmbed],
                        components: [dmActionRow]
                    }).catch(() => {
                        if (config.Alert.DM?.LogFailures) {
                            interaction.channel.send({
                                content: 'Unable to send DM to the user. They may have DMs disabled.',
                                ephemeral: true
                            }).catch(() => {});
                        }
                    });
                } catch (error) {
                    if (error.code !== 50007) {
                        console.error('Error sending DM:', error);
                    }
                }
            }

            ticket.alertMessageId = alertMessage.id;
            await ticket.save();

        } else if (group === 'blacklist') {
            if (subcommand === 'add') {
                try {
                    const userToBlacklist = interaction.options.getUser('user');
                    const reason = interaction.options.getString('reason') || 'No reason provided';
                    const supportRoles = config.ModerationRoles.blacklist;
                    const hasPermission = interaction.member.roles.cache.some(role => supportRoles.includes(role.id)) || interaction.member.permissions.has(PermissionFlagsBits.Administrator);

                    if (!hasPermission) {
                        return interaction.reply({ content: 'You do not have permissions to use this command.', ephemeral: true });
                    }

                    const existingEntry = await Blacklist.findOne({ userId: userToBlacklist.id });
                    if (existingEntry) {
                        return interaction.reply({ content: `${userToBlacklist.tag} is already blacklisted.`, ephemeral: true });
                    }

                    const blacklistEntry = new Blacklist({
                        userId: userToBlacklist.id,
                        addedBy: interaction.user.id,
                        addedAt: new Date(),
                        reason: reason
                    });

                    await blacklistEntry.save();

                    const embed = new EmbedBuilder()
                        .setColor('#FF0000')
                        .setTitle('🚫 User Blacklisted')
                        .setDescription(`**<@${userToBlacklist.id}>** has been blacklisted from opening tickets.`)
                        .addFields(
                            { name: 'Reason', value: reason, inline: false },
                            { name: 'Blacklisted By', value: `<@${interaction.user.id}>`, inline: true },
                            { name: 'Date', value: `<t:${Math.floor(new Date(blacklistEntry.addedAt).getTime() / 1000)}:F>`, inline: true }
                        )
                        .setThumbnail(userToBlacklist.displayAvatarURL({ dynamic: true }))
                        .setFooter({ text: 'Contact an admin if you believe this is a mistake.' });

                    await interaction.reply({ embeds: [embed], ephemeral: true });
                } catch (error) {
                    console.error('Error blacklisting user:', error);
                    await interaction.reply({ content: 'An error occurred while blacklisting the user. Please try again later.', ephemeral: true });
                }
            } else if (subcommand === 'view') {
                try {
                    const userToCheck = interaction.options.getUser('user');
                    const supportRoles = config.ModerationRoles.blacklist;
                    const hasPermission = interaction.member.roles.cache.some(role => supportRoles.includes(role.id)) || interaction.member.permissions.has(PermissionFlagsBits.Administrator);

                    if (!hasPermission) {
                        return interaction.reply({ content: 'You do not have permissions to use this command.', ephemeral: true });
                    }

                    const blacklistEntry = await Blacklist.findOne({ userId: userToCheck.id });

                    if (!blacklistEntry) {
                        return interaction.reply({ content: `${userToCheck.tag} is not blacklisted.`, ephemeral: true });
                    }

                    const embed = new EmbedBuilder()
                        .setColor('#FFA500')
                        .setTitle('📋 Blacklist Information')
                        .addFields(
                            { name: 'User', value: `<@${blacklistEntry.userId}>`, inline: true },
                            { name: 'Blacklisted By', value: `<@${blacklistEntry.addedBy}>`, inline: true },
                            { name: 'Reason', value: blacklistEntry.reason, inline: false },
                            { name: 'Date', value: `<t:${Math.floor(new Date(blacklistEntry.addedAt).getTime() / 1000)}:F>`, inline: true }
                        )
                        .setThumbnail(userToCheck.displayAvatarURL({ dynamic: true }))
                        .setFooter({ text: 'Contact an admin if you need more information.' });

                    await interaction.reply({ embeds: [embed], ephemeral: true });
                } catch (error) {
                    console.error('Error fetching blacklist information:', error);
                    await interaction.reply({ content: 'An error occurred while fetching the blacklist information. Please try again later.', ephemeral: true });
                }
            } else if (subcommand === 'remove') {
                try {
                    const userToRemove = interaction.options.getUser('user');
                    const supportRoles = config.ModerationRoles.blacklist;
                    const hasPermission = interaction.member.roles.cache.some(role => supportRoles.includes(role.id)) || interaction.member.permissions.has(PermissionFlagsBits.Administrator);

                    if (!hasPermission) {
                        return interaction.reply({ content: 'You do not have permissions to use this command.', ephemeral: true });
                    }

                    const result = await Blacklist.findOneAndDelete({ userId: userToRemove.id });

                    if (!result) {
                        return interaction.reply({ content: `${userToRemove.tag} is not blacklisted.`, ephemeral: true });
                    }

                    const embed = new EmbedBuilder()
                        .setColor('#00FF00')
                        .setTitle('✅ User Removed from Blacklist')
                        .setDescription(`**<@${userToRemove.id}>** has been removed from the blacklist.`)
                        .addFields(
                            { name: 'Removed By', value: `<@${interaction.user.id}>`, inline: true },
                            { name: 'Date', value: `<t:${Math.floor(new Date().getTime() / 1000)}:F>`, inline: true }
                        )
                        .setThumbnail(userToRemove.displayAvatarURL({ dynamic: true }))
                        .setFooter({ text: 'The user can now open tickets again.' });

                    await interaction.reply({ embeds: [embed], ephemeral: true });
                } catch (error) {
                    console.error('Error removing user from blacklist:', error);
                    await interaction.reply({ content: 'An error occurred while removing the user from the blacklist. Please try again later.', ephemeral: true });
                }
            }
        } else if (subcommand === 'close' && !group) {
            try {
                const ticket = await Ticket.findOne({ channelId: interaction.channel.id });
                if (!ticket) {
                    return interaction.reply({ content: 'Ticket not found or already closed.', ephemeral: true });
                }

                const ticketType = config.TicketTypes[ticket.ticketType];
                if (ticketType.RestrictDeletion) {
                    const hasSupportRole = interaction.member.roles.cache.some(role => ticketType.SupportRole.includes(role.id));
                    if (!hasSupportRole) {
                        return interaction.reply({ content: 'You do not have permission to close this ticket.', ephemeral: true });
                    }
                }

                const isSilent = interaction.options.getBoolean('silent') || false;
                const reason = interaction.options.getString('reason');
                const customReason = interaction.options.getString('custom_reason');

                if (isSilent) {
                    ticket.status = 'deleted';
                    ticket.closedAt = new Date();
                    ticket.closedBy = interaction.user.id;
                    await ticket.save();

                    await interaction.channel.delete();
                    return;
                }
                
                await handleTicketClose(interaction.client, interaction, ticket.ticketId, reason, customReason);
                await interaction.followUp({ content: 'Ticket closed.', ephemeral: true });
            } catch (error) {
                console.error('Error executing /close command:', error);
                if (interaction.replied || interaction.deferred) {
                    await interaction.editReply({ content: 'An error occurred while closing the ticket. Please try again later.', ephemeral: true });
                } else {
                    await interaction.reply({ content: 'An error occurred while closing the ticket. Please try again later.', ephemeral: true });
                }
            }

        } else if (subcommand === 'panel' && !group) {
            try {
                if (!config.TicketSettings?.Enabled) {
                    return interaction.reply({ content: 'This command has been disabled in the config!', ephemeral: true });
                }

                if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                    return interaction.reply({ content: 'You do not have permissions to use this command.', ephemeral: true });
                }

                const selectedPanel = interaction.options.getString('panel');
                const panelConfig = config.TicketPanelSettings[selectedPanel];

                if (!panelConfig) {
                    return interaction.reply({ content: 'Invalid panel selected!', ephemeral: true });
                }

                const embedConfig = panelConfig.Embed;

                const currentTime = moment().tz(config.WorkingHours.Timezone);
                const currentDay = currentTime.format('dddd').toLowerCase();
                const workingHours = config.WorkingHours.Schedule[currentDay.charAt(0).toUpperCase() + currentDay.slice(1)];
                const workingHoursPlaceholders = {};

                if (workingHours) {
                    const [start, end] = workingHours.split('-');
                    workingHoursPlaceholders.start = `<t:${moment.tz(start, 'HH:mm', config.WorkingHours.Timezone).unix()}:t>`;
                    workingHoursPlaceholders.end = `<t:${moment.tz(end, 'HH:mm', config.WorkingHours.Timezone).unix()}:t>`;
                    Object.keys(config.WorkingHours.Schedule).forEach(day => {
                        const [dayStart, dayEnd] = config.WorkingHours.Schedule[day].split('-');
                        workingHoursPlaceholders[`${day.toLowerCase()}Start`] = `<t:${moment.tz(dayStart, 'HH:mm', config.WorkingHours.Timezone).unix()}:t>`;
                        workingHoursPlaceholders[`${day.toLowerCase()}End`] = `<t:${moment.tz(dayEnd, 'HH:mm', config.WorkingHours.Timezone).unix()}:t>`;
                    });
                }

                const embed = new EmbedBuilder()
                    .setColor(embedConfig.Color || '#0099ff')
                    .setDescription(replacePlaceholders((embedConfig.Description || []).join('\n'), workingHoursPlaceholders));

                if (embedConfig.Title) {
                    embed.setTitle(replacePlaceholders(embedConfig.Title, workingHoursPlaceholders));
                }

                if (embedConfig.Footer?.Text || embedConfig.Footer?.Icon) {
                    embed.setFooter({
                        text: replacePlaceholders(embedConfig.Footer.Text || '', workingHoursPlaceholders),
                        iconURL: embedConfig.Footer.Icon || null
                    });
                }

                if (embedConfig.Author?.Text || embedConfig.Author?.Icon) {
                    embed.setAuthor({
                        name: replacePlaceholders(embedConfig.Author.Text || '', workingHoursPlaceholders),
                        iconURL: embedConfig.Author.Icon || null
                    });
                }

                if (isValidHttpUrl(embedConfig.Image)) embed.setImage(embedConfig.Image);
                if (isValidHttpUrl(embedConfig.Thumbnail)) embed.setThumbnail(embedConfig.Thumbnail);

                if (embedConfig.embedFields && Array.isArray(embedConfig.embedFields)) {
                    embedConfig.embedFields.forEach(field => {
                        const name = replacePlaceholders(field.name, workingHoursPlaceholders);
                        const value = replacePlaceholders(field.value, workingHoursPlaceholders);
                        if (name && value) {
                            embed.addFields({
                                name: name,
                                value: value,
                                inline: field.inline || false
                            });
                        }
                    });
                }

                const { useSelectMenu } = config.TicketSettings;

                const rows = [];
                let currentRow = new ActionRowBuilder();

                if (useSelectMenu) {
                    const selectMenu = new StringSelectMenuBuilder()
                        .setCustomId('ticketcreate')
                        .setPlaceholder(lang.Tickets.TicketTypePlaceholder);

                    Object.keys(config.TicketTypes).forEach(key => {
                        const ticketType = config.TicketTypes[key];
                        if (ticketType.Enabled && ticketType.Panel === selectedPanel) {
                            selectMenu.addOptions({
                                label: replacePlaceholders(ticketType.Button.Name || 'Unnamed Ticket', workingHoursPlaceholders),
                                emoji: ticketType.Button.Emoji || '',
                                value: key,
                                description: replacePlaceholders(ticketType.Button.Description || '', workingHoursPlaceholders)
                            });
                        }
                    });

                    if (selectMenu.options.length > 0) {
                        currentRow.addComponents(selectMenu);
                        rows.push(currentRow);
                    } else {
                        throw new Error('No ticket types are enabled for this panel.');
                    }
                } else {
                    Object.keys(config.TicketTypes).forEach(key => {
                        const ticketType = config.TicketTypes[key];
                        if (ticketType.Enabled && ticketType.Panel === selectedPanel) {
                            const buttonStyleMap = {
                                'Primary': ButtonStyle.Primary,
                                'Secondary': ButtonStyle.Secondary,
                                'Success': ButtonStyle.Success,
                                'Danger': ButtonStyle.Danger
                            };
                            const buttonStyle = buttonStyleMap[ticketType.Button.Style] || ButtonStyle.Primary;

                            currentRow.addComponents(
                                new ButtonBuilder()
                                    .setCustomId(`ticketcreate-${key}`)
                                    .setLabel(replacePlaceholders(ticketType.Button.Name || 'Unnamed Ticket', workingHoursPlaceholders))
                                    .setEmoji(ticketType.Button.Emoji || '')
                                    .setStyle(buttonStyle)
                            );

                            if (currentRow.components.length === 5) {
                                rows.push(currentRow);
                                currentRow = new ActionRowBuilder();
                            }
                        }
                    });

                    if (currentRow.components.length > 0) {
                        rows.push(currentRow);
                    }

                    if (rows.length === 0) {
                        throw new Error('No buttons are enabled for this panel.');
                    }
                }

                await interaction.reply({ content: 'Ticket panel sent!', ephemeral: true });
                await interaction.channel.send({ embeds: [embed], components: rows });
            } catch (error) {
                console.error('Error sending ticket panel:', error);
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: 'An error occurred while sending the ticket panel.', ephemeral: true }).catch(e => console.error('Error sending reply:', e));
                } else {
                    await interaction.followUp({ content: 'An error occurred while sending the ticket panel.', ephemeral: true }).catch(e => console.error('Error sending follow-up:', e));
                }
            }
        } else if (subcommand === 'remove' && !group) {
            try {
                const userToRemove = interaction.options.getUser('user');
                const ticket = await Ticket.findOne({ channelId: interaction.channel.id });

                if (!ticket) {
                    return interaction.reply({ content: 'This command can only be used within a ticket channel.', ephemeral: true });
                }

                const supportRoles = config.TicketTypes[ticket.ticketType].SupportRole;
                const hasSupportRole = interaction.member.roles.cache.some(role => supportRoles.includes(role.id));

                if (!hasSupportRole) {
                    return interaction.reply({ content: 'You do not have permissions to use this command.', ephemeral: true });
                }

                const channel = interaction.channel;

                const memberPermissions = channel.permissionsFor(userToRemove);
                if (!memberPermissions || !memberPermissions.has(PermissionFlagsBits.ViewChannel)) {
                    return interaction.reply({ content: 'User is not part of this ticket.', ephemeral: true });
                }

                await channel.permissionOverwrites.create(userToRemove, {
                    ViewChannel: false,
                    SendMessages: false,
                    ReadMessageHistory: false,
                    AttachFiles: false,
                    EmbedLinks: false
                });

                const embed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setDescription(`Successfully removed ${userToRemove.tag} from the ticket.`);

                await interaction.reply({ embeds: [embed], ephemeral: true });

                const notificationEmbed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setDescription(`<@${userToRemove.id}> has been removed from the ticket by <@${interaction.user.id}>.`);

                await channel.send({ embeds: [notificationEmbed] });
            } catch (error) {
                console.error('Error removing user from ticket:', error);
                await interaction.reply({ content: 'An error occurred while removing the user from the ticket. Please try again later.', ephemeral: true });
            }

        } else if (subcommand === 'rename' && !group) {
            try {
                const newName = interaction.options.getString('name');
                const ticket = await Ticket.findOne({ channelId: interaction.channel.id });

                if (!ticket) {
                    return interaction.reply({ content: 'This command can only be used within a ticket channel.', ephemeral: true });
                }

                const supportRoles = config.TicketTypes[ticket.ticketType].SupportRole;
                const hasSupportRole = interaction.member.roles.cache.some(role => supportRoles.includes(role.id));

                if (!hasSupportRole) {
                    return interaction.reply({ content: 'You do not have permissions to use this command.', ephemeral: true });
                }

                const channel = interaction.channel;

                await queueChannelRename(channel, newName);

                const embed = new EmbedBuilder()
                    .setColor('#00FF00')
                    .setDescription(`Successfully renamed the ticket to ${newName}.`);

                await interaction.reply({ embeds: [embed], ephemeral: true });

                const notificationEmbed = new EmbedBuilder()
                    .setColor('#00FF00')
                    .setDescription(`The ticket has been renamed to ${newName} by <@${interaction.user.id}>.`);

                await channel.send({ embeds: [notificationEmbed] });
            } catch (error) {
                console.error('Error renaming ticket:', error);
                await interaction.reply({ content: 'An error occurred while renaming the ticket. Please try again later.', ephemeral: true });
            }

        } else if (subcommand === 'stats' && !group) {

            try {
                const tickets = await Ticket.find({}).lean();
                const now = moment();

                const totalTickets = tickets.length;
                const openTickets = tickets.filter(t => t.status === 'open').length;
                const closedTickets = tickets.filter(t => t.status === 'closed').length;
                const deletedTickets = tickets.filter(t => t.status === 'deleted').length;
                const totalMessages = tickets.reduce((sum, t) => sum + (t.messageCount || 0), 0);

                const last24Hours = tickets.filter(t => moment(t.createdAt).isAfter(now.clone().subtract(24, 'hours'))).length;
                const last7Days = tickets.filter(t => moment(t.createdAt).isAfter(now.clone().subtract(7, 'days'))).length;
                const last30Days = tickets.filter(t => moment(t.createdAt).isAfter(now.clone().subtract(30, 'days'))).length;

                const priorityStats = tickets.reduce((acc, t) => {
                    if (t.priority) {
                        acc[t.priority] = (acc[t.priority] || 0) + 1;
                    }
                    return acc;
                }, {});

                const ticketsWithMessages = tickets.filter(t => t.messages && t.messages.length > 1);
                const avgFirstResponse = ticketsWithMessages.reduce((sum, t) => {
                    const firstUserMsg = t.messages.find(m => m.authorId === t.userId);
                    const firstStaffMsg = t.messages.find(m => m.authorId !== t.userId);
                    if (firstUserMsg && firstStaffMsg) {
                        return sum + (moment(firstStaffMsg.timestamp).diff(moment(firstUserMsg.timestamp)));
                    }
                    return sum;
                }, 0) / (ticketsWithMessages.length || 1);

                const validReviews = tickets.filter(t => {
                    const ratingMatch = t?.rating?.match(/\((\d)\/5\)$/);
                    return ratingMatch ? true : false;
                });

                const ratingDistribution = validReviews.reduce((acc, t) => {
                    const rating = t.rating.match(/\((\d)\/5\)$/)[1];
                    acc[rating] = (acc[rating] || 0) + 1;
                    return acc;
                }, {});

                const totalReviews = validReviews.length;
                const averageRating = totalReviews > 0 
                    ? (validReviews.reduce((sum, t) => sum + parseInt(t.rating.match(/\((\d)\/5\)$/)[1]), 0) / totalReviews).toFixed(1)
                    : 'N/A';

                const statsEmbed = new EmbedBuilder()
                    .setTitle(' Ticket Statistics')
                    .setColor('#2B2D31')
                    .addFields([
                        {
                            name: '📈 Current Status',
                            value: `> 🎫 Total Tickets: \`${totalTickets}\`\n` +
                                   `> 📝 Total Messages: \`${totalMessages}\`\n` +
                                   `> 🟢 Open: \`${openTickets}\`\n` +
                                   `> 🟡 Closed: \`${closedTickets}\`\n` +
                                   `> 🔴 Deleted: \`${deletedTickets}\``,
                            inline: false
                        },
                        {
                            name: '⏰ Recent Activity',
                            value: `> 24 Hours: \`${last24Hours} tickets\`\n` +
                                   `> 7 Days: \`${last7Days} tickets\`\n` +
                                   `> 30 Days: \`${last30Days} tickets\``,
                            inline: true
                        },
                        {
                            name: '🎯 Priority Distribution',
                            value: Object.entries(priorityStats).length > 0
                                ? Object.entries(priorityStats)
                                    .filter(([priority]) => priority !== 'undefined')
                                    .map(([priority, count]) => {
                                        const emoji = priority === 'High' ? '🔴' 
                                            : priority === 'Medium' ? '🟡' 
                                            : priority === 'Low' ? '🟢' 
                                            : '⚪';
                                        return `> ${emoji} ${priority}: \`${count} tickets\``;
                                    })
                                    .join('\n')
                                : '> No priority tickets found',
                            inline: true
                        },
                        {
                            name: '⭐ Rating Statistics',
                            value: totalReviews > 0 
                                ? `> Average Rating: \`${averageRating}/5\` ${'⭐'.repeat(Math.round(parseFloat(averageRating)))}\n` +
                                  Object.entries(ratingDistribution)
                                    .sort((a, b) => b[0] - a[0])
                                    .map(([rating, count]) => `> ${rating}⭐: \`${count} reviews\``)
                                    .join('\n')
                                : '> No ratings yet',
                            inline: false
                        },
                        {
                            name: '⚡ Response Metrics',
                            value: `> Average First Response: \`${formatDuration(avgFirstResponse)}\`\n` +
                                   `> Average Resolution Time: \`${formatDuration(getAverageResolutionTime(tickets))}\``,
                            inline: false
                        }
                    ])
                    .setFooter({ 
                        text: 'Last Updated', 
                        iconURL: interaction.guild.iconURL() 
                    })
                    .setTimestamp();

                await interaction.reply({ embeds: [statsEmbed], ephemeral: true });
            } catch (error) {
                console.error('Error fetching ticket stats:', error);
                await interaction.reply({ 
                    content: 'An error occurred while fetching ticket stats. Please try again later.', 
                    ephemeral: true 
                });
            }
        } else if (subcommand === 'transfer' && !group) {
            await interaction.deferReply({ ephemeral: true });

            try {
                const newType = interaction.options.getString('type');
                const ticket = await Ticket.findOne({ channelId: interaction.channel.id });

                if (!ticket) {
                    return interaction.editReply({ content: 'This command can only be used within a ticket channel.' });
                }

                const oldTicketType = config.TicketTypes[ticket.ticketType];
                const newTicketType = config.TicketTypes[newType];

                if (!newTicketType) {
                    return interaction.editReply({ content: 'New ticket type not found.' });
                }

                if (ticket.ticketType === newType) {
                    return interaction.editReply({ content: 'This ticket is already of the specified type.' });
                }

                const hasSupportRole = interaction.member.roles.cache.some(role => oldTicketType.SupportRole.includes(role.id));

                if (!hasSupportRole) {
                    return interaction.editReply({ content: 'You do not have permission to use this command.' });
                }

                const channel = await interaction.guild.channels.fetch(ticket.channelId);
                if (!channel) {
                    return interaction.editReply({ content: 'Channel not found.' });
                }

                const member = await interaction.guild.members.fetch(ticket.userId);
                const userPriority = await getUserPriority(member);

                const newCategoryId = newTicketType.CategoryID && newTicketType.CategoryID !== "" ? newTicketType.CategoryID : null;

                try {
                    await moveChannel(channel, newCategoryId);
                    await updateChannelPermissions(channel, newTicketType, ticket.userId);
                } catch (error) {
                    console.error('Error during channel operations:', error);
                    return interaction.editReply({ content: 'An error occurred while transferring the ticket. Please try again later.' });
                }

                ticket.questions = ticket.questions.map(q => ({
                    question: q.question || 'No Question Provided',
                    answer: q.answer || 'No Answer Provided'
                }));

                ticket.ticketType = newType;
                await ticket.save();

                const newName = newTicketType.ChannelName
                    .replace('{ticket-id}', ticket.ticketId)
                    .replace('{user}', member.user.username)
                    .replace('{priority}', userPriority);

                await queueChannelRename(channel, newName, ticket, newTicketType);

                const successEmbed = new EmbedBuilder()
                    .setColor('#00FF00')
                    .setDescription(`Successfully transferred the ticket to ${newTicketType.Name}.`);
                await interaction.editReply({ embeds: [successEmbed] });

                const notificationEmbed = new EmbedBuilder()
                    .setColor('#00FF00')
                    .setDescription(`Ticket has been transferred to ${newTicketType.Name} by <@${interaction.user.id}>.`);
                await channel.send({ embeds: [notificationEmbed] });

            } catch (error) {
                console.error('Error transferring ticket:', error);
                await interaction.editReply({ content: 'An error occurred while transferring the ticket. Please try again later.' });
            }
        } else if (subcommand === 'priority' && !group) {
            try {
                const ticket = await Ticket.findOne({ channelId: interaction.channel.id });
                if (!ticket) {
                    return interaction.reply({ 
                        content: 'This command can only be used within a ticket channel.', 
                        ephemeral: true 
                    });
                }

                const newPriority = interaction.options.getString('priority');
                await handlePriorityChange(interaction, ticket, newPriority);

            } catch (error) {
                console.error('Error changing ticket priority:', error);
                
                if (error.message.startsWith('COOLDOWN:')) {
                    const remainingTime = error.message.split(':')[1];
                    return interaction.reply({ 
                        content: `Please wait ${remainingTime} seconds before changing priority again.`, 
                        ephemeral: true 
                    });
                }
                
                if (error.message === 'NO_PERMISSION') {
                    return interaction.reply({ 
                        content: 'You do not have permission to change ticket priority.', 
                        ephemeral: true 
                    });
                }

                await interaction.reply({ 
                    content: 'An error occurred while changing the ticket priority. Please try again later.', 
                    ephemeral: true 
                });
            }
        }
    }
};

function getAverageResolutionTime(tickets) {
    const resolvedTickets = tickets.filter(t => 
        (t.status === 'closed' || t.status === 'deleted') && 
        t.createdAt && 
        t.closedAt
    );

    if (resolvedTickets.length === 0) return 0;

    const totalTime = resolvedTickets.reduce((sum, t) => 
        sum + moment(t.closedAt).diff(moment(t.createdAt)), 0
    );

    return totalTime / resolvedTickets.length;
}