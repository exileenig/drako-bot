const { MemoryChecker } = require('./utils/memoryChecker.js');
const { updateDashboardEnv } = require('./utils/dashboardEnv');
const startDashboardServer = require('./dashboard/server/index.js');

if (process.platform !== "win32") require("child_process").exec("npm install");

const colors = require('ansi-colors');
console.log(`${colors.yellow(`[Initializing...]`)}`);

const fs = require('fs');
const packageFile = require('./package.json');
const yaml = require("js-yaml");
const config = yaml.load(fs.readFileSync('./config.yml', 'utf8'));
const lang = yaml.load(fs.readFileSync('././lang.yml', 'utf8'));



if (packageFile.version !== config.Version) {
    console.log(`${colors.red(`[ERROR] Version mismatch: package.json version (${packageFile.version}) does not match config.yml version (${config.Version}). Please update the bot...`)}`);
    let logMsg = `\n\n[${new Date().toLocaleString()}] [ERROR] Version mismatch detected. Bot stopped.\nPackage version: ${packageFile.version}\nConfig version: ${config.Version}`;
    fs.appendFileSync("./logs.txt", logMsg, (e) => {
        if (e) console.log(e);
    });
    process.exit(1);
}

let logMsg = `\n\n[${new Date().toLocaleString()}] [STARTING] Attempting to start the bot..\nNodeJS Version: ${process.version}\nBot Version: ${packageFile.version}`;
fs.appendFile("./logs.txt", logMsg, (e) => {
    if (e) console.log(e);
});

const version = Number(process.version.split('.')[0].replace('v', ''));
if (version < 18) {
    console.log(`${colors.red(`[ERROR] Drako Bot requires a NodeJS version of 18 or higher!\nYou can check your NodeJS by running the "node -v" command in your terminal.`)}`);
    console.log(`${colors.blue(`\n[INFO] To update Node.js, follow the instructions below for your operating system:`)}`);
    console.log(`${colors.green(`- Windows:`)} Download and run the installer from ${colors.cyan(`https://nodejs.org/`)}`);
    console.log(`${colors.green(`- Ubuntu/Debian:`)} Run the following commands in the Terminal:`);
    console.log(`${colors.cyan(`  - sudo apt update`)}`);
    console.log(`${colors.cyan(`  - sudo apt upgrade nodejs`)}`);
    console.log(`${colors.green(`- CentOS:`)} Run the following commands in the Terminal:`);
    console.log(`${colors.cyan(`  - sudo yum update`)}`);
    console.log(`${colors.cyan(`  - sudo yum install -y nodejs`)}`);

    let logMsg = `\n\n[${new Date().toLocaleString()}] [ERROR] Drako Bot requires a NodeJS version of 18 or higher!`;
    fs.appendFile("./logs.txt", logMsg, (e) => {
        if (e) console.log(e);
    });

    process.exit();
}

const { Collection, Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Discord = require('discord.js');
const backup = require("discord-backup");
const axios = require('axios');
const Invite = require('./models/inviteSchema');
const UserData = require('./models/UserData');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildBans,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildEmojisAndStickers,
        GatewayIntentBits.GuildIntegrations,
        GatewayIntentBits.GuildWebhooks,
        GatewayIntentBits.GuildInvites,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildMessageTyping,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.DirectMessageReactions,
        GatewayIntentBits.DirectMessageTyping,
        GatewayIntentBits.MessageContent
    ]
});

global.client = client;

