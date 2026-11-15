/** Breakpoints use available content and font scale, including Screen's tablet maximum. */
export function workersLayout(width: number, fontScale = 1) {
  const contentWidth = Math.max(0, Math.min(width, 880) - 32);
  return {
    contentWidth,
    statsColumns: contentWidth >= 340 && fontScale <= 1.25 ? 4 : 2,
    inlineTeam: contentWidth >= 342 && fontScale <= 1.15,
    recommendationColumns: contentWidth >= 340 && fontScale <= 1.3 ? 2 : 1,
  };
}
