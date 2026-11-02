export interface Revisioned {
  paths: unknown;
  revision: number;
}

/**
 * Applies a partial update to the store. The path cards hold every financial input, so any change to them starts a
 * new revision; screens and the 3D room key their figures to it. A patch cannot set the revision itself.
 */
export function applyPatch<S extends Revisioned>(prev: S, patch: Partial<S>): S {
  if (Object.keys(patch).length === 0) return prev;
  const changed = patch.paths !== undefined && patch.paths !== prev.paths;
  return { ...prev, ...patch, revision: changed ? prev.revision + 1 : prev.revision } as S;
}
