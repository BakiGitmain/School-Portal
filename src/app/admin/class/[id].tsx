import { useLocalSearchParams } from 'expo-router';

import ClassDetailsScreen from '../../../features/admin/screens/ClassDetailsScreen';

export default function AdminClassDetailsRoute() {
  const params = useLocalSearchParams<{
    id?: string | string[];
  }>();

  const classId = Array.isArray(params.id)
    ? params.id[0]
    : params.id;

  return (
    <ClassDetailsScreen
      classId={classId ?? ''}
    />
  );
}