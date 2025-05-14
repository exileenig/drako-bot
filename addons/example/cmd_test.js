const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('test')
        .setDescription(`Test command!`),
    async execute(interaction, client) {

        interaction.reply({ content: `This is a test slash command for the example addon! You can delete this in addons/example`, ephemeral: true })
    }
}