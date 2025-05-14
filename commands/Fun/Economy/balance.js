const { AttachmentBuilder, SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createCanvas, loadImage } = require('canvas');
const User = require('../../../models/UserData');
const fs = require('fs');
const yaml = require('js-yaml');
const config = yaml.load(fs.readFileSync('./config.yml', 'utf8'));
const lang = yaml.load(fs.readFileSync('./lang.yml', 'utf8'));
const { replacePlaceholders } = require('./Utility/helpers');

const userCache = {};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('balance')
        .setDescription('Check your balance or another user\'s balance')
        .addUserOption(option => option.setName('user').setDescription('The user to check the balance of'))
        .addStringOption(option => option.setName('type').setDescription('Type of balance check').addChoices(
            { name: 'Log', value: 'log' }
        )),
    category: 'Economy',
    async execute(interaction) {
        const userOption = interaction.options.getUser('user');
        const type = interaction.options.getString('type');
        const targetUser = userOption || interaction.user;

        const cacheKey = `${targetUser.id}-${interaction.guild.id}`;

        let user;
        let projection;

        if (type === 'log') {
            projection = { balance: 1, bank: 1, transactionLogs: 1 };
            if (userCache[cacheKey]) {
                user = userCache[cacheKey];
            } else {
                user = await User.findOne({ userId: targetUser.id, guildId: interaction.guild.id }, projection);
                if (!user) {
                    user = {
                        balance: 0,
                        bank: 0,
                        transactionLogs: []
                    };
                }
                userCache[cacheKey] = user;
            }
        } else {
            projection = { balance: 1, bank: 1 };
            user = await User.findOne({ userId: targetUser.id, guildId: interaction.guild.id }, projection);
            if (!user) {
                user = {
                    balance: 0,
                    bank: 0,
                };
            }
        }

        const formatNumber = (num) => {
            if (num === undefined || num === null) num = 0;

            if (num >= 1_000_000_000_000_000) {
                return (num / 1_000_000_000_000_000).toFixed(1).replace(/\.0$/, '') + 'Q';
            } else if (num >= 1_000_000_000_000) {
                return (num / 1_000_000_000_000).toFixed(1).replace(/\.0$/, '') + 'T';
            } else if (num >= 1_000_000_000) {
                return (num / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B';
            } else if (num >= 1_000_000) {
                return (num / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
            } else if (num >= 1_000) {
                return (num / 1_000).toFixed(1).replace(/\.0$/, '') + 'k';
            }
            return num.toString();
        };

        const capitalizeWords = (str) => {
            return str.replace(/[_-]/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
        };

        if (type === 'log') {
            let totalGained = 0;
            let totalLost = 0;

            user.transactionLogs.forEach(log => {
                if (log.amount > 0) {
                    totalGained += log.amount;
                } else {
                    totalLost += Math.abs(log.amount);
                }
            });

            const categories = {
                games: ['blackjack_win', 'blackjack_draw', 'blackjack_lose', 'coinflip', 'roll', 'roulette', 'slot'],
                purchases: ['purchase'],
                interest: ['interest'],
                other: ['beg', 'crime', 'daily', 'deposit', 'admin-give-balance', 'admin-give-bank', 'admin-take-balance', 'admin-take-bank', 'admin-set-balance', 'admin-set-bank', 'rob', 'robbed', 'transfer_out', 'transfer_in', 'work']
            };

            let selectedCategory = 'all';
            let page = 1;
            const itemsPerPage = 10;

            const filterLogs = (category) => {
                if (category === 'all') return user.transactionLogs;
                return user.transactionLogs.filter(log => categories[category].includes(log.type));
            };

            const createEmbed = (filteredLogs) => {
                const paginatedLogs = filteredLogs.slice((page - 1) * itemsPerPage, page * itemsPerPage);

                const transactionDescriptions = paginatedLogs
                    .map(log => {
                        let sign;
                        let amount = formatNumber(Math.abs(log.amount));
                        const type = capitalizeWords(log.type);
                        const emoji = '🪙';

                        if (log.type === 'blackjack_lose') {
                            sign = '-';
                        } else {
                            sign = log.amount > 0 ? '+' : '-';
                        }

                        const formattedAmount = `${sign}${amount}`;

                        if (formattedAmount === '-0.00' && log.type === 'interest') {
                            return null;
                        }

                        return `${formattedAmount} ${emoji} (${type})`;
                    })
                    .filter(description => description !== null)
                    .join('\n');

                const totalGainedStr = formatNumber(totalGained);
                const totalLostStr = formatNumber(totalLost);

                const logDescription = transactionDescriptions
                    ? `\`\`\`diff\n${transactionDescriptions}\n\`\`\``
                    : `\`\`\`prolog\nNo Transactions Found\`\`\``;

                return new EmbedBuilder()
                    .setTitle(replacePlaceholders(lang.Economy.Messages.transactionLog, { user: targetUser.username }))
                    .setDescription(logDescription)
                    .addFields(
                        { name: lang.Economy.Messages.gained, value: `+${totalGainedStr} 🪙`, inline: true },
                        { name: lang.Economy.Messages.lost, value: `-${totalLostStr} 🪙`, inline: true }
                    )
                    .setColor('#00FF00');
            };

            const updateMessage = async () => {
                const filteredLogs = filterLogs(selectedCategory);
                const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);

                const embed = createEmbed(filteredLogs);

                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId('category_select')
                    .setPlaceholder('Select category')
                    .addOptions(
                        {
                            label: 'All',
                            value: 'all',
                            description: 'View all transaction logs',
                            emoji: '📜',
                        },
                        {
                            label: 'Games',
                            value: 'games',
                            description: 'View logs from games like blackjack, roulette, etc.',
                            emoji: '🎮',
                        },
                        {
                            label: 'Purchases',
                            value: 'purchases',
                            description: 'View logs of your purchases',
                            emoji: '🛒',
                        },
                        {
                            label: 'Interest',
                            value: 'interest',
                            description: 'View logs of bank interest',
                            emoji: '💰',
                        },
                        {
                            label: 'Other',
                            value: 'other',
                            description: 'View other transaction logs',
                            emoji: '✨',
                        },
                    );

                const row1 = new ActionRowBuilder().addComponents(selectMenu);

                const row2 = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('previous')
                            .setLabel('Previous')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(page <= 1),
                        new ButtonBuilder()
                            .setCustomId('next')
                            .setLabel('Next')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(page >= totalPages)
                    );

                await interaction.editReply({ content: '', embeds: [embed], components: [row1, row2] });
            };

            await interaction.reply({ content: 'Loading...', fetchReply: true });

            updateMessage();

            const collector = interaction.channel.createMessageComponentCollector({ time: 60000 });

            collector.on('collect', async i => {
                if (i.customId === 'category_select') {
                    selectedCategory = i.values[0];
                    page = 1;
                    await updateMessage();
                    await i.deferUpdate();
                }

                if (i.customId === 'previous') {
                    page--;
                    await updateMessage();
                    await i.deferUpdate();
                }

                if (i.customId === 'next') {
                    page++;
                    await updateMessage();
                    await i.deferUpdate();
                }
            });

            collector.on('end', async () => {
                delete userCache[cacheKey];
                await interaction.editReply({ components: [] });
            });

        } else {
            const canvas = createCanvas(1000, 320);
            const ctx = canvas.getContext('2d');

            const bgGradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
            bgGradient.addColorStop(0, '#080A10');
            bgGradient.addColorStop(1, '#10121A');
            ctx.fillStyle = bgGradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const vignette = ctx.createRadialGradient(
                canvas.width / 2, canvas.height / 2, 0,
                canvas.width / 2, canvas.height / 2, canvas.width / 1.5
            );
            vignette.addColorStop(0, '#00000000');
            vignette.addColorStop(1, '#00000015');
            ctx.fillStyle = vignette;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const diagonalGradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
            diagonalGradient.addColorStop(0, '#ffffff03');
            diagonalGradient.addColorStop(0.5, '#ffffff01');
            diagonalGradient.addColorStop(1, '#ffffff03');
            ctx.fillStyle = diagonalGradient;
            
            for (let i = 0; i < 2; i++) {
                ctx.beginPath();
                ctx.moveTo(0, 50 + i * 50);
                ctx.lineTo(canvas.width, canvas.height - 50 + i * 50);
                ctx.lineTo(canvas.width, canvas.height - 150 + i * 50);
                ctx.lineTo(0, 150 + i * 50);
                ctx.closePath();
                ctx.fill();
            }

            ctx.fillStyle = '#ffffff';
            for (let i = 0; i < canvas.width; i += 2) {
                for (let j = 0; j < canvas.height; j += 2) {
                    if (Math.random() > 0.85) {
                        ctx.globalAlpha = Math.random() * 0.006;
                        const size = Math.random() * 1.5;
                        ctx.fillRect(i, j, size, size);
                    }
                }
            }
            ctx.globalAlpha = 1;

            const accentGradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
            accentGradient.addColorStop(0, '#FF657518');
            accentGradient.addColorStop(0.5, '#FF657535');
            accentGradient.addColorStop(1, '#FF657518');
            
            ctx.fillStyle = accentGradient;
            ctx.fillRect(0, 0, canvas.width, 3);
            ctx.fillStyle = '#ffffff08';
            ctx.fillRect(0, 5, canvas.width, 1);
            ctx.fillStyle = '#ffffff04';
            ctx.fillRect(0, 7, canvas.width, 1);

            const drawCornerAccent = (x, y, rotation) => {
                ctx.save();
                ctx.translate(x, y);
                ctx.rotate(rotation * Math.PI / 180);
                
                const glowGradient = ctx.createLinearGradient(0, 0, 45, 0);
                glowGradient.addColorStop(0, '#FF657515');
                glowGradient.addColorStop(1, '#FF657500');
                ctx.fillStyle = glowGradient;
                ctx.fillRect(-2, -2, 44, 44);
                
                const cornerGradient = ctx.createLinearGradient(0, 0, 40, 0);
                cornerGradient.addColorStop(0, '#FF657530');
                cornerGradient.addColorStop(1, '#FF657500');
                
                ctx.fillStyle = cornerGradient;
                ctx.fillRect(0, 0, 40, 2);
                ctx.fillRect(0, 0, 2, 40);
                
                ctx.fillStyle = '#ffffff10';
                ctx.fillRect(4, 4, 30, 1);
                ctx.fillRect(4, 4, 1, 30);
                
                ctx.restore();
            };

            drawCornerAccent(0, 0, 0);
            drawCornerAccent(canvas.width, 0, 90);
            drawCornerAccent(canvas.width, canvas.height, 180);
            drawCornerAccent(0, canvas.height, 270);

            try {
                const avatar = await loadImage(targetUser.displayAvatarURL({ extension: 'jpg', size: 512 }));
                
                const centerX = 140;
                const centerY = 160;
                const radius = 64;

                const outerGlow = ctx.createRadialGradient(centerX, centerY, radius - 5, centerX, centerY, radius + 30);
                outerGlow.addColorStop(0, '#FF657515');
                outerGlow.addColorStop(0.5, '#FF657508');
                outerGlow.addColorStop(1, '#FF657500');
                ctx.fillStyle = outerGlow;
                ctx.beginPath();
                ctx.arc(centerX, centerY, radius + 30, 0, Math.PI * 2);
                ctx.fill();

                ctx.save();
                ctx.fillStyle = '#ffffff05';
                ctx.filter = 'blur(15px)';
                ctx.beginPath();
                ctx.arc(centerX, centerY, radius + 5, 0, Math.PI * 2);
                ctx.fill();
                ctx.filter = 'none';
                ctx.restore();

                ctx.save();
                ctx.beginPath();
                ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
                ctx.clip();
                ctx.fillStyle = '#00000030';
                ctx.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2);
                ctx.restore();

                ctx.save();
                ctx.beginPath();
                ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
                ctx.closePath();
                ctx.clip();
                
                const zoomFactor = 0.95;
                const zoomedSize = radius * 2 / zoomFactor;
                const offset = (zoomedSize - radius * 2) / 2;
                ctx.drawImage(
                    avatar, 
                    centerX - radius - offset, 
                    centerY - radius - offset, 
                    zoomedSize, 
                    zoomedSize
                );
                ctx.restore();

                ctx.strokeStyle = '#ffffff20';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
                ctx.stroke();

                ctx.strokeStyle = '#FF657525';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(centerX, centerY, radius + 4, 0, Math.PI * 2);
                ctx.stroke();

                const innerGlow = ctx.createRadialGradient(
                    centerX - radius * 0.5, 
                    centerY - radius * 0.5, 
                    0, 
                    centerX, 
                    centerY, 
                    radius * 1.5
                );
                innerGlow.addColorStop(0, '#ffffff15');
                innerGlow.addColorStop(1, '#ffffff00');
                ctx.fillStyle = innerGlow;
                ctx.beginPath();
                ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
                ctx.fill();

                const drawAccentDot = (angle, size) => {
                    const distance = radius + 12;
                    const x = centerX + Math.cos(angle) * distance;
                    const y = centerY + Math.sin(angle) * distance;
                    
                    ctx.beginPath();
                    ctx.arc(x, y, size, 0, Math.PI * 2);
                    ctx.fillStyle = '#FF657530';
                    ctx.fill();
                };

                for (let i = 0; i < 4; i++) {
                    drawAccentDot(i * Math.PI / 2, 2);
                }

            } catch (error) {
                console.error('Error loading avatar:', error);
            }

            const displayName = targetUser.username.toUpperCase();
            ctx.font = 'bold 34px "Arial"';
            ctx.textAlign = 'left';
            
            ctx.fillStyle = '#00000050';
            ctx.fillText(displayName, 252, 102);
            
            ctx.fillStyle = '#FFFFFF';
            ctx.fillText(displayName, 250, 100);

            if (targetUser.discriminator && targetUser.discriminator !== '0') {
                ctx.font = '24px "Arial"';
                ctx.fillStyle = '#ffffff30';
                ctx.fillText(`#${targetUser.discriminator}`, 250 + ctx.measureText(displayName).width + 8, 100);
            }

            const drawBalanceCard = (x, y, width, height, title, amount, color) => {
                ctx.save();
                
                const cardGradient = ctx.createLinearGradient(x, y, x, y + height);
                cardGradient.addColorStop(0, '#ffffff0a');
                cardGradient.addColorStop(0.5, '#ffffff07');
                cardGradient.addColorStop(1, '#ffffff04');
                ctx.fillStyle = cardGradient;
                ctx.beginPath();
                ctx.roundRect(x, y, width, height, 16);
                ctx.fill();

                const innerShadow = ctx.createLinearGradient(x, y, x, y + height);
                innerShadow.addColorStop(0, '#00000025');
                innerShadow.addColorStop(0.5, '#00000015');
                innerShadow.addColorStop(1, '#00000005');
                ctx.fillStyle = innerShadow;
                ctx.beginPath();
                ctx.roundRect(x, y, width, height, 16);
                ctx.fill();

                ctx.strokeStyle = '#ffffff15';
                ctx.lineWidth = 2;
                ctx.stroke();
                
                ctx.strokeStyle = '#ffffff08';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.roundRect(x + 3, y + 3, width - 6, height - 6, 14);
                ctx.stroke();

                ctx.strokeStyle = '#ffffff04';
                ctx.beginPath();
                ctx.roundRect(x + 5, y + 5, width - 10, height - 10, 12);
                ctx.stroke();

                const glowGradient = ctx.createLinearGradient(x, y - 2, x + width, y - 2);
                glowGradient.addColorStop(0, `${color}10`);
                glowGradient.addColorStop(0.5, `${color}20`);
                glowGradient.addColorStop(1, `${color}10`);
                ctx.fillStyle = glowGradient;
                ctx.fillRect(x, y - 2, width, 7);

                const cardAccent = ctx.createLinearGradient(x, y, x + width, y);
                cardAccent.addColorStop(0, `${color}25`);
                cardAccent.addColorStop(0.5, `${color}40`);
                cardAccent.addColorStop(1, `${color}25`);
                ctx.fillStyle = cardAccent;
                ctx.fillRect(x, y, width, 3);

                const drawEnhancedDot = (dx, dy) => {
                    ctx.beginPath();
                    ctx.arc(dx, dy, 4, 0, Math.PI * 2);
                    ctx.fillStyle = `${color}15`;
                    ctx.fill();
                    ctx.beginPath();
                    ctx.arc(dx, dy, 2, 0, Math.PI * 2);
                    ctx.fillStyle = `${color}35`;
                    ctx.fill();
                };

                [[x + 12, y + 12], [x + width - 12, y + 12], 
                 [x + 12, y + height - 12], [x + width - 12, y + height - 12]].forEach(([dx, dy]) => {
                    drawEnhancedDot(dx, dy);
                });

                const titleGradient = ctx.createLinearGradient(x, y, x + width, y);
                titleGradient.addColorStop(0, '#ffffff75');
                titleGradient.addColorStop(0.5, '#ffffff95');
                titleGradient.addColorStop(1, '#ffffff75');
                
                ctx.font = 'bold 16px "Arial"';
                ctx.fillStyle = titleGradient;
                ctx.fillText(title.toUpperCase(), x + 24, y + 35);

                ctx.font = 'bold 36px "Arial"';
                const amountText = formatCurrency(amount);
                
                const shadowColors = ['#00000040', '#00000030', '#00000020'];
                shadowColors.forEach((shadowColor, i) => {
                    ctx.fillStyle = shadowColor;
                    ctx.fillText(amountText, x + 24 - i * 0.5, y + 82 - i * 0.5);
                });
                
                const amountGradient = ctx.createLinearGradient(x, y + 50, x, y + 90);
                amountGradient.addColorStop(0, color);
                amountGradient.addColorStop(0.5, shadeColor(color, 5));
                amountGradient.addColorStop(1, shadeColor(color, -10));
                ctx.fillStyle = amountGradient;
                ctx.fillText(amountText, x + 22, y + 80);

                const shineGradient = ctx.createLinearGradient(x, y + 50, x, y + 90);
                shineGradient.addColorStop(0, '#ffffff00');
                shineGradient.addColorStop(0.5, '#ffffff10');
                shineGradient.addColorStop(1, '#ffffff00');
                ctx.fillStyle = shineGradient;
                ctx.fillText(amountText, x + 22, y + 80);

                ctx.restore();
            };

            const shadeColor = (color, percent) => {
                const num = parseInt(color.replace('#', ''), 16);
                const amt = Math.round(2.55 * percent);
                const R = (num >> 16) + amt;
                const G = (num >> 8 & 0x00FF) + amt;
                const B = (num & 0x0000FF) + amt;
                return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
                    (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
                    (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
            };

            const formatCurrency = (num) => {
                const formatted = formatNumber(num);
                return formatted.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
            };

            drawBalanceCard(250, 130, 340, 100, 'Wallet Balance', user.balance, '#FF7085');
            drawBalanceCard(610, 130, 340, 100, 'Bank Balance', user.bank, '#5CD9FF');

            const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'balance.png' });
            return interaction.reply({ files: [attachment] });
        }
    },
};