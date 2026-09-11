export type TimeDisplay =
  | '12h'
  | '24h'
  | 'ethiopian';

export type TimetableBreak = {
  kind:
    | 'rest'
    | 'lunch'
    | 'custom';

  label: string;

  afterPeriod: number;

  durationMinutes: number;
};

export type PeriodSlot = {
  periodIndex: number;

  startMinute: number;

  endMinute: number;
};

export type BreakWindow = {
  kind:
    TimetableBreak['kind'];

  label: string;

  afterPeriod: number;

  startMinute: number;

  endMinute: number;
};

export const WEEK_DAYS = [
  {
    id: 1,
    label: 'Monday',
    short: 'Mon',
  },

  {
    id: 2,
    label: 'Tuesday',
    short: 'Tue',
  },

  {
    id: 3,
    label: 'Wednesday',
    short: 'Wed',
  },

  {
    id: 4,
    label: 'Thursday',
    short: 'Thu',
  },

  {
    id: 5,
    label: 'Friday',
    short: 'Fri',
  },

  {
    id: 6,
    label: 'Saturday',
    short: 'Sat',
  },

  {
    id: 7,
    label: 'Sunday',
    short: 'Sun',
  },
] as const;

function pad2(
  value: number,
) {
  return String(
    value,
  ).padStart(
    2,
    '0',
  );
}

export function shiftMinute(
  minute: number,
  amount: number,
) {
  let next =
    minute +
    amount;

  while (
    next <
    0
  ) {
    next +=
      1440;
  }

  while (
    next >=
    1440
  ) {
    next -=
      1440;
  }

  return next;
}

export function formatMinute(
  minute: number,

  display:
    TimeDisplay,
) {
  const safe =
    (
      (
        Math.round(
          minute,
        ) %
        1440
      ) +
      1440
    ) %
    1440;

  const hour24 =
    Math.floor(
      safe /
      60,
    );

  const minutes =
    safe %
    60;

  /*
   * =====================================================
   * INTERNATIONAL / 24 HOUR
   * =====================================================
   */

  if (
    display ===
    '24h'
  ) {
    return `${pad2(
      hour24,
    )}:${pad2(
      minutes,
    )}`;
  }

  /*
   * =====================================================
   * ETHIOPIAN CLOCK
   * =====================================================
   *
   * International:
   * 06:00
   *
   * Ethiopian:
   * 12:00
   *
   * International:
   * 08:15
   *
   * Ethiopian:
   * 2:15
   *
   * International:
   * 18:10
   *
   * Ethiopian:
   * 12:10
   * =====================================================
   */

  if (
    display ===
    'ethiopian'
  ) {
    const ethiopianHour =
      (
        (
          hour24 +
          5
        ) %
        12
      ) +
      1;

    return `${ethiopianHour}:${pad2(
      minutes,
    )}`;
  }

  /*
   * =====================================================
   * USA / 12 HOUR CLOCK
   * =====================================================
   */

  const hour12 =
    hour24 %
      12 ||
    12;

  const period =
    hour24 >=
    12
      ? 'PM'
      : 'AM';

  return `${hour12}:${pad2(
    minutes,
  )} ${period}`;
}

export function getTimeDisplayLabel(
  display:
    TimeDisplay,
) {
  if (
    display ===
    'ethiopian'
  ) {
    return 'Ethiopian Clock';
  }

  if (
    display ===
    '24h'
  ) {
    return 'International 24 Hour';
  }

  return 'USA / 12 Hour';
}

export function getDayLabel(
  day: number,
) {
  return (
    WEEK_DAYS.find(
      item =>
        item.id ===
        day,
    )?.label ??
    `Day ${day}`
  );
}

export function getDayShortLabel(
  day: number,
) {
  return (
    WEEK_DAYS.find(
      item =>
        item.id ===
        day,
    )?.short ??
    String(
      day,
    )
  );
}

export function buildPeriodSlots({
  startMinute,
  periodsPerDay,
  periodMinutes,
  breaks,
}: {
  startMinute: number;

  periodsPerDay: number;

  periodMinutes: number;

  breaks:
    TimetableBreak[];
}) {
  const slots:
    PeriodSlot[] =
    [];

  const breakWindows:
    BreakWindow[] =
    [];

  const orderedBreaks =
    [
      ...breaks,
    ].sort(
      (
        first,
        second,
      ) =>
        first.afterPeriod -
        second.afterPeriod,
    );

  let cursor =
    startMinute;

  for (
    let periodIndex =
      1;

    periodIndex <=
    periodsPerDay;

    periodIndex +=
      1
  ) {
    const periodStart =
      cursor;

    const periodEnd =
      periodStart +
      periodMinutes;

    slots.push({
      periodIndex,

      startMinute:
        periodStart,

      endMinute:
        periodEnd,
    });

    cursor =
      periodEnd;

    const periodBreaks =
      orderedBreaks.filter(
        item =>
          item.afterPeriod ===
          periodIndex,
      );

    for (
      const item of
      periodBreaks
    ) {
      const breakStart =
        cursor;

      const breakEnd =
        breakStart +
        item.durationMinutes;

      breakWindows.push({
        ...item,

        startMinute:
          breakStart,

        endMinute:
          breakEnd,
      });

      cursor =
        breakEnd;
    }
  }

  return {
    slots,

    breaks:
      breakWindows,

    dayEndMinute:
      cursor,
  };
}