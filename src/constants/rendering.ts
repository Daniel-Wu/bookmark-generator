/**
 * Rendering constants for the 3D preview system
 */

import type { RenderMode } from '../types/geometry';

export const CAMERA_DEFAULTS = {
  FOV: 75,
  NEAR: 0.1,
  FAR: 1000,
  INITIAL_POSITION: { x: 5, y: 5, z: 5 },
  INITIAL_TARGET: { x: 0, y: 0, z: 0 },
} as const;

export const LIGHTING_DEFAULTS = {
  HEMISPHERE_INTENSITY: 0.6,
  DIRECTIONAL_INTENSITY: 0.8,
  HEMISPHERE_SKY_COLOR: 0xffffff,
  HEMISPHERE_GROUND_COLOR: 0x444444,
  DIRECTIONAL_COLOR: 0xffffff,
  SHADOW_MAP_SIZE: 2048,
} as const;

export const RENDER_MODES: RenderMode[] = [
  {
    type: 'solid',
    name: 'Solid',
    description: 'Solid shaded view with materials',
  },
  {
    type: 'wireframe',
    name: 'Wireframe',
    description: 'Wireframe view showing mesh structure',
  },
  {
    type: 'x-ray',
    name: 'X-Ray',
    description: 'Transparent view showing internal structure',
  },
];

export const MATERIAL_DEFAULTS = {
  METALNESS: 0.1,
  ROUGHNESS: 0.8,
  OPACITY: 1.0,
  WIREFRAME_OPACITY: 0.7,
  XRAY_OPACITY: 0.3,
} as const;

export const PERFORMANCE_TARGETS = {
  TARGET_FPS: 30,
  MAX_TRIANGLES: 100000,
  MAX_MEMORY_MB: 500,
  FRAME_TIME_WARNING_MS: 33, // ~30 FPS
} as const;

export const UI_CONSTANTS = {
  CANVAS_MIN_WIDTH: 300,
  CANVAS_MIN_HEIGHT: 200,
  STATS_UPDATE_INTERVAL_MS: 1000,
  THUMBNAIL_SIZE: 256,
} as const;

export const ANIMATION_DEFAULTS = {
  CAMERA_TRANSITION_DURATION: 1000,
  MATERIAL_TRANSITION_DURATION: 300,
  FADE_DURATION: 200,
} as const;

export const CONTROLS_SETTINGS = {
  ENABLE_DAMPING: true,
  DAMPING_FACTOR: 0.05,
  MIN_DISTANCE: 1,
  MAX_DISTANCE: 100,
  MAX_POLAR_ANGLE: Math.PI,
  MIN_POLAR_ANGLE: 0,
  ENABLE_PAN: true,
  ENABLE_ZOOM: true,
  ENABLE_ROTATE: true,
} as const;