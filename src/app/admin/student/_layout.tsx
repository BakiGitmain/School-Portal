
import RoleAuthGate from "../../../components/navigation/RoleAuthGate";
import { RoleTabsLayout } from "../../../components/navigation/RoleTabsLayout";

export default function StudentLayout() {
  return (
    <RoleAuthGate role="student">
      <RoleTabsLayout role="student" />
    </RoleAuthGate>
  );
}
