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

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const yaml = require("js-yaml");
const config = yaml.load(fs.readFileSync('./config.yml', 'utf8'));
const lang = yaml.load(fs.readFileSync('./lang.yml', 'utf8'));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('snipe')
        .setDescription('Retrieve the last deleted or edited message')
        .addSubcommand(subcommand =>
            subcommand
                .setName('message')
                .setDescription('Get the last deleted message'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('edited')
                .setDescription('Get the last edited message')),
    category: 'General',
    async execute(interaction, client) {
        const subCommand = interaction.options.getSubcommand();
        const snipeMsg = client.snipes.get(interaction.guildId)?.get(interaction.channelId);

        if (!snipeMsg) {
            return interaction.reply({ content: lang.SnipeNoMsg, ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setAuthor({ name: `${snipeMsg.author}`, iconURL: `${snipeMsg.member.user.displayAvatarURL()}` })
            .setColor(config.EmbedColors)
            .setTimestamp(snipeMsg.timestamp);

        if (subCommand === 'edited' && snipeMsg.edited) {
            embed.addFields([
                { name: "Original Message", value: snipeMsg.oldContent || "No content" },
                { name: "Edited Message", value: snipeMsg.newContent || "No content" }
            ]);
        } else if (subCommand === 'message' && !snipeMsg.edited) {
            embed.setDescription(snipeMsg.content);
        } else {
            return interaction.reply({ content: 'No relevant sniped message found.', ephemeral: true });
        }

        return interaction.reply({ embeds: [embed], ephemeral: true });
    }
};