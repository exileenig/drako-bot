const {
    ActionRowBuilder,
    EmbedBuilder,
    ButtonBuilder,
    ButtonStyle,
    AttachmentBuilder
} = require("discord.js");
const fs = require('fs');
const yaml = require("js-yaml");
const config = yaml.load(fs.readFileSync('./config.yml', 'utf8'));
const lang = yaml.load(fs.readFileSync('./lang.yml', 'utf8'));
const client = require("../../index");

const {
    Player,
    useHistory,
    QueueRepeatMode
} = require('discord-player');
const player = new Player(client);

function isValidHttpUrl(string) {
    let url;

    try {
        url = new URL(string);
    } catch (_) {
        return false;
    }

    return url.protocol === "http:" || url.protocol === "https:";
}

function updatePlayPauseButton(row, isPaused) {
    const newComponents = row.components.map(button => {
        if (button.customId === 'music_play_pause') {
            return ButtonBuilder.from(button)
                .setEmoji(isPaused ? config.MusicCommand.Emojis.Play : config.MusicCommand.Emojis.Pause);
        }
        return button;
    });

    return new ActionRowBuilder().addComponents(newComponents);
}

module.exports = async (client, interaction) => {
    const command = client.slashCommands.get(interaction.commandName);
    const customId = interaction.customId;

    try {
        if (interaction.isButton() && customId.startsWith('toggle_filter_')) {

            const whitelistRoles = config.MusicCommand.WhitelistRoles;
            const blacklistRoles = config.MusicCommand.BlacklistRoles;
            const userRoles = interaction.member.roles.cache.map(role => role.id);
            if (config.MusicCommand.EnableWhitelist) {
                const isBlacklisted = userRoles.some(roleId => blacklistRoles.includes(roleId));
                if (isBlacklisted) {
                    await interaction.reply({
                        content: lang.Music.NoPermission,
                        ephemeral: true,
                    });
                    return;
                }

                const isWhitelisted = userRoles.some(roleId => whitelistRoles.includes(roleId));
                if (!isWhitelisted) {
                    await interaction.reply({
                        content: lang.Music.NoPermission,
                        ephemeral: true,
                    });
                    return;
                }
            }

            if (!interaction.member.voice.channel) {
                await interaction.reply({
                    content: lang.Music.NotInVoiceChannel,
                    ephemeral: true
                });
                return;
            }

            if (interaction.guild.members.me.voice.channel && interaction.member.voice.channel.id !== interaction.guild.members.me.voice.channel.id) {
                await interaction.reply({
                    content: lang.Music.NotInSameVoiceChannel,
                    ephemeral: true
                });
                return;
            }
            try {

                const filterName = customId.replace('toggle_filter_', '');
                const specificFilters = [
                    'bassboost',
                    '8D',
                    'vaporwave',
                    'nightcore',
                    'lofi',
                    'reverse',
                    'treble',
                    'karaoke',
                    'earrape'
                ];
                const filtersEmbed = new EmbedBuilder();
                const rows = [];

                if (specificFilters.includes(filterName)) {
                    const queue = player.nodes.get(interaction.guild.id);

                    if (!queue || !queue.currentTrack) {
                        await interaction.reply({
                            content: lang.Music.NoMusicPlaying,
                            ephemeral: true
                        });
                        return;
                    }

                    await queue.filters.ffmpeg.toggle(filterName);

                    const disabledFilters = queue.filters.ffmpeg.getFiltersDisabled();
                    const disabledSpecificFilters = disabledFilters.filter(filter => specificFilters.includes(filter));

                    let numbers = '```\n',
                        filtersList = '```\n',
                        statuses = '```ansi\n';

                    specificFilters.forEach((filter, index) => {
                        const status = disabledSpecificFilters.includes(filter) ? `[2;31m${lang.Music.Filters.Fields.Disabled}[0m` : `[2;34m${lang.Music.Filters.Fields.Enabled}[0m`;
                        numbers += `${index + 1}\n`;
                        filtersList += `${filter.charAt(0).toUpperCase() + filter.slice(1)}\n`;
                        statuses += `${status}\n`;
                    });
                    numbers += '```';
                    filtersList += '```';
                    statuses += '```';

                    const embedConfig = config.MusicCommand.Filters.Embed;

                    filtersEmbed.addFields({
                        name: embedConfig.Fields.Number,
                        value: numbers,
                        inline: true
                    }, {
                        name: embedConfig.Fields.Filter,
                        value: filtersList,
                        inline: true
                    }, {
                        name: embedConfig.Fields.Enabled,
                        value: statuses,
                        inline: true
                    });
                    filtersEmbed.setTitle("This command is Experimental!")

                    if (embedConfig.Title) {
                        filtersEmbed.setDescription(embedConfig.Title)
                    }

                    if (embedConfig.Thumbnail && isValidHttpUrl(embedConfig.Thumbnail)) {
                        filtersEmbed.setThumbnail(embedConfig.Thumbnail);
                    }

                    if (embedConfig.Footer && embedConfig.Footer.Text) {
                        const footerIconUrl = embedConfig.Footer.Icon;
                        filtersEmbed.setFooter({
                            text: embedConfig.Footer.Text,
                            iconURL: isValidHttpUrl(footerIconUrl) ? footerIconUrl : undefined
                        });
                    }

                    const updatedDisabledFilters = queue.filters.ffmpeg.getFiltersDisabled();
                    const updatedDisabledSpecificFilters = updatedDisabledFilters.filter(filter => specificFilters.includes(filter));

                    for (let i = 0; i < specificFilters.length; i += 3) {
                        const row = new ActionRowBuilder();
                        specificFilters.slice(i, i + 3).forEach(filter => {
                            const isFilterDisabled = updatedDisabledSpecificFilters.includes(filter);
                            const buttonStyle = isFilterDisabled ? embedConfig.Fields.Buttons.Disabled.Style : embedConfig.Fields.Buttons.Enabled.Style;
                            const button = new ButtonBuilder()
                                .setCustomId(`toggle_filter_${filter}`)
                                .setLabel(filter.charAt(0).toUpperCase() + filter.slice(1))
                                .setStyle(buttonStyle);

                            row.addComponents(button);
                        });
                        rows.push(row);
                    }

                }
                await interaction.update({
                    embeds: [filtersEmbed],
                    components: rows,
                    ephemeral: true
                });

            } catch (error) {
                //console.log(error)
                await interaction.reply({ content: "Something broke with filters, please try again!" })
            }


        }

        if (interaction.isButton() && customId && (customId.startsWith("queue_next_") || customId.startsWith("queue_previous_") || customId === "queue_first_page" || customId === "queue_last_page")) {
            await interaction.deferReply({ ephemeral: true });

            const whitelistRoles = config.MusicCommand.WhitelistRoles;
            const blacklistRoles = config.MusicCommand.BlacklistRoles;
            const userRoles = interaction.member.roles.cache.map(role => role.id);
            if (config.MusicCommand.EnableWhitelist) {
                const isBlacklisted = userRoles.some(roleId => blacklistRoles.includes(roleId));
                if (isBlacklisted) {
                    await interaction.editReply({
                        content: lang.Music.NoPermission,
                        ephemeral: true,
                    });
                    return;
                }

                const isWhitelisted = userRoles.some(roleId => whitelistRoles.includes(roleId));
                if (!isWhitelisted) {
                    await interaction.editReply({
                        content: lang.Music.NoPermission,
                        ephemeral: true,
                    });
                    return;
                }
            }

            if (!interaction.member.voice.channel) {
                await interaction.editReply({
                    content: lang.Music.NotInVoiceChannel,
                    ephemeral: true
                });
                return;
            }

            if (interaction.guild.members.me.voice.channel && interaction.member.voice.channel.id !== interaction.guild.members.me.voice.channel.id) {
                await interaction.editReply({
                    content: lang.Music.NotInSameVoiceChannel,
                    ephemeral: true
                });
                return;
            }
            let action, encodedPage;
            if (customId === "queue_first_page" || customId === "queue_last_page") {
                action = customId;
            } else {
                [, action, encodedPage] = customId.split('_');
            }

            const queue = player.nodes.get(interaction.guild.id);
            if (!queue || queue.tracks.data.length === 0) {
                await interaction.editReply({
                    content: lang.Music.NoMusicInQueue,
                    ephemeral: true
                });
                return;
            }

            const {
                Embed: embedConfig,
                SongsPerPage: maxTracksPerPage
            } = config.MusicCommand.Queue || {};
            let currentPage;
            if (customId === "queue_first_page") {
                currentPage = 0;
            } else if (customId === "queue_last_page") {
                currentPage = Math.ceil(queue.tracks.data.length / maxTracksPerPage) - 1;
            } else {
                currentPage = parseInt(encodedPage, 10);
            }

            const totalPages = Math.ceil(queue.tracks.data.length / maxTracksPerPage);

            if (action === 'next' && currentPage < totalPages - 1) {
                currentPage++;
            } else if (action === 'previous' && currentPage > 0) {
                currentPage--;
            }

            const placeholders = {
                title: queue.currentTrack?.title,
                author: queue.currentTrack?.author,
                duration: queue.currentTrack?.duration,
                queueDuration: queue.durationFormatted
            };

            const buildDescription = (page) => {
                const trackListStart = page * maxTracksPerPage;
                const trackListEnd = Math.min(trackListStart + maxTracksPerPage, queue.tracks.data.length);
                const trackList = queue.tracks.data.slice(trackListStart, trackListEnd);

                let description = embedConfig.Description[0].replace(/{title}/g, placeholders.title).replace(/{author}/g, placeholders.author);
                description += embedConfig.Description[1];

                trackList.forEach((track, index) => {
                    description += embedConfig.Description[2]
                        .replace(/{numberInQueue}/g, trackListStart + index + 1)
                        .replace(/{title}/g, track.title)
                        .replace(/{author}/g, track.author).replace(/{duration}/, track.duration) + '\n';
                });

                description += embedConfig.Description[3]
                    .replace(/{currentPage}/g, page + 1)
                    .replace(/{totalPages}/g, totalPages);

                return description;
            };

            const generateEmbed = (page) => {
                const embed = new EmbedBuilder()
                    .setDescription(buildDescription(page))
                    .setColor(embedConfig?.Color || "#000000");

                if (embedConfig?.Title) embed.setTitle(embedConfig.Title.replace(/{title}/g, placeholders.title).replace(/{author}/g, placeholders.author).replace(/{queueDuration}/, placeholders.queueDuration));
                if (embedConfig?.Footer?.Text) embed.setFooter({
                    text: embedConfig.Footer.Text,
                    iconURL: embedConfig.Footer.Icon
                });
                if (embedConfig?.Image) embed.setImage(embedConfig.Image);
                if (embedConfig?.Thumbnail) embed.setThumbnail(isValidHttpUrl(embedConfig.Thumbnail) ? embedConfig.Thumbnail : undefined);

                return embed;
            };

            const createButton = (id, buttonConfig, disabled) => {
                const button = new ButtonBuilder()
                    .setCustomId(id)
                    .setDisabled(disabled)
                    .setStyle(buttonConfig.Style || ButtonStyle.Secondary);

                if (buttonConfig?.Label) button.setLabel(buttonConfig.Label);
                if (buttonConfig?.Emoji) button.setEmoji(buttonConfig.Emoji);

                return button;
            };

            const row = new ActionRowBuilder().addComponents(
                createButton('queue_first_page', embedConfig.Buttons.Start, currentPage === 0),
                createButton(`queue_previous_${currentPage}`, embedConfig.Buttons.Back, currentPage === 0),
                createButton(`queue_next_${currentPage}`, embedConfig.Buttons.Next, currentPage >= totalPages - 1),
                createButton('queue_last_page', embedConfig.Buttons.End, currentPage >= totalPages - 1)
            );

            await interaction.editReply({
                embeds: [generateEmbed(currentPage)],
                components: [row]
            });

        }

        if (interaction.isButton() && interaction.customId.startsWith("music_")) {
            await interaction.deferReply({ ephemeral: true });

            const whitelistRoles = config.MusicCommand.WhitelistRoles;
            const blacklistRoles = config.MusicCommand.BlacklistRoles;
            const userRoles = interaction.member.roles.cache.map(role => role.id);

            if (config.MusicCommand.EnableWhitelist) {
                const isBlacklisted = userRoles.some(roleId => blacklistRoles.includes(roleId));
                if (isBlacklisted) {
                    await interaction.editReply({
                        content: lang.Music.NoPermission,
                        ephemeral: true,
                    });
                    return;
                }

                const isWhitelisted = userRoles.some(roleId => whitelistRoles.includes(roleId));
                if (!isWhitelisted) {
                    await interaction.editReply({
                        content: lang.Music.NoPermission,
                        ephemeral: true,
                    });
                    return;
                }
            }

            if (!interaction.member.voice.channel) {
                await interaction.editReply({
                    content: lang.Music.NotInVoiceChannel,
                    ephemeral: true
                });
                return;
            }

            if (interaction.guild.members.me.voice.channel && interaction.member.voice.channel.id !== interaction.guild.members.me.voice.channel.id) {
                await interaction.editReply({
                    content: lang.Music.NotInSameVoiceChannel,
                    ephemeral: true
                });
                return;
            }
            const queue = player.nodes.get(interaction.guild.id);

            switch (interaction.customId) {
                case 'music_play_pause':
                    try {
                        if (!queue || !queue.currentTrack) {
                            await interaction.editReply({ content: lang.Music.NoMusicPlaying, ephemeral: true });
                            return;
                        }

                        if (queue.node.isPlaying()) {
                            await queue.node.pause();
                            await interaction.editReply({ content: lang.Music.Paused.replace("{title}", queue.currentTrack.title), ephemeral: true });
                        } else {
                            await queue.node.resume();
                            await interaction.editReply({ content: lang.Music.Resumed.replace("{title}", queue.currentTrack.title), ephemeral: true });
                        }
                    } catch (error) {
                        await interaction.editReply({
                            content: lang.Music.Error,
                            ephemeral: true
                        });
                    }
                    break;
                case 'music_next':
                    if (!queue || !queue.currentTrack) {
                        await interaction.editReply({ content: lang.Music.NoMusicInQueue, ephemeral: true });
                        return;
                    }

                    if (!queue.node.isIdle()) {
                        await queue.node.skip();
                        await interaction.editReply({
                            content: lang.Music.Skipped.replace("{title}", queue.currentTrack.title),
                            ephemeral: true
                        });
                    } else {
                        await interaction.editReply({
                            content: lang.Music.NothingToSkip,
                            ephemeral: true
                        });
                    }
                    break;
                case 'music_back':
                    if (!queue || !queue.currentTrack) {
                        await interaction.editReply({ content: lang.Music.NoPreviousMusic, ephemeral: true });
                        return;
                    }

                    const history = useHistory(interaction.guild.id);
                    if (!history || history.isEmpty()) {
                        await interaction.editReply({
                            content: lang.Music.NoPreviousMusic,
                            ephemeral: true
                        });
                        return;
                    }

                    await history.previous();
                    await interaction.editReply({
                        content: lang.Music.WentBackATrack,
                        ephemeral: true
                    });
                    break;
                case 'music_loop':
                    if (!queue || !queue.currentTrack) {
                        await interaction.editReply({
                            content: lang.Music.NoMusicInQueue,
                            ephemeral: true
                        });
                        return;
                    }

                    let loopState = queue.repeatMode;
                    switch (loopState) {
                        case 0:
                            loopState = QueueRepeatMode.TRACK;
                            break;
                        case 1:
                            loopState = QueueRepeatMode.QUEUE;
                            break;
                        case 2:
                            loopState = QueueRepeatMode.AUTOPLAY;
                            break;
                        case 3:
                            loopState = QueueRepeatMode.OFF;
                            break;
                        default:
                            loopState = QueueRepeatMode.OFF;
                    }

                    queue.setRepeatMode(loopState);

                    let loopModeMessage;
                    let loopType;
                    switch (loopState) {
                        case 0:
                            loopModeMessage = lang.Music.Looping.Off;
                            loopType = "Off";
                            break;
                        case 1:
                            loopModeMessage = lang.Music.Looping.Track;
                            loopType = "Track";
                            break;
                        case 2:
                            loopModeMessage = lang.Music.Looping.Queue;
                            loopType = "Queue";
                            break;
                        case 3:
                            loopModeMessage = lang.Music.Looping.Autoplay;
                            loopType = "Autoplay";
                            break;
                    }

                    await interaction.editReply({
                        content: loopModeMessage.replace("{state}", loopType),
                        ephemeral: true
                    });
                    break;
                case 'music_shuffle':
                    if (!queue || !queue.currentTrack) {
                        await interaction.editReply({ 
                            content: lang.Music.NoMusicInQueue, 
                            ephemeral: true 
                        });
                        return;
                    }

                    await queue.tracks.shuffle();
                    await interaction.editReply({
                        content: lang.Music.Shuffled,
                        ephemeral: true
                    });
                    break;
                default:
            }
        }

        try {
            if (interaction.isAutocomplete() && interaction.commandName === 'music' && interaction.options.getSubcommand() === 'play') {

                const whitelistRoles = config.MusicCommand.WhitelistRoles;
                const blacklistRoles = config.MusicCommand.BlacklistRoles;
                const userRoles = interaction.member.roles.cache.map(role => role.id);
                if (config.MusicCommand.EnableWhitelist) {
                    const isBlacklisted = userRoles.some(roleId => blacklistRoles.includes(roleId));
                    if (isBlacklisted) {
                    //    await interaction.followUp([]).catch(console.error);
                        return;
                    }

                    const isWhitelisted = userRoles.some(roleId => whitelistRoles.includes(roleId));
                    if (!isWhitelisted) {
                    //    await interaction.followUp([]).catch(console.error);
                        return;
                    }
                }

                if (!interaction.member.voice.channel) {
                    await interaction.respond([]);
                    return;
                }

                if (interaction.guild.members.me.voice.channel && interaction.member.voice.channel.id !== interaction.guild.members.me.voice.channel.id) {
                    await interaction.respond([]);
                    return;
                }
                let query = interaction.options.getString("query");
                if (query != "") {
                    await command.autocompleteRun(interaction);
                }

            } else if (interaction.isChatInputCommand() && interaction.commandName === 'music') {
            //    await command.execute(interaction, client);
            }
        } catch (error) {
            console.error('music query autocomplete error:', error);
        }
    } catch (error) {
        console.log("music interaction create error: " + error)
    }
};