import { Entity } from "./classes";
import { Options } from "./options";
// @ts-ignore
import { GameUtils } from "./gameUtils";
import { listen } from "@tauri-apps/api/event";
import { Window, LogicalSize, LogicalPosition } from "@tauri-apps/api/window";
import { sendNotification, isPermissionGranted, requestPermission } from "@tauri-apps/plugin-notification";

/**
 * Helper function for resizing the window. Can shrink or expand the window while keeping it centered.
 * @param {Window} appWindow - The Tauri app window object.
 * @param {number} targetWidth - The target width to resize the window to.
 * @param {number} targetHeight - The target height to resize the window to.
 * @param {number} durationMs - The duration of the animation in milliseconds.
 * @returns {Promise<void>}
 */
async function _resizeWindow(appWindow: Window, targetWidth: number, targetHeight: number, durationMs: number): Promise<void> {
    // Get the initial window size and position
    const startSize = await appWindow.innerSize();
    const startPos = await appWindow.outerPosition();

    // Ensure startSize and startPos are valid
    if (!startSize || !startPos) {
        throw new Error("Failed to retrieve window size or position.");
    }

    // Animate the resizing process
    const startTime = Date.now();
    return new Promise((resolve) => {
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / durationMs, 1);

            // Calculate new size and position to keep the window centered
            const newWidth = startSize.width + targetWidth * progress;
            const newHeight = startSize.height + targetHeight * progress;
            const newX = startPos.x - (newWidth - startSize.width) / 2;
            const newY = startPos.y - (newHeight - startSize.height) / 2;

            // Update window size and position
            appWindow.setSize(new LogicalSize(newWidth, newHeight)).catch(console.error);
            appWindow.setPosition(new LogicalPosition(newX, newY)).catch(console.error);

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                resolve();
            }
        };

        requestAnimationFrame(animate);
    });
}

/**
 * Sends a notification with the given title and body.
 * @param {string} title - The title of the notification.
 * @param {string} body - The body of the notification.
 * @return {Promise<void>}
 * @throws {Error} If the notification fails to send.
 */
async function _sendNotification(title: string, body: string): Promise<void> {
    // Do you have permission to send a notification?
    let permissionGranted = await isPermissionGranted();

    // If not we need to request it
    if (!permissionGranted) {
        const permission = await requestPermission();
        permissionGranted = permission === "granted";
    }

    // Once permission has been granted we can send the notification
    if (permissionGranted) {
        sendNotification({ title: title, body: body });
    }
}

/**
 * Slowly scales down the radial gradient in the --bg-gradient CSS variable.
 * The gradient will scale from `start` to 0, and the second color stop will be double the first percentage or 100%, whichever is smaller.
 * @param {number} [start=100] - Initial gradient size percentage.
 * @param {number} [duration=5000] - Duration of the animation in ms.
 */
function scaleDownBgGradient(start: number = 100, duration: number = 1000) {
    const root = document.documentElement
    const steps = 60
    const stepTime = duration / steps
    let current = start
    const step = start / steps

    const animate = () => {
        current -= step
        if (current < 0) current = 0
        // Second color stop is double the first, but max 100%
        const secondStop = Math.min(current * 2, 100)
        root.style.setProperty(
            "--bg-gradient",
            `radial-gradient(circle at 50% 50%, rgb(24, 24, 24) ${current}%, rgba(255,255,255,0) ${secondStop}%)`
        )
        if (current > 0) setTimeout(animate, stepTime)
    }

    animate()
}

/**
 * Slowly scales up the radial gradient in the --bg-gradient CSS variable.
 * The gradient will scale from `start` to 100%, and the second color stop will be double the first percentage or 100%, whichever is smaller.
 * @param {number} [start=0] - Initial gradient size percentage.
 * @param {number} [duration=5000] - Duration of the animation in ms.
 */
function scaleUpBgGradient(start: number = 0, duration: number = 1000) {
    const root = document.documentElement
    const steps = 60
    const stepTime = duration / steps
    let current = start
    const step = (100 - start) / steps

    const animate = () => {
        current += step
        if (current > 100) current = 100
        // Second color stop is double the first, but max 100%
        const secondStop = Math.min(current * 2, 100)
        root.style.setProperty(
            "--bg-gradient",
            `radial-gradient(circle at 50% 50%, rgb(24, 24, 24) ${current}%, rgba(255,255,255,0) ${secondStop}%)`
        )
        if (current < 100) setTimeout(animate, stepTime)
    }

    animate()
}

