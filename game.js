// --- Basic Setup ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const messageBox = document.getElementById('message-box');
const p1ScoreDisplay = document.getElementById('player1-score');
const p2ScoreDisplay = document.getElementById('player2-score');
const roundScoreDisplay = document.getElementById('round-score');
const timerDisplay = document.getElementById('timer');
const bgm = document.getElementById('bgm');

// --- Game Configuration ---
const GAME_WIDTH = 1000;
const GAME_HEIGHT = 600;
canvas.width = GAME_WIDTH;
canvas.height = GAME_HEIGHT;

const PLAYER_WIDTH = 75;
const PLAYER_HEIGHT = 30;
const PLAYER_SPEED = 7;
const JUMP_STRENGTH = -9;
const ATTACKER_HOP_STRENGTH = 6;
const PROJECTILE_SIZE = 12;
const BASE_GRAVITY = 0.3;
const THROW_COOLDOWN = 500; // 0.5 seconds
const ITEM_SIZE = 15;
const BUFF_DURATION = 5000; // 5 seconds for boosts

// --- Global State ---
let gravity = BASE_GRAVITY;

// --- Input Handler ---
class InputHandler {
    constructor() {
        this.keys = {};
        window.addEventListener('keydown', e => { this.keys[e.key.toLowerCase()] = true; });
        window.addEventListener('keyup', e => { this.keys[e.key.toLowerCase()] = false; });
    }
}
const input = new InputHandler();

// --- Classes ---
class Player {
    constructor(x, y, color, name) {
        this.name = name;
        this.x = x;
        this.y = y;
        this.width = PLAYER_WIDTH;
        this.height = PLAYER_HEIGHT;
        this.color = color;
        this.baseSpeed = PLAYER_SPEED;
        this.speed = PLAYER_SPEED;
        this.baseJump = JUMP_STRENGTH;
        this.jumpStrength = JUMP_STRENGTH;
        this.isAttacker = false;
        this.velocityY = 0;
        this.grounded = false;
        this.canHop = true;
        this.hasShield = false;
        this.hasTripleShot = false;
        this.hasCurveShot = false;
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 15;
        
        ctx.beginPath();
        if (this.isAttacker) {
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.x + this.width, this.y);
            ctx.lineTo(this.x + this.width / 2, this.y + this.height);
        } else {
            ctx.moveTo(this.x, this.y + this.height);
            ctx.lineTo(this.x + this.width, this.y + this.height);
            ctx.lineTo(this.x + this.width / 2, this.y);
        }
        ctx.closePath();
        ctx.fill();

        ctx.shadowBlur = 0;

        if (this.hasShield) {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 3;
            ctx.shadowColor = '#ffffff';
            ctx.shadowBlur = 10;
            ctx.strokeRect(this.x - 4, this.y - 4, this.width + 8, this.height + 8);
            ctx.shadowBlur = 0;
        }
    }

    update() {
        const jumpKeyPressed = (this.name === 'Player 1' && input.keys['w']) || (this.name === 'Player 2' && input.keys['arrowup']);
        let horizontalMovement = 0;
        if (this.name === 'Player 1') {
            if (input.keys['a']) horizontalMovement = -1;
            if (input.keys['d']) horizontalMovement = 1;
        } else { // Player 2
            if (input.keys['arrowleft']) horizontalMovement = -1;
            if (input.keys['arrowright']) horizontalMovement = 1;
        }
        this.x += horizontalMovement * this.speed;

        if (this.isAttacker) {
            if (jumpKeyPressed && this.canHop) {
                this.velocityY = ATTACKER_HOP_STRENGTH;
                this.canHop = false;
            }
            this.velocityY -= BASE_GRAVITY * 0.5; // Anti-gravity to pull back up
            this.y += this.velocityY;
            if (this.y <= PLAYER_HEIGHT) {
                this.y = PLAYER_HEIGHT;
                this.velocityY = 0;
                this.canHop = true;
            }
        } else { // Defender
            if (jumpKeyPressed && this.grounded) {
                this.velocityY = this.jumpStrength;
                this.grounded = false;
            }
            this.velocityY += gravity;
            this.y += this.velocityY;
            const floor = GAME_HEIGHT - this.height * 2.5;
            if (this.y + this.height >= floor) {
                this.y = floor - this.height;
                this.velocityY = 0;
                this.grounded = true;
            }
        }

        if (this.x < 0) this.x = 0;
        if (this.x + this.width > GAME_WIDTH) this.x = GAME_WIDTH - this.width;
    }
}

