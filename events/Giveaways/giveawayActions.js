const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require("discord.js");
const fs = require("fs");
const yaml = require("js-yaml");
const config = yaml.load(fs.readFileSync("././config.yml", "utf8"));
const lang = yaml.load(fs.readFileSync("././lang.yml", "utf8"));
const client = require("../../index.js")

const Giveaway = require("../../models/Giveaway.js");
const UserData = require('../../models/UserData.js');

function getButtonStyle(styleString) {
    switch (styleString.toLowerCase()) {
        case "primary":
            return ButtonStyle.Primary;
        case "secondary":
            return ButtonStyle.Secondary;
        case "success":
            return ButtonStyle.Success;
        case "danger":
            return ButtonStyle.Danger;
        default:
            return ButtonStyle.Success;
    }
}

function parseColor(color) {
    if (typeof color === 'string' && color.startsWith('#')) {
        return parseInt(color.replace('#', ''), 16);
    } else {
        return color;
    }
}

function replacePlaceholders(template, placeholders = {}) {
    if (!template) {
        return '\u200b';
    }

    return Object.keys(placeholders).reduce((acc, key) => {
        const regex = new RegExp(`{${key}}`, 'gi');
        return acc.replace(regex, placeholders[key] || '');
    }, template);
}

function parseDuration(durationString) {
    const regex = /^(\d+)([mhdwy])$/;
    const match = durationString.match(regex);
    if (!match) return null;

    const value = parseInt(match[1]);
    const unit = match[2];

    const multipliers = {
        'm': 60 * 1000,
        'h': 60 * 60 * 1000,
        'd': 24 * 60 * 60 * 1000,
        'w': 7 * 24 * 60 * 60 * 1000,
        'y': 365 * 24 * 60 * 60 * 1000
    };

    return value * multipliers[unit];
}

const Invite = require("../../models/inviteSchema");
async function getUserInviteCount(guildId, userId) {
    const invites = await Invite.find({ guildID: guildId, inviterID: userId });
    let inviteCount = 0;

    for (const invite of invites) {
        inviteCount += invite.uses;
    }

    return inviteCount;
}


