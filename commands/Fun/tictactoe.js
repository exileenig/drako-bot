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

const lang = yaml.load(fs.readFileSync('./lang.yml', 'utf8'));
const config = yaml.load(fs.readFileSync('./config.yml', 'utf8'));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tictactoe')
        .setDescription('Play Tic-Tac-Toe against a bot or another player!')
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
        const gameType = interaction.options.getString('type');
        const opponent = interaction.options.getUser('opponent');
        const difficulty = interaction.options.getString('difficulty') || 'medium';
        const emojis = {
            x: lang.TicTacToe.Board.Emojis.X,
            o: lang.TicTacToe.Board.Emojis.O,
            blank: lang.TicTacToe.Board.Emojis.Blank
        };

        const gameId = `ttt-${Date.now()}-${interaction.user.id}`;

        if (gameType === 'player' && !opponent) {
            return interaction.reply({ content: lang.TicTacToe.Messages.OwnGame, ephemeral: true });
        }

        await startGame(interaction, gameId, emojis, gameType === 'bot', opponent, difficulty);
    },
};

async function startGame(interaction, gameId, emojis, againstBot, opponent, difficulty) {
    const gameBoard = Array(3).fill().map(() => Array(3).fill(emojis.blank));
    const currentPlayer = interaction.user.id;

    const attachment = await createGameBoardCanvas(gameBoard, emojis);
    await interaction.reply({
        content: createGameMessage(interaction.user.username, gameBoard, currentPlayer, interaction.user, opponent),
        files: [attachment],
        components: createBoardComponents(gameBoard, emojis, gameId)
    });

    const message = await interaction.fetchReply();
    const originalMessageId = message.id;

    const collector = interaction.channel.createMessageComponentCollector({
        componentType: 2,
        time: 60000 * 5,
        filter: i => i.customId.startsWith(gameId) && (i.user.id === currentPlayer || (!againstBot && i.user.id === opponent.id))
    });

    let currentPlayerId = currentPlayer;
    let nextPlayerId = againstBot ? null : opponent.id;

    collector.on('collect', async i => {
        if (i.user.id !== currentPlayerId) {
            return i.reply({ content: 'It is not your turn!', ephemeral: true });
        }

        const parts = i.customId.split('-');
        const rowIndex = parseInt(parts[3], 10);
        const cellIndex = parseInt(parts[4], 10);

        if (typeof gameBoard[rowIndex] === 'undefined' || typeof gameBoard[rowIndex][cellIndex] === 'undefined') {
            return;
        }

        const symbol = currentPlayerId === interaction.user.id ? emojis.x : emojis.o;
        gameBoard[rowIndex][cellIndex] = symbol;

        const winningLine = checkWin(gameBoard, symbol);
        if (winningLine) {
            await endGame(interaction, i.message, `${i.user.username} has won!`, gameBoard, emojis, winningLine);
            collector.stop();
            return;
        } else if (isBoardFull(gameBoard, emojis.blank)) {
            await endGame(interaction, i.message, "It's a draw!", gameBoard, emojis);
            collector.stop();
            return;
        }

        if (againstBot) {
            smarterBotMove(gameBoard, emojis, difficulty);
            const botWinningLine = checkWin(gameBoard, emojis.o);
            if (botWinningLine) {
                await endGame(interaction, i.message, "Bot has won!", gameBoard, emojis, botWinningLine);
                collector.stop();
                return;
            } else if (isBoardFull(gameBoard, emojis.blank)) {
                await endGame(interaction, i.message, "It's a draw!", gameBoard, emojis);
                collector.stop();
                return;
            }
        } else {
            [currentPlayerId, nextPlayerId] = [nextPlayerId, currentPlayerId];
        }

        const newAttachment = await createGameBoardCanvas(gameBoard, emojis);
        await i.update({
            content: createGameMessage(interaction.user.username, gameBoard, currentPlayerId, interaction.user, opponent),
            files: [newAttachment],
            components: createBoardComponents(gameBoard, emojis, gameId)
        });
    });
}

