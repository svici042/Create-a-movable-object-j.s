// Randama interaktyvi žaidimo zona.
const playground = document.querySelector("#playground");

// Randamas valdomas objektas.
const movableObject = document.querySelector("#movable-object");

// Randama kliūtis.
const obstacle = document.querySelector("#obstacle");

// Randamas elementas, kuriame rodoma dabartinė pozicija.
const positionOutput = document.querySelector("#position-output");

// Randamas būsenos pranešimo elementas.
const message = document.querySelector("#message");

// Nustatoma, kiek pikselių objektas pajuda vienu rodyklės klavišo paspaudimu.
const movementStep = 18;

// Saugoma horizontali objekto pozicija.
let objectX = 40;

// Saugoma vertikali objekto pozicija.
let objectY = 90;

// Saugomas judėjimo animacijos laikmačio identifikatorius.
let movementTimer;

// Apskaičiuojamos didžiausios leistinos objekto koordinatės žaidimo zonoje.
function getPlaygroundLimits() {
  return {
    maxX: playground.clientWidth - movableObject.offsetWidth,
    maxY: playground.clientHeight - movableObject.offsetHeight,
  };
}

// Sukuriamos valdomo objekto stačiakampio ribos susidūrimams tikrinti.
function getObjectRectangle(x, y) {
  return {
    left: x,
    right: x + movableObject.offsetWidth,
    top: y,
    bottom: y + movableObject.offsetHeight,
  };
}

// Sukuriamos kliūties stačiakampio ribos.
function getObstacleRectangle() {
  return {
    left: obstacle.offsetLeft,
    right: obstacle.offsetLeft + obstacle.offsetWidth,
    top: obstacle.offsetTop,
    bottom: obstacle.offsetTop + obstacle.offsetHeight,
  };
}

// Patikrinama, ar du stačiakampiai persidengia.
function rectanglesOverlap(firstRectangle, secondRectangle) {
  return (
    firstRectangle.left < secondRectangle.right &&
    firstRectangle.right > secondRectangle.left &&
    firstRectangle.top < secondRectangle.bottom &&
    firstRectangle.bottom > secondRectangle.top
  );
}

// Patikrinama, ar naujoje pozicijoje objektas susidurtų su kliūtimi.
function isCollidingWithObstacle(x, y) {
  const objectRectangle = getObjectRectangle(x, y);

  const obstacleRectangle = getObstacleRectangle();

  return rectanglesOverlap(objectRectangle, obstacleRectangle);
}

// Koordinatės apribojamos taip, kad objektas neišeitų už žaidimo zonos.
function keepInsidePlayground(x, y) {
  const limits = getPlaygroundLimits();

  return {
    x: Math.min(Math.max(x, 0), limits.maxX),
    y: Math.min(Math.max(y, 0), limits.maxY),
  };
}

// Trumpam įjungiama judėjimo animacija.
function showMovementFeedback() {
  movableObject.classList.add("is-moving");

  clearTimeout(movementTimer);

  movementTimer = setTimeout(function () {
    movableObject.classList.remove("is-moving");
  }, 180);
}

// Parodomas vaizdinis efektas ir pranešimas susidūrus su kliūtimi.
function showCollisionFeedback() {
  obstacle.classList.remove("is-hit");

  // Priverstinis išdėstymo perskaičiavimas leidžia animaciją paleisti iš naujo.
  void obstacle.offsetWidth;

  obstacle.classList.add("is-hit");

  message.textContent = "Obstacle detected. Choose another direction.";

  setTimeout(function () {
    obstacle.classList.remove("is-hit");
  }, 320);
}

// Patikrinama ir atnaujinama valdomo objekto pozicija.
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

// Objektas perkeliamas paspaudus vieną iš rodyklių klavišų.
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

// Objektas centruojamas ties paspausta žaidimo zonos vieta.
function handlePlaygroundClick(event) {
  const playgroundRectangle = playground.getBoundingClientRect();

  const clickedX =
    event.clientX - playgroundRectangle.left - movableObject.offsetWidth / 2;

  const clickedY =
    event.clientY - playgroundRectangle.top - movableObject.offsetHeight / 2;

  updatePosition(clickedX, clickedY);

  playground.focus();
}

// Pakeitus lango dydį objekto pozicija vėl apribojama matoma zona.
function restoreVisiblePosition() {
  updatePosition(objectX, objectY);
}

// Užregistruojami klaviatūros, pelės ir lango dydžio keitimo įvykiai.
document.addEventListener("keydown", handleKeyboardMovement);

playground.addEventListener("click", handlePlaygroundClick);

window.addEventListener("resize", restoreVisiblePosition);

// Nustatoma pradinė objekto pozicija.
updatePosition(objectX, objectY);

// Fokusas suteikiamas žaidimo zonai, kad iš karto veiktų valdymas klaviatūra.
playground.focus();
