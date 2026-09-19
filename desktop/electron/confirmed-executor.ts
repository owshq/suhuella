/**
 * Confirmation executor seam — CONFIRM_REQUIRED actions use this path, not SAFE_NOW.
 *
 * rename_file, create_folder, move_file, undo, and future organisation capabilities
 * must require explicit user confirmation before any real execution.
 * Organise Slice 3 moves and UNDO-001 reverse-moves use this path — never SAFE_NOW.
 */

export class ConfirmationRequiredError extends Error {
  constructor(message = 'Explicit confirmation required') {
    super(message)
    this.name = 'ConfirmationRequiredError'
  }
}

export function assertConfirmationReceived(confirmed: unknown): void {
  if (confirmed !== true) {
    throw new ConfirmationRequiredError()
  }
}
