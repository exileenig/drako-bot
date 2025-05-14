            { condition: true, fn: startTempBanScheduler, name: 'Tempban' },
            { condition: commandConfig.giveaway, fn: startGiveawayScheduler, name: 'Giveaway' },
            { condition: config.TicketSettings.Enabled, fn: () => setInterval(() => checkAndUpdateTicketStatus(client), 300000), name: 'Ticket' },
            { condition: true, fn: startInterestScheduler, name: 'Interest' },
            { condition: config.Alert?.Enabled, fn: () => startAlertScheduler(client), name: 'Alert' },
            {
                condition: config.Backup?.Enabled,
                fn: () => {
                    async function runBackup() {
                        const guild = client.guilds.cache.get(config.GuildID);
                        if (guild) {
                            await createAutoBackup(guild, client);
                        }
                    }

                    runBackup();

                    const scheduleTime = parseDuration(config.Backup.Schedule);
                    setInterval(runBackup, scheduleTime);
                },
                name: 'AutoBackup'
            }