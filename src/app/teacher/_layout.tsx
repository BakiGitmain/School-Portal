import RoleAuthGate from '../../components/navigation/RoleAuthGate';
import { RoleTabsLayout } from '../../components/navigation/RoleTabsLayout';

export default function TeacherLayout() {
  return <RoleAuthGate role="teacher"><RoleTabsLayout role="teacher" /></RoleAuthGate>;
}
