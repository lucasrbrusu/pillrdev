import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Platform,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
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

const badges = [
  {
    id: 'habits',
    icon: 'target',
    iconType: 'feather',
    color: colors.habits,
  },
  {
    id: 'tasks',
    icon: 'edit-3',
    iconType: 'feather',
    color: colors.tasks,
  },
  {
    id: 'health',
    icon: 'heart-outline',
    iconType: 'ionicons',
    color: colors.health,
  },
  {
    id: 'home',
    icon: 'history',
    iconType: 'material',
    color: colors.routine,
  },
  {
    id: 'finance',
    icon: 'trending-up',
    iconType: 'feather',
    color: colors.finance,
  },
];

const SAVED_ACCOUNTS_KEY = '@pillarup_auth_users';
const MAX_SAVED_ACCOUNTS = 5;

const getInitials = (name, email) => {
  const source = (name || email || '').trim();
  if (!source) return 'U';
  const parts = source.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

const normalizeEmail = (value) => (value || '').trim().toLowerCase();

const buildNextAccounts = (list, account) => {
  if (!account?.email) return list;
  const safeList = Array.isArray(list) ? list : [];
  const normalizedEmail = normalizeEmail(account.email);
  if (!normalizedEmail) return safeList;
  const existing = safeList.find(
    (item) => normalizeEmail(item?.email) === normalizedEmail
  );
  const merged = {
    ...existing,
    ...account,
    email: normalizedEmail,
    name: account.name || existing?.name || '',
    username: account.username || existing?.username || '',
    avatarUrl: account.avatarUrl || existing?.avatarUrl || null,
    accessToken: account.accessToken || existing?.accessToken || null,
    refreshToken: account.refreshToken || existing?.refreshToken || null,
    lastUsedAt: Date.now(),
  };
  const remaining = safeList.filter(
    (item) => normalizeEmail(item?.email) !== normalizedEmail
  );
  return [merged, ...remaining].slice(0, MAX_SAVED_ACCOUNTS);
};

const AuthScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { signIn, signUp, signInWithSession, hasOnboarded, themeColors, themeName } = useApp();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);
  const isDark = themeName === 'dark';

  const [mode, setMode] = useState('login');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);
  const [savedAccounts, setSavedAccounts] = useState([]);
  const [form, setForm] = useState({
    fullName: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    identifier: '',
  });

  React.useEffect(() => {
    const loadSavedAccounts = async () => {
      try {
        const raw = await AsyncStorage.getItem(SAVED_ACCOUNTS_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const sorted = [...parsed].sort(
            (a, b) => (b?.lastUsedAt || 0) - (a?.lastUsedAt || 0)
          );
          setSavedAccounts(sorted);
        }
      } catch (loadError) {
        console.log('Unable to load saved accounts', loadError);
      }
    };
    loadSavedAccounts();
  }, []);

  const authTheme = useMemo(
    () => ({
      backgroundGradient: isDark
        ? ['#0B1020', '#0C1124', '#140F24']
        : ['#F9F0FF', '#FFF6FA', '#F5F8FF'],
      cardBg: isDark ? '#0F172A' : '#FFFFFF',
      cardBorder: isDark ? '#1F2937' : '#EDE9F5',
      tabBg: isDark ? '#111827' : '#F3F4F6',
      tabActiveBg: isDark ? '#1F2937' : '#FFFFFF',
      inputBg: isDark ? '#0B1220' : '#FFFFFF',
      inputBorder: isDark ? '#1F2937' : '#E5E7EB',
      buttonGradient: isDark ? ['#8B5CF6', '#EC4899'] : ['#B14DFF', '#F43F8C'],
      link: isDark ? '#C084FC' : colors.primary,
      muted: themeColors.textSecondary || colors.textSecondary,
    }),
    [isDark, themeColors.textSecondary]
  );

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const resolveSessionTokens = async (session) => {
    if (session?.access_token && session?.refresh_token) {
      return {
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
      };
    }

    try {
      const { data } = await supabase.auth.getSession();
      const activeSession = data?.session;
      return {
        accessToken: activeSession?.access_token || null,
        refreshToken: activeSession?.refresh_token || null,
      };
    } catch (sessionError) {
      console.log('Unable to resolve auth session', sessionError);
      return { accessToken: null, refreshToken: null };
    }
  };

  const persistSavedAccounts = async (nextList) => {
    try {
      await AsyncStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(nextList));
    } catch (persistError) {
      console.log('Unable to save accounts', persistError);
    }
  };

  const saveAccount = async (account) => {
    const nextList = buildNextAccounts(savedAccounts, account);
    setSavedAccounts(nextList);
    await persistSavedAccounts(nextList);
  };

  const handleSelectAccount = async (account) => {
    setMode('login');
    setError('');
    const hasRefreshToken =
      typeof account?.refreshToken === 'string' && account.refreshToken.length > 10;
    const hasAccessToken =
      typeof account?.accessToken === 'string' && account.accessToken.length > 10;
    if (!hasRefreshToken) {
      updateField('identifier', account?.email || '');
      updateField('password', '');
      setError('Saved session expired. Please enter your password.');
      return;
    }

    try {
      setIsSubmitting(true);
      const { user, session } = await signInWithSession({
        accessToken: hasAccessToken ? account.accessToken : null,
        refreshToken: account.refreshToken,
      });
      const tokens = await resolveSessionTokens(session);
      await saveAccount({
        id: user?.id || account.id || normalizeEmail(account.email),
        email: user?.email || account.email,
        name:
          user?.user_metadata?.full_name ||
          user?.user_metadata?.name ||
          account.name ||
          '',
        username: user?.user_metadata?.username || account.username || '',
        accessToken: tokens.accessToken || account.accessToken,
        refreshToken: tokens.refreshToken || account.refreshToken,
      });
    } catch (submitError) {
      updateField('identifier', account?.email || '');
      updateField('password', '');
      setError(submitError?.message || 'Saved session expired. Please sign in again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveAccount = async (account) => {
    const nextList = savedAccounts.filter(
      (item) => normalizeEmail(item?.email) !== normalizeEmail(account?.email)
    );
    setSavedAccounts(nextList);
    await persistSavedAccounts(nextList);
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
        const { user, session } = await signIn({
          identifier: form.identifier,
          password: form.password,
        });
        const tokens = await resolveSessionTokens(session);
        await saveAccount({
          id: user?.id || normalizeEmail(form.identifier),
          email: user?.email || form.identifier,
          name:
            user?.user_metadata?.full_name ||
            user?.user_metadata?.name ||
            user?.user_metadata?.username ||
            '',
          username: user?.user_metadata?.username || '',
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
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
        const { user, session } = await signUp({
          fullName: form.fullName,
          username: form.username,
          email: form.email,
          password: form.password,
        });
        const tokens = await resolveSessionTokens(session);
        await saveAccount({
          id: user?.id || normalizeEmail(form.email),
          email: user?.email || form.email,
          name:
            user?.user_metadata?.full_name ||
            user?.user_metadata?.name ||
            form.fullName ||
            '',
          username: user?.user_metadata?.username || form.username || '',
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
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

  const renderBadgeIcon = (badge) => {
    if (badge.iconType === 'feather') {
      return <Feather name={badge.icon} size={18} color={badge.color} />;
    }
    if (badge.iconType === 'material') {
      return <MaterialCommunityIcons name={badge.icon} size={18} color={badge.color} />;
    }
    return <Ionicons name={badge.icon} size={18} color={badge.color} />;
  };

  const headline =
    mode === 'login'
      ? "Welcome back. Let's get you signed in."
      : 'Create your account and start building better routines.';

  const isCtaDisabled = isSubmitting || (mode === 'signup' && !hasAcceptedTerms);

  return (
    <LinearGradient
      colors={authTheme.backgroundGradient}
      style={[styles.container, { paddingTop: insets.top + spacing.md }]}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing.xxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons name="arrow-back" size={22} color={themeColors.text} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <View style={styles.iconRow}>
          {badges.map((badge) => (
            <View
              key={badge.id}
              style={[
                styles.badge,
                { backgroundColor: `${badge.color}1A` },
              ]}
            >
              {renderBadgeIcon(badge)}
            </View>
          ))}
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
        <Text style={styles.subtitle}>{headline}</Text>

        <View
          style={[
            styles.card,
            { backgroundColor: authTheme.cardBg, borderColor: authTheme.cardBorder },
          ]}
        >
          <View
            style={[
              styles.tabRow,
              { backgroundColor: authTheme.tabBg, borderColor: authTheme.cardBorder },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.tab,
                mode === 'login' && styles.tabActiveShadow,
                { backgroundColor: mode === 'login' ? authTheme.tabActiveBg : 'transparent' },
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
                mode === 'signup' && styles.tabActiveShadow,
                { backgroundColor: mode === 'signup' ? authTheme.tabActiveBg : 'transparent' },
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
                icon="mail-outline"
                keyboardType="email-address"
                autoCapitalize="none"
                value={form.identifier}
                onChangeText={(text) => updateField('identifier', text)}
                containerStyle={styles.inputGroup}
                style={[
                  styles.inputField,
                  { backgroundColor: authTheme.inputBg, borderColor: authTheme.inputBorder },
                ]}
                inputStyle={styles.inputText}
              />
              <Input
                placeholder="Password"
                icon="lock-closed-outline"
                secureTextEntry
                autoCapitalize="none"
                value={form.password}
                onChangeText={(text) => updateField('password', text)}
                containerStyle={styles.inputGroup}
                style={[
                  styles.inputField,
                  { backgroundColor: authTheme.inputBg, borderColor: authTheme.inputBorder },
                ]}
                inputStyle={styles.inputText}
              />

              <TouchableOpacity
                style={styles.forgotPassword}
                onPress={() => navigation.navigate('ForgotPassword')}
              >
                <Text style={[styles.linkText, { color: authTheme.link }]}>
                  Forgot password?
                </Text>
              </TouchableOpacity>

            </>
          ) : (
            <>
              <Input
                placeholder="Full name"
                icon="person-circle-outline"
                value={form.fullName}
                onChangeText={(text) => updateField('fullName', text)}
                containerStyle={styles.inputGroup}
                style={[
                  styles.inputField,
                  { backgroundColor: authTheme.inputBg, borderColor: authTheme.inputBorder },
                ]}
                inputStyle={styles.inputText}
              />
              <Input
                placeholder="Username"
                icon="at-outline"
                autoCapitalize="none"
                value={form.username}
                onChangeText={(text) => updateField('username', text)}
                containerStyle={styles.inputGroup}
                style={[
                  styles.inputField,
                  { backgroundColor: authTheme.inputBg, borderColor: authTheme.inputBorder },
                ]}
                inputStyle={styles.inputText}
              />
              <Input
                placeholder="Email"
                icon="mail-outline"
                keyboardType="email-address"
                autoCapitalize="none"
                value={form.email}
                onChangeText={(text) => updateField('email', text)}
                containerStyle={styles.inputGroup}
                style={[
                  styles.inputField,
                  { backgroundColor: authTheme.inputBg, borderColor: authTheme.inputBorder },
                ]}
                inputStyle={styles.inputText}
              />
              <Input
                placeholder="Password"
                icon="lock-closed-outline"
                secureTextEntry
                autoCapitalize="none"
                value={form.password}
                onChangeText={(text) => updateField('password', text)}
                containerStyle={styles.inputGroup}
                style={[
                  styles.inputField,
                  { backgroundColor: authTheme.inputBg, borderColor: authTheme.inputBorder },
                ]}
                inputStyle={styles.inputText}
              />
              <Input
                placeholder="Re-enter password"
                icon="lock-closed-outline"
                secureTextEntry
                autoCapitalize="none"
                value={form.confirmPassword}
                onChangeText={(text) => updateField('confirmPassword', text)}
                containerStyle={styles.inputGroup}
                style={[
                  styles.inputField,
                  { backgroundColor: authTheme.inputBg, borderColor: authTheme.inputBorder },
                ]}
                inputStyle={styles.inputText}
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
                color={hasAcceptedTerms ? authTheme.link : authTheme.muted}
                style={styles.checkboxIcon}
              />
              <Text style={styles.termsText}>
                By creating an account, you agree to the{' '}
                <Text
                  style={[styles.termsLink, { color: authTheme.link }]}
                  onPress={() => handleOpenLink('https://pillarup.net/terms-of-service.html')}
                >
                  Terms of Service
                </Text>{' '}
                and acknowledge the{' '}
                <Text
                  style={[styles.termsLink, { color: authTheme.link }]}
                  onPress={() => handleOpenLink('https://pillarup.net/privacy-policy.html')}
                >
                  Privacy Policy
                </Text>
                .
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.ctaButton, isCtaDisabled && styles.ctaDisabled]}
            onPress={handleSubmit}
            disabled={isCtaDisabled}
            activeOpacity={0.85}
          >
            <LinearGradient colors={authTheme.buttonGradient} style={styles.ctaGradient}>
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.ctaText}>
                    {mode === 'login' ? 'Login' : 'Create Account'}
                  </Text>
                  <Ionicons name="arrow-forward" size={18} color="#FFFFFF" style={styles.ctaIcon} />
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {mode === 'login' && savedAccounts.length > 0 && (
            <View style={styles.savedSection}>
              <Text style={styles.savedTitle}>Saved Accounts</Text>
              <View style={styles.savedList}>
                {savedAccounts.map((account) => (
                  <TouchableOpacity
                    key={account.email}
                    style={[
                      styles.savedCard,
                      {
                        backgroundColor: authTheme.cardBg,
                        borderColor: authTheme.cardBorder,
                      },
                    ]}
                    onPress={() => handleSelectAccount(account)}
                    activeOpacity={0.85}
                  >
                    <LinearGradient
                      colors={authTheme.buttonGradient}
                      style={styles.savedAvatar}
                    >
                      <Text style={styles.savedInitials}>
                        {getInitials(account.name, account.email)}
                      </Text>
                    </LinearGradient>
                    <View style={styles.savedInfo}>
                      <Text style={styles.savedName} numberOfLines={1}>
                        {account.name || account.email}
                      </Text>
                      <Text style={styles.savedEmail} numberOfLines={1}>
                        {account.email}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.savedRemove}
                      onPress={() => handleRemoveAccount(account)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="close" size={14} color={authTheme.muted} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </LinearGradient>
  );
};

const createStyles = (themeColorsParam = colors) => {
  const baseText = themeColorsParam?.text || colors.text;
  const mutedText = themeColorsParam?.textSecondary || colors.textSecondary;
  const displayFont = Platform.select({
    ios: 'AvenirNext-DemiBold',
    android: 'sans-serif-condensed',
  });

  return StyleSheet.create({
    container: {
      flex: 1,
    },
    content: {
      paddingHorizontal: spacing.xl,
    },
    backButton: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.md,
      alignSelf: 'flex-start',
    },
    backText: {
      ...typography.bodySmall,
      marginLeft: spacing.xs,
      color: mutedText,
    },
    iconRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginBottom: spacing.lg,
    },
    badge: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      marginHorizontal: spacing.xs,
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
    logoTitle: {
      fontSize: 30,
      fontWeight: '800',
      color: baseText,
      fontFamily: displayFont,
    },
    subtitle: {
      ...typography.bodySmall,
      color: mutedText,
      textAlign: 'center',
      marginBottom: spacing.xl,
    },
    card: {
      borderRadius: borderRadius.xl,
      borderWidth: 1,
      padding: spacing.lg,
      ...shadows.medium,
    },
    tabRow: {
      flexDirection: 'row',
      padding: spacing.xs,
      borderRadius: borderRadius.lg,
      marginBottom: spacing.lg,
      borderWidth: 1,
    },
    tab: {
      flex: 1,
      paddingVertical: spacing.sm,
      alignItems: 'center',
      borderRadius: borderRadius.md,
    },
    tabActiveShadow: {
      ...shadows.small,
    },
    tabText: {
      ...typography.bodySmall,
      color: mutedText,
      fontWeight: '600',
    },
    tabTextActive: {
      color: baseText,
      fontWeight: '700',
    },
    savedSection: {
      marginTop: spacing.lg,
    },
    savedTitle: {
      ...typography.bodySmall,
      color: mutedText,
      fontWeight: '600',
      marginBottom: spacing.sm,
    },
    savedList: {},
    savedCard: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.sm,
      marginBottom: spacing.sm,
      ...shadows.small,
    },
    savedAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.sm,
    },
    savedInitials: {
      color: '#FFFFFF',
      fontWeight: '700',
      fontSize: 14,
    },
    savedInfo: {
      flex: 1,
    },
    savedName: {
      ...typography.bodySmall,
      color: baseText,
      fontWeight: '600',
    },
    savedEmail: {
      ...typography.caption,
      color: mutedText,
    },
    savedRemove: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: themeColorsParam?.divider || colors.divider,
      marginLeft: spacing.sm,
    },
    inputGroup: {
      marginBottom: spacing.md,
    },
    inputField: {
      borderRadius: borderRadius.lg,
      borderWidth: 1,
    },
    inputText: {
      color: baseText,
    },
    forgotPassword: {
      alignSelf: 'flex-end',
      marginBottom: spacing.sm,
    },
    linkText: {
      ...typography.bodySmall,
      fontWeight: '600',
    },
    errorText: {
      color: themeColorsParam?.danger || colors.danger,
      marginBottom: spacing.sm,
    },
    termsRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: spacing.lg,
    },
    checkboxIcon: {
      marginTop: 2,
      marginRight: spacing.sm,
    },
    termsText: {
      ...typography.bodySmall,
      color: mutedText,
      flex: 1,
      lineHeight: 18,
    },
    termsLink: {
      fontWeight: '600',
      textDecorationLine: 'underline',
    },
    ctaButton: {
      borderRadius: borderRadius.full,
      overflow: 'hidden',
      marginTop: spacing.sm,
    },
    ctaDisabled: {
      opacity: 0.6,
    },
    ctaGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
    },
    ctaText: {
      ...typography.body,
      color: '#FFFFFF',
      fontWeight: '700',
      fontFamily: displayFont,
    },
    ctaIcon: {
      marginLeft: spacing.sm,
    },
  });
};

export default AuthScreen;
