import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LumaButton } from './luma-button';
import { By } from '@angular/platform-browser';

describe('LumaButton', () => {
  let fixture: ComponentFixture<LumaButton>;
  let component: LumaButton;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LumaButton],
    }).compileComponents();

    fixture = TestBed.createComponent(LumaButton);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders a button element', () => {
    const btn = fixture.debugElement.query(By.css('button'));
    expect(btn).toBeTruthy();
  });

  it('applies the primary variant class by default', () => {
    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    expect(btn.className).toContain('luma-btn--primary');
  });

  it('applies the correct variant class', () => {
    fixture.componentRef.setInput('variant', 'danger');
    fixture.detectChanges();
    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    expect(btn.className).toContain('luma-btn--danger');
  });

  it('applies the correct size class', () => {
    fixture.componentRef.setInput('size', 'lg');
    fixture.detectChanges();
    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    expect(btn.className).toContain('luma-btn--lg');
  });

  it('emits the clicked output when not disabled', () => {
    const spy = vi.fn();
    component.clicked.subscribe(spy);
    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    btn.click();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('does not emit clicked when disabled', () => {
    const spy = vi.fn();
    component.clicked.subscribe(spy);
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    btn.click();
    expect(spy).not.toHaveBeenCalled();
  });

  it('sets the disabled attribute when disabled input is true', () => {
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    expect(btn.disabled).toBe(true);
  });

  it('passes a custom aria-label', () => {
    fixture.componentRef.setInput('ariaLabel', 'Custom label');
    fixture.detectChanges();
    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    expect(btn.getAttribute('aria-label')).toBe('Custom label');
  });
});