(async () => {
    try {
         if (config.Dashboard.Enabled) {
             console.log(`${colors.yellow(`[ENV] Updating dashboard environment...`)}`);
             if (updateDashboardEnv()) {
                 console.log(`${colors.green(`[ENV] Dashboard configuration updated successfully`)}`);
                 startDashboardServer();
             } else {
                 console.error(`${colors.red(`[ERROR] Failed to update dashboard environment. Dashboard will not start.`)}`);
                 process.exit(1);
             }
         }
         
     } catch (error) {
         console.error('Error during initialization:', error);
         process.exit(1);
     }
 })();
 
 const memoryChecker = new MemoryChecker('Drako Bot');
 const fetch = require('node-fetch');
 
 memoryChecker.logMemoryUsage = async function() {
     const memUsage = process.memoryUsage();
     const totalMemory = Math.round(
         (memUsage.heapUsed + memUsage.external + memUsage.arrayBuffers) / 1024 / 1024 * 100
     ) / 100;
     
     if (global.updateBotMemory) {
         global.updateBotMemory(totalMemory);
         return;
     }
 
     try {
         const dashboardUrl = `http://${config.Dashboard.URL}:${config.Dashboard.Port}/api/memory/bot`;
         
         const response = await fetch(dashboardUrl, {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ memory: totalMemory }),
             timeout: 2000
         });
 
         if (!response.ok) {
             throw new Error(`HTTP error! status: ${response.status}`);
         }
     } catch (error) {
         if (!error.type === 'request-timeout') {
             console.error("[BOT] Memory update error:", error.message);
         }
     }
 }
 
 memoryChecker.start();

client.invites = new Map();

client.once('ready', async () => {
    client.guilds.cache.forEach(async guild => {
        try {
            const invites = await guild.invites.fetch();
            const codeUses = new Map(invites.map(invite => [invite.code, invite.uses]));
            client.invites.set(guild.id, codeUses);

        } catch (error) {
            console.error(`Failed to fetch invites or determine existing members for guild ${guild.id}: ${error}`);
        }
    });
});

client.on('inviteCreate', async invite => {
    const invites = await invite.guild.invites.fetch();
    const codeUses = new Map(invites.map(invite => [invite.code, invite.uses]));
    client.invites.set(invite.guild.id, codeUses);
});

client.on('inviteDelete', invite => {
    const invites = client.invites.get(invite.guild.id);
    invites.delete(invite.code);
    client.invites.set(invite.guild.id, invites);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    fs.appendFile('logs.txt', `Uncaught Exception: ${error.stack || error}\n`, (err) => {
        if (err) {
            console.error('Failed to write to log file:', err);
        }
    });
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    fs.appendFile('logs.txt', `Unhandled Rejection at: ${promise}, reason: ${reason.stack || reason}\n`, (err) => {
        if (err) {
            console.error('Failed to write to log file:', err);
        }
    });
});

module.exports = client
require("./utils.js");
require('./events/antiNuke')(client);

const filePath = './logs.txt';
const maxLength = 300;

const { Player } = require('discord-player');
const { YoutubeiExtractor } = require("discord-player-youtubei")

const player = new Player(client);

const youtubeAuth = config.YouTubeKey;

const { Log } = require('youtubei.js');
Log.setLevel(Log.Level.NONE);

async function registerExtractors() {
    await player.extractors.register(YoutubeiExtractor, {
        streamOptions: { useClient: config.Player }
    });

    await player.extractors.loadDefault((ext) => !['YouTubeExtractor'].includes(ext));
}

registerExtractors();

function replacePlaceholders(template, placeholders = {}) {
    if (!template) {
        return '\u200b';
    }

    return Object.keys(placeholders).reduce((acc, key) => {
        const regex = new RegExp(`{${key}}`, 'gi');
        return acc.replace(regex, placeholders[key] || '');
    }, template);
}