async function createGameBoardCanvas(board, emojis, winningLine = null) {
    const canvas = createCanvas(500, 500);
    const ctx = canvas.getContext('2d');

    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#2C2F33');
    gradient.addColorStop(1, '#23272A');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const borderWidth = 10;
    const gameAreaSize = canvas.width - (borderWidth * 2);
    const cellSize = gameAreaSize / 3;

    ctx.strokeStyle = '#7289DA';
    ctx.lineWidth = 8;

    ctx.beginPath();
    for (let i = 1; i < 3; i++) {
        const pos = borderWidth + i * cellSize;
        ctx.moveTo(pos, borderWidth);
        ctx.lineTo(pos, canvas.height - borderWidth);
        ctx.moveTo(borderWidth, pos);
        ctx.lineTo(canvas.width - borderWidth, pos);
    }
    ctx.stroke();

    for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
            const x = borderWidth + c * cellSize;
            const y = borderWidth + r * cellSize;
            if (board[r][c] === emojis.x) {
                drawX(ctx, x, y, cellSize);
            } else if (board[r][c] === emojis.o) {
                drawO(ctx, x, y, cellSize);
            }
        }
    }

    if (winningLine) {
        ctx.strokeStyle = '#FAA61A';
        ctx.lineWidth = 10;
        ctx.lineCap = 'round';
        ctx.beginPath();
        const [[startRow, startCol], , [endRow, endCol]] = winningLine;

        const startX = borderWidth + (startCol + 0.5) * cellSize;
        const startY = borderWidth + (startRow + 0.5) * cellSize;
        const endX = borderWidth + (endCol + 0.5) * cellSize;
        const endY = borderWidth + (endRow + 0.5) * cellSize;

        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
    }

    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = borderWidth;
    roundRect(ctx, borderWidth / 2, borderWidth / 2, canvas.width - borderWidth, canvas.height - borderWidth, 20, false, true);

    const buffer = canvas.toBuffer();
    return new AttachmentBuilder(buffer, { name: 'tic-tac-toe.png' });
}

function drawX(ctx, x, y, size) {
    const padding = size * 0.2;
    ctx.strokeStyle = '#FF4136';
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x + padding, y + padding);
    ctx.lineTo(x + size - padding, y + size - padding);
    ctx.moveTo(x + size - padding, y + padding);
    ctx.lineTo(x + padding, y + size - padding);
    ctx.stroke();
}

function drawO(ctx, x, y, size) {
    const centerX = x + size / 2;
    const centerY = y + size / 2;
    const radius = (size / 2) * 0.7;
    ctx.strokeStyle = '#2ECC40';
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();
}