/**
 * Generates a random hex color string that is not too dark for visibility on a dark background.
 * Ensures the color's brightness is above a threshold.
 * @returns {string} The generated hex color (e.g., "#ff5733").
 */
function generateRandomHexColor(): string {
    let color, r, g, b, brightness
    do {
        color = Math.floor(Math.random() * 0xffffff)
        r = (color >> 16) & 0xff
        g = (color >> 8) & 0xff
        b = color & 0xff
        // Calculate brightness using the luminance formula
        brightness = 0.299 * r + 0.587 * g + 0.114 * b
    } while (brightness < 120) // Adjust threshold as needed for your background
    return `#${color.toString(16).padStart(6, "0")}`
}

/**
 * Converts canvas coordinates to monitor (screen) coordinates.
 * @param {number} canvasX - X position on the canvas.
 * @param {number} canvasY - Y position on the canvas.
 * @param {{x: number, y: number}} windowPos - The window's position on the monitor ({ x, y }).
 * @returns {{x: number, y: number}} The position on the monitor.
 */
const canvasToMonitor = (canvasX: number, canvasY: number, windowPos: { x: number; y: number; }): { x: number; y: number; } => ({
    x: canvasX + windowPos.x,
    y: canvasY + windowPos.y
})

/**
 * Converts monitor (screen) coordinates to canvas coordinates.
 * @param {number} monitorX - X position on the monitor.
 * @param {number} monitorY - Y position on the monitor.
 * @param {{x: number, y: number}} windowPos - The window's position on the monitor ({ x, y }).
 * @returns {{x: number, y: number}} The position on the canvas.
 */
const monitorToCanvas = (monitorX: number, monitorY: number, windowPos: { x: number; y: number; }): { x: number; y: number; } => ({
    x: monitorX - windowPos.x,
    y: monitorY - windowPos.y
})

/**
 * Starts the game: sets up the player, canvas, timer, event listeners, and game loop.
 * Handles window resizing, pausing, projectile firing (left/right click),
 * and synchronizes state with other windows via Tauri sync messages.
 * @param {Window} appWindow - The Tauri app window object.
 * @param {Options} options - The game options object.
 * @param {HTMLElement} timer - The timer element.
 * @param {HTMLAudioElement} bgMusic - The background music audio element.
 */
