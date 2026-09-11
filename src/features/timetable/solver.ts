export type SolverRequirement = {
  id: string;

  teacherUserId: string;

  teacherName: string;

  classId: string;

  className: string;

  subject: string;

  periodsPerWeek: number;

  maxPerDay: number;

  allowBackToBack: boolean;

  enabled: boolean;
};

export type SolverSettings = {
  activeDays:
    number[];

  periodsPerDay:
    number;

  noAssignmentBackToBack:
    boolean;

  maxTeacherConsecutive:
    number;
};

export type GeneratedScheduleEntry = {
  requirementId:
    string;

  teacherUserId:
    string;

  teacherName:
    string;

  classId:
    string;

  className:
    string;

  subject:
    string;

  dayOfWeek:
    number;

  periodIndex:
    number;
};

type SolverSuccess = {
  success:
    true;

  entries:
    GeneratedScheduleEntry[];

  score:
    number;
};

type SolverFailure = {
  success:
    false;

  message:
    string;
};

export type SolverResult =
  | SolverSuccess
  | SolverFailure;

type Task = {
  requirement:
    SolverRequirement;

  difficulty:
    number;
};

type Candidate = {
  day:
    number;

  period:
    number;

  score:
    number;
};

function makeSlotKey(
  day: number,
  period: number,
) {
  return `${day}:${period}`;
}

function makeTeacherSlotKey(
  teacherUserId:
    string,

  day:
    number,

  period:
    number,
) {
  return `${teacherUserId}:${day}:${period}`;
}

function makeClassSlotKey(
  classId:
    string,

  day:
    number,

  period:
    number,
) {
  return `${classId}:${day}:${period}`;
}

function makeRequirementDayKey(
  requirementId:
    string,

  day:
    number,
) {
  return `${requirementId}:${day}`;
}

function makeTeacherDayKey(
  teacherUserId:
    string,

  day:
    number,
) {
  return `${teacherUserId}:${day}`;
}

function makeClassDayKey(
  classId:
    string,

  day:
    number,
) {
  return `${classId}:${day}`;
}

function makeClassSubjectDayKey(
  classId:
    string,

  subject:
    string,

  day:
    number,
) {
  return [
    classId,
    subject
      .trim()
      .toLowerCase(),
    day,
  ].join(
    ':',
  );
}

function incrementMap(
  map:
    Map<
      string,
      number
    >,

  key:
    string,

  amount:
    number,
) {
  const next =
    (
      map.get(
        key,
      ) ??
      0
    ) +
    amount;

  if (
    next <=
    0
  ) {
    map.delete(
      key,
    );

    return;
  }

  map.set(
    key,
    next,
  );
}

function addPeriod(
  map:
    Map<
      string,
      Set<number>
    >,

  key:
    string,

  period:
    number,
) {
  let set =
    map.get(
      key,
    );

  if (
    !set
  ) {
    set =
      new Set<number>();

    map.set(
      key,
      set,
    );
  }

  set.add(
    period,
  );
}

function removePeriod(
  map:
    Map<
      string,
      Set<number>
    >,

  key:
    string,

  period:
    number,
) {
  const set =
    map.get(
      key,
    );

  if (
    !set
  ) {
    return;
  }

  set.delete(
    period,
  );

  if (
    set.size ===
    0
  ) {
    map.delete(
      key,
    );
  }
}

function wouldExceedConsecutive({
  periods,
  candidatePeriod,
  maximum,
}: {
  periods:
    Set<number> |
    undefined;

  candidatePeriod:
    number;

  maximum:
    number;
}) {
  if (
    maximum <=
    0
  ) {
    return false;
  }

  const values =
    new Set<number>(
      periods ??
      [],
    );

  values.add(
    candidatePeriod,
  );

  const ordered =
    [
      ...values,
    ].sort(
      (
        first,
        second,
      ) =>
        first -
        second,
    );

  let longest =
    0;

  let current =
    0;

  let previous:
    number |
    null =
    null;

  for (
    const period of
    ordered
  ) {
    if (
      previous !==
        null &&
      period ===
        previous +
          1
    ) {
      current +=
        1;
    } else {
      current =
        1;
    }

    longest =
      Math.max(
        longest,
        current,
      );

    previous =
      period;
  }

  return (
    longest >
    maximum
  );
}