class Projectile {
    constructor(x, y, velX, velY, color, curve = 0) {
        this.x = x; this.y = y; this.size = PROJECTILE_SIZE;
        this.velocityX = velX; this.velocityY = velY;
        this.color = color; this.curve = curve;
    }
    draw() {
        ctx.save(); ctx.translate(this.x, this.y);
        ctx.fillStyle = this.color; ctx.shadowColor = this.color; ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.moveTo(0, -this.size); ctx.lineTo(this.size, 0);
        ctx.lineTo(0, this.size); ctx.lineTo(-this.size, 0);
        ctx.closePath(); ctx.fill();
        ctx.restore(); ctx.shadowBlur = 0;
    }
    update(defender) {
        this.velocityY += gravity;
        this.velocityX += this.curve;

        // Homing logic
        if (this.y > GAME_HEIGHT / 2) {
            const targetX = defender.x + defender.width / 2;
            const directionX = targetX - this.x;
            if (Math.abs(directionX) > 1) { // To prevent jittering
                this.velocityX += (directionX > 0 ? 1 : -1) * 0.15; // Homing strength
            }
        }

        this.x += this.velocityX;
        this.y += this.velocityY;
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x; this.y = y;
        this.size = Math.random() * 3 + 1;
        this.velocityX = (Math.random() - 0.5) * 4;
        this.velocityY = (Math.random() - 0.5) * 4;
        this.lifespan = 100;
        this.color = color;
    }
    draw() {
        ctx.fillStyle = this.color;
        ctx.globalAlpha = this.lifespan / 100;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }
    update() {
        this.x += this.velocityX;
        this.y += this.velocityY;
        this.lifespan--;
    }
}

const itemColors = {
    shield: '#ffffff', booster: '#ffff00', jump_boost: '#00ff00',
    triple_shot: '#ff00ff', curve_shot: '#ff9900', heavy_gravity: '#6600cc'
};
const defenderItems = ['shield', 'booster', 'jump_boost'];
const attackerItems = ['triple_shot', 'curve_shot', 'heavy_gravity'];
const itemDisplayNames = {
    shield: '실드!', booster: '스피드 업!', jump_boost: '점프 강화!',
    triple_shot: '트리플샷!', curve_shot: '커브샷!', heavy_gravity: '중력 증가!'
};

class Item {
    constructor(x, y, type) {
        this.x = x; this.y = y; this.type = type;
        this.size = ITEM_SIZE;
        this.color = itemColors[type] || '#ffffff';
        this.isAttackerItem = attackerItems.includes(type);
    }
    draw() {
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 15;
        ctx.fillRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
        ctx.shadowBlur = 0;
    }
}

class Notification {
    constructor(text, x, y, color) {
        this.text = text;
        this.x = x;
        this.y = y;
        this.color = color;
        this.lifespan = 120; // 2 seconds
        this.opacity = 1;
    }
    update() {
        this.y -= 0.5; // Move up
        this.lifespan--;
        this.opacity = this.lifespan / 120;
    }
    draw() {
        ctx.save();
        ctx.globalAlpha = this.opacity;
        ctx.fillStyle = this.color;
        ctx.font = 'bold 20px Courier New';
        ctx.textAlign = 'center';
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 10;
        ctx.fillText(this.text, this.x, this.y);
        ctx.restore();
    }
}

// --- Game State ---
let player1, player2, projectiles = [], items = [], particles = [], notifications = [];
let round = 1, player1RoundsWon = 0, player2RoundsWon = 0;
let currentAttacker, currentDefender;
let roundTimer, roundTimerId, itemSpawnIntervalId;
let roundDuration = 30, defenderHits = 0;
let canThrow = true, gameState = 'STARTING';

// --- Main Game Loop ---
function gameLoop() { update(); draw(); requestAnimationFrame(gameLoop); }

