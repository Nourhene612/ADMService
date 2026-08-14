import { describe, expect, it, vi } from 'vitest';
import { ConfirmationModalComponent } from './confirmation-modal.component';

describe('ConfirmationModalComponent', () => {
  it('should close the modal by clearing its open state when closeModal is called', () => {
    const component = new ConfirmationModalComponent();
    const closeSpy = vi.spyOn(component.close, 'emit');
    const values: boolean[] = [];

    component.isOpen$.subscribe((value) => values.push(value));

    component.isOpen = true;
    component.closeModal();

    expect(values).toEqual([true, false]);
    expect(closeSpy).toHaveBeenCalledTimes(1);
  });
});
