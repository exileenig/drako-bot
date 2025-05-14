const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, ChannelType } = require('discord.js');
const fs = require('fs');
const yaml = require('js-yaml');
const moment = require('moment');
const { Chart, registerables, CategoryScale, LinearScale, LineController, LineElement, PointElement } = require('chart.js');
const { createCanvas } = require('canvas');

const config = yaml.load(fs.readFileSync('./config.yml', 'utf8'));

Chart.register(...registerables, CategoryScale, LinearScale, LineController, LineElement, PointElement);

module.exports = {
    data: new SlashCommandBuilder()
        .setName('serverinfo')
        .setDescription('Get detailed information about the server'),
    category: 'General',
    async execute(interaction) {
        try {
            const guild = interaction.guild;
            const createdTimestamp = Math.floor(guild.createdAt.getTime() / 1000);
            const description = guild.description || "No description set";
            const icon = guild.iconURL();
            const owner = await guild.fetchOwner();

            let textChannelCount = 0;
            let voiceChannelCount = 0;
            let otherChannelCount = 0;
            try {
                const channels = await guild.channels.fetch();
                channels.forEach(channel => {
                    if (channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildNews) {
                        textChannelCount++;
                    } else if (channel.type === ChannelType.GuildVoice) {
                        voiceChannelCount++;
                    } else {
                        otherChannelCount++;
                    }
                });
            } catch (error) {
                console.error('Error fetching channels: ', error);
            }

            const serverInfo = new EmbedBuilder()
                .setAuthor({ name: guild.name, iconURL: icon || null })
                .setTitle('📊 Server Information')
                .setDescription(`${description}\n\n**📈 Statistics**\n> 👥 **Members:** ${guild.memberCount}\n> 🤖 **Bots:** ${guild.members.cache.filter(member => member.user.bot).size}\n> 📝 **Roles:** ${guild.roles.cache.size}`)
                .setColor(config.EmbedColors)
                .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() });

            if (icon) {
                serverInfo.setThumbnail(icon);
            }

            const iconLinks = icon
                ? `[png](${icon}?size=1024) | [jpg](${icon.replace('.png', '.jpg')}?size=1024) | [gif](${icon.replace('.png', '.gif')}?size=1024)`
                : 'No icon available';

            serverInfo.addFields(
                {
                    name: '📺 Channels',
                    value: `> 💬 Text: **${textChannelCount}**\n> 🔊 Voice: **${voiceChannelCount}**\n> 🔧 Other: **${otherChannelCount}**`,
                    inline: false
                },
                {
                    name: '⚙️ Server Details',
                    value: [
                        `> 👑 Owner: <@${owner.id}>`,
                        `> 🆔 Server ID: \`${guild.id}\``,
                        `> 🌍 Language: \`${guild.preferredLocale}\``,
                        `> ⭐ Boosts: **${guild.premiumSubscriptionCount}**`,
                        `> 📅 Created: <t:${createdTimestamp}:F> (<t:${createdTimestamp}:R>)`
                    ].join('\n'),
                    inline: false
                },
                {
                    name: '🖼️ Server Icon',
                    value: iconLinks,
                    inline: false
                }
            );

            const chartImageBuffer = await generateMemberChart(guild);
            const attachment = new AttachmentBuilder(chartImageBuffer, { name: 'member_chart.png' });

            serverInfo.setImage('attachment://member_chart.png');

            serverInfo.setTimestamp();

            interaction.reply({ embeds: [serverInfo], files: [attachment] });

        } catch (error) {
            console.error('Error in serverinfo command: ', error);
            interaction.reply({ content: 'Sorry, there was an error retrieving the server information.', ephemeral: true });
        }
    }
};

async function generateMemberChart(guild) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 7);

    const allMembers = await guild.members.fetch();
    const initialCount = Math.round(allMembers.filter(member => member.joinedAt < startDate).size);
    const filteredMembers = allMembers.filter(member => member.joinedAt >= startDate && member.joinedAt <= endDate);

    const dataPoints = [{ x: formatDate(startDate), y: initialCount }];
    const timeDiff = endDate - startDate;
    const interval = timeDiff / 10;

    for (let i = 1; i <= 10; i++) {
        const intervalDate = new Date(startDate.getTime() + i * interval);
        const count = initialCount + filteredMembers.filter(member => member.joinedAt <= intervalDate).size;
        dataPoints.push({ x: formatDate(intervalDate), y: Math.round(count) });
    }

    const chartData = {
        labels: dataPoints.map(point => point.x),
        datasets: [{
            label: 'Member Count',
            data: dataPoints.map(point => point.y),
            borderColor: '#382bff',
            backgroundColor: '#382bff'
        }]
    };

    return generateChartImage(chartData, '1 Week');
}

