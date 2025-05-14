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

const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { createCanvas } = require('canvas');
const fs = require('fs');
const yaml = require('js-yaml');

let config, lang;
try {
    config = yaml.load(fs.readFileSync('./config.yml', 'utf8'));
    lang = yaml.load(fs.readFileSync('././lang.yml', 'utf8'));
} catch (error) {
    console.error('Error loading configuration files:', error);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('connectfour')
        .setDescription('Play Connect Four against a bot or another player!')
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Choose game type')
                .setRequired(true)
                .addChoices(
                    { name: 'Bot', value: 'bot' },
                    { name: 'Player', value: 'player' }
                )
        )
        .addStringOption(option =>
            option.setName('difficulty')
                .setDescription('Choose difficulty level (only for bot)')
                .addChoices(
                    { name: 'Easy', value: 'easy' },
                    { name: 'Medium', value: 'medium' },
                    { name: 'Hard', value: 'hard' }
                )
        )
        .addUserOption(option =>
            option.setName('opponent')
                .setDescription('Choose an opponent (required if playing against another player)')
        )
        .setDMPermission(false),
    category: 'Fun',
    async execute(interaction) {
        try {
            const gameType = interaction.options.getString('type');
            const opponent = interaction.options.getUser('opponent');
            const difficulty = interaction.options.getString('difficulty') || 'medium';

            if (gameType === 'player' && !opponent) {
                return interaction.reply({ content: 'You must specify an opponent when playing against another player.', ephemeral: true });
            }

            if (gameType === 'player') {
                await requestOpponentConfirmation(interaction, opponent, difficulty);
            } else {
                await startGame(interaction, gameType, opponent, difficulty);
            }
        } catch (error) {
            console.error('Error executing command:', error);
            await interaction.reply({ content: 'An error occurred while starting the game. Please try again later.', ephemeral: true });
        }
    },
};

async function requestOpponentConfirmation(interaction, opponent, difficulty) {
    const confirmationEmbed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('Connect Four Game Request')
        .setDescription(`${interaction.user} has challenged you to a game of Connect Four. Do you accept?`)
        .setFooter({ text: 'This request will expire in 60 seconds.' });

    const confirmButton = new ButtonBuilder()
        .setCustomId('accept_game')
        .setLabel('Accept')
        .setStyle(ButtonStyle.Success);

    const declineButton = new ButtonBuilder()
        .setCustomId('decline_game')
        .setLabel('Decline')
        .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(confirmButton, declineButton);

    const reply = await interaction.reply({
        content: `${opponent}, you've been challenged to a game of Connect Four!`,
        embeds: [confirmationEmbed],
        components: [row],
        fetchReply: true
    });

    const collector = reply.createMessageComponentCollector({ time: 60000 });

    collector.on('collect', async i => {
        if (i.user.id !== opponent.id) {
            await i.reply({ content: 'This confirmation is not for you.', ephemeral: true });
            return;
        }

        if (i.customId === 'accept_game') {
            await i.update({ content: 'Game accepted! Starting now...', components: [] });
            await startGame(interaction, 'player', opponent, difficulty);
        } else if (i.customId === 'decline_game') {
            await i.update({ content: 'Game declined.', components: [] });
            await interaction.followUp({ content: `${opponent} has declined the game.` });
        }

        collector.stop();
    });

    collector.on('end', async (collected, reason) => {
        if (reason === 'time' && collected.size === 0) {
            await interaction.editReply({ content: 'The game request has expired.', components: [] });
        }
    });
}

