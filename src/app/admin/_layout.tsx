import React from 'react';

import RoleAuthGate from '../../components/navigation/RoleAuthGate';
import { RoleTabsLayout } from '../../components/navigation/RoleTabsLayout';

export default function AdminLayout() {
  return (
    <RoleAuthGate role="admin">
      <RoleTabsLayout role="admin" />
    </RoleAuthGate>
  );
}