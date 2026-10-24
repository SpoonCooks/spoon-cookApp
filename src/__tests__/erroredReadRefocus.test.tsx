import { focusManager, QueryObserver } from '@tanstack/react-query';

import { createQueryClient } from '../core/api/queries';

describe('an errored read after the app comes back to the foreground', () => {
  it('re-reads at once instead of waiting for the cook to tap Firse koshish kare', async () => {
    const client = createQueryClient();
    let calls = 0;
    const queryFn = jest.fn(async () => {
      calls += 1;
      if (calls === 1) throw new Error('boom');
      return 'ok';
    });
    const observer = new QueryObserver(client, { queryKey: ['x'], queryFn, retry: false });
    const unsubscribe = observer.subscribe(() => undefined);
    await new Promise((r) => setTimeout(r, 20));
    expect(observer.getCurrentResult().status).toBe('error');

    focusManager.setFocused(false);
    focusManager.setFocused(true);
    await new Promise((r) => setTimeout(r, 20));

    expect(queryFn).toHaveBeenCalledTimes(2);
    expect(observer.getCurrentResult().status).toBe('success');
    unsubscribe();
  });
});