function seededRandom(
  seed:
    number,
) {
  let value =
    seed |
    0;

  return () => {
    value |=
      0;

    value =
      value +
        0x6d2b79f5 |
      0;

    let next =
      Math.imul(
        value ^
          value >>>
            15,
        1 |
          value,
      );

    next =
      next +
        Math.imul(
          next ^
            next >>>
              7,
          61 |
            next,
        ) ^
      next;

    return (
      (
        next ^
        next >>>
          14
      ) >>>
      0
    ) /
      4294967296;
  };
}

function validateCapacity(
  requirements:
    SolverRequirement[],

  settings:
    SolverSettings,
) {
  const weeklySlots =
    settings.activeDays.length *
    settings.periodsPerDay;

  const teacherTotals =
    new Map<
      string,
      number
    >();

  const classTotals =
    new Map<
      string,
      number
    >();

  for (
    const requirement of
    requirements
  ) {
    const requirementCapacity =
      settings.activeDays.length *
      Math.min(
        requirement.maxPerDay,
        settings.periodsPerDay,
      );

    if (
      requirement.periodsPerWeek >
      requirementCapacity
    ) {
      return (
        `${requirement.className} • ${requirement.subject} • ` +
        `${requirement.teacherName} needs ${requirement.periodsPerWeek} periods/week, ` +
        `but its current daily limit can only fit ${requirementCapacity}.`
      );
    }

    teacherTotals.set(
      requirement.teacherUserId,

      (
        teacherTotals.get(
          requirement.teacherUserId,
        ) ??
        0
      ) +
        requirement.periodsPerWeek,
    );

    classTotals.set(
      requirement.classId,

      (
        classTotals.get(
          requirement.classId,
        ) ??
        0
      ) +
        requirement.periodsPerWeek,
    );
  }

  for (
    const [
      teacherId,
      total,
    ] of
    teacherTotals
  ) {
    if (
      total >
      weeklySlots
    ) {
      const teacher =
        requirements.find(
          item =>
            item.teacherUserId ===
            teacherId,
        );

      return (
        `${teacher?.teacherName ?? 'A teacher'} has ${total} weekly periods, ` +
        `but only ${weeklySlots} timetable slots exist.`
      );
    }
  }

  for (
    const [
      classId,
      total,
    ] of
    classTotals
  ) {
    if (
      total >
      weeklySlots
    ) {
      const classroom =
        requirements.find(
          item =>
            item.classId ===
            classId,
        );

      return (
        `${classroom?.className ?? 'A class'} requires ${total} weekly lessons, ` +
        `but only ${weeklySlots} class slots exist.`
      );
    }
  }

  return null;
}

function calculateQuality(
  entries:
    GeneratedScheduleEntry[],
) {
  const requirementDays =
    new Map<
      string,
      Map<
        number,
        number
      >
    >();

  for (
    const entry of
    entries
  ) {
    let dayMap =
      requirementDays.get(
        entry.requirementId,
      );

    if (
      !dayMap
    ) {
      dayMap =
        new Map();

      requirementDays.set(
        entry.requirementId,
        dayMap,
      );
    }

    dayMap.set(
      entry.dayOfWeek,

      (
        dayMap.get(
          entry.dayOfWeek,
        ) ??
        0
      ) +
        1,
    );
  }

  let penalty =
    0;

  for (
    const dayMap of
    requirementDays.values()
  ) {
    for (
      const count of
      dayMap.values()
    ) {
      if (
        count >
        1
      ) {
        penalty +=
          (
            count -
            1
          ) *
          1.5;
      }
    }
  }

  return Math.max(
    0,
    Math.round(
      (
        100 -
        penalty
      ) *
        10,
    ) /
      10,
  );
}

