# Clip Cutter

A tiny, modern desktop app for trimming and cutting video clips. Open a video, drag the handles, split out the parts you don't want, export an MP4.

## Features
- Drag-and-drop or open a video
- Trim with draggable handles on a timeline
- Split at the playhead and remove parts in the middle
- Preview skips removed sections
- **Fast mode**: stream copy, no re-encode, near-instant (cuts snap to keyframes)
- **Accurate mode**: frame-accurate cuts, re-encoded to H.264/AAC
- Light and dark theme (follows your system)

## Run from source
Requires [Node.js](https://nodejs.org).

```bash
npm install
npm start
```

## Build an installer
```bash
npm run dist
```
Output goes to `dist/` (.exe, .dmg or AppImage depending on your OS).

## Releases
Pushing a tag like `v1.0.0` triggers a GitHub Action that builds installers for Windows, macOS and Linux and attaches them to a GitHub Release.

```bash
git tag v1.0.0
git push origin v1.0.0
```

## License
MIT
