import React, { useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
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
} from '../utils/theme';

const formatCurrency = (value, currency) => {
  const amount = Number(value) || 0;
  const symbol = currency?.symbol || '$';
  const formatted = `${symbol}${Math.abs(amount).toLocaleString()}`;
  return amount < 0 ? `-${formatted}` : formatted;
};

const formatDateLabel = (dateValue) => {
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
};

const formatWindowLabel = (start, end) => {
  if (!start || !end) return 'Current period';
  const endDisplay = new Date(end.getTime() - 24 * 60 * 60 * 1000);
  return `${formatDateLabel(start)} - ${formatDateLabel(endDisplay)}`;
};

const getCategoryMeta = (id) =>
  expenseCategories.find((cat) => cat.id === id) || {
    id,
    name: id || 'Other',
    icon: 'tag',
  };

const BudgetGroupInsightScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const {
    budgetGroups,
    budgetAssignments,
    finances,
    getBudgetSpendForGroup,
    themeColors,
    ensureFinancesLoaded,
  } = useApp();
  const palette = themeColors || colors;
  const styles = useMemo(() => createStyles(palette), [palette]);

  useEffect(() => {
    ensureFinancesLoaded();
  }, [ensureFinancesLoaded]);

  const groupId = route.params?.groupId;
  const group = useMemo(
    () => budgetGroups.find((g) => g.id === groupId),
    [budgetGroups, groupId]
  );
  const currency = useMemo(
    () =>
      defaultCurrencies.find((c) => c.code === group?.currency) ||
      defaultCurrencies[0],
    [group?.currency]
  );

  const { spent, start, end } = useMemo(
    () => getBudgetSpendForGroup(group, new Date()),
    [group, getBudgetSpendForGroup]
  );
  const windowLabel = useMemo(
    () => formatWindowLabel(start, end),
    [start, end]
  );

  const groupTransactions = useMemo(() => {
    if (!group) return [];
    return finances
      .filter((t) => t.type === 'expense')
      .filter((t) => {
        const assigned = budgetAssignments?.[t.id] || [];
        return assigned.includes(group.id);
      })
      .sort(
        (a, b) =>
          new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt)
      );
  }, [finances, budgetAssignments, group]);

  const categoryBreakdown = useMemo(() => {
    const totals = {};
    groupTransactions.forEach((tx) => {
      const key = tx.category || 'other';
      totals[key] = (totals[key] || 0) + (Number(tx.amount) || 0);
    });
    const entries = Object.entries(totals).map(([id, value]) => {
      const meta = getCategoryMeta(id);
      return { ...meta, value };
    });
    const total = entries.reduce((sum, item) => sum + item.value, 0);
    return entries
      .sort((a, b) => b.value - a.value)
      .map((item) => ({
        ...item,
        percent: total ? Math.round((item.value / total) * 100) : 0,
      }));
  }, [groupTransactions]);

  const totalSpentAllTime = useMemo(
    () =>
      groupTransactions.reduce(
        (sum, tx) => sum + (Number(tx.amount) || 0),
        0
      ),
    [groupTransactions]
  );

  const target = Number(group?.target) || 0;
  const remaining = target ? target - spent : null;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={22} color={palette.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{group?.name || 'Budget group'}</Text>
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
        {!group ? (
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Budget group not found</Text>
            <Text style={styles.subduedText}>
              This group may have been removed. Try refreshing your data.
            </Text>
          </Card>
        ) : (
          <>
            <Card style={styles.summaryCard}>
              <Text style={styles.sectionTitle}>This period</Text>
              <Text style={styles.summaryAmount}>
                {formatCurrency(spent, currency)}
              </Text>
              <Text style={styles.subduedText}>{windowLabel}</Text>

              <View style={styles.summaryRow}>
                <View style={styles.summaryCell}>
                  <Text style={styles.subduedText}>Target</Text>
                  <Text style={styles.summaryLabel}>
                    {target
                      ? formatCurrency(target, currency)
                      : 'Tracking only'}
                  </Text>
                </View>
                <View style={styles.summaryCell}>
                  <Text style={styles.subduedText}>Remaining</Text>
                  <Text
                    style={[
                      styles.summaryLabel,
                      remaining !== null && remaining < 0
                        ? styles.negativeText
                        : null,
                    ]}
                  >
                    {remaining === null
                      ? '—'
                      : formatCurrency(remaining, currency)}
                  </Text>
                </View>
                <View style={styles.summaryCell}>
                  <Text style={styles.subduedText}>All-time</Text>
                  <Text style={styles.summaryLabel}>
                    {formatCurrency(totalSpentAllTime, currency)}
                  </Text>
                </View>
              </View>
            </Card>

            <Card style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Group categories</Text>
              <View style={styles.chipWrap}>
                {(group.categories || []).map((cat) => {
                  const meta = getCategoryMeta(cat);
                  return (
                    <View key={cat} style={styles.chip}>
                      <Feather
                        name={meta.icon}
                        size={14}
                        color={palette.text}
                        style={{ marginRight: spacing.xs }}
                      />
                      <Text style={styles.chipText}>{meta.name}</Text>
                    </View>
                  );
                })}
                {!group.categories?.length && (
                  <Text style={styles.subduedText}>
                    No categories linked to this group yet.
                  </Text>
                )}
              </View>
            </Card>

            <Card style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Spending breakdown</Text>
              {categoryBreakdown.length === 0 ? (
                <Text style={styles.subduedText}>
                  No expenses assigned to this group yet.
                </Text>
              ) : (
                categoryBreakdown.map((item) => (
                  <View key={item.id} style={styles.breakdownRow}>
                    <View style={styles.breakdownMeta}>
                      <View style={styles.iconBubble}>
                        <Feather
                          name={item.icon}
                          size={16}
                          color={palette.finance}
                        />
                      </View>
                      <Text style={styles.breakdownLabel}>{item.name}</Text>
                    </View>
                    <View style={styles.breakdownValues}>
                      <Text style={styles.breakdownAmount}>
                        {formatCurrency(item.value, currency)}
                      </Text>
                      <Text style={styles.subduedText}>{item.percent}%</Text>
                    </View>
                  </View>
                ))
              )}
            </Card>

            <Card style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Expenses in this group</Text>
              {groupTransactions.length === 0 ? (
                <Text style={styles.subduedText}>
                  Nothing logged here yet.
                </Text>
              ) : (
                groupTransactions.map((tx) => {
                  const meta = getCategoryMeta(tx.category);
                  return (
                    <View key={tx.id} style={styles.transactionRow}>
                      <View style={styles.iconBubble}>
                        <Feather
                          name={meta.icon}
                          size={16}
                          color={palette.finance}
                        />
                      </View>
                      <View style={styles.transactionContent}>
                        <Text style={styles.transactionTitle}>
                          {meta.name}
                        </Text>
                        <Text style={styles.subduedText}>
                          {formatDateLabel(tx.date || tx.createdAt)}
                        </Text>
                      </View>
                      <Text style={styles.transactionAmount}>
                        {formatCurrency(tx.amount, currency)}
                      </Text>
                    </View>
                  );
                })
              )}
            </Card>
          </>
        )}
      </PlatformScrollView>
    </View>
  );
};

