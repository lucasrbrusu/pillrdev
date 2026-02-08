import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { G, Path, Circle } from 'react-native-svg';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { Card, PlatformScrollView } from '../components';
import { useApp } from '../context/AppContext';
import {
  colors,
  spacing,
  typography,
  borderRadius,
  expenseCategories,
  defaultCurrencies,
  shadows,
} from '../utils/theme';

const categoryPalette = [
  '#10B981',
  '#EF4444',
  '#6366F1',
  '#F59E0B',
  '#EC4899',
  '#3B82F6',
  '#9CA3AF',
  '#14B8A6',
];

const polarToCartesian = (centerX, centerY, radius, angleInDegrees) => {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
};

const describeArc = (x, y, radius, startAngle, endAngle) => {
  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  return [
    'M',
    x,
    y,
    'L',
    start.x,
    start.y,
    'A',
    radius,
    radius,
    0,
    largeArcFlag,
    0,
    end.x,
    end.y,
    'Z',
  ].join(' ');
};

const PieChart = ({ data, size = 180, fillColor }) => {
  const radius = size / 2;
  const total = data.reduce((sum, item) => sum + (Number(item.value) || 0), 0);

  if (!total) {
    return (
      <View style={{ alignItems: 'center', justifyContent: 'center', height: size }}>
        <Text style={typography.bodySmall}>No expenses to chart</Text>
      </View>
    );
  }

  let startAngle = 0;
  const slices = data.map((item) => {
    const angle = (Number(item.value) / total) * 360;
    const slice = {
      ...item,
      startAngle,
      endAngle: startAngle + angle,
    };
    startAngle += angle;
    return slice;
  });

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <G x={0} y={0}>
        <Circle cx={radius} cy={radius} r={radius} fill={fillColor} />
        {slices.map((slice, idx) => (
          <Path
            key={`${slice.label}-${idx}`}
            d={describeArc(radius, radius, radius, slice.startAngle, slice.endAngle)}
            fill={slice.color}
          />
        ))}
      </G>
    </Svg>
  );
};

const formatDateLabel = (dateValue) => {
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
};

const SpendingInsightsScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { finances, userSettings, themeColors, themeName, ensureFinancesLoaded } =
    useApp();

  const palette = themeColors || colors;
  const isDark =
    (themeName || '').toLowerCase() === 'dark' || palette.background === '#000000';
  const styles = useMemo(() => createStyles(palette, isDark), [palette, isDark]);

  useEffect(() => {
    ensureFinancesLoaded();
  }, [ensureFinancesLoaded]);

  const selectedDate = useMemo(() => {
    const param = route.params?.selectedDate;
    if (!param) return new Date();
    const parsed = new Date(param);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }, [route.params?.selectedDate]);

  const preferredCurrency = useMemo(
    () =>
      defaultCurrencies.find(
        (c) => c.code === userSettings?.defaultCurrencyCode
      ) || defaultCurrencies[0],
    [userSettings?.defaultCurrencyCode]
  );

  const currencyForCode = (code) =>
    defaultCurrencies.find((c) => c.code === code) || preferredCurrency;

  const formatCurrency = (value, currencyCode) => {
    const currency = currencyForCode(currencyCode);
    const amount = Number(value) || 0;
    const formatted = `${currency.symbol}${Math.abs(amount).toLocaleString()}`;
    return amount < 0 ? `-${formatted}` : formatted;
  };

  const monthStart = useMemo(() => {
    const target = new Date(selectedDate);
    return new Date(target.getFullYear(), target.getMonth(), 1);
  }, [selectedDate]);

  const nextMonthStart = useMemo(() => {
    return new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);
  }, [monthStart]);

  const monthWindowLabel = useMemo(() => {
    const endDisplay = new Date(nextMonthStart.getTime() - 24 * 60 * 60 * 1000);
    return `${formatDateLabel(monthStart)} - ${formatDateLabel(endDisplay)}`;
  }, [monthStart, nextMonthStart]);

  const monthlyTransactions = useMemo(() => {
    return finances.filter((t) => {
      const ts = new Date(t.date || t.createdAt);
      return ts >= monthStart && ts < nextMonthStart;
    });
  }, [finances, monthStart, nextMonthStart]);

  const monthlyIncome = useMemo(
    () =>
      monthlyTransactions
        .filter((t) => t.type === 'income')
        .reduce((sum, t) => sum + (Number(t.amount) || 0), 0),
    [monthlyTransactions]
  );

  const monthlyExpenses = useMemo(
    () =>
      monthlyTransactions
        .filter((t) => t.type === 'expense')
        .reduce((sum, t) => sum + (Number(t.amount) || 0), 0),
    [monthlyTransactions]
  );

  const expenseCount = useMemo(
    () => monthlyTransactions.filter((t) => t.type === 'expense').length,
    [monthlyTransactions]
  );

  const expenseBreakdown = useMemo(() => {
    const totals = {};
    monthlyTransactions
      .filter((t) => t.type === 'expense')
      .forEach((t) => {
        const key = t.category || 'other';
        totals[key] = (totals[key] || 0) + (Number(t.amount) || 0);
      });
    return Object.entries(totals)
      .sort((a, b) => b[1] - a[1])
      .map(([label, value], idx) => ({
        label,
        value,
        color: categoryPalette[idx % categoryPalette.length],
      }));
  }, [monthlyTransactions]);

  const totalExpenses = useMemo(
    () => expenseBreakdown.reduce((sum, item) => sum + item.value, 0),
    [expenseBreakdown]
  );

  const averageExpense = expenseCount ? monthlyExpenses / expenseCount : 0;

  const averageDailySpend = useMemo(() => {
    const dayMs = 24 * 60 * 60 * 1000;
    const endDate = new Date(
      Math.min(selectedDate.getTime(), nextMonthStart.getTime() - 1)
    );
    const days = Math.max(
      1,
      Math.floor((endDate - monthStart) / dayMs) + 1
    );
    return monthlyExpenses / days;
  }, [monthStart, nextMonthStart, monthlyExpenses, selectedDate]);

  const highestSpendDay = useMemo(() => {
    const totals = {};
    monthlyTransactions
      .filter((t) => t.type === 'expense')
      .forEach((t) => {
        const dateKey = new Date(t.date || t.createdAt).toDateString();
        totals[dateKey] = (totals[dateKey] || 0) + (Number(t.amount) || 0);
      });
    const entries = Object.entries(totals);
    if (!entries.length) return null;
    return entries.reduce((max, entry) =>
      entry[1] > max[1] ? entry : max
    );
  }, [monthlyTransactions]);

  const largestExpenses = useMemo(() => {
    return monthlyTransactions
      .filter((t) => t.type === 'expense')
      .sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0))
      .slice(0, 6);
  }, [monthlyTransactions]);

  const weekLabel = useMemo(() => {
    const start = new Date(selectedDate);
    start.setDate(start.getDate() - 6);
    return `${formatDateLabel(start)} - ${formatDateLabel(selectedDate)}`;
  }, [selectedDate]);

  const chartData = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(selectedDate);
      date.setDate(date.getDate() - i);
      const dateStr = date.toDateString();
      const dayTransactions = finances.filter(
        (t) => new Date(t.date || t.createdAt).toDateString() === dateStr
      );
      const income = dayTransactions
        .filter((t) => t.type === 'income')
        .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
      const expenses = dayTransactions
        .filter((t) => t.type === 'expense')
        .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
      days.push({
        date: date.toLocaleDateString('en-US', { weekday: 'short' }),
        income,
        expenses,
      });
    }
    return days;
  }, [finances, selectedDate]);

  const maxChartValue = Math.max(
    ...chartData.map((d) => Math.max(d.income, d.expenses)),
    1
  );

  const getCategoryMeta = (categoryId) =>
    expenseCategories.find((cat) => cat.id === categoryId) || {
      id: categoryId,
      name: categoryId || 'Other',
      icon: 'tag',
    };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={22} color={palette.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Spending insights</Text>
        <View style={styles.headerSpacer} />
      </View>

      <PlatformScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Card style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <View>
              <Text style={styles.sectionTitle}>This month</Text>
              <Text style={styles.subduedText}>{monthWindowLabel}</Text>
            </View>
            <View style={styles.summaryRight}>
              <Text style={styles.summaryLabel}>Net</Text>
              <Text
                style={[
                  styles.summaryAmount,
                  monthlyIncome - monthlyExpenses < 0 && styles.negativeText,
                ]}
              >
                {formatCurrency(monthlyIncome - monthlyExpenses)}
              </Text>
            </View>
          </View>

          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Income</Text>
              <Text style={styles.summaryValue}>
                {formatCurrency(monthlyIncome)}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Expenses</Text>
              <Text style={styles.summaryValue}>
                {formatCurrency(monthlyExpenses)}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Avg daily</Text>
              <Text style={styles.summaryValue}>
                {formatCurrency(averageDailySpend)}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Avg expense</Text>
              <Text style={styles.summaryValue}>
                {formatCurrency(averageExpense)}
              </Text>
            </View>
          </View>

          <View style={styles.summaryFooter}>
            <View>
              <Text style={styles.subduedText}>Highest spend day</Text>
              <Text style={styles.summaryValue}>
                {highestSpendDay
                  ? `${formatDateLabel(new Date(highestSpendDay[0]))} (${formatCurrency(
                      highestSpendDay[1]
                    )})`
                  : 'No expenses yet'}
              </Text>
            </View>
            <View style={styles.summaryRight}>
              <Text style={styles.subduedText}>Total expenses</Text>
              <Text style={styles.summaryValue}>
                {formatCurrency(totalExpenses)}
              </Text>
            </View>
          </View>
        </Card>

        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Weekly overview</Text>
            <Text style={styles.subduedText}>{weekLabel}</Text>
          </View>
          <View style={styles.chartContainer}>
            <View style={styles.chartBars}>
              {chartData.map((day, index) => (
                <View key={index} style={styles.chartDay}>
                  <View style={styles.barContainer}>
                    <View
                      style={[
                        styles.bar,
                        styles.incomeBar,
                        { height: (day.income / maxChartValue) * 100 || 2 },
                      ]}
                    />
                    <View
                      style={[
                        styles.bar,
                        styles.expenseBar,
                        { height: (day.expenses / maxChartValue) * 100 || 2 },
                      ]}
                    />
                  </View>
                  <Text style={styles.chartLabel}>{day.date}</Text>
                </View>
              ))}
            </View>
            <View style={styles.chartLegend}>
              <View style={styles.legendItem}>
                <View
                  style={[styles.legendDot, { backgroundColor: palette.income }]}
                />
                <Text style={styles.legendText}>Income</Text>
              </View>
              <View style={styles.legendItem}>
                <View
                  style={[styles.legendDot, { backgroundColor: palette.expense }]}
                />
                <Text style={styles.legendText}>Expenses</Text>
              </View>
            </View>
          </View>
        </Card>

        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Top categories</Text>
          {expenseBreakdown.length === 0 ? (
            <Text style={styles.subduedText}>
              Add expenses to see a breakdown.
            </Text>
          ) : (
            <>
              <View style={styles.pieRow}>
                <PieChart
                  data={expenseBreakdown}
                  size={170}
                  fillColor={palette.card}
                />
                <View style={styles.legendColumn}>
                  {expenseBreakdown.slice(0, 5).map((item) => (
                    <View key={item.label} style={styles.legendItem}>
                      <View
                        style={[
                          styles.legendDot,
                          { backgroundColor: item.color },
                        ]}
                      />
                      <View style={styles.legendTextWrap}>
                        <Text style={styles.legendLabel}>{item.label}</Text>
                        <Text style={styles.subduedText}>
                          {formatCurrency(item.value)}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
              <View style={styles.categoryList}>
                {expenseBreakdown.slice(0, 6).map((item) => {
                  const percent = totalExpenses
                    ? Math.round((item.value / totalExpenses) * 100)
                    : 0;
                  const meta = getCategoryMeta(item.label);
                  return (
                    <View key={item.label} style={styles.categoryRow}>
                      <View style={styles.categoryMeta}>
                        <View style={styles.categoryIcon}>
                          <Feather
                            name={meta.icon}
                            size={14}
                            color={palette.text}
                          />
                        </View>
                        <View>
                          <Text style={styles.categoryLabel}>{meta.name}</Text>
                          <Text style={styles.subduedText}>{percent}%</Text>
                        </View>
                      </View>
                      <View style={styles.categoryValues}>
                        <Text style={styles.categoryAmount}>
                          {formatCurrency(item.value)}
                        </Text>
                        <View style={styles.categoryBar}>
                          <View
                            style={[
                              styles.categoryFill,
                              { width: `${percent}%`, backgroundColor: item.color },
                            ]}
                          />
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            </>
          )}
        </Card>

        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Largest expenses</Text>
          {largestExpenses.length === 0 ? (
            <Text style={styles.subduedText}>
              No expenses logged for this month.
            </Text>
          ) : (
            largestExpenses.map((tx) => {
              const meta = getCategoryMeta(tx.category);
              return (
                <View key={tx.id} style={styles.transactionRow}>
                  <View style={styles.transactionIcon}>
                    <Feather name={meta.icon} size={16} color={palette.finance} />
                  </View>
                  <View style={styles.transactionContent}>
                    <Text style={styles.transactionTitle}>
                      {tx.note || meta.name}
                    </Text>
                    <Text style={styles.subduedText}>
                      {formatDateLabel(tx.date || tx.createdAt)} - {meta.name}
                    </Text>
                  </View>
                  <Text style={styles.transactionAmount}>
                    {formatCurrency(tx.amount, tx.currency)}
                  </Text>
                </View>
              );
            })
          )}
        </Card>
      </PlatformScrollView>
    </View>
  );
};

const createStyles = (palette, isDark) => {
  const pageBackground = isDark ? palette.background : '#F5F6FF';
  const surfaceAlt = isDark ? '#171B26' : '#EEF2FF';
  const surfaceBorder = isDark ? '#232838' : '#E1E6FF';
  const subduedText = isDark ? '#B5BAC7' : palette.textSecondary;

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: pageBackground,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.lg,
    },
    backButton: {
      padding: spacing.xs,
    },
    headerTitle: {
      ...typography.h2,
      color: palette.text,
    },
    headerSpacer: {
      width: 32,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: spacing.xl,
      gap: spacing.lg,
    },
    summaryCard: {
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: surfaceBorder,
      backgroundColor: palette.card,
      ...shadows.medium,
    },
    summaryHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: spacing.md,
    },
    summaryRight: {
      alignItems: 'flex-end',
    },
    summaryAmount: {
      ...typography.h3,
      color: palette.finance,
    },
    summaryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
      marginBottom: spacing.md,
    },
    summaryItem: {
      width: '47%',
      padding: spacing.md,
      borderRadius: borderRadius.md,
      backgroundColor: surfaceAlt,
      borderWidth: 1,
      borderColor: surfaceBorder,
    },
    summaryLabel: {
      ...typography.caption,
      color: subduedText,
      marginBottom: spacing.xs,
    },
    summaryValue: {
      ...typography.body,
      color: palette.text,
      fontWeight: '600',
    },
    summaryFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: spacing.sm,
    },
    negativeText: {
      color: colors.danger,
    },
    sectionCard: {
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: surfaceBorder,
      backgroundColor: palette.card,
    },
    sectionTitle: {
      ...typography.h3,
      color: palette.text,
      marginBottom: spacing.sm,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    subduedText: {
      ...typography.caption,
      color: subduedText,
    },
    chartContainer: {
      paddingVertical: spacing.md,
    },
    chartBars: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      height: 120,
      marginBottom: spacing.md,
    },
    chartDay: {
      flex: 1,
      alignItems: 'center',
    },
    barContainer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      marginBottom: spacing.xs,
    },
    bar: {
      width: 12,
      marginHorizontal: 2,
      borderRadius: 4,
      minHeight: 2,
    },
    incomeBar: {
      backgroundColor: palette.income,
    },
    expenseBar: {
      backgroundColor: palette.expense,
    },
    chartLabel: {
      ...typography.caption,
      color: subduedText,
    },
    chartLegend: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginTop: spacing.md,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: spacing.sm,
      gap: spacing.xs,
    },
    legendDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    legendText: {
      ...typography.bodySmall,
      color: palette.text,
    },
    pieRow: {
      flexDirection: 'row',
      gap: spacing.md,
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    legendColumn: {
      flex: 1,
      gap: spacing.sm,
    },
    legendTextWrap: {
      flex: 1,
    },
    legendLabel: {
      ...typography.body,
      color: palette.text,
    },
    categoryList: {
      marginTop: spacing.md,
      gap: spacing.md,
    },
    categoryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    categoryMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      flex: 1,
    },
    categoryIcon: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: surfaceAlt,
      borderWidth: 1,
      borderColor: surfaceBorder,
    },
    categoryLabel: {
      ...typography.body,
      color: palette.text,
    },
    categoryValues: {
      alignItems: 'flex-end',
      minWidth: 120,
    },
    categoryAmount: {
      ...typography.bodySmall,
      color: palette.text,
      fontWeight: '600',
      marginBottom: spacing.xs,
    },
    categoryBar: {
      height: 6,
      width: 120,
      borderRadius: borderRadius.full,
      backgroundColor: surfaceAlt,
      overflow: 'hidden',
    },
    categoryFill: {
      height: '100%',
      borderRadius: borderRadius.full,
    },
    transactionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: surfaceBorder,
      gap: spacing.sm,
    },
    transactionIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    transactionContent: {
      flex: 1,
    },
    transactionTitle: {
      ...typography.body,
      color: palette.text,
      fontWeight: '600',
    },
    transactionAmount: {
      ...typography.body,
      fontWeight: '700',
      color: palette.finance,
    },
  });
};

export default SpendingInsightsScreen;
