﻿/*
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

module.exports = {
    owner: true,
    data: new SlashCommandBuilder()
        .setName('botavatar')
        .setDescription('Set your bots profile picture')
        .addAttachmentOption(option => option
            .setName('avatar')
            .setDescription('The gif file')
            .setRequired(true)),
    category: 'General',
    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true });

        if (!hasAdministratorPermissions(interaction)) {
            await sendReply(interaction, "⛔ | You don't have permissions to use this command!");
            return;
        }

        const avatar = interaction.options.getAttachment('avatar');
        if (!isValidGifImage(avatar)) {
            await sendReply(interaction, "⚠️ | Please provide a GIF image.");
            return;
        }

        try {
            await client.user.setAvatar(avatar.url);
            await sendReply(interaction, "✅ | Bot avatar uploaded.");
        } catch (error) {
            console.error(error);
            await sendReply(interaction, `❌ | An error occurred: ${error.message}`);
        }
    }
};

function hasAdministratorPermissions(interaction) {
    return interaction.member.permissions.has('Administrator');
}

function isValidGifImage(avatar) {
    return avatar.contentType && avatar.contentType === "image/gif";
}

async function sendReply(interaction, message) {
    await interaction.followUp({ content: message });
}