player.events.on('playerStart', (queue, track) => {
    try {

        const platformName = getPlatformName(track.extractor);
        const platformEmoji = getPlatformEmoji(platformName);

        const placeholders = {
            id: track.id,
            title: track?.title || "Track",
            description: track?.description || "None",
            author: (platformName === 'Spotify' || platformName === 'Apple Music') ? `${track?.author}` : "",
            url: track?.url || "None",
            thumbnail: track?.thumbnail || "None",
            duration: track?.duration || "00:00",
            durationMS: track?.durationMS || "0000",
            views: track?.views || "0",
            requestedByMention: track?.requestedBy || "Nobody",
            requestedByDisplayName: track?.requestedBy.globalName || "Nobody",
            playlistName: track?.playlist?.title || "None",
            playlistUrl: track?.playlist?.url || "None",
            playlistThumbnail: track?.playlist?.thumbnail || "None",
            platform: platformName || "Discord",
            platformEmoji: platformEmoji || "https://imgur.com/csAsSqY",
            queueCount: queue?.tracks.data.length || "0",
            queueDuration: queue?.durationFormatted || "00:00",
        };

        const currentTrackConfig = config.MusicCommand.CurrentTrack;

        if (currentTrackConfig.Enabled) {

            if (currentTrackConfig && currentTrackConfig.Type.toUpperCase() === "EMBED") {

                const embed = new EmbedBuilder();

                if (currentTrackConfig.Embed.Color) {
                    embed.setColor(currentTrackConfig.Embed.Color);
                }

                if (currentTrackConfig.Embed.Title) {
                    embed.setTitle(replacePlaceholders(currentTrackConfig.Embed.Title, placeholders));
                }

                if (currentTrackConfig.Embed.Description) {
                    embed.setDescription(
                        replacePlaceholders(currentTrackConfig.Embed.Description.replace((platformName !== 'Spotify' && platformName !== 'Apple Music') ? "-" : "", ""), placeholders)
                    );
                }

                if (currentTrackConfig.Embed.Fields) {
                    currentTrackConfig.Embed.Fields.forEach(field => {
                        const fieldName = replacePlaceholders(field.Name, placeholders);
                        const fieldValue = replacePlaceholders(field.Value, placeholders);
                        embed.addFields({
                            name: fieldName,
                            value: fieldValue,
                            inline: field.Inline ?? false
                        });
                    });
                }

                if (currentTrackConfig.Embed.Thumbnail && isValidHttpUrl(replacePlaceholders(currentTrackConfig.Embed.Thumbnail, placeholders))) {
                    embed.setThumbnail(replacePlaceholders(currentTrackConfig.Embed.Thumbnail, placeholders));
                }

                if (currentTrackConfig.Embed.Image && isValidHttpUrl(replacePlaceholders(currentTrackConfig.Embed.Image, placeholders))) {
                    embed.setImage(replacePlaceholders(currentTrackConfig.Embed.Image, placeholders));
                }

                if (currentTrackConfig.Embed.Author && currentTrackConfig.Embed.Author.Text) {
                    const authorIconUrl = replacePlaceholders(currentTrackConfig.Embed.Author.Icon, placeholders);
                    embed.setAuthor({
                        name: replacePlaceholders(currentTrackConfig.Embed.Author.Text, placeholders),
                        iconURL: isValidHttpUrl(authorIconUrl) ? authorIconUrl : undefined,
                        url: placeholders.url
                    });
                }

                if (currentTrackConfig.Embed.Footer && currentTrackConfig.Embed.Footer.Text) {
                    const footerIconUrl = currentTrackConfig.Embed.Footer.Icon;
                    embed.setFooter({
                        text: replacePlaceholders(currentTrackConfig.Embed.Footer.Text, placeholders),
                        iconURL: isValidHttpUrl(footerIconUrl) ? footerIconUrl : undefined
                    });
                }

                const row = new ActionRowBuilder();
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId('music_back')
                        .setEmoji(config.MusicCommand.Emojis.Back)
                        .setStyle(ButtonStyle.Secondary)
                );

                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId('music_play_pause')
                        .setEmoji(config.MusicCommand.Emojis.Pause)
                        .setStyle(ButtonStyle.Secondary)
                );

                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId('music_next')
                        .setEmoji(config.MusicCommand.Emojis.Next)
                        .setStyle(ButtonStyle.Secondary)
                );

                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId('music_shuffle')
                        .setEmoji(config.MusicCommand.Emojis.Shuffle)
                        .setStyle(ButtonStyle.Secondary)
                );

                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId('music_loop')
                        .setEmoji(config.MusicCommand.Emojis.Repeat)
                        .setStyle(ButtonStyle.Secondary)
                );

                queue.metadata.channel.send({
                    embeds: [embed],
                    components: [row]
                });
            } else {
                if (currentTrackConfig.Message) {
                    const message = replacePlaceholders(currentTrackConfig.Message, placeholders);
                    queue.metadata.channel.send(message);
                }
            }
        }
    } catch (error) {
        console.error('Error in playerStart event handler:', error);
    }
});

