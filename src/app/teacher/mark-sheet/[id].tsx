import React from 'react';

import {
  useLocalSearchParams,
} from 'expo-router';

import MarkSheetScreen from '../../../features/teacher/screens/MarkSheetScreen';

function firstParam(
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

export default function TeacherMarkSheetRoute() {
  const params =
    useLocalSearchParams<{
      id?:
        | string
        | string[];

      subject?:
        | string
        | string[];
    }>();

  const classId =
    firstParam(
      params.id,
    );

  const subject =
    firstParam(
      params.subject,
    );

  return (
    <MarkSheetScreen
      classId={
        classId
      }
      subject={
        subject
      }
    />
  );
}