async function generateChartImage(data, period) {
    const width = 1200;
    const height = 800;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    const createGradient = (ctx, canvas) => {
        const gradient = ctx.createLinearGradient(0, height, 0, 0);
        gradient.addColorStop(0, 'rgba(56, 43, 255, 0.2)');
        gradient.addColorStop(1, 'rgba(56, 43, 255, 0.8)');
        return gradient;
    };

    const gradient = createGradient(ctx, canvas);

    const datasets = [{
        label: 'Members',
        data: data.datasets[0].data,
        borderColor: '#382bff',
        borderWidth: 3,
        backgroundColor: gradient,
        tension: 0.4,
        fill: true,
        pointBackgroundColor: '#FFFFFF',
        pointBorderColor: '#382bff',
        pointBorderWidth: 3,
        pointRadius: 6,
        pointHoverRadius: 8,
        pointHoverBorderWidth: 4,
        pointHoverBackgroundColor: '#382bff',
        pointHoverBorderColor: '#FFFFFF'
    }];

    const configuration = {
        type: 'line',
        data: {
            labels: data.labels,
            datasets: datasets
        },
        options: {
            scales: {
                y: {
                    beginAtZero: false,
                    title: {
                        display: true,
                        text: 'Member Count',
                        font: {
                            size: 24,
                            weight: 'bold',
                            family: 'Arial'
                        },
                        color: '#FFFFFF'
                    },
                    grid: {
                        display: true,
                        color: 'rgba(255, 255, 255, 0.1)',
                        drawBorder: false
                    },
                    ticks: {
                        callback: function(value) {
                            return Math.round(value);
                        },
                        stepSize: 1,
                        font: {
                            size: 16,
                            weight: 'bold',
                            family: 'Arial'
                        },
                        color: 'rgba(255, 255, 255, 0.8)',
                        padding: 10
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Date',
                        font: {
                            size: 24,
                            weight: 'bold',
                            family: 'Arial'
                        },
                        color: '#FFFFFF'
                    },
                    grid: {
                        display: false
                    },
                    ticks: {
                        autoSkip: true,
                        maxTicksLimit: 8,
                        maxRotation: 0,
                        minRotation: 0,
                        font: {
                            size: 16,
                            weight: 'bold',
                            family: 'Arial'
                        },
                        color: 'rgba(255, 255, 255, 0.8)',
                        padding: 10
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: true,
                    text: `Member Growth (${period})`,
                    font: {
                        size: 32,
                        weight: 'bold',
                        family: 'Arial'
                    },
                    color: '#FFFFFF',
                    padding: {
                        top: 20,
                        bottom: 30
                    }
                },
                tooltip: {
                    enabled: true,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleFont: {
                        size: 16,
                        weight: 'bold',
                        family: 'Arial'
                    },
                    bodyFont: {
                        size: 14,
                        family: 'Arial'
                    },
                    padding: 12,
                    cornerRadius: 8,
                    displayColors: false,
                    callbacks: {
                        label: function(tooltipItem) {
                            return `${Math.round(tooltipItem.raw)} members`;
                        }
                    }
                }
            },
            responsive: false,
            maintainAspectRatio: false,
            layout: {
                padding: {
                    top: 40,
                    bottom: 40,
                    left: 20,
                    right: 40
                }
            }
        },
        plugins: [{
            id: 'backgroundColor',
            beforeDraw: (chart) => {
                const ctx = chart.ctx;
                ctx.save();
                ctx.fillStyle = '#101010';
                ctx.fillRect(0, 0, chart.width, chart.height);
                ctx.restore();
            }
        }]
    };

    const chart = new Chart(ctx, configuration);
    const buffer = canvas.toBuffer('image/png');
    chart.destroy();

    return buffer;
}

function formatDate(date) {
    return moment(date).format('D MMM');
}