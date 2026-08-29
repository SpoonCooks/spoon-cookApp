import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SvgXml } from 'react-native-svg';

import {
  HelpPill,
  Text,
  TopNavBar,
  color,
  dropShadow,
  figmaStroke,
  fontFamily,
  useDesignScale,
} from '@ui';
import { bookedTick, chevron, sheetBack } from '@ui/icons/figmaV13Icons';

import { LeaveCalendar } from './LeaveCalendar';

/**
 * Presentational views for the V13 `leave` section (`540:416`).
 *
 * Seven frames, three surfaces:
 *
 *   `592:488` Leave present        \
 *   `592:489` Leave absent          | the CHUTTI destination — `ChuttiView`
 *   `592:832` long leave confirm    |
 *   `592:1008` long leave confirm  /
 *   `592:563` long leave           \  the Lambi Chutti sheet — `LongLeaveSheetView`
 *   `592:639` long leave selected  /
 *   `592:888` short leave             the 1-din confirm sheet — `ShortLeaveSheetView`
 *
 * ## This section's status band is 36.2, not 32 and not 33
 *
 * A third value again. `526:348` is an explicit `h-[36.198px]` row carrying a `#f3f4f6` hairline
 * along its bottom edge — the `log in flow` frames have neither the extra 4 units nor the rule.
 * Every offset below is stated in **content space**, measured from design y = 36.198, which is the
 * row the pixel harness aligns against the emulator's first row under its status bar.
 *
 * ## The sheets are anchored to the BOTTOM
 *
 * `592:563`, `592:639` and `592:888` are bottom sheets over an 80% scrim. Their frames are 846
 * content units tall where the verified emulator supplies 750, so 96 units have to give somewhere.
 * On these three it is the **scrim** that gives, not the sheet: the sheet keeps its design height
 * and stays against the bottom edge, exactly as it does on a real device. `compare.py` therefore
 * aligns these three frames by their last row rather than their first — see `BOTTOM_ANCHORED_NODES`
 * there. Aligning them by the top instead would displace every sheet element by 96 units and
 * report a correct render as a total failure.
 */

/** `526:295` — the scrolling content area under the nav. */
const PAGE = {
  padding: 16,
  gap: 16,
  /** Design height of the content area. The view flexes; recorded for the harness. */
  contentHeight: 799,
} as const;

/** The `px-4 py-6` wrapper every content block sits in. */
const BLOCK = { paddingH: 4, paddingV: 6 } as const;

/** `528:465` — `AAJ KA BREAK`. */
const BREAK = {
  padding: 16,
  gap: 16,
  radius: 16,
  innerGap: 12,
  cellGap: 2,
  cellRadius: 7,
  cellPadding: 6,
  cellBorderWidth: 2,
} as const;

/** `526:334` / `528:432` — the bordered leave cards. */
const CARD = {
  padding: 16,
  radius: 16,
  borderWidth: 1,
  gap: 16,
} as const;

/** `528:386` — one selectable day row. */
const DAY_ROW = {
  borderWidth: 2,
  radius: 15,
  paddingH: 12,
  paddingV: 8,
  gap: 42,
  labelWidth: 139,
  chipWidth: 92,
  chipRadius: 5,
  chipPaddingH: 8,
  chipPaddingV: 4,
  tickSize: 40,
} as const;

/** `528:455` — the `Dates chunein` / `Dates badle` row. */
const LONG_ROW = {
  borderWidth: 2,
  radius: 15,
  paddingH: 12,
  paddingV: 6,
  gap: 7,
  glyphSize: 35,
  labelWidth: 192,
  chevronSize: 32,
  chevronRight: 12.75,
  upcomingWidth: 298,
} as const;

/** `528:660` / `528:573` — the bottom sheets. */
const SHEET = {
  radius: 20,
  padding: 16,
  gap: 16,
  longHeight: 643,
  shortHeight: 486,
  headerHeight: 38,
  headerGap: 12,
  backSize: 32,
  titleWidth: 204,
  ctaWidth: 338,
  ctaHeight: 50,
  ctaBottomLong: 24,
  ctaBottomShort: 16,
  buttonRadius: 15,
  buttonPaddingH: 12,
  buttonPaddingV: 8,
} as const;

