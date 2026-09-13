import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackHeader, Text, color, useDesignScale } from '@ui';

import { LEGAL_ENTITY_LINE, type LegalBlock, type LegalDocument } from './documents';

/**
 * Terms of Service / Privacy Policy, rendered INSIDE the app.
 *
 * Reachable from the login screen's "Terms of use & Privacy policy" line — the one screen whose
 * reader by definition has no account yet — so it renders bundled content with no network read
 * and sits outside every authenticated surface. See `documents.ts` for why the content ships
 * with the app and why it is native text rather than a WebView.
 *
 * The screen is deliberately plain: the app's own type ramp over white, one scroll. The documents
 * are the content; nothing here decorates them beyond what reading them requires.
 */

const PAGE = {
  paddingH: 16,
  headerPaddingTop: 8,
  scrollPaddingTop: 4,
  scrollPaddingBottom: 40,
  sectionGapTop: 24,
  subheadingGapTop: 14,
  blockGapTop: 8,
  sectionRuleWidth: 2,
  sectionRulePaddingBottom: 6,
  bulletIndent: 12,
  bulletGap: 8,
  closingGapTop: 28,
  closingPaddingTop: 14,
} as const;

export interface LegalDocumentViewProps {
  readonly document: LegalDocument;
  readonly onBack: () => void;
  readonly testID?: string;
}

export function LegalDocumentView({
  document,
  onBack,
  testID = 'legal-document-screen',
}: LegalDocumentViewProps): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { s } = useDesignScale();

  return (
    <View style={styles.screen} testID={testID}>
      <View style={{ height: insets.top }} />
      <View style={{ paddingHorizontal: s(PAGE.paddingH), paddingTop: s(PAGE.headerPaddingTop) }}>
        <BackHeader title={document.title} onBack={onBack} testID="legal-document-back" />
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{
          paddingHorizontal: s(PAGE.paddingH),
          paddingTop: s(PAGE.scrollPaddingTop),
          paddingBottom: s(PAGE.scrollPaddingBottom) + insets.bottom,
        }}
        testID="legal-document-scroll"
      >
        <Text variant="captionRegular" style={styles.tagline}>
          {document.tagline}
        </Text>
        <Text variant="label" style={{ marginTop: s(PAGE.blockGapTop) }} testID="legal-updated">
          {document.updated}
        </Text>

        {document.blocks.map((block, index) => (
          <Block key={index} block={block} />
        ))}

        <Text
          variant="caption"
          style={{
            marginTop: s(PAGE.closingGapTop),
            paddingTop: s(PAGE.closingPaddingTop),
            borderTopWidth: 1,
            borderTopColor: color.yellow400,
          }}
        >
          {document.closing}
        </Text>
        <Text variant="label" align="center" style={{ marginTop: s(PAGE.blockGapTop) }}>
          {LEGAL_ENTITY_LINE}
        </Text>
      </ScrollView>
    </View>
  );
}

function Block({ block }: { block: LegalBlock }): React.ReactElement {
  const { s } = useDesignScale();

  switch (block.kind) {
    case 'section':
      return (
        <Text
          variant="title"
          style={{
            marginTop: s(PAGE.sectionGapTop),
            paddingBottom: s(PAGE.sectionRulePaddingBottom),
            borderBottomWidth: s(PAGE.sectionRuleWidth),
            borderBottomColor: color.yellow600,
          }}
        >
          {block.text}
        </Text>
      );
    case 'subheading':
      return (
        <Text variant="caption" style={{ marginTop: s(PAGE.subheadingGapTop) }}>
          {block.text}
        </Text>
      );
    case 'callout':
      return (
        <Text variant="captionStrong" style={{ marginTop: s(PAGE.subheadingGapTop) }}>
          {block.text}
        </Text>
      );
    case 'bullets':
      return (
        <View style={{ marginTop: s(PAGE.blockGapTop), gap: s(6) }}>
          {block.items.map((item, index) => (
            <View
              key={index}
              style={[
                styles.bulletRow,
                { paddingLeft: s(PAGE.bulletIndent), gap: s(PAGE.bulletGap) },
              ]}
            >
              <Text variant="captionRegular">–</Text>
              <Text variant="captionRegular" style={styles.bulletText}>
                {item}
              </Text>
            </View>
          ))}
        </View>
      );
    case 'paragraph':
      return (
        <Text variant="captionRegular" style={{ marginTop: s(PAGE.blockGapTop) }}>
          {block.text}
        </Text>
      );
  }
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.white },
  scroll: { flex: 1 },
  tagline: { fontStyle: 'italic' },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start' },
  bulletText: { flex: 1 },
});
