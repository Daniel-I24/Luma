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
  templateUrl: './luma-card.html',
  styleUrl: './luma-card.css',
})
export class LumaCard {
  readonly elevation = input<CardElevation>('raised');
  readonly padded = input<boolean>(true);
  readonly interactive = input<boolean>(false);

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