async function startGame(interaction, gameType, opponent, difficulty) {
    try {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply();
        }

        const blankBoardEmoji = lang.Connectfour.Board.Emojis.Blank;
        const playerEmoji = lang.Connectfour.Board.Emojis.Player;
        const botEmoji = lang.Connectfour.Board.Emojis.Bot;
        const gameBoard = Array(6).fill().map(() => Array(7).fill(blankBoardEmoji));
        const gameId = `connectfour-${Date.now()}-${interaction.user.id}`;

        let currentPlayerId = interaction.user.id;
        let lastMove = { row: null, col: null };

        const attachment = await createGameBoardCanvas(gameBoard, playerEmoji, botEmoji, blankBoardEmoji, lastMove, null);

        await interaction.editReply({
            content: createGameMessage(interaction.user.username, gameBoard, currentPlayerId, interaction.user, opponent),
            files: [attachment],
            components: createBoardComponents(gameId, false),
        });

        const message = await interaction.fetchReply();
        const collector = message.createMessageComponentCollector({
            time: 600000,
            filter: i => i.customId.startsWith(gameId) && (i.user.id === interaction.user.id || (opponent && i.user.id === opponent.id))
        });

        let nextPlayerId = gameType === 'bot' ? 'bot' : opponent.id;

        collector.on('collect', async i => {
            try {
                await i.deferUpdate();

                if (i.user.id !== currentPlayerId) {
                    await i.followUp({ content: 'It is not your turn!', ephemeral: true });
                    return;
                }

                const parts = i.customId.split('_');
                const column = parseInt(parts[2]);

                lastMove = { row: null, col: column };

                if (!makeMove(gameBoard, column, currentPlayerId === interaction.user.id ? playerEmoji : botEmoji, lastMove)) {
                    await i.followUp({ content: 'This column is full!', ephemeral: true });
                    return;
                }

                let winningCoordinates = checkWin(gameBoard, currentPlayerId === interaction.user.id ? playerEmoji : botEmoji);

                if (winningCoordinates) {
                    await endGame(interaction, i.message, `${i.user.username} has won!`, gameBoard, playerEmoji, botEmoji, blankBoardEmoji, lastMove, winningCoordinates);
                    collector.stop();
                    return;
                } else if (isBoardFull(gameBoard)) {
                    await endGame(interaction, i.message, "It's a draw!", gameBoard, playerEmoji, botEmoji, blankBoardEmoji, lastMove, null);
                    collector.stop();
                    return;
                }

                if (gameType === 'bot' && currentPlayerId !== 'bot') {
                    await botMove(gameBoard, botEmoji, playerEmoji, difficulty, lastMove);
                    winningCoordinates = checkWin(gameBoard, botEmoji);

                    if (winningCoordinates) {
                        await endGame(interaction, i.message, 'Bot has won!', gameBoard, playerEmoji, botEmoji, blankBoardEmoji, lastMove, winningCoordinates);
                        collector.stop();
                        return;
                    } else if (isBoardFull(gameBoard)) {
                        await endGame(interaction, i.message, "It's a draw!", gameBoard, playerEmoji, botEmoji, blankBoardEmoji, lastMove, null);
                        collector.stop();
                        return;
                    }
                    currentPlayerId = interaction.user.id;
                } else {
                    [currentPlayerId, nextPlayerId] = [nextPlayerId, currentPlayerId];
                }

                const attachment = await createGameBoardCanvas(gameBoard, playerEmoji, botEmoji, blankBoardEmoji, lastMove, null);
                await i.editReply({
                    content: createGameMessage(interaction.user.username, gameBoard, currentPlayerId, interaction.user, opponent),
                    files: [attachment],
                    components: createBoardComponents(gameId, false)
                });
            } catch (error) {
                console.error('Error handling interaction:', error);
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: 'An error occurred while processing your move. Please try again.', ephemeral: true });
                } else {
                    await interaction.followUp({ content: 'An error occurred while processing your move. Please try again.', ephemeral: true });
                }
            }
        });
    } catch (error) {
        console.error('Error starting the game:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: 'An error occurred while setting up the game. Please try again later.', ephemeral: true });
        } else {
            await interaction.followUp({ content: 'An error occurred while setting up the game. Please try again later.', ephemeral: true });
        }
    }
}

