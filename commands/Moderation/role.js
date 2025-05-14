const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const yaml = require("js-yaml");
const config = yaml.load(fs.readFileSync('./config.yml', 'utf8'));
const lang = yaml.load(fs.readFileSync('./lang.yml', 'utf8'));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('role')
        .setDescription('Add or remove roles from users')
        .addStringOption(option =>
            option.setName('action')
                .setDescription('The action to perform: add or remove')
                .setRequired(true)
                .addChoices(
                    { name: 'add', value: 'add' },
                    { name: 'remove', value: 'remove' }
                ))
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('The role to manage')
                .setRequired(true))
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to add/remove the role from')
                .setRequired(false))
        .addBooleanOption(option =>
            option.setName('all')
                .setDescription('Apply to all users? (Ignores user parameter if set to true)')
                .setRequired(false)),
    category: 'Moderation',
    async execute(interaction) {
        try {
            const action = interaction.options.getString('action');
            const role = interaction.options.getRole('role');
            const user = interaction.options.getUser('user');
            const applyToAll = interaction.options.getBoolean('all') ?? false;
            const member = interaction.member;

            const requiredRoles = applyToAll 
                ? config.ModerationRoles.roleall 
                : config.ModerationRoles.addrole;
            
            const hasModeratorRole = requiredRoles.some(roleId => member.roles.cache.has(roleId));
            const isAdministrator = member.permissions.has(PermissionsBitField.Flags.Administrator);

            if (!hasModeratorRole && !isAdministrator) {
                await interaction.reply({ content: lang.NoPermsMessage, ephemeral: true });
                return;
            }

            const botHighestRole = interaction.guild.members.resolve(interaction.client.user.id).roles.highest.position;
            const userHighestRole = member.roles.highest.position;
            const rolePosition = role.position;

            if (rolePosition >= botHighestRole) {
                await interaction.reply({ content: lang.AddRole.AddroleHighestRole, ephemeral: true });
                return;
            }

            if (rolePosition >= userHighestRole) {
                await interaction.reply({ content: lang.AddRole.AddroleUserRoleNotAbove, ephemeral: true });
                return;
            }

            if (!applyToAll) {
                if (!user) {
                    await interaction.reply({ content: 'Please specify a user or set "all" to true.', ephemeral: true });
                    return;
                }

                if (user.id === interaction.user.id) {
                    await interaction.reply({ content: lang.AddRole.AddroleSelfRole, ephemeral: true });
                    return;
                }

                const targetMember = await interaction.guild.members.fetch(user.id);
                const hasRole = targetMember.roles.cache.has(role.id);

                if (action === 'add' && hasRole) {
                    await interaction.reply({ content: lang.AddRole.AddroleAlreadyHave, ephemeral: true });
                    return;
                }

                try {
                    if (action === 'add') {
                        await targetMember.roles.add(role);
                        await interaction.reply({
                            content: lang.AddRole.AddroleSuccess.replace('{role}', role.toString()).replace('{user}', user.toString()),
                            ephemeral: true
                        });
                    } else {
                        await targetMember.roles.remove(role);
                        await interaction.reply({
                            content: lang.AddRole.RemoveroleSuccess.replace('{role}', role.toString()).replace('{user}', user.toString()),
                            ephemeral: true
                        });
                    }
                } catch (error) {
                    console.error(error);
                    await interaction.reply({ content: lang.AddRole.AddroleError, ephemeral: true });
                }
                return;
            }

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('confirm')
                        .setLabel('Confirm')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId('cancel')
                        .setLabel('Cancel')
                        .setStyle(ButtonStyle.Danger)
                );

            const confirmationMessage = action === 'add'
                ? lang.RoleAll.RoleAllConfirmationAdd.replace('{role}', role.toString())
                : lang.RoleAll.RoleAllConfirmationRemove.replace('{role}', role.toString());

            await interaction.reply({ content: confirmationMessage, components: [row], ephemeral: true });

            const filter = i => i.user.id === interaction.user.id;
            const collector = interaction.channel.createMessageComponentCollector({ filter, time: 15000 });

            collector.on('collect', async (i) => {
                if (i.customId === 'confirm') {
                    let cancelRequested = false;
                    const cancelRow = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId('cancel')
                                .setLabel('Cancel')
                                .setStyle(ButtonStyle.Danger)
                        );

                    await i.update({ content: lang.RoleAll.RoleAllInProgress, components: [cancelRow], ephemeral: true });

                    const members = await interaction.guild.members.fetch();
                    const totalMembers = members.size;
                    let processedMembers = 0;

                    for (const member of members.values()) {
                        if (cancelRequested) break;
                        if (!member.user.bot) {
                            const hasRole = member.roles.cache.has(role.id);
                            if ((action === 'add' && !hasRole) || (action === 'remove' && hasRole)) {
                                try {
                                    if (action === 'add') {
                                        await member.roles.add(role);
                                    } else {
                                        await member.roles.remove(role);
                                    }
                                } catch (error) {
                                    console.error(`Error processing member ${member.id}: ${error}`);
                                }
                            }
                            processedMembers++;
                            if (processedMembers % 15 === 0) {
                                await interaction.editReply({
                                    content: `Progress: ${processedMembers}/${totalMembers} members processed.`,
                                    components: [cancelRow],
                                    ephemeral: true
                                });
                            }
                            await new Promise(resolve => setTimeout(resolve, 50));
                        }
                    }

                    const successMessage = action === 'add'
                        ? lang.RoleAll.RoleAllSuccessAdd.replace('{role}', role.toString())
                        : lang.RoleAll.RoleAllSuccessRemove.replace('{role}', role.toString());

                    await interaction.editReply({ content: successMessage, components: [], ephemeral: true });
                } else {
                    await i.update({ content: lang.RoleAll.RoleAllCancelled, components: [], ephemeral: true });
                }
            });

            collector.on('end', async (collected) => {
                if (!collected.size) {
                    await interaction.editReply({ content: lang.RoleAll.RoleAllTimeOut, components: [], ephemeral: true });
                }
            });

        } catch (error) {
            console.error(`Error in role management command: ${error}`);
            await interaction.reply({ content: 'An error occurred while processing your request.', ephemeral: true });
        }
    }
};