player.events.on('audioTrackAdd', (queue, track) => {
    try {
        if (track.playlist) return;

        const platformName = getPlatformName(track.extractor);
        const platformEmoji = getPlatformEmoji(platformName);

        const placeholders = {
            id: track.id,
            title: track?.title || "Track",
            description: track?.description || "None",
            author: (platformName === 'Spotify' || platformName === 'Apple Music') ? `${track?.author}` : "",
            url: track?.url || "None",
            thumbnail: track?.thumbnail || "None",
            duration: track?.duration || "00:00",
            durationMS: track?.durationMS || "0000",
            views: track?.views || "0",
            requestedByMention: track?.requestedBy || "Nobody",
            requestedByDisplayName: track?.requestedBy.globalName || "Nobody",
            platform: platformName || "Discord",
            platformEmoji: platformEmoji || "https://imgur.com/csAsSqY",
            queueCount: queue.tracks.data.length.toString(),
            queueDuration: queue?.durationFormatted || "00:00",
        };

        const addedTrackConfig = config.MusicCommand.AddedTrack;

        if (addedTrackConfig.Enabled) {

            if (addedTrackConfig && addedTrackConfig.Type.toUpperCase() === "EMBED") {
                const embed = new EmbedBuilder();

                if (addedTrackConfig.Embed.Color) {
                    embed.setColor(addedTrackConfig.Embed.Color);
                }

                if (addedTrackConfig.Embed.Title) {
                    embed.setTitle(replacePlaceholders(addedTrackConfig.Embed.Title, placeholders));
                }

                if (addedTrackConfig.Embed.Description) {
                    embed.setDescription(
                        replacePlaceholders(addedTrackConfig.Embed.Description.replace((platformName !== 'Spotify' && platformName !== 'Apple Music') ? "-" : "", ""), placeholders)
                    );
                }

                if (addedTrackConfig.Embed.Fields) {
                    addedTrackConfig.Embed.Fields.forEach(field => {
                        const fieldName = replacePlaceholders(field.Name, placeholders);
                        const fieldValue = replacePlaceholders(field.Value, placeholders);
                        embed.addFields({
                            name: fieldName,
                            value: fieldValue,
                            inline: field.Inline ?? false
                        });
                    });
                }

                if (addedTrackConfig.Embed.Thumbnail && isValidHttpUrl(replacePlaceholders(addedTrackConfig.Embed.Thumbnail, placeholders))) {
                    embed.setThumbnail(replacePlaceholders(addedTrackConfig.Embed.Thumbnail, placeholders));
                }

                if (addedTrackConfig.Embed.Image && isValidHttpUrl(replacePlaceholders(addedTrackConfig.Embed.Image, placeholders))) {
                    embed.setImage(replacePlaceholders(addedTrackConfig.Embed.Image, placeholders));
                }

                if (addedTrackConfig.Embed.Author && addedTrackConfig.Embed.Author.Text) {
                    const authorIconUrl = replacePlaceholders(addedTrackConfig.Embed.Author.Icon, placeholders);
                    embed.setAuthor({
                        name: replacePlaceholders(addedTrackConfig.Embed.Author.Text, placeholders),
                        iconURL: isValidHttpUrl(authorIconUrl) ? authorIconUrl : undefined,
                        url: placeholders.url
                    });
                }

                if (addedTrackConfig.Embed.Footer && addedTrackConfig.Embed.Footer.Text) {
                    const footerIconUrl = addedTrackConfig.Embed.Footer.Icon;
                    embed.setFooter({
                        text: replacePlaceholders(addedTrackConfig.Embed.Footer.Text, placeholders),
                        iconURL: isValidHttpUrl(footerIconUrl) ? footerIconUrl : undefined
                    });
                }

                queue.metadata.channel.send({
                    embeds: [embed]
                });
            } else {
                if (addedTrackConfig.Message) {
                    const message = replacePlaceholders(addedTrackConfig.Message, placeholders);
                    queue.metadata.channel.send(message);
                }
            }
        }
    } catch (error) {
        console.error('Error in audioTrackAdd event handler:', error);
    }
});

