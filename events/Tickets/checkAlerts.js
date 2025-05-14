const fs = require('fs');
const yaml = require('js-yaml');
const path = require('path');
const Ticket = require('../../models/tickets');
const { handleTicketClose } = require('../interactionCreate');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ApplicationCommandType, InteractionType } = require('discord.js');

let config;

try {
    const configPath = path.join(__dirname, '../../config.yml');
    config = yaml.load(fs.readFileSync(configPath, 'utf8'));
} catch (error) {
    console.error('Error loading configuration file:', error);
    process.exit(1);
}

async function triggerAlertCommand(client, channel, ticket) {
    try {
        const mockInteraction = {
            client,
            guild: channel.guild,
            channel,
            user: {
                id: client.user.id,
                tag: client.user.tag,
                username: client.user.username
            },
            member: {
                ...await channel.guild.members.fetch(client.user.id),
                roles: {
                    cache: {
                        some: (predicate) => config.TicketTypes[ticket.ticketType].SupportRole.some(roleId => predicate({ id: roleId })),
                        map: (fn) => config.TicketTypes[ticket.ticketType].SupportRole.map(roleId => fn({ id: roleId }))
                    }
                }
            },
            commandId: 'tickets',
            commandName: 'tickets',
            type: InteractionType.ApplicationCommand,
            commandType: ApplicationCommandType.ChatInput,
            options: {
                getSubcommand: () => 'alert',
                getSubcommandGroup: () => null,
                getString: () => 'Auto alert: No response',
                getUser: () => null
            },
            reply: async (options) => {
                return await channel.send(options);
            },
            deferReply: async () => {},
            editReply: async (options) => {
                return await channel.send(options);
            },
            followUp: async (options) => {
                return await channel.send(options);
            }
        };

        const ticketsCommand = client.slashCommands.get('tickets');
        if (ticketsCommand) {
            await ticketsCommand.execute(mockInteraction);

            const closeTime = new Date(Date.now() + parseDuration(config.Alert.Time));
            await Ticket.findOneAndUpdate(
                { ticketId: ticket.ticketId },
                { 
                    alertTime: closeTime
                }
            );
        } else {
            console.error('Tickets command not found');
        }
    } catch (error) {
        console.error('Error triggering alert command:', error);
    }
}

function parseDuration(duration) {
    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match) return 0;
    
    const value = parseInt(match[1]);
    const unit = match[2];
    
    const multipliers = {
        's': 1000,
        'm': 60 * 1000,
        'h': 60 * 60 * 1000,
        'd': 24 * 60 * 60 * 1000
    };
    
    return value * multipliers[unit];
}

async function checkAlerts(client) {
    try {
        const now = new Date();
        const tickets = await Ticket.find({ 
            status: 'open',
            $or: [
                { alertTime: { $lte: now } },
                { alertTime: { $exists: true, $ne: null } }
            ]
        });

        for (const ticket of tickets) {
            try {
                const channel = await client.channels.fetch(ticket.channelId).catch(() => null);
                if (!channel) {
                    continue;
                }

                const fetchedMessages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
                if (!fetchedMessages) {
                    continue;
                }

                const alertMessage = ticket.alertMessageId
                    ? await channel.messages.fetch(ticket.alertMessageId).catch(() => null)
                    : null;

                const alertMessageTimestamp = alertMessage ? alertMessage.createdTimestamp : 0;
                const hasUserResponded = fetchedMessages.some(msg => 
                    msg.author.id === ticket.userId && 
                    msg.createdTimestamp > alertMessageTimestamp
                );

                if (hasUserResponded) {
                    if (alertMessage) {
                        await alertMessage.delete().catch(() => {});
                    }
                    await Ticket.findOneAndUpdate(
                        { ticketId: ticket.ticketId },
                        { 
                            alertTime: null,
                            alertMessageId: null
                        }
                    );
                } else if (!alertMessage && ticket.alertTime && ticket.alertTime <= now) {
                    await triggerAlertCommand(client, channel, ticket);
                } else if (alertMessage && ticket.alertTime && ticket.alertTime <= now) {
                    const reason = 'No response after alert';
                    const ticketType = config.TicketTypes[ticket.ticketType];
                    
                    if (ticketType && ticketType.ArchiveCategory) {
                        const archiveEmbed = new EmbedBuilder();
                        const archiveConfig = config.ArchiveDesign.Embed;

                        if (archiveConfig.Title) archiveEmbed.setTitle(archiveConfig.Title);
                        if (archiveConfig.Color) archiveEmbed.setColor(archiveConfig.Color);
                        
                        const description = archiveConfig.Description
                            .join('\n')
                            .replace('{userTag}', `<@${ticket.userId}>`)
                            .replace('{reason}', reason);
                        
                        archiveEmbed.setDescription(description);

                        if (archiveConfig.Footer?.Text) {
                            archiveEmbed.setFooter({
                                text: archiveConfig.Footer.Text,
                                iconURL: archiveConfig.Footer.Icon || null
                            });
                        }
                        if (archiveConfig.Image) archiveEmbed.setImage(archiveConfig.Image);
                        if (archiveConfig.Thumbnail) archiveEmbed.setThumbnail(archiveConfig.Thumbnail);

                        const buttons = Object.values(archiveConfig.Buttons).map(button => {
                            const buttonStyle = ButtonStyle[button.Style] || ButtonStyle.Secondary;
                            return new ButtonBuilder()
                                .setCustomId(`ticketarchive-${ticket.ticketId}-${button.Type.toLowerCase()}`)
                                .setLabel(button.Name)
                                .setStyle(buttonStyle)
                                .setEmoji(button.Emoji);
                        });

                        const row = new ActionRowBuilder().addComponents(buttons);

                        await channel.send({ embeds: [archiveEmbed], components: [row] });

                        if (ticketType.ArchiveCategory) {
                            await channel.setParent(ticketType.ArchiveCategory, { lockPermissions: false });
                        }

                        await Ticket.findOneAndUpdate(
                            { ticketId: ticket.ticketId },
                            { 
                                status: 'closed',
                                closedAt: new Date()
                            }
                        );
                    } else {
                        const mockInteraction = {
                            client,
                            guild: channel.guild,
                            channel,
                            user: {
                                id: client.user.id,
                                tag: client.user.tag,
                                username: client.user.username
                            },
                            member: await channel.guild.members.fetch(client.user.id),
                            reply: async () => {},
                            followUp: async () => {},
                            deferReply: async () => {},
                            editReply: async () => {},
                            isCommand: () => false,
                            isButton: () => true,
                            isSelectMenu: () => false,
                            customId: `ticketclose-${ticket.ticketId}`,
                            options: {
                                getString: () => reason
                            },
                            commandName: 'tickets',
                            deferred: false,
                            replied: false,
                            ephemeral: false
                        };

                        await handleTicketClose(client, mockInteraction, ticket.ticketId, reason);
                    }
                }
            } catch (error) {
                console.error(`Error processing ticket ${ticket._id}:`, error);
            }
        }
    } catch (error) {
        console.error('Error in checkAlerts:', error);
    }
}

function startAlertScheduler(client) {
    if (config.Alert && config.Alert.Enabled) {
        setInterval(() => checkAlerts(client), 10000);
    }
}

module.exports = { startAlertScheduler };