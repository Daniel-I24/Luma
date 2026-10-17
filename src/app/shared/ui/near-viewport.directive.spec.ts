import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NearViewportDirective } from './near-viewport.directive';

@Component({
  imports: [NearViewportDirective],
  template: `<div appNearViewport margin="50% 0px" (nearViewport)="hits = hits + 1"></div>`,
})
class Host {
  hits = 0;
}

describe('NearViewportDirective', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('emits when the element comes near and disconnects on destroy', () => {
    let callback!: (entries: { isIntersecting: boolean }[]) => void;
    const observer = { observe: vi.fn(), disconnect: vi.fn() };
    const options: unknown[] = [];
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(cb: typeof callback, init: unknown) {
          callback = cb;
          options.push(init);
          return observer;
        }
      },
    );

    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    TestBed.tick();

    expect(observer.observe).toHaveBeenCalledWith(fixture.nativeElement.querySelector('div'));
    expect(options[0]).toEqual({ root: null, rootMargin: '50% 0px' });

    callback([{ isIntersecting: false }]);
    callback([{ isIntersecting: true }]);
    expect(fixture.componentInstance.hits).toBe(1);

    fixture.destroy();
    expect(observer.disconnect).toHaveBeenCalled();
  });
});