player.events.on('audioTracksAdd', async (queue, tracks) => {
    try {
        if (queue.metadata.hasSentPlaylistMessage) return;

        const uniqueTracks = tracks.filter((track, index, self) =>
            index === self.findIndex((t) => (
                t.url === track.url
            ))
        );

        const track = uniqueTracks[0];
        const platformName = getPlatformName(track.extractor);
        const platformEmoji = getPlatformEmoji(platformName);

        const placeholders = {
            id: track.id,
            url: track?.url || "None",
            requestedByMention: track?.requestedBy || "Nobody",
            requestedByDisplayName: track?.requestedBy.globalName || "Nobody",
            playlistName: tracks?.playlist?.title || "None",
            playlistUrl: tracks?.playlist?.url || "None",
            playlistThumbnail: tracks?.playlist?.thumbnail || "None",
            trackCount: uniqueTracks.length,
            queueCount: queue?.tracks.data.length.toString() || "0",
            queueDuration: queue?.durationFormatted || "00:00",
            platform: platformName || "Discord",
            platformEmoji: platformEmoji || "https://imgur.com/csAsSqY",
        };

        const addedTracksConfig = config.MusicCommand.AddedTracks;

        if (addedTracksConfig.Enabled) {
            if (addedTracksConfig.Type.toUpperCase() === "EMBED") {
                const embed = new EmbedBuilder();

                if (addedTracksConfig.Embed.Color) {
                    embed.setColor(addedTracksConfig.Embed.Color);
                }

                if (addedTracksConfig.Embed.Title) {
                    embed.setTitle(replacePlaceholders(addedTracksConfig.Embed.Title, placeholders));
                }

                if (addedTracksConfig.Embed.Description) {
                    embed.setDescription(
                        replacePlaceholders(addedTracksConfig.Embed.Description, placeholders)
                    );
                }

                if (addedTracksConfig.Embed.Fields) {
                    addedTracksConfig.Embed.Fields.forEach(field => {
                        const fieldName = replacePlaceholders(field.Name, placeholders);
                        const fieldValue = replacePlaceholders(field.Value, placeholders);
                        embed.addFields({
                            name: fieldName,
                            value: fieldValue,
                            inline: field.Inline ?? false
                        });
                    });
                }

                if (addedTracksConfig.Embed.Thumbnail && isValidHttpUrl(replacePlaceholders(addedTracksConfig.Embed.Thumbnail, placeholders))) {
                    embed.setThumbnail(replacePlaceholders(addedTracksConfig.Embed.Thumbnail, placeholders));
                }

                if (addedTracksConfig.Embed.Image && isValidHttpUrl(replacePlaceholders(addedTracksConfig.Embed.Image, placeholders))) {
                    embed.setImage(replacePlaceholders(addedTracksConfig.Embed.Image, placeholders));
                }

                if (addedTracksConfig.Embed.Author && addedTracksConfig.Embed.Author.Text) {
                    const authorIconUrl = replacePlaceholders(addedTracksConfig.Embed.Author.Icon, placeholders);
                    embed.setAuthor({
                        name: replacePlaceholders(addedTracksConfig.Embed.Author.Text, placeholders),
                        iconURL: isValidHttpUrl(authorIconUrl) ? authorIconUrl : undefined,
                        url: placeholders.url
                    });
                }

                await queue.metadata.channel.send({ embeds: [embed] });

                queue.metadata.hasSentPlaylistMessage = true;
            } else {
                if (addedTracksConfig.Message) {
                    const message = replacePlaceholders(addedTracksConfig.Message, placeholders);
                    await queue.metadata.channel.send(message);

                    queue.metadata.hasSentPlaylistMessage = true;
                }
            }
        }

    } catch (error) {
        console.error('Error in audioTracksAdd event handler:', error);

        if (error.message && error.message.includes('ERR_NO_RESULT')) {
            await queue.metadata.channel.send({
                content: 'Sorry, I could not extract the stream for this track. Please try another track.',
                ephemeral: true
            });
        } else {
            await queue.metadata.channel.send({
                content: 'An unexpected error occurred while adding tracks.',
                ephemeral: true
            });
        }
    }
});