async function createGameBoardCanvas(board, playerEmoji, botEmoji, blankEmoji, lastMove, winningCoordinates) {
    const canvas = createCanvas(700, 600);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const cellSize = 80;
    const boardWidth = 7 * cellSize;
    const boardHeight = 6 * cellSize;
    const boardX = (canvas.width - boardWidth) / 2;
    const boardY = (canvas.height - boardHeight) / 2;

    ctx.fillStyle = '#16213e';
    roundRect(ctx, boardX - 10, boardY - 10, boardWidth + 20, boardHeight + 20, 15, true);

    for (let row = 0; row < 6; row++) {
        for (let col = 0; col < 7; col++) {
            const x = boardX + col * cellSize + cellSize / 2;
            const y = boardY + row * cellSize + cellSize / 2;

            ctx.fillStyle = '#0f3460';
            ctx.beginPath();
            ctx.arc(x, y, cellSize / 2 - 5, 0, 2 * Math.PI);
            ctx.fill();

            if (board[row][col] === playerEmoji) {
                drawPiece(ctx, x, y, cellSize / 2 - 8, '#e94560');
            } else if (board[row][col] === botEmoji) {
                drawPiece(ctx, x, y, cellSize / 2 - 8, '#00bfff');
            }
        }
    }

    if (lastMove && lastMove.row !== null && lastMove.col !== null) {
        const x = boardX + lastMove.col * cellSize + cellSize / 2;
        const y = boardY + lastMove.row * cellSize + cellSize / 2;
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(x, y, cellSize / 2, 0, 2 * Math.PI);
        ctx.stroke();
    }

    if (winningCoordinates) {
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 6;
        ctx.setLineDash([10, 10]);
        ctx.beginPath();
        const startX = boardX + winningCoordinates[0].col * cellSize + cellSize / 2;
        const startY = boardY + winningCoordinates[0].row * cellSize + cellSize / 2;
        ctx.moveTo(startX, startY);
        for (const { row, col } of winningCoordinates) {
            const x = boardX + col * cellSize + cellSize / 2;
            const y = boardY + row * cellSize + cellSize / 2;
            ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
    }

    ctx.strokeStyle = '#e94560';
    ctx.lineWidth = 4;
    roundRect(ctx, 10, 10, canvas.width - 20, canvas.height - 20, 20, false, true);

    const buffer = canvas.toBuffer('image/png');
    return new AttachmentBuilder(buffer, { name: 'connect-four.png' });
}

function drawPiece(ctx, x, y, radius, color) {
    const gradient = ctx.createRadialGradient(x - radius / 3, y - radius / 3, radius / 10, x, y, radius);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, shadeColor(color, -20));
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.fill();

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 5;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 3;
    ctx.beginPath();
    ctx.arc(x, y, radius - 2, 0, 2 * Math.PI);
    ctx.clip();
    ctx.fillStyle = 'rgba(0,0,0,0)';
    ctx.fill();
    ctx.restore();
}

function roundRect(ctx, x, y, width, height, radius, fill = false, stroke = false) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.closePath();
    if (fill) {
        ctx.fill();
    }
    if (stroke) {
        ctx.stroke();
    }
}

function shadeColor(color, percent) {
    const num = parseInt(color.replace("#", ""), 16),
        amt = Math.round(2.55 * percent),
        R = (num >> 16) + amt,
        G = (num >> 8 & 0x00FF) + amt,
        B = (num & 0x0000FF) + amt;
    return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
        (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
        (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
}

function createBoardComponents(gameId, disabled) {
    try {
        const rows = [];

        for (let i = 0; i < 7; i += 5) {
            const actionRow = new ActionRowBuilder();
            for (let j = i; j < i + 5 && j < 7; j++) {
                actionRow.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`${gameId}_column_${j}`)
                        .setStyle(ButtonStyle.Primary)
                        .setLabel((j + 1).toString())
                        .setDisabled(disabled)
                );
            }
            rows.push(actionRow);
        }

        return rows;
    } catch (error) {
        console.error('Error creating board components:', error);
        throw new Error('Could not create board components.');
    }
}

