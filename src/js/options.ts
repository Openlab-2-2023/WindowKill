import { _sendNotification, scaleDownBgGradient, scaleUpBgGradient } from "./functions";
import { availableMonitors } from "@tauri-apps/api/window";
import { exists, mkdir, readTextFile, writeTextFile, BaseDirectory } from "@tauri-apps/plugin-fs";

/**
 * Options class to manage game settings such as difficulty, volume, and player color.
 * Handles loading, saving, and updating options from a JSON file using the Tauri API.
 * Options are stored in a JSON file named "options.json" in the local data directory.
 * Default options:
 * - difficulty: "normal"
 * - volume: "50"
 * - playerColor: "#ffffff"
 *
 * Options are loaded at game start and saved when changed. Access and modify via class methods.
 *
 * @class
 */
class Options {
    /**
     * @type {Difficulties}
     */
    difficulty: Difficulties
    /**
     * @type {Achievements}
     */
    achievements: Achievements
    /**
     * @type {string}
     */
    volume: number
    /**
     * @type {number}
     */
    playerColor: string
    /**
     * @type {string}
     */
    config: string
    /**
     * @type {number}
     */
    defaultWidth: number
    /**
     * @type {number}
     */
    screenMultiplier: number
    /**
     * @type {number}
     */
    newWidth: number
    /**
     * @type {boolean}
     */
    tutorial: boolean

    /**
     * Constructor for the Options class. Initializes default options and config file path.
     */
    constructor() {
        // Default options
        this.difficulty = new Difficulties();
        this.achievements = new Achievements();
        this.volume = 50;
        this.playerColor = "#ffffff";
        this.config = "options.json";
        this.defaultWidth = 600;
        this.screenMultiplier = 1;
        this.newWidth = 600;
        this.tutorial = false;
    }

    /**
     * Initializes the options by setting up the config file path and loading options from file.
     * Must be called before any other methods.
     * @returns {Promise<void>}
     */
    async initialize(): Promise<void> {
        // Create the WindowKill directory if it doesn't exist
        if (!(await exists("", { baseDir: BaseDirectory.AppLocalData }))) {
            await mkdir("", { baseDir: BaseDirectory.AppLocalData, recursive: true });
        }
        await this.loadOptions();
    }

    /**
     * Loads options from the config file, or creates defaults if not present.
     * Updates UI with loaded options.
     * @returns {Promise<void>}
     */
    async loadOptions(): Promise<void> {
        try {
            if (await exists(this.config, { baseDir: BaseDirectory.AppLocalData })) {
                const data = await readTextFile(this.config, { baseDir: BaseDirectory.AppLocalData });
                const options = JSON.parse(data);
                this.difficulty.setDifficulty(options.difficulty || this.difficulty.difficulty);
                this.volume = options.volume || this.volume;
                this.playerColor = options.playerColor || this.playerColor;
                localStorage.setItem("playerColor", this.playerColor);
                this.tutorial = options.tutorial || this.tutorial;
                // Update the UI with loaded options
                const difficultyElem = document.querySelector("#difficulty") as HTMLInputElement;
                if (difficultyElem) difficultyElem.value = this.difficulty.difficulty;
                (document.querySelector("#volume") as HTMLInputElement).value = String(this.volume);
                (document.querySelector("#volumeValue") as HTMLElement).innerHTML = String(this.volume);
                (document.querySelector("#playerColor") as HTMLInputElement).value = this.playerColor;
            } else {
                // Create default options file if it doesn't exist
                await this.saveOptions();
            }
        } catch (error) {
            console.error("Error loading options:", error);
            // On error, use defaults and try to save them
            await this.saveOptions();
        }
    }

    /**
     * Saves current options to the config file.
     * @returns {Promise<void>}
     */
    async saveOptions(): Promise<void> {
        const options = {
            difficulty: this.difficulty.difficulty,
            volume: this.volume,
            playerColor: this.playerColor,
            tutorial: this.tutorial,
        };
        const data = JSON.stringify(options, null, 4);

        try {
            await writeTextFile(this.config, data, { baseDir: BaseDirectory.AppLocalData });
        } catch (error) {
            console.error("Error saving options:", error);
        }
    }

    /**
     * Updates options with new values and saves them.
     * @param {{difficulty?: string, volume?: number, playerColor?: string}} newOptions - New options to apply.
     * @returns {Promise<void>}
     */
    async updateOptions(newOptions: {difficulty?: string, volume?: number, playerColor?: string}): Promise<void> {
        this.difficulty.setDifficulty(newOptions.difficulty || this.difficulty.difficulty);
        this.volume = newOptions.volume || this.volume;
        this.playerColor = newOptions.playerColor || this.playerColor;
        await this.saveOptions();
    }

