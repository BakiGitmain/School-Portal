import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { UserRole } from '../../constants/roleNavigation';

type Props = {
  role: UserRole;
};

const ROLE_TEXT: Record<UserRole, string> = {
  admin: 'President Portal',
  teacher: 'Teacher Portal',
  student: 'Student Portal',
};

export default function AppLoadingScreen({ role }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.logo}>
        <Text style={styles.logoText}>E</Text>
      </View>

      <ActivityIndicator
        size="large"
        color="#1671F5"
        style={styles.loader}
      />

      <Text style={styles.title}>
        Loading {ROLE_TEXT[role]}
      </Text>

      <Text style={styles.subtitle}>
        Getting everything ready...
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FBFDFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },

  logo: {
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: '#EAF3FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },

  logoText: {
    fontSize: 30,
    fontWeight: '800',
    color: '#1671F5',
  },

  loader: {
    marginBottom: 18,
  },

  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#102B59',
    textAlign: 'center',
  },

  subtitle: {
    marginTop: 6,
    fontSize: 13,
    color: '#8190A5',
    textAlign: 'center',
  },
});