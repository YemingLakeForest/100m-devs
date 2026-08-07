/**
 * "Has this install booted before?" — GDD §10.9.3.
 *
 * Kept out of the game store on purpose. This is a property of the *install*,
 * not of a run: a Paradigm Shift, a bankruptcy and a fresh save all leave the
 * boot sequence seen, because the player has seen it. Putting it in the run
 * state would replay a two-second banner on every prestige, which is exactly
 * the "obstacle you have seen forty times" §10.9.3 exists to remove.
 *
 * Every access is wrapped, because `localStorage` is not a plain object: it
 * throws on *read* in a sandboxed iframe and on *write* once the origin quota
 * is full or Safari's private mode is on. An exception here would take the
 * title screen — and therefore the whole app — down with it, in exchange for
 * remembering a boolean. Failing to remember is the correct loss.
 */

const KEY = 'm100devs.booted'

/**
 * Injectable so the tests can drive a real implementation of the contract
 * rather than a mock of it, including the throwing paths.
 */
export type BootStore = Pick<Storage, 'getItem' | 'setItem'>

function defaultStore(): BootStore | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    // Access to the property itself throws when storage is blocked by policy.
    return null
  }
}

/**
 * False on a cold first launch, and false whenever storage is unavailable.
 *
 * The unavailable case deliberately resolves to "first launch" rather than
 * "returning": if we cannot know, show the boot. A player who sees it twice
 * has lost two seconds; a player who never sees it has lost the scene.
 */
export function hasBooted(store: BootStore | null = defaultStore()): boolean {
  if (!store) return false
  try {
    return store.getItem(KEY) === '1'
  } catch {
    return false
  }
}

/** Idempotent — StrictMode's double-invoked effects run this twice by design. */
export function markBooted(store: BootStore | null = defaultStore()): void {
  if (!store) return
  try {
    store.setItem(KEY, '1')
  } catch {
    // Quota, private mode, or policy. Nothing to do and nothing worth saying.
  }
}