async function startGame(appWindow: Window, options: Options, timer: HTMLElement, bgMusic: HTMLAudioElement) {
    // Resize the window to 400x400px
    const resizeW = -200 / options.screenMultiplier;
    await _resizeWindow(appWindow, resizeW, resizeW, 200);

    const canvas = document.querySelector("canvas");
    if (!canvas) {
        throw new Error("Canvas element not found");
    }
    const c = canvas.getContext("2d");
    if (!c) {
        throw new Error("Failed to get canvas context");
    }

    canvas.width = innerWidth;
    canvas.height = innerHeight;

    const playerRadius = 10;
    let playerX = canvas.width / 2;
    let playerY = canvas.height / 2;

    const player = new Entity(playerX, playerY, playerRadius, options.playerColor);

    const gameUtils = new GameUtils(appWindow, canvas, player, playerRadius, options, bgMusic);

    player.draw(c);
    gameUtils.updateCanvasSize();
    gameUtils.centerPlayer();

    // Timer logic
    let startTime = Date.now() // Record the start time
    let pausedTime = 0 // Total time spent paused
    let pauseStart: number | null = null // When pause started

    const timerInterval = setInterval(() => {
        if (gameUtils.gameOver) {
            clearInterval(timerInterval) // Stop the timer when the game is over
            gameUtils.score = Math.floor((Date.now() - startTime - pausedTime) / 1000) // Calculate score in seconds
        } else if (gameUtils.paused) {
            if (!pauseStart) pauseStart = Date.now() // Mark when pause started
        } else {
            if (pauseStart) {
                pausedTime += Date.now() - pauseStart // Add paused duration
                pauseStart = null
            }
            const elapsedTime = Date.now() - startTime - pausedTime // Exclude paused time
            const minutes = Math.floor(elapsedTime / 60000).toString().padStart(2, "0")
            const seconds = Math.floor((elapsedTime % 60000) / 1000).toString().padStart(2, "0")
            const milliseconds = (elapsedTime % 1000).toString().padStart(3, "0")
            timer.innerText = `${minutes}:${seconds}:${milliseconds}` // Update timer display
        }
    }, 10) // Update timer every 10ms for better precision

    // Resize canvas when window is resized
    window.addEventListener("resize", () => {
        gameUtils.updateCanvasSize();
        gameUtils.centerPlayer();
        gameUtils.updateEnemies();
    });

    // Update player position when window is moved
    appWindow.onMoved(() => {
        gameUtils.centerPlayer();
        gameUtils.updateEnemies();
    });

    document.addEventListener("click", (event) => {
        if (!gameUtils.gameOver || !gameUtils.paused) {
            const angle = Math.atan2(event.clientY - player.y, event.clientX - player.x);
            const velocity = {
                x: Math.cos(angle) * 5,
                y: Math.sin(angle) * 5,
            };
            gameUtils.projectiles.push(new Entity(player.x, player.y, 5, options.playerColor, velocity));
        }
    });

    /**
     * Adds a projectile with multiWindow property when right-click is used.
     * Right-click projectiles can be transferred between windows.
     */
    document.addEventListener("contextmenu", event => {
        event.preventDefault() // Prevent the default context menu
        if (!gameUtils.gameOver || !gameUtils.paused) {
            const angle = Math.atan2(event.clientY - player.y, event.clientX - player.x)
            const velocity = {
                x: Math.cos(angle) * 5,
                y: Math.sin(angle) * 5,
            }
            // Set multiWindow to true for right-click projectiles
            gameUtils.projectiles.push(
                new Entity(player.x, player.y, 5, options.playerColor, velocity, 1, true)
            )
        }
    })

    // Add event listener for the Escape key
    document.addEventListener("keydown", async event => {
        if (event.key === "Escape" && !gameUtils.gameOver) {
            gameUtils.paused ? await gameUtils.resume() : await gameUtils.pause();
        }
    });

    appWindow.onFocusChanged(async ({ payload: focused }) => {
        !focused && !gameUtils.paused && !gameUtils.gameOver ? await gameUtils.pause() : null;
    });

    let messages: string[] = []

    await listen("sync-message", async event => {
        try {
            const data = JSON.parse(typeof event.payload === 'string' ? event.payload : '')

            if (messages.includes(data.messageId)) return; // If the message ID already exists, ignore it
            // console.log(`Received messageId: ${JSON.stringify(data.messageId)}`);  
            // console.log(messages);

            messages = []
            messages.push(data.messageId); // Add the message ID to the list
            if (data.type === "window_closed") {
                const idx = gameUtils.windows.indexOf(data.id)
                if (idx !== -1) gameUtils.windows.splice(idx, 1)
                console.log(`Window ${data.id} closed, remaining windows: ${gameUtils.windows.length}`);
            }
            if (data.type === "enemy_transfer") {
                const enemyData = data.enemy;
                console.log(`Received enemy data: ${JSON.stringify(enemyData)}`);
                const pos = await appWindow.outerPosition()
                const { x, y } = monitorToCanvas(enemyData.x, enemyData.y, pos);
                const enemy = new Entity(x, y, enemyData.radius, enemyData.color, enemyData.velocity, enemyData.velocityMultiplier);
                gameUtils.enemies.push(enemy);
            }
            if (data.type === "boss_spawned" || data.type === "boss_removed") {
                gameUtils.bosses = data.count;
            }
            if (data.type === "killcount_increase") {
                gameUtils.killCount++;
                const killCountElem = document.querySelector("#killCount")
                if (killCountElem) killCountElem.innerHTML = gameUtils.killCount.toString();
            }

        } catch { }
    })

    gameUtils.animate();
    gameUtils.spawnEnemies();
    gameUtils.shrinkWindow();
    gameUtils.spawnRandomWindow();
}

export { startGame, _resizeWindow, _sendNotification, scaleDownBgGradient, scaleUpBgGradient, generateRandomHexColor, canvasToMonitor, monitorToCanvas };
