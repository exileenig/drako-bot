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
const yaml = require('js-yaml');
const config = yaml.load(fs.readFileSync('./config.yml', 'utf8'));
const lang = yaml.load(fs.readFileSync('./lang.yml', 'utf8'));

function convertSimplePatternToRegex(simplePattern) {
    let regexPattern = simplePattern
        .replace(/\./g, '\\.')
        .replace(/\*/g, '.*');
    return new RegExp(`^${regexPattern}$`, 'i');
}

async function checkBlacklistWords(content) {
    const blacklistRegex = config.BlacklistWords.Patterns.map(pattern => convertSimplePatternToRegex(pattern));
    return blacklistRegex.some(regex => regex.test(content));
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('8ball')
        .setDescription('Ask the bot a question')
        .addStringOption(option => option.setName('question').setDescription('The question to ask the bot').setRequired(true)),
    category: 'Fun',
    async execute(interaction, client) {
        try {
            let question = interaction.options.getString("question");

            if (await checkBlacklistWords(question)) {
                const blacklistMessage = lang.BlacklistWords && lang.BlacklistWords.Message
                    ? lang.BlacklistWords.Message.replace(/{user}/g, `${interaction.user}`)
                    : 'Your question contains blacklisted words.';
                return interaction.reply({ content: blacklistMessage, ephemeral: true });
            }

            let replies = lang.EightBallReplies;
            let result = Math.floor((Math.random() * replies.length));

            let ballembed = new EmbedBuilder()
                .setColor(config.EmbedColors)
                .setTitle(lang.EightBallTitle)
                .addFields([
                    { name: lang.EightBallQuestion, value: question },
                    { name: lang.EightBallAnswer, value: replies[result] },
                ])
                .setFooter({ text: lang.EightBallFooter, iconURL: interaction.user.avatarURL() })
                .setTimestamp();

            interaction.reply({ embeds: [ballembed] });

        } catch (error) {
            console.error("Error in 8ball command: ", error);
            interaction.reply({ content: 'Sorry, there was an error processing your question.', ephemeral: true });
        }
    }
};