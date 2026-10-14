import { Injectable, computed, signal } from '@angular/core';

export type ToastTone = 'info' | 'success' | 'error';

export interface ToastOptions {
  /** Transloco key of the message. */
  messageKey: string;
  params?: Record<string, string | number>;
  tone?: ToastTone;
  durationMs?: number;
}

export interface Toast extends Required<Omit<ToastOptions, 'durationMs'>> {
  id: number;
}

const DEFAULT_DURATION_MS = 4000;

/** ToastService — queue of short, auto-dismissed notifications. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly _toasts = signal<Toast[]>([]);
  private nextId = 1;

  readonly toasts = computed(() => this._toasts());

  /** Shows a toast and returns its id. */
  show({
    messageKey,
    params = {},
    tone = 'info',
    durationMs = DEFAULT_DURATION_MS,
  }: ToastOptions): number {
    const id = this.nextId++;
    this._toasts.update((list) => [...list, { id, messageKey, params, tone }]);
    setTimeout(() => this.dismiss(id), durationMs);
    return id;
  }

  dismiss(id: number): void {
    this._toasts.update((list) => list.filter((toast) => toast.id !== id));
  }
}