/** `529:1240` — the `Total din` strip. */
const TOTAL_ROW = {
  radius: 15,
  paddingH: 12,
  paddingV: 8,
  gap: 104,
  labelWidth: 131,
  valueWidth: 71,
} as const;

const calendarGlyph = require('@/assets/images/figma-v13/calendar.png');

/* ------------------------------------------------------------------ shared --- */

/** The `px-4 py-6` block wrapper. */
function Block({
  children,
  width,
  gap,
  testID,
}: {
  children: React.ReactNode;
  width?: number | undefined;
  gap?: number | undefined;
  testID?: string | undefined;
}): React.ReactElement {
  const { s } = useDesignScale();
  return (
    <View
      style={[
        styles.block,
        { paddingHorizontal: s(BLOCK.paddingH), paddingVertical: s(BLOCK.paddingV) },
        width === undefined ? styles.fullWidth : { width: s(width) },
        gap !== undefined && { gap: s(gap) },
      ]}
      testID={testID}
    >
      {children}
    </View>
  );
}

/** The 1px yellow-bordered card every leave group sits in. */
function OutlineCard({
  children,
  gap,
  testID,
}: {
  children: React.ReactNode;
  gap?: number | undefined;
  testID?: string | undefined;
}): React.ReactElement {
  const scale = useDesignScale();
  const { s } = scale;
  return (
    <View
      style={[
        styles.outlineCard,
        figmaStroke(scale, { width: CARD.borderWidth, padding: CARD.padding }),
        { borderRadius: s(CARD.radius) },
        gap !== undefined && { gap: s(gap) },
      ]}
      testID={testID}
    >
      {children}
    </View>
  );
}

/* ------------------------------------------------------------ CHUTTI screen --- */

export interface BreakWindow {
  /** `528:471` — e.g. `2 hrs`. Derived by the caller from the server's shift. */
  readonly durationLabel: string;
  readonly fromLabel: string;
  readonly toLabel: string;
}

export interface SingleDayLeaveOption {
  readonly dateIso: string;
  /** `528:389` — e.g. `7 November`. */
  readonly dayLabel: string;
  /** `528:401` — `Kal`, `Parso`, or the request's state once it has been filed. */
  readonly relativeLabel: string;
  /**
   * `available` draws the bordered row with a `Chutti` chip. `booked` draws `529:1301`: a filled
   * yellow row whose chip carries the tick. It is set ONLY from a request the server has recorded
   * — never optimistically from a tap.
   */
  readonly state: 'available' | 'booked';
}

export interface LongLeaveCard {
  /** `528:458` — `Dates chunein` before a range exists, `530:1539` `Dates badle` after. */
  readonly label: string;
  /** `530:1576` — e.g. `16 Nov se 25 Nov tak`, or null when nothing is booked. */
  readonly upcoming: string | null;
}

export interface ChuttiViewProps {
  /** `592:483`. `CHUTTI` on three frames; `592:832` sets a date instead. */
  readonly title: string;
  /** `528:465`. Null on every frame but `592:488` — an absent cook has no break today. */
  readonly breakWindow: BreakWindow | null;
  readonly singleDayLeaves: readonly SingleDayLeaveOption[];
  /**
   * `529:1296` — a long-leave card rendered 10 units under the 1-day card inside the SAME block,
   * which is how `592:1008` stacks the two. Null everywhere else.
   */
  readonly groupedLongCard: LongLeaveCard | null;
  /** The long-leave card that gets its own block. */
  readonly longCard: LongLeaveCard | null;
  /** `530:1582` is `w-334`, four units narrower than the 1-day card. `592:832` uses full width. */
  readonly longCardWidth?: number | undefined;
  readonly onPickDay?: ((dateIso: string) => void) | undefined;
  readonly onOpenLongLeave?: (() => void) | undefined;
  readonly onHelp?: (() => void) | undefined;
}

