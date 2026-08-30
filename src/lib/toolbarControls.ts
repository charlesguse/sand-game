/**
 * Single source of truth for every control the toolbar can ever show (FR-013). Toolbar.svelte
 * renders by iterating shippedToolbarControls(...)'s output; tests/unit/lib/layout.test.ts
 * imports the same function so a control's count can never disagree between what's checked and
 * what ships (research.md §4).
 */

export type ToolbarGroupId =
  | 'elements'
  | 'objects'
  | 'actions'
  | 'history'
  | 'screen'
  | 'photo'
  | 'scenes'
  | 'sizes';

export interface ToolbarControlSpec {
  id: string;
  group: ToolbarGroupId;
  ariaLabel: string;
  conditional?: 'fullscreen' | 'photo';
}

export const TOOLBAR_CONTROLS: readonly ToolbarControlSpec[] = [
  { id: 'tool-sand', group: 'elements', ariaLabel: 'Pink sand' },
  { id: 'tool-water', group: 'elements', ariaLabel: 'Water' },
  { id: 'tool-dirt', group: 'elements', ariaLabel: 'Magic purple dirt' },
  { id: 'tool-grass', group: 'elements', ariaLabel: 'Grass' },
  { id: 'tool-star', group: 'elements', ariaLabel: 'Star power' },
  { id: 'tool-gumdrop', group: 'elements', ariaLabel: 'Gumdrops' },

  { id: 'tool-rainbow', group: 'objects', ariaLabel: 'Rainbow' },
  { id: 'tool-unicorn', group: 'objects', ariaLabel: 'Unicorn' },
  { id: 'tool-palm', group: 'objects', ariaLabel: 'Palm tree' },
  { id: 'tool-poodle', group: 'objects', ariaLabel: 'Poodle' },
  { id: 'tool-flamingo', group: 'objects', ariaLabel: 'Flamingo' },

  { id: 'tool-eraser', group: 'actions', ariaLabel: 'Eraser' },
  { id: 'action-clear', group: 'actions', ariaLabel: 'Clear all' },
  { id: 'tool-wand', group: 'actions', ariaLabel: 'Magic wand' },
  { id: 'action-mute', group: 'actions', ariaLabel: 'Sound' },

  { id: 'action-undo', group: 'history', ariaLabel: 'Undo' },
  { id: 'action-redo', group: 'history', ariaLabel: 'Redo' },

  { id: 'action-fullscreen', group: 'screen', ariaLabel: 'Full screen', conditional: 'fullscreen' },

  { id: 'action-photo', group: 'photo', ariaLabel: 'Photo', conditional: 'photo' },

  { id: 'scene-empty', group: 'scenes', ariaLabel: 'Empty canvas' },
  { id: 'scene-landscape1', group: 'scenes', ariaLabel: 'Hills and lake world' },
  { id: 'scene-landscape2', group: 'scenes', ariaLabel: 'Beach and pool world' },

  { id: 'size-small', group: 'sizes', ariaLabel: 'Small brush' },
  { id: 'size-medium', group: 'sizes', ariaLabel: 'Medium brush' },
  { id: 'size-large', group: 'sizes', ariaLabel: 'Large brush' },
];

/** The controls a device with the given feature-detection results actually shows. */
export function shippedToolbarControls(
  showFullscreen: boolean,
  showPhoto: boolean,
): ToolbarControlSpec[] {
  return TOOLBAR_CONTROLS.filter((control) => {
    if (control.conditional === 'fullscreen') return showFullscreen;
    if (control.conditional === 'photo') return showPhoto;
    return true;
  });
}
