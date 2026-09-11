import React from 'react';

import {
  useLocalSearchParams,
} from 'expo-router';

import ClassTimetableScreen from '../../../../features/admin/screens/ClassTimetableScreen';

function firstValue(
  value:
    | string
    | string[]
    | undefined,
) {
  const raw =
    Array.isArray(
      value,
    )
      ? value[0]
      : value;

  if (
    !raw
  ) {
    return '';
  }

  try {
    return decodeURIComponent(
      raw,
    );
  } catch {
    return raw;
  }
}

export default function AdminClassTimetableRoute() {
  const params =
    useLocalSearchParams<{
      classId?:
        | string
        | string[];

      version?:
        | string
        | string[];
    }>();

  const classId =
    firstValue(
      params.classId,
    );

  const versionId =
    firstValue(
      params.version,
    );

  return (
    <ClassTimetableScreen
      classId={
        classId
      }
      versionId={
        versionId
      }
    />
  );
}