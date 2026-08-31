import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ImageSourcePropType,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';

import { infoBack } from '@ui/icons/figmaV14Icons';

import { chipLabels, niyamIndexChips, type RuleIcon, type RuleKey, type RuleSheet } from './rules';
import {
  color,
  figmaStroke,
  HelpPill,
  Text,
  TopNavBar,
  useDesignScale,
  type DesignScale,
} from '@ui';

/**
 * The V14 `Info` section (`611:398`) — the Niyam tab and its five rule sheets.
 *
 * ## Two shapes, not six
 *
 * `597:1131` is a full screen: status bar, a `Jaankari` top nav with a Help pill, two bordered
 * cards of chips, and the bottom nav. It is the Niyam destination.
 *
 * The other five (`597:1221`, `603:1865`, `603:1924`, `605:2027`, `605:2094`) are **bottom
 * sheets**: each frame is 371x882 with the status mock at y=0 and the sheet at **y=239**, 643
 * tall with a 20-unit top radius. The 203 units above it are scrim. That is why they carry no
 * bottom nav — they sit over the Niyam screen rather than replacing it — and it is the same
 * pattern `leave` already uses for its two pickers.
 *
 * ## The title is `Jaankari`, not `Serving at`
 *
 * `597:1148` is *named* `Serving at` in the layer tree and *reads* `Jaankari`. Several V14 nodes
 * are stale this way, so every string here comes from `get_design_context` rather than metadata.
 */

/** `597:1235` — the sheet surface. */
const SHEET = {
  top: 239,
  height: 643,
  radius: 20,
  padding: 16,
  gap: 16,
  blockPaddingH: 4,
  blockPaddingV: 6,
  ctaBottom: 24,
  ctaWidth: 338,
} as const;

/**
 * `597:1239` — the sheet header: back arrow, title, compact Help pill.
 *
 * `titleWidth` is the room the design leaves, not any one sheet's title box. `Frame 137` is 182
 * wide with the 32-unit chevron at x=0 and the title at x=44, so the title may run to **138** —
 * and `Extra hours` uses every unit of it. The old 130 was measured off `597:1243` alone, and it
 * truncated that title to `Extra` on device.
 */
const HEADER = { height: 38, glyph: 32, titleLeft: 44, titleWidth: 138 } as const;

/** `597:1248` — the icon-and-line summary under the header. */
const BLURB = { icon: 30, gap: 12, radius: 24 } as const;

/** `597:1342` — the rating matrix. */
const MATRIX = {
  radius: 24,
  paddingH: 12,
  paddingV: 16,
  borderWidth: 1,
  columnGap: 10,
  rowGap: 12,
  firstColumn: 106,
  headerHeight: 24,
  rowHeight: 41,
  blockedHeight: 25,
  cellRadius: 5,
  headerRadius: 15,
} as const;

/** `603:1897` — the policy card. */
const POLICY = {
  radius: 15,
  borderWidth: 1,
  paddingH: 12,
  paddingV: 16,
  gap: 10,
  pillWidth: 281,
  pillRadius: 15,
  pillPaddingH: 12,
  pillPaddingV: 4,
  tableRadius: 24,
  tablePaddingH: 12,
  tablePaddingV: 8,
  tableColumnGap: 10,
  tableRowGap: 12,
  tableFirstColumn: 175,
  cellHeight: 35,
  cellRadius: 5,
  /** `603:1960` — a header chip's radius. Three times the data cells' 5. */
  headerRadius: 15,
  footRadius: 5,
  footPaddingH: 12,
  footPaddingV: 8,
} as const;

/**
 * `597:1337` — the cook's own standing.
 *
 * There is deliberately no `valueWidth`. The design sizes this value to its CONTENT and pins it to
 * the row's right edge — every one of the five sheets ends it at x=319 inside a 331-wide row, but
 * the box itself is 58 units on `Aapki rating` (`4.6`), 124 on `Extra hours` (`4 hrs 5 mins`) and
 * 142 on `Late` (`1 hr 34 mins`). A single fixed 58 was read off the rating sheet and applied to
 * all five, which wrapped `4 hrs 5 mins` onto three lines and pushed it out of its own row.
 */
const STANDING = { radius: 15, paddingH: 12, paddingV: 8 } as const;

/** `597:1237` — `Samajh gyi`. */
const CTA = { radius: 15, paddingH: 12, paddingV: 8 } as const;

