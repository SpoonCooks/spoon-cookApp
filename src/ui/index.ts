export { Text } from './primitives/Text';
export type { TextProps } from './primitives/Text';

export { Button } from './components/Button';
export type { ButtonProps, ButtonTone } from './components/Button';

export { FigmaGradient, gradientEndpoints } from './components/FigmaGradient';
export type { FigmaGradientProps } from './components/FigmaGradient';

export { OtpInput } from './components/OtpInput';
export type { OtpInputProps, OtpInputVariant } from './components/OtpInput';

export { JobCard, formatClockTime } from './components/JobCard';
export type { JobCardProps, JobCardVariant } from './components/JobCard';

export { LoadingState, ErrorState, EmptyState } from './components/states';
export type { ErrorStateProps } from './components/states';

export * from './theme/tokens';
export { useDesignScale, makeDesignScale } from './theme/designScale';
export type { DesignScale } from './theme/designScale';
export {
  BEZEL_VIEWPORT,
  HOME_INDICATOR_HEIGHT,
  STATUS_BAND_HEIGHT,
  designContentHeight,
  viewportProfile,
  viewportProfileBySection,
} from './theme/viewport';
export type { ViewportConvention, ViewportProfile } from './theme/viewport';
export { textStyle } from './theme/typography';
export type { TextStyleToken } from './theme/typography';

export {
  AboveBaseBand,
  BackHeader,
  CycleWorkCard,
  DailyRatingCard,
  DailyWorkCard,
  DateBanner,
  DayStrip,
  FinalBand,
  LifetimeBand,
  LinkRow,
  MistakesCard,
  PeriodTabs,
  RatingStrip,
} from './components/Performance';
export type {
  DayState,
  DayStripEntry,
  PeriodTabItem,
  PeriodTabsProps,
} from './components/Performance';

export { AttendanceCalendar } from './components/AttendanceCalendar';
export type { AttendanceCalendarProps } from './components/AttendanceCalendar';