const createStyles = (palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: palette.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.lg,
    },
    backButton: { padding: spacing.xs },
    headerTitle: { ...typography.h2, color: palette.text },
    headerSpacer: { width: 32 },
    scroll: { flex: 1 },
    scrollContent: {
      paddingHorizontal: spacing.xl,
      gap: spacing.md,
    },
    summaryCard: {
      padding: spacing.lg,
    },
    sectionCard: {
      padding: spacing.lg,
    },
    sectionTitle: {
      ...typography.h3,
      color: palette.text,
      marginBottom: spacing.sm,
    },
    summaryAmount: {
      ...typography.h2,
      color: palette.finance,
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: spacing.md,
    },
    summaryCell: { flex: 1 },
    summaryLabel: {
      ...typography.body,
      color: palette.text,
      fontWeight: '700',
    },
    negativeText: { color: colors.danger },
    chipWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
      backgroundColor: palette.inputBackground,
      borderRadius: borderRadius.full,
    },
    chipText: { ...typography.caption, color: palette.text },
    breakdownRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderColor: palette.divider,
    },
    breakdownMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      flex: 1,
    },
    breakdownLabel: {
      ...typography.body,
      color: palette.text,
    },
    breakdownValues: { alignItems: 'flex-end' },
    breakdownAmount: {
      ...typography.body,
      fontWeight: '700',
      color: palette.text,
    },
    iconBubble: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: palette.inputBackground,
      alignItems: 'center',
      justifyContent: 'center',
    },
    transactionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderColor: palette.divider,
      gap: spacing.sm,
    },
    transactionContent: { flex: 1 },
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
    subduedText: {
      ...typography.caption,
      color: palette.textSecondary,
    },
  });

export default BudgetGroupInsightScreen;
