import {
  openSupportWhatsApp,
  supportMessage,
  supportWhatsAppUrl,
  supportWhatsAppWebUrl,
} from '@core/support/whatsapp';

/**
 * The Help pill's destination.
 *
 * The pill is drawn on nearly every Cook screen and, until this existed, did nothing at all — the
 * `onHelp` prop was declared and no route supplied it. What these lock is the two things a cook
 * would notice: that the number is the founder's support line and not something else, and that a
 * tap never dead-ends when WhatsApp is missing.
 */

describe('the greeting the message opens with', () => {
  it('names the cook when the app knows her', () => {
    expect(supportMessage('Cook Rekha')).toBe('Namaste, main Cook Rekha hu. Mujhe help chahiye.');
  });

  it('still greets when there is no name to use', () => {
    // A blank, missing or whitespace name must not produce "main  hu".
    for (const empty of [null, undefined, '', '   ']) {
      expect(supportMessage(empty)).toBe('Namaste, mujhe help chahiye.');
    }
  });
});

describe('the URLs point at the founder’s support line', () => {
  const NUMBER = '918792997836';

  it('addresses that number in both forms', () => {
    expect(supportWhatsAppUrl('Cook Rekha')).toContain(`phone=${NUMBER}`);
    expect(supportWhatsAppWebUrl('Cook Rekha')).toContain(`wa.me/${NUMBER}`);
  });

  it('encodes the message rather than pasting it raw', () => {
    // The greeting contains spaces and a full stop; an unencoded query would truncate it.
    const url = supportWhatsAppWebUrl('Cook Rekha');
    expect(url).toContain(encodeURIComponent('Namaste, main Cook Rekha hu. Mujhe help chahiye.'));
    expect(url).not.toContain(' ');
  });
});

describe('opening support', () => {
  it('uses the wa.me form first, because it opens the CONVERSATION', async () => {
    const opened: string[] = [];
    const ok = await openSupportWhatsApp('Cook Rekha', {
      openUrl: (url) => {
        opened.push(url);
        return Promise.resolve(true);
      },
    });

    // On a real device the whatsapp:// scheme resumed whatever screen WhatsApp was last on,
    // leaving the cook in her own chat list with nothing written.
    expect(ok).toBe(true);
    expect(opened).toHaveLength(1);
    expect(opened[0]?.startsWith('https://wa.me/')).toBe(true);
  });

  it('launches without asking whether the URL can be opened', async () => {
    // The regression this pins: `canOpenURL` gated the launch, and on Android 11+ package
    // visibility made it answer "no" for a URL the device launched happily by intent. Every Help
    // button on every screen silently did nothing. Only `openUrl` may be consulted.
    const dependencies = { openUrl: () => Promise.resolve(true) };
    await openSupportWhatsApp('Cook Rekha', dependencies);
    expect(Object.keys(dependencies)).toEqual(['openUrl']);
  });

  it('falls back to the app scheme when the https launch is refused', async () => {
    const opened: string[] = [];
    const ok = await openSupportWhatsApp('Cook Rekha', {
      openUrl: (url) => {
        if (url.startsWith('https://')) return Promise.reject(new Error('no activity found'));
        opened.push(url);
        return Promise.resolve(true);
      },
    });

    expect(ok).toBe(true);
    expect(opened).toEqual([supportWhatsAppUrl('Cook Rekha')]);
  });

  it('reports failure instead of throwing when nothing can open', async () => {
    // A Help button must never crash the screen it sits on.
    await expect(
      openSupportWhatsApp('Cook Rekha', {
        openUrl: () => Promise.reject(new Error('no handler')),
      }),
    ).resolves.toBe(false);
  });
});
