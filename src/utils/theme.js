// Pillaflow App Theme Configuration

export const colors = {
  // Base colors
  background: '#FFFFFF',
  card: '#FFFFFF',
  text: '#1A1A2E',
  textSecondary: '#6B7280',
  textLight: '#9CA3AF',
  
  // Primary accent
  primary: '#9B59B6',
  primaryLight: '#E9D5F5',
  primaryGradientStart: '#9B59B6',
  primaryGradientEnd: '#8E44AD',
  
  // Section colors
  habits: '#9B59B6',
  tasks: '#6366F1',
  health: '#EC4899',
  routine: '#F59E0B',
  finance: '#10B981',
  
  // Status colors
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#3B82F6',
  
  // Priority colors
  priorityLow: '#E5E7EB',
  priorityMedium: '#FCD34D',
  priorityHigh: '#FCA5A5',
  
  // UI elements
  border: '#E5E7EB',
  divider: '#F3F4F6',
  inputBackground: '#F9FAFB',
  placeholder: '#9CA3AF',
  
  // Shadows
  shadowColor: '#000000',
  
  // Navigation
  navBackground: '#FFFFFF',
  navInactive: '#9CA3AF',
  navActive: '#9B59B6',
  
  // Income/Expense
  income: '#22C55E',
  expense: '#EF4444',
};

export const shadows = {
  small: {
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  medium: {
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  large: {
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 9999,
};

export const typography = {
  h1: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
  },
  h2: {
    fontSize: 22,
    fontWeight: '600',
    color: colors.text,
  },
  h3: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  body: {
    fontSize: 16,
    fontWeight: '400',
    color: colors.text,
  },
  bodySmall: {
    fontSize: 14,
    fontWeight: '400',
    color: colors.textSecondary,
  },
  caption: {
    fontSize: 12,
    fontWeight: '400',
    color: colors.textLight,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
};

export const moodEmojis = [
  { value: 1, emoji: '😢', label: 'Terrible' },
  { value: 2, emoji: '😕', label: 'Bad' },
  { value: 3, emoji: '😐', label: 'Okay' },
  { value: 4, emoji: '🙂', label: 'Good' },
  { value: 5, emoji: '😄', label: 'Great' },
];

export const habitCategories = [
  'Personal',
  'Health',
  'Work',
  'Learning',
  'Fitness',
  'Other',
];

export const repeatOptions = [
  'Daily',
  'Weekly',
  'Monthly',
  'Yearly',
  'Custom',
];

export const priorityLevels = [
  { value: 'low', label: 'Low', color: colors.priorityLow },
  { value: 'medium', label: 'Medium', color: colors.priorityMedium },
  { value: 'high', label: 'High', color: colors.priorityHigh },
];

export const defaultCurrencies = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
];

export const incomeCategories = [
  { id: 'salary', name: 'Salary', icon: 'briefcase' },
  { id: 'freelance', name: 'Freelance', icon: 'laptop' },
  { id: 'investment', name: 'Investment', icon: 'trending-up' },
  { id: 'gift', name: 'Gift', icon: 'gift' },
  { id: 'refund', name: 'Refund', icon: 'rotate-ccw' },
  { id: 'other', name: 'Other', icon: 'plus-circle' },
];

export const expenseCategories = [
  { id: 'food', name: 'Food & Dining', icon: 'coffee' },
  { id: 'transport', name: 'Transport', icon: 'car' },
  { id: 'shopping', name: 'Shopping', icon: 'shopping-bag' },
  { id: 'bills', name: 'Bills & Utilities', icon: 'file-text' },
  { id: 'entertainment', name: 'Entertainment', icon: 'film' },
  { id: 'health', name: 'Health', icon: 'heart' },
  { id: 'education', name: 'Education', icon: 'book' },
  { id: 'other', name: 'Other', icon: 'plus-circle' },
];

export default {
  colors,
  shadows,
  spacing,
  borderRadius,
  typography,
  moodEmojis,
  habitCategories,
  repeatOptions,
  priorityLevels,
  defaultCurrencies,
  incomeCategories,
  expenseCategories,
};