/** `597:1153` — the Niyam index blocks. */
const INDEX = {
  padding: 16,
  gap: 16,
  cardWidth: 330,
  cardRadius: 16,
  cardPadding: 16,
  cardGap: 16,
  borderWidth: 1,
  chipRadius: 15,
  chipPaddingH: 12,
  chipPaddingV: 8,
  chipGap: 10,
  headingGap: 12,
} as const;

/*
 * The back chevron is INLINED MARKUP, not an image source.
 *
 * It was `require('...info-back.svg')` handed to an `<Image>`, and React Native cannot decode an
 * SVG: the chevron simply did not draw on any of the five rule sheets. There is no SVG Metro
 * transformer in this project — `figmaV13Icons.ts` already says so — so the markup has to reach
 * the bundle as source and be rendered by `SvgXml`.
 */

const RULE_ICONS: Readonly<Record<RuleIcon, ImageSourcePropType>> = {
  star: require('@/assets/images/figma-v14/star.png') as ImageSourcePropType,
  multiply: require('@/assets/images/figma-v14/multiply.png') as ImageSourcePropType,
  timer: require('@/assets/images/figma-v14/timer.png') as ImageSourcePropType,
  clock: require('@/assets/images/figma-v14/clock.png') as ImageSourcePropType,
};

/* ------------------------------------------------------------------ index --- */

export interface NiyamIndexViewProps {
  readonly onOpenRule?: ((rule: RuleKey) => void) | undefined;
  readonly onHelp?: (() => void) | undefined;
}

/** `597:1131` — the Niyam destination. */
export function NiyamIndexView({ onOpenRule, onHelp }: NiyamIndexViewProps): React.ReactElement {
  const scale = useDesignScale();
  const { s } = scale;
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.screen}>
      {/*
       * `597:1131` draws the 32-unit `phone bar` at y=0. That band is the OS's, so the screen
       * starts below the real inset — the same thing every other destination does, and what this
       * one was missing when the pixel run measured it 10 units high.
       */}
      <View style={{ height: insets.top }} />
      <TopNavBar title="Jaankari" titleVariant="screenTitle" onHelp={onHelp} testID="niyam-nav" />
      <ScrollView
        contentContainerStyle={[styles.indexBody, { padding: s(INDEX.padding), gap: s(INDEX.gap) }]}
        testID="niyam-scroll"
      >
        <View
          style={[
            styles.block,
            { paddingHorizontal: s(SHEET.blockPaddingH), paddingVertical: s(SHEET.blockPaddingV) },
          ]}
        >
          <View style={[styles.stretch, { gap: s(INDEX.headingGap) }]}>
            <Text variant="overlineXl" color={color.black} style={styles.upper}>
              Kamai aur nuksaan
            </Text>
            <Text variant="bodyMuted" color={color.black}>
              Yaha pe aapko apne kamai aur apne nuksaan ke baare me jaankari mil jaegi.
            </Text>
          </View>
        </View>

        <IndexCard
          heading="kamai"
          caption="Aap jitna zyada aur jitna accha kaam kare, kamai utni zyada hogi"
          borderColor={color.yellow600}
          chipFill={color.lime600}
          rules={niyamIndexChips.kamai}
          scale={scale}
          onOpenRule={onOpenRule}
        />
        <IndexCard
          heading="nuksaan"
          caption="Agar aap kaam pe late jaate hai, ya kaam pe nahi jaate, toh paise ki katauti ho sakti hai"
          borderColor={color.danger}
          chipFill={color.dangerTint}
          rules={niyamIndexChips.nuksaan}
          scale={scale}
          onOpenRule={onOpenRule}
        />
      </ScrollView>
    </View>
  );
}

/**
 * `609:356` / `609:382` — one bordered card of rule chips.
 *
 * The `kamai` card leads with a full-width `Rating` chip and then a two-up row; `nuksaan` is a
 * two-up row alone. That falls out of the rule count rather than needing a flag: the first chip
 * spans when there are three.
 */
