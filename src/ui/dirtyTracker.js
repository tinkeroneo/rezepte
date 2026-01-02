export function createDirtyTracker({
  setDirtyIndicator,
  setDirtyGuard,
  setViewCleanup,
  confirmText = "Ungespeicherte Änderungen verwerfen?",
  onCleanup = () => {},
  // optional: key pro view, falls du mehrere parallel hast
  beforeUnloadKey = "__tinkeroneo_beforeunload_add",
} = {}) {
  let dirty = false;

  const markDirty = () => {
    dirty = true;
    setDirtyIndicator?.(true);
  };

  const clearDirty = () => {
    dirty = false;
    setDirtyIndicator?.(false);
  };

  const uninstallBeforeUnload = () => {
    const fn = window[beforeUnloadKey];
    if (!fn) return;
    window.removeEventListener("beforeunload", fn);
    window[beforeUnloadKey] = null;
  };

  const installBeforeUnload = () => {
    uninstallBeforeUnload();
    window[beforeUnloadKey] = (e) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", window[beforeUnloadKey]);
  };

  installBeforeUnload();

  setDirtyGuard?.(() => {
    if (!dirty) return true;
    const ok = confirm(confirmText);
    if (!ok) return false;
    onCleanup();
    return true;
  });

  setViewCleanup?.(() => {
    clearDirty();
    onCleanup();
    uninstallBeforeUnload();
  });

  return {
    markDirty,
    clearDirty,
    isDirty: () => dirty,
  };
}
