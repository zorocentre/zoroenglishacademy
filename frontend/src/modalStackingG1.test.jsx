import React, { useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ModalPortal from './components/common/ModalPortal';
import { ModalStackProvider, getScrollLockCount } from './context/ModalStackContext';

function ThreeLevelNestedModals() {
  const [level1Open, setLevel1Open] = useState(true);
  const [level2Open, setLevel2Open] = useState(false);
  const [level3Open, setLevel3Open] = useState(false);
  const [level1InputValue, setLevel1InputValue] = useState('parent-data');

  return (
    <ModalStackProvider>
      <div>
        <button onClick={() => setLevel1Open(true)}>Open Level 1</button>

        <ModalPortal isOpen={level1Open} onClose={() => setLevel1Open(false)}>
          <div data-testid="backdrop-level-1" className="fixed inset-0 bg-black/50">
            <div data-testid="dialog-level-1" className="bg-white p-6">
              <h2>Level 1 Modal</h2>
              <input
                data-testid="input-level-1"
                value={level1InputValue}
                onChange={(e) => setLevel1InputValue(e.target.value)}
              />
              <button data-testid="btn-open-level-2" onClick={() => setLevel2Open(true)}>
                Open Level 2
              </button>
            </div>
          </div>
        </ModalPortal>

        <ModalPortal isOpen={level2Open} onClose={() => setLevel2Open(false)}>
          <div data-testid="backdrop-level-2" className="fixed inset-0 bg-black/50">
            <div data-testid="dialog-level-2" className="bg-white p-6">
              <h2>Level 2 Modal</h2>
              <button data-testid="btn-open-level-3" onClick={() => setLevel3Open(true)}>
                Open Level 3
              </button>
              <button data-testid="btn-close-level-2" onClick={() => setLevel2Open(false)}>
                Close Level 2
              </button>
            </div>
          </div>
        </ModalPortal>

        <ModalPortal isOpen={level3Open} onClose={() => setLevel3Open(false)}>
          <div data-testid="backdrop-level-3" className="fixed inset-0 bg-black/50">
            <div data-testid="dialog-level-3" className="bg-white p-6">
              <h2>Level 3 Modal</h2>
              <button data-testid="btn-close-level-3" onClick={() => setLevel3Open(false)}>
                Close Level 3
              </button>
            </div>
          </div>
        </ModalPortal>
      </div>
    </ModalStackProvider>
  );
}

describe('Task G1: Global Nested Modal Stacking System', () => {
  beforeEach(() => {
    document.body.style.overflow = '';
  });

  afterEach(() => {
    document.body.style.overflow = '';
  });

  it('1. Correctly calculates layer z-indices for three nested levels', () => {
    render(<ThreeLevelNestedModals />);

    // Level 1 should be open
    const backdrop1 = screen.getByTestId('backdrop-level-1');
    const dialog1 = screen.getByTestId('dialog-level-1');
    expect(backdrop1.style.zIndex).toBe('10000');
    expect(dialog1.style.zIndex).toBe('10001');

    // Open Level 2
    fireEvent.click(screen.getByTestId('btn-open-level-2'));
    const backdrop2 = screen.getByTestId('backdrop-level-2');
    const dialog2 = screen.getByTestId('dialog-level-2');
    expect(backdrop2.style.zIndex).toBe('10010');
    expect(dialog2.style.zIndex).toBe('10011');
    // Level 2 backdrop (10010) sits above Level 1 dialog (10001)
    expect(parseInt(backdrop2.style.zIndex, 10)).toBeGreaterThan(parseInt(dialog1.style.zIndex, 10));

    // Open Level 3
    fireEvent.click(screen.getByTestId('btn-open-level-3'));
    const backdrop3 = screen.getByTestId('backdrop-level-3');
    const dialog3 = screen.getByTestId('dialog-level-3');
    expect(backdrop3.style.zIndex).toBe('10020');
    expect(dialog3.style.zIndex).toBe('10021');
    // Level 3 backdrop (10020) sits above Level 2 dialog (10011)
    expect(parseInt(backdrop3.style.zIndex, 10)).toBeGreaterThan(parseInt(dialog2.style.zIndex, 10));
  });

  it('2. Escape key closes ONLY the top modal, leaving parent open with state intact', () => {
    render(<ThreeLevelNestedModals />);

    // Change input value in Level 1
    const input1 = screen.getByTestId('input-level-1');
    fireEvent.change(input1, { target: { value: 'custom-parent-form-data' } });

    // Open Level 2, then Level 3
    fireEvent.click(screen.getByTestId('btn-open-level-2'));
    fireEvent.click(screen.getByTestId('btn-open-level-3'));

    expect(screen.getByTestId('dialog-level-3')).toBeTruthy();
    expect(screen.getByTestId('dialog-level-2')).toBeTruthy();
    expect(screen.getByTestId('dialog-level-1')).toBeTruthy();

    // Press Escape -> Should close Level 3 ONLY
    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

    expect(screen.queryByTestId('dialog-level-3')).toBeNull();
    expect(screen.getByTestId('dialog-level-2')).toBeTruthy();
    expect(screen.getByTestId('dialog-level-1')).toBeTruthy();

    // Press Escape -> Should close Level 2 ONLY
    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

    expect(screen.queryByTestId('dialog-level-2')).toBeNull();
    expect(screen.getByTestId('dialog-level-1')).toBeTruthy();

    // Level 1 form state must remain intact
    expect(screen.getByTestId('input-level-1').value).toBe('custom-parent-form-data');
  });

  it('3. Reference-counted scroll locking locks body on first open and restores when last closes', () => {
    expect(document.body.style.overflow).toBe('');

    const { unmount } = render(<ThreeLevelNestedModals />);

    // 1 modal open -> body overflow is 'hidden'
    expect(document.body.style.overflow).toBe('hidden');
    expect(getScrollLockCount()).toBe(1);

    // Open Level 2 -> count is 2, overflow still 'hidden'
    fireEvent.click(screen.getByTestId('btn-open-level-2'));
    expect(getScrollLockCount()).toBe(2);
    expect(document.body.style.overflow).toBe('hidden');

    // Close Level 2 -> count is 1, overflow still 'hidden'
    fireEvent.click(screen.getByTestId('btn-close-level-2'));
    expect(getScrollLockCount()).toBe(1);
    expect(document.body.style.overflow).toBe('hidden');

    // Unmount all -> count reaches 0, body overflow restored
    unmount();
    expect(getScrollLockCount()).toBe(0);
    expect(document.body.style.overflow).toBe('');
  });
});