function IndexCard({
  heading,
  caption,
  borderColor,
  chipFill,
  rules,
  scale,
  onOpenRule,
}: {
  heading: string;
  caption: string;
  borderColor: string;
  chipFill: string;
  rules: readonly RuleKey[];
  scale: DesignScale;
  onOpenRule?: ((rule: RuleKey) => void) | undefined;
}): React.ReactElement {
  const { s } = scale;
  const [lead, ...rest] = rules.length === 3 ? rules : [];
  const paired = rules.length === 3 ? rest : rules;

  return (
    <View
      style={[
        styles.block,
        { paddingHorizontal: s(SHEET.blockPaddingH), paddingVertical: s(SHEET.blockPaddingV) },
      ]}
    >
      <View
        style={[
          styles.indexCard,
          figmaStroke(scale, { width: INDEX.borderWidth, padding: INDEX.cardPadding }),
          {
            width: s(INDEX.cardWidth),
            borderRadius: s(INDEX.cardRadius),
            gap: s(INDEX.cardGap),
            borderColor,
          },
        ]}
        testID={`niyam-card-${heading}`}
      >
        <View style={[styles.stretch, { gap: s(INDEX.headingGap) }]}>
          <Text variant="overlineXl" color={color.black} style={styles.upper}>
            {heading}
          </Text>
          <Text variant="bodyMuted" color={color.black}>
            {caption}
          </Text>
        </View>

        {lead !== undefined && (
          <RuleChip rule={lead} fill={chipFill} scale={scale} onPress={onOpenRule} />
        )}
        <View style={[styles.chipRow, { gap: s(INDEX.chipGap) }]}>
          {paired.map((rule) => (
            <RuleChip
              key={rule}
              rule={rule}
              fill={chipFill}
              scale={scale}
              onPress={onOpenRule}
              flex
            />
          ))}
        </View>
      </View>
    </View>
  );
}

function RuleChip({
  rule,
  fill,
  scale,
  onPress,
  flex,
}: {
  rule: RuleKey;
  fill: string;
  scale: DesignScale;
  onPress?: ((rule: RuleKey) => void) | undefined;
  flex?: boolean;
}): React.ReactElement {
  const { s } = scale;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress ? () => onPress(rule) : undefined}
      style={[
        styles.chip,
        // `alignSelf` only. `styles.stretch` also carries `alignItems: 'flex-start'`, which the
        // two headings above want and a CHIP does not: on the full-width chip it overrode the
        // chip's own `alignItems: 'center'` and pushed the label hard left, so `Rating` sat off
        // to one side while the half-width `Extra hours` and `5+` — which take `flexOne` and
        // never touch that rule — stayed centred.
        flex === true ? styles.flexOne : styles.chipStretch,
        {
          backgroundColor: fill,
          borderRadius: s(INDEX.chipRadius),
          paddingHorizontal: s(INDEX.chipPaddingH),
          paddingVertical: s(INDEX.chipPaddingV),
        },
      ]}
      testID={`niyam-chip-${rule}`}
    >
      <Text variant="headingLg" color={color.black} align="center" style={styles.flexOne}>
        {chipLabels[rule]}
      </Text>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ sheet --- */

export interface RuleSheetViewProps {
  readonly sheet: RuleSheet;
  /**
   * The cook's own standing, e.g. `4.6` or `6`.
   *
   * Supplied by the caller from the performance projection, never taken from {@link RuleSheet} —
   * the tariff table is policy every cook shares, this number is theirs alone.
   */
  readonly standingValue: string;
  readonly onAcknowledge?: (() => void) | undefined;
  readonly onBack?: (() => void) | undefined;
  readonly onHelp?: (() => void) | undefined;
}

