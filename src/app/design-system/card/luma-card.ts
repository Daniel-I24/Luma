import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type CardElevation = 'flat' | 'raised' | 'elevated';

/**
 * LumaCard — generic surface container for content blocks.
 *
 * Accepts optional elevation and padding toggles.
 * Uses content projection for full flexibility.
 */
@Component({
  selector: 'app-luma-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      [class]="hostClasses"
      [attr.role]="interactive() ? 'button' : null"
      [attr.tabindex]="interactive() ? '0' : null"
    >
      <ng-content />
    </div>
  `,
  styleUrl: './luma-card.css',
})
export class LumaCard {
  public readonly elevation = input<CardElevation>('raised');
  public readonly padded = input<boolean>(true);
  public readonly interactive = input<boolean>(false);

  protected get hostClasses(): string {
    return [
      'luma-card',
      `luma-card--${this.elevation()}`,
      this.padded() ? 'luma-card--padded' : '',
      this.interactive() ? 'luma-card--interactive' : '',
    ]
      .filter(Boolean)
      .join(' ');
  }
}
