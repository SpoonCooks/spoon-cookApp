import { jobUrgencyFrom, defaultJobUrgency } from '@core/domain/job';

/**
 * `job flow` §5 — three job states, and which one the card draws.
 *
 * `4c` / `4d` / `4e` differ only by urgency, and the Kaam tab had nothing to choose between them:
 * `GET /v1/cook/jobs` published no ruling, so every job got `defaultJobUrgency` and two of the
 * three designed states were unreachable. The same shape of defect as the travel banner, on a
 * different screen.
 *
 * It is a SERVER ruling, from DEC-044/DEC-059's departure plan. Deciding it here would make the
 * tier depend on the handset's clock, and two cooks looking at one job could disagree about
 * whether it was urgent.
 */
describe('the job card tier follows the server', () => {
  it('takes the escalated tiers the server rules', () => {
    expect(jobUrgencyFrom('imminent')).toBe('imminent');
    expect(jobUrgencyFrom('critical')).toBe('critical');
  });

  it('stays calm when the server has no ruling', () => {
    // `unknown` means no route evidence supports a departure deadline, and DEC-059 forbids
    // manufacturing one. A cook is never shown a red "leave now" card on the strength of a guess.
    expect(jobUrgencyFrom('unknown')).toBe(defaultJobUrgency);
    expect(jobUrgencyFrom(null)).toBe(defaultJobUrgency);
    // An older deployment sends no field at all.
    expect(jobUrgencyFrom(undefined)).toBe(defaultJobUrgency);
  });

  it('does not adopt a tier this build has never heard of', () => {
    // A value added server-side later must not reach `TIER[...]` and render undefined styles.
    expect(jobUrgencyFrom('apocalyptic')).toBe(defaultJobUrgency);
  });
});
