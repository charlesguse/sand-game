/**
 * Thin wrapper over the Fullscreen API, with the `webkit` fallbacks older
 * iPadOS Safari still needs. Dependency-injected rather than reaching for
 * globals so it unit-tests with plain objects and no DOM (constitution V).
 */

export interface FullscreenElement {
  requestFullscreen?: () => Promise<void>;
  webkitRequestFullscreen?: () => Promise<void> | void;
}

export interface FullscreenDocument {
  fullscreenElement?: Element | null;
  webkitFullscreenElement?: Element | null;
  exitFullscreen?: () => Promise<void>;
  webkitExitFullscreen?: () => Promise<void> | void;
}

export function isFullscreenSupported(element: FullscreenElement): boolean {
  return (
    typeof element.requestFullscreen === 'function' ||
    typeof element.webkitRequestFullscreen === 'function'
  );
}

export function isFullscreen(doc: FullscreenDocument): boolean {
  return Boolean(doc.fullscreenElement ?? doc.webkitFullscreenElement);
}

/**
 * Enters or leaves fullscreen. Never rejects: a browser that refuses the
 * request (or has no API at all) must not surface an error to a 4-year-old.
 */
export async function toggleFullscreen(
  element: FullscreenElement,
  doc: FullscreenDocument,
): Promise<void> {
  try {
    if (isFullscreen(doc)) {
      if (typeof doc.exitFullscreen === 'function') {
        await doc.exitFullscreen();
      } else if (typeof doc.webkitExitFullscreen === 'function') {
        await doc.webkitExitFullscreen();
      }
      return;
    }

    if (typeof element.requestFullscreen === 'function') {
      await element.requestFullscreen();
    } else if (typeof element.webkitRequestFullscreen === 'function') {
      await element.webkitRequestFullscreen();
    }
  } catch {
    // Deliberately ignored — see doc comment.
  }
}