export function generateTimetable({
  requirements,
  settings,
}: {
  requirements:
    SolverRequirement[];

  settings:
    SolverSettings;
}): SolverResult {
  const enabled =
    requirements.filter(
      item =>
        item.enabled &&
        item.periodsPerWeek >
          0,
    );

  if (
    enabled.length ===
    0
  ) {
    return {
      success:
        false,

      message:
        'There are no enabled teaching requirements to schedule.',
    };
  }

  if (
    settings.activeDays.length ===
    0
  ) {
    return {
      success:
        false,

      message:
        'Choose at least one school day.',
    };
  }

  if (
    settings.periodsPerDay <
    1
  ) {
    return {
      success:
        false,

      message:
        'Periods per day must be at least 1.',
    };
  }

  const capacityError =
    validateCapacity(
      enabled,
      settings,
    );

  if (
    capacityError
  ) {
    return {
      success:
        false,

      message:
        capacityError,
    };
  }

  const teacherWeeklyLoad =
    new Map<
      string,
      number
    >();

  const classWeeklyLoad =
    new Map<
      string,
      number
    >();

  for (
    const requirement of
    enabled
  ) {
    incrementMap(
      teacherWeeklyLoad,
      requirement.teacherUserId,
      requirement.periodsPerWeek,
    );

    incrementMap(
      classWeeklyLoad,
      requirement.classId,
      requirement.periodsPerWeek,
    );
  }

  const tasks:
    Task[] =
    [];

  for (
    const requirement of
    enabled
  ) {
    const difficulty =
      requirement.periodsPerWeek *
        4 +
      (
        teacherWeeklyLoad.get(
          requirement.teacherUserId,
        ) ??
        0
      ) *
        2 +
      (
        classWeeklyLoad.get(
          requirement.classId,
        ) ??
        0
      ) *
        2;

    for (
      let index =
        0;
      index <
      requirement.periodsPerWeek;
      index +=
        1
    ) {
      tasks.push({
        requirement,
        difficulty,
      });
    }
  }

  tasks.sort(
    (
      first,
      second,
    ) =>
      second.difficulty -
      first.difficulty,
  );

  const MAX_ATTEMPTS =
    6;

  const MAX_NODES =
    Math.max(
      50000,
      tasks.length *
        800,
    );

  for (
    let attempt =
      0;
    attempt <
    MAX_ATTEMPTS;
    attempt +=
      1
  ) {
    const random =
      seededRandom(
        Date.now() +
        attempt *
          9127,
      );

    const classSlots =
      new Set<string>();

    const teacherSlots =
      new Set<string>();

    const requirementDayCount =
      new Map<
        string,
        number
      >();

    const teacherDayCount =
      new Map<
        string,
        number
      >();

    const classDayCount =
      new Map<
        string,
        number
      >();

    const teacherDayPeriods =
      new Map<
        string,
        Set<number>
      >();

    const classSubjectDayPeriods =
      new Map<
        string,
        Set<number>
      >();

    const placements:
      GeneratedScheduleEntry[] =
      [];

    let nodes =
      0;

    function buildCandidates(
      requirement:
        SolverRequirement,
    ) {
      const candidates:
        Candidate[] =
        [];

      for (
        const day of
        settings.activeDays
      ) {
        const requirementDayKey =
          makeRequirementDayKey(
            requirement.id,
            day,
          );

        const dayRequirementCount =
          requirementDayCount.get(
            requirementDayKey,
          ) ??
          0;

        if (
          dayRequirementCount >=
          requirement.maxPerDay
        ) {
          continue;
        }

        for (
          let period =
            1;
          period <=
          settings.periodsPerDay;
          period +=
            1
        ) {
          const classSlot =
            makeClassSlotKey(
              requirement.classId,
              day,
              period,
            );

          const teacherSlot =
            makeTeacherSlotKey(
              requirement.teacherUserId,
              day,
              period,
            );

          if (
            classSlots.has(
              classSlot,
            ) ||
            teacherSlots.has(
              teacherSlot,
            )
          ) {
            continue;
          }

          const teacherDayKey =
            makeTeacherDayKey(
              requirement.teacherUserId,
              day,
            );

          if (
            wouldExceedConsecutive({
              periods:
                teacherDayPeriods.get(
                  teacherDayKey,
                ),

              candidatePeriod:
                period,

              maximum:
                settings.maxTeacherConsecutive,
            })
          ) {
            continue;
          }

          const noBackToBack =
            settings.noAssignmentBackToBack &&
            !requirement.allowBackToBack;

          const subjectDayKey =
            makeClassSubjectDayKey(
              requirement.classId,
              requirement.subject,
              day,
            );

          const sameSubjectPeriods =
            classSubjectDayPeriods.get(
              subjectDayKey,
            );

          if (
            noBackToBack &&
            (
              sameSubjectPeriods?.has(
                period -
                  1,
              ) ||
              sameSubjectPeriods?.has(
                period +
                  1,
              )
            )
          ) {
            continue;
          }

          const teacherLoad =
            teacherDayCount.get(
              teacherDayKey,
            ) ??
            0;

          const classDayKey =
            makeClassDayKey(
              requirement.classId,
              day,
            );

          const classLoad =
            classDayCount.get(
              classDayKey,
            ) ??
            0;

          /*
           * Lower score is preferred.
           *
           * Largest penalty:
           * putting the same teaching requirement
           * repeatedly on the same day.
           */

          const score =
            dayRequirementCount *
              100 +
            teacherLoad *
              7 +
            classLoad *
              3 +
            period *
              0.08 +
            random() *
              2;

          candidates.push({
            day,
            period,
            score,
          });
        }
      }

      candidates.sort(
        (
          first,
          second,
        ) =>
          first.score -
          second.score,
      );

      return candidates;
    }

    function place(
      requirement:
        SolverRequirement,

      candidate:
        Candidate,
    ) {
      const {
        day,
        period,
      } =
        candidate;

      classSlots.add(
        makeClassSlotKey(
          requirement.classId,
          day,
          period,
        ),
      );

      teacherSlots.add(
        makeTeacherSlotKey(
          requirement.teacherUserId,
          day,
          period,
        ),
      );

      incrementMap(
        requirementDayCount,
        makeRequirementDayKey(
          requirement.id,
          day,
        ),
        1,
      );

      incrementMap(
        teacherDayCount,
        makeTeacherDayKey(
          requirement.teacherUserId,
          day,
        ),
        1,
      );

      incrementMap(
        classDayCount,
        makeClassDayKey(
          requirement.classId,
          day,
        ),
        1,
      );

      addPeriod(
        teacherDayPeriods,
        makeTeacherDayKey(
          requirement.teacherUserId,
          day,
        ),
        period,
      );

      addPeriod(
        classSubjectDayPeriods,
        makeClassSubjectDayKey(
          requirement.classId,
          requirement.subject,
          day,
        ),
        period,
      );

      placements.push({
        requirementId:
          requirement.id,

        teacherUserId:
          requirement.teacherUserId,

        teacherName:
          requirement.teacherName,

        classId:
          requirement.classId,

        className:
          requirement.className,

        subject:
          requirement.subject,

        dayOfWeek:
          day,

        periodIndex:
          period,
      });
    }

    function unplace(
      requirement:
        SolverRequirement,

      candidate:
        Candidate,
    ) {
      const {
        day,
        period,
      } =
        candidate;

      classSlots.delete(
        makeClassSlotKey(
          requirement.classId,
          day,
          period,
        ),
      );

      teacherSlots.delete(
        makeTeacherSlotKey(
          requirement.teacherUserId,
          day,
          period,
        ),
      );

      incrementMap(
        requirementDayCount,
        makeRequirementDayKey(
          requirement.id,
          day,
        ),
        -1,
      );

      incrementMap(
        teacherDayCount,
        makeTeacherDayKey(
          requirement.teacherUserId,
          day,
        ),
        -1,
      );

      incrementMap(
        classDayCount,
        makeClassDayKey(
          requirement.classId,
          day,
        ),
        -1,
      );

      removePeriod(
        teacherDayPeriods,
        makeTeacherDayKey(
          requirement.teacherUserId,
          day,
        ),
        period,
      );

      removePeriod(
        classSubjectDayPeriods,
        makeClassSubjectDayKey(
          requirement.classId,
          requirement.subject,
          day,
        ),
        period,
      );

      placements.pop();
    }

    function solve(
      index:
        number,
    ): boolean {
      if (
        index >=
        tasks.length
      ) {
        return true;
      }

      nodes +=
        1;

      if (
        nodes >
        MAX_NODES
      ) {
        return false;
      }

      const task =
        tasks[
          index
        ];

      const requirement =
        task.requirement;

      const candidates =
        buildCandidates(
          requirement,
        );

      for (
        const candidate of
        candidates
      ) {
        place(
          requirement,
          candidate,
        );

        if (
          solve(
            index +
              1,
          )
        ) {
          return true;
        }

        unplace(
          requirement,
          candidate,
        );
      }

      return false;
    }

    if (
      solve(
        0,
      )
    ) {
      const sorted =
        [
          ...placements,
        ].sort(
          (
            first,
            second,
          ) =>
            first.dayOfWeek -
              second.dayOfWeek ||
            first.periodIndex -
              second.periodIndex ||
            first.className.localeCompare(
              second.className,
            ),
        );

      return {
        success:
          true,

        entries:
          sorted,

        score:
          calculateQuality(
            sorted,
          ),
      };
    }
  }

  return {
    success:
      false,

    message:
      'A valid timetable could not be created with the current rules. Try reducing weekly periods, increasing periods per day, allowing more daily lessons, or relaxing the back-to-back/consecutive rules.',
  };
}

