// Cache the DOM elements used throughout the application.
const playground = document.querySelector("#playground");
const movableObject = document.querySelector("#movable-object");
const mazeWallContainer = document.querySelector("#maze-walls");
const startArea = document.querySelector("#start-area");
const finishArea = document.querySelector("#finish-area");
const positionOutput = document.querySelector("#position-output");
const message = document.querySelector("#message");

// Gameplay, feedback, camera, and responsive-layout settings.
const movementSpeed = 165;
const collisionCheckStep = 4;
const maximumDeltaTime = 0.04;
const cameraTriggerRatio = 0.15;
const cameraVisibilityMarginRatio = 0.05;
const cameraScrollRatio = 0.85;
const cameraCooldownDuration = 650;
const movementFeedbackDuration = 180;
const collisionFeedbackDuration = 320;
const collisionFeedbackThrottle = 180;
const finishMessageDuration = 1800;
const finishOverlapRatio = 0.35;
const resizeDebounceDuration = 120;
const wallThickness = 12;
const mazeRowCount = 20;
const minimumCorridorWidth = 105;

// Mutable maze, position, layout, timer, and input state.
let mazeWalls = [];
let wallRectangles = [];
let mazeData;
let objectX = 0;
let objectY = 0;
let objectWidth = 0;
let objectHeight = 0;
let playgroundMaxX = 0;
let playgroundMaxY = 0;
let playgroundDocumentTop = 0;
let finishRectangle;
let displayedCoordinateX;
let displayedCoordinateY;
let movementTimer;
let collisionTimer;
let finishTimer;
let resizeTimer;
let cameraTimer;
let isInsideFinish = false;
let isCameraScrolling = false;
let animationFrameId = null;
let previousFrameTime = null;
let lastCollisionWall = null;
let lastCollisionTime = 0;
const pressedKeys = new Set();
const movementKeys = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "w",
  "a",
  "s",
  "d",
]);

function getPlaygroundLimits() {
  return {
    maxX: playgroundMaxX,
    maxY: playgroundMaxY,
  };
}

function getObjectRectangle(x, y) {
  return {
    left: x,
    right: x + objectWidth,
    top: y,
    bottom: y + objectHeight,
  };
}

function getElementRectangle(element) {
  return {
    left: element.offsetLeft,
    right: element.offsetLeft + element.offsetWidth,
    top: element.offsetTop,
    bottom: element.offsetTop + element.offsetHeight,
  };
}

function getMazeColumnCount(playgroundWidth) {
  // Use as many columns as fit without making corridors too narrow.
  for (let columns = 8; columns >= 2; columns -= 1) {
    const corridorWidth =
      (playgroundWidth - (columns + 1) * wallThickness) / columns;

    if (corridorWidth >= minimumCorridorWidth) {
      return columns;
    }
  }

  return 2;
}

function createSeededRandom(seed) {
  // A seeded generator keeps the maze identical for the same dimensions.
  let currentSeed = seed >>> 0;

  return function () {
    currentSeed = (currentSeed * 1664525 + 1013904223) >>> 0;
    return currentSeed / 4294967296;
  };
}

function createPerfectMaze(rows, columns) {
  const cellCount = rows * columns;

  // Try deterministic seed variations until the maze has enough dead ends.
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const random = createSeededRandom(rows * 1009 + columns * 9176 + attempt);
    const edges = [];
    const parent = Array.from({ length: cellCount }, (_, index) => index);
    const rank = Array(cellCount).fill(0);
    const passages = Array.from({ length: cellCount }, () => []);

    function find(cell) {
      // Path compression makes repeated set lookups faster.
      if (parent[cell] !== cell) {
        parent[cell] = find(parent[cell]);
      }

      return parent[cell];
    }

    function unite(firstCell, secondCell) {
      const firstRoot = find(firstCell);
      const secondRoot = find(secondCell);

      if (firstRoot === secondRoot) {
        return false;
      }

      if (rank[firstRoot] < rank[secondRoot]) {
        parent[firstRoot] = secondRoot;
      } else if (rank[firstRoot] > rank[secondRoot]) {
        parent[secondRoot] = firstRoot;
      } else {
        parent[secondRoot] = firstRoot;
        rank[firstRoot] += 1;
      }

      return true;
    }

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const cell = row * columns + column;

        if (column + 1 < columns) {
          edges.push({
            firstCell: cell,
            secondCell: cell + 1,
            direction: "right",
            weight: random(),
          });
        }

        if (row + 1 < rows) {
          edges.push({
            firstCell: cell,
            secondCell: cell + columns,
            direction: "down",
            weight: random(),
          });
        }
      }
    }

    edges.sort(function (firstEdge, secondEdge) {
      return firstEdge.weight - secondEdge.weight;
    });

    // Kruskal's algorithm opens passages without introducing cycles.
    const openEdges = [];

    edges.forEach(function (edge) {
      if (unite(edge.firstCell, edge.secondCell)) {
        openEdges.push(edge);
        passages[edge.firstCell].push(edge.secondCell);
        passages[edge.secondCell].push(edge.firstCell);
      }
    });

    const startCell = Math.floor(columns / 2);
    const finishCell = (rows - 1) * columns + Math.floor((columns - 1) / 2);
    const deadEndCount = passages.filter(function (neighbors, cell) {
      return (
        neighbors.length === 1 && cell !== startCell && cell !== finishCell
      );
    }).length;

    if (deadEndCount >= 8) {
      return {
        rows,
        columns,
        passages,
        openEdges,
        startCell,
        finishCell,
        deadEndCount,
      };
    }
  }

  throw new Error("Unable to create a maze with enough dead ends.");
}

