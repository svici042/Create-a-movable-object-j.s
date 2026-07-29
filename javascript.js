const playground = document.querySelector("#playground");
const movableObject = document.querySelector("#movable-object");
const mazeWallContainer = document.querySelector("#maze-walls");
const startArea = document.querySelector("#start-area");
const finishArea = document.querySelector("#finish-area");
const positionOutput = document.querySelector("#position-output");
const message = document.querySelector("#message");

const movementStep = 18;
const collisionCheckStep = 4;
const wallThickness = 12;
const mazeRowCount = 20;
const minimumCorridorWidth = 105;

let mazeWalls = [];
let wallRectangles = [];
let mazeData;
let objectX = 0;
let objectY = 0;
let movementTimer;
let collisionTimer;
let finishTimer;
let resizeTimer;
let isInsideFinish = false;

function getPlaygroundLimits() {
  return {
    maxX: playground.clientWidth - movableObject.offsetWidth,
    maxY: playground.clientHeight - movableObject.offsetHeight,
  };
}

function getObjectRectangle(x, y) {
  return {
    left: x,
    right: x + movableObject.offsetWidth,
    top: y,
    bottom: y + movableObject.offsetHeight,
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

function rectanglesOverlap(firstRectangle, secondRectangle) {
  return (
    firstRectangle.left < secondRectangle.right &&
    firstRectangle.right > secondRectangle.left &&
    firstRectangle.top < secondRectangle.bottom &&
    firstRectangle.bottom > secondRectangle.top
  );
}

function getMazeColumnCount(playgroundWidth) {
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
  let currentSeed = seed >>> 0;

  return function () {
    currentSeed = (currentSeed * 1664525 + 1013904223) >>> 0;
    return currentSeed / 4294967296;
  };
}

function createPerfectMaze(rows, columns) {
  const cellCount = rows * columns;

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const random = createSeededRandom(rows * 1009 + columns * 9176 + attempt);
    const edges = [];
    const parent = Array.from({ length: cellCount }, (_, index) => index);
    const rank = Array(cellCount).fill(0);
    const passages = Array.from({ length: cellCount }, () => []);

    function find(cell) {
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
  wallRectangles = mazeWalls.map(function (wall) {
    return {
      element: wall,
      rectangle: getElementRectangle(wall),
    };
  });

  positionGoalArea(startArea, mazeData.startCell, false);
  positionGoalArea(finishArea, mazeData.finishCell, true);
}

function getCollidingWall(x, y) {
  const objectRectangle = getObjectRectangle(x, y);
  const collision = wallRectangles.find(function (wallData) {
    return rectanglesOverlap(objectRectangle, wallData.rectangle);
  });

  return collision ? collision.element : null;
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
    startArea.offsetLeft + (startArea.offsetWidth - movableObject.offsetWidth) / 2,
    startArea.offsetTop + (startArea.offsetHeight - movableObject.offsetHeight) / 2,
  );
}

function showMovementFeedback() {
  movableObject.classList.add("is-moving");
  clearTimeout(movementTimer);
  movementTimer = setTimeout(function () {
    movableObject.classList.remove("is-moving");
  }, 180);
}

function showCollisionFeedback(wall) {
  mazeWalls.forEach(function (mazeWall) {
    mazeWall.classList.remove("is-hit");
  });
  wall.classList.add("is-hit");
  message.textContent = "Wall detected. Choose another direction.";
  clearTimeout(collisionTimer);
  collisionTimer = setTimeout(function () {
    wall.classList.remove("is-hit");
  }, 320);
}

function hasReachedFinish(x, y) {
  const objectRectangle = getObjectRectangle(x, y);
  const finishRectangle = getElementRectangle(finishArea);
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
  const objectArea = movableObject.offsetWidth * movableObject.offsetHeight;

  return overlapArea >= objectArea * 0.35;
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
    }, 1800);
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
  positionOutput.textContent =
    "X: " + Math.round(objectX) + " · Y: " + Math.round(objectY);
  message.textContent = "Object moved successfully.";
  showMovementFeedback();
  updateFinishState();
}

function findBlockingWallAlongPath(targetX, targetY) {
  const distanceX = targetX - objectX;
  const distanceY = targetY - objectY;
  const stepCount = Math.max(
    1,
    Math.ceil(
      Math.max(Math.abs(distanceX), Math.abs(distanceY)) / collisionCheckStep,
    ),
  );

  for (let step = 1; step <= stepCount; step += 1) {
    const progress = step / stepCount;
    const collidingWall = getCollidingWall(
      objectX + distanceX * progress,
      objectY + distanceY * progress,
    );

    if (collidingWall) {
      return {
        wall: collidingWall,
        lastValidProgress: (step - 1) / stepCount,
      };
    }
  }

  return null;
}

function moveAlongCheckedPath(targetX, targetY, stopBeforeWall) {
  const safeTarget = keepInsidePlayground(targetX, targetY);
  const startX = objectX;
  const startY = objectY;
  const collision = findBlockingWallAlongPath(safeTarget.x, safeTarget.y);

  if (!collision) {
    applyPosition(safeTarget.x, safeTarget.y);
    return true;
  }

  if (stopBeforeWall && collision.lastValidProgress > 0) {
    applyPosition(
      startX + (safeTarget.x - startX) * collision.lastValidProgress,
      startY + (safeTarget.y - startY) * collision.lastValidProgress,
    );
  }

  showCollisionFeedback(collision.wall);
  return false;
}

function handleKeyboardMovement(event) {
  const movementKeys = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];

  if (!movementKeys.includes(event.key)) {
    return;
  }

  event.preventDefault();
  let nextX = objectX;
  let nextY = objectY;

  if (event.key === "ArrowUp") nextY -= movementStep;
  if (event.key === "ArrowDown") nextY += movementStep;
  if (event.key === "ArrowLeft") nextX -= movementStep;
  if (event.key === "ArrowRight") nextX += movementStep;

  moveAlongCheckedPath(nextX, nextY, true);
}

function handlePlaygroundClick(event) {
  const playgroundRectangle = playground.getBoundingClientRect();
  let clickedX =
    event.clientX - playgroundRectangle.left - movableObject.offsetWidth / 2;
  let clickedY =
    event.clientY - playgroundRectangle.top - movableObject.offsetHeight / 2;
  const horizontalDistance = Math.abs(clickedX - objectX);
  const verticalDistance = Math.abs(clickedY - objectY);

  if (horizontalDistance <= movementStep) {
    clickedX = objectX;
  } else if (verticalDistance <= movementStep) {
    clickedY = objectY;
  } else {
    message.textContent = "Choose a point in the same row or column.";
    playground.focus();
    return;
  }

  if (!moveAlongCheckedPath(clickedX, clickedY, false)) {
    message.textContent = "Path blocked by a wall.";
  }

  playground.focus();
}

function restoreVisiblePosition(avoidFinish = false) {
  const safePosition = keepInsidePlayground(objectX, objectY);

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
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(function () {
    const wasInsideFinish = isInsideFinish;
    buildMaze();
    restoreVisiblePosition(!wasInsideFinish);
  }, 120);
}

playground.addEventListener("keydown", handleKeyboardMovement);
playground.addEventListener("click", handlePlaygroundClick);
window.addEventListener("resize", handleResize);

buildMaze();
const initialPosition = getStartPosition();
applyPosition(initialPosition.x, initialPosition.y);
