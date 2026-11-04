import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { LumaNotice } from './luma-notice';

@Component({
  imports: [LumaNotice],
  template: `
    <app-luma-notice tone="danger">No se pudo guardar.</app-luma-notice>
    <app-luma-notice>Así funciona.</app-luma-notice>
    <app-luma-notice tone="warning" role="note">Modo de prueba.</app-luma-notice>
  `,
})
class Host {}

describe('LumaNotice', () => {
  it('announces errors as alerts, the rest as status unless a role is given, with the tone colours', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const notes = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('p'));
    expect(notes.map((p) => p.getAttribute('role'))).toEqual(['alert', 'status', 'note']);
    expect(notes[0]?.className).toContain('bg-danger-bg');
    expect(notes[2]?.className).toContain('text-warning-fg');
    expect(notes[1]?.textContent).toBe('Así funciona.');
  });
});
