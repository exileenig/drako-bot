const { ContextMenuCommandBuilder, ApplicationCommandType, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');

const config = yaml.load(fs.readFileSync(path.resolve(__dirname, '../../config.yml'), 'utf8'));

module.exports = {
    data: new ContextMenuCommandBuilder()
        .setName('Report Message')
        .setType(ApplicationCommandType.Message),
    category: 'Moderation',
    async execute(interaction) {
        try {
            const message = interaction.targetMessage;
            
            const modal = new ModalBuilder()
                .setCustomId('report_modal')
                .setTitle('Report Message');

            const reasonInput = new TextInputBuilder()
                .setCustomId('report_reason')
                .setLabel('Why are you reporting this message?')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Enter your reason here...')
                .setRequired(true)
                .setMaxLength(1000);

            const firstActionRow = new ActionRowBuilder().addComponents(reasonInput);
            modal.addComponents(firstActionRow);

            await interaction.showModal(modal);

            const filter = (i) => i.customId === 'report_modal';
            try {
                const submission = await interaction.awaitModalSubmit({ filter, time: 300000 }); // 5 minutes timeout
                
                const reason = submission.fields.getTextInputValue('report_reason');
                const reportedUser = message.author;
                const reportingUser = interaction.user;
                
                if (!config.Report?.LogsChannelID || config.Report.LogsChannelID === "CHANNEL_ID") {
                    await submission.reply({ 
                        content: 'Reports are currently disabled.', 
                        ephemeral: true 
                    });
                    return;
                }

                const channel = interaction.guild.channels.cache.get(config.Report.LogsChannelID);
                if (!channel) {
                    await submission.reply({ 
                        content: 'Reports are currently disabled.', 
                        ephemeral: true 
                    });
                    return;
                }

                const embed = new EmbedBuilder()
                    .setTitle(config.Report.Embed.Title)
                    .setDescription(
                        config.Report.Embed.Description
                            .join('\n')
                            .replace('{user}', `<@${reportedUser.id}>`)
                            .replace('{message}', message.content || '*No message content*')
                            .replace('{timestamp}', new Date().toLocaleString())
                            .replace('{reportingUser}', `<@${reportingUser.id}>`)
                            .replace('{reason}', reason)
                            .replace('{channel}', `<#${message.channel.id}>`)
                            .replace('{messageUrl}', message.url)
                    )
                    .setColor(config.Report.Embed.Color)
                    .setTimestamp();

                if (config.Report.Embed.Footer.Text) {
                    embed.setFooter({ text: config.Report.Embed.Footer.Text });
                }

                const guildIcon = interaction.guild.iconURL();
                if (guildIcon && config.Report.Embed.Thumbnail.includes('{guildIcon}')) {
                    embed.setThumbnail(guildIcon);
                }

                await channel.send({ embeds: [embed] });
                await submission.reply({ 
                    content: 'Thank you for your report. The moderators have been notified.', 
                    ephemeral: true 
                });

            } catch (error) {
                if (error.code === 'InteractionCollectorError') {
                    return;
                } else {
                    console.error('Error in report modal submission:', error);
                }
            }

        } catch (error) {
            console.error('Error in report command:', error);
        }
    }
};