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
  it('prefers the installed app', async () => {
    const opened: string[] = [];
    const ok = await openSupportWhatsApp('Cook Rekha', {
      canOpenUrl: () => Promise.resolve(true),
      openUrl: (url) => {
        opened.push(url);
        return Promise.resolve(true);
      },
    });

    expect(ok).toBe(true);
    expect(opened).toHaveLength(1);
    expect(opened[0]?.startsWith('whatsapp://')).toBe(true);
  });

  it('falls back to the web form when WhatsApp is not installed', async () => {
    const opened: string[] = [];
    const ok = await openSupportWhatsApp('Cook Rekha', {
      canOpenUrl: (url) => Promise.resolve(!url.startsWith('whatsapp://')),
      openUrl: (url) => {
        opened.push(url);
        return Promise.resolve(true);
      },
    });

    // The cook still reaches the number through the browser rather than tapping into nothing.
    expect(ok).toBe(true);
    expect(opened[0]?.startsWith('https://wa.me/')).toBe(true);
  });

  it('reports failure instead of throwing when nothing can open', async () => {
    // A Help button must never crash the screen it sits on.
    await expect(
      openSupportWhatsApp('Cook Rekha', {
        canOpenUrl: () => Promise.reject(new Error('no handler')),
        openUrl: () => Promise.reject(new Error('no handler')),
      }),
    ).resolves.toBe(false);
  });

  it('tries the web form when the app handler refuses the launch', async () => {
    const opened: string[] = [];
    const ok = await openSupportWhatsApp(null, {
      canOpenUrl: () => Promise.resolve(true),
      openUrl: (url) => {
        if (url.startsWith('whatsapp://')) return Promise.reject(new Error('refused'));
        opened.push(url);
        return Promise.resolve(true);
      },
    });

    expect(ok).toBe(true);
    expect(opened[0]?.startsWith('https://wa.me/')).toBe(true);
  });
});