function validatePerfectMaze(data) {
  const cellCount = data.rows * data.columns;
  const visited = new Set([data.startCell]);
  const pendingCells = [data.startCell];

  while (pendingCells.length > 0) {
    const cell = pendingCells.pop();

    data.passages[cell].forEach(function (neighbor) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        pendingCells.push(neighbor);
      }
    });
  }

  // A perfect maze must be fully connected and contain exactly one route
  // between any two cells.
  return visited.size === cellCount && data.openEdges.length === cellCount - 1;
}

function createWallElement(left, top, width, height, fragment) {
  const wall = document.createElement("div");
  wall.classList.add("maze-wall");
  wall.style.left = left + "px";
  wall.style.top = top + "px";
  wall.style.width = width + "px";
  wall.style.height = height + "px";
  fragment.appendChild(wall);
}

function addHorizontalWallRuns(lines, cellWidth, fragment) {
  const horizontalPitch = cellWidth + wallThickness;

  // Merge adjacent wall segments into longer DOM elements.
  lines.forEach(function (line, row) {
    let runStart = -1;

    for (let column = 0; column <= line.length; column += 1) {
      const isClosed = column < line.length && line[column];

      if (isClosed && runStart === -1) {
        runStart = column;
      }

      if (!isClosed && runStart !== -1) {
        createWallElement(
          runStart * horizontalPitch,
          row * (mazeData.cellHeight + wallThickness),
          (column - runStart) * horizontalPitch + wallThickness,
          wallThickness,
          fragment,
        );
        runStart = -1;
      }
    }
  });
}

function addVerticalWallRuns(lines, cellHeight, fragment) {
  const verticalPitch = cellHeight + wallThickness;

  // Merge adjacent wall segments to keep the wall element count low.
  lines.forEach(function (line, column) {
    let runStart = -1;

    for (let row = 0; row <= line.length; row += 1) {
      const isClosed = row < line.length && line[row];

      if (isClosed && runStart === -1) {
        runStart = row;
      }

      if (!isClosed && runStart !== -1) {
        createWallElement(
          column * (mazeData.cellWidth + wallThickness),
          runStart * verticalPitch,
          wallThickness,
          (row - runStart) * verticalPitch + wallThickness,
          fragment,
        );
        runStart = -1;
      }
    }
  });
}

function positionGoalArea(element, cell, alignToBottom) {
  const row = Math.floor(cell / mazeData.columns);
  const column = cell % mazeData.columns;
  const goalSize = Math.min(
    112,
    mazeData.cellWidth - 12,
    mazeData.cellHeight - 12,
  );
  const cellLeft =
    wallThickness + column * (mazeData.cellWidth + wallThickness);
  const cellTop =
    wallThickness + row * (mazeData.cellHeight + wallThickness);

  element.style.width = goalSize + "px";
  element.style.height = goalSize + "px";
  element.style.left =
    cellLeft + (mazeData.cellWidth - goalSize) / 2 + "px";
  element.style.top =
    cellTop +
    (alignToBottom ? mazeData.cellHeight - goalSize - 10 : 10) +
    "px";
}

