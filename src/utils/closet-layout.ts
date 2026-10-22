export type ClosetLayout = {
  pageWidth: number;
  imageHeight: number;
};

export function getClosetLayout(
  viewportWidth: number,
  viewportHeight: number
): ClosetLayout {
  return {
    pageWidth: Math.max(280, Math.floor(viewportWidth)),
    imageHeight: Math.max(
      320,
      Math.min(540, Math.round(viewportHeight * 0.57))
    ),
  };
}