// --- Update & Draw ---
function update() {
    if (gameState !== 'IN_ROUND') return;
    handleThrowing();
    player1.update(); player2.update();

    particles.forEach((p, i) => { p.update(); if (p.lifespan <= 0) particles.splice(i, 1); });
    notifications.forEach((n, i) => { n.update(); if (n.lifespan <= 0) notifications.splice(i, 1); });

    projectiles.forEach((proj, pIndex) => {
        proj.update(currentDefender);
        if (proj.x > currentDefender.x && proj.x < currentDefender.x + currentDefender.width && proj.y > currentDefender.y && proj.y < currentDefender.y + currentDefender.height) {
            createParticles(proj.x, proj.y, proj.color);
            if (currentDefender.hasShield) { currentDefender.hasShield = false; } else { defenderHits++; }
            projectiles.splice(pIndex, 1);
            if (defenderHits >= 3) endRound(currentAttacker.name);
        }
        if (proj.y > GAME_HEIGHT) { createParticles(proj.x, proj.y, proj.color); projectiles.splice(pIndex, 1); }
    });

    items.forEach((item, iIndex) => {
        const p = item.isAttackerItem ? currentAttacker : currentDefender;
        if (p.x < item.x + item.size / 2 && p.x + p.width > item.x - item.size / 2 && p.y < item.y + item.size / 2 && p.y + p.height > item.y - item.size / 2) {
            activateItem(p, item.type);
            items.splice(iIndex, 1);
        }
    });
}

function draw() {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    drawBackground();
    if (gameState === 'IN_ROUND') {
        if (player1) player1.draw(); 
        if (player2) player2.draw();
        projectiles.forEach(proj => proj.draw()); 
        items.forEach(item => item.draw());
    }
    particles.forEach(p => p.draw());
    notifications.forEach(n => n.draw());
}

function drawBackground() {
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i < GAME_WIDTH; i += 20) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, GAME_HEIGHT); ctx.stroke(); }
    for (let i = 0; i < GAME_HEIGHT; i += 20) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(GAME_WIDTH, i); ctx.stroke(); }
}

// --- Game Flow ---
function handleThrowing() {
    if (!canThrow) return;

    let horizontalInfluence = 0;
    if (currentAttacker.name === 'Player 1') {
        if (input.keys['a']) horizontalInfluence = -1;
        if (input.keys['d']) horizontalInfluence = 1;
    } else { // Player 2
        if (input.keys['arrowleft']) horizontalInfluence = -1;
        if (input.keys['arrowright']) horizontalInfluence = 1;
    }

    const p1Throw = currentAttacker.name === 'Player 1' && input.keys['s'];
    const p2Throw = currentAttacker.name === 'Player 2' && input.keys['arrowdown'];

    if (p1Throw || p2Throw) {
        createProjectile(currentAttacker, horizontalInfluence);
        canThrow = false;
        setTimeout(() => { canThrow = true; }, THROW_COOLDOWN);
    }
}

function createProjectile(attacker, horizontalInfluence) {
    const speed = 24;
    const velY = speed;
    const velX = horizontalInfluence * 3;

    if (attacker.hasTripleShot) {
        for (let i = -1; i <= 1; i++) {
            projectiles.push(new Projectile(attacker.x + attacker.width / 2, attacker.y + attacker.height, (i * 2) + velX, velY, attacker.color));
        }
        attacker.hasTripleShot = false;
    } else {
        const curve = attacker.hasCurveShot ? (Math.random() - 0.5) * 0.2 : 0;
        projectiles.push(new Projectile(attacker.x + attacker.width / 2, attacker.y + attacker.height, velX, velY, attacker.color, curve));
        attacker.hasCurveShot = false;
    }
}

function createParticles(x, y, color) {
    for (let i = 0; i < 10; i++) {
        particles.push(new Particle(x, y, color));
    }
}

function createNotification(text, player) {
    const y = player.isAttacker ? GAME_HEIGHT * 0.2 : GAME_HEIGHT * 0.9;
    notifications.push(new Notification(text, player.x + player.width / 2, y, player.color));
}

function activateItem(player, type) {
    createNotification(itemDisplayNames[type], player);
    switch (type) {
        case 'shield': player.hasShield = true; break;
        case 'booster':
            player.speed = player.baseSpeed * 1.5;
            setTimeout(() => { player.speed = player.baseSpeed; }, BUFF_DURATION);
            break;
        case 'jump_boost':
            player.jumpStrength = player.baseJump * 1.3;
            setTimeout(() => { player.jumpStrength = player.baseJump; }, BUFF_DURATION);
            break;
        case 'triple_shot': player.hasTripleShot = true; break;
        case 'curve_shot': player.hasCurveShot = true; break;
        case 'heavy_gravity':
            gravity = BASE_GRAVITY * 2;
            setTimeout(() => { gravity = BASE_GRAVITY; }, BUFF_DURATION);
            break;
    }
}

