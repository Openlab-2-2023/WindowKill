// Logic for handling multiple windows aka "Random Windows"

import { Entity, NGon } from "./classes";
import { generateRandomHexColor, canvasToMonitor, monitorToCanvas } from "./functions";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow, currentMonitor } from "@tauri-apps/api/window";

await invoke("subscribe_sync");
const backgroundColor = localStorage.getItem("transparent") ? "rgba(0, 0, 0, 0)" : "rgb(24, 24, 24)";
document.body.style.setProperty("--background", backgroundColor);

const id = await invoke("get_current_window_id")
const monitor = await currentMonitor();
if (!monitor) throw new Error("No monitor detected");
const screenWidth = monitor.size.width;
const screenHeight = monitor.size.height;
let appWindow = await getCurrentWindow();
const outerPos = await appWindow.outerPosition()

const canvas = document.querySelector("canvas");
if (!canvas) throw new Error("Canvas element not found");

const c = canvas.getContext("2d");
if (!c) throw new Error("Canvas context not found");
canvas.width = innerWidth;
canvas.height = innerHeight;

let enemies: Entity[] = [];
let projectiles: Entity[] = [];
let paused = false;
const screenMultiplierStr = localStorage.getItem("screenMultiplier");
let screenMultiplier = screenMultiplierStr !== null ? parseFloat(screenMultiplierStr) : 1;
let playerColor = localStorage.getItem("playerColor") || "#00ff00"; // Default player color
let animateId: number | null = null; // Track the animation frame ID
let boss: Entity | null = null; // Track the boss in this window
let globalBossCount = 0; // Track total bosses globally
let bossShootInterval: ReturnType<typeof setInterval> | null = null;

let messages: string[] = [];
/**
 * Handles incoming sync messages for window state, boss, and projectile transfers.
 * - Updates pause state, boss count, and removes boss if needed.
 * - Handles incoming transferred projectiles and reconstructs them in this window.
 */
listen("sync-message", event => {
    try {
        const data = JSON.parse(typeof event.payload === 'string' ? event.payload : '');
        // console.log(data);
        if (messages.includes(data.messageId)) return; // If the message ID already exists, ignore it
        messages = []
        messages.push(data.messageId); // Add the message ID to the list
        if (data.type === "paused") {
            console.log(data.value);
            setPaused(data.value);            
        }
        if (data.type === "boss_spawned") {
            globalBossCount = data.count
        }
        if (data.type === "boss_removed") {
            globalBossCount = data.count
            if (boss) removeBoss()
        }
        if (data.type === "transfer_projectile") {
            const projectileData = data.projectile;
            console.log(`Transferring projectile: ${JSON.stringify(projectileData)}`);            
            const { x, y } = monitorToCanvas(projectileData.x, projectileData.y, outerPos);
            projectiles.push(new Entity(x, y, projectileData.radius, projectileData.color, projectileData.velocity, projectileData.velocityMultiplier));
            // console.log(projectiles);            
        }
    } catch { }
})

/**
 * Sets the paused state and cancels or restarts animation as needed.
 * @param {boolean} value - Whether the game should be paused.
 */
const setPaused = (value: boolean) => {
    paused = value
    if (paused && animateId) {
        cancelAnimationFrame(animateId) // Cancel the animation frame when pausing
        animateId = null
    } else if (!paused) {
        animate() // Restart animation when unpausing
    }
}

/**
 * Spawns a new enemy at a random position inside the canvas, targeting the center.
 * @param {number} [radius] - The radius of the enemy.
 * @param {number|null} [x] - The x-coordinate (optional, random if null).
 * @param {number|null} [y] - The y-coordinate (optional, random if null).
 * @param {string} [color] - The color of the enemy.
 * @param {number} [velocityMultiplier] - The velocity multiplier for the enemy.
 */
function spawnEnemy(radius: number = ((Math.random() * (30 - 10) + 4) / screenMultiplier), x: number | null = null, y: number | null = null, color: string = getColor(), velocityMultiplier: number = 0.75) {
    // Randomly determine spawn position, always fully inside the canvas
    if (!x || !y) {
        if (!canvas) throw new Error("Canvas element not found");
        if (Math.random() < 0.5) {
            // Spawn along left or right, but not at the edge
            x = Math.random() * (canvas.width - 2 * radius) + radius
            y = Math.random() * (canvas.height - 2 * radius) + radius
        } else {
            // Spawn along top or bottom, but not at the edge
            x = Math.random() * (canvas.width - 2 * radius) + radius
            y = Math.random() * (canvas.height - 2 * radius) + radius
        }
    }

    const dest = monitorToCanvas(screenWidth / 2, screenHeight / 2, outerPos);
    // console.log(`Destination position: (${dest.x}, ${dest.y})`);

    // Calculate angle towards the player's current position
    const angle = Math.atan2(dest.y - y, dest.x - x)

    // Set velocity based on the angle
    const velocity = {
        x: Math.cos(angle) * velocityMultiplier,
        y: Math.sin(angle) * velocityMultiplier,
    }
    // console.log(`Spawning enemy at (${x}, ${y}) with angle ${angle} and color ${color} and velocity (${velocity.x}, ${velocity.y})`);

    // Spawn the enemy targeting the player
    const enemy = new Entity(x, y, radius, color, velocity, velocityMultiplier);
    // enemy.draw(c);
    enemies.push(enemy);
}

/**
 * Generates a random hex color string that is not the player's color.
 * @returns {string} A random hex color string in the format "#RRGGBB".
 */
function getColor(): string {
    let color;
    do {
        color = generateRandomHexColor()
    } while (color === playerColor)

    return color;
}