export function parseSmartConditionText(
  text:
    string,
) {
  const value =
    text
      .trim()
      .toLowerCase();

  const result: {
    noAssignmentBackToBack?:
      boolean;

    maxTeacherConsecutive?:
      number;

    applied:
      string[];
  } = {
    applied:
      [],
  };

  if (
    !value
  ) {
    return result;
  }

  /*
   * Examples:
   *
   * "no double class back to back"
   * "avoid back to back classes"
   */

  if (
    (
      value.includes(
        'back to back',
      ) ||
      value.includes(
        'back-to-back',
      ) ||
      value.includes(
        'double class',
      )
    ) &&
    (
      value.includes(
        'no ',
      ) ||
      value.includes(
        'avoid',
      ) ||
      value.includes(
        'don\'t',
      ) ||
      value.includes(
        'dont',
      )
    )
  ) {
    result
      .noAssignmentBackToBack =
      true;

    result.applied.push(
      'Avoid same class + subject back-to-back',
    );
  }

  if (
    value.includes(
      'allow back to back',
    ) ||
    value.includes(
      'allow back-to-back',
    )
  ) {
    result
      .noAssignmentBackToBack =
      false;

    result.applied.push(
      'Allow back-to-back lessons',
    );
  }

  const consecutiveMatch =
    value.match(
      /(?:max(?:imum)?\s*)?(\d+)\s+(?:classes?\s+|periods?\s+)?(?:consecutive|in a row)/i,
    );

  if (
    consecutiveMatch
  ) {
    const amount =
      Number(
        consecutiveMatch[1],
      );

    if (
      Number.isFinite(
        amount,
      ) &&
      amount >=
        1 &&
      amount <=
        10
    ) {
      result
        .maxTeacherConsecutive =
        amount;

      result.applied.push(
        `Maximum ${amount} consecutive periods per teacher`,
      );
    }
  }

  return result;
}