import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { supabase } from '../utils/supabaseClient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { Card, Modal, Button, Input, ChipGroup } from '../components';
import {
  colors,
  shadows,
  borderRadius,
  spacing,
  typography,
  incomeCategories,
  expenseCategories,
  defaultCurrencies,
} from '../utils/theme';

const FinanceScreen = () => {
  const insets = useSafeAreaInsets();
  const {
    finances,
    addTransaction,
    deleteTransaction,
    getTransactionsForDate,
    getFinanceSummaryForDate,
  } = useApp();

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showIncomeModal, setShowIncomeModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showChartModal, setShowChartModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  // Transaction form state
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState(defaultCurrencies[0]);
  const [transactionDate, setTransactionDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [note, setNote] = useState('');

  const formatDateForInput = (date) =>
    new Date(date).toISOString().split('T')[0];

  const dailySummary = useMemo(() => {
    return getFinanceSummaryForDate(selectedDate);
  }, [finances, selectedDate]);

  const dayTransactions = useMemo(() => {
    return getTransactionsForDate(selectedDate);
  }, [finances, selectedDate]);

  const resetForm = () => {
    setAmount('');
    setCategory('');
    setCustomCategory('');
    setNote('');
    setTransactionDate(formatDateForInput(selectedDate));
  };

  const handleAddIncome = async () => {
    if (!amount || !category) return;

    await addTransaction({
      type: 'income',
      amount: parseFloat(amount),
      category: category === 'custom' ? customCategory : category,
      currency: selectedCurrency.code,
      date: transactionDate,
      note,
    });

    resetForm();
    setShowIncomeModal(false);
  };

  const handleAddExpense = async () => {
    if (!amount || !category) return;

    await addTransaction({
      type: 'expense',
      amount: parseFloat(amount),
      category: category === 'custom' ? customCategory : category,
      currency: selectedCurrency.code,
      date: transactionDate,
      note,
    });

    resetForm();
    setShowExpenseModal(false);
  };

  const formatCurrency = (value, showSign = false) => {
    const formatted = `${selectedCurrency.symbol}${Math.abs(value).toLocaleString()}`;
    if (showSign && value !== 0) {
      return value > 0 ? `+${formatted}` : `-${formatted}`;
    }
    return formatted;
  };

  const formatDate = (dateValue) => {
    const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  };

  const getCategoryIcon = (categoryName, type) => {
    const categories = type === 'income' ? incomeCategories : expenseCategories;
    const found = categories.find((c) => c.id === categoryName || c.name === categoryName);
    return found?.icon || 'help-circle';
  };

  // Simple bar chart data (last 7 days)
  const chartData = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toDateString();
      const dayTransactions = finances.filter(
        (t) => new Date(t.date).toDateString() === dateStr
      );
      const income = dayTransactions
        .filter((t) => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
      const expenses = dayTransactions
        .filter((t) => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);
      days.push({
        date: date.toLocaleDateString('en-US', { weekday: 'short' }),
        income,
        expenses,
      });
    }
    return days;
  }, [finances]);

  const maxChartValue = Math.max(
    ...chartData.map((d) => Math.max(d.income, d.expenses)),
    1
  );

  const shiftSelectedDate = (days) => {
    setSelectedDate((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + days);
      return next;
    });
    setCalendarMonth((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + days);
      next.setDate(1);
      return next;
    });
  };

  const handleOpenIncome = () => {
    setTransactionDate(formatDateForInput(selectedDate));
    setShowIncomeModal(true);
  };

  const handleOpenExpense = () => {
    setTransactionDate(formatDateForInput(selectedDate));
    setShowExpenseModal(true);
  };

  const handleMonthShift = (delta) => {
    setCalendarMonth((prev) => {
      const next = new Date(prev);
      next.setMonth(next.getMonth() + delta);
      return next;
    });
  };

  const handleSelectFromCalendar = (date) => {
    setSelectedDate(date);
    setTransactionDate(formatDateForInput(date));
    setShowDatePicker(false);
  };

  const getMonthMatrix = (monthDate) => {
    const start = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const end = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
    const startDay = start.getDay();
    const daysInMonth = end.getDate();
    const days = [];

    // previous month padding
    for (let i = 0; i < startDay; i++) {
      days.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      days.push(new Date(monthDate.getFullYear(), monthDate.getMonth(), d));
    }
    while (days.length % 7 !== 0) {
      days.push(null);
    }
    const weeks = [];
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7));
    }
    return weeks;
  };

  const monthMatrix = getMonthMatrix(calendarMonth);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Finances</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Date Picker */}
        <View style={styles.dateRow}>
          <TouchableOpacity
            style={styles.dateArrow}
            onPress={() => shiftSelectedDate(-1)}
          >
            <Ionicons name="chevron-back" size={20} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.datePicker}
            activeOpacity={0.85}
            onPress={() => setShowDatePicker(true)}
          >
            <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
            <Text style={styles.dateText}>{formatDate(selectedDate)}</Text>
            <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dateArrow}
            onPress={() => shiftSelectedDate(1)}
          >
            <Ionicons name="chevron-forward" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionButton, styles.incomeButton]}
            onPress={handleOpenIncome}
          >
            <Ionicons name="add-circle" size={20} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>Record Income</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.expenseButton]}
            onPress={handleOpenExpense}
          >
            <Ionicons name="remove-circle" size={20} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>Record Expense</Text>
          </TouchableOpacity>
        </View>

        {/* Balance Card */}
        <Card
          style={styles.balanceCard}
          onPress={() => setShowChartModal(true)}
        >
          <View style={styles.balanceHeader}>
            <Text style={styles.balanceLabel}>Total Balance</Text>
            <Ionicons name="bar-chart-outline" size={20} color={colors.primary} />
          </View>
          <Text
            style={[
              styles.balanceAmount,
              dailySummary.balance < 0 && styles.balanceNegative,
            ]}
          >
            {formatCurrency(dailySummary.balance)}
          </Text>
          <View style={styles.balanceSummary}>
            <View style={styles.summaryItem}>
              <View style={[styles.summaryDot, { backgroundColor: colors.income }]} />
              <Text style={styles.summaryLabel}>Income</Text>
              <Text style={styles.summaryValue}>{formatCurrency(dailySummary.income)}</Text>
            </View>
            <View style={styles.summaryItem}>
              <View style={[styles.summaryDot, { backgroundColor: colors.expense }]} />
              <Text style={styles.summaryLabel}>Expenses</Text>
              <Text style={styles.summaryValue}>{formatCurrency(dailySummary.expenses)}</Text>
            </View>
          </View>
        </Card>

        {/* Transactions List */}
        <Card style={styles.transactionsCard}>
          <Text style={styles.sectionTitle}>Transactions</Text>
          {dayTransactions.length === 0 ? (
            <View style={styles.emptyState}>
              <Feather name="dollar-sign" size={40} color={colors.primaryLight} />
              <Text style={styles.emptyText}>No transactions for this date</Text>
            </View>
          ) : (
            dayTransactions
              .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
              .map((transaction) => (
                <TouchableOpacity
                  key={transaction.id}
                  style={styles.transactionItem}
                  onPress={() => deleteTransaction(transaction.id)}
                >
                  <View
                    style={[
                      styles.transactionIcon,
                      {
                        backgroundColor:
                          transaction.type === 'income'
                            ? `${colors.income}15`
                            : `${colors.expense}15`,
                      },
                    ]}
                  >
                    <Feather
                      name={getCategoryIcon(transaction.category, transaction.type)}
                      size={18}
                      color={
                        transaction.type === 'income' ? colors.income : colors.expense
                      }
                    />
                  </View>
                  <View style={styles.transactionContent}>
                    <Text style={styles.transactionCategory}>
                      {transaction.category}
                    </Text>
                    <Text style={styles.transactionDate}>
                      {formatDate(transaction.date)}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.transactionAmount,
                      transaction.type === 'income'
                        ? styles.incomeAmount
                        : styles.expenseAmount,
                    ]}
                  >
                    {transaction.type === 'income' ? '+' : '-'}
                    {selectedCurrency.symbol}
                    {transaction.amount.toLocaleString()}
                  </Text>
                </TouchableOpacity>
              ))
          )}
        </Card>
      </ScrollView>

      {/* Income Modal */}
      <Modal
        visible={showIncomeModal}
        onClose={() => {
          setShowIncomeModal(false);
          resetForm();
        }}
        title="Record Income"
      >
        <Text style={styles.inputLabel}>Amount</Text>
        <View style={styles.amountInputContainer}>
          <Text style={styles.currencySymbol}>{selectedCurrency.symbol}</Text>
          <TextInput
            style={styles.amountInput}
            value={amount}
            onChangeText={setAmount}
            placeholder="0"
            placeholderTextColor={colors.placeholder}
            keyboardType="decimal-pad"
          />
        </View>

        <Text style={styles.inputLabel}>Category</Text>
        <View style={styles.categoryGrid}>
          {incomeCategories.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.categoryOption,
                category === cat.id && styles.categoryOptionActive,
              ]}
              onPress={() => setCategory(cat.id)}
            >
              <Feather
                name={cat.icon}
                size={20}
                color={category === cat.id ? colors.primary : colors.textSecondary}
              />
              <Text
                style={[
                  styles.categoryLabel,
                  category === cat.id && styles.categoryLabelActive,
                ]}
              >
                {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.modalButtons}>
          <Button
            title="Cancel"
            variant="secondary"
            onPress={() => {
              setShowIncomeModal(false);
              resetForm();
            }}
            style={styles.modalButton}
          />
          <Button
            title="Add Income"
            variant="success"
            onPress={handleAddIncome}
            disabled={!amount || !category}
            style={styles.modalButton}
          />
        </View>
      </Modal>

      {/* Expense Modal */}
      <Modal
        visible={showExpenseModal}
        onClose={() => {
          setShowExpenseModal(false);
          resetForm();
        }}
        title="Record Expense"
      >
        <Text style={styles.inputLabel}>Amount</Text>
        <View style={styles.amountInputContainer}>
          <Text style={styles.currencySymbol}>{selectedCurrency.symbol}</Text>
          <TextInput
            style={styles.amountInput}
            value={amount}
            onChangeText={setAmount}
            placeholder="0"
            placeholderTextColor={colors.placeholder}
            keyboardType="decimal-pad"
          />
        </View>

        <Text style={styles.inputLabel}>Category</Text>
        <View style={styles.categoryGrid}>
          {expenseCategories.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.categoryOption,
                category === cat.id && styles.categoryOptionActive,
              ]}
              onPress={() => setCategory(cat.id)}
            >
              <Feather
                name={cat.icon}
                size={20}
                color={category === cat.id ? colors.primary : colors.textSecondary}
              />
              <Text
                style={[
                  styles.categoryLabel,
                  category === cat.id && styles.categoryLabelActive,
                ]}
              >
                {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.modalButtons}>
          <Button
            title="Cancel"
            variant="secondary"
            onPress={() => {
              setShowExpenseModal(false);
              resetForm();
            }}
            style={styles.modalButton}
          />
          <Button
            title="Add Expense"
            variant="danger"
            onPress={handleAddExpense}
            disabled={!amount || !category}
            style={styles.modalButton}
          />
        </View>
      </Modal>

      {/* Chart Modal */}
      <Modal
        visible={showChartModal}
        onClose={() => setShowChartModal(false)}
        title="Weekly Overview"
      >
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
              <View style={[styles.legendDot, { backgroundColor: colors.income }]} />
              <Text style={styles.legendText}>Income</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.expense }]} />
              <Text style={styles.legendText}>Expenses</Text>
            </View>
          </View>
        </View>

        <Button
          title="Close"
          variant="secondary"
          onPress={() => setShowChartModal(false)}
          style={styles.closeChartButton}
        />
      </Modal>

      {/* Date Picker Modal */}
      <Modal
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        title="Select Date"
      >
        <View style={styles.calendarHeader}>
          <TouchableOpacity
            style={styles.calendarNav}
            onPress={() => handleMonthShift(-1)}
          >
            <Ionicons name="chevron-back" size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.calendarTitle}>
            {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </Text>
          <TouchableOpacity
            style={styles.calendarNav}
            onPress={() => handleMonthShift(1)}
          >
            <Ionicons name="chevron-forward" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.weekDays}>
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
            <Text key={`${day}-${idx}`} style={styles.weekDayLabel}>
              {day}
            </Text>
          ))}
        </View>

        {monthMatrix.map((week, idx) => (
          <View key={idx} style={styles.weekRow}>
            {week.map((day, dayIdx) => {
              const isSelected =
                day &&
                day.toDateString() === new Date(selectedDate).toDateString();
              return (
                <TouchableOpacity
                  key={dayIdx}
                  style={[
                    styles.dayCell,
                    isSelected && styles.dayCellSelected,
                    !day && styles.dayCellEmpty,
                  ]}
                  disabled={!day}
                  onPress={() => day && handleSelectFromCalendar(day)}
                  activeOpacity={day ? 0.8 : 1}
                >
                  {day && (
                    <Text
                      style={[
                        styles.dayLabel,
                        isSelected && styles.dayLabelSelected,
                      ]}
                    >
                      {day.getDate()}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
  },
  headerTitle: {
    ...typography.h2,
    textAlign: 'center',
    flex: 1,
  },
  headerSpacer: {
    width: 32,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
    justifyContent: 'center',
    columnGap: spacing.sm,
  },
  dateArrow: {
    padding: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.inputBackground,
  },
  datePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.inputBackground,
    marginHorizontal: spacing.md,
    justifyContent: 'center',
  },
  dateText: {
    ...typography.body,
    marginHorizontal: spacing.sm,
  },
  actionRow: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    marginHorizontal: spacing.xs,
  },
  incomeButton: {
    backgroundColor: colors.income,
  },
  expenseButton: {
    backgroundColor: colors.expense,
  },
  actionButtonText: {
    ...typography.body,
    color: '#FFFFFF',
    fontWeight: '600',
    marginLeft: spacing.sm,
  },
  balanceCard: {
    backgroundColor: colors.primary,
    marginBottom: spacing.lg,
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  balanceLabel: {
    ...typography.bodySmall,
    color: 'rgba(255,255,255,0.8)',
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: spacing.md,
  },
  balanceNegative: {
    color: '#FFCDD2',
  },
  balanceSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.xs,
  },
  summaryLabel: {
    ...typography.bodySmall,
    color: 'rgba(255,255,255,0.8)',
    marginRight: spacing.sm,
  },
  summaryValue: {
    ...typography.body,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  transactionsCard: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.h3,
    marginBottom: spacing.md,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyText: {
    ...typography.bodySmall,
    color: colors.textLight,
    marginTop: spacing.md,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  transactionContent: {
    flex: 1,
  },
  transactionCategory: {
    ...typography.body,
    fontWeight: '500',
  },
  transactionDate: {
    ...typography.caption,
    color: colors.textLight,
  },
  transactionAmount: {
    ...typography.body,
    fontWeight: '600',
  },
  incomeAmount: {
    color: colors.income,
  },
  expenseAmount: {
    color: colors.expense,
  },
  inputLabel: {
    ...typography.label,
    marginBottom: spacing.sm,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  currencySymbol: {
    ...typography.h2,
    color: colors.textSecondary,
    marginRight: spacing.sm,
  },
  amountInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '600',
    paddingVertical: spacing.md,
    color: colors.text,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: spacing.lg,
  },
  categoryOption: {
    width: '30%',
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginRight: '3%',
    marginBottom: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.inputBackground,
  },
  categoryOptionActive: {
    backgroundColor: colors.primaryLight,
  },
  categoryLabel: {
    ...typography.caption,
    marginTop: spacing.xs,
    color: colors.textSecondary,
  },
  categoryLabelActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  modalButtons: {
    flexDirection: 'row',
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  modalButton: {
    flex: 1,
    marginHorizontal: spacing.xs,
  },
  chartContainer: {
    paddingVertical: spacing.lg,
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
    backgroundColor: colors.income,
  },
  expenseBar: {
    backgroundColor: colors.expense,
  },
  chartLabel: {
    ...typography.caption,
  },
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.md,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: spacing.xs,
  },
  legendText: {
    ...typography.bodySmall,
  },
  closeChartButton: {
    marginBottom: spacing.lg,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  calendarTitle: {
    ...typography.h3,
  },
  calendarNav: {
    padding: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.inputBackground,
  },
  weekDays: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  weekDayLabel: {
    ...typography.caption,
    width: `${100 / 7}%`,
    textAlign: 'center',
    color: colors.textSecondary,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  dayCell: {
    width: `${100 / 7 - 2}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
    backgroundColor: colors.inputBackground,
  },
  dayCellEmpty: {
    backgroundColor: 'transparent',
  },
  dayCellSelected: {
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  dayLabel: {
    ...typography.body,
    color: colors.text,
  },
  dayLabelSelected: {
    color: colors.primary,
    fontWeight: '700',
  },
});

export default FinanceScreen;