player.events.on('playerFinish', (queue, track) => {
    try {

        const platformName = getPlatformName(track.extractor);
        const platformEmoji = getPlatformEmoji(platformName);

        const placeholders = {
            id: track.id,
            title: track?.title || "Track",
            description: track?.description || "None",
            author: (platformName === 'Spotify' || platformName === 'Apple Music') ? `${track?.author}` : "",
            url: track?.url || "None",
            thumbnail: track?.thumbnail || "None",
            duration: track?.duration || "00:00",
            durationMS: track?.durationMS || "0000",
            views: track?.views || "0",
            requestedByMention: track?.requestedBy || "Nobody",
            requestedByDisplayName: track?.requestedBy.globalName || "Nobody",
            playlistName: track?.playlist?.title || "None",
            playlistUrl: track?.playlist?.url || "None",
            playlistThumbnail: track?.playlist?.thumbnail || "None",
            platform: platformName || "Discord",
            platformEmoji: platformEmoji || "https://imgur.com/csAsSqY",
            queueCount: queue?.tracks.data.length || "0",
            queueDuration: queue?.durationFormatted || "00:00",
        };

        const finishedTrackConfig = config.MusicCommand.TrackFinished;

        if (finishedTrackConfig.Enabled) {

            if (finishedTrackConfig && finishedTrackConfig.Type.toUpperCase() === "EMBED") {

                const embed = new EmbedBuilder();

                if (finishedTrackConfig.Embed.Color) {
                    embed.setColor(finishedTrackConfig.Embed.Color);
                }

                if (finishedTrackConfig.Embed.Title) {
                    embed.setTitle(replacePlaceholders(finishedTrackConfig.Embed.Title, placeholders));
                }

                if (finishedTrackConfig.Embed.Description) {
                    embed.setDescription(
                        replacePlaceholders(finishedTrackConfig.Embed.Description.replace((platformName !== 'Spotify' && platformName !== 'Apple Music') ? "-" : "", ""), placeholders)
                    );
                }

                if (finishedTrackConfig.Embed.Fields) {
                    finishedTrackConfig.Embed.Fields.forEach(field => {
                        const fieldName = replacePlaceholders(field.Name, placeholders);
                        const fieldValue = replacePlaceholders(field.Value, placeholders);
                        embed.addFields({
                            name: fieldName,
                            value: fieldValue,
                            inline: field.Inline ?? false
                        });
                    });
                }

                if (finishedTrackConfig.Embed.Thumbnail && isValidHttpUrl(replacePlaceholders(finishedTrackConfig.Embed.Thumbnail, placeholders))) {
                    embed.setThumbnail(replacePlaceholders(finishedTrackConfig.Embed.Thumbnail, placeholders));
                }

                if (finishedTrackConfig.Embed.Image && isValidHttpUrl(replacePlaceholders(finishedTrackConfig.Embed.Image, placeholders))) {
                    embed.setImage(replacePlaceholders(finishedTrackConfig.Embed.Image, placeholders));
                }

                if (finishedTrackConfig.Embed.Author && finishedTrackConfig.Embed.Author.Text) {
                    const authorIconUrl = replacePlaceholders(finishedTrackConfig.Embed.Author.Icon, placeholders);
                    embed.setAuthor({
                        name: replacePlaceholders(finishedTrackConfig.Embed.Author.Text, placeholders),
                        iconURL: isValidHttpUrl(authorIconUrl) ? authorIconUrl : undefined,
                        url: placeholders.url
                    });
                }

                if (finishedTrackConfig.Embed.Footer && finishedTrackConfig.Embed.Footer.Text) {
                    const footerIconUrl = finishedTrackConfig.Embed.Footer.Icon;
                    embed.setFooter({
                        text: replacePlaceholders(finishedTrackConfig.Embed.Footer.Text, placeholders),
                        iconURL: isValidHttpUrl(footerIconUrl) ? footerIconUrl : undefined
                    });
                }

                queue.metadata.channel.send({
                    embeds: [embed]
                });
            } else {
                if (finishedTrackConfig.Message) {
                    const message = replacePlaceholders(finishedTrackConfig.Message, placeholders);
                    queue.metadata.channel.send(message);
                }
            }
        }
    } catch (error) {
        console.error('Error in playerFinish event handler:', error);
    }
});

