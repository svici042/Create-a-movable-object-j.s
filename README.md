# Create a Movable Object

An accessible, dependency-free JavaScript maze game. Move the glowing orb from
START to FINISH without crossing the maze walls.

## Controls

- Focus the playground and use the arrow keys or WASD.
- Hold two direction keys to move diagonally.
- Click any visible destination that has a clear straight path.

The page automatically follows the orb vertically while it moves through the
tall maze. Users can still scroll the page manually while the orb is stationary.

## Run locally

Open `index.html` directly, or serve the directory with any static web server.
For example:

```sh
python -m http.server
```

Then open `http://localhost:8000`.

## Project structure

- `index.html` — semantic page structure and accessible instructions
- `style.css` — responsive visuals, focus states, and reduced-motion support
- `javascript.js` — deterministic maze generation, movement, collision, goals,
  and camera follow
- `Logo/` — decorative local image asset

The project has no package dependencies, build step, backend, database, or
external runtime resources.
