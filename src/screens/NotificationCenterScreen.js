import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '../utils/theme';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../context/AppContext';

const formatTimeAgo = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.max(0, Math.round(diffMs / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
};

const NotificationCenterScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { themeColors, friendRequests, respondToFriendRequest } = useApp();
  const [respondingMap, setRespondingMap] = React.useState({});
  const pendingRequests = friendRequests?.incoming || [];

  const handleRespond = async (requestId, status) => {
    setRespondingMap((prev) => ({ ...prev, [requestId]: status }));
    try {
      await respondToFriendRequest(requestId, status);
    } catch (err) {
      Alert.alert('Unable to update request', err?.message || 'Please try again.');
    } finally {
      setRespondingMap((prev) => ({ ...prev, [requestId]: null }));
    }
  };

  const themedStyles = React.useMemo(() => createStyles(themeColors || colors), [themeColors]);

  return (
    <View style={[themedStyles.container, { paddingTop: insets.top || spacing.lg }]}>
      <View style={themedStyles.header}>
        <TouchableOpacity
          style={themedStyles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={22} color={themedStyles.iconColor} />
        </TouchableOpacity>
        <Text style={themedStyles.title}>Notification Centre</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        style={themedStyles.scroll}
        contentContainerStyle={themedStyles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={themedStyles.sectionLabel}>Friend requests</Text>
        {pendingRequests.length === 0 ? (
          <View style={themedStyles.placeholderBox}>
            <Ionicons name="notifications-outline" size={20} color={themedStyles.subduedText} />
            <Text style={themedStyles.placeholderText}>
              No new notifications. Friend requests and habit alerts will appear here.
            </Text>
          </View>
        ) : (
          pendingRequests.map((item) => (
            <View key={item.id} style={themedStyles.card}>
              <View style={[themedStyles.iconWrap, { backgroundColor: `${colors.primary}15` }]}>
                <Feather name="user-plus" size={20} color={colors.primary} />
              </View>
              <View style={themedStyles.textWrap}>
                <Text style={themedStyles.cardTitle}>
                  {(item.fromUser?.name || item.fromUser?.username || 'Someone')} added you as a friend
                </Text>
                <Text style={themedStyles.cardBody}>
                  @{item.fromUser?.username || 'unknown'}
                  {item.created_at ? ` - ${formatTimeAgo(item.created_at)}` : ''}
                </Text>
                <View style={themedStyles.actionRow}>
                  <TouchableOpacity
                    onPress={() => handleRespond(item.id, 'accepted')}
                    style={themedStyles.primaryButton}
                    disabled={!!respondingMap[item.id]}
                  >
                    {respondingMap[item.id] === 'accepted' ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={themedStyles.primaryButtonText}>Accept</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleRespond(item.id, 'declined')}
                    style={themedStyles.secondaryButton}
                    disabled={!!respondingMap[item.id]}
                  >
                    {respondingMap[item.id] === 'declined' ? (
                      <ActivityIndicator color={themedStyles.subduedText} size="small" />
                    ) : (
                      <Text style={themedStyles.secondaryButtonText}>Decline</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
};

const createStyles = (themeColors) => {
  const baseText = themeColors?.text || colors.text;
  const subdued = themeColors?.textSecondary || colors.textSecondary;
  const primary = themeColors?.primary || colors.primary;
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: themeColors?.background || colors.background,
    },
    iconColor: baseText,
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
    },
    backButton: {
      width: 44,
      height: 44,
      borderRadius: borderRadius.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: themeColors?.inputBackground || colors.inputBackground,
    },
    title: {
      ...typography.h3,
      color: baseText,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xxxl,
    },
    sectionLabel: {
      ...typography.caption,
      color: subdued,
      marginBottom: spacing.sm,
      marginTop: spacing.sm,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      padding: spacing.md,
      borderRadius: borderRadius.lg,
      backgroundColor: themeColors?.card || colors.card,
      borderWidth: 1,
      borderColor: themeColors?.border || colors.border,
      marginBottom: spacing.sm,
      ...shadows.small,
    },
    iconWrap: {
      width: 42,
      height: 42,
      borderRadius: borderRadius.full,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.md,
    },
    textWrap: {
      flex: 1,
    },
    cardTitle: {
      ...typography.body,
      fontWeight: '700',
      marginBottom: 2,
      color: baseText,
    },
    cardBody: {
      ...typography.bodySmall,
      color: subdued,
      lineHeight: 18,
    },
    actionRow: {
      flexDirection: 'row',
      marginTop: spacing.sm,
    },
    primaryButton: {
      backgroundColor: primary,
      paddingVertical: 10,
      paddingHorizontal: spacing.md,
      borderRadius: borderRadius.md,
      minWidth: 96,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryButton: {
      backgroundColor: themeColors?.inputBackground || colors.inputBackground,
      paddingVertical: 10,
      paddingHorizontal: spacing.md,
      borderRadius: borderRadius.md,
      marginLeft: spacing.sm,
      borderWidth: 1,
      borderColor: themeColors?.border || colors.border,
      minWidth: 96,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryButtonText: {
      ...typography.body,
      color: '#ffffff',
      fontWeight: '700',
    },
    secondaryButtonText: {
      ...typography.body,
      color: baseText,
      fontWeight: '600',
    },
    placeholderBox: {
      marginTop: spacing.lg,
      padding: spacing.md,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: themeColors?.border || colors.border,
      backgroundColor: themeColors?.inputBackground || colors.inputBackground,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    placeholderText: {
      ...typography.bodySmall,
      color: subdued,
      flex: 1,
    },
    subduedText: subdued,
  });
};

export default NotificationCenterScreen;
