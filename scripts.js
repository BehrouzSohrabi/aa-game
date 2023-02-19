// clear settings and history on storage
chrome.storage.sync.clear(() => {});

// variables
let environment, scoreTracker, target, pinSource, updateStorage;
let settings = {
	score: 0,
};

// fetch user settings (basically scores for now)
chrome.storage.sync.get('settings', (data_settings) => {
	if (!isEmpty(data_settings.settings)) {
		settings = data_settings.settings;
		console.log(settings);
	}
});

// game settings
const game = {
    resetTimeout: 2000,
    width: 320,
    height: 480
}
const colors = {
	yellow: [255, 255, 235],
	green: [125, 220, 50],
	red: [245, 10, 0],
	dark: [25, 25, 40],
	gray: [180, 180, 150],
};
const rotationSpeeds = {
    steps: [0.03, 0.015, 0.05, -0.03, -0.015, -0.05],
    timeout: 1000
}
const targetProperties = {
    x: game.width/2,
    y: game.height/4,
    diameter: game.height/5,
    scoreY: game.height/4 + game.height/100,
    highScoreY: game.height - game.height/15,
}
const pinSourceProperties = {
    x: game.width/2,
    y: game.height*.85,
    diameter: game.height * 0.03,
    speed: game.height * 0.04,
    pinLength: game.height * 0.13,
    tipRadius: game.height * 0.012
}

// p5js methods
function setup() {
	createCanvas(game.width, game.height);
	environment = new Environment();
	target = new Target();
	pinSource = new PinSource();
	scoreTracker = new ScoreTracker();
}

function mouseClicked() {
	if (!environment.isGameOver) {
		pinSource.throwPin();
	}
	return false;
}

function draw() {
	const isGameOver = environment.isGameOver;
	const { red, green, yellow } = colors;
	let score = 0;
	pinSource.pins.forEach((p) => {
		if (!p.missedTarget) {
			score++;
		}
	});
	if (isGameOver) {
		background(red);
		updateScore(score);
	} else {
		background(score > settings.score ? green : yellow);
		pinSource.updatePins(target);
	}
    pinSource.render();
	pinSource.pins.forEach((pin) => pin.render());
	scoreTracker.setScore(score);
	target.render();
	scoreTracker.render();
	function updateScore(score) {
		if (score > settings.score) {
			settings.score = score;
			chrome.storage.sync.set({ settings });
		}
	}
}

// game classes
class Environment {
	constructor() {
		this.resetTimer;
		this.isGameOver = false;
		this.setRotationSpeed();
	}
	setRotationSpeed() {
		this.rotationSpeed =
			rotationSpeeds.steps[
				Math.floor(Math.random() * rotationSpeeds.steps.length)
			];
		this.resetTimer = setTimeout(() => {
			this.setRotationSpeed();
		}, rotationSpeeds.timeout);
	}
	endGame() {
		this.isGameOver = true;
		clearTimeout(this.resetTimer);
		setTimeout(() => {
			this.isGameOver = false;
			pinSource.pins.length = 0;
			this.setRotationSpeed();
		}, game.resetTimeout);
	}
}

class PinSource {
	constructor() {
		this.pins = [];
	}
	throwPin() {
		this.pins.push(new Pin());
	}
	updatePins(target) {
		for (let pin of this.pins) {
			pin.missedTarget
				? pin.updateOnTargetPin(pin.position.y - pinSourceProperties.pinLength < target.position.y + target.diameter/2, this.pins)
				: pin.updateStuckPin();
		}
	}
	render() {
		circle(pinSourceProperties.x, pinSourceProperties.y, pinSourceProperties.diameter);
		stroke(colors.dark);
		strokeWeight(7);
		noFill();
	}
}

class Pin {
	constructor() {
		this.missedTarget = true;
		this.position = createVector(pinSourceProperties.x, pinSourceProperties.y);
		this.pinPointPos = createVector(pinSourceProperties.x, pinSourceProperties.y - pinSourceProperties.pinLength);
		this.tipRadius = pinSourceProperties.tipRadius;
		this.angle = PI/2;
	}

	updateOnTargetPin(didPinHitTarget, pins) {
		const didPinHitPin = this.collision(pins);
		if (didPinHitTarget) {
			this.missedTarget = false;
		} else if (didPinHitPin) {
			environment.endGame();
		} else {
			this.position.y -= pinSourceProperties.speed;
			this.pinPointPos.y -= pinSourceProperties.speed;
		}
	}

	updateStuckPin() {
        this.angle += environment.rotationSpeed;
        const radius = target.diameter/2 + pinSourceProperties.pinLength;
        this.position = createVector(
          target.position.x + radius * cos(this.angle),
          target.position.y + radius * sin(this.angle),
        );
        this.pinPointPos = createVector(
          target.position.x + target.diameter/2 * cos(this.angle),
          target.position.y + target.diameter/2 * sin(this.angle),
        );
	}

	collision(pins) {
		let didPinHitPin = false;
		for (const p of pins) {
			let distance = dist(
				this.pinPointPos.x,
				this.pinPointPos.y,
				p.position.x,
				p.position.y,
			);
			if (distance <= p.tipRadius) {
				didPinHitPin = true;
			}
		}
		return didPinHitPin;
	}

	render() {
		push();
		stroke(colors.dark);
		strokeWeight(1.5);
		line(
			this.position.x,
			this.position.y,
			this.pinPointPos.x,
			this.pinPointPos.y,
		);
		fill(colors.dark);
		circle(this.position.x, this.position.y, this.tipRadius*2);
		pop();
	}
}

class Target {
	constructor() {
		this.position = createVector(targetProperties.x, targetProperties.y);
		this.diameter = targetProperties.diameter;
	}
	render() {
		push();
		translate(this.position.x, this.position.y);
		noStroke();
		fill(colors.dark);
		circle(0, 0, this.diameter);
		pop();
	}
}

class ScoreTracker {
	constructor() {
		this.score = 0;
	}
	resetScore() {
		this.score = 0;
	}
	setScore(score) {
		this.score = score;
	}
	render() {
		push();
		textAlign(CENTER, CENTER);
		noStroke();
		fill(colors.yellow);
		textSize(40);
		text(this.score, targetProperties.x, targetProperties.scoreY);
		pop();

		if (settings.score !== undefined) {
			push();
			textAlign(CENTER, CENTER);
			noStroke();
			fill(colors.dark);
			textSize(15);
			text(`Your Best: ${settings.score}`, targetProperties.x, targetProperties.highScoreY);
			pop();
		}
	}
}

// helper functions
function isEmpty(obj) {
	return typeof obj != 'object' || Object.keys(obj).length === 0;
}