    /**
     * Checks if there are unsaved changes in the options form compared to saved options.
     * @returns {boolean} True if there are unsaved changes, false otherwise.
     */
    unsavedChanges(): boolean {
        // Get current form values
        const formDifficulty = (document.querySelector("#difficulty") as HTMLInputElement)?.value;
        const formVolume = (document.querySelector("#volume") as HTMLInputElement)?.value;
        const formPlayerColor = (document.querySelector("#playerColor") as HTMLInputElement)?.value;

        // Compare with saved options
        if (formDifficulty !== this.difficulty.difficulty) return true;
        if (formVolume !== String(this.volume)) return true;
        if (formPlayerColor !== this.playerColor) return true;

        // No changes detected
        return false;
    }
}

/**
 * Class to manage game difficulty settings. Handles initialization and updates of difficulty levels.
 * @class
 */
class Difficulties {
    difficulty: string
    difficulties: { [key: string]: any }
    increasePower!: number
    decreasePower!: number
    decreaseMax!: number
    decreaseMultiplier!: number
    enemySpawnSpeed!: number
    enemyMinSpawn!: number
    enemySpawnDecrease!: number
    scoreMultiplier!: number
    transparent!: boolean
    timeMultiplier!: number

    constructor() {
        this.difficulty = "normal"
        this.difficulties = {
            easy: { increasePower: 10, decreasePower: 1, decreaseMax: 3, decreaseMultiplier: 1.05, enemySpawnSpeed: 2, enemyMinSpawn: 1700, enemySpawnDecrease: 5, scoreMultiplier: 0.25, transparent: false, timeMultiplier: 1.2 },
            normal: { increasePower: 20, decreasePower: 2, decreaseMax: 6, decreaseMultiplier: 1.6, enemySpawnSpeed: 1, enemyMinSpawn: 1500, enemySpawnDecrease: 10, scoreMultiplier: 0.5, transparent: false, timeMultiplier: 1.5 },
            hard: { increasePower: 25, decreasePower: 2.5, decreaseMax: 8, decreaseMultiplier: 1.5, enemySpawnSpeed: 0.85, enemyMinSpawn: 1200, enemySpawnDecrease: 15, scoreMultiplier: 1, transparent: false, timeMultiplier: 1.5 },
            impossible: { increasePower: 30, decreasePower: 3, decreaseMax: 10, decreaseMultiplier: 1.3, enemySpawnSpeed: 1, enemyMinSpawn: 1000, enemySpawnDecrease: 30, scoreMultiplier: 2, transparent: true, timeMultiplier: 1.7 }
        }
        // Initialize properties with default difficulty
        this.updateDifficulty()
    }

    updateDifficulty() {
        const currentSettings = this.difficulties[this.difficulty]
        this.increasePower = currentSettings.increasePower
        this.decreasePower = currentSettings.decreasePower
        this.decreaseMax = currentSettings.decreaseMax
        this.decreaseMultiplier = currentSettings.decreaseMultiplier
        this.enemySpawnSpeed = currentSettings.enemySpawnSpeed
        this.enemyMinSpawn = currentSettings.enemyMinSpawn
        this.enemySpawnDecrease = currentSettings.enemySpawnDecrease
        this.scoreMultiplier = currentSettings.scoreMultiplier
        this.transparent = currentSettings.transparent
        this.timeMultiplier = currentSettings.timeMultiplier

        if (currentSettings.transparent) {
            scaleDownBgGradient()
            localStorage.setItem("transparent", "true")
        } else {
            scaleUpBgGradient()
            localStorage.setItem("transparent", "")
        }
    }

    setDifficulty(newDifficulty: string) {
        if (this.difficulties[newDifficulty]) {
            this.difficulty = newDifficulty
            this.updateDifficulty()
        } else {
            console.error(`Invalid difficulty: ${newDifficulty}`)
        }
    }

    getCurrentSettings(): object {
        return this.difficulties[this.difficulty]
    }
}

/**
 * Class to manage achievements. Handles loading, saving, updating, and unlocking achievements.
 * @class
 */
class Achievements {
    /**
     * @type {string}
     */
    file: string;
    /**
     * @type {string}
     */
    schema: string;
    /**
     * @type {Object}
     */
    achievements: { [key: string]: any };

    /**
     * Constructor for the Achievements class. Initializes default achievements and sets up the achievements file path.
     * @constructor
     */
    constructor() {
        this.file = "achievements.json";
        this.schema =
            "https://raw.githubusercontent.com/Openlab-2-2023/WindowKill/refs/heads/main/achievements_schema.json";
        this.achievements = {};
        this.load();
    }

    /**
     * Loads achievements from file, or downloads schema if not present.
     * Normalizes .current fields to arrays if required.
     * @returns {Promise<void>}
     */
    async load(): Promise<void> {
        if (await exists(this.file, { baseDir: BaseDirectory.AppLocalData })) {
            const data = await readTextFile(this.file, { baseDir: BaseDirectory.AppLocalData });
            this.achievements = JSON.parse(data);

            // Normalize: ensure all .current fields that should be arrays are arrays
            for (const key in this.achievements) {
                const ach = this.achievements[key];
                if (Array.isArray(ach.required)) {
                    if (!Array.isArray(ach.current)) ach.current = ach.current ? [ach.current] : [];
                }
            }
            console.log(this.achievements);
        } else {
            // Download the schema file from the URL
            const response = await fetch(this.schema);
            if (!response.ok) {
                throw new Error(`Failed to fetch schema: ${response.statusText}`);
            }
            const data = await response.json();
            this.achievements = data;
            // Save the downloaded schema to the local file
            await writeTextFile(this.file, JSON.stringify(data, null, 4), { baseDir: BaseDirectory.AppLocalData });
        }
    }

