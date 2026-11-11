/** What a LumaSelect test needs from a fixture. */
interface Rendered {
  readonly nativeElement: unknown;
  detectChanges(): void;
}

/**
 * Chooses an option of a LumaSelect as a person does: opens the field by its
 * id, then taps the option with that value in the sheet.
 */
export function pickOption(fixture: Rendered, selectId: string, value: string): void {
  const root = fixture.nativeElement as HTMLElement;
  const field = root.querySelector<HTMLButtonElement>(`#${CSS.escape(selectId)}`);
  if (!field) throw new Error(`no select #${selectId}`);
  field.click();
  fixture.detectChanges();
  const host = field.closest('app-luma-select') ?? root;
  const option = Array.from(host.querySelectorAll<HTMLElement>('[role="option"]')).find((o) => o.dataset['value'] === value);
  if (!option) throw new Error(`no option ${value} in #${selectId}`);
  option.click();
  fixture.detectChanges();
}
