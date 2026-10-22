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
      360,
      Math.min(620, Math.round(viewportHeight * 0.67))
    ),
  };
}