function makeMove(board, column, piece, lastMove) {
    try {
        for (let row = board.length - 1; row >= 0; row--) {
            if (board[row][column] === lang.Connectfour.Board.Emojis.Blank) {
                board[row][column] = piece;
                lastMove.row = row;
                return true;
            }
        }
        return false;
    } catch (error) {
        console.error('Error making move:', error);
        return false;
    }
}

async function botMove(board, botPiece, playerPiece, difficulty) {
    try {
        const move = findBestMove(board, botPiece, playerPiece, difficulty);
        if (move !== null) {
            makeMove(board, move, botPiece, {});
        }
    } catch (error) {
        console.error('Error in bot move:', error);
    }
}

function findBestMove(board, botPiece, playerPiece, difficulty) {
    try {
        const validMoves = [];
        for (let col = 0; col < 7; col++) {
            if (board[0][col] === lang.Connectfour.Board.Emojis.Blank) {
                validMoves.push(col);
            }
        }

        if (validMoves.length === 0) return null;

        if (difficulty === 'easy') {
            return validMoves[Math.floor(Math.random() * validMoves.length)];
        }

        if (difficulty === 'medium') {
            for (const col of validMoves) {
                const tempBoard = board.map(row => row.slice());
                makeMove(tempBoard, col, botPiece, {});
                if (checkWin(tempBoard, botPiece)) return col;
            }

            for (const col of validMoves) {
                const tempBoard = board.map(row => row.slice());
                makeMove(tempBoard, col, playerPiece, {});
                if (checkWin(tempBoard, playerPiece)) return col;
            }

            return validMoves[Math.floor(Math.random() * validMoves.length)];
        }

        if (difficulty === 'hard') {
            let bestScore = -Infinity;
            let bestMove = null;

            for (const col of validMoves) {
                const tempBoard = board.map(row => row.slice());
                makeMove(tempBoard, col, botPiece, {});
                const score = minimax(tempBoard, 3, false, botPiece, playerPiece);
                if (score > bestScore) {
                    bestScore = score;
                    bestMove = col;
                }
            }

            return bestMove;
        }

        return validMoves[Math.floor(Math.random() * validMoves.length)];
    } catch (error) {
        console.error('Error finding best move:', error);
        return null;
    }
}

function minimax(board, depth, isMaximizing, botPiece, playerPiece) {
    try {
        if (depth === 0 || checkWin(board, botPiece) || checkWin(board, playerPiece)) {
            return scorePosition(board, botPiece);
        }

        const validMoves = [];
        for (let col = 0; col < 7; col++) {
            if (board[0][col] === lang.Connectfour.Board.Emojis.Blank) {
                validMoves.push(col);
            }
        }

        if (isMaximizing) {
            let bestScore = -Infinity;
            for (const col of validMoves) {
                const tempBoard = board.map(row => row.slice());
                makeMove(tempBoard, col, botPiece, {});
                const score = minimax(tempBoard, depth - 1, false, botPiece, playerPiece);
                bestScore = Math.max(score, bestScore);
            }
            return bestScore;
        } else {
            let bestScore = Infinity;
            for (const col of validMoves) {
                const tempBoard = board.map(row => row.slice());
                makeMove(tempBoard, col, playerPiece, {});
                const score = minimax(tempBoard, depth - 1, true, botPiece, playerPiece);
                bestScore = Math.min(score, bestScore);
            }
            return bestScore;
        }
    } catch (error) {
        console.error('Error in minimax function:', error);
        return 0;
    }
}

