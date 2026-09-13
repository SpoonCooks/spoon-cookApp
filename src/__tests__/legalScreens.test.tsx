import { fireEvent, render, screen } from '@testing-library/react-native';

import LegalDocumentRoute from '@/app/legal/[doc]';
import { LEGAL_DOCUMENTS } from '@features/legal/documents';

/**
 * `/legal/terms` and `/legal/privacy` — the documents the login screen links to.
 *
 * These assert the CONTRACT of the screen: the right document renders for the right parameter,
 * the published date is the September 1, 2026 revision on both, and the copy is the source's own
 * wording rather than a paraphrase (spot-checked on lines that would be the first casualties of a
 * tidy-up).
 */

let mockRouteParams: Record<string, string> = {};

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => mockRouteParams,
}));

const mockBack = (jest.requireMock('expo-router') as { router: { back: jest.Mock } }).router.back;

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, bottom: 16, left: 0, right: 0 }),
}));

beforeEach(() => {
  mockBack.mockClear();
  mockRouteParams = {};
});

describe('the two bundled documents', () => {
  it('both carry the September 1, 2026 revision date and never the May one', () => {
    for (const document of Object.values(LEGAL_DOCUMENTS)) {
      expect(document.updated).toContain('September 1, 2026');
      const everything = JSON.stringify(document);
      expect(everything).not.toContain('May 1, 2026');
    }
  });
});

describe('/legal/terms', () => {
  it('renders the Customer Terms of Service', () => {
    mockRouteParams = { doc: 'terms' };
    render(<LegalDocumentRoute />);
    expect(screen.getByText('Customer Terms of Service')).toBeTruthy();
    expect(screen.getByTestId('legal-updated')).toHaveTextContent(
      /Last Updated: September 1, 2026/,
    );
    // Verbatim spot-checks, one per kind of block.
    expect(screen.getByText('1. ABOUT THESE TERMS')).toBeTruthy();
    expect(screen.getByText('Session OTP verification')).toBeTruthy();
    expect(
      screen.getByText('Reside in India in a city where Spoon currently operates'),
    ).toBeTruthy();
  });

  it('pops back through the header', () => {
    mockRouteParams = { doc: 'terms' };
    render(<LegalDocumentRoute />);
    fireEvent.press(screen.getByTestId('legal-document-back'));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});

describe('/legal/privacy', () => {
  it('renders the Cook Partner Privacy Policy, not the customer one', () => {
    mockRouteParams = { doc: 'privacy' };
    render(<LegalDocumentRoute />);
    expect(screen.getByText('Cook Partner Privacy Policy')).toBeTruthy();
    expect(screen.getByText('5. BANK & FINANCIAL DATA')).toBeTruthy();
    expect(
      screen.getByText(
        'We do NOT use your personal information for marketing purposes without your explicit consent.',
      ),
    ).toBeTruthy();
  });
});

describe('an unknown document', () => {
  it('returns to wherever the reader came from rather than drawing an error', () => {
    mockRouteParams = { doc: 'cookies' };
    render(<LegalDocumentRoute />);
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('legal-document-screen')).toBeNull();
  });
});