const giveawayActions = {
    handleButtonInteraction: async (interaction) => {
        try {
            if (interaction.customId === 'check_percent') {
                const giveaway = await Giveaway.findOne({ 
                    messageId: interaction.message.id,
                    channelId: interaction.channelId,
                    ended: false
                });

                if (!giveaway) {
                    await interaction.reply({
                        content: "This giveaway has ended or doesn't exist.",
                        ephemeral: true
                    });
                    return;
                }

                await giveawayActions.calculateChance(interaction, giveaway);
            } else if (interaction.customId === 'show_entrants') {
                await giveawayActions.showEntrants(interaction);
            }
        } catch (error) {
            console.error('Error handling button interaction:', error);
            await interaction.reply({
                content: "An error occurred while processing your request.",
                ephemeral: true
            });
        }
    },

    startGiveaway: async (interaction, giveawayDetails) => {
        const { giveawayId, time, prize, channel, winnerCount, whitelistRoles, blacklistRoles, minServerJoinDate, minAccountAge, minInvites, minMessages, hostedBy, notifyUsers } = giveawayDetails;
        
        const duration = typeof time === 'string' ? parseDuration(time) : time;
        if (duration === null) {
            throw new Error("Invalid time format");
        }

        const serverName = interaction.guild.name;
        const giveawayEndsIn = `<t:${Math.floor((Date.now() + duration) / 1000)}:R>`;

        const endAt = Date.now() + duration;
        const whitelistRoleMentions = whitelistRoles.map(roleId => `<@&${roleId}>`).join(', ');
        const blacklistRoleMentions = blacklistRoles.map(roleId => `<@&${roleId}>`).join(', ');
        const placeholders = {
            prize: prize,
            serverName: serverName,
            hostedBy: hostedBy,
            whitelistRoles: whitelistRoleMentions,
            blacklistRoles: blacklistRoleMentions,
            channel: `${channel}`,
            winnerCount: winnerCount,
            endsIn: giveawayEndsIn,
            minInvites: minInvites
        };

        const embed = new EmbedBuilder();
        const prizeDescription = replacePlaceholders(lang.Giveaways.Embeds.ActiveGiveaway.Prize, placeholders);
        if (config.Giveaways.Embed.ActiveGiveaway.ShowTitle) {
            embed.setDescription(prizeDescription);
        }

        embed.setColor(config.Giveaways.Embed.ActiveGiveaway.EmbedColor);

        const additionalFields = [];
        let requirementsCount = 0;
        var entryCount = 0;

        if (config.Giveaways.Embed.ActiveGiveaway.ShowHostedBy) {
            additionalFields.push({ name: replacePlaceholders(lang.Giveaways.Embeds.ActiveGiveaway.HostedByField, placeholders), value: `${hostedBy}`, inline: true });
        }

        if (config.Giveaways.Embed.ActiveGiveaway.ShowEndsIn) {
            additionalFields.push({ name: replacePlaceholders(lang.Giveaways.Embeds.ActiveGiveaway.EndsInField, placeholders), value: `<t:${Math.floor((Date.now() + duration) / 1000)}:R>`, inline: true });
        }

        if (config.Giveaways.Embed.ActiveGiveaway.ShowEntries) {
            additionalFields.push({ name: replacePlaceholders(lang.Giveaways.Embeds.ActiveGiveaway.EntriesField, placeholders), value: `**${entryCount}**`, inline: true });
        }

        if (config.Giveaways.Embed.ActiveGiveaway.ShowWhitelistRoles) {
            if (whitelistRoles && whitelistRoles.length > 0) {
                const whitelistMentions = whitelistRoles.map(roleId => `<@&${roleId}>`).join('\n');
                additionalFields.push({ name: replacePlaceholders(lang.Giveaways.Embeds.ActiveGiveaway.WhitelistRoleField, placeholders), value: whitelistMentions, inline: true });
                requirementsCount++;
            }
        }

        if (config.Giveaways.Embed.ActiveGiveaway.ShowBlacklistRoles) {
            if (blacklistRoles && blacklistRoles.length > 0) {
                const blacklistMentions = blacklistRoles.map(roleId => `<@&${roleId}>`).join('\n');
                additionalFields.push({ name: replacePlaceholders(lang.Giveaways.Embeds.ActiveGiveaway.BlacklistRoleField, placeholders), value: blacklistMentions, inline: true });
                requirementsCount++;
            }
        }

        if (config.Giveaways.Embed.ActiveGiveaway.ShowMinimumServerJoinDate) {
            if (minServerJoinDate) {
                const serverJoinDate = new Date(minServerJoinDate);
                const discordTimestamp = `<t:${Math.floor(serverJoinDate.getTime() / 1000)}:D>`;
                additionalFields.push({ name: replacePlaceholders(lang.Giveaways.Embeds.ActiveGiveaway.MinimumSeverJoinDateField, placeholders), value: `${discordTimestamp}`, inline: true });
                requirementsCount++;
            }
        }

        if (config.Giveaways.Embed.ActiveGiveaway.ShowMinimumAccountAge) {
            if (minAccountAge) {
                const accountAgeDate = new Date(minAccountAge);
                const discordTimestamp = `<t:${Math.floor(accountAgeDate.getTime() / 1000)}:D>`;
                additionalFields.push({ name: replacePlaceholders(lang.Giveaways.Embeds.ActiveGiveaway.MinimumAccountAgeField, placeholders), value: `${discordTimestamp}`, inline: true });
                requirementsCount++;
            }
        }

        if (minInvites > 0) {
            additionalFields.push({ name: "Minimum Invites", value: `${minInvites}`, inline: true });
            requirementsCount++;
        }

        if (minMessages > 0) {
            additionalFields.push({ name: "Minimum Messages", value: `${minMessages}`, inline: true });
            requirementsCount++;
        }

        if (requirementsCount === 2) {
            additionalFields.push({ name: '\u200b', value: '\u200b', inline: true });
        }

        embed.addFields(additionalFields);

        if (config.Giveaways.Embed.ActiveGiveaway.ShowImage) {
            if (config.Giveaways.Embed.ActiveGiveaway.EmbedImage) {
                embed.setImage(config.Giveaways.Embed.ActiveGiveaway.EmbedImage);
            }
        }

        if (config.Giveaways.Embed.ActiveGiveaway.ShowThumbnail) {
            if (config.Giveaways.Embed.ActiveGiveaway.EmbedThumbnail) {
                embed.setThumbnail(config.Giveaways.Embed.ActiveGiveaway.EmbedThumbnail);
            }
        }

        if (config.Giveaways.Embed.ActiveGiveaway.ShowFooter) {
            if (config.Giveaways.Embed.ActiveGiveaway.EmbedFooterIcon) {
                embed.setFooter({ text: `Giveaway ID: ${giveawayId}`, iconURL: config.Giveaways.Embed.ActiveGiveaway.EmbedFooterIcon });
            }
        }

        if (!config.Giveaways.Embed.ActiveGiveaway.ShowTitle &&
            !config.Giveaways.Embed.ActiveGiveaway.ShowThumbnail &&
            !config.Giveaways.Embed.ActiveGiveaway.ShowHostedBy &&
            !config.Giveaways.Embed.ActiveGiveaway.ShowEndsIn &&
            !config.Giveaways.Embed.ActiveGiveaway.ShowEntries &&
            !config.Giveaways.Embed.ActiveGiveaway.ShowWhitelistRoles &&
            !config.Giveaways.Embed.ActiveGiveaway.ShowBlacklistRoles &&
            !config.Giveaways.Embed.ActiveGiveaway.ShowMinimumServerJoinDate &&
            !config.Giveaways.Embed.ActiveGiveaway.ShowMinimumAccountAge &&
            !config.Giveaways.Embed.ActiveGiveaway.ShowImage &&
            !config.Giveaways.Embed.ActiveGiveaway.ShowFooter) {
            embed.addFields({ name: '\u200b', value: '\u200b' });
        }

        const joinButton = new ButtonBuilder()
            .setLabel(config.Giveaways.Embed.ActiveGiveaway.Button.JoinButton.ButtonText)
            .setStyle(getButtonStyle(config.Giveaways.Embed.ActiveGiveaway.Button.JoinButton.ButtonStyle))
            .setCustomId("join_giveaway")
            .setEmoji(config.Giveaways.Embed.ActiveGiveaway.Button.JoinButton.ButtonEmoji);

        const checkPercentButton = new ButtonBuilder()
            .setLabel(config.Giveaways.Embed.ActiveGiveaway.Button.CheckPercent.ButtonText)
            .setStyle(getButtonStyle(config.Giveaways.Embed.ActiveGiveaway.Button.CheckPercent.ButtonStyle))
            .setCustomId("check_percent")
            .setEmoji(config.Giveaways.Embed.ActiveGiveaway.Button.CheckPercent.ButtonEmoji);

        const buttons = [joinButton, checkPercentButton];

        if (config.Giveaways.Embed.ActiveGiveaway.Button.ShowEntrantsList) {
            const showEntrantsButton = new ButtonBuilder()
                .setLabel(config.Giveaways.Embed.ActiveGiveaway.Button.ShowEntrantsList.ButtonText || "Show Entrants")
                .setStyle(getButtonStyle(config.Giveaways.Embed.ActiveGiveaway.Button.ShowEntrantsList.ButtonStyle || "SECONDARY"))
                .setCustomId("show_entrants");

            if (config.Giveaways.Embed.ActiveGiveaway.Button.ShowEntrantsList.ButtonEmoji) {
                showEntrantsButton.setEmoji(config.Giveaways.Embed.ActiveGiveaway.Button.ShowEntrantsList.ButtonEmoji);
            }

            buttons.push(showEntrantsButton);
        }

        if (config.Giveaways.Embed.ActiveGiveaway.Button.ShowEntries) {
            const entriesButton = new ButtonBuilder()
                .setLabel(`${config.Giveaways.Embed.ActiveGiveaway.Button.ShowEntries.ButtonText}: 0`)
                .setStyle(getButtonStyle(config.Giveaways.Embed.ActiveGiveaway.Button.ShowEntries.ButtonStyle))
                .setCustomId("entries_count")
                .setDisabled(true);

            if (config.Giveaways.Embed.ActiveGiveaway.Button.ShowEntries.ButtonEmoji) {
                entriesButton.setEmoji(config.Giveaways.Embed.ActiveGiveaway.Button.ShowEntries.ButtonEmoji);
            }

            buttons.push(entriesButton);
        }

        const row = new ActionRowBuilder().addComponents(buttons);
        let messageContent = '';

        if (typeof notifyUsers === 'string' && (notifyUsers === '@everyone' || notifyUsers === '')) {
            messageContent = notifyUsers;
        } else if (Array.isArray(notifyUsers) && notifyUsers.length > 0) {
            const roleMentions = notifyUsers.map(roleId => `<@&${roleId}>`).join(' ');
            messageContent = roleMentions;
        }
        const giveawayMessage = await channel.send({ content: messageContent, embeds: [embed], components: [row] });

        const successEmbed = new EmbedBuilder()
            .setAuthor({
                name: `${lang.SuccessEmbedTitle}`,
                iconURL: `https://i.imgur.com/7SlmRRa.png`,
            })
            .setColor(config.SuccessEmbedColor);

        const newGiveaway = new Giveaway({
            giveawayId: giveawayId,
            messageId: giveawayMessage.id,
            channelId: channel.id,
            guildId: interaction.guildId,
            startAt: Date.now(),
            endAt: endAt,
            ended: false,
            winnerCount: winnerCount,
            hostedBy: hostedBy,
            prize: prize,
            entries: 0,
            messageWinner: false,
            notifyEntrantOnEnter: false,
            requirements: {
                whitelistRoles: whitelistRoles,
                blacklistRoles: blacklistRoles,
                minServerJoinDate: minServerJoinDate,
                minAccountAge: minAccountAge,
                minInvites: minInvites,
                minMessages: minMessages
            },
            winners: [],
            entrants: [],
            extraEntries: giveawayDetails.extraEntries || [],
        });

        await newGiveaway.save();

        if (config.GiveawayLogs.Enabled) {
            let embedData = config.GiveawayLogs.GiveawayStarted.Embed;

            let logEmbed = new EmbedBuilder()
                .setColor(parseColor(embedData.Color || "#00FF00"))
                .setTitle(replacePlaceholders(embedData.Title, placeholders))
                .setDescription(replacePlaceholders(embedData.Description.join('\n'), placeholders))
                .setFooter({ text: replacePlaceholders(embedData.Footer, placeholders) });

            if (config.GiveawayLogs.GiveawayStarted.Embed.Thumbnail && config.GiveawayLogs.GiveawayStarted.Embed.ThumbnailUrl) {
                logEmbed.setThumbnail(config.GiveawayLogs.GiveawayStarted.Embed.ThumbnailUrl)
            }

            let giveawayStartedLog = interaction.guild.channels.cache.get(config.GiveawayLogs.LogsChannelID);
            if (giveawayStartedLog) giveawayStartedLog.send({ embeds: [logEmbed] });
        }

        await interaction.editReply({ embeds: [successEmbed], ephemeral: true });
    },

    joinGiveaway: async (client, userId, username, member, interaction, channelId, messageId) => {
        try {
            const giveaway = await Giveaway.findOne({ channelId: channelId, messageId: messageId });
            if (!giveaway) {
                const messageContent = replacePlaceholders(lang.Giveaways.GiveawayNotFound, {});
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: messageContent, ephemeral: true });
                } else {
                    await interaction.reply({ content: messageContent, ephemeral: true });
                }
                return;
            }

            const serverName = interaction.guild.name;
            const requirements = giveaway.requirements;

            const whitelistRoleMentions = requirements.whitelistRoles.map(roleId => `<@&${roleId}>`).join(', ');
            const blacklistRoleMentions = requirements.blacklistRoles.map(roleId => `<@&${roleId}>`).join(', ');
            const placeholders = {
                prize: giveaway.prize,
                serverName: serverName,
                hostedBy: giveaway.hostedBy,
                whitelistRoles: whitelistRoleMentions,
                blacklistRoles: blacklistRoleMentions,
                channel: `<#${giveaway.channelId}>`,
                winnerCount: giveaway.winnerCount,
                minInvites: requirements.minInvites || 0
            };

            if (giveaway.ended) {
                const messageContent = replacePlaceholders(lang.Giveaways.EndMessage, placeholders);
                await interaction.reply({ content: messageContent, ephemeral: true });
                return;
            }

            if (requirements.whitelistRoles && requirements.whitelistRoles.length > 0 && !requirements.whitelistRoles.some(roleId => member.roles.cache.has(roleId))) {
                const placeholders = {
                    prize: giveaway.prize,
                    serverName: serverName,
                    hostedBy: giveaway.hostedBy,
                    whitelistRoles: requirements.whitelistRoles.map(roleId => `<@&${roleId}>`).join(', '),
                    blacklistRoles: requirements.blacklistRoles.map(roleId => `<@&${roleId}>`).join(', '),
                    channel: `<#${giveaway.channelId}>`,
                    winnerCount: giveaway.winnerCount,
                    minInvites: requirements.minInvites || 0
                };

                const messageContent = replacePlaceholders(lang.Giveaways.IncorrectRoleMessage, placeholders);
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: messageContent, ephemeral: true });
                } else {
                    await interaction.reply({ content: messageContent, ephemeral: true });
                }
                return;
            }

            if (requirements.blacklistRoles && requirements.blacklistRoles.length > 0 && requirements.blacklistRoles.some(roleId => member.roles.cache.has(roleId))) {
                const messageContent = replacePlaceholders(lang.Giveaways.IncorrectRoleMessage, placeholders);
                await interaction.reply({ content: messageContent, ephemeral: true });
                return;
            }

            if (requirements.minServerJoinDate && member.joinedTimestamp > new Date(requirements.minServerJoinDate).getTime()) {
                const messageContent = replacePlaceholders(lang.Giveaways.IncorrectMinimumServerJoinDateMessage, placeholders);
                await interaction.reply({ content: messageContent, ephemeral: true });
                return;
            }

            if (requirements.minAccountAge && member.user.createdTimestamp > new Date(requirements.minAccountAge).getTime()) {
                const messageContent = replacePlaceholders(lang.Giveaways.IncorrectMinimumAccountAgeMessage, placeholders);
                await interaction.reply({ content: messageContent, ephemeral: true });
                return;
            }

            const userInviteCount = await getUserInviteCount(interaction.guild.id, userId);
            if (requirements.minInvites > 0 && userInviteCount < requirements.minInvites) {
                const messageContent = replacePlaceholders(lang.Giveaways.IncorrectInviteCountMessage, placeholders);
                await interaction.reply({ content: messageContent, ephemeral: true });
                return;
            }

            if (requirements.minMessages > 0) {
                const userData = await UserData.findOne({ 
                    userId: userId,
                    guildId: interaction.guildId 
                });
                
                const currentMessages = userData ? userData.totalMessages : 0;
                if (currentMessages < requirements.minMessages) {
                    const messageContent = replacePlaceholders(lang.Giveaways.IncorrectMessageCountMessage, {
                        ...placeholders,
                        required: requirements.minMessages,
                        current: currentMessages
                    });
                    
                    if (interaction.replied || interaction.deferred) {
                        await interaction.followUp({ content: messageContent, ephemeral: true });
                    } else {
                        await interaction.reply({ content: messageContent, ephemeral: true });
                    }
                    return;
                }
            }

            if (giveaway.entrants.some(entrant => entrant.entrantId === userId)) {
                giveaway.entrants = giveaway.entrants.filter(entrant => entrant.entrantId !== userId);
                giveaway.entries--;

                await giveaway.save();

                const channel = client.channels.cache.get(channelId);
                const message = await channel.messages.fetch(messageId);
                const embed = message.embeds[0];
                const newEmbed = EmbedBuilder.from(embed)
                    .spliceFields(2, 1, { name: replacePlaceholders(lang.Giveaways.Embeds.ActiveGiveaway.EntriesField, placeholders), value: `**${giveaway.entrants.length}**`, inline: true });

                if (config.Giveaways.Embed.ActiveGiveaway.Button.ShowEntries) {
                    const components = message.components[0].components;
                    const entriesButtonIndex = components.findIndex(c => c.customId === 'entries_count');
                    if (entriesButtonIndex !== -1) {
                        const updatedButton = new ButtonBuilder()
                            .setLabel(`${config.Giveaways.Embed.ActiveGiveaway.Button.ShowEntries.ButtonText}: ${giveaway.entrants.length}`)
                            .setStyle(getButtonStyle(config.Giveaways.Embed.ActiveGiveaway.Button.ShowEntries.ButtonStyle))
                            .setCustomId("entries_count")
                            .setDisabled(true);

                        if (config.Giveaways.Embed.ActiveGiveaway.Button.ShowEntries.ButtonEmoji) {
                            updatedButton.setEmoji(config.Giveaways.Embed.ActiveGiveaway.Button.ShowEntries.ButtonEmoji);
                        }

                        components[entriesButtonIndex] = updatedButton;
                        const newRow = new ActionRowBuilder().addComponents(components);
                        await message.edit({ embeds: [newEmbed], components: [newRow] });
                    }
                } else {
                    await message.edit({ embeds: [newEmbed] });
                }

                const successMessageContent = replacePlaceholders(lang.Giveaways.LeaveSuccessMessage, placeholders);
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: successMessageContent, ephemeral: true });
                } else {
                    await interaction.reply({ content: successMessageContent, ephemeral: true });
                }

                return;
            }

            let extraEntriesCount = 0;
            const memberRoles = member.roles.cache;
            
            for (const extraEntry of giveaway.extraEntries) {
                if (memberRoles.has(extraEntry.roleId)) {
                    extraEntriesCount += extraEntry.entries;
                }
            }

            giveaway.entries++;
            giveaway.entrants.push({ 
                entrantId: userId, 
                entrantUsername: username,
                extraEntries: extraEntriesCount
            });
            await giveaway.save();

            const channel = client.channels.cache.get(channelId);
            const message = await channel.messages.fetch(messageId);
            const embed = message.embeds[0];

            const newEmbed = EmbedBuilder.from(embed)
                .spliceFields(2, 1, { 
                    name: replacePlaceholders(lang.Giveaways.Embeds.ActiveGiveaway.EntriesField, placeholders), 
                    value: `**${giveaway.entrants.length}**`, 
                    inline: true 
                });

            if (config.Giveaways.Embed.ActiveGiveaway.Button.ShowEntries) {
                const components = message.components[0].components;
                const entriesButtonIndex = components.findIndex(c => c.customId === 'entries_count');
                if (entriesButtonIndex !== -1) {
                    const updatedButton = new ButtonBuilder()
                        .setLabel(`${config.Giveaways.Embed.ActiveGiveaway.Button.ShowEntries.ButtonText}: ${giveaway.entrants.length}`)
                        .setStyle(getButtonStyle(config.Giveaways.Embed.ActiveGiveaway.Button.ShowEntries.ButtonStyle))
                        .setCustomId("entries_count")
                        .setDisabled(true);

                    if (config.Giveaways.Embed.ActiveGiveaway.Button.ShowEntries.ButtonEmoji) {
                        updatedButton.setEmoji(config.Giveaways.Embed.ActiveGiveaway.Button.ShowEntries.ButtonEmoji);
                    }

                    components[entriesButtonIndex] = updatedButton;
                    const newRow = new ActionRowBuilder().addComponents(components);
                    await message.edit({ embeds: [newEmbed], components: [newRow] });
                }
            } else {
                await message.edit({ embeds: [newEmbed] });
            }

            let successMessageContent = replacePlaceholders(lang.Giveaways.EntrySuccessMessage, placeholders);
            if (extraEntriesCount > 0) {
                successMessageContent += `\n${replacePlaceholders(lang.Giveaways.ExtraEntriesMessage, { extraEntries: extraEntriesCount })}`;
            }

            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: successMessageContent, ephemeral: true });
            } else {
                await interaction.reply({ content: successMessageContent, ephemeral: true });
            }
        } catch (error) {
            console.error(`Error joining giveaway: ${error}`);
            const errorMessageContent = replacePlaceholders(lang.Giveaways.EntryErrorMessage, {});
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: errorMessageContent, ephemeral: true });
            } else {
                await interaction.reply({ content: errorMessageContent, ephemeral: true });
            }
        }
    },

    endGiveaway: async (giveawayId) => {
        try {
            const giveaway = await Giveaway.findOne({ giveawayId: giveawayId });
            if (!giveaway) {
                console.error('Giveaway not found:', giveawayId);
                return;
            }

            const guild = client.guilds.cache.get(giveaway.guildId);
            if (!guild) {
                console.error('Guild not found:', giveaway.guildId);
                return;
            }

            if (giveaway.ended) {
                console.error('Giveaway already ended:', giveawayId);
                return;
            }

            const channel = client.channels.cache.get(giveaway.channelId);
            if (!channel) {
                console.error('Channel not found:', giveaway.channelId);
                return;
            }

            let messageExists = true;
            try {
                await channel.messages.fetch(giveaway.messageId);
            } catch (error) {
                messageExists = false;
            }

            if (!messageExists) {
                await Giveaway.findOneAndUpdate(
                    { giveawayId: giveawayId },
                    { $set: { winners: [], ended: true } },
                    { new: true, runValidators: true }
                );
                return 'Giveaway ended without winners (message was deleted).';
            }

            const serverName = guild.name;
            const requirements = giveaway.requirements;

            const whitelistRoleMentions = requirements.whitelistRoles.map(roleId => `<@&${roleId}>`).join(', ');
            const blacklistRoleMentions = requirements.blacklistRoles.map(roleId => `<@&${roleId}>`).join(', ');

            const placeholders = {
                prize: giveaway.prize,
                serverName: serverName,
                hostedBy: giveaway.hostedBy,
                whitelistRoles: whitelistRoleMentions,
                blacklistRoles: blacklistRoleMentions,
                channel: `<#${giveaway.channelId}>`,
                winnerCount: giveaway.winnerCount
            };

            const winnerCount = giveaway.winnerCount;
            const entrants = giveaway.entrants;
            let winners = [];

            let weightedPool = [];
            for (const entrant of entrants) {
                const totalEntries = 1 + (entrant.extraEntries || 0);
                for (let i = 0; i < totalEntries; i++) {
                    weightedPool.push(entrant);
                }
            }

            for (let i = 0; i < winnerCount && weightedPool.length > 0; i++) {
                let randomIndex = Math.floor(Math.random() * weightedPool.length);
                let winner = weightedPool[randomIndex];
                
                weightedPool = weightedPool.filter(entry => entry.entrantId !== winner.entrantId);
                
                winners.push({ winnerId: winner.entrantId });
            }

            const updatedGiveaway = await Giveaway.findOneAndUpdate(
                { giveawayId: giveawayId },
                { $set: { winners: winners, ended: true } },
                { new: true, runValidators: true }
            );

            if (!updatedGiveaway) {
                console.error('Failed to update giveaway:', giveawayId);
                return;
            }

            const message = await channel.messages.fetch(giveaway.messageId);
            let winnerList = winners.map(w => `<@${w.winnerId}>`).join('\n');
            if (winnerList.length === 0) {
                winnerList = replacePlaceholders(lang.Giveaways.NoParticipationMessage, placeholders);
            }

            if (config.Giveaways.DirectMessageWinners) {
                winners.forEach(async (winnerObj) => {
                    const winnerId = winnerObj.winnerId;
                    try {
                        const winner = await guild.members.fetch(winnerId);
                        if (winner && winner.user) {
                            await winner.user.send(replacePlaceholders(lang.Giveaways.WinnerDirectMessage, placeholders));
                        }
                    } catch (dmError) {
                        console.error('Error sending DM to winner:', winnerId, dmError);
                    }
                });
            }

            let winnerMentions = winners.map(winner => `<@${winner.winnerId}>`).join(', ');
            if (winnerMentions.length === 0) {
                await channel.send(replacePlaceholders(lang.Giveaways.NoParticipationMessage, placeholders));
            } else {
                await channel.send(replacePlaceholders(lang.Giveaways.WinMessage, placeholders).replace("{winners}", winnerMentions));
            }

            const embed = EmbedBuilder.from(message.embeds[0])
                .setColor(config.Giveaways.Embed.EndedGiveaway.EmbedColor)
                .setDescription(replacePlaceholders(lang.Giveaways.Embeds.EndedGiveaway.Title, placeholders));

            if (config.Giveaways.Embed.EndedGiveaway.ShowFooter) {
                embed.setFooter({ text: "Giveaway ID: " + giveaway.giveawayId, iconURL: config.Giveaways.Embed.EndedGiveaway.EmbedFooterIcon });
            } else {
                embed.setFooter(null);
            }

            embed.setFields([]);

            if (config.Giveaways.Embed.EndedGiveaway.ShowTitle) {
                embed.setDescription(replacePlaceholders(lang.Giveaways.Embeds.EndedGiveaway.Title, placeholders));
            }
            if (config.Giveaways.Embed.EndedGiveaway.ShowThumbnail) {
                embed.setThumbnail(config.Giveaways.Embed.EndedGiveaway.EmbedThumbnail);
            }
            if (config.Giveaways.Embed.EndedGiveaway.ShowImage) {
                embed.setImage(config.Giveaways.Embed.EndedGiveaway.EmbedImage);
            }
            if (config.Giveaways.Embed.EndedGiveaway.ShowWinnersField) {
                embed.addFields({ name: replacePlaceholders(lang.Giveaways.Embeds.EndedGiveaway.WinnersField, placeholders), value: winnerList, inline: true });
            }
            if (config.Giveaways.Embed.EndedGiveaway.ShowEntriesField) {
                embed.addFields({ name: replacePlaceholders(lang.Giveaways.Embeds.EndedGiveaway.EntriesField, placeholders), value: `**${giveaway.entries}**`, inline: true });
            }

            await message.edit({ embeds: [embed], components: [] });

            if (config.GiveawayLogs.Enabled) {
                let embedData = config.GiveawayLogs.GiveawayEnded.Embed;
                let logEmbed = new EmbedBuilder()
                    .setColor(parseColor(embedData.Color || "#00FF00"))
                    .setTitle(replacePlaceholders(embedData.Title, placeholders))
                    .setDescription(replacePlaceholders(embedData.Description.join('\n'), placeholders).replace("{winners}", winnerMentions))
                    .setFooter({ text: replacePlaceholders(embedData.Footer, placeholders) });

                if (config.GiveawayLogs.GiveawayEnded.Embed.Thumbnail && config.GiveawayLogs.GiveawayEnded.Embed.ThumbnailUrl) {
                    logEmbed.setThumbnail(config.GiveawayLogs.GiveawayEnded.Embed.ThumbnailUrl);
                }

                const giveawayEndedLog = guild.channels.cache.get(config.GiveawayLogs.LogsChannelID);
                if (giveawayEndedLog) giveawayEndedLog.send({ embeds: [logEmbed] });
            }

            return 'Giveaway ended successfully.';
        } catch (error) {
            console.error('Error ending the giveaway with ID:', giveawayId, error);
            throw error;
        }
    },
    rerollGiveaway: async (interaction, giveawayId, userIdsToReroll = []) => {
        try {
            const giveaway = await Giveaway.findOne({ giveawayId: giveawayId });
            if (!giveaway) {
                return await interaction.reply({ content: lang.Giveaways.GiveawayNotFound, ephemeral: true });
            }

            if (!giveaway.ended) {
                return await interaction.reply({ content: lang.Giveaways.GiveawayHasntEnded, ephemeral: true });
            }

            if (userIdsToReroll.length > 0 && !giveaway.winners.some(winner => userIdsToReroll.includes(winner.winnerId))) {
                return await interaction.reply({ content: 'None of the specified users are previous winners.', ephemeral: true });
            }

            let eligibleEntrants = giveaway.entrants.filter(entrant =>
                !giveaway.winners.some(winner => winner.winnerId === entrant.entrantId)
            );

            let rerollCount = userIdsToReroll.length > 0 ? userIdsToReroll.length : giveaway.winnerCount;
            if (userIdsToReroll.length === 0) {
                giveaway.winners = [];
            } else {
                giveaway.winners = giveaway.winners.filter(winner => !userIdsToReroll.includes(winner.winnerId));
            }

            for (let i = 0; i < rerollCount && eligibleEntrants.length > 0; i++) {
                let randomIndex = Math.floor(Math.random() * eligibleEntrants.length);
                giveaway.winners.push({ winnerId: eligibleEntrants[randomIndex].entrantId });
                eligibleEntrants.splice(randomIndex, 1);
            }

            await giveaway.save();

            const guild = client.guilds.cache.get(giveaway.guildId);
            const channel = guild.channels.cache.get(giveaway.channelId);
            const message = await channel.messages.fetch(giveaway.messageId);

            let winnerMentions = giveaway.winners.map(winner => `<@${winner.winnerId}>`).join(', ');

            const placeholders = {
                prize: giveaway.prize,
                serverName: guild.name,
                hostedBy: giveaway.hostedBy,
                channel: `<#${giveaway.channelId}>`,
                winnerCount: giveaway.winnerCount,
                winners: winnerMentions
            };

            for (const winner of giveaway.winners) {
                try {
                    const user = await client.users.fetch(winner.winnerId);
                    await user.send(replacePlaceholders(lang.Giveaways.WinnerDirectMessage, placeholders));
                } catch (error) {

                }
            }

            const updatedEmbed = EmbedBuilder.from(message.embeds[0]);

            updatedEmbed.setFields([]);
            if (config.Giveaways.Embed.EndedGiveaway.ShowWinnersField) {
                const winnersFieldName = replacePlaceholders(lang.Giveaways.Embeds.EndedGiveaway.WinnersField, placeholders);
                const winnersFieldValue = winnerMentions.length > 0 ? winnerMentions : 'No winners selected';
                updatedEmbed.addFields({ name: winnersFieldName, value: winnersFieldValue, inline: true });
            }

            if (config.Giveaways.Embed.EndedGiveaway.ShowEntriesField) {
                const entriesFieldName = replacePlaceholders(lang.Giveaways.Embeds.EndedGiveaway.EntriesField, placeholders);
                const entriesFieldValue = `**${giveaway.entries}**`;
                updatedEmbed.addFields({ name: entriesFieldName, value: entriesFieldValue, inline: true });
            }

            await message.edit({ embeds: [updatedEmbed] });

            const rerollConfirmationMessage = `Giveaway rerolled! Congratulations to the new winners of the "${placeholders.prize}" giveaway: ${winnerMentions}`;
            await channel.send(rerollConfirmationMessage);

            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: 'Giveaway winners rerolled successfully.', ephemeral: true });
            }

            try {
                if (config.GiveawayLogs.Enabled) {
                    let embedData = config.GiveawayLogs.GiveawayRerolled.Embed;
                    let logEmbed = new EmbedBuilder()
                        .setColor(parseColor(embedData.Color || "#00FF00"))
                        .setTitle(replacePlaceholders(embedData.Title, placeholders))
                        .setDescription(replacePlaceholders(embedData.Description.join('\n'), placeholders).replace("{winners}", winnerMentions))
                        .setFooter({ text: replacePlaceholders(embedData.Footer, placeholders) });

                    if (config.GiveawayLogs.GiveawayRerolled.Embed.Thumbnail && config.GiveawayLogs.GiveawayRerolled.Embed.ThumbnailUrl) {
                        logEmbed.setThumbnail(config.GiveawayLogs.GiveawayRerolled.Embed.ThumbnailUrl);
                    }

                    const giveawayRerolledChannel = guild.channels.cache.get(config.GiveawayLogs.LogsChannelID);
                    if (giveawayRerolledChannel) {
                        giveawayRerolledChannel.send({ embeds: [logEmbed] });
                    }
                }
            } catch (error) {
                console.error('Error logging giveaway reroll:', error);
            }

        } catch (error) {
            console.error(`Error rerolling the giveaway with ID: ${giveawayId}`, error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: 'An error occurred while rerolling the giveaway.', ephemeral: true });
            }
        }
    },
    calculateChance: async (interaction, giveaway) => {
        try {
            const userId = interaction.user.id;
            const entrant = giveaway.entrants.find(e => e.entrantId === userId);
            
            if (!entrant) {
                await interaction.reply({
                    content: lang.Giveaways.NotJoinedGiveaway,
                    ephemeral: true
                });
                return;
            }

            let totalEntries = 0;
            for (const e of giveaway.entrants) {
                const entrantEntries = 1 + (e.extraEntries || 0);
                totalEntries += entrantEntries;
            }
            
            const userEntries = 1 + (entrant.extraEntries || 0);
            
            const winChance = (userEntries / totalEntries) * 100;

            const placeholders = {
                user: interaction.user,
                winChance: winChance.toFixed(2),
                userEntries: userEntries,
                extraEntries: entrant.extraEntries || 0
            };

            const chanceMessage = replacePlaceholders(lang.Giveaways.chanceMessage, placeholders);

            await interaction.reply({
                content: chanceMessage,
                ephemeral: true
            });
        } catch (error) {
            console.error('Error calculating chance:', error);
            await interaction.reply({
                content: lang.Giveaways.CalculationError,
                ephemeral: true
            });
        }
    },
    showEntrants: async (interaction) => {
        try {
            await interaction.deferReply({ ephemeral: true });

            const giveaway = await Giveaway.findOne({ 
                messageId: interaction.message.id,
                channelId: interaction.channelId
            });

            if (!giveaway) {
                await interaction.editReply({
                    content: "This giveaway has ended or doesn't exist.",
                    ephemeral: true
                });
                return;
            }

            if (giveaway.entrants.length === 0) {
                await interaction.editReply({
                    content: "No one has entered this giveaway yet!",
                    ephemeral: true
                });
                return;
            }

            const ENTRIES_PER_PAGE = 25;
            const userEntries = new Map();
            giveaway.entrants.forEach(entrant => {
                const entries = (entrant.extraEntries || 0) + 1;
                if (userEntries.has(entrant.entrantId)) {
                    userEntries.set(entrant.entrantId, userEntries.get(entrant.entrantId) + entries);
                } else {
                    userEntries.set(entrant.entrantId, entries);
                }
            });

            const sortedEntrants = Array.from(userEntries.entries())
                .sort((a, b) => b[1] - a[1])
                .map((entry, index) => {
                    const [userId, entries] = entry;
                    return `${index + 1}. <@${userId}> (${entries} entries)`;
                });

            const totalPages = Math.ceil(sortedEntrants.length / ENTRIES_PER_PAGE);
            let currentPage = 1;

            const getPageEmbed = (page) => {
                const startIndex = (page - 1) * ENTRIES_PER_PAGE;
                const endIndex = startIndex + ENTRIES_PER_PAGE;
                const pageEntrants = sortedEntrants.slice(startIndex, endIndex);

                const embedConfig = config.Giveaways.Embed.ActiveGiveaway.Button.ShowEntrantsList.Embed;
                const embed = new EmbedBuilder();

                if (embedConfig.Title) {
                    embed.setTitle(embedConfig.Title.replace('{prize}', giveaway.prize));
                }

                if (embedConfig.Description) {
                    const description = embedConfig.Description.join('\n').replace('{entrantsList}', pageEntrants.join('\n'));
                    embed.setDescription(description);
                }

                if (embedConfig.Color) {
                    embed.setColor(embedConfig.Color);
                }

                if (embedConfig.Thumbnail) {
                    embed.setThumbnail(embedConfig.Thumbnail);
                }

                if (embedConfig.Footer) {
                    const footerText = embedConfig.Footer.Text
                        .replace('{totalEntrants}', userEntries.size)
                        .replace('{currentPage}', page)
                        .replace('{totalPages}', totalPages);
                    embed.setFooter({
                        text: footerText,
                        iconURL: embedConfig.Footer.Icon.replace('{footerIcon}', config.Giveaways.Embed.ActiveGiveaway.EmbedFooterIcon)
                    });
                }

                return embed;
            };

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('first')
                    .setLabel('≪')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId('prev')
                    .setLabel('◀')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId('next')
                    .setLabel('▶')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(totalPages === 1),
                new ButtonBuilder()
                    .setCustomId('last')
                    .setLabel('≫')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(totalPages === 1)
            );

            const message = await interaction.editReply({
                embeds: [getPageEmbed(currentPage)],
                components: totalPages > 1 ? [row] : [],
                ephemeral: true
            });

            if (totalPages > 1) {
                const collector = message.createMessageComponentCollector({
                    filter: i => i.user.id === interaction.user.id,
                    time: 300000
                });

                collector.on('collect', async (i) => {
                    switch (i.customId) {
                        case 'first':
                            currentPage = 1;
                            break;
                        case 'prev':
                            currentPage--;
                            break;
                        case 'next':
                            currentPage++;
                            break;
                        case 'last':
                            currentPage = totalPages;
                            break;
                    }

                    const newRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId('first')
                            .setLabel('≪')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(currentPage === 1),
                        new ButtonBuilder()
                            .setCustomId('prev')
                            .setLabel('◀')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(currentPage === 1),
                        new ButtonBuilder()
                            .setCustomId('next')
                            .setLabel('▶')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(currentPage === totalPages),
                        new ButtonBuilder()
                            .setCustomId('last')
                            .setLabel('≫')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(currentPage === totalPages)
                    );

                    await i.update({
                        embeds: [getPageEmbed(currentPage)],
                        components: [newRow]
                    });
                });

                collector.on('end', async () => {
                    const disabledRow = new ActionRowBuilder().addComponents(
                        row.components.map(component => 
                            ButtonBuilder.from(component).setDisabled(true)
                        )
                    );
                    await message.edit({ components: [disabledRow] }).catch(() => {});
                });
            }
        } catch (error) {
            console.error('Error showing entrants:', error);
            await interaction.editReply({
                content: "An error occurred while fetching the entrants list.",
                ephemeral: true
            });
        }
    }
}


module.exports = giveawayActions;