/** `597:1235` and its four siblings — a rule sheet presented over the Niyam screen. */
export function RuleSheetView({
  sheet,
  standingValue,
  onAcknowledge,
  onBack,
  onHelp,
}: RuleSheetViewProps): React.ReactElement {
  const scale = useDesignScale();
  const { s } = scale;
  const insets = useSafeAreaInsets();

  return (
    /*
     * The scrim runs edge to edge — including behind the status band, which is what the design
     * draws — and the sheet keeps its exact design height above the device's navigation bar, so
     * every row lands on the row the frame puts it on. These five frames are compared by their
     * LAST row, so a sheet that grew by the inset would carry every element up with it.
     *
     * What the inset changes is the COLOUR under the sheet, not the geometry: the strip below is
     * painted white by the sibling below rather than left as dark scrim, which is what read on
     * device as the `Samajh gyi` button being cut off by a black band.
     */
    <View style={styles.scrim} testID={`rule-sheet-${sheet.key}`}>
      <View
        style={[
          styles.sheet,
          {
            height: s(SHEET.height),
            borderTopLeftRadius: s(SHEET.radius),
            borderTopRightRadius: s(SHEET.radius),
            padding: s(SHEET.padding),
            gap: s(SHEET.gap),
          },
        ]}
      >
        <View
          style={[
            styles.header,
            {
              height: s(HEADER.height),
              paddingHorizontal: s(SHEET.blockPaddingH),
              paddingVertical: s(SHEET.blockPaddingV),
            },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={onBack}
            style={styles.headerLeft}
            testID={`rule-back-${sheet.key}`}
          >
            <SvgXml xml={infoBack} width={s(HEADER.glyph)} height={s(HEADER.glyph)} />
            <Text
              variant="screenTitle"
              color={color.black}
              style={{
                marginLeft: s(HEADER.titleLeft - HEADER.glyph),
                width: s(HEADER.titleWidth),
              }}
            >
              {sheet.title}
            </Text>
          </Pressable>
          <HelpPill size="compact" onPress={onHelp} testID={`rule-help-${sheet.key}`} />
        </View>

        <View
          style={[
            styles.block,
            {
              paddingHorizontal: s(SHEET.blockPaddingH),
              paddingVertical: s(sheet.blurbPaddingV),
            },
          ]}
        >
          <View style={[styles.blurb, { gap: s(BLURB.gap), borderRadius: s(BLURB.radius) }]}>
            <Image
              source={RULE_ICONS[sheet.icon]}
              style={{ width: s(BLURB.icon), height: s(BLURB.icon) }}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
            {/*
             * A MINIMUM width, not a fixed one.
             *
             * V14 fixes this line at 247–291 units and centres the icon-plus-line pair inside the
             * block, so the width is what decides where the ICON lands. But Android measures
             * `NO SHOW: booking pe nahi jaana` about two units wider than Figma lays it out, and
             * a hard 291 wrapped `jaana` onto a second line — a far worse error than the unit of
             * icon drift the width exists to remove. A minimum gives the design's geometry
             * wherever the platform agrees, and one line wherever it does not.
             */}
            <Text
              variant="timeStrong"
              color={color.black}
              align="center"
              style={{ minWidth: s(sheet.blurbWidth) }}
            >
              {sheet.blurb}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.block,
            { paddingHorizontal: s(SHEET.blockPaddingH), paddingVertical: s(SHEET.blockPaddingV) },
          ]}
        >
          {sheet.body.kind === 'matrix' ? (
            <MatrixBody body={sheet.body} scale={scale} />
          ) : (
            <PolicyBody body={sheet.body} scale={scale} />
          )}
        </View>

        <View
          style={[
            styles.block,
            { paddingHorizontal: s(SHEET.blockPaddingH), paddingVertical: s(SHEET.blockPaddingV) },
          ]}
        >
          <View
            style={[
              styles.standing,
              {
                borderRadius: s(STANDING.radius),
                paddingHorizontal: s(STANDING.paddingH),
                paddingVertical: s(STANDING.paddingV),
              },
            ]}
          >
            <Text
              variant="title"
              color={color.danger}
              style={
                sheet.standingLabelWidth === null
                  ? styles.flexOne
                  : { width: s(sheet.standingLabelWidth) }
              }
            >
              {sheet.standingLabel}
            </Text>
            {/*
             * Centred in its own box, which is what every one of the five frames draws. Aligning
             * it to the right instead put `6` hard against the row's inner edge, twenty-two units
             * past where the design's 58-unit box centres it.
             */}
            <Text
              variant="chipLabel"
              color={color.black}
              align="center"
              numberOfLines={1}
              style={
                sheet.standingValueWidth === null
                  ? styles.flexOne
                  : { width: s(sheet.standingValueWidth) }
              }
              testID={`rule-standing-${sheet.key}`}
            >
              {standingValue}
            </Text>
          </View>
        </View>

        {/*
         * `left: 0, right: 0` and a centred 338-unit child, NOT a bare `width: 338`.
         *
         * The design writes `left: calc(50% - 0.5px)` with `translateX(-50%)`, which lands the
         * block at x=16 in the 371 frame. An absolute child with neither edge set takes Yoga's
         * static position, which is the sheet's border-box origin -- x=0 -- so the whole button
         * drew sixteen units left of its design column on all five sheets. Pinning both edges
         * makes the answer the same whether the containing block is read as the padding box or
         * the border box: 371 minus 338 and 339 minus 338 both centre on x=16.5.
         */}
        <View style={[styles.cta, { bottom: s(SHEET.ctaBottom) }]}>
          <View
            style={{
              width: s(SHEET.ctaWidth),
              paddingHorizontal: s(SHEET.blockPaddingH),
              paddingVertical: s(SHEET.blockPaddingV),
            }}
          >
            <Pressable
              accessibilityRole="button"
              onPress={onAcknowledge}
              style={[
                styles.ctaButton,
                {
                  borderRadius: s(CTA.radius),
                  paddingHorizontal: s(CTA.paddingH),
                  paddingVertical: s(CTA.paddingV),
                },
              ]}
              testID={`rule-ack-${sheet.key}`}
            >
              <Text variant="screenTitle" color={color.black} align="center">
                Samajh gyi
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
      {/* The safe-area strip under the sheet, in the sheet's own white. The sheet keeps its
          design height; only this band changes, from dark scrim to the surface it sits on. */}
      <View style={{ height: insets.bottom, backgroundColor: color.white }} />
    </View>
  );
}

/** `597:1342` — header row plus five tinted tiers. */
function MatrixBody({
  body,
  scale,
}: {
  body: Extract<RuleSheet['body'], { kind: 'matrix' }>;
  scale: DesignScale;
}): React.ReactElement {
  const { s } = scale;
  return (
    <View
      style={[
        styles.matrix,
        figmaStroke(scale, {
          width: MATRIX.borderWidth,
          paddingH: MATRIX.paddingH,
          paddingV: MATRIX.paddingV,
        }),
        { borderRadius: s(MATRIX.radius), rowGap: s(MATRIX.rowGap) },
      ]}
    >
      <View
        style={[styles.row, { columnGap: s(MATRIX.columnGap), height: s(MATRIX.headerHeight) }]}
      >
        {body.header.map((label, index) => (
          <View
            key={label}
            style={[
              styles.cell,
              index === 0 ? { width: s(MATRIX.firstColumn) } : styles.flexOne,
              { backgroundColor: color.yellow600, borderRadius: s(MATRIX.headerRadius) },
            ]}
          >
            <Text variant="title" color={color.black} align="center">
              {label}
            </Text>
          </View>
        ))}
      </View>

      {body.rows.map((row) => (
        <View
          key={row.cells[0]}
          style={[
            styles.row,
            {
              columnGap: s(MATRIX.columnGap),
              height: s(row.fill === '#f5f5f5' ? MATRIX.blockedHeight : MATRIX.rowHeight),
            },
          ]}
        >
          {row.cells.map((cellText, index) => (
            <View
              key={`${row.cells[0]}-${index}`}
              style={[
                styles.cell,
                index === 0 ? { width: s(MATRIX.firstColumn) } : styles.flexOne,
                { backgroundColor: row.fill, borderRadius: s(MATRIX.cellRadius) },
              ]}
            >
              <Text variant="ruleCell" color={color.black} align="center">
                {cellText}
              </Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

/** `603:1897` — a titled pill, a table, then a mixed-weight footnote. */
function PolicyBody({
  body,
  scale,
}: {
  body: Extract<RuleSheet['body'], { kind: 'policy' }>;
  scale: DesignScale;
}): React.ReactElement {
  const { s } = scale;
  return (
    <View
      style={[
        styles.policy,
        figmaStroke(scale, {
          width: POLICY.borderWidth,
          paddingH: POLICY.paddingH,
          paddingV: POLICY.paddingV,
        }),
        { borderRadius: s(POLICY.radius), gap: s(POLICY.gap) },
      ]}
    >
      <View
        style={[
          styles.policyPill,
          {
            width: s(POLICY.pillWidth),
            borderRadius: s(POLICY.pillRadius),
            paddingHorizontal: s(POLICY.pillPaddingH),
            paddingVertical: s(POLICY.pillPaddingV),
            backgroundColor: body.accent.pill,
          },
        ]}
      >
        <Text variant="timeStrong" color={color.black} align="center">
          {body.title}
        </Text>
      </View>

      <View
        style={[
          styles.policyTable,
          {
            borderRadius: s(POLICY.tableRadius),
            paddingHorizontal: s(POLICY.tablePaddingH),
            paddingVertical: s(POLICY.tablePaddingV),
            rowGap: s(POLICY.tableRowGap),
          },
        ]}
      >
        {body.columns !== null && (
          <View
            style={[
              styles.row,
              { columnGap: s(POLICY.tableColumnGap), height: s(POLICY.cellHeight) },
            ]}
          >
            {body.columns.map((label, index) => (
              <View
                key={label}
                style={[
                  styles.cell,
                  { width: s(body.columnWidths[index] ?? POLICY.tableFirstColumn) },
                  { backgroundColor: body.accent.chip, borderRadius: s(POLICY.headerRadius) },
                ]}
              >
                <Text variant="policyHeaderCell" color={color.black} align="center">
                  {label}
                </Text>
              </View>
            ))}
          </View>
        )}

        {body.rows.map((row) => (
          <View
            key={row[0]}
            style={[
              styles.row,
              { columnGap: s(POLICY.tableColumnGap), height: s(POLICY.cellHeight) },
            ]}
          >
            {row.map((cellText, index) => (
              <View
                key={`${row[0]}-${index}`}
                style={[
                  styles.cell,
                  { width: s(body.columnWidths[index] ?? POLICY.tableFirstColumn) },
                  { backgroundColor: body.rowFill, borderRadius: s(POLICY.cellRadius) },
                ]}
              >
                <Text
                  variant={body.cellFontSize === 20 ? 'policyCell' : 'policyCellSm'}
                  color={color.black}
                  align="center"
                >
                  {cellText}
                </Text>
              </View>
            ))}
          </View>
        ))}
      </View>

      <View
        style={[
          styles.policyFoot,
          {
            width: s(POLICY.pillWidth),
            borderRadius: s(POLICY.footRadius),
            paddingHorizontal: s(POLICY.footPaddingH),
            paddingVertical: s(POLICY.footPaddingV),
          },
        ]}
      >
        <Text
          variant={body.footnoteTracking === 0 ? 'ruleFootnotePlain' : 'ruleFootnote'}
          color={color.black}
          align="center"
          style={styles.flexOne}
        >
          {body.footnote.map((segment, index) =>
            segment.strong === true ? (
              <Text
                key={index}
                variant={
                  body.footnoteTracking === 0 ? 'ruleFootnotePlainStrong' : 'ruleFootnoteStrong'
                }
                color={color.black}
              >
                {segment.text}
              </Text>
            ) : (
              segment.text
            ),
          )}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.white },
  indexBody: { alignItems: 'center', backgroundColor: color.white },
  block: { alignSelf: 'stretch', alignItems: 'flex-start' },
  stretch: { alignSelf: 'stretch', alignItems: 'flex-start' },
  flexOne: { flex: 1 },
  /** A chip that fills its row, centred by `chip` rather than aligned by its container. */
  chipStretch: { alignSelf: 'stretch' },
  upper: { textTransform: 'uppercase' },

  indexCard: { alignItems: 'flex-start', backgroundColor: color.white },
  chipRow: { alignSelf: 'stretch', flexDirection: 'row' },
  chip: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },

  /**
   * The 203 design units above the sheet.
   *
   * `leave` presents its two pickers over the same scrim, so the value is the one already agreed
   * there rather than a second opinion about how dark a sheet backdrop should be.
   */
  scrim: { flex: 1, justifyContent: 'flex-end', backgroundColor: color.scrim },
  sheet: {
    alignSelf: 'stretch',
    alignItems: 'flex-start',
    backgroundColor: color.white,
    overflow: 'hidden',
  },
  header: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  blurb: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  matrix: { alignSelf: 'stretch', backgroundColor: color.white, borderColor: color.yellow600 },
  row: { alignSelf: 'stretch', flexDirection: 'row' },
  cell: { alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch' },

  policy: {
    alignSelf: 'stretch',
    alignItems: 'center',
    borderColor: color.yellow600,
    overflow: 'hidden',
  },
  policyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    // Overridden per sheet — see `PolicyAccent`. Kept as the penalty fill so a card still draws
    // something recognisable if a future body ever arrives without an accent.
    backgroundColor: color.yellow600,
  },
  policyTable: { alignSelf: 'stretch', backgroundColor: color.white },
  policyFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.lime300,
  },

  standing: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: color.lime300,
    overflow: 'hidden',
  },

  cta: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  ctaButton: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.yellow600,
  },
});
