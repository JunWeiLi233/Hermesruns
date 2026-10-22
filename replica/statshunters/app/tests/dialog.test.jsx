import { StrictMode } from 'react';
import { act, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { Dialog } from '../ui/primitives.jsx';
it('ignores a stale native close event after StrictMode has reopened the dialog',async()=>{
  const original=HTMLDialogElement.prototype.close;
  HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');queueMicrotask(()=>this.dispatchEvent(new Event('close')));};
  const close=vi.fn();
  const {unmount}=render(<StrictMode><Dialog open title="Activity filters" onClose={close}><button>Apply</button></Dialog></StrictMode>);
  await act(async()=>{await Promise.resolve();});
  expect(screen.getByRole('dialog',{name:'Activity filters'})).toHaveAttribute('open');expect(close).not.toHaveBeenCalled();
  unmount();await act(async()=>{await Promise.resolve();});expect(close).not.toHaveBeenCalled();HTMLDialogElement.prototype.close=original;
});
