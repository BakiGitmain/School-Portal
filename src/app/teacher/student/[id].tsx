import {
  useLocalSearchParams,
} from 'expo-router';

import StudentDetailsScreen from '../../../features/shared/screens/StudentDetailsScreen';

export default function TeacherStudentDetailsPage() {
  const params =
    useLocalSearchParams<{
      id?:
        | string
        | string[];
    }>();

  const id =
    Array.isArray(
      params.id,
    )
      ? params.id[0]
      : params.id;

  if (!id) {
    return null;
  }

  return (
    <StudentDetailsScreen
      studentUserId={
        id
      }
      viewerRole="teacher"
    />
  );
}