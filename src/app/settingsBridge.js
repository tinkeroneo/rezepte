export function installSettingsBridge({
  readUseBackend,
  setUseBackend,
  getAuthContext,
  getMySpaces,
  inviteToSpace,
  listPendingInvites,
  listSpaceMembers,
  revokeInvite,
  readTheme,
  setTheme,
  readWinter,
  setWinter,
  readRadioFeature,
  setRadioFeature,
  readRadioConsent,
  clearRadioConsent,
  readTimerRingIntervalMs,
  setTimerRingIntervalMs,
  readTimerMaxRingSeconds,
  setTimerMaxRingSeconds,
  readTimerStepHighlight,
  setTimerStepHighlight,
  readTimerSoundEnabled,
  setTimerSoundEnabled,
  readTimerSoundId,
  setTimerSoundId,
  readTimerSoundVolume,
  setTimerSoundVolume,
}) {
  window.__tinkeroneoSettings = {
    readUseBackend,
    setUseBackend: async (value) => setUseBackend(value),

    getAuthContext: () => {
      try {
        return getAuthContext();
      } catch {
        return null;
      }
    },
    getMySpaces: () => {
      try {
        return getMySpaces() || [];
      } catch {
        return [];
      }
    },
    inviteToSpace: async ({ email, role, spaceId }) => inviteToSpace({ email, role, spaceId }),
    listPendingInvites: async ({ spaceId } = {}) => listPendingInvites({ spaceId }),
    listSpaceMembers: async ({ spaceId } = {}) => listSpaceMembers({ spaceId }),
    revokeInvite: async (inviteId) => revokeInvite(inviteId),

    readTheme,
    setTheme: (value) => setTheme(value),

    readWinter,
    setWinter: (enabled) => setWinter(enabled),

    readRadioFeature,
    setRadioFeature: (enabled) => setRadioFeature(enabled),
    readRadioConsent,
    clearRadioConsent,

    readTimerRingIntervalMs,
    setTimerRingIntervalMs,

    readTimerMaxRingSeconds,
    setTimerMaxRingSeconds,

    readTimerStepHighlight,
    setTimerStepHighlight,

    readTimerSoundEnabled,
    setTimerSoundEnabled,

    readTimerSoundId,
    setTimerSoundId,

    readTimerSoundVolume,
    setTimerSoundVolume,
  };
}