function roundRect(ctx, x, y, width, height, radius, fill = false, stroke = true) {
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

function createBoardComponents(board, emojis, gameId) {
    return board.map((row, rowIndex) =>
        new ActionRowBuilder().addComponents(
            row.map((cell, cellIndex) => new ButtonBuilder()
                .setCustomId(`${gameId}-${rowIndex}-${cellIndex}`)
                .setEmoji(cell === emojis.x ? '❌' : cell === emojis.o ? '⭕' : '⬛')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(cell !== emojis.blank)
            )
        )
    );
}

function checkWin(board, mark) {
    const lines = [
        [[0, 0], [0, 1], [0, 2]], [[1, 0], [1, 1], [1, 2]], [[2, 0], [2, 1], [2, 2]],
        [[0, 0], [1, 0], [2, 0]], [[0, 1], [1, 1], [2, 1]], [[0, 2], [1, 2], [2, 2]],
        [[0, 0], [1, 1], [2, 2]], [[2, 0], [1, 1], [0, 2]]
    ];
    for (let line of lines) {
        if (line.every(([r, c]) => board[r][c] === mark)) {
            return line;
        }
    }
    return null;
}

function isBoardFull(board, blank) {
    return board.every(row => row.every(cell => cell !== blank));
}

function smarterBotMove(board, emojis, difficulty) {
    const randomness = difficulty === 'hard' ? 0.1 : difficulty === 'medium' ? 0.5 : 0.9;

    const makeRandomMove = () => {
        const emptyCells = [];
        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 3; c++) {
                if (board[r][c] === emojis.blank) {
                    emptyCells.push([r, c]);
                }
            }
        }
        if (emptyCells.length > 0) {
            const [r, c] = emptyCells[Math.floor(Math.random() * emptyCells.length)];
            board[r][c] = emojis.o;
            return true;
        }
        return false;
    };

    const canWinNext = (mark) => {
        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 3; c++) {
                if (board[r][c] === emojis.blank) {
                    board[r][c] = mark;
                    const win = checkWin(board, mark);
                    board[r][c] = emojis.blank;
                    if (win) return [r, c];
                }
            }
        }
        return null;
    };

    if (Math.random() < randomness) {
        if (makeRandomMove()) return;
    }

    let move = canWinNext(emojis.o);
    if (move) {
        board[move[0]][move[1]] = emojis.o;
        return;
    }

    move = canWinNext(emojis.x);
    if (move) {
        board[move[0]][move[1]] = emojis.o;
        return;
    }

    if (board[1][1] === emojis.blank) {
        board[1][1] = emojis.o;
        return;
    }

    const corners = [[0, 0], [0, 2], [2, 0], [2, 2]];
    const oppositeCorners = corners.filter(([r, c]) => board[r][c] === emojis.x).map(([r, c]) => [2 - r, 2 - c]);
    for (let [r, c] of oppositeCorners) {
        if (board[r][c] === emojis.blank) {
            board[r][c] = emojis.o;
            return;
        }
    }

    const emptyCorners = corners.filter(([r, c]) => board[r][c] === emojis.blank);
    if (emptyCorners.length > 0) {
        const [r, c] = emptyCorners[Math.floor(Math.random() * emptyCorners.length)];
        board[r][c] = emojis.o;
        return;
    }

    const sides = [[0, 1], [1, 0], [1, 2], [2, 1]];
    const emptySides = sides.filter(([r, c]) => board[r][c] === emojis.blank);
    if (emptySides.length > 0) {
        const [r, c] = emptySides[Math.floor(Math.random() * emptySides.length)];
        board[r][c] = emojis.o;
        return;
    }
}

function createGameMessage(username, board, currentPlayer, user, opponent) {
    const currentTurn = currentPlayer === user.id ? user.username : opponent.username;
    return `It's ${currentTurn}'s turn!`;
}

async function endGame(interaction, message, resultMessage, gameBoard, emojis, winningLine = null) {
    const attachment = await createGameBoardCanvas(gameBoard, emojis, winningLine);
    let color, description;

    if (resultMessage.includes("has won!")) {
        if (resultMessage.includes(interaction.user.username)) {
            color = lang.TicTacToe.Colors.Win;
            description = (lang.TicTacToe.Messages.Win || '## **Well done {user}! You won!**').replace(`{user}`, `<@${interaction.user.id}>`);
        } else {
            color = lang.TicTacToe.Colors.Lose;
            description = (lang.TicTacToe.Messages.Lost || '## **Sorry {user}, you lost!**').replace(`{user}`, `<@${interaction.user.id}>`);
        }
    } else {
        color = lang.TicTacToe.Colors.Tie;
        description = (lang.TicTacToe.Messages.Tie || "## **It's a tie {user}!**").replace(`{user}`, `<@${interaction.user.id}>`);
    }

    const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(lang.TicTacToe.Messages.GameOver)
        .setDescription(description)
        .setImage('attachment://tic-tac-toe.png')
        .setFooter({ text: lang.TicTacToe.Messages.ThanksForPlaying, iconURL: interaction.user.displayAvatarURL() });

    await message.edit({ embeds: [embed], files: [attachment], components: [] }).catch(console.error);
}