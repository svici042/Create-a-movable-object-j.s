// Selects the playground element.
const playground = document.querySelector("#playground");

// Selects the movable object.
const movableObject = document.querySelector("#movable-object");

// Selects the obstacle element.
const obstacle = document.querySelector("#obstacle");

// Selects the position output element.
const positionOutput = document.querySelector("#position-output");

// Selects the message element.
const message = document.querySelector("#message");

// Defines how many pixels the object moves with each arrow key press.
const movementStep = 18;

// Stores the horizontal position of the object.
let objectX = 40;

// Stores the vertical position of the object.
let objectY = 90;

// Stores the movement animation timer.
let movementTimer;

// Returns the maximum allowed object position inside the playground.
function getPlaygroundLimits() {
  return {
    maxX: playground.clientWidth - movableObject.offsetWidth,
    maxY: playground.clientHeight - movableObject.offsetHeight,
  };
}

// Creates a rectangle object for the movable object.
function getObjectRectangle(x, y) {
  return {
    left: x,
    right: x + movableObject.offsetWidth,
    top: y,
    bottom: y + movableObject.offsetHeight,
  };
}

// Creates a rectangle object for the obstacle.
function getObstacleRectangle() {
  return {
    left: obstacle.offsetLeft,
    right: obstacle.offsetLeft + obstacle.offsetWidth,
    top: obstacle.offsetTop,
    bottom: obstacle.offsetTop + obstacle.offsetHeight,
  };
}

// Checks whether two rectangles overlap.
function rectanglesOverlap(firstRectangle, secondRectangle) {
  return (
    firstRectangle.left < secondRectangle.right &&
    firstRectangle.right > secondRectangle.left &&
    firstRectangle.top < secondRectangle.bottom &&
    firstRectangle.bottom > secondRectangle.top
  );
}

// Checks whether the movable object collides with the obstacle.
function isCollidingWithObstacle(x, y) {
  const objectRectangle = getObjectRectangle(x, y);

  const obstacleRectangle = getObstacleRectangle();

  return rectanglesOverlap(objectRectangle, obstacleRectangle);
}

// Keeps the movable object inside the playground boundaries.
function keepInsidePlayground(x, y) {
  const limits = getPlaygroundLimits();

  return {
    x: Math.min(Math.max(x, 0), limits.maxX),
    y: Math.min(Math.max(y, 0), limits.maxY),
  };
}

// Adds a short visual effect when the object moves.
function showMovementFeedback() {
  movableObject.classList.add("is-moving");

  clearTimeout(movementTimer);

  movementTimer = setTimeout(function () {
    movableObject.classList.remove("is-moving");
  }, 180);
}

// Shows a visual message when the object hits the obstacle.
function showCollisionFeedback() {
  obstacle.classList.remove("is-hit");

  void obstacle.offsetWidth;

  obstacle.classList.add("is-hit");

  message.textContent = "Obstacle detected. Choose another direction.";

  setTimeout(function () {
    obstacle.classList.remove("is-hit");
  }, 320);
}

// Updates the position of the movable object.
function updatePosition(x, y) {
  const safePosition = keepInsidePlayground(x, y);

  if (isCollidingWithObstacle(safePosition.x, safePosition.y)) {
    showCollisionFeedback();

    return;
  }

  objectX = safePosition.x;

  objectY = safePosition.y;

  movableObject.style.left = objectX + "px";

  movableObject.style.top = objectY + "px";

  positionOutput.textContent =
    "X: " + Math.round(objectX) + " · Y: " + Math.round(objectY);

  message.textContent = "Object moved successfully.";

  showMovementFeedback();
}

// Moves the object when an arrow key is pressed.
function handleKeyboardMovement(event) {
  const movementKeys = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];

  if (!movementKeys.includes(event.key)) {
    return;
  }

  event.preventDefault();

  let nextX = objectX;

  let nextY = objectY;

  if (event.key === "ArrowUp") {
    nextY -= movementStep;
  }

  if (event.key === "ArrowDown") {
    nextY += movementStep;
  }

  if (event.key === "ArrowLeft") {
    nextX -= movementStep;
  }

  if (event.key === "ArrowRight") {
    nextX += movementStep;
  }

  updatePosition(nextX, nextY);
}

// Moves the object to the clicked position inside the playground.
function handlePlaygroundClick(event) {
  const playgroundRectangle = playground.getBoundingClientRect();

  const clickedX =
    event.clientX - playgroundRectangle.left - movableObject.offsetWidth / 2;

  const clickedY =
    event.clientY - playgroundRectangle.top - movableObject.offsetHeight / 2;

  updatePosition(clickedX, clickedY);

  playground.focus();
}

// Restores a valid object position after resizing the browser window.
function restoreVisiblePosition() {
  updatePosition(objectX, objectY);
}

// Listens for keyboard events.
document.addEventListener("keydown", handleKeyboardMovement);

// Listens for mouse clicks inside the playground.
playground.addEventListener("click", handlePlaygroundClick);

// Listens for browser window resizing.
window.addEventListener("resize", restoreVisiblePosition);

// Sets the initial position of the object.
updatePosition(objectX, objectY);

// Gives keyboard focus to the playground.
playground.focus();
