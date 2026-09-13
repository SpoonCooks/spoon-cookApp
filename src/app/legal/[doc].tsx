import { router, useLocalSearchParams } from 'expo-router';

import { LegalDocumentView } from '@features/legal/LegalViews';
import { LEGAL_DOCUMENTS, legalDocumentFor } from '@features/legal/documents';

/**
 * `/legal/terms` and `/legal/privacy` — the two documents the login screen links to.
 *
 * ONE route with a parameter rather than two files: the documents differ only in their content,
 * and the viewer, header and back behaviour are identical. `documents.ts` holds the pair.
 *
 * This route sits OUTSIDE the signed-in tab group on purpose. Login states "By continuing, I
 * accept the Terms of use & Privacy policy", so a cook being asked to ACCEPT the documents must
 * be able to read them before they have an account. Legal notices are not authenticated content.
 *
 * An unknown `doc` returns to wherever the reader came from rather than rendering an error: a
 * legal document is either published or it is not, and there is no partial state worth drawing.
 */
export default function LegalDocumentRoute(): React.ReactElement | null {
  const { doc } = useLocalSearchParams<{ doc?: string }>();

  const id = legalDocumentFor(doc);
  if (id === null) {
    router.back();
    return null;
  }

  return <LegalDocumentView document={LEGAL_DOCUMENTS[id]} onBack={() => router.back()} />;
}