function scorePosition(board, piece) {
    try {
        let score = 0;
        const opponentPiece = piece === lang.Connectfour.Board.Emojis.Bot ? lang.Connectfour.Board.Emojis.Player : lang.Connectfour.Board.Emojis.Bot;

        const centerColumn = board.map(row => row[3]);
        const centerCount = centerColumn.filter(cell => cell === piece).length;
        score += centerCount * 3;

        score += evaluateLines(board, piece);
        score -= evaluateLines(board, opponentPiece);

        return score;
    } catch (error) {
        console.error('Error scoring position:', error);
        return 0;
    }
}

function evaluateLines(board, piece) {
    try {
        let score = 0;
        const directions = [
            { x: 0, y: 1 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 1, y: -1 }
        ];

        for (let row = 0; row < board.length; row++) {
            for (let col = 0; col < board[0].length; col++) {
                if (board[row][col] === piece) {
                    for (const { x, y } of directions) {
                        let count = 0;
                        for (let step = 0; step < 4; step++) {
                            const newRow = row + step * x;
                            const newCol = col + step * y;
                            if (board[newRow] && board[newRow][newCol] === piece) {
                                count++;
                            } else {
                                break;
                            }
                        }
                        if (count === 4) score += 100;
                        else if (count === 3) score += 10;
                        else if (count === 2) score += 1;
                    }
                }
            }
        }

        return score;
    } catch (error) {
        console.error('Error evaluating lines:', error);
        return 0;
    }
}

function checkWin(board, piece) {
    try {
        const directions = [
            { x: 0, y: 1 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 1, y: -1 }
        ];

        for (let row = 0; row < board.length; row++) {
            for (let col = 0; col < board[0].length; col++) {
                if (board[row][col] === piece) {
                    for (const { x, y } of directions) {
                        const winningCoordinates = [];
                        for (let step = 0; step < 4; step++) {
                            const newRow = row + step * x;
                            const newCol = col + step * y;
                            if (board[newRow] && board[newRow][newCol] === piece) {
                                winningCoordinates.push({ row: newRow, col: newCol });
                            } else {
                                break;
                            }
                        }
                        if (winningCoordinates.length === 4) return winningCoordinates;
                    }
                }
            }
        }
        return null;
    } catch (error) {
        console.error('Error checking win:', error);
        return null;
    }
}

function isBoardFull(board) {
    try {
        return board.every(row => row.every(cell => cell !== lang.Connectfour.Board.Emojis.Blank));
    } catch (error) {
        console.error('Error checking if board is full:', error);
        return false;
    }
}

async function endGame(interaction, message, resultMessage, gameBoard, playerEmoji, botEmoji, blankEmoji, lastMove, winningCoordinates) {
    try {
        const attachment = await createGameBoardCanvas(gameBoard, playerEmoji, botEmoji, blankEmoji, lastMove, winningCoordinates);
        const winner = resultMessage.includes('won') ? resultMessage.split(' ')[0] : 'No one';

        const embed = new EmbedBuilder()
            .setColor(resultMessage.includes('won') ? lang.Connectfour.Colors.Win : lang.Connectfour.Colors.Tie)
            .setTitle(lang.Connectfour.Embed.Title)
            .setDescription(lang.Connectfour.Embed.Description.replace("{user}", winner))
            .setFooter({ text: lang.Connectfour.Embed.Footer });

        await message.edit({ files: [attachment], embeds: [embed], components: [] });
    } catch (error) {
        console.error('Error ending game:', error);
        await interaction.followUp({ content: 'An error occurred while ending the game. Please try again.', ephemeral: true });
    }
}

function createGameMessage(username, board, currentPlayer, user, opponent) {
    try {
        const currentTurn = currentPlayer === user.id ? user.username : (opponent ? opponent.username : 'Bot');
        return lang.Connectfour.Title.replace("{user}", currentTurn);
    } catch (error) {
        console.error('Error creating game message:', error);
        return 'Error creating game message.';
    }
}