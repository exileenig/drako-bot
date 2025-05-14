const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../../../models/UserData');
const fs = require('fs');
const yaml = require("js-yaml");
const config = yaml.load(fs.readFileSync('./config.yml', 'utf8'));
const lang = yaml.load(fs.readFileSync('./lang.yml', 'utf8'));
const parseDuration = require('./Utility/parseDuration');
const { checkActiveBooster, replacePlaceholders } = require('./Utility/helpers');

function getRandomMessage(messages) {
    return messages[Math.floor(Math.random() * messages.length)];
}

function weightedRandomChoice(items, weightFn) {
    const totalWeight = items.reduce((sum, item) => sum + weightFn(item), 0);
    let random = Math.random() * totalWeight;
    for (const item of items) {
        random -= weightFn(item);
        if (random <= 0) return item;
    }
    return items[items.length - 1];
}

function getFishingRod(user) {
    if (user.equipment && user.equipment.FishingRod) {
        const rod = Object.values(config.Store.Equipment).find(item => item.Name === user.equipment.FishingRod);
        return rod;
    }
    return null;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('fish')
        .setDescription('Go fishing and catch some fish!')
        .addStringOption(option => {
            option.setName('location')
                .setDescription('Choose where to fish')
                .setRequired(true);
            
            for (const [locationKey, locationData] of Object.entries(config.Economy.Fishing.locations)) {
                option.addChoices({
                    name: `${locationKey.charAt(0).toUpperCase() + locationKey.slice(1)} (Cost: ${locationData.cost})`,
                    value: locationKey
                });
            }
            
            return option;
        }),
    category: 'Economy',
    async execute(interaction) {
        try {
            let user = await User.findOne(
                { userId: interaction.user.id, guildId: interaction.guild.id },
                { balance: 1, 'commandData.lastFishing': 1, transactionLogs: 1, boosters: 1, equipment: 1 }
            );

            if (!user) {
                user = new User({
                    userId: interaction.user.id,
                    guildId: interaction.guild.id,
                    balance: 0,
                    commandData: {},
                    boosters: [],
                    equipment: {}
                });
            }

            const now = Date.now();
            const fishingRod = getFishingRod(user);
            const cooldown = parseDuration(config.Economy.Fishing.cooldown);
            const rodCooldownReduction = fishingRod ? fishingRod.CooldownReduction : 0;
            const adjustedCooldown = Math.max(0, cooldown - rodCooldownReduction);

            if (user.commandData.lastFishing) {
                const lastFishingTime = typeof user.commandData.lastFishing === 'number' 
                    ? user.commandData.lastFishing 
                    : user.commandData.lastFishing.getTime();
                const nextFishingTime = lastFishingTime + adjustedCooldown;

                if (now < nextFishingTime) {
                    const timeLeft = Math.ceil((nextFishingTime - now) / 1000);

                    const embed = new EmbedBuilder()
                        .setDescription(replacePlaceholders(lang.Economy.Messages.cooldown, { nextUse: Math.floor(nextFishingTime / 1000) }))
                        .setColor('#FF0000')
                        .setFooter({ text: replacePlaceholders(lang.Economy.Messages.footer, { balance: user.balance }) });
                    return interaction.reply({ embeds: [embed] });
                }
            }

            const location = interaction.options.getString('location');
            const locationConfig = config.Economy.Fishing.locations[location];

            if (user.balance < locationConfig.cost) {
                const embed = new EmbedBuilder()
                    .setDescription(lang.Economy.Messages.noMoney)
                    .setColor('#FF0000');
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            user.balance -= locationConfig.cost;

            const catchBonus = fishingRod ? fishingRod.CatchBonus : 1;
            const luckBonus = fishingRod ? fishingRod.LuckBonus : 1;

            const moneyBooster = checkActiveBooster(user, 'Money');
            const fishingLuckBooster = checkActiveBooster(user, 'FishingLuck');
            const totalLuckBonus = luckBonus * fishingLuckBooster;

            const caughtFish = weightedRandomChoice(locationConfig.fish, fish => fish.chance * totalLuckBonus);
            const reward = Math.floor(Math.random() * (caughtFish.maxReward - caughtFish.minReward + 1) + caughtFish.minReward);
            const finalReward = Math.floor(reward * catchBonus * moneyBooster);

            user.balance += finalReward;
            user.commandData.lastFishing = now;
            user.transactionLogs.push({
                type: 'fishing',
                amount: finalReward,
                timestamp: now
            });

            await user.save();

            const placeholders = {
                user: `<@${interaction.user.id}>`,
                fish: caughtFish.name,
                reward: finalReward,
                location: location,
                nextUse: Math.floor((now + adjustedCooldown) / 1000),
                rod: fishingRod ? fishingRod.Name : lang.Economy.Activities.Fishing.noRod
            };

            const fishingMessage = replacePlaceholders(getRandomMessage(lang.Economy.Activities.Fishing.Messages), placeholders);

            const embed = new EmbedBuilder()
                .setTitle(lang.Economy.Activities.Fishing.Title)
                .setColor('#00FF00')
                .setDescription(fishingMessage)
                .addFields(
                    { name: lang.Economy.Messages.catch, value: caughtFish.name, inline: true },
                    { name: lang.Economy.Messages.reward, value: finalReward.toString(), inline: true },
                    { name: lang.Economy.Activities.Fishing.rodUsed, value: placeholders.rod, inline: true }
                )
                .setFooter({ text: replacePlaceholders(lang.Economy.Messages.footer, { balance: user.balance }) });

            if (fishingRod) {
                embed.addFields(
                    { name: lang.Economy.Activities.Fishing.catchBonus, value: `${(catchBonus * 100 - 100).toFixed(0)}%`, inline: true },
                    { name: lang.Economy.Activities.Fishing.luckBonus, value: `${(totalLuckBonus * 100 - 100).toFixed(0)}%`, inline: true },
                    { name: lang.Economy.Activities.Fishing.cooldownReduction, value: `${(fishingRod.CooldownReduction / 1000).toFixed(0)}s`, inline: true }
                );
            }

            if (fishingLuckBooster > 1) {
                embed.addFields(
                    { name: lang.Economy.Activities.Fishing.activeLuckBooster, value: `${((fishingLuckBooster - 1) * 100).toFixed(0)}%`, inline: true }
                );
            }

            if (moneyBooster > 1) {
                embed.addFields(
                    { name: lang.Economy.Activities.Fishing.activeMoneyBooster, value: `${((moneyBooster - 1) * 100).toFixed(0)}%`, inline: true }
                );
            }

            interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error("Error in fishing command: ", error);
            interaction.reply({ content: lang.Economy.Messages.error, ephemeral: true });
        }
    }
};