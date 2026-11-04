import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

/**
 * One variant per function (docs/brand/button-semantics.md):
 * primary: the main action of the screen (Pedir, Pagar, Guardar);
 * confirm: accept or finish something (Aceptar, Listo, Entregado);
 * secondary: an alternative action; ghost: a low-emphasis action (Volver);
 * danger: cancel, reject, delete, remove; warning: pause or suspend;
 * link: an action that reads as text (Cambiar).
 */
export type ButtonVariant = 'primary' | 'confirm' | 'secondary' | 'ghost' | 'danger' | 'warning' | 'link';
export type ButtonSize = 'sm' | 'md' | 'lg';

/**
 * LumaButton — the base button. States: rest, hover, pressed, visible focus,
 * disabled and loading (busy: it ignores clicks and says so to screen
 * readers). Every size keeps the 44 px touch target.
 */
@Component({
  selector: 'app-luma-button',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      [class]="hostClasses()"
      [type]="type()"
      [attr.id]="buttonId()"
      [attr.aria-describedby]="describedBy()"
      [disabled]="inactive()"
      [attr.aria-label]="ariaLabel() ?? null"
      [attr.aria-disabled]="inactive() ? 'true' : null"
      [attr.aria-busy]="loading() ? 'true' : null"
      (click)="handleClick()"
    >
      <ng-content />
      @if (loading()) {
      <span class="luma-btn__dots" aria-hidden="true"><span></span><span></span><span></span></span>
      }
    </button>
  `,
  styleUrls: ['./luma-button.css', './luma-button-states.css'],
  host: { '[class.block]': 'fullWidth()', '[class.flex-1]': 'fullWidth()' },
})
export class LumaButton {
  public readonly variant = input<ButtonVariant>('primary');
  public readonly size = input<ButtonSize>('md');
  public readonly fullWidth = input<boolean>(false);
  public readonly disabled = input<boolean>(false);
  /** Work in progress: the button stays visible but cannot be pressed again. */
  public readonly loading = input<boolean>(false);
  public readonly type = input<'button' | 'submit' | 'reset'>('button');
  public readonly ariaLabel = input<string | undefined>(undefined);
  /** id of the native button, e.g. to move the focus to it. */
  public readonly buttonId = input<string | null>(null);
  /** id of an element that describes the button (aria-describedby). */
  public readonly describedBy = input<string | null>(null);

  public readonly clicked = output<void>();

  protected readonly inactive = computed(() => this.disabled() || this.loading());
  protected readonly hostClasses = computed(() =>
    [
      'luma-btn',
      `luma-btn--${this.variant()}`,
      `luma-btn--${this.size()}`,
      this.fullWidth() ? 'luma-btn--full' : '',
      this.disabled() ? 'luma-btn--disabled' : '',
      this.loading() ? 'luma-btn--loading' : '',
    ]
      .filter(Boolean)
      .join(' '),
  );

  protected handleClick(): void {
    if (!this.inactive()) this.clicked.emit();
  }
}
