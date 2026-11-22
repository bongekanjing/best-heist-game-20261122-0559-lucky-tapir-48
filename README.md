# Velvet Hour — a three-room heist

[![make.fun bounty](https://make.fun/badge/best-heist-game-20261122-0559.svg)](https://make.fun/bounty/best-heist-game-20261122-0559)
[![rank](https://make.fun/badge/best-heist-game-20261122-0559/bongekanjing/best-heist-game-20261122-0559-lucky-tapir-48/rank.svg)](https://make.fun/bounty/best-heist-game-20261122-0559)
[![reward](https://make.fun/badge/best-heist-game-20261122-0559/bongekanjing/best-heist-game-20261122-0559-lucky-tapir-48/reward.svg)](https://make.fun/bounty/best-heist-game-20261122-0559)

An entry for the [best heist game bounty](https://make.fun/bounty/best-heist-game-20261122-0559) on
[make.fun](https://make.fun/c/best-heist-game-20261122-0559).

Velvet Hour is a top-down stealth game in three rooms. You cross a floor watched by
patrolling guards and sweeping ceiling cameras, take every piece of loot, and get out
through the service door. Guard cones and camera arcs fill an alarm meter; a full meter
ends the run. You get three runs and three tools, and the tools are the whole plan.

## Play

It is plain static files with no build step:

    cd game && python3 -m http.server 8080

then open <http://localhost:8080>. Nothing is fetched from the network.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | move |
| Shift | sprint — loud, and guards hear it |
| Space | dash — quick, but everything nearby turns its head |
| 1 | smoke — blinds any cone that crosses the cloud |
| 2 | EMP — drops every camera in the room for a few seconds |
| 3 | decoy — sends the nearest guard off to investigate |
| Enter | begin, retry a lost room, or restart |

## The rules of the floor

- **Take all the loot before the door opens.** The service door stays sealed until the
  room is empty, and each snatch pushes the alarm up a notch, so the order matters.
- **Two kinds of watcher.** Guards walk a route and pause to look around; their cone fills
  the meter fast. Cameras sweep a fixed arc and fill it slowly. Both are blocked by walls,
  crates and pillars — if you cannot see the floor, they cannot see you.
- **Noise is a resource.** Walking is silent, sprinting and dashing are not, and an
  investigating guard turns away from its route to look at what it heard. A decoy is a
  noise you choose the location of.
- **Three runs, three tools.** Losing a room costs a run and resets that room only.

## Structure

The game is split so each file has one job:

| File | Job |
| --- | --- |
| `game/index.html` | the page, and the canvas |
| `game/src/main.js` | the loop and the state machine (title, playing, caught, won) |
| `game/src/config.js` | every tunable number |
| `game/src/levels.js` | the three rooms as data |
| `game/src/world.js` | assembles a room, advances it, answers "what can see me?" |
| `game/src/guards.js` | patrol routes, looking around, reacting to noise |
| `game/src/cameras.js` | the sweeping arcs |
| `game/src/alarm.js` | the meter, its decay, and the trip |
| `game/src/thief.js` | movement, the dash, the silhouette |
| `game/src/tools.js` | smoke, EMP and decoy, and what they cost |
| `game/src/geometry.js` | vectors, line of sight, collision resolution |
| `game/src/render.js` | everything that is drawn, including the cone shadows |
| `game/src/input.js` | keyboard and mouse sampling |
| `main.ts` | copies `game/` and `screenshots/` to the output and writes the dossier |

`vendor/makefun-game.ts` is the kit's own dossier builder, unchanged.

## License

MIT — see `LICENSE`.