function getPlatformName(details) {
    let platformName = 'Unknown Platform';
    for (const protocol of details.protocols) {
        switch (protocol) {
            case 'ytsearch':
            case 'youtube':
                platformName = 'YouTube';
                break;
            case 'spsearch':
            case 'spotify':
                platformName = 'Spotify';
                break;
            case 'scsearch':
            case 'soundcloud':
                platformName = 'SoundCloud';
                break;
            case 'amsearch':
            case 'applemusic':
                platformName = 'Apple Music';
                break;
            default:
                continue;
        }

        if (platformName !== 'Unknown Platform') {
            break;
        }
    }
    return platformName;
}

function getPlatformEmoji(platformName) {
    let emoji = "";
    switch (platformName) {
        case 'YouTube':
            emoji = config.MusicCommand.Emojis.Platform.YouTube;
            break;
        case 'Spotify':
            emoji = config.MusicCommand.Emojis.Platform.Spotify;
            break;
        case 'SoundCloud':
            emoji = config.MusicCommand.Emojis.Platform.SoundCloud;
            break;
        case 'Apple Music':
            emoji = config.MusicCommand.Emojis.Platform.AppleMusic;
            break;
        default:
            emoji = "https://imgur.com/csAsSqY";
            break;
    }
    return emoji;
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

player.events.on('playerShuffle', (queue) => {
    try {
        const shuffleConfig = config.MusicCommand.Shuffle;
        
        if (shuffleConfig.Enabled) {
            const placeholders = {
                queueCount: queue.tracks.data.length.toString()
            };

            if (shuffleConfig.Type.toUpperCase() === "EMBED") {
                const embed = new EmbedBuilder();

                if (shuffleConfig.Embed.Color) {
                    embed.setColor(shuffleConfig.Embed.Color);
                }

                if (shuffleConfig.Embed.Title) {
                    embed.setTitle(replacePlaceholders(shuffleConfig.Embed.Title, placeholders));
                }

                if (shuffleConfig.Embed.Description) {
                    embed.setDescription(replacePlaceholders(shuffleConfig.Embed.Description, placeholders));
                }

                if (shuffleConfig.Embed.Fields) {
                    shuffleConfig.Embed.Fields.forEach(field => {
                        const fieldName = replacePlaceholders(field.Name, placeholders);
                        const fieldValue = replacePlaceholders(field.Value, placeholders);
                        embed.addFields({
                            name: fieldName,
                            value: fieldValue,
                            inline: field.Inline ?? false
                        });
                    });
                }

                if (shuffleConfig.Embed.Thumbnail) {
                    embed.setThumbnail(shuffleConfig.Embed.Thumbnail);
                }

                if (shuffleConfig.Embed.Footer) {
                    embed.setFooter({
                        text: shuffleConfig.Embed.Footer.Text,
                        iconURL: shuffleConfig.Embed.Footer.Icon
                    });
                }

                queue.metadata.channel.send({ embeds: [embed] });
            } else {
                const message = replacePlaceholders(shuffleConfig.Message, placeholders);
                queue.metadata.channel.send(message);
            }
        }
    } catch (error) {
        console.error('Error in shuffle event handler:', error);
    }
});

client.on('interactionCreate', async interaction => {
    if (interaction.isModalSubmit()) {
        const command = interaction.client.commands.get('say');
        if (command?.modalSubmit) {
            try {
                await command.modalSubmit(interaction);
            } catch (error) {
                console.error(error);
                await interaction.reply({ 
                    content: 'There was an error while executing this command!', 
                    ephemeral: true 
                });
            }
        }
    }
});