/**
 * @class
 * @classdesc Represents a generic entity in the game (player, projectile, enemy, etc.).
 */
class Entity {
	/** The x-coordinate of the entity. */
	x: number
	/** The y-coordinate of the entity. */
	y: number
	/** The radius of the entity. */
	radius: number
	/** The color of the entity. */
	color: string
	/** The velocity of the entity. */
	velocity: { x: number; y: number }
	/** The multiplier for the velocity. */
	velocityMultiplier: number
	/** If true, entity can be transferred between windows. */
	multiWindow: boolean

	/**
	 * Creates a new entity.
	 * @param {number} x - The x-coordinate of the entity.
	 * @param {number} y - The y-coordinate of the entity.
	 * @param {number} radius - The radius of the entity.
	 * @param {string} color - The color of the entity.
	 * @param {Object} velocity - The velocity of the entity.
	 * @param {number} velocity.x - The x-component of the velocity.
	 * @param {number} velocity.y - The y-component of the velocity.
	 * @param {number} velocityMultiplier - The multiplier for the velocity.
	 * @param {boolean} multiWindow - If true, entity can be transferred between windows (used for projectiles).
	 */
	constructor(x: number, y: number, radius: number, color: string, velocity: { x: number; y: number } = { x: 0, y: 0 }, velocityMultiplier: number = 1, multiWindow: boolean = false) {
		this.x = x
		this.y = y
		this.radius = radius
		this.color = color
		this.velocity = velocity
		this.velocityMultiplier = velocityMultiplier
		this.multiWindow = multiWindow // If true, entity can be transferred between windows
	}

	/**
	 * Draws the entity as a circle on the canvas.
	 * @param {CanvasRenderingContext2D} c - The canvas rendering context.
	 */
	draw(c: CanvasRenderingContext2D) {
		c.beginPath()
		c.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false)
		c.fillStyle = this.color
		c.fill()
	}

	/**
	 * Moves the entity to a new position and redraws it.
	 * @param {number} x - The new x-coordinate of the entity.
	 * @param {number} y - The new y-coordinate of the entity.
	 * @param {CanvasRenderingContext2D} c - The canvas rendering context.
	 */
	move(x: number, y: number, c: CanvasRenderingContext2D) {
		this.x = x
		this.y = y
		this.draw(c)
	}

	/**
	 * Updates the entity's position based on its velocity and redraws it.
	 * @param {CanvasRenderingContext2D} c - The canvas rendering context.
	 */
	update(c: CanvasRenderingContext2D) {
		this.draw(c)
		this.x += this.velocity.x * this.velocityMultiplier
		this.y += this.velocity.y * this.velocityMultiplier
	}
}

/**
 * @class
 * @classdesc Represents a regular N-sided polygon entity (used for bosses).
 * @extends Entity
 */
class NGon extends Entity {
	/** The number of sides of the NGon. */
	sides: number
	/** The rotation of the NGon in radians. */
	rotation: number

	/**
	 * Creates a new NGon entity.
	 * @param {number} x - The x-coordinate of the NGon.
	 * @param {number} y - The y-coordinate of the NGon.
	 * @param {number} radius - The radius of the NGon (distance from center to vertex).
	 * @param {string} color - The color of the NGon.
	 * @param {number} sides - The number of sides of the NGon (minimum 3).
	 * @param {Object} velocity - The velocity of the NGon.
	 * @param {number} velocity.x - The x-component of the velocity.
	 * @param {number} velocity.y - The y-component of the velocity.
	 * @param {number} velocityMultiplier - The multiplier for the velocity.
	 * @param {boolean} multiWindow - If true, NGon can be transferred between windows.
	 */
	constructor(x: number, y: number, radius: number, color: string, sides: number, velocity: { x: number; y: number; } = { x: 0, y: 0 }, velocityMultiplier: number = 1, multiWindow: boolean = false) {
		super(x, y, radius, color, velocity, velocityMultiplier, multiWindow)
		this.sides = Math.max(3, Math.floor(sides))
		this.rotation = Math.random() * 2 * Math.PI // Random rotation in radians
	}

	/**
	 * Draws the NGon on the canvas, applying its random rotation.
	 * @param {CanvasRenderingContext2D} c - The canvas rendering context.
	 */
	draw(c: CanvasRenderingContext2D) {
		const angleStep = (2 * Math.PI) / this.sides
		c.beginPath()
		for (let i = 0; i < this.sides; i++) {
			const angle = i * angleStep - Math.PI / 2 + this.rotation // Start at top, add rotation
			const px = this.x + this.radius * Math.cos(angle)
			const py = this.y + this.radius * Math.sin(angle)
			if (i === 0) c.moveTo(px, py)
			else c.lineTo(px, py)
		}
		c.closePath()
		c.fillStyle = this.color
		c.fill()
	}
}

/**
 * @class
 * @classdesc Particle system for confetti-like effects using Anime.js.
 */
class ParticleSystem {
    /** The container element where particles will be added. */
    container: HTMLElement
    /** The array of particle elements. */
    particles: HTMLElement[]
    /** The array of colors for the particles. */
    colors: string[]
    /**
     * Creates a new ParticleSystem instance.
     * Initializes the container and particle array.
     */

	constructor() {
		this.container = document.getElementsByTagName("body")[0];
		this.particles = [];
		this.colors = ["#ff0000", "#00ff00", "#0000ff", "#ffff00", "#ff00ff"];
	}

	/**
	 * Creates a particle element and adds it to the container.
	 * @param {number} x - The x-coordinate of the particle.
	 * @param {number} y - The y-coordinate of the particle.
	 * @return {HTMLElement} The created particle element.
	 */
	createParticle(x: number, y: number): HTMLElement {
		const particle = document.createElement("div");
		particle.className = "particle";

		// Random color and size
		particle.style.backgroundColor =
			this.colors[Math.floor(Math.random() * this.colors.length)];
		particle.style.width = `${Math.random() * 10 + 10}px`; // Wider rectangles
		particle.style.height = `${Math.random() * 5 + 5}px`; // Taller than wide

		// Make particles rectangular
		particle.style.borderRadius = "0%";

		particle.style.left = `${x}px`;
		particle.style.top = `${y}px`;

		this.container.appendChild(particle);
		this.particles.push(particle);

		return particle;
	}

	/**
	 * Explodes particles from a given point on the screen.
	 * @param {number} x - The x-coordinate of the explosion.
	 * @param {number} y - The y-coordinate of the explosion.
	 * @param {number} count - The number of particles to create.
	 * @return {void}
	 */
	explode(x: number, y: number, count: number = 50): void {
		// Create particles
		for (let i = 0; i < count; i++) {
			const particle = this.createParticle(x, y);

			// Physics parameters
			const angle = Math.random() * 45 - 22.5; // Narrower angle for downward motion
			const speed = Math.random() * 3 + 2;

			// Initial velocity
			const velocityX = Math.cos(angle) * speed;
			const velocityY = Math.sin(angle) * speed + 5; // Extra downward force

            // @ts-ignore
			anime({
				targets: particle,
				translateX: [
					{
						value: velocityX * 200,
						duration: 1500,
						easing: "easeInOutQuad",
					},
				],
				translateY: [
					{
						value: velocityY * 200,
						duration: 1500,
						easing: "easeInQuad", // Accelerates downward
					},
				],
				rotate: {
					value: Math.random() * 360,
					duration: 1500,
					easing: "linear",
					delay: Math.random() * 300, // Random rotation start
				},
				opacity: [
					{ value: 1 },
					{ value: 0, duration: 500, delay: 1200 },
				],
				complete: () => particle.remove(),
			});
		}
	}

	/**
	 * Cleans up the particles by removing them from the DOM.
	 * @return {void}
	 */
	cleanup(): void {
		this.particles.forEach((particle) => particle.remove());
		this.particles = [];
	}
}

export { Entity, ParticleSystem, NGon };
