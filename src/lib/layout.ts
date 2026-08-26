export interface CanvasLayout {
  scale: number;
  displayWidth: number;
  displayHeight: number;
}

export function computeLayout(
  gridWidth: number,
  gridHeight: number,
  viewportWidth: number,
  viewportHeight: number,
): CanvasLayout {
  const scale = Math.min(viewportWidth / gridWidth, viewportHeight / gridHeight);
  return {
    scale,
    displayWidth: gridWidth * scale,
    displayHeight: gridHeight * scale,
  };
}

export function clientToGrid(
  clientX: number,
  clientY: number,
  canvasRect: { left: number; top: number },
  scale: number,
): { x: number; y: number } {
  return {
    x: Math.floor((clientX - canvasRect.left) / scale),
    y: Math.floor((clientY - canvasRect.top) / scale),
  };
}
