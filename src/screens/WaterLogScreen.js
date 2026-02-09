import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Animated,
  Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { toLocalDateKey } from '../utils/insights';
import { shadows, spacing, borderRadius, typography } from '../utils/theme';

const BOTTLE_HEIGHT = 220;

const QUICK_ADDS = [
  { id: 'glass', label: 'Glass', amount: 250, icon: 'cafe-outline' },
  { id: 'bottle', label: 'Bottle', amount: 500, icon: 'water-outline' },
  { id: 'can', label: 'Can', amount: 330, icon: 'beer-outline' },
  { id: 'large', label: 'Large', amount: 750, icon: 'flask-outline' },
];

const WaterLogScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const {
    waterLogs,
    addWaterLogEntryForDate,
    deleteWaterLogEntryForDate,
    resetWaterLogForDate,
    profile,
    themeName,
    ensureHealthLoaded,
  } = useApp();
  const isDark = themeName === 'dark';
  const palette = useMemo(() => getPalette(isDark), [isDark]);
  const styles = useMemo(() => createStyles(palette), [palette]);
  const fillAnim = React.useRef(new Animated.Value(0)).current;
  const waveAnim = React.useRef(new Animated.Value(0)).current;
  const pourAnim = React.useRef(new Animated.Value(0)).current;
  const prevProgressRef = React.useRef(0);

  useEffect(() => {
    ensureHealthLoaded();
  }, [ensureHealthLoaded]);

  const [customAmount, setCustomAmount] = useState('');

  const dailyGoalLitres = Math.max(0, Number(profile?.dailyWaterGoal) || 0);
  const dateKey = toLocalDateKey(new Date());

  const history = useMemo(() => {
    const entries = waterLogs?.[dateKey] || [];
    return [...entries].sort((a, b) => {
      const aTime = new Date(a.timestamp || a.created_at || a.createdAt || 0).getTime();
      const bTime = new Date(b.timestamp || b.created_at || b.createdAt || 0).getTime();
      return bTime - aTime;
    });
  }, [waterLogs, dateKey]);
  const totalMl = Math.max(
    0,
    Math.round(
      history.reduce((sum, entry) => sum + (Number(entry.amountMl) || 0), 0)
    )
  );
  const goalMl = Math.max(0, Math.round(dailyGoalLitres * 1000));
  const rawProgress = goalMl > 0 ? totalMl / goalMl : 0;
  const progress = Math.min(1, rawProgress);
  const percent = goalMl > 0 ? Math.round(rawProgress * 100) : 0;
  const goalReached = goalMl > 0 && rawProgress >= 1;

  useEffect(() => {
    Animated.timing(fillAnim, {
      toValue: progress,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();

    if (progress > prevProgressRef.current) {
      pourAnim.setValue(0);
      Animated.sequence([
        Animated.timing(pourAnim, {
          toValue: 1,
          duration: 450,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(pourAnim, {
          toValue: 0,
          duration: 350,
          easing: Easing.in(Easing.quad),
          useNativeDriver: false,
        }),
      ]).start();
    }
    prevProgressRef.current = progress;
  }, [progress, fillAnim, pourAnim]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(waveAnim, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
        Animated.timing(waveAnim, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [waveAnim]);

  const fillHeight = fillAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, BOTTLE_HEIGHT],
  });
  const waveTranslate = waveAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-18, 18],
  });
  const waveOpacity = fillAnim.interpolate({
    inputRange: [0, 0.05, 1],
    outputRange: [0, 0.7, 0.7],
  });
  const pourTranslate = pourAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-30, 40],
  });
  const pourOpacity = pourAnim.interpolate({
    inputRange: [0, 0.2, 0.8, 1],
    outputRange: [0, 0.6, 0.35, 0],
  });

  const formatTime = (value) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '--';
    return parsed.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const makeHistoryLabel = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Morning hydration';
    if (hour < 17) return 'Midday boost';
    return 'Evening hydration';
  };

  const handleAddWater = async (amountMl, labelOverride) => {
    if (!Number.isFinite(amountMl) || amountMl <= 0) {
      Alert.alert('Enter an amount', 'Please add a positive amount in milliliters.');
      return;
    }

    try {
      const normalizedAmount = Math.round(amountMl * 10) / 10;
      await addWaterLogEntryForDate(dateKey, {
        amountMl: normalizedAmount,
        label: labelOverride || makeHistoryLabel(),
      });
    } catch (err) {
      console.log('Error logging water', err);
      Alert.alert('Unable to log water', 'Please try again.');
    }
  };

  const handleCustomAdd = () => {
    const parsed = parseFloat(customAmount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      Alert.alert('Enter an amount', 'Please add a positive amount in milliliters.');
      return;
    }
    handleAddWater(parsed, 'Custom amount');
    setCustomAmount('');
  };

  const handleResetDay = () => {
    Alert.alert(
      'Reset water log?',
      'This will clear today’s water entries and reset your total to 0ml.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              await resetWaterLogForDate(dateKey);
            } catch (err) {
              console.log('Error resetting water log', err);
              Alert.alert('Unable to reset', 'Please try again.');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: palette.pageBackground }]}>
      <View style={[styles.headerContainer, { paddingTop: insets.top }]}>
        <LinearGradient
          colors={palette.headerGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        />
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.85}
          >
            <Ionicons name="arrow-back" size={18} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerTextBlock}>
            <Text style={styles.headerTitle}>Water Intake</Text>
            <Text style={styles.headerSubtitle}>Stay hydrated throughout the day</Text>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flexGrow}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <View>
                <Text style={styles.summaryValue}>{totalMl}ml</Text>
                <Text style={styles.summaryGoal}>
                  {goalMl > 0 ? `of ${goalMl}ml goal` : 'Set a daily goal'}
                </Text>
              </View>
              <View style={styles.summaryRight}>
                <Text style={styles.summaryPercent}>{goalMl > 0 ? `${percent}%` : '--'}</Text>
                <Text style={styles.summaryComplete}>Complete</Text>
              </View>
            </View>

            <View style={styles.bottleWrap}>
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.pourStream,
                  {
                    opacity: pourOpacity,
                    transform: [{ translateY: pourTranslate }],
                    backgroundColor: palette.bottleFill,
                  },
                ]}
              />
              <View style={styles.bottleCap} />
              <View style={styles.bottleBody}>
                <Animated.View
                  style={[
                    styles.bottleFill,
                    {
                      height: fillHeight,
                      backgroundColor: palette.bottleFill,
                    },
                  ]}
                >
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      styles.bottleWave,
                      {
                        opacity: waveOpacity,
                        transform: [{ translateX: waveTranslate }],
                        backgroundColor: palette.isDark
                          ? 'rgba(255,255,255,0.25)'
                          : 'rgba(255,255,255,0.4)',
                      },
                    ]}
                  />
                </Animated.View>
                <View style={styles.bottleGloss} />
              </View>
            </View>

            {goalReached && (
              <View style={styles.goalBanner}>
                <Ionicons name="trophy-outline" size={18} color={palette.successText} />
                <View style={styles.goalText}>
                  <Text style={styles.goalTitle}>Goal Achieved!</Text>
                  <Text style={styles.goalSubtitle}>You have reached your daily target</Text>
                </View>
              </View>
            )}
          </View>

          <Text style={styles.sectionTitle}>Quick Add</Text>
          <View style={styles.quickGrid}>
            {QUICK_ADDS.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.quickCard}
                onPress={() => handleAddWater(item.amount, `${item.label} added`)}
                activeOpacity={0.85}
              >
                <View style={styles.quickIcon}>
                  <Ionicons name={item.icon} size={20} color={palette.accent} />
                </View>
                <Text style={styles.quickLabel}>{item.label}</Text>
                <Text style={styles.quickAmount}>{item.amount}ml</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.sectionTitle}>Custom Amount</Text>
          <View style={styles.customCard}>
            <TextInput
              value={customAmount}
              onChangeText={setCustomAmount}
              placeholder="Enter ml"
              placeholderTextColor={palette.textSecondary}
              keyboardType="decimal-pad"
              style={styles.customInput}
            />
            <TouchableOpacity
              style={styles.customAddButton}
              onPress={handleCustomAdd}
              activeOpacity={0.85}
            >
              <Ionicons name="add" size={18} color="#FFFFFF" />
              <Text style={styles.customAddText}>Add</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, styles.sectionTitleTight]}>Today's History</Text>
            <TouchableOpacity
              style={[
                styles.resetButton,
                history.length === 0 && totalMl === 0 && styles.resetButtonDisabled,
              ]}
              onPress={handleResetDay}
              disabled={history.length === 0 && totalMl === 0}
            >
              <Ionicons name="refresh" size={16} color={palette.textSecondary} />
              <Text style={styles.resetText}>Reset</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.historyCard}>
            {history.length === 0 ? (
              <Text style={styles.historyEmpty}>No water logged yet today.</Text>
            ) : (
              history.map((entry) => (
                <View key={entry.id} style={styles.historyItem}>
                  <View style={styles.historyIcon}>
                    <Ionicons name="water" size={16} color={palette.accent} />
                  </View>
                  <View style={styles.historyText}>
                    <Text style={styles.historyLabel}>{entry.label || 'Water log'}</Text>
                    <Text style={styles.historyTime}>
                      {formatTime(entry.timestamp || entry.created_at || entry.createdAt)}
                    </Text>
                  </View>
                  <View style={styles.historyRight}>
                    <Text style={styles.historyAmount}>{entry.amountMl}ml</Text>
                    <TouchableOpacity
                      onPress={() => deleteWaterLogEntryForDate(dateKey, entry.id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="trash-outline" size={16} color={palette.textSecondary} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const getPalette = (isDark) => ({
  isDark,
  pageBackground: isDark ? '#0B1220' : '#F5F7FB',
  cardBackground: isDark ? '#111827' : '#FFFFFF',
  cardBorder: isDark ? '#1F2A44' : '#E6EDF7',
  textPrimary: isDark ? '#F9FAFB' : '#0F172A',
  textSecondary: isDark ? '#94A3B8' : '#64748B',
  accent: '#3B82F6',
  headerGradient: isDark ? ['#1D4ED8', '#2563EB'] : ['#3B82F6', '#4FA3FF'],
  bottleBorder: isDark ? '#274B8F' : '#CFE0FF',
  bottleFill: isDark ? '#4F8CFF' : '#6AA6FF',
  successBg: isDark ? '#2B2A12' : '#FFF4BF',
  successText: isDark ? '#FDE68A' : '#92400E',
});

const createStyles = (palette) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    flexGrow: {
      flex: 1,
    },
    headerContainer: {
      paddingBottom: spacing.sm,
      borderBottomLeftRadius: 32,
      borderBottomRightRadius: 32,
      overflow: 'hidden',
    },
    headerGradient: {
      ...StyleSheet.absoluteFillObject,
    },
    headerContent: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.sm,
      paddingBottom: spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
    },
    backButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: 'rgba(255,255,255,0.2)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTextBlock: {
      marginLeft: spacing.sm,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    headerSubtitle: {
      ...typography.bodySmall,
      fontSize: 12,
      color: 'rgba(255,255,255,0.85)',
    },
    scrollContent: {
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.xxxl,
      marginTop: spacing.md,
    },
    summaryCard: {
      backgroundColor: palette.cardBackground,
      borderRadius: borderRadius.xl,
      padding: spacing.xl,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      ...shadows.medium,
      marginBottom: spacing.xl,
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    summaryValue: {
      fontSize: 24,
      fontWeight: '700',
      color: palette.textPrimary,
    },
    summaryGoal: {
      ...typography.bodySmall,
      color: palette.textSecondary,
      marginTop: 4,
    },
    summaryRight: {
      alignItems: 'flex-end',
    },
    summaryPercent: {
      fontSize: 18,
      fontWeight: '700',
      color: palette.accent,
    },
    summaryComplete: {
      ...typography.caption,
      color: palette.textSecondary,
      marginTop: 2,
    },
    bottleWrap: {
      alignItems: 'center',
      marginTop: spacing.lg,
      marginBottom: spacing.lg,
    },
    bottleCap: {
      width: 42,
      height: 16,
      borderRadius: 8,
      backgroundColor: palette.bottleFill,
      marginBottom: 6,
      opacity: 0.7,
    },
    bottleBody: {
      width: 130,
      height: BOTTLE_HEIGHT,
      borderRadius: 36,
      borderWidth: 2,
      borderColor: palette.bottleBorder,
      backgroundColor: palette.isDark ? '#0B1D3B' : '#EFF6FF',
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'flex-end',
    },
    bottleFill: {
      width: '100%',
      borderTopLeftRadius: 30,
      borderTopRightRadius: 30,
      position: 'absolute',
      bottom: 0,
      overflow: 'hidden',
    },
    bottleWave: {
      position: 'absolute',
      top: -6,
      left: -30,
      width: 200,
      height: 16,
      borderRadius: 10,
    },
    bottleGloss: {
      position: 'absolute',
      top: 18,
      right: 18,
      width: 28,
      height: 80,
      borderRadius: 14,
      backgroundColor: 'rgba(255,255,255,0.22)',
    },
    goalBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: palette.successBg,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
    },
    pourStream: {
      position: 'absolute',
      top: -18,
      width: 8,
      height: 50,
      borderRadius: 4,
      alignSelf: 'center',
      zIndex: 2,
    },
    goalText: {
      flex: 1,
    },
    goalTitle: {
      ...typography.bodySmall,
      fontWeight: '700',
      color: palette.successText,
    },
    goalSubtitle: {
      ...typography.caption,
      color: palette.successText,
      marginTop: 2,
    },
    sectionTitle: {
      ...typography.h3,
      color: palette.textPrimary,
      marginBottom: spacing.md,
    },
    sectionTitleTight: {
      marginBottom: 0,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    resetButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.full,
      backgroundColor: palette.isDark ? 'rgba(255,255,255,0.06)' : '#EDF2FF',
    },
    resetButtonDisabled: {
      opacity: 0.5,
    },
    resetText: {
      ...typography.caption,
      color: palette.textSecondary,
      fontWeight: '600',
      marginLeft: spacing.xs,
    },
    quickGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      marginBottom: spacing.lg,
    },
    quickCard: {
      width: '23%',
      backgroundColor: palette.cardBackground,
      borderRadius: borderRadius.lg,
      paddingVertical: spacing.md,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: palette.cardBorder,
      ...shadows.small,
      marginBottom: spacing.md,
    },
    quickIcon: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: palette.isDark ? 'rgba(59,130,246,0.2)' : '#E0ECFF',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.xs,
    },
    quickLabel: {
      ...typography.caption,
      color: palette.textPrimary,
      fontWeight: '600',
    },
    quickAmount: {
      ...typography.caption,
      color: palette.textSecondary,
      marginTop: 2,
    },
    customCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: palette.cardBackground,
      borderRadius: borderRadius.xl,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      ...shadows.small,
      marginBottom: spacing.lg,
    },
    customInput: {
      flex: 1,
      height: 44,
      borderRadius: borderRadius.lg,
      paddingHorizontal: spacing.md,
      backgroundColor: palette.isDark ? '#0F172A' : '#F1F5FF',
      color: palette.textPrimary,
      fontSize: 14,
      marginRight: spacing.md,
    },
    customAddButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: palette.accent,
      borderRadius: borderRadius.lg,
      paddingHorizontal: spacing.lg,
      height: 44,
    },
    customAddText: {
      color: '#FFFFFF',
      fontWeight: '600',
      marginLeft: spacing.xs,
    },
    historyCard: {
      backgroundColor: palette.cardBackground,
      borderRadius: borderRadius.xl,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      ...shadows.small,
    },
    historyItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.sm,
    },
    historyIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: palette.isDark ? 'rgba(59,130,246,0.2)' : '#E8F1FF',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.sm,
    },
    historyText: {
      flex: 1,
    },
    historyRight: {
      alignItems: 'flex-end',
      justifyContent: 'center',
    },
    historyLabel: {
      ...typography.bodySmall,
      color: palette.textPrimary,
      fontWeight: '600',
    },
    historyTime: {
      ...typography.caption,
      color: palette.textSecondary,
      marginTop: 2,
    },
    historyAmount: {
      ...typography.bodySmall,
      color: palette.textPrimary,
      fontWeight: '600',
    },
    historyEmpty: {
      ...typography.bodySmall,
      color: palette.textSecondary,
      textAlign: 'center',
      paddingVertical: spacing.md,
    },
  });

export default WaterLogScreen;