/** `592:488`, `592:489`, `592:832`, `592:1008` — the CHUTTI destination. */
export function ChuttiView({
  title,
  breakWindow,
  singleDayLeaves,
  groupedLongCard,
  longCard,
  longCardWidth,
  onPickDay,
  onOpenLongLeave,
  onHelp,
}: ChuttiViewProps): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { s } = useDesignScale();

  return (
    <View style={styles.screen} testID="chutti-screen">
      <View style={{ height: insets.top }} />
      <TopNavBar title={title} onHelp={onHelp} testID="chutti-nav" />
      {/* Scrollable like the jobs body: with two booked rows the wrapped status copy makes the
          column taller than the frame, and a fixed View buried `Aane wali chutti` behind the
          bottom nav with no way to reach it. */}
      <ScrollView
        contentContainerStyle={[styles.content, { padding: s(PAGE.padding), gap: s(PAGE.gap) }]}
        testID="chutti-scroll"
      >
        {breakWindow !== null && (
          <Block>
            <BreakCard window={breakWindow} />
          </Block>
        )}

        <Block width={338}>
          <View style={{ gap: s(BREAK.innerGap) }}>
            <Text variant="overlineXl" color={color.danger} style={styles.upper}>
              Chutti lagaye
            </Text>
            <Text variant="bodyMuted" color={color.black} testID="chutti-subtitle">
              Aap jitne din aaye, utne din ke paise milenge
            </Text>
          </View>
        </Block>

        {singleDayLeaves.length > 0 && (
          <Block gap={groupedLongCard === null ? undefined : 10}>
            <OutlineCard testID="chutti-single-day-card">
              <View style={[styles.stretch, { gap: s(BREAK.innerGap) }]}>
                <Text variant="overline" color={color.danger} style={styles.upper}>
                  1 din ki chutti
                </Text>
                {singleDayLeaves.map((option) => (
                  <DayRow key={option.dateIso} option={option} onPress={onPickDay} />
                ))}
              </View>
            </OutlineCard>
            {groupedLongCard !== null && (
              <LongLeaveBlock card={groupedLongCard} onPress={onOpenLongLeave} />
            )}
          </Block>
        )}

        {longCard !== null && (
          <Block width={longCardWidth}>
            <LongLeaveBlock card={longCard} onPress={onOpenLongLeave} />
          </Block>
        )}
      </ScrollView>
    </View>
  );
}

/** `528:465` — the lime break panel. */
function BreakCard({ window }: { window: BreakWindow }): React.ReactElement {
  const { s } = useDesignScale();
  return (
    <View
      style={[
        styles.breakCard,
        { padding: s(BREAK.padding), gap: s(BREAK.gap), borderRadius: s(BREAK.radius) },
      ]}
      testID="chutti-break-card"
    >
      <View style={[styles.stretch, { gap: s(BREAK.innerGap) }]}>
        <Text variant="overlineLg" color={color.danger} style={styles.upper}>
          aaj ka break
        </Text>
        <Text variant="bodyMuted" color={color.black} testID="chutti-break-duration">
          {'Duration: '}
          {/* `528:471` sets the value in Bold on the SAME 14/16 line as the label, so the weight
              is overridden rather than the variant swapped -- `body` would also change the line
              box and re-flow the row. */}
          <Text variant="bodyMuted" color={color.black} style={styles.durationValue}>
            {window.durationLabel}
          </Text>
        </Text>
      </View>
      <View style={[styles.breakGrid, { columnGap: s(BREAK.cellGap) }]}>
        <BreakTime label={window.fromLabel} testID="chutti-break-from" />
        <View style={[styles.breakCell, { padding: s(BREAK.cellPadding) }]}>
          <Text variant="headingLgBold" align="center">
            TO
          </Text>
        </View>
        <BreakTime label={window.toLabel} testID="chutti-break-to" />
      </View>
    </View>
  );
}

function BreakTime({ label, testID }: { label: string; testID: string }): React.ReactElement {
  const scale = useDesignScale();
  const { s } = scale;
  return (
    <View
      style={[
        styles.breakCell,
        styles.breakTimeCell,
        figmaStroke(scale, {
          width: BREAK.cellBorderWidth,
          padding: BREAK.cellPadding,
          align: 'outside',
        }),
        { borderRadius: s(BREAK.cellRadius) },
      ]}
      testID={testID}
    >
      <Text variant="timeStrong" align="center">
        {label}
      </Text>
    </View>
  );
}