function buildMaze() {
  const playgroundWidth = playground.clientWidth;
  const playgroundHeight = playground.clientHeight;
  const columns = getMazeColumnCount(playgroundWidth);

  mazeData = createPerfectMaze(mazeRowCount, columns);

  if (!validatePerfectMaze(mazeData)) {
    throw new Error("The deterministic maze must be connected and cycle-free.");
  }

  mazeData.cellWidth =
    (playgroundWidth - (columns + 1) * wallThickness) / columns;
  mazeData.cellHeight =
    (playgroundHeight - (mazeRowCount + 1) * wallThickness) / mazeRowCount;

  // Closed grid edges begin as walls; maze passages remove selected edges.
  const horizontalLines = Array.from(
    { length: mazeRowCount + 1 },
    () => Array(columns).fill(true),
  );
  const verticalLines = Array.from(
    { length: columns + 1 },
    () => Array(mazeRowCount).fill(true),
  );

  mazeData.openEdges.forEach(function (edge) {
    const firstRow = Math.floor(edge.firstCell / columns);
    const firstColumn = edge.firstCell % columns;

    if (edge.direction === "right") {
      verticalLines[firstColumn + 1][firstRow] = false;
    } else {
      horizontalLines[firstRow + 1][firstColumn] = false;
    }
  });

  horizontalLines[0][mazeData.startCell % columns] = false;
  horizontalLines[mazeRowCount][mazeData.finishCell % columns] = false;

  mazeWallContainer.replaceChildren();
  const fragment = document.createDocumentFragment();
  addHorizontalWallRuns(horizontalLines, mazeData.cellWidth, fragment);
  addVerticalWallRuns(verticalLines, mazeData.cellHeight, fragment);
  mazeWallContainer.appendChild(fragment);

  mazeWalls = Array.from(mazeWallContainer.querySelectorAll(".maze-wall"));
  // Cache maze-local wall geometry once per build instead of reading layout
  // during every collision sub-step.
  wallRectangles = mazeWalls.map(function (wall) {
    return {
      element: wall,
      rectangle: getElementRectangle(wall),
    };
  });

  positionGoalArea(startArea, mazeData.startCell, false);
  positionGoalArea(finishArea, mazeData.finishCell, true);
  // These measurements remain stable until the next responsive maze rebuild.
  objectWidth = movableObject.offsetWidth;
  objectHeight = movableObject.offsetHeight;
  playgroundMaxX = playground.clientWidth - objectWidth;
  playgroundMaxY = playground.clientHeight - objectHeight;
  playgroundDocumentTop =
    playground.getBoundingClientRect().top + window.scrollY;
  finishRectangle = getElementRectangle(finishArea);
}

function getCollidingWall(x, y) {
  const objectRight = x + objectWidth;
  const objectBottom = y + objectHeight;

  // Stop at the first wall intersecting the sphere's full bounding rectangle.
  for (const wallData of wallRectangles) {
    const wall = wallData.rectangle;

    if (
      x < wall.right &&
      objectRight > wall.left &&
      y < wall.bottom &&
      objectBottom > wall.top
    ) {
      return wallData.element;
    }
  }

  return null;
}

function keepInsidePlayground(x, y) {
  const limits = getPlaygroundLimits();

  return {
    x: Math.min(Math.max(x, 0), limits.maxX),
    y: Math.min(Math.max(y, 0), limits.maxY),
  };
}

function getStartPosition() {
  return keepInsidePlayground(
    startArea.offsetLeft + (startArea.offsetWidth - objectWidth) / 2,
    startArea.offsetTop + (startArea.offsetHeight - objectHeight) / 2,
  );
}

function showMovementFeedback() {
  movableObject.classList.add("is-moving");
  clearTimeout(movementTimer);
  movementTimer = setTimeout(function () {
    movableObject.classList.remove("is-moving");
    movementTimer = undefined;
  }, movementFeedbackDuration);
}

function showCollisionFeedback(wall) {
  const now = performance.now();

  if (
    wall === lastCollisionWall &&
    now - lastCollisionTime < collisionFeedbackThrottle
  ) {
    return;
  }

  lastCollisionWall = wall;
  lastCollisionTime = now;
  mazeWalls.forEach(function (mazeWall) {
    mazeWall.classList.remove("is-hit");
  });
  wall.classList.add("is-hit");

  if (message.textContent !== "Wall detected. Choose another direction.") {
    message.textContent = "Wall detected. Choose another direction.";
  }
  clearTimeout(collisionTimer);
  collisionTimer = setTimeout(function () {
    wall.classList.remove("is-hit");
    collisionTimer = undefined;
  }, collisionFeedbackDuration);
}

