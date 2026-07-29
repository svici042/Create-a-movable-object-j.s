// Selects the interactive playground.
const playground = document.querySelector("#playground");

// Selects the movable object.
const movableObject = document.querySelector("#movable-object");

// Selects the obstacle.
const obstacle = document.querySelector("#obstacle");

// Selects the element that displays the current position.
const positionOutput = document.querySelector("#position-output");

// Selects the status message element.
const message = document.querySelector("#message");

// Defines how many pixels the object moves per arrow key press.
const movementStep = 18;

// Stores the object's horizontal position.
let objectX = 40;

// Stores the object's vertical position.
let objectY = 90;

// Stores the movement animation timer.
let movementTimer;

// Calculates the maximum allowed coordinates inside the playground.
function getPlaygroundLimits() {
  return {
    maxX: playground.clientWidth - movableObject.offsetWidth,
    maxY: playground.clientHeight - movableObject.offsetHeight,
  };
}

// Creates the movable object's rectangular bounds for collision checks.
function getObjectRectangle(x, y) {
  return {
    left: x,
    right: x + movableObject.offsetWidth,
    top: y,
    bottom: y + movableObject.offsetHeight,
  };
}

// Creates the obstacle's rectangular bounds.
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

// Checks whether the object would collide with the obstacle at a new position.
function isCollidingWithObstacle(x, y) {
  const objectRectangle = getObjectRectangle(x, y);

  const obstacleRectangle = getObstacleRectangle();

  return rectanglesOverlap(objectRectangle, obstacleRectangle);
}

// Restricts the coordinates so the object remains inside the playground.
function keepInsidePlayground(x, y) {
  const limits = getPlaygroundLimits();

  return {
    x: Math.min(Math.max(x, 0), limits.maxX),
    y: Math.min(Math.max(y, 0), limits.maxY),
  };
}

// Briefly activates the movement animation.
function showMovementFeedback() {
  movableObject.classList.add("is-moving");

  clearTimeout(movementTimer);

  movementTimer = setTimeout(function () {
    movableObject.classList.remove("is-moving");
  }, 180);
}

// Displays a visual effect and message when a collision occurs.
function showCollisionFeedback() {
  obstacle.classList.remove("is-hit");

  // Forces a layout recalculation so the animation can restart.
  void obstacle.offsetWidth;

  obstacle.classList.add("is-hit");

  message.textContent = "Obstacle detected. Choose another direction.";

  setTimeout(function () {
    obstacle.classList.remove("is-hit");
  }, 320);
}

// Validates and updates the movable object's position.
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

// Centers the object on the clicked playground position.
function handlePlaygroundClick(event) {
  const playgroundRectangle = playground.getBoundingClientRect();

  const clickedX =
    event.clientX - playgroundRectangle.left - movableObject.offsetWidth / 2;

  const clickedY =
    event.clientY - playgroundRectangle.top - movableObject.offsetHeight / 2;

  updatePosition(clickedX, clickedY);

  playground.focus();
}

// Keeps the object visible after the browser window is resized.
function restoreVisiblePosition() {
  updatePosition(objectX, objectY);
}

// Registers keyboard, mouse, and window resize event listeners.
document.addEventListener("keydown", handleKeyboardMovement);

playground.addEventListener("click", handlePlaygroundClick);

window.addEventListener("resize", restoreVisiblePosition);

// Sets the object's initial position.
updatePosition(objectX, objectY);

// Focuses the playground so keyboard controls work immediately.
playground.focus();