/** `528:386` / `529:1301` — a single-day leave row in either state. */
function DayRow({
  option,
  onPress,
}: {
  option: SingleDayLeaveOption;
  onPress?: ((dateIso: string) => void) | undefined;
}): React.ReactElement {
  const scale = useDesignScale();
  const { s } = scale;
  const booked = option.state === 'booked';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${option.dayLabel} ${option.relativeLabel}`}
      accessibilityState={{ disabled: booked, selected: booked }}
      android_ripple={null}
      // Guarded rather than `disabled`: on this device (vivo I2403, Fabric, release) a disabled
      // Pressable laid out its children but painted none of them — the booked row drew as a
      // blank yellow slab. The guard keeps the row inert without the disabled paint path.
      onPress={() => {
        if (!booked) onPress?.(option.dateIso);
      }}
      style={[
        styles.dayRow,
        { borderRadius: s(DAY_ROW.radius), gap: s(DAY_ROW.gap) },
        booked
          ? {
              backgroundColor: color.yellow400,
              paddingHorizontal: s(DAY_ROW.paddingH),
              paddingVertical: s(DAY_ROW.paddingV),
            }
          : {
              ...figmaStroke(scale, {
                width: DAY_ROW.borderWidth,
                paddingH: DAY_ROW.paddingH,
                paddingV: DAY_ROW.paddingV,
                align: 'outside',
              }),
              borderColor: color.yellow600,
            },
      ]}
      testID={`chutti-day-${option.dateIso}`}
    >
      <View style={{ width: s(DAY_ROW.labelWidth) }}>
        {/* The row is `accessible`, which makes it one node to a screen reader and hides its text
            from a subtree text query. The two lines therefore carry their own ids so a test can
            assert what the cook actually reads. */}
        <Text variant="headingLgBold" testID={`chutti-day-date-${option.dateIso}`}>
          {option.dayLabel}
        </Text>
        <Text variant="title" color={color.black70} testID={`chutti-day-state-${option.dateIso}`}>
          {option.relativeLabel}
        </Text>
      </View>
      <View style={styles.chipHost}>
        <View
          style={[
            styles.chip,
            {
              width: s(DAY_ROW.chipWidth),
              borderRadius: s(DAY_ROW.chipRadius),
              paddingHorizontal: s(DAY_ROW.chipPaddingH),
              paddingVertical: s(DAY_ROW.chipPaddingV),
            },
          ]}
        >
          {booked ? (
            <SvgXml
              xml={bookedTick}
              width={s(DAY_ROW.tickSize)}
              height={s(DAY_ROW.tickSize)}
              testID={`chutti-day-tick-${option.dateIso}`}
            />
          ) : (
            <Text variant="chipLabel">Chutti</Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

/** `528:432` — the `lambi chutti` card. */
function LongLeaveBlock({
  card,
  onPress,
}: {
  card: LongLeaveCard;
  onPress?: (() => void) | undefined;
}): React.ReactElement {
  const scale = useDesignScale();
  const { s } = scale;
  return (
    <OutlineCard gap={card.upcoming === null ? undefined : CARD.gap} testID="chutti-long-card">
      <View style={[styles.stretch, { gap: s(10) }]}>
        <Text variant="overline" color={color.danger} style={styles.upper}>
          lambi chutti
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={card.label}
          android_ripple={null}
          onPress={onPress}
          style={[
            styles.longRow,
            figmaStroke(scale, {
              width: LONG_ROW.borderWidth,
              paddingH: LONG_ROW.paddingH,
              paddingV: LONG_ROW.paddingV,
              align: 'outside',
            }),
            { borderRadius: s(LONG_ROW.radius), gap: s(LONG_ROW.gap) },
          ]}
          testID="chutti-long-open"
        >
          <Image
            source={calendarGlyph}
            style={{ width: s(LONG_ROW.glyphSize), height: s(LONG_ROW.glyphSize) }}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
          <View style={{ width: s(LONG_ROW.labelWidth) }}>
            <Text variant="chipLabel" testID="chutti-long-label">
              {card.label}
            </Text>
          </View>
          <SvgXml
            xml={chevron}
            width={s(LONG_ROW.chevronSize)}
            height={s(LONG_ROW.chevronSize)}
            style={[styles.longChevron, { right: s(LONG_ROW.chevronRight) }]}
          />
        </Pressable>
      </View>
      {card.upcoming !== null && (
        <View style={styles.stretch}>
          <View style={{ width: s(LONG_ROW.upcomingWidth) }}>
            <Text variant="title" color={color.black70}>
              Aane wali chutti
            </Text>
          </View>
          <Text variant="headingLgBold" testID="chutti-upcoming">
            {card.upcoming}
          </Text>
        </View>
      )}
    </OutlineCard>
  );
}

/* -------------------------------------------------------------- the sheets --- */

/** `528:664` — a sheet header: back, title, compact help. */
function SheetHeader({
  title,
  onBack,
  onHelp,
}: {
  title: string;
  onBack?: (() => void) | undefined;
  onHelp?: (() => void) | undefined;
}): React.ReactElement {
  const { s } = useDesignScale();
  return (
    <View
      style={[
        styles.sheetHeader,
        {
          height: s(SHEET.headerHeight),
          paddingHorizontal: s(BLOCK.paddingH),
          gap: s(SHEET.headerGap),
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Wapas"
        onPress={onBack}
        testID="leave-sheet-back"
      >
        <SvgXml xml={sheetBack} width={s(SHEET.backSize)} height={s(SHEET.backSize)} />
      </Pressable>
      <View style={{ width: s(SHEET.titleWidth) }}>
        <Text variant="headingLg" testID="leave-sheet-title">
          {title}
        </Text>
      </View>
      <HelpPill size="compact" onPress={onHelp} testID="leave-sheet-help" />
    </View>
  );
}

/**
 * `528:662` / `528:607` — `Pakka`, in its enabled and disabled fills.
 *
 * Anchored to the sheet's bottom edge through normal flow (`marginTop: 'auto'`) rather than
 * absolute positioning. At the design height the pixels are identical — the button's bottom edge
 * sits `bottom` units above the sheet's edge — but when a short or display-zoomed screen forces
 * the sheet below its design height, a flow child stays inside the sheet where an absolutely
 * pinned one was carried past the screen edge and clipped.
 */
function PakkaButton({
  enabled,
  bottom,
  onPress,
  testID,
}: {
  enabled: boolean;
  bottom: number;
  onPress?: (() => void) | undefined;
  testID: string;
}): React.ReactElement {
  const { s } = useDesignScale();
  return (
    <View
      style={[styles.ctaHost, { marginBottom: s(Math.max(0, bottom - SHEET.padding)) }]}
      pointerEvents="box-none"
    >
      <View
        style={{
          width: s(SHEET.ctaWidth),
          height: s(SHEET.ctaHeight),
          paddingHorizontal: s(BLOCK.paddingH),
          paddingVertical: s(BLOCK.paddingV),
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Pakka"
          accessibilityState={{ disabled: !enabled }}
          disabled={!enabled}
          android_ripple={null}
          onPress={onPress}
          style={[
            styles.ctaButton,
            {
              borderRadius: s(SHEET.buttonRadius),
              paddingHorizontal: s(SHEET.buttonPaddingH),
              paddingVertical: s(SHEET.buttonPaddingV),
            },
            enabled ? styles.ctaEnabled : styles.ctaDisabled,
          ]}
          testID={testID}
        >
          <Text variant="actionLabelPlain" align="center">
            Pakka
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export interface LongLeaveSheetViewProps {
  readonly year: number;
  readonly month: number;
  readonly monthLabel: string;
  readonly firstOpenDay: number | null;
  readonly selection: { readonly fromDay: number; readonly toDay: number } | null;
  /** `529:1245` — the inclusive day count. Computed by the caller from the chosen range. */
  readonly totalDays: number;
  readonly canConfirm: boolean;
  readonly onPickDay?: ((day: number) => void) | undefined;
  readonly onPrevMonth?: (() => void) | undefined;
  readonly onNextMonth?: (() => void) | undefined;
  readonly onConfirm?: (() => void) | undefined;
  readonly onBack?: (() => void) | undefined;
  readonly onHelp?: (() => void) | undefined;
  /** Rendered under the total strip: a validation refusal or a submission failure. */
  readonly notice?: string | null | undefined;
}

/** `592:563` (nothing chosen) and `592:639` (a ten-day range chosen). */
export function LongLeaveSheetView({
  year,
  month,
  monthLabel,
  firstOpenDay,
  selection,
  totalDays,
  canConfirm,
  onPickDay,
  onPrevMonth,
  onNextMonth,
  onConfirm,
  onBack,
  onHelp,
  notice,
}: LongLeaveSheetViewProps): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { s } = useDesignScale();

  return (
    <View style={[styles.scrim, { paddingBottom: insets.bottom }]} testID="long-leave-sheet">
      <View style={{ height: insets.top }} />
      <View style={styles.scrimFill} />
      <View
        style={[
          styles.sheet,
          {
            height: s(SHEET.longHeight),
            padding: s(SHEET.padding),
            gap: s(SHEET.gap),
            borderTopLeftRadius: s(SHEET.radius),
            borderTopRightRadius: s(SHEET.radius),
          },
        ]}
      >
        <SheetHeader title="Lambi Chutti" onBack={onBack} onHelp={onHelp} />
        <Block>
          <LeaveCalendar
            year={year}
            month={month}
            monthLabel={monthLabel}
            firstOpenDay={firstOpenDay}
            selection={selection}
            onPickDay={onPickDay}
            onPrevMonth={onPrevMonth}
            onNextMonth={onNextMonth}
          />
        </Block>
        <Block>
          <View
            style={[
              styles.totalRow,
              {
                borderRadius: s(TOTAL_ROW.radius),
                paddingHorizontal: s(TOTAL_ROW.paddingH),
                paddingVertical: s(TOTAL_ROW.paddingV),
                gap: s(TOTAL_ROW.gap),
              },
            ]}
            testID="leave-range-total"
          >
            <View style={{ width: s(TOTAL_ROW.labelWidth) }}>
              <Text variant="headingLgBold" color={color.danger}>
                Total din
              </Text>
            </View>
            <View style={{ width: s(TOTAL_ROW.valueWidth) }}>
              <Text variant="displayLg" align="center" testID="leave-range-total-value">
                {totalDays}
              </Text>
            </View>
          </View>
        </Block>
        {notice !== null && notice !== undefined && (
          <Block>
            <Text variant="caption" color={color.danger} testID="leave-range-notice">
              {notice}
            </Text>
          </Block>
        )}
        <PakkaButton
          enabled={canConfirm}
          bottom={SHEET.ctaBottomLong}
          onPress={onConfirm}
          testID="leave-range-confirm"
        />
      </View>
    </View>
  );
}

export interface ShortLeaveSheetViewProps {
  /** `528:632` — e.g. `8 November`. */
  readonly dayLabel: string;
  /** `528:633` — e.g. `Parso`. */
  readonly relativeLabel: string;
  readonly canConfirm: boolean;
  readonly onConfirm?: (() => void) | undefined;
  readonly onBack?: (() => void) | undefined;
  readonly onHelp?: (() => void) | undefined;
  readonly notice?: string | null | undefined;
}

/** `592:888` — the one-day confirmation sheet. */
export function ShortLeaveSheetView({
  dayLabel,
  relativeLabel,
  canConfirm,
  onConfirm,
  onBack,
  onHelp,
  notice,
}: ShortLeaveSheetViewProps): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { s } = useDesignScale();

  return (
    <View style={[styles.scrim, { paddingBottom: insets.bottom }]} testID="short-leave-sheet">
      <View style={{ height: insets.top }} />
      <View style={styles.scrimFill} />
      <View
        style={[
          styles.sheet,
          styles.sheetCentred,
          {
            height: s(SHEET.shortHeight),
            padding: s(SHEET.padding),
            gap: s(SHEET.gap),
            borderTopLeftRadius: s(SHEET.radius),
            borderTopRightRadius: s(SHEET.radius),
          },
        ]}
      >
        <SheetHeader title="1 din ki Chutti" onBack={onBack} onHelp={onHelp} />
        <Block width={338}>
          <View style={{ gap: s(BREAK.innerGap) }}>
            <Text variant="overlineXl" color={color.danger} style={styles.upper}>
              Chutti pakka hai?
            </Text>
            <Text variant="bodyMuted" color={color.black}>
              Aap jitne din aaye, utne din ke paise milenge
            </Text>
          </View>
        </Block>
        <Block>
          <OutlineCard>
            <View style={[styles.stretch, { gap: s(10) }]}>
              <Text variant="overline" color={color.danger} style={styles.upper}>
                1 din ki chutti
              </Text>
              <View
                style={[
                  styles.confirmRow,
                  {
                    borderRadius: s(DAY_ROW.radius),
                    paddingHorizontal: s(DAY_ROW.paddingH),
                    paddingVertical: s(DAY_ROW.paddingV),
                  },
                ]}
                testID="leave-single-chosen"
              >
                <View style={{ width: s(DAY_ROW.labelWidth) }}>
                  <Text variant="headingLgBold" align="center" testID="leave-single-day">
                    {dayLabel}
                  </Text>
                  <Text
                    variant="title"
                    align="center"
                    color={color.black70}
                    testID="leave-single-relative"
                  >
                    {relativeLabel}
                  </Text>
                </View>
              </View>
            </View>
          </OutlineCard>
        </Block>
        {notice !== null && notice !== undefined && (
          <Block>
            <Text variant="caption" color={color.danger} testID="leave-single-notice">
              {notice}
            </Text>
          </Block>
        )}
        <PakkaButton
          enabled={canConfirm}
          bottom={SHEET.ctaBottomShort}
          onPress={onConfirm}
          testID="leave-single-confirm"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.white },
  // `flexGrow` rather than `flex`: as a ScrollView contentContainerStyle, `flex: 1` pins the
  // content to exactly the viewport height and scrolling never engages.
  content: { flexGrow: 1, alignItems: 'flex-start', backgroundColor: color.white },
  block: { alignItems: 'flex-start' },
  fullWidth: { width: '100%' },
  stretch: { alignSelf: 'stretch' },
  upper: { textTransform: 'uppercase' },
  outlineCard: {
    alignSelf: 'stretch',
    alignItems: 'flex-start',
    borderColor: color.yellow600,
    backgroundColor: color.white,
  },
  breakCard: { alignSelf: 'stretch', alignItems: 'flex-start', backgroundColor: color.lime300 },
  durationValue: { fontFamily: fontFamily.bold },
  breakGrid: { flexDirection: 'row', alignSelf: 'stretch' },
  breakCell: {
    flexGrow: 1,
    flexBasis: 0,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  breakTimeCell: { backgroundColor: color.white, borderColor: color.lime600 },
  // No `overflow: 'hidden'`: nothing in the row overflows, and it was part of the combination
  // under which the booked row's children went unpainted on device.
  dayRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' },
  chipHost: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center' },
  chip: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: color.yellow400,
  },
  longRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    overflow: 'hidden',
    borderColor: color.danger,
  },
  longChevron: { position: 'absolute', transform: [{ rotate: '179.55deg' }] },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    overflow: 'hidden',
  },
  /**
   * The sheet sits on the bottom SAFE-AREA edge, not the bottom of the display. Without the
   * inset its last 24dp — including the `Pakka` button's lower half — sit behind the gesture bar,
   * which is both wrong on the device and 22 design units of displacement against the frame.
   */
  scrim: { flex: 1, backgroundColor: color.scrim },
  scrimFill: { flex: 1 },
  /**
   * `flexShrink: 1` lets the sheet give up height when the screen offers less than the design
   * height (16:9 handsets, display zoom). Without it the fixed-height sheet overflows past the
   * window's bottom edge and takes the `Pakka` button with it. When there is room — every
   * verified device — the shrink never engages and the sheet keeps its exact design height.
   */
  sheet: {
    alignSelf: 'stretch',
    alignItems: 'flex-start',
    flexShrink: 1,
    backgroundColor: color.white,
  },
  sheetCentred: { alignItems: 'center' },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    overflow: 'hidden',
    backgroundColor: color.lime300,
  },
  confirmRow: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: color.lime300,
  },
  ctaHost: {
    marginTop: 'auto',
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  ctaEnabled: { backgroundColor: color.lime600, ...dropShadow(2, 0.15) },
  ctaDisabled: {
    backgroundColor: color.disabledFill,
    ...dropShadow(4, 0.15),
  },
});
