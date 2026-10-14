const isApple = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent)

/** How the Mod key is written on this machine: ⌘ on Apple devices, Ctrl elsewhere. */
export const MOD_KEY_LABEL = isApple ? '⌘' : 'Ctrl'
