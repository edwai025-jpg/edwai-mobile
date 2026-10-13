/** Preview and exported pixels share this bounded, centered cover geometry. */
export function clampPhotoOffset(width: number, height: number, viewport: number, zoom: number, x: number, y: number) {
  const scale = Math.max(viewport / width, viewport / height) * Math.min(3, Math.max(1, zoom));
  const boundX = Math.max(0, (width * scale - viewport) / 2);
  const boundY = Math.max(0, (height * scale - viewport) / 2);
  return { x: Math.min(boundX, Math.max(-boundX, x)), y: Math.min(boundY, Math.max(-boundY, y)) };
}

export function getPhotoCrop(width: number, height: number, viewport: number, zoom: number, x: number, y: number) {
  if (![width, height, viewport, zoom, x, y].every(Number.isFinite) || Math.min(width, height, viewport) <= 0) {
    throw new Error("Could not determine image dimensions. Please choose another photo.");
  }
  const scale = Math.max(viewport / width, viewport / height) * Math.min(3, Math.max(1, zoom));
  const offset = clampPhotoOffset(width, height, viewport, zoom, x, y);
  const size = Math.max(1, Math.floor(Math.min(width, height, viewport / scale)));
  return {
    originX: Math.max(0, Math.min(width - size, Math.round((width - viewport / scale) / 2 - offset.x / scale))),
    originY: Math.max(0, Math.min(height - size, Math.round((height - viewport / scale) / 2 - offset.y / scale))),
    width: size, height: size,
  };
}