/**
 * Main animation for `random` window loop. Updates and draws all projectiles and enemies.
 * Handles enemy transfer and collision with projectiles.
 * @returns {Promise<void>}
 */
async function animate(): Promise<void> {
    if (paused) return;
    animateId = requestAnimationFrame(() => animate());
    if (!c || !canvas) return; // Ensure c is not null
    c.clearRect(0, 0, canvas.width, canvas.height);
    
    projectiles.forEach((projectile) => {
        projectile.update(c);
    });
    
    // Update and handle enemies
    for (let index = enemies.length - 1; index >= 0; index--) {
        const enemy = enemies[index];
        enemy.update(c);

        // Check if enemy is off-screen
        if (enemy.x - enemy.radius < 0 || enemy.x + enemy.radius > canvas.width ||
            enemy.y - enemy.radius < 0 || enemy.y + enemy.radius > canvas.height) {
            // Transfer enemy
            const { x, y } = canvasToMonitor(enemy.x, enemy.y, outerPos);

            let newEnemy = enemy;
            newEnemy.x = x;
            newEnemy.y = y;
            await invoke("send_sync_message", {
                msg: JSON.stringify({
                    type: "enemy_transfer",
                    enemy: newEnemy,
                    messageId: `m_${Math.floor(Math.random() * 1e8)}`,
                })
            });

            enemies.splice(index, 1); // Remove off-screen enemy
        }

        // Check for collision between projectiles and enemy
        for (let projectilesIndex = projectiles.length - 1; projectilesIndex >= 0; projectilesIndex--) {
            const projectile = projectiles[projectilesIndex];
            const dist = Math.hypot(projectile.x - enemy.x, projectile.y - enemy.y);

            // When projectile hits enemy
            if (dist - enemy.radius - projectile.radius < 1) {
                if (enemy.radius - 10 > 5) {
                    enemy.radius -= 10;
                    projectiles.splice(projectilesIndex, 1);
                } else {
                    // Remove enemy if too small
                    await invoke("send_sync_message", {
                        msg: JSON.stringify({
                            type: "killcount_increase",
                            messageId: `e_${Math.floor(Math.random() * 1e8)}`,
                        })
                    });
                    enemies.splice(index, 1);
                    projectiles.splice(projectilesIndex, 1);
                }
            }
        }
    }
}

/* Spawns a boss enemy if conditions are met.
    * Conditions:
    * - No boss currently exists in this window.
    * - Global boss count is less than 3.
    * This function generates a random number of sides (between 5 and 8) for the boss,
    * places it at a random position within the canvas, and adds it to the enemies array.
    * It also increments the global boss count and sends a sync message to notify other windows.
 */
function trySpawnBoss() {
    if (boss || globalBossCount >= 3 || !canvas) return
    const sides = 5 + Math.floor(Math.random() * 4)
    const radius = 40
    const x = Math.random() * (canvas.width - 2 * radius) + radius
    const y = Math.random() * (canvas.height - 2 * radius) + radius
    boss = new NGon(x, y, radius, getColor(), sides)
    enemies.push(boss)
    globalBossCount++
    invoke('send_sync_message', {
        msg: JSON.stringify({ type: 'boss_spawned', windowId: id, count: globalBossCount, messageId: `b_${Math.floor(Math.random() * 1e8)}` })
    })
    startBossShooting()
}

/**
 * Removes the boss from this window, clears its shooting interval, and notifies other windows.
 */
function removeBoss() {
    if (bossShootInterval) clearInterval(bossShootInterval)
    bossShootInterval = null
    if (boss) {
        const bossIndex = enemies.indexOf(boss)
        if (bossIndex !== -1) enemies.splice(bossIndex, 1)
    }
    boss = null
    globalBossCount = Math.max(0, globalBossCount - 1)
    invoke('send_sync_message', {
        msg: JSON.stringify({ type: 'boss_removed', windowId: id, count: globalBossCount, messageId: `b_${Math.floor(Math.random() * 1e8)}` })
    })
}

/**
 * Starts the boss shooting interval, where the boss shoots projectiles towards the center of the screen.
 * Projectiles are created with a random velocity multiplier.
 */
function startBossShooting() {
    if (!boss) return
    bossShootInterval = setInterval(() => {
        if (!boss) return
        const dest = monitorToCanvas(screenWidth / 2, screenHeight / 2, outerPos);
        const angle = Math.atan2(dest.y - boss.y, dest.x - boss.x)
        const velocityMultiplier = 0.5 + Math.random() * 0.5; // Boss shoots faster
        const velocity = {
            x: Math.cos(angle) * velocityMultiplier, // Boss shoots faster
            y: Math.sin(angle) * velocityMultiplier,
        }
        enemies.push(new Entity(boss.x, boss.y, 10, boss.color, velocity, velocityMultiplier));
    }, 2000)
}

animate();
spawnEnemy();
setInterval(() => {
    if (!paused && !boss) spawnEnemy();
}, 1000 * Math.random() * 5 + 5000);

// Try to spawn a boss every 20 seconds if allowed
// setInterval(() => {
//     if (!paused) trySpawnBoss()
// }, 20000)

setInterval(async () => {
    if (!paused) trySpawnBoss();
    if (enemies.length == 0 && !boss && !paused) {
        await invoke("send_sync_message", { msg: JSON.stringify({ type: "window_closed", id: id, messageId: `m_${Math.floor(Math.random() * 1e8)}` }) })
        await invoke("close_window", { id: id })
    }
}, 5000); // Check every 5 seconds