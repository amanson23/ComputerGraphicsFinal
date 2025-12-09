let handpose;
let video;
let predictions = [];
let lastDrawnPredictions = [];

let leftScore = 0;
let rightScore = 0;
let particles = [];
let leftPaddle, rightPaddle, ball;
let videoBuffer;

// Game constants
const PADDLE_WIDTH = 10;
const PADDLE_HEIGHT = 80;
const BALL_RADIUS = 10;
const PADDLE_MARGIN = 20; // Distance from paddle to edge of screen

const bounceSound = new Audio('assets/arcadeUI7.mp3');
const scoreSound = new Audio('assets/arcadeUI12.mp3');

// Performance optimization
let frameSkip = 3;
let mobileFrameCount = 0;


// Creates the canvas, turns on the camera, sets the size
function setup() {
  createCanvas(windowWidth, windowHeight * 0.6);
  videoBuffer = createGraphics(width, height);

  const constraints = {
    audio: false,
    video: {
      facingMode: "user",
      width: { ideal: 640 },
      height: { ideal: 480 }
    }
  };

  video = createCapture(constraints);
  video.size(width, height);
  video.hide();

  handpose = ml5.handpose(video, () => {
    console.log("Model ready!");
  });

  handpose.on("prediction", (results) => { // Note: ml5.js v0.12.2 uses 'prediction'
    predictions = results;
  });

  leftPaddle = new Paddle(PADDLE_MARGIN, 'aqua');
  rightPaddle = new Paddle(width - PADDLE_WIDTH - PADDLE_MARGIN, 'red');
  ball = new Ball();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight * 0.6);
  videoBuffer.resize(width, height);
  video.size(width, height);
  // Re-initialize paddles and ball to adjust to new dimensions
  leftPaddle = new Paddle(PADDLE_MARGIN, 'aqua');
  rightPaddle = new Paddle(width - PADDLE_WIDTH - PADDLE_MARGIN, 'red');
  ball.reset();
}


// Draws everything onto the web page
function draw() {
  mobileFrameCount++;
  // Throttle handpose processing and video drawing for performance
  if (mobileFrameCount % frameSkip === 0) {
    // Draw the video to the off-screen buffer, flipped
    videoBuffer.push();
    videoBuffer.translate(width, 0);
    videoBuffer.scale(-1, 1);
    videoBuffer.image(video, 0, 0, width, height);
    videoBuffer.pop();
    lastDrawnPredictions = predictions; // Store the latest predictions
  }

  // Draw the buffer to the main canvas on every frame
  image(videoBuffer, 0, 0);


  // Use the stored predictions to update paddle positions
  // This ensures paddle movement is still smooth even if video/prediction is skipped
  if (lastDrawnPredictions.length > 0) {
    let hand = lastDrawnPredictions[0];
    let thumbTip = hand.annotations.thumb[3];
    let pinkyTip = hand.annotations.pinky[3];

    if (thumbTip && pinkyTip) {
      // The video is flipped, so thumb controls the right paddle and pinky controls the left.
      let rightPaddleY = thumbTip[1];
      let leftPaddleY = pinkyTip[1];

      // Sets the left paddle's y level to the thumb and right paddle's y level to the pinky
      leftPaddle.y = constrain(leftPaddleY - leftPaddle.h / 2, 0, height - leftPaddle.h);
      rightPaddle.y = constrain(rightPaddleY - rightPaddle.h / 2, 0, height - rightPaddle.h);
    }
  }

  // Draws the paddles and the ball each frame
  leftPaddle.display();
  rightPaddle.display();
  ball.update();
  ball.display();

  //Checks if the ball and paddles are colliding
  ball.checkPaddleCollision(leftPaddle);
  ball.checkPaddleCollision(rightPaddle);

  // Display scores
  rectMode(CENTER);
  noStroke();
  fill(0, 150);
  rect(width / 4, 50, 60, 50);
  rect((width / 4) * 3, 50, 60, 50);
  textSize(32);
  fill('aqua');
  textAlign(CENTER, CENTER);
  text(leftScore, width / 4, 50);
  fill('red')
  text(rightScore, (width / 4) * 3, 50);

  // Update and display particles
  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update();
    particles[i].display();
    if (particles[i].isFinished()) {
      particles.splice(i, 1);
    }
  }
}

// Class to call a constructor to draw a paddle
class Paddle {
  constructor(x, color) {
    this.x = x;
    this.y = height / 2 - PADDLE_HEIGHT / 2;
    this.w = PADDLE_WIDTH;
    this.h = PADDLE_HEIGHT;
    this.color = color;
  }

  display() {
    fill(this.color);
    rect(this.x, this.y, this.w, this.h);
  }
}

// Class to call a constructor to draw a ball
class Ball {
  constructor() {
    this.reset();
  }

  // Resets the ball to the middle and sets a random speed and direction
  reset() {
    this.x = width / 2;
    this.y = height / 2;
    this.r = BALL_RADIUS;
    this.speed = 5;
    this.xSpeed = random() > 0.5 ? this.speed : -this.speed;
    this.ySpeed = random(-this.speed, this.speed);
  }

  // Updates the ball's position based on the x and y speeds
  update() {
    this.x += this.xSpeed;
    this.y += this.ySpeed;

    // Checks if the ball hits the top or bottom of the canvas, reversed speed to "bounce"
    if (this.y < 0 || this.y > height) {
      this.ySpeed *= -1;
      bounceSound.play();
    }

    // Checks if ball hits left or right of canvas, resets ball, adds 1 to score
    if (this.x < 0) {
      rightScore++; // Player on the right scores
      scoreSound.play();
      this.reset();
    } else if (this.x > width) {
      leftScore++; // Player on the left scores
      scoreSound.play();
      this.reset();
    }
  }

  // Draws the ball
  display() {
    fill(255);
    ellipse(this.x, this.y, this.r * 2);
  }

  // Checks if the ball and paddle collide
  checkPaddleCollision(paddle) {
    if (
      this.x - this.r < paddle.x + paddle.w &&
      this.x + this.r > paddle.x &&
      this.y > paddle.y &&
      this.y < paddle.y + paddle.h
    ) { // If ball and paddle collide, reversed direction and gives it a random speed
      this.xSpeed *= -1;
      this.x += this.xSpeed > 0 ? 5 : -5;

      // Create a particle burst on collision
      for (let i = 0; i < 10; i++) {
        let p = new Particle(this.x, this.y, paddle.color);
        particles.push(p);
      }
      bounceSound.play();
    }
  }
}

class Particle {
  constructor(x, y, particleColor) {
    this.x = x;
    this.y = y;
    this.vx = random(-2, 2);
    this.vy = random(-3, 3);
    this.alpha = 255;
    this.color = particleColor;
    this.size = random(3, 7);
  }

  isFinished() {
    return this.alpha < 0;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.alpha -= 6;
  }

  display() {
    noStroke();
    // Use p5.js color object to handle color names and set alpha
    let c = color(this.color);
    fill(red(c), green(c), blue(c), this.alpha);
    ellipse(this.x, this.y, this.size);
  }
}
