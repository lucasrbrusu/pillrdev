import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import Button from '../components/Button';
import Input from '../components/Input';
import { useApp } from '../context/AppContext';
import { colors, borderRadius, spacing, typography, shadows } from '../utils/theme';
import { supabase } from '../utils/supabaseClient';

const getPasswordError = (password) => {
  if (!password || password.length < 6) {
    return 'Password must be at least 6 characters and include at least one uppercase letter and one symbol.';
  }

  if (!/[A-Z]/.test(password)) {
    return 'Password must include at least one uppercase letter.';
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    return 'Password must include at least one symbol.';
  }

  return '';
};

const AuthScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { signIn, signUp, hasOnboarded, themeColors } = useApp();
  const styles = useMemo(() => createStyles(), [themeColors]);

  const [mode, setMode] = useState('login');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);
  const [form, setForm] = useState({
    fullName: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    identifier: '',
  });

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      setError('');

      if (mode === 'login') {
        if (!form.identifier || !form.password) {
          setError('Please enter your email and password.');
          return;
        }
        await signIn({
          identifier: form.identifier,
          password: form.password,
        });
      } else {
        if (!form.fullName || !form.username || !form.email || !form.password) {
          setError('Please fill in all fields to create your account.');
          return;
        }
        const passwordError = getPasswordError(form.password);
        if (passwordError) {
          setError(passwordError);
          return;
        }
        if (form.password !== form.confirmPassword) {
          setError('Passwords do not match.');
          return;
        }
        if (!hasAcceptedTerms) {
          setError('Please acknowledge the terms to create an account.');
          return;
        }
        await signUp({
          fullName: form.fullName,
          username: form.username,
          email: form.email,
          password: form.password,
        });
      }
    } catch (submitError) {
      setError(submitError?.message || 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    if (!hasOnboarded) {
      navigation.reset({
        index: 0,
        routes: [{ name: 'Onboarding' }],
      });
      return;
    }

    navigation.reset({
      index: 0,
      routes: [{ name: 'Auth' }],
    });
  };

  const handleOpenLink = (url) => {
    Linking.openURL(url);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.md }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing.xxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <View style={styles.iconRow}>
          <View style={[styles.badge, { backgroundColor: `${colors.habits}15` }]}>
            <Feather name="target" size={18} color={colors.habits} />
          </View>
          <View style={[styles.badge, { backgroundColor: `${colors.tasks}15` }]}>
            <Feather name="edit-3" size={18} color={colors.tasks} />
          </View>
          <View style={[styles.badge, { backgroundColor: `${colors.health}15` }]}>
            <Ionicons name="heart-outline" size={18} color={colors.health} />
          </View>
          <View style={[styles.badge, { backgroundColor: `${colors.routine}15` }]}>
            <MaterialCommunityIcons name="history" size={18} color={colors.routine} />
          </View>
          <View style={[styles.badge, { backgroundColor: `${colors.finance}15` }]}>
            <Feather name="trending-up" size={18} color={colors.finance} />
          </View>
        </View>

        <View style={styles.logoRow}>
          <View style={styles.logoIcon}>
            <View style={[styles.logoDot, { backgroundColor: colors.habits }]} />
            <View style={[styles.logoDot, { backgroundColor: colors.tasks }]} />
            <View style={[styles.logoDot, { backgroundColor: colors.health }]} />
            <View style={[styles.logoDot, { backgroundColor: colors.routine }]} />
          </View>
          <Text style={styles.logoTitle}>PillarUp</Text>
        </View>
        <Text style={styles.subtitle}>Welcome back. Let&apos;s get you signed in.</Text>

        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[
              styles.tab,
              mode === 'login' && styles.tabActive,
            ]}
            onPress={() => {
              setMode('login');
              setError('');
            }}
            activeOpacity={0.9}
          >
            <Text
              style={[
                styles.tabText,
                mode === 'login' && styles.tabTextActive,
              ]}
            >
              Login
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tab,
              mode === 'signup' && styles.tabActive,
            ]}
            onPress={() => {
              setMode('signup');
              setHasAcceptedTerms(false);
              setError('');
            }}
            activeOpacity={0.9}
          >
            <Text
              style={[
                styles.tabText,
                mode === 'signup' && styles.tabTextActive,
              ]}
            >
              Sign Up
            </Text>
          </TouchableOpacity>
        </View>

        {mode === 'login' ? (
          <>
            <Input
              placeholder="Email"
              icon="person-outline"
              value={form.identifier}
              onChangeText={(text) => updateField('identifier', text)}
            />
            <Input
              placeholder="Password"
              icon="lock-closed-outline"
              secureTextEntry
              value={form.password}
              onChangeText={(text) => updateField('password', text)}
              containerStyle={styles.fieldSpacing}
            />

            <TouchableOpacity
              style={styles.forgotPassword}
              onPress={() => Alert.alert('Forgot Password', 'Password reset is coming soon.')}
            >
              <Text style={styles.linkText}>Forgot password?</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Input
              placeholder="Full name"
              icon="person-circle-outline"
              value={form.fullName}
              onChangeText={(text) => updateField('fullName', text)}
            />
            <Input
              placeholder="Username"
              icon="at-outline"
              value={form.username}
              onChangeText={(text) => updateField('username', text)}
            />
            <Input
              placeholder="Email"
              icon="mail-outline"
              keyboardType="email-address"
              autoCapitalize="none"
              value={form.email}
              onChangeText={(text) => updateField('email', text)}
            />
            <Input
              placeholder="Password"
              icon="lock-closed-outline"
              secureTextEntry
              value={form.password}
              onChangeText={(text) => updateField('password', text)}
            />
            <Input
              placeholder="Re-enter password"
              icon="lock-closed-outline"
              secureTextEntry
              value={form.confirmPassword}
              onChangeText={(text) => updateField('confirmPassword', text)}
              containerStyle={styles.fieldSpacing}
            />
          </>
        )}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {mode === 'signup' && (
          <TouchableOpacity
            style={styles.termsRow}
            activeOpacity={0.8}
            onPress={() => setHasAcceptedTerms((prev) => !prev)}
          >
            <Feather
              name={hasAcceptedTerms ? 'check-square' : 'square'}
              size={20}
              color={hasAcceptedTerms ? colors.primary : colors.textSecondary}
              style={styles.checkboxIcon}
            />
            <Text style={styles.termsText}>
              By creating an account, you agree to the{' '}
              <Text
                style={styles.termsLink}
                onPress={() => handleOpenLink('https://pillarup.net/terms-of-service.html')}
              >
                Terms of Service
              </Text>{' '}
              and acknowledge the{' '}
              <Text
                style={styles.termsLink}
                onPress={() => handleOpenLink('https://pillarup.net/privacy-policy.html')}
              >
                Privacy Policy
              </Text>
              .
            </Text>
          </TouchableOpacity>
        )}

        <Button
          title={mode === 'login' ? 'Login' : 'Create Account'}
          icon="arrow-forward"
          onPress={handleSubmit}
          loading={isSubmitting}
          size="large"
          disabled={isSubmitting || (mode === 'signup' && !hasAcceptedTerms)}
        />

      </ScrollView>
    </View>
  );
};

const createStyles = () => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.xl,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  backText: {
    ...typography.bodySmall,
    marginLeft: spacing.xs,
    color: colors.textSecondary,
  },
  iconRow: {
    flexDirection: 'row',
    marginBottom: spacing.xxl,
  },
  badge: {
    width: 42,
    height: 42,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
    ...shadows.small,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  logoIcon: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 28,
    height: 28,
    marginRight: spacing.sm,
  },
  logoDot: {
    width: 12,
    height: 12,
    borderRadius: 3,
    margin: 1,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  logoTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 0,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.lg,
    padding: spacing.xs,
    marginBottom: spacing.xl,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderRadius: borderRadius.md,
  },
  tabActive: {
    backgroundColor: colors.card,
    ...shadows.small,
  },
  tabText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.text,
    fontWeight: '700',
  },
  fieldSpacing: {
    marginBottom: spacing.sm,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: spacing.lg,
  },
  linkText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '600',
  },
  errorText: {
    color: colors.danger,
    marginBottom: spacing.md,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  checkboxIcon: {
    marginTop: 2,
    marginRight: spacing.sm,
  },
  termsText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 18,
  },
  termsLink: {
    color: colors.primary,
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
});

export default AuthScreen;
