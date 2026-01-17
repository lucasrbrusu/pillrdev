import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Easing,
  Platform,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Input from '../components/Input';
import { useApp } from '../context/AppContext';
import { colors, borderRadius, spacing, typography, shadows } from '../utils/theme';

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

const stepContent = [
  {
    key: 'name',
    title: "What's your name?",
    subtitle: 'Let us know what to call you',
  },
  {
    key: 'username',
    title: 'Choose a username',
    subtitle: 'This is how others will find you',
  },
  {
    key: 'email',
    title: "What's your email?",
    subtitle: "We'll use this for login and updates",
  },
  {
    key: 'password',
    title: 'Create a password',
    subtitle: 'Must be at least 6 characters',
  },
  {
    key: 'terms',
    title: 'Terms & Privacy',
    subtitle: 'Please review and accept to continue',
  },
];

const termsHighlights = [
  {
    id: 'privacy',
    title: 'Privacy First',
    description: 'Your data is encrypted and private. We never share your information.',
  },
  {
    id: 'adfree',
    title: 'Ad-Free Experience',
    description: 'No ads, no tracking. Just a clean productivity experience.',
  },
  {
    id: 'cancel',
    title: 'Cancel Anytime',
    description: "You're in control. Cancel your account anytime, no questions asked.",
  },
];

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

const SignupFlowScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { signUp, themeColors, themeName } = useApp();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);
  const isDark = themeName === 'dark';
  const scrollRef = useRef(null);
  const { width } = useWindowDimensions();
  const translateX = useRef(new Animated.Value(0)).current;
  const entryAnim = useRef(new Animated.Value(0)).current;

  const [stepIndex, setStepIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);
  const [form, setForm] = useState({
    fullName: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const signupTheme = useMemo(
    () => ({
      backgroundGradient: isDark
        ? ['#0B1020', '#0C1124', '#140F24']
        : ['#F9F0FF', '#FFF6FA', '#F5F8FF'],
      cardBg: isDark ? '#0F172A' : '#FFFFFF',
      cardBorder: isDark ? '#1F2937' : '#EDE9F5',
      inputBg: isDark ? '#0B1220' : '#FFFFFF',
      inputBorder: isDark ? '#1F2937' : '#E5E7EB',
      buttonGradient: isDark ? ['#8B5CF6', '#EC4899'] : ['#B14DFF', '#F43F8C'],
      link: isDark ? '#C084FC' : colors.primary,
      muted: themeColors.textSecondary || colors.textSecondary,
      highlightBg: isDark ? '#111827' : '#F9F5FF',
      orbOne: isDark ? 'rgba(139,92,246,0.22)' : 'rgba(236,72,153,0.16)',
      orbTwo: isDark ? 'rgba(56,189,248,0.2)' : 'rgba(59,130,246,0.12)',
    }),
    [isDark, themeColors.textSecondary]
  );

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (error) {
      setError('');
    }
  };

  useEffect(() => {
    const runEntry = () => {
      entryAnim.setValue(0);
      Animated.timing(entryAnim, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    };
    runEntry();
    const unsubscribe = navigation.addListener('focus', runEntry);
    return unsubscribe;
  }, [entryAnim, navigation]);

  const animateToStep = (nextStep, direction) => {
    if (nextStep === stepIndex) return;
    const distance = direction === 'left' ? -width : width;
    Animated.timing(translateX, {
      toValue: distance,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      const incomingOffset = direction === 'left' ? width : -width;
      translateX.setValue(incomingOffset);
      setStepIndex(nextStep);
      Animated.timing(translateX, {
        toValue: 0,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });
  };

  const handleBack = () => {
    if (stepIndex === 0) {
      navigation.goBack();
      return;
    }
    setError('');
    animateToStep(Math.max(stepIndex - 1, 0), 'right');
  };

  const handleOpenLink = (url) => {
    Linking.openURL(url);
  };

  const handleContinue = async () => {
    const stepError = getStepError();
    if (stepError) {
      setError(stepError);
      return;
    }

    if (stepIndex < stepContent.length - 1) {
      setError('');
      animateToStep(stepIndex + 1, 'left');
      return;
    }

    try {
      setIsSubmitting(true);
      await signUp({
        fullName: form.fullName.trim(),
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
      });
    } catch (submitError) {
      setError(submitError?.message || 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStepError = () => {
    const trimmedName = form.fullName.trim();
    const trimmedUsername = form.username.trim();
    const trimmedEmail = form.email.trim();

    switch (stepIndex) {
      case 0:
        return trimmedName ? '' : 'Please enter your full name.';
      case 1:
        return trimmedUsername ? '' : 'Please choose a username.';
      case 2:
        if (!trimmedEmail) {
          return 'Please enter your email address.';
        }
        if (!/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
          return 'Please enter a valid email address.';
        }
        return '';
      case 3: {
        const passwordError = getPasswordError(form.password);
        if (passwordError) {
          return passwordError;
        }
        if (!form.confirmPassword) {
          return 'Please confirm your password.';
        }
        if (form.password !== form.confirmPassword) {
          return 'Passwords do not match.';
        }
        return '';
      }
      case 4:
        return hasAcceptedTerms ? '' : 'Please accept the terms to continue.';
      default:
        return '';
    }
  };

  const isStepComplete = useMemo(() => {
    switch (stepIndex) {
      case 0:
        return Boolean(form.fullName.trim());
      case 1:
        return Boolean(form.username.trim());
      case 2:
        return Boolean(form.email.trim()) && /^\S+@\S+\.\S+$/.test(form.email.trim());
      case 3:
        return (
          Boolean(form.password) &&
          !getPasswordError(form.password) &&
          form.password === form.confirmPassword
        );
      case 4:
        return hasAcceptedTerms;
      default:
        return false;
    }
  }, [form, hasAcceptedTerms, stepIndex]);

  const renderBadgeIcon = (badge) => {
    if (badge.iconType === 'feather') {
      return <Feather name={badge.icon} size={18} color={badge.color} />;
    }
    if (badge.iconType === 'material') {
      return <MaterialCommunityIcons name={badge.icon} size={18} color={badge.color} />;
    }
    return <Ionicons name={badge.icon} size={18} color={badge.color} />;
  };

  const stepMeta = stepContent[stepIndex];
  const progress = (stepIndex + 1) / stepContent.length;
  const isLastStep = stepIndex === stepContent.length - 1;
  const entryOpacity = entryAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const entryScale = entryAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1.06, 1],
  });
  const entryTranslateY = entryAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [24, 0],
  });
  const fadeOpacity = translateX.interpolate({
    inputRange: [-width, 0, width],
    outputRange: [0, 1, 0],
    extrapolate: 'clamp',
  });

  return (
    <LinearGradient
      colors={signupTheme.backgroundGradient}
      style={[styles.container, { paddingTop: insets.top + spacing.md }]}
    >
      <View style={styles.backgroundOrbs} pointerEvents="none">
        <View style={[styles.orb, styles.orbOne, { backgroundColor: signupTheme.orbOne }]} />
        <View style={[styles.orb, styles.orbTwo, { backgroundColor: signupTheme.orbTwo }]} />
      </View>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing.xxl },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View
          style={[
            styles.scene,
            {
              opacity: entryOpacity,
              transform: [{ translateY: entryTranslateY }, { scale: entryScale }],
            },
          ]}
        >
          <View style={styles.topRow}>
            <TouchableOpacity style={styles.backButton} onPress={handleBack} activeOpacity={0.85}>
              <Ionicons name="arrow-back" size={22} color={themeColors.text} />
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>
            <Text style={styles.stepLabel}>
              Step {stepIndex + 1} of {stepContent.length}
            </Text>
          </View>

          <View style={[styles.progressTrack, { backgroundColor: signupTheme.cardBorder }]}>
            <LinearGradient
              colors={signupTheme.buttonGradient}
              style={[styles.progressFill, { width: `${progress * 100}%` }]}
            />
          </View>

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
          <Text style={styles.subtitle}>Create your account</Text>

          <Animated.View style={{ transform: [{ translateX }], opacity: fadeOpacity }}>
            <View
              style={[
                styles.card,
                { backgroundColor: signupTheme.cardBg, borderColor: signupTheme.cardBorder },
              ]}
            >
              <Text style={styles.cardTitle}>{stepMeta.title}</Text>
              <Text style={styles.cardSubtitle}>{stepMeta.subtitle}</Text>

              {stepMeta.key === 'name' && (
                <Input
                  label="Full name"
                  placeholder="John Doe"
                  icon="person-circle-outline"
                  value={form.fullName}
                  onChangeText={(text) => updateField('fullName', text)}
                  containerStyle={styles.inputGroup}
                  style={[
                    styles.inputField,
                    { backgroundColor: signupTheme.inputBg, borderColor: signupTheme.inputBorder },
                  ]}
                  inputStyle={styles.inputText}
                />
              )}

              {stepMeta.key === 'username' && (
                <>
                  <Input
                    label="Username"
                    placeholder="johndoe"
                    icon="at-outline"
                    autoCapitalize="none"
                    value={form.username}
                    onChangeText={(text) => updateField('username', text)}
                    containerStyle={styles.inputGroup}
                    style={[
                      styles.inputField,
                      { backgroundColor: signupTheme.inputBg, borderColor: signupTheme.inputBorder },
                    ]}
                    inputStyle={styles.inputText}
                  />
                  <Text style={styles.helperText}>Your username must be unique.</Text>
                </>
              )}

              {stepMeta.key === 'email' && (
                <Input
                  label="Email address"
                  placeholder="john@example.com"
                  icon="mail-outline"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={form.email}
                  onChangeText={(text) => updateField('email', text)}
                  containerStyle={styles.inputGroup}
                  style={[
                    styles.inputField,
                    { backgroundColor: signupTheme.inputBg, borderColor: signupTheme.inputBorder },
                  ]}
                  inputStyle={styles.inputText}
                />
              )}

              {stepMeta.key === 'password' && (
                <>
                  <Input
                    label="Password"
                    placeholder="********"
                    icon="lock-closed-outline"
                    secureTextEntry
                    autoCapitalize="none"
                    value={form.password}
                    onChangeText={(text) => updateField('password', text)}
                    containerStyle={styles.inputGroup}
                    style={[
                      styles.inputField,
                      { backgroundColor: signupTheme.inputBg, borderColor: signupTheme.inputBorder },
                    ]}
                    inputStyle={styles.inputText}
                  />
                  <Input
                    label="Confirm password"
                    placeholder="********"
                    icon="lock-closed-outline"
                    secureTextEntry
                    autoCapitalize="none"
                    value={form.confirmPassword}
                    onChangeText={(text) => updateField('confirmPassword', text)}
                    containerStyle={styles.inputGroupTight}
                    style={[
                      styles.inputField,
                      { backgroundColor: signupTheme.inputBg, borderColor: signupTheme.inputBorder },
                    ]}
                    inputStyle={styles.inputText}
                  />
                </>
              )}

              {stepMeta.key === 'terms' && (
                <>
                  <View style={[styles.termsCard, { backgroundColor: signupTheme.highlightBg }]}>
                    {termsHighlights.map((item) => (
                      <View key={item.id} style={styles.termsItem}>
                        <View style={[styles.termsCheck, { borderColor: signupTheme.link }]}>
                          <Ionicons name="checkmark" size={14} color={signupTheme.link} />
                        </View>
                        <View style={styles.termsCopy}>
                          <Text style={styles.termsTitle}>{item.title}</Text>
                          <Text style={styles.termsDescription}>{item.description}</Text>
                        </View>
                      </View>
                    ))}
                  </View>

                  <TouchableOpacity
                    style={styles.termsRow}
                    activeOpacity={0.8}
                    onPress={() => {
                      setHasAcceptedTerms((prev) => !prev);
                      if (error) {
                        setError('');
                      }
                    }}
                  >
                    <Feather
                      name={hasAcceptedTerms ? 'check-square' : 'square'}
                      size={20}
                      color={hasAcceptedTerms ? signupTheme.link : signupTheme.muted}
                      style={styles.checkboxIcon}
                    />
                    <Text style={styles.termsText}>
                      I agree to the{' '}
                      <Text
                        style={[styles.termsLink, { color: signupTheme.link }]}
                        onPress={() => handleOpenLink('https://pillarup.net/terms-of-service.html')}
                      >
                        Terms of Service
                      </Text>{' '}
                      and{' '}
                      <Text
                        style={[styles.termsLink, { color: signupTheme.link }]}
                        onPress={() => handleOpenLink('https://pillarup.net/privacy-policy.html')}
                      >
                        Privacy Policy
                      </Text>
                      .
                    </Text>
                  </TouchableOpacity>
                </>
              )}

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <TouchableOpacity
                style={[styles.ctaButton, (!isStepComplete || isSubmitting) && styles.ctaDisabled]}
                onPress={handleContinue}
                disabled={!isStepComplete || isSubmitting}
                activeOpacity={0.85}
              >
                <LinearGradient colors={signupTheme.buttonGradient} style={styles.ctaGradient}>
                  {isSubmitting ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Text style={styles.ctaText}>
                        {isLastStep ? 'Create Account' : 'Continue'}
                      </Text>
                      <Ionicons
                        name="arrow-forward"
                        size={18}
                        color="#FFFFFF"
                        style={styles.ctaIcon}
                      />
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </Animated.View>
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
    scene: {
      flexGrow: 1,
    },
    backgroundOrbs: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    orb: {
      position: 'absolute',
      borderRadius: 999,
    },
    orbOne: {
      width: 220,
      height: 220,
      top: -80,
      left: -40,
    },
    orbTwo: {
      width: 180,
      height: 180,
      bottom: -40,
      right: -20,
    },
    topRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    backButton: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    backText: {
      ...typography.bodySmall,
      marginLeft: spacing.xs,
      color: mutedText,
    },
    stepLabel: {
      ...typography.bodySmall,
      color: mutedText,
      fontWeight: '600',
    },
    progressTrack: {
      height: 6,
      borderRadius: 999,
      overflow: 'hidden',
      marginBottom: spacing.lg,
    },
    progressFill: {
      height: 6,
      borderRadius: 999,
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
    cardTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: baseText,
      marginBottom: spacing.xs,
    },
    cardSubtitle: {
      ...typography.bodySmall,
      color: mutedText,
      marginBottom: spacing.lg,
    },
    inputGroup: {
      marginBottom: spacing.md,
    },
    inputGroupTight: {
      marginBottom: spacing.sm,
    },
    inputField: {
      borderRadius: borderRadius.lg,
      borderWidth: 1,
    },
    inputText: {
      color: baseText,
    },
    helperText: {
      ...typography.caption,
      color: mutedText,
      marginBottom: spacing.md,
    },
    termsCard: {
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    termsItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: spacing.md,
    },
    termsCheck: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.sm,
      marginTop: 2,
    },
    termsCopy: {
      flex: 1,
    },
    termsTitle: {
      ...typography.bodySmall,
      fontWeight: '700',
      color: baseText,
      marginBottom: 2,
    },
    termsDescription: {
      ...typography.caption,
      color: mutedText,
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
      color: mutedText,
      flex: 1,
      lineHeight: 18,
    },
    termsLink: {
      fontWeight: '600',
      textDecorationLine: 'underline',
    },
    errorText: {
      color: themeColorsParam?.danger || colors.danger,
      marginBottom: spacing.sm,
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

export default SignupFlowScreen;

