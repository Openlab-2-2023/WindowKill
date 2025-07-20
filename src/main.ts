import { startGame } from "./js/functions";
import { Options } from "./js/options";
import { checkForUpdates } from "./js/checkForUpdates";
import { getCurrentWindow, currentMonitor, LogicalSize, LogicalPosition } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { confirm } from "@tauri-apps/plugin-dialog";

// Check for updates on app start
checkForUpdates().catch((error) => {
    console.error("Error checking for updates:", error);
});

await invoke("start_sync_server");
await invoke("subscribe_sync");
let unlisten: any;

let isPaused = false;

// window.addEventListener("DOMContentLoaded", async () => {
let appWindow = getCurrentWindow();
const monitor = await currentMonitor();
if (!monitor) throw new Error("No monitor detected");
const screenWidth = monitor.size.width;
const screenHeight = monitor.size.height;

const options = new Options();
await options.initialize();
localStorage.setItem("achievements", JSON.stringify(options.achievements.achievements));
options.screenMultiplier = 1920 / screenWidth;
localStorage.setItem("screenMultiplier", options.screenMultiplier.toString());

// Tutorial window
if (!options.tutorial) {
    const width = (options.defaultWidth + 200) / options.screenMultiplier;
    const height = (options.defaultWidth - 50) / options.screenMultiplier;
    await invoke("create_window", {
        id: "tutorial",
        url: "html/tutorial.html",
        x: (screenWidth - width) / 2,
        y: (screenHeight - height) / 2,
        w: width,
        h: height,
        title: "Tutorial",
        decorations: false,
    });
}

unlisten = listen<string>("sync-message", async (event) => {
    try {
        const data = JSON.parse(event.payload);
        if (data.type === "tutorial") {
            options.tutorial = true;
            options.saveOptions();
            await unlisten();
        }
    } catch (error) {}
});

// Prehrávanie hudby
const bgMusic = new Audio("assets/sound/mojtrack.mp3");
bgMusic.loop = true;
bgMusic.volume = options.volume / 100;

const windowWidth = options.defaultWidth / options.screenMultiplier;
options.newWidth = windowWidth;
console.log(`Window width: ${windowWidth}`);

await appWindow.setSize(new LogicalSize(windowWidth, windowWidth));
await appWindow.setPosition(new LogicalPosition((screenWidth - windowWidth) / 2, (screenHeight - windowWidth) / 2));

if ((await appWindow.scaleFactor()) > 1) {
    // alert("For best experience, please set your display scaling to 100%.");
    await confirm("For best experience, please set your display scaling to 100% and restart the game.", {
        title: "WindowKill",
        kind: "warning",
    });

    invoke("quit")
}

const startButton = document.querySelector("#startButton");
const optionsButton = document.querySelector("#optionsButton");
const quitButton = document.querySelector("#quitButton");
const achievementsButton = document.querySelector("#achievements");
const backButton = document.querySelector("#backButton");
const saveButton = document.querySelector("#saveButton");
const restartButton = document.querySelector("#restartButton");
const mainMenuButton = document.querySelector("#mainMenuButton");
const timer = document.querySelector("#timer");
const killCount = document.querySelector("#killCount");
const gameStart = document.querySelector("#gameStart");
const settings = document.querySelector("#settings");

if (
    !startButton ||
    !optionsButton ||
    !quitButton ||
    !achievementsButton ||
    !backButton ||
    !saveButton ||
    !restartButton ||
    !mainMenuButton ||
    !timer ||
    !killCount ||
    !gameStart ||
    !settings
) {
    throw new Error("One or more required DOM elements are missing. Please check your HTML structure.");
}

startButton.addEventListener("click", async () => {
    gameStart.classList.toggle("hidden");
    achievementsButton.classList.toggle("hidden");
    timer.classList.toggle("hidden");
    killCount.classList.toggle("hidden");

    try {
        await bgMusic.play();
    } catch (err) {
        console.error("Failed to play music:", err);
    }

    await startGame(appWindow, options, timer as HTMLElement, bgMusic);
});

optionsButton.addEventListener("click", () => {
    gameStart.classList.toggle("hidden");
    achievementsButton.classList.toggle("hidden");
    settings.classList.toggle("hidden");
});

backButton.addEventListener("click", () => {
    if (options.unsavedChanges()) {
        const confirmLeave = confirm(
            "You have unsaved changes. These changes will be used only in this session. Are you sure you want to leave?"
        );
        if (!confirmLeave) return;
        settings.classList.toggle("hidden");
        gameStart.classList.toggle("hidden");
    } else {
        settings.classList.toggle("hidden");
        gameStart.classList.toggle("hidden");
        achievementsButton.classList.toggle("hidden");
    }
});

saveButton.addEventListener("click", () => {
    // @ts-ignore
    const difficulty: string = document.querySelector("#difficulty").value;
    // @ts-ignore
    const volume: number = parseFloat(document.querySelector("#volume").value);
    // @ts-ignore
    const playerColor: string = document.querySelector("#playerColor").value;

    const newOptions = {
        difficulty,
        volume,
        playerColor,
    };

    bgMusic.volume = volume / 100;
    localStorage.setItem("volume", (volume / 100).toString());
    options.updateOptions(newOptions);
});

quitButton.addEventListener("click", () => {
    invoke("quit");
});

restartButton.addEventListener("click", async () => {
    // @ts-ignore
    document.querySelector("#gameEnd").classList.toggle("hidden");
    timer.classList.toggle("hidden");
    killCount.classList.toggle("hidden");

    bgMusic.currentTime = 0;
    bgMusic.play();

    await startGame(appWindow, options, timer as HTMLElement, bgMusic);
});

mainMenuButton.addEventListener("click", () => {
    // @ts-ignore
    document.querySelector("#gameEnd").classList.toggle("hidden");
    gameStart.classList.toggle("hidden");
    achievementsButton.classList.toggle("hidden");

    bgMusic.pause();
    bgMusic.currentTime = 0;
});

achievementsButton.addEventListener("click", async () => {
    const width = (options.defaultWidth + 200) / options.screenMultiplier;
    await invoke("create_window", {
        id: "achievements",
        url: "html/achievements.html",
        x: (screenWidth - width) / 2,
        y: (screenHeight - width) / 2,
        w: width,
        h: width,
        title: "Achievements",
    });
});

// ✅ Pauza cez ESC
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        isPaused = !isPaused;

        if (isPaused) {
            console.log("Game paused");
            bgMusic.pause();
            // TODO: zobraz pauzovacie menu, stopni časovač
        } else {
            console.log("Game unpaused");
            bgMusic.play().catch((err) => console.error("Resume error:", err));
            // TODO: skry pauzovacie menu, spusti časovač
        }
    }
});
// });
