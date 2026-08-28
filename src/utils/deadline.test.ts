import { describe, expect, it, vi } from 'vitest';

import { TIMED_OUT, withDeadline } from './deadline';

describe('withDeadline', () => {
  it('passes a value through when the promise wins', async () => {
    await expect(withDeadline(Promise.resolve(7), 50)).resolves.toBe(7);
  });

  it('passes a rejection through when the promise wins', async () => {
    await expect(
      withDeadline(Promise.reject(new Error('upstream')), 50),
    ).rejects.toThrow('upstream');
  });

  it('resolves to TIMED_OUT when the promise never settles', async () => {
    await expect(withDeadline(new Promise(() => {}), 10)).resolves.toBe(
      TIMED_OUT,
    );
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
  ])('does not read a resolved %s as a timeout', async (_label, value) => {
    await expect(withDeadline(Promise.resolve(value), 50)).resolves.toBe(value);
  });

  it('does not leave the rejection of an abandoned promise unhandled', async () => {
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);

    let reject: (error: Error) => void = () => {};
    const abandoned = new Promise((_resolve, r) => {
      reject = r;
    });

    await expect(withDeadline(abandoned, 10)).resolves.toBe(TIMED_OUT);
    reject(new Error('settled long after nobody was listening'));
    await new Promise((resolve) => setTimeout(resolve, 20));

    process.off('unhandledRejection', unhandled);
    expect(unhandled).not.toHaveBeenCalled();
  });
});
