import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, expect, it, vi } from 'vitest';

const words = { companion_title: 'Companion closet', accessory: 'Accessory', background: 'Background', scarf: 'Sunrise scarf', cap: 'Leaf cap', satchel: 'Pocket satchel', meadow: 'Quiet meadow', night: 'Night sky', preview: 'Unsaved preview', equipped: 'Saved arrangement', equip: 'Equip and save', cancel: 'Cancel preview', companion_alt: 'A small fox with {accessory}, in {background}', closet_intro: 'Three free accessories and two backgrounds. No running required.' };
const text = (key, params = {}) => Object.entries(params).reduce((value, [k, v]) => value.replaceAll(`{${k}}`, String(v)), words[key] || key);
async function mount(props = {}) {
  expect(existsSync(resolve(dirname(fileURLToPath(import.meta.url)), 'CompanionCloset.jsx')), 'closet component exists').toBe(true);
  const path = './CompanionCloset.jsx';
  const { default: Component } = await import(/* @vite-ignore */ path);
  return render(<Component state={{ accessory: 'scarf', background: 'meadow', hidden: false }} text={text} onSave={async () => true} {...props} />);
}
afterEach(cleanup);

it('describes the original static companion and all finite choices accessibly', async () => {
  await mount();
  expect(screen.getByRole('img', { name: 'A small fox with Sunrise scarf, in Quiet meadow' })).toBeInTheDocument();
  expect(screen.getAllByRole('radio')).toHaveLength(5);
});
it('previews without saving, cancels to the committed arrangement, then equips using the keyboard', async () => {
  const save = vi.fn(async () => true);
  await mount({ onSave: save });
  fireEvent.click(screen.getByRole('radio', { name: 'Leaf cap' }));
  expect(screen.getByText('Unsaved preview')).toBeInTheDocument();
  expect(save).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel preview' }));
  expect(screen.getByRole('radio', { name: 'Sunrise scarf' })).toBeChecked();
  const user = userEvent.setup();
  screen.getByRole('radio', { name: 'Pocket satchel' }).focus(); await user.keyboard(' ');
  screen.getByRole('button', { name: 'Equip and save' }).focus(); await user.keyboard('{Enter}');
  expect(save).toHaveBeenCalledWith({ accessory: 'satchel', background: 'meadow', hidden: false });
});
it('keeps the preview visible after a failed equip', async () => {
  await mount({ onSave: async () => false });
  fireEvent.click(screen.getByRole('radio', { name: 'Leaf cap' }));
  fireEvent.click(screen.getByRole('button', { name: 'Equip and save' }));
  expect(screen.getByRole('radio', { name: 'Leaf cap' })).toBeChecked();
  expect(screen.getByText('Unsaved preview')).toBeInTheDocument();
});
