import { describe, expect, it } from 'vitest';

import { isEmbeddedBrowser, signInErrorMessage } from './sign-in-help';

describe('signInErrorMessage', () => {
  it('says nothing when there was no error', () => {
    expect(signInErrorMessage(undefined)).toBeNull();
    expect(signInErrorMessage('')).toBeNull();
  });

  it('explains every state failure as a browser switch, with what to do', () => {
    for (const code of [
      'state_mismatch',
      'state_security_mismatch',
      'state_not_found',
      'state_invalid',
      'please_restart_the_process',
    ]) {
      expect(signInErrorMessage(code)).toMatch(/Chrome or Safari/);
    }
  });

  it('still says something for a code it does not know, with the code', () => {
    expect(signInErrorMessage('weird_thing')).toMatch(/weird_thing/);
  });

  it('never uses an em dash, per the UI copy rules', () => {
    for (const code of ['state_mismatch', 'access_denied', 'x']) {
      expect(signInErrorMessage(code)).not.toMatch(/—/);
    }
  });
});

describe('isEmbeddedBrowser', () => {
  it('recognises in-app browsers', () => {
    expect(
      isEmbeddedBrowser(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 300.0',
      ),
    ).toBe(true);
    expect(
      isEmbeddedBrowser(
        'Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0 Mobile Safari/537.36',
      ),
    ).toBe(true);
    expect(
      isEmbeddedBrowser(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) GSA/300.0 Mobile/15E148 Safari/604.1',
      ),
    ).toBe(true);
  });

  it('leaves real browsers alone', () => {
    expect(
      isEmbeddedBrowser(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      ),
    ).toBe(false);
    expect(
      isEmbeddedBrowser(
        'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36',
      ),
    ).toBe(false);
    expect(isEmbeddedBrowser(null)).toBe(false);
  });
});
