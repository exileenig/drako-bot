const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require("discord.js")
const fs = require('fs');
const yaml = require("js-yaml")
const config = yaml.load(fs.readFileSync('././config.yml', 'utf8'))
const lang = yaml.load(fs.readFileSync('././lang.yml', 'utf8'))
const sharp = require('sharp');
const axios = require('axios');
const { useMainPlayer, QueryType, useHistory, QueueRepeatMode } = require('discord-player');
const { createCanvas, loadImage } = require('canvas');
const moment = require('moment');

async function autocompleteRun(interaction) {
    try {
        const player = useMainPlayer();
        const query = interaction.options.getString('query', true);
        let choices = [];

        const searchResult = await player.search(query, { requestedBy: interaction.member });

        if (searchResult._data && searchResult._data.tracks) {
            let artistQuery = '';
            const artistMatch = query.match(/artist:([^\s]+)/);
            if (artistMatch && artistMatch[1]) {
                artistQuery = artistMatch[1].toLowerCase();
            }

            searchResult._data.tracks.forEach(track => {
                const trackTitle = track.title.toLowerCase();
                const trackArtist = track.author ? track.author.toLowerCase() : '';
                if (trackTitle.includes(query.toLowerCase()) && (!artistQuery || trackArtist.includes(artistQuery))) {
                    const choice = `${track.title} - ${track.source}`;
                    if (choice.length <= 100) {
                        choices.push(choice);
                    }
                }
            });

            const filteredChoices = choices.slice(0, 5);
            await interaction.respond(filteredChoices.map(choice => ({ name: choice, value: choice })));
        } else {
        }
    } catch (error) {
        console.log(error);
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('music')
        .setDescription('Music related commands')
        .addSubcommand(subcommand =>
            subcommand
                .setName('play')
                .setDescription('Play a song')
                .addStringOption(option =>
                    option.setName('query')
                        .setDescription('The song to play')
                        .setRequired(true)
                        .setAutocomplete(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('pause')
                .setDescription('Pause the current song'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('resume')
                .setDescription('Resume the current song'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('skip')
                .setDescription('Skip the current song'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('back')
                .setDescription('Go back a song'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('loop')
                .setDescription('Toggle loop for the current song or queue')
                .addStringOption(option =>
                    option.setName('mode')
                        .setDescription('Select loop mode')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Off', value: 'OFF' },
                            { name: 'Track', value: 'TRACK' },
                            { name: 'Queue', value: 'QUEUE' },
                            { name: 'Autoplay', value: 'AUTOPLAY' }
                        )))
        .addSubcommand(subcommand =>
            subcommand
                .setName('queue')
                .setDescription('List the songs next in queue'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('playingnow')
                .setDescription('Information about the current song'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('clear')
                .setDescription('Clear the queue'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('filters')
                .setDescription('Shows the filters control embed'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('seek')
                .setDescription('Skip to a certain part of the current song')
                .addStringOption(option =>
                    option.setName('time')
                        .setDescription('Format: HH:MM:SS')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('volume')
                .setDescription('Adjust the volume of the music')
                .addIntegerOption(option =>
                    option.setName('level')
                        .setDescription('Volume level (0-100)')
                        .setRequired(true)
                        .setMinValue(0)
                        .setMaxValue(100)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('move')
                .setDescription('Move a song to a specific postion in queue')
                .addIntegerOption(option =>
                    option.setName('songtomove')
                        .setDescription('The position of the song to move')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('moveposition')
                        .setDescription('The new position of the song to move')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('stop')
                .setDescription('Stop the current song and clear the queue'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('radio')
                .setDescription('Toggle radio mode (continuous music)')
                .addStringOption(option =>
                    option.setName('genre')
                        .setDescription('Select the genre for radio mode')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Off', value: 'off' },
                            { name: 'Pop', value: 'pop' },
                            { name: 'Rock', value: 'rock' },
                            { name: 'Hip Hop', value: 'hiphop' },
                            { name: 'Electronic', value: 'electronic' },
                            { name: 'Classical', value: 'classical' },
                            { name: 'Jazz', value: 'jazz' },
                            { name: 'Christmas', value: 'christmas' }
                        ))),
    category: 'Fun',
    async execute(interaction, client) {
        const player = useMainPlayer();

        player.events.on('error', (queue, error) => {
            console.error(`[Player Error] Queue ${queue.guild.id}:`, error);
        });

        player.events.on('playerError', (queue, error) => {
            console.error(`[Player Error] Queue ${queue.guild.id}:`, error);
            if (queue?.metadata?.channel) {
                queue.metadata.channel.send({ content: lang.Music.Error, ephemeral: true }).catch(console.error);
            }
        });

        const whitelistRoles = config.MusicCommand.WhitelistRoles;
        const blacklistRoles = config.MusicCommand.BlacklistRoles;
        const userRoles = interaction.member.roles.cache.map(role => role.id);

        if (!interaction.member.voice.channel) {
            await interaction.reply({
                content: lang.Music.NotInVoiceChannel,
                ephemeral: true
            });
            return;
        }

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

        if (interaction.guild.members.me.voice.channel && interaction.member.voice.channel.id !== interaction.guild.members.me.voice.channel.id) {
            await interaction.editReply({
                content: lang.Music.NotInSameVoiceChannel,
                ephemeral: true
            });
            return;
        }

        const channel = interaction.member.voice.channel;
        if (!channel) {
            await interaction.editReply({ content: lang.Music.NotInVoiceChannel, ephemeral: true });
            return;
        }

        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'back':
                await back(interaction, player);
                break;
            case 'play':
                await play(interaction, player, channel);
                break;
            case 'pause':
                await pause(interaction, player, channel);
                break;
            case 'resume':
                await resume(interaction, player, channel);
                break;
            case 'skip':
                await skip(interaction, player);
                break;
            case 'loop':
                await loop(interaction, player, client);
                break;
            case 'playingnow':
                await nowplaying(interaction, player, client);
                break;
            case 'seek':
                await seek(interaction, player, client);
                break;
            case 'clear':
                await clear(interaction, player, channel);
                break;
            case 'queue':
                await queue(interaction, player);
                break;
            case 'move':
                await move(interaction, player);
                break;
            case 'filters':
                await filters(interaction, player);
                break;
            case 'stop':
                await stop(interaction, player);
                break;
            case 'volume':
                await setVolume(interaction, player);
                break;
            case 'radio':
                await handleRadio(interaction, player);
                break;
            default:
                await interaction.editReply({ content: 'Invalid command', ephemeral: true });
        }
    },
    autocompleteRun: autocompleteRun

}

async function setVolume(interaction, player) {
    await interaction.deferReply();
    try {
        const queue = player.nodes.get(interaction.guild.id);
        if (!queue || !queue.currentTrack) {
            await interaction.editReply({ content: lang.Music.NoMusicPlaying, ephemeral: true });
            return;
        }

        const volume = interaction.options.getInteger('level');
        const success = queue.node.setVolume(volume);

        if (success) {
            await interaction.editReply({ content: lang.Music.Volume.Success.replace("{volume}", volume), ephemeral: false });
        } else {
            await interaction.editReply({ content: lang.Music.Volume.Error, ephemeral: true });
        }
    } catch (error) {
        console.error(error);
        await interaction.editReply({ content: lang.Music.Error, ephemeral: true });
    }
}

async function play(interaction, player, channel) {
    await interaction.deferReply();
    const query = interaction.options.getString('query', true);
    const isAppleMusicURL = query.includes("music.apple.com");
    const isSpotifyURL = query.includes("spotify.com");
    const isSoundCloudURL = query.includes("soundcloud.com");

    try {
        await interaction.editReply({ content: lang.Music.AddingTrack });

        let searchType;
        if (isAppleMusicURL) {
            searchType = QueryType.APPLE_MUSIC;
        } else if (isSpotifyURL) {
            searchType = QueryType.SPOTIFY_PLAYLIST;
        } else if (isSoundCloudURL) {
            searchType = QueryType.SOUNDCLOUD;
        } else {
            searchType = QueryType.YOUTUBE;
        }

        let searchResult = null;
        try {
            searchResult = await player.search(query, {
                requestedBy: interaction.user,
                searchType,
            });

            if (!searchResult || !searchResult.tracks.length) {
                return interaction.editReply({ content: lang.Music.QueryNotFound, ephemeral: true });
            }

            let queue = player.nodes.get(interaction.guild.id);
            if (!queue) {
                queue = player.nodes.create(interaction.guild.id, {
                    metadata: {
                        channel: interaction.channel,
                        requestedByUser: interaction.user,
                    },
                    leaveOnEnd: false,
                    leaveOnEmpty: config.MusicCommand.LeaveOnEmpty,
                    leaveOnEmptyCooldown: config.MusicCommand.LeaveOnEmptyTimer,
                    bufferingTimeout: 15000,
                    volumeSmoothness: 0.1,
                    skipOnNoStream: true,
                    cleanupOnStop: true
                });

                try {
                    await queue.connect(channel);
                } catch (error) {
                    player.nodes.delete(interaction.guild.id);
                    searchResult = null;
                    console.error('Connection error:', error);
                    return interaction.editReply({ content: lang.Music.ErrorJoinChannel, ephemeral: true });
                }
            }

            if (searchResult.playlist) {
                const maxPlaylistSize = 100;
                const tracksToAdd = searchResult.tracks
                    .slice(0, maxPlaylistSize)
                    .filter(track => track && track.title && track.title !== 'UNKNOWN TITLE');
                
                if (tracksToAdd.length === 0) {
                    return interaction.editReply({ content: lang.Music.QueryNotFound, ephemeral: true });
                }

                const trackPromises = tracksToAdd.map(track => queue.addTrack(track));
                await Promise.all(trackPromises);

                await interaction.editReply({
                    content: `Added playlist: ${searchResult.playlist.title} with ${tracksToAdd.length} tracks to the queue.`,
                    ephemeral: false
                });
            } else {
                const track = searchResult.tracks[0];
                if (!track || !track.title || track.title === 'UNKNOWN TITLE') {
                    return interaction.editReply({ content: lang.Music.QueryNotFound, ephemeral: true });
                }

                queue.addTrack(track);
                await interaction.editReply({
                    content: `Playing: ${track.title} by ${track.author}`,
                    ephemeral: false
                });
            }

            if (!queue.node.isPlaying()) {
                await queue.node.play()
                    .catch(error => {
                        console.error('Playback error:', error);
                        interaction.followUp({ content: lang.Music.Error, ephemeral: true });
                    });
            }

        } finally {
            if (searchResult && (!searchResult.tracks || !searchResult.tracks.length)) {
                searchResult = null;
            }
        }

    } catch (error) {
        console.error('Music play error:', error);
        if (error.message?.includes('ERR_NO_RESULT') || error.message?.includes('video is unavailable')) {
            return interaction.editReply({ content: lang.Music.QueryNotFound, ephemeral: true });
        }
        return interaction.editReply({ content: lang.Music.Error, ephemeral: true });
    }
}

async function pause(interaction, player) {
    await interaction.deferReply();
    try {
        const queue = player.nodes.get(interaction.guild.id);
        if (!queue || !queue.tracks || queue.tracks.data.length === 0) {
            await interaction.editReply({ content: lang.Music.NoMusicInQueue });
            return;
        }

        if (!queue.currentTrack) {
            await interaction.editReply({ content: "No track is currently playing." });
            return;
        }

        if (!queue.node.isPaused()) {
            queue.node.pause();
            await interaction.editReply({ content: lang.Music.Paused.replace("{title}", queue.currentTrack.title) });
            return;
        } else {
            await interaction.editReply({ content: lang.Music.AlreadyPaused.replace("{title}", queue.currentTrack.title) });
        }

    } catch (error) {
        console.log(error);
        if (!interaction.replied) {
            await interaction.editReply({ content: lang.Music.Error });
        }
    }
}

async function resume(interaction, player) {
    await interaction.deferReply();
    try {
        const queue = player.nodes.get(interaction.guild.id);
        if (!queue || !queue.tracks || queue.tracks.data.length === 0) {
            await interaction.editReply({ content: lang.Music.NoMusicInQueue, ephemeral: true });
            return;
        }

        if (!queue.currentTrack) {
            await interaction.editReply({ content: "No track is currently playing." });
            return;
        }

        if (!queue.node.isPlaying()) {
            queue.node.resume();
            await interaction.editReply({ content: lang.Music.Resumed.replace("{title}", queue.currentTrack.title) });
            return;
        } else {
            await interaction.editReply({ content: lang.Music.AlreadyResumed.replace("{title}", queue.currentTrack.title) });
        }

    } catch (error) {
        console.log(error);
        if (!interaction.replied) {
            await interaction.editReply({ content: lang.Music.Error, ephemeral: true });
        }
    }
}

async function clear(interaction, player) {
    await interaction.deferReply();
    try {
        const queue = player.nodes.get(interaction.guild.id);
        if (!queue) {
            await interaction.editReply({ content: lang.Music.NoMusicInQueue, ephemeral: true });
        }

        queue.clear();
        await interaction.editReply({ content: lang.Music.QueueCleared, ephemeral: true });

    } catch (error) {
        console.log(error);
        if (!interaction.replied) {
            await interaction.editReply({ content: lang.Music.Error, ephemeral: true });
        }
    }
}

async function skip(interaction, player) {
    await interaction.deferReply();
    try {
        const queue = player.nodes.get(interaction.guild.id);
        if (!queue) {
            await interaction.editReply({ content: lang.Music.NoMusicInQueue, ephemeral: true });
            return;
        }

        if (!queue.currentTrack) {
            await interaction.editReply({ content: "No track is currently playing." });
            return;
        }

        if (!queue.node.isIdle()) {
            queue.node.skip();
            await interaction.editReply({ content: lang.Music.Skipped.replace("{title}", queue.currentTrack.title), ephemeral: true });
            return;

        } else {
            await interaction.editReply({ content: lang.Music.NothingToSkip, ephemeral: true });
        }

    } catch (error) {
        if (!interaction.replied) {
            await interaction.editReply({ content: lang.Music.Error, ephemeral: true });
        }
    }
}


async function back(interaction, player) {
    await interaction.deferReply();
    try {
        const queue = player.nodes.get(interaction.guild.id);
        if (!queue || !queue.tracks || queue.tracks.data.length === 0) {
            await interaction.editReply({ content: lang.Music.NoMusicInQueue, ephemeral: true });
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
        await interaction.editReply({ content: lang.Music.WentBackATrack, ephemeral: true });
    } catch (error) {
        if (!interaction.replied) {
            await interaction.editReply({ content: lang.Music.Error, ephemeral: true });
        }
    }
}

async function loop(interaction, player, client) {
    await interaction.deferReply();
    try {
        const guildId = interaction.guild.id;
        const queue = player.nodes.get(guildId);

        if (!queue) {
            await interaction.editReply({ content: lang.Music.NoMusicInQueue, ephemeral: true });
            return;
        }

        const loopMode = interaction.options.getString('mode');

        let mode;
        switch (loopMode.toUpperCase()) {
            case 'OFF':
                mode = QueueRepeatMode.OFF;
                break;
            case 'TRACK':
                mode = QueueRepeatMode.TRACK;
                break;
            case 'QUEUE':
                mode = QueueRepeatMode.QUEUE;
                break;
            case 'AUTOPLAY':
                mode = QueueRepeatMode.AUTOPLAY;
                break;
            default:
                mode = QueueRepeatMode.OFF;
        }
        queue.setRepeatMode(mode);

        let loopModeMessage;
        let loopType;
        switch (mode) {
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

        await interaction.editReply({ content: loopModeMessage.replace("{state}", loopType), ephemeral: true });

    } catch (error) {
        console.log(error)
        await interaction.editReply({ content: lang.Music.Error, ephemeral: true });
    }
}

async function queue(interaction, player) {
    await interaction.deferReply();
    try {
        const queue = player.nodes.get(interaction.guild.id);
        if (!queue || queue.tracks.data.length === 0) {
            await interaction.editReply({ content: lang.Music.NoMusicInQueue, ephemeral: true });
            return;
        }

        const maxDisplayTracks = 50;
        const truncatedTracks = queue.tracks.data.slice(0, maxDisplayTracks);

        const placeholders = {
            title: queue.currentTrack?.title,
            author: queue.currentTrack?.author,
            duration: queue.currentTrack?.duration,
            queueDuration: queue.durationFormatted
        };
        const { Embed: embedConfig, SongsPerPage: maxTracksPerPage } = config.MusicCommand.Queue || {};
        const totalPages = Math.ceil(queue.tracks.data.length / maxTracksPerPage);
        let currentPage = 0;

        const buildDescription = (page) => {
            const trackListStart = page * maxTracksPerPage;
            const trackListEnd = Math.min(trackListStart + maxTracksPerPage, queue.tracks.data.length);
            const trackList = queue.tracks.data.slice(trackListStart, trackListEnd);

            let description = replacePlaceholders(embedConfig.Description[0], placeholders);
            description += embedConfig.Description[1];

            trackList.forEach((track, index) => {
                const trackPlaceholders = {
                    numberInQueue: trackListStart + index + 1,
                    title: track.title,
                    author: track.author,
                    duration: track.duration,
                };
                description += replacePlaceholders(embedConfig.Description[2], trackPlaceholders) + '\n';
            });

            const pagePlaceholders = {
                currentPage: page + 1,
                totalPages: totalPages,
            };
            description += replacePlaceholders(embedConfig.Description[3], pagePlaceholders);

            return description;
        };

        const generateEmbed = (page) => {
            const embed = new EmbedBuilder();
            embed.setDescription(buildDescription(page));
            embed.setColor(embedConfig?.Color || "#000000");
            if (embedConfig?.Title) embed.setTitle(replacePlaceholders(embedConfig.Title, placeholders));
            if (embedConfig?.Footer?.Text) embed.setFooter({ text: embedConfig.Footer.Text, iconURL: isValidHttpUrl(embedConfig.Footer.Icon) ? embedConfig.Footer.Icon : undefined });
            if (embedConfig?.Image) embed.setImage(isValidHttpUrl(embedConfig.Image) ? embedConfig.Image : undefined);
            if (embedConfig?.Thumbnail) embed.setThumbnail(isValidHttpUrl(embedConfig.Thumbnail) ? embedConfig.Thumbnail : undefined);
            return embed;
        };

        const createButton = (id, buttonConfig, disabled) => {
            const button = new ButtonBuilder().setCustomId(id).setDisabled(disabled);
            if (buttonConfig?.Style) button.setStyle(buttonConfig.Style);
            if (buttonConfig?.Text) button.setLabel(buttonConfig.Text || '');
            if (buttonConfig?.Emoji) button.setEmoji(buttonConfig.Emoji);
            return button;
        };

        const row = new ActionRowBuilder().addComponents(
            createButton('queue_first_page', embedConfig.Buttons.Start, currentPage === 0),
            createButton(`queue_previous_${currentPage}`, embedConfig.Buttons.Back, currentPage === 0),
            createButton(`queue_next_${currentPage}`, embedConfig.Buttons.Next, currentPage >= totalPages - 1),
            createButton('queue_last_page', embedConfig.Buttons.End, currentPage >= totalPages - 1)
        );

        await interaction.editReply({ embeds: [generateEmbed(currentPage)], components: [row], ephemeral: true });

        truncatedTracks.length = 0;
    } catch (error) {
        console.error('Queue display error:', error);
        await interaction.editReply({ content: lang.Music.Error, ephemeral: true });
    }
}

async function move(interaction, player) {
    await interaction.deferReply();
    let movedTrack;
    try {
        const queue = player.nodes.get(interaction.guild.id);
        if (!queue || !queue.tracks || queue.tracks.data.length === 0) {
            await interaction.editReply({ content: lang.Music.NoMusicInQueue, ephemeral: true });
            return;
        }

        const songToMoveIndex = interaction.options.getInteger('songtomove', true) - 1;
        const newPosition = interaction.options.getInteger('moveposition', true) - 1;

        if (songToMoveIndex < 0 || songToMoveIndex >= queue.tracks.data.length || newPosition < 0 || newPosition >= queue.tracks.data.length) {
            await interaction.editReply({ content: lang.Music.Move.InvalidPosition, ephemeral: true });
            return;
        }
        [movedTrack] = queue.tracks.data.splice(songToMoveIndex, 1);
        queue.swapTracks(movedTrack, newPosition);

        await interaction.editReply({ content: lang.Music.Move.Success.replace("{track}", movedTrack.title).replace("{newPosition}", newPosition + 1) });
    } catch (error) {
        console.error(error);
        await interaction.editReply({ content: lang.Music.Move.Error.replace("{track}", movedTrack.title), ephemeral: true });
    }
}

async function filters(interaction, player) {
    await interaction.deferReply();
    try {
        const queue = player.nodes.get(interaction.guild.id);

        if (!queue || !queue.currentTrack) {
            await interaction.editReply({ content: lang.Music.NoMusicPlaying, ephemeral: true });
            return;
        }

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

        const filtersEmbed = new EmbedBuilder();
        filtersEmbed.addFields(
            { name: embedConfig.Fields.Number, value: numbers, inline: true },
            { name: embedConfig.Fields.Filter, value: filtersList, inline: true },
            { name: embedConfig.Fields.Enabled, value: statuses, inline: true }
        );

        filtersEmbed.setTitle("`This command is Experimental!`")

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

        const rows = [];
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

        await interaction.editReply({ embeds: [filtersEmbed], components: rows, ephemeral: true });
    } catch (error) {
        console.log(error)
        await interaction.editReply({ content: lang.Music.Filters.EmbedError, ephemeral: true });
    }
}

async function nowplaying(interaction, player, client) {
    await interaction.deferReply();
    try {
        const queue = player.nodes.get(interaction.guild.id);
        if (!queue || !queue.currentTrack) {
            return interaction.editReply({ content: lang.Music.NoMusicPlaying, ephemeral: true });
        }

        const track = queue.currentTrack;
        const timestamps = queue.node.getTimestamp();
        const progressPercentage = (timestamps.current.value / timestamps.total.value) * 100;

        const npConfig = config.MusicCommand.NowPlaying;
        const canvas = createCanvas(npConfig.Canvas.Width, npConfig.Canvas.Height);
        const ctx = canvas.getContext('2d');

        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        gradient.addColorStop(0, npConfig.BackgroundGradient.Start);
        gradient.addColorStop(1, npConfig.BackgroundGradient.End);
        ctx.fillStyle = gradient;
        roundRect(ctx, 0, 0, canvas.width, canvas.height, 40);
        ctx.fill();

        addPatternOverlay(ctx, npConfig);

        try {
            const response = await axios.get(track.thumbnail, { responseType: 'arraybuffer' });
            const imageBuffer = Buffer.from(response.data, 'binary');
            const pngImageBuffer = await sharp(imageBuffer).resize(300, 300).png().toBuffer();
            const img = await loadImage(pngImageBuffer);

            ctx.save();
            ctx.beginPath();
            ctx.arc(200, 200, 150, 0, Math.PI * 2, true);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(img, 50, 50, 300, 300);
            ctx.restore();

            ctx.shadowColor = npConfig.Accent.Color;
            ctx.shadowBlur = 30;
            ctx.beginPath();
            ctx.arc(200, 200, 151, 0, Math.PI * 2, true);
            ctx.strokeStyle = npConfig.Accent.Color;
            ctx.lineWidth = 6;
            ctx.stroke();
            ctx.shadowBlur = 0;
        } catch (error) {
            console.error('Error loading thumbnail:', error);
            ctx.fillStyle = npConfig.ThumbnailPlaceholder.Color;
            ctx.beginPath();
            ctx.arc(200, 200, 150, 0, Math.PI * 2, true);
            ctx.fill();
        }

        drawProgressBar(ctx, progressPercentage, npConfig);

        drawText(ctx, "Now Playing", 400, 80, 770, npConfig.Font.Header);
        drawText(ctx, track.title, 400, 140, 770, npConfig.Font.Title);
        drawText(ctx, track.author, 400, 200, 770, npConfig.Font.Author);
        drawText(ctx, timestamps.current.label, 400, 340, 100, npConfig.Font.Time);
        drawText(ctx, timestamps.total.label, 1170, 340, 100, { ...npConfig.Font.Time, textAlign: 'right' });

        const buffer = canvas.toBuffer();
        const attachment = new AttachmentBuilder(buffer, { name: 'nowplaying.png' });
        await interaction.editReply({ files: [attachment], ephemeral: false });
    } catch (error) {
        console.error('Error generating Now Playing image:', error);
        await interaction.editReply({ content: lang.Music.NowPlaying.GeneratingError, ephemeral: true });
    }
}

function drawProgressBar(ctx, progressPercentage, npConfig) {
    const progress = { 
        x: 400, 
        y: 280, 
        width: 770, 
        height: npConfig.ProgressBar.Height, 
        borderRadius: npConfig.ProgressBar.BorderRadius 
    };
    
    ctx.fillStyle = npConfig.ProgressBar.BackgroundColor;
    roundRect(ctx, progress.x, progress.y, progress.width, progress.height, progress.borderRadius);
    ctx.fill();

    const filledWidth = Math.max(progress.width * (progressPercentage / 100), 20);
    const gradient = ctx.createLinearGradient(progress.x, 0, progress.x + progress.width, 0);
    gradient.addColorStop(0, npConfig.ProgressBar.GradientStart);
    gradient.addColorStop(1, npConfig.ProgressBar.GradientEnd);
    ctx.fillStyle = gradient;
    roundRect(ctx, progress.x, progress.y, filledWidth, progress.height, progress.borderRadius);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(progress.x + filledWidth, progress.y + progress.height / 2, progress.height / 2 + 5, 0, Math.PI * 2);
    ctx.fillStyle = npConfig.Accent.Color;
    ctx.fill();
}

function drawText(ctx, text, x, y, maxWidth, { size, weight, family, textAlign, fillStyle, transform }) {
    ctx.font = `${weight} ${size} ${family}`;
    ctx.textAlign = textAlign || 'left';
    ctx.fillStyle = fillStyle;
  
    if (transform === 'uppercase') {
        text = text.toUpperCase();
    }
  
    if (ctx.measureText(text).width > maxWidth) {
        let truncatedText = text;
        while (ctx.measureText(`${truncatedText}...`).width > maxWidth) {
            truncatedText = truncatedText.slice(0, -1);
        }
        text = `${truncatedText}...`;
    }
  
    ctx.fillText(text, x, y);
}

function roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.closePath();
}

function addPatternOverlay(ctx, npConfig) {
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = npConfig.Overlay.Color;
    for (let i = 0; i < npConfig.Canvas.Width; i += 4) {
        for (let j = 0; j < npConfig.Canvas.Height; j += 4) {
            if (Math.random() > 0.5) {
                ctx.fillRect(i, j, 2, 2);
            }
        }
    }
    ctx.restore();
}

async function seek(interaction, player) {
    await interaction.deferReply();
    try {
        const queue = player.nodes.get(interaction.guild.id);

        if (!queue || !queue.currentTrack) {
            await interaction.editReply({ content: lang.Music.NoMusicPlaying, ephemeral: true });
            return;
        }

        const timeString = interaction.options.getString('time', true);
        const timeParts = timeString.split(':').reverse();
        const seconds = timeParts.reduce((acc, timePart, index) => {
            return acc + parseInt(timePart, 10) * Math.pow(60, index);
        }, 0);

        const seekResult = queue.node.seek(seconds * 1000);

        if (seekResult) {
            await interaction.editReply({ content: lang.Music.Seeked.Success.replace("{time}", timeString), ephemeral: false });
        } else {
            await interaction.editReply({ content: lang.Music.Seeked.Error.replace("{time}", timeString), ephemeral: true });
        }
    } catch (error) {
        if (!interaction.replied) {
            await interaction.editReply({ content: lang.Music.Error, ephemeral: true }).catch(console.error);
        }
    }
}

function replacePlaceholders(template, placeholders = {}) {
    if (!template) {
        return '\u200b';
    }
    return template.replace(/{([^}]+)}/g, (match, key) => {
        if (key in placeholders) {
            return placeholders[key] || '';
        } else {
            return match;
        }
    });
}

function isValidHttpUrl(string) {
    let url;

    try {
        url = new URL(string);
    } catch (_) {
        return false;
    }

    return url.protocol === "http:" || url.protocol === "https:";
}

async function stop(interaction, player) {
    await interaction.deferReply();
    try {
        const queue = player.nodes.get(interaction.guild.id);
        if (!queue || !queue.currentTrack) {
            await interaction.editReply({ content: lang.Music.NoMusicPlaying, ephemeral: true });
            return;
        }

        queue.tracks.clear();
        queue.node.stop();
        
        if (queue.connection) {
            queue.connection.destroy();
        }
        
        player.nodes.delete(interaction.guild.id);

        await interaction.editReply({ content: lang.Music.Stopped, ephemeral: true });

    } catch (error) {
        console.error('Music stop error:', error);
        if (!interaction.replied) {
            await interaction.editReply({ content: lang.Music.Error, ephemeral: true });
        }
    }
}

async function handleRadio(interaction, player) {
    await interaction.deferReply();
    try {
        const genre = interaction.options.getString('genre');
        let queue = player.nodes.get(interaction.guild.id);
        
        if (genre === 'off') {
            if (queue?.radio?.enabled) {
                queue.radio.enabled = false;
                queue.setRepeatMode(0);
                if (queue.radio.usedTracks) {
                    queue.radio.usedTracks.clear();
                    queue.radio.usedTracks = null;
                }
                queue.radio = null;
                await interaction.editReply({ 
                    content: '📻 Radio mode disabled. The queue will play normally.',
                    ephemeral: false 
                });
            } else {
                await interaction.editReply({ 
                    content: '📻 Radio mode is not currently enabled.',
                    ephemeral: true 
                });
            }
            return;
        }

        if (!queue) {
            queue = player.nodes.create(interaction.guild.id, {
                metadata: {
                    channel: interaction.channel,
                    requestedByUser: interaction.user,
                    client: interaction.client
                },
                selfDeaf: true,
                volume: 80,
                leaveOnEmpty: false,
                leaveOnEmptyCooldown: 300000,
                leaveOnEnd: false,
                skipOnNoStream: true,
                bufferingTimeout: 15000,
                volumeSmoothness: 0.1,
                cleanupOnStop: true
            });
        }

        if (!queue.connection) {
            try {
                await queue.connect(interaction.member.voice.channel);
            } catch (error) {
                console.error('[Radio] Connection error:', error);
                player.nodes.delete(interaction.guild.id);
                await interaction.editReply({ 
                    content: 'Could not join your voice channel!', 
                    ephemeral: true 
                });
                return;
            }
        }

        queue.radio = {
            enabled: true,
            genre: genre,
            lastSearchTerm: '',
            usedTracks: new Set(),
            lastRefresh: Date.now(),
            trackCount: 0
        };

        queue.setRepeatMode(3);

        await interaction.editReply({ 
            content: `📻 Starting radio mode for genre: ${genre}...`,
            ephemeral: false 
        });

        await addRadioTracks(queue, genre, true);

        if (!queue.node.isPlaying()) {
            await queue.node.play();
        }

        await interaction.editReply({ 
            content: `📻 Radio mode enabled! Genre: ${genre}. The bot will continuously find and play new songs from this genre.`,
            ephemeral: false 
        });

    } catch (error) {
        console.error('[Radio] Error in handleRadio:', error);
        await interaction.editReply({ 
            content: 'There was an error while starting radio mode. Please try again.',
            ephemeral: true 
        });
    }
}

async function addRadioTracks(queue, genre, isInitialLoad = false) {
    try {
        if (!queue.radio?.usedTracks) {
            queue.radio.usedTracks = new Set();
        }

        const USED_TRACKS_CLEANUP_INTERVAL = 30 * 60 * 1000;
        if (Date.now() - queue.radio.lastRefresh > USED_TRACKS_CLEANUP_INTERVAL) {
            queue.radio.usedTracks.clear();
            queue.radio.lastRefresh = Date.now();
        }

        const MAX_USED_TRACKS = 1000;
        if (queue.radio.usedTracks.size > MAX_USED_TRACKS) {
            const tracksArray = Array.from(queue.radio.usedTracks);
            const tracksToRemove = tracksArray.slice(0, tracksArray.length - MAX_USED_TRACKS/2);
            tracksToRemove.forEach(track => queue.radio.usedTracks.delete(track));
        }

        const searchOptions = {
            requestedBy: queue.metadata.requestedByUser,
            searchEngine: QueryType.AUTO
        };

        const searchStrategies = [
            {
                type: QueryType.SPOTIFY_PLAYLIST,
                query: `${genre} playlist`
            },
            {
                type: QueryType.YOUTUBE_MUSIC,
                query: `${genre} mix`
            }
        ];

        let tracks = [];
        for (const strategy of searchStrategies) {
            if (tracks.length === 0) {
                const result = await queue.player.search(strategy.query, {
                    ...searchOptions,
                    searchEngine: strategy.type
                });
                if (result?.tracks) tracks = result.tracks;
            }
        }

        const newTracks = tracks.filter(track => 
            !queue.radio.usedTracks.has(track.id || track.url)
        );

        if (newTracks.length === 0) {
            return await addRadioTracks(queue, genre);
        }

        const MAX_TRACKS_PER_ADD = 3;
        const shuffledTracks = newTracks.sort(() => Math.random() - 0.5);
        const tracksToAdd = shuffledTracks.slice(0, MAX_TRACKS_PER_ADD);

        for (const track of tracksToAdd) {
            try {
                const trackIdentifier = track.id || track.url;
                if (!queue.radio.usedTracks.has(trackIdentifier)) {
                    await queue.addTrack(track);
                    queue.radio.usedTracks.add(trackIdentifier);
                    queue.radio.trackCount++;
                }
            } catch (error) {
                console.error(`[Radio] Error adding track ${track.title}:`, error);
            }
        }

        const MIN_QUEUE_SIZE = 5;
        if (queue.tracks.data.length < MIN_QUEUE_SIZE) {
            setTimeout(() => addRadioTracks(queue, genre), 5000);
        }

        tracks = null;
        newTracks.length = 0;
        shuffledTracks.length = 0;
        tracksToAdd.length = 0;

    } catch (error) {
        console.error('[Radio] Error in addRadioTracks:', error);
        try {
            const fallbackResult = await queue.player.search(`${genre} music`, {
                requestedBy: queue.metadata.requestedByUser,
                searchEngine: QueryType.AUTO
            });

            if (fallbackResult?.tracks.length > 0) {
                const tracksToAdd = fallbackResult.tracks
                    .filter(track => !queue.radio.usedTracks.has(track.id || track.url))
                    .slice(0, 3);

                for (const track of tracksToAdd) {
                    await queue.addTrack(track);
                    queue.radio.usedTracks.add(track.id || track.url);
                }
            }
        } catch (fallbackError) {
            console.error('[Radio] Fallback search failed:', fallbackError);
        }
    }
}