function hasReachedFinish(x, y) {
  const objectRectangle = getObjectRectangle(x, y);
  const overlapWidth = Math.max(
    0,
    Math.min(objectRectangle.right, finishRectangle.right) -
      Math.max(objectRectangle.left, finishRectangle.left),
  );
  const overlapHeight = Math.max(
    0,
    Math.min(objectRectangle.bottom, finishRectangle.bottom) -
      Math.max(objectRectangle.top, finishRectangle.top),
  );
  const overlapArea = overlapWidth * overlapHeight;
  const objectArea = objectWidth * objectHeight;

  // Require meaningful overlap instead of triggering on a light edge touch.
  return overlapArea >= objectArea * finishOverlapRatio;
}

function updateFinishState() {
  const finishReached = hasReachedFinish(objectX, objectY);

  if (finishReached && !isInsideFinish) {
    isInsideFinish = true;
    finishArea.classList.remove("is-complete");
    void finishArea.offsetWidth;
    finishArea.classList.add("is-complete");
    message.textContent = "Finished!";
    clearTimeout(finishTimer);
    finishTimer = setTimeout(function () {
      finishArea.classList.remove("is-complete");
      message.textContent = "Move again or return to FINISH.";
      finishTimer = undefined;
    }, finishMessageDuration);
  } else if (!finishReached && isInsideFinish) {
    isInsideFinish = false;
    clearTimeout(finishTimer);
    finishArea.classList.remove("is-complete");
  }
}

function applyPosition(x, y) {
  objectX = x;
  objectY = y;
  movableObject.style.left = objectX + "px";
  movableObject.style.top = objectY + "px";
  const roundedX = Math.round(objectX);
  const roundedY = Math.round(objectY);

  // Coordinates are visual-only, so avoid rewriting unchanged rounded values.
  if (roundedX !== displayedCoordinateX || roundedY !== displayedCoordinateY) {
    displayedCoordinateX = roundedX;
    displayedCoordinateY = roundedY;
    positionOutput.textContent = "X: " + roundedX + " · Y: " + roundedY;
  }

  updateFinishState();
}

function getCameraTriggerBounds(viewportHeight) {
  return {
    top: viewportHeight * cameraTriggerRatio,
    bottom: viewportHeight * (1 - cameraTriggerRatio),
  };
}

function getMaximumScrollTop(viewportHeight) {
  return Math.max(
    0,
    document.documentElement.scrollHeight - viewportHeight,
  );
}

function resetCameraScrollState() {
  clearTimeout(cameraTimer);
  cameraTimer = undefined;
  isCameraScrolling = false;
}

function scrollCameraByViewport(direction, sphereRectangle, viewportHeight) {
  const maximumScrollTop = getMaximumScrollTop(viewportHeight);
  const preferredDistance = viewportHeight * cameraScrollRatio;
  const visibilityMargin = viewportHeight * cameraVisibilityMarginRatio;
  let availableVisibilityDistance;

  // Shorten the preferred scroll when a full step would hide the sphere at
  // the opposite edge of the viewport.
  if (direction > 0) {
    availableVisibilityDistance =
      sphereRectangle.top - visibilityMargin;
  } else {
    availableVisibilityDistance =
      viewportHeight - visibilityMargin - sphereRectangle.bottom;
  }

  const safeDistance = Math.max(
    0,
    Math.min(preferredDistance, availableVisibilityDistance),
  );
  const targetScrollTop = Math.min(
    Math.max(window.scrollY + safeDistance * direction, 0),
    maximumScrollTop,
  );

  if (targetScrollTop === window.scrollY) {
    return;
  }

  isCameraScrolling = true;
  window.scrollTo({
    top: targetScrollTop,
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth",
  });

  cameraTimer = setTimeout(resetCameraScrollState, cameraCooldownDuration);
}

function updateCameraFollow(verticalMovement) {
  if (verticalMovement === 0 || isCameraScrolling || document.hidden) {
    return;
  }

  const viewportHeight = window.innerHeight;
  const triggerBounds = getCameraTriggerBounds(viewportHeight);
  // Derive viewport coordinates without reading layout after position writes.
  const sphereTop = playgroundDocumentTop + objectY - window.scrollY;
  const sphereRectangle = {
    top: sphereTop,
    bottom: sphereTop + objectHeight,
  };

  if (
    verticalMovement > 0 &&
    sphereRectangle.bottom >= triggerBounds.bottom
  ) {
    scrollCameraByViewport(1, sphereRectangle, viewportHeight);
  } else if (
    verticalMovement < 0 &&
    sphereRectangle.top <= triggerBounds.top
  ) {
    scrollCameraByViewport(-1, sphereRectangle, viewportHeight);
  }
}

