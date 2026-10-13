import type { CoauthorCommands } from './editor/coauthorKeymap'

/** Placeholder until the first render wires the real commands in. */
export const NO_COMMANDS: CoauthorCommands = {
  openAsk: () => {},
  cancelRequest: () => false,
  isBusy: () => false,
}