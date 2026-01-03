export function createDirtyIndicator() {
  const dot = document.getElementById("dirtyDot");
  return function setDirtyIndicator(on) {
    if (!dot) return;
    dot.hidden = !on;
  };
}
