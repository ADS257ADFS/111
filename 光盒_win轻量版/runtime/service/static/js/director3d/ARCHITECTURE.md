# Director3D Module Boundaries

The director tool is isolated from the canvas. The only canvas-facing file is
`static/js/smart-canvas-director3d-bridge.js`; it opens the iframe, stores the
director state on its node, and accepts rendered images. No file below this
directory may call `SmartCanvasCore` or mutate a canvas node.

## State Rules

- `core/schema.js` is the only source of default and migrated director state.
- `core/store.js` owns subscriptions and state replacement.
- `core/scene-actions.js` is the only place that mutates `scene.objects` or
  `selection`, including an object's lightweight color metadata. UI panels and
  the viewport must call its public methods. Object duplication and transform
  reset also live here, so they cannot couple to the outliner or renderer.
- `camera/shot-store.js` is the only place that mutates camera shots, project
  aspect ratio, and view mode.
- `timeline/timeline-store.js` is the only place that mutates frame position,
  playback range, playback state, keyframe selection, object keyframes, and
  camera keyframes. It also owns `shotCuts`: frame-to-shot assignments used
  only for camera switching during preview and export. A shot cut never edits
  a camera shot or its transform keyframes.
- `assets/primitive-catalog.js` owns the supported low-poly primitive list and
  the default object data created for each primitive. UI panels may list these
  items, but may not define or construct scene objects themselves.
- `outliner/outliner-store.js` owns only `scene.extensions.outliner`: group
  membership and collapsed-group UI state. It must never mutate
  `scene.objects`; removing a group never removes its objects. Group names and
  group ordering are also limited to this extension store.
- Each keyframe owns its `interpolation` value. Moving, copying, deleting, or
  changing a keyframe is limited to the timeline store and never directly
  writes scene objects or camera shots.

## Viewport Rules

- `viewport/stage.js` coordinates pointer interaction, Three.js rendering, and
  the independent modules below. It must not create canvas nodes or write
  object state directly.
- `viewport/scene-objects.js` creates and disposes low-poly objects.
- `viewport/transform-gizmo.js` owns gizmo appearance and foreground drawing.
- `viewport/overlay.js` owns the camera mask and quad-view DOM overlay.
- `viewport/camera-icons.js` owns wireframe camera icon geometry.
- `viewport/camera-targets.js` owns target markers, camera-to-target lines, hit
  proxies, and view-plane rules. It never writes shot state directly; dragging
  delegates to `shot-store.setShotTarget`, which also enforces shot locking.
- `viewport/cameras.js` and `viewport/layout.js` contain pure camera and layout
  calculations.

## UI And Future Features

- `ui/panels.js` renders the model library, shot list, object list, and its
  lightweight color swatches. Its outliner is a view over the isolated
  outliner store, not a second object store. Its numeric transform panel is a
  read-only view until it delegates a committed field value to scene actions;
  its copy and reset buttons also only dispatch scene actions.
- `ui/transform-field-math.js` is a pure UI conversion helper. It presents
  object rotation as readable Euler degrees while object state remains a
  quaternion.
- `ui/app.js` only connects DOM events to scene actions, shot store methods,
  viewport methods, the primitive catalog, and the iframe bridge.
- `timeline/timeline-ui.js` renders the bottom timeline and asks the viewport
  to preview or apply a scrubbed frame. It projects one selectable row per
  scene object and camera shot from existing tracks, plus an isolated shot-cut
  row. Named shot segments are a read-only projection of `shotCuts` and
  `cameraShots`; no segment data is persisted. It delegates selection through
  the shared scene action and shot-store layers; it does not edit scene objects
  or camera keyframes itself.
- Timeline playback and scrubbing use `viewport.previewTimeline` only. The
  temporary camera-row highlight is applied through `setShotPreview` and never
  changes `currentShotId`, `viewMode`, camera shots, or object transforms.
- Playback range, current frame, and `loopPlayback` are owned only by the
  timeline store. Clicking an empty ruler position seeks the preview without
  selecting or editing any keyframe.
- Timeline labels and accessibility attributes are defined in UTF-8 inside the
  timeline UI. Display text must never be used as action identifiers; behavior
  continues to use stable `data-director3d-*` attributes.
- `timeline/auto-keyframe.js` is an optional observer. When enabled it records
  only changes to existing object transforms and existing camera states. It
  ignores creation, deletion, color, visibility, locks, grouping, and preview.
- `export/animation-exporter.js` reads rendered timeline frames and encodes a
  WebM result. It must not send data to the canvas bridge or mutate scene state,
  and it must release its capture stream on success, cancellation, and failure.
- `export/animation-export-settings.js` owns resolution and frame-rate choices
  under `scene.extensions.animationExport`; it must not alter timeline fields.
- `export/animation-export-ui.js` owns progress, cancellation, and the local
  output action for animation export.
- New object behavior belongs in a new core action or an object component.
- New viewport controls belong in a dedicated viewport module and are consumed
  by `stage.js`.
- New optional tools are registered through `core/tool-catalog.js`; their state
  must live under `tool.settings` or `extensions`, not in unrelated UI fields.

## Safe Change Checklist

1. Add new persisted fields through `schema.js` migration without deleting old
   fields.
2. Add one action in `scene-actions.js` or `shot-store.js` for every mutation.
3. Keep render modules read-only: they consume state and never edit it.
4. Add a focused test beside the existing `director3d-*.test.js` files.
5. Do not add canvas imports or `SmartCanvasCore` references under this folder.