function validateMovementPath(startX, startY, targetX, targetY) {
  const safeTarget = keepInsidePlayground(targetX, targetY);
  const distanceX = safeTarget.x - startX;
  const distanceY = safeTarget.y - startY;
  const stepCount = Math.max(
    1,
    Math.ceil(Math.hypot(distanceX, distanceY) / collisionCheckStep),
  );

  // Inspect the complete straight path in steps smaller than wall thickness.
  for (let step = 1; step <= stepCount; step += 1) {
    const progress = step / stepCount;
    const collidingWall = getCollidingWall(
      startX + distanceX * progress,
      startY + distanceY * progress,
    );

    if (collidingWall) {
      return {
        isValid: false,
        wall: collidingWall,
        lastValidProgress: (step - 1) / stepCount,
        target: safeTarget,
      };
    }
  }

  return { isValid: true, wall: null, lastValidProgress: 1, target: safeTarget };
}

function tryMoveVector(deltaX, deltaY) {
  const startX = objectX;
  const startY = objectY;
  const result = validateMovementPath(
    startX,
    startY,
    startX + deltaX,
    startY + deltaY,
  );

  if (result.isValid) {
    const moved =
      result.target.x !== startX || result.target.y !== startY;

    if (moved) {
      applyPosition(result.target.x, result.target.y);
    }

    return { moved, wall: null };
  }

  // A blocked move may advance only to its last collision-free sub-step.
  if (result.lastValidProgress > 0) {
    applyPosition(
      startX + (result.target.x - startX) * result.lastValidProgress,
      startY + (result.target.y - startY) * result.lastValidProgress,
    );
  }

  return {
    moved: result.lastValidProgress > 0,
    wall: result.wall,
  };
}

function tryMoveWithSliding(deltaX, deltaY) {
  const distance = Math.hypot(deltaX, deltaY);

  if (distance === 0) {
    return false;
  }

  // Split long frame vectors so low frame rates cannot tunnel through walls.
  const stepCount = Math.max(1, Math.ceil(distance / collisionCheckStep));
  const stepX = deltaX / stepCount;
  const stepY = deltaY / stepCount;
  let moved = false;
  let blockingWall = null;

  for (let step = 0; step < stepCount; step += 1) {
    const fullMove = tryMoveVector(stepX, stepY);

    if (!fullMove.wall) {
      moved = fullMove.moved || moved;
      continue;
    }

    blockingWall = fullMove.wall;

    // A blocked diagonal may slide on one clear axis, never both in one step.
    const preferX = Math.abs(stepX) >= Math.abs(stepY);
    const firstX = preferX ? stepX : 0;
    const firstY = preferX ? 0 : stepY;
    const secondX = preferX ? 0 : stepX;
    const secondY = preferX ? stepY : 0;
    const firstMove = tryMoveVector(firstX, firstY);

    if (!firstMove.wall && firstMove.moved) {
      moved = true;
      continue;
    }

    const secondMove = tryMoveVector(secondX, secondY);

    if (!secondMove.wall && secondMove.moved) {
      moved = true;
      continue;
    }

    blockingWall = firstMove.wall || secondMove.wall || blockingWall;
    break;
  }

  if (blockingWall) {
    showCollisionFeedback(blockingWall);
  }

  return moved;
}

function isMovementKey(key) {
  return movementKeys.has(key.length === 1 ? key.toLowerCase() : key);
}

function normalizeMovementKey(key) {
  return key.length === 1 ? key.toLowerCase() : key;
}

function getInputDirection() {
  const left = pressedKeys.has("ArrowLeft") || pressedKeys.has("a");
  const right = pressedKeys.has("ArrowRight") || pressedKeys.has("d");
  const up = pressedKeys.has("ArrowUp") || pressedKeys.has("w");
  const down = pressedKeys.has("ArrowDown") || pressedKeys.has("s");
  // Duplicate mappings act as one direction, while opposite inputs cancel.
  const x = Number(right) - Number(left);
  const y = Number(down) - Number(up);
  const magnitude = Math.hypot(x, y);

  if (magnitude === 0) {
    return { x: 0, y: 0 };
  }

  // Normalization keeps diagonal speed equal to horizontal and vertical speed.
  return { x: x / magnitude, y: y / magnitude };
}

function stopMovementLoop() {
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  previousFrameTime = null;
  movableObject.classList.remove("is-moving");
}

function updateMovement(timestamp) {
  if (pressedKeys.size === 0 || document.activeElement !== playground) {
    stopMovementLoop();
    return;
  }

  if (previousFrameTime === null) {
    previousFrameTime = timestamp;
  }

  // Cap delayed frames to prevent a large jump after tab or window pauses.
  const deltaTime = Math.min(
    (timestamp - previousFrameTime) / 1000,
    maximumDeltaTime,
  );
  previousFrameTime = timestamp;
  const direction = getInputDirection();

  if (direction.x !== 0 || direction.y !== 0) {
    const previousObjectY = objectY;
    const moved = tryMoveWithSliding(
      direction.x * movementSpeed * deltaTime,
      direction.y * movementSpeed * deltaTime,
    );

    if (moved) {
      updateCameraFollow(objectY - previousObjectY);
    }
  }

  animationFrameId = requestAnimationFrame(updateMovement);
}

function startMovementLoop() {
  if (animationFrameId !== null || pressedKeys.size === 0) {
    return;
  }

  previousFrameTime = null;
  movableObject.classList.add("is-moving");
  animationFrameId = requestAnimationFrame(updateMovement);
}

function clearPressedKeys() {
  pressedKeys.clear();
  stopMovementLoop();
  resetCameraScrollState();
}

function handleKeyDown(event) {
  if (!isMovementKey(event.key)) {
    return;
  }

  event.preventDefault();
  pressedKeys.add(normalizeMovementKey(event.key));
  startMovementLoop();
}

function handleKeyUp(event) {
  if (!isMovementKey(event.key)) {
    return;
  }

  event.preventDefault();
  pressedKeys.delete(normalizeMovementKey(event.key));

  if (pressedKeys.size === 0) {
    stopMovementLoop();
  }
}

function handlePlaygroundClick(event) {
  const playgroundRectangle = playground.getBoundingClientRect();
  // Pointer coordinates are viewport-based; convert them to playground-local
  // coordinates and place the sphere center on the requested destination.
  const target = keepInsidePlayground(
    event.clientX -
      playgroundRectangle.left -
      objectWidth / 2,
    event.clientY -
      playgroundRectangle.top -
      objectHeight / 2,
  );
  const result = validateMovementPath(objectX, objectY, target.x, target.y);

  if (result.isValid) {
    const previousObjectY = objectY;
    applyPosition(result.target.x, result.target.y);
    message.textContent = "Object moved successfully.";
    showMovementFeedback();
    updateCameraFollow(objectY - previousObjectY);
  } else {
    showCollisionFeedback(result.wall);
    message.textContent = "Path blocked by a wall.";
  }

  playground.focus();
}

function restoreVisiblePosition(avoidFinish = false) {
  const safePosition = keepInsidePlayground(objectX, objectY);

  // Keep the current position after resize when it still fits the rebuilt maze.
  if (
    !getCollidingWall(safePosition.x, safePosition.y) &&
    !(avoidFinish && hasReachedFinish(safePosition.x, safePosition.y))
  ) {
    applyPosition(safePosition.x, safePosition.y);
    return;
  }

  const startPosition = getStartPosition();
  applyPosition(startPosition.x, startPosition.y);
}

function handleResize() {
  // Stop active input and discard layout-dependent feedback before rebuilding.
  clearPressedKeys();
  resetCameraScrollState();
  clearTimeout(movementTimer);
  clearTimeout(collisionTimer);
  movementTimer = undefined;
  collisionTimer = undefined;
  lastCollisionWall = null;
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(function () {
    const wasInsideFinish = isInsideFinish;
    buildMaze();
    restoreVisiblePosition(!wasInsideFinish);
    resizeTimer = undefined;
  }, resizeDebounceDuration);
}

playground.addEventListener("keydown", handleKeyDown);
window.addEventListener("keyup", handleKeyUp);
playground.addEventListener("click", handlePlaygroundClick);
playground.addEventListener("blur", clearPressedKeys);
window.addEventListener("blur", clearPressedKeys);
document.addEventListener("visibilitychange", function () {
  if (document.hidden) {
    clearPressedKeys();
  }
});
window.addEventListener("resize", handleResize);

// Build the deterministic maze and place the sphere at START without forcing focus.
buildMaze();
const initialPosition = getStartPosition();
applyPosition(initialPosition.x, initialPosition.y);
