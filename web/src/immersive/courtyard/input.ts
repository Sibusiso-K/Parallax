export type MoveAction = 'forward' | 'back' | 'left' | 'right';
const keys: Record<string, MoveAction> = {
  KeyW: 'forward', ArrowUp: 'forward', KeyS: 'back', ArrowDown: 'back',
  KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
};

/** One set of physical keys avoids releasing W when ArrowUp is still held. */
export class MovementInput {
  private held = new Set<string>();
  /** On-screen buttons and touch, kept apart from keys so lifting a finger never releases a held key. */
  private pressed = new Set<MoveAction>();
  press(action: MoveAction): void { this.pressed.add(action); }
  release(action: MoveAction): void { this.pressed.delete(action); }
  keyDown(code: string, editable = false): boolean {
    if (editable) { this.clear(); return false; }
    if (!keys[code]) return false;
    this.held.add(code);
    return true;
  }
  keyUp(code: string): void { this.held.delete(code); }
  clear(): void { this.held.clear(); this.pressed.clear(); }
  vector(): { x: number; z: number } {
    const active = (a: MoveAction) => this.pressed.has(a) || [...this.held].some((code) => keys[code] === a) ? 1 : 0;
    const x = active('right') - active('left');
    const z = active('back') - active('forward');
    const length = Math.hypot(x, z);
    return length ? { x: x / length, z: z / length } : { x: 0, z: 0 };
  }
}

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return !!target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="dialog"]');
}