    /**
     * Saves achievements to file.
     * @returns {Promise<void>}
     */
    async save(): Promise<void> {
        const data = JSON.stringify(this.achievements, null, 4);
        await writeTextFile(this.file, data, { baseDir: BaseDirectory.AppLocalData });
    }

    /**
     * Updates progress for an achievement and unlocks if requirements are met.
     * @param {string} key - Achievement key.
     * @param {any} value - New progress value.
     */
    async update(key: string, value: any) {
        if (!this.achievements[key]) return;
        this.achievements[key].current = value;
        if (this.achievements[key].required !== null && value >= this.achievements[key].required) {
            await this.unlock(key);
        }
        await this.save();
    }

    /**
     * Unlocks an achievement directly and sends a notification.
     * @param {string} key - Achievement key.
     */
    async unlock(key: string) {
        if (!this.achievements[key]) return;
        this.achievements[key].unlocked = true;
        await _sendNotification("Achievement Unlocked", this.achievements[key].name);
        await this.save();
    }

    /**
     * Handles achievement progress based on game events.
     * Updates achievements for openWorld, noSpace, colorful, godOfColors, killE, surviveM, and scoreP.
     * @param {boolean} noSpace - Indicates if there is no space.
     * @param {string} playerColor - Player color.
     * @param {number} kills - Number of kills.
     * @param {number} time - Time survived.
     * @param {number} score - Score achieved.
     * @returns {Promise<void>}
     */
    async handle(noSpace: boolean, playerColor: string, kills: number, time: number, score: number): Promise<void> {
        console.log("Saving achievements:", this.achievements);
        console.log("Player color:", playerColor);

        // openWorld
        const monitors = await availableMonitors();
        if (monitors.length > this.achievements["openWorld"].current && !this.achievements["openWorld"].unlocked) {
            this.update("openWorld", monitors.length);
        }

        // noSpace
        if (
            noSpace && // Check if there is no space
            !this.achievements["noSpace"].unlocked // Check if the achievement is not already unlocked
        ) {
            this.unlock("noSpace"); // Unlock the achievement
        }

        // colorful
        if (
            this.achievements["colorful"].required.includes(playerColor) && // Check if the player color is in the required colors
            !this.achievements["colorful"].current.includes(playerColor) && // Check if the player color is not already in the current colors
            !this.achievements["colorful"].unlocked // Check if the achievement is not already unlocked
        ) {
            this.achievements["colorful"].current.push(playerColor);
            this.update("colorful", this.achievements["colorful"].current); // Update the achievement progress
        }

        // godOfColors
        if (
            !this.achievements["godOfColors"].current.includes(playerColor) && // Check if the player color is not already in the current colors
            this.achievements["godOfColors"].current.length != this.achievements["godOfColors"].required && // Check if the current colors length is not equal to the required colors length
            !this.achievements["godOfColors"].unlocked // Check if the achievement is not already unlocked
        ) {
            this.achievements["godOfColors"].current.push(playerColor);
            this.update("godOfColors", this.achievements["godOfColors"].current); // Update the achievement progress
        }

        // killE
        const killE = ["kill100e", "kill1000e"];
        killE.forEach((key) => {
            if (
                this.achievements[key].required > this.achievements[key].current && // Check if the required kills are greater than the current kills
                kills > this.achievements[key].current && // Check if the kills are greater than or equal to the required kills
                !this.achievements[key].unlocked // Check if the achievement is not already unlocked
            ) {
                this.achievements[key].current = kills; // Increment the current kills
                this.update(key, this.achievements[key].current); // Update the achievement progress
            }
        });

        // surviveM
        const surviveM = ["survive1m", "survive5m", "survive10m", "survive20m"];
        surviveM.forEach((key) => {
            if (
                this.achievements[key].required > this.achievements[key].current && // Check if the required time is greater than the current time
                time > this.achievements[key].current && // Check if the time is greater than or equal to the required time
                !this.achievements[key].unlocked // Check if the achievement is not already unlocked
            ) {
                this.achievements[key].current = time; // Increment the current time
                this.update(key, this.achievements[key].current); // Update the achievement progress
            }
        });

        // scoreP
        const scoreP = ["score1000", "score5000", "score10000"];
        scoreP.forEach((key) => {
            if (
                this.achievements[key].required > this.achievements[key].current && // Check if the required score is greater than the current score
                score > this.achievements[key].current && // Check if the score is greater than or equal to the required score
                !this.achievements[key].unlocked // Check if the achievement is not already unlocked
            ) {
                this.achievements[key].current = score; // Increment the current score
                this.update(key, this.achievements[key].current); // Update the achievement progress
            }
        });

        localStorage.setItem("achievements", JSON.stringify(this.achievements)); // Save achievements to local storage
    }
}

export { Options };
