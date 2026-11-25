# ASCII Globe

A dark backdrop theme for the Claude desktop app. A see-through 3D globe, typed out in ASCII characters, turns in the bottom-left corner and reacts to what Claude is doing:

- **At rest** the globe turns slowly and the land is dark.
- **While Claude works** it turns faster and "city lights" switch on across the land, in the colour of the current tool (light blue for reading and searching, periwinkle for edits, mint for shell commands, violet for agents, amber for connectors).
- **Each tool call** sends a wave of light across the land.
- **After an error** the lights turn a dim red and falter.
- **Drag** the globe to spin it.

Near the top right, an ASCII nebula grows larger and denser as the context window fills toward auto-compaction. Its colours follow the app's context panel: blue for messages, orange for system tools, teal for MCP tools and purple for the rest.

## Install

At the prompt of a terminal session:

```
/plugin install ascii-night-pond --marketplace GustavWex/ascii-globe
```

Answer `y` to add the marketplace, then pick a scope (user installs it for every session).

From a shell:

```
claude plugin install ascii-night-pond --marketplace GustavWex/ascii-globe
```

In the desktop app, where `/plugin` does not run: click **+** next to the prompt box, then **Plugins**, **Add marketplace** with `GustavWex/ascii-globe`, then **Add plugin**.

## Commands

- `/globe-look grey` uses the dark grey of Claude's own dark theme, with the globe in warm greys.
- `/globe-look cobalt` uses a flat cobalt blue background.
- `/globe-look` on its own swaps to the other look. Your choice is remembered across sessions.
- `/globe-demo` plays through every state the globe reacts to, in about 40 seconds.

## Editing the shader

`hooks/globe-shader.ts` and `hooks/globe-shader-grey.ts` are generated. Edit `shader-src/globe-shader.src.ts`, then rebuild both:

```
node shader-src/build-shader.mjs shader-src/globe-shader.src.ts hooks/scene.ts hooks/globe-shader.ts cobalt
node shader-src/build-shader.mjs shader-src/globe-shader.src.ts hooks/scene.ts hooks/globe-shader-grey.ts grey
```

Apps that can't play shaders show a flat halftone version of the globe instead.