function spawnItem() {
    if (items.length > 2) return; // Limit number of items on screen

    const isAttackerItem = Math.random() < 0.5;
    const type = isAttackerItem 
        ? attackerItems[Math.floor(Math.random() * attackerItems.length)]
        : defenderItems[Math.floor(Math.random() * defenderItems.length)];

    const x = Math.random() * (GAME_WIDTH - 200) + 100;
    const y = isAttackerItem ? GAME_HEIGHT * 0.25 : GAME_HEIGHT * 0.75;

    items.push(new Item(x, y, type));
}

function startGame() {
    messageBox.textContent = 'ThrowDodge';
    setTimeout(showRoundInterstitial, 3000);
}

function startNextRound() {
    gameState = 'ROUND_STARTING';
    projectiles = []; items = [], particles = [], notifications = []; defenderHits = 0; canThrow = true; gravity = BASE_GRAVITY;
    roundTimer = roundDuration; timerDisplay.textContent = roundTimer;
    updateScores();
    if (roundTimerId) clearInterval(roundTimerId);
    if (itemSpawnIntervalId) clearInterval(itemSpawnIntervalId);

    // Play BGM on first round
    if (round === 1) {
        bgm.volume = 0.5; // Set a reasonable volume
        const playPromise = bgm.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                console.log("Autoplay was prevented. User interaction is needed to start music.");
                const startMusicOnClick = () => {
                    bgm.play();
                    canvas.removeEventListener('click', startMusicOnClick);
                };
                canvas.addEventListener('click', startMusicOnClick);
            });
        }
    }

    const p1 = new Player(GAME_WIDTH / 2 - PLAYER_WIDTH / 2, 0, '#0ff', 'Player 1');
    const p2 = new Player(GAME_WIDTH / 2 - PLAYER_WIDTH / 2, 0, '#f0f', 'Player 2');

    if (round === 1 ? Math.random() < 0.5 : currentAttacker.name === 'Player 2') {
        p1.isAttacker = true; p1.y = PLAYER_HEIGHT;
        p2.isAttacker = false; p2.y = GAME_HEIGHT - PLAYER_HEIGHT * 2.5; p2.grounded = true;
        currentAttacker = p1; currentDefender = p2;
    } else {
        p2.isAttacker = true; p2.y = PLAYER_HEIGHT;
        p1.isAttacker = false; p1.y = GAME_HEIGHT - PLAYER_HEIGHT * 2.5; p1.grounded = true;
        currentAttacker = p2; currentDefender = p1;
    }
    player1 = p1; player2 = p2;
    
    messageBox.textContent = `${currentAttacker.name} 공격!`;

    setTimeout(() => {
        messageBox.textContent = '';
        gameState = 'IN_ROUND';
        roundTimerId = setInterval(() => {
            roundTimer--;
            timerDisplay.textContent = roundTimer;
            if (roundTimer <= 0) endRound(currentDefender.name);
        }, 1000);
        itemSpawnIntervalId = setInterval(spawnItem, 7000);
    }, 2000);
}

function showRoundInterstitial() {
    gameState = 'INTERMISSION';
    messageBox.textContent = `Round ${round}`;
    player1 = null; // Clear players so they aren't drawn
    player2 = null;
    setTimeout(startNextRound, 2000);
}

function endRound(winnerName) {
    gameState = 'ROUND_OVER';
    clearInterval(roundTimerId);
    clearInterval(itemSpawnIntervalId);
    messageBox.textContent = `${winnerName} 라운드 승리!`;

    if (winnerName === 'Player 1') player1RoundsWon++;
    else player2RoundsWon++;

    updateScores();

    if (player1RoundsWon >= 2) {
        setTimeout(() => endGame('Player 1'), 3000);
    } else if (player2RoundsWon >= 2) {
        setTimeout(() => endGame('Player 2'), 3000);
    } else {
        round++;
        setTimeout(showRoundInterstitial, 3000);
    }
}

function updateScores() {
    p1ScoreDisplay.textContent = `P1: ${player1RoundsWon}`;
    p2ScoreDisplay.textContent = `P2: ${player2RoundsWon}`;
    roundScoreDisplay.textContent = `${player1RoundsWon} : ${player2RoundsWon}`;
}

function endGame(winnerName) {
    gameState = 'GAME_OVER';
    messageBox.textContent = `최종 승리: ${winnerName}`;
}

// --- Start the game ---
startGame();
requestAnimationFrame(gameLoop);
