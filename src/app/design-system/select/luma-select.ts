import {
  ChangeDetectionStrategy, Component, ElementRef, Injector, afterNextRender, computed, inject, input, model, signal,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { RADIX_36 } from '@core/config/units';
import { LumaBottomSheet } from '../bottom-sheet/luma-bottom-sheet';
import { LumaIcon } from '../icon/luma-icon';
import { LumaSearchInput } from '../search-input/luma-search-input';

/** Six random characters after "0.". */
const ID_START = 2;
const ID_END = 8;
/** From this many options on, the sheet offers a search field. */
export const SEARCH_FROM = 9;

export interface SelectOption {
  readonly value: string;
  /** Already translated text. */
  readonly label: string;
}

/** Accent- and case-insensitive text for the search. */
const fold = (text: string): string => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

/**
 * LumaSelect — a field that opens a bottom sheet with the options (never the
 * system's grey dialog): the chosen one marked, a search when there are many,
 * arrows, Home and End between options, Enter or a tap to choose; focus goes
 * back to the field. Label, hint and error wired with aria-describedby, like
 * LumaInput (shared stylesheet).
 */
@Component({
  selector: 'app-luma-select',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LumaBottomSheet, LumaIcon, LumaSearchInput, TranslocoPipe],
  templateUrl: './luma-select.html',
  styleUrl: '../input/luma-input.css',
})
export class LumaSelect {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  public readonly selectId = input<string>(`luma-select-${Math.random().toString(RADIX_36).slice(ID_START, ID_END)}`);
  public readonly label = input<string | undefined>(undefined);
  /** The label is read by screen readers but not shown (compact headers). */
  public readonly hideLabel = input<boolean>(false);
  public readonly options = input<readonly SelectOption[]>([]);
  /** Text shown while nothing is chosen; also a choice (empty value) unless the field is required. */
  public readonly placeholder = input<string | undefined>(undefined);
  public readonly hint = input<string | undefined>(undefined);
  public readonly errorMessage = input<string | undefined>(undefined);
  public readonly disabled = input<boolean>(false);
  public readonly required = input<boolean>(false);

  /** Two-way bindable value. */
  public readonly value = model<string>('');

  protected readonly open = signal(false);
  protected readonly query = signal('');

  /** Every choice in the sheet: the placeholder first when it can be chosen. */
  protected readonly choices = computed<readonly SelectOption[]>(() => {
    const empty = this.placeholder();
    return empty !== undefined && !this.required() ? [{ value: '', label: empty }, ...this.options()] : this.options();
  });
  protected readonly searchable = computed(() => this.options().length >= SEARCH_FROM);
  protected readonly shown = computed(() => {
    const query = fold(this.query().trim());
    return query ? this.choices().filter((option) => fold(option.label).includes(query)) : this.choices();
  });
  protected readonly selectedLabel = computed(
    () => this.options().find((option) => option.value === this.value())?.label ?? null,
  );
  protected readonly describedBy = computed(() => {
    if (this.errorMessage()) return `${this.selectId()}-error`;
    return this.hint() ? `${this.selectId()}-hint` : null;
  });

  protected show(): void {
    if (this.disabled()) return;
    this.query.set('');
    this.open.set(true);
    afterNextRender(() => this.focusOption(this.selectedIndex()), { injector: this.injector });
  }

  protected choose(option: SelectOption): void {
    this.value.set(option.value);
    this.open.set(false);
  }

  /** Arrows move between options; Home and End go to the first and the last. */
  protected onKeydown(event: KeyboardEvent, index: number): void {
    const last = this.shown().length - 1;
    const next = { ArrowDown: Math.min(index + 1, last), ArrowUp: Math.max(index - 1, 0), Home: 0, End: last }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    this.focusOption(next);
  }

  private selectedIndex(): number {
    return Math.max(this.shown().findIndex((option) => option.value === this.value()), 0);
  }

  private focusOption(index: number): void {
    this.host.nativeElement.querySelectorAll<HTMLElement>('[role="option"]')[index]?.focus();
  }
}
