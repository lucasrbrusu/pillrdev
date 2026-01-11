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
import AsyncStorage from '@react-native-async-storage/async-storage';
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

const groupNotifications = (items) => {
  const now = new Date();
  const isSameDay = (d1, d2) =>
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();

  const buckets = {
    today: [],
    earlierToday: [],
    yesterday: [],
    lastWeek: [],
    older: [],
  };

  items.forEach((item) => {
    const date = item.timestamp ? new Date(item.timestamp) : null;
    if (!date || Number.isNaN(date.getTime())) return;

    const diffMs = now.getTime() - date.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffDays >= 14) {
      buckets.older.push(item);
    } else if (diffDays >= 7) {
      buckets.lastWeek.push(item);
    } else if (!isSameDay(now, date) && diffHours >= 6) {
      // crossed midnight and older than 6h
      buckets.yesterday.push(item);
    } else if (isSameDay(now, date) && diffHours >= 6) {
      buckets.earlierToday.push(item);
    } else {
      buckets.today.push(item);
    }
  });

  const ordered = [];
  if (buckets.today.length) ordered.push({ label: 'Today', data: buckets.today });
  if (buckets.earlierToday.length) ordered.push({ label: 'Earlier Today', data: buckets.earlierToday });
  if (buckets.yesterday.length) ordered.push({ label: 'Yesterday', data: buckets.yesterday });
  if (buckets.lastWeek.length) ordered.push({ label: 'Last Week', data: buckets.lastWeek });
  if (buckets.older.length) ordered.push({ label: 'Older Notifications', data: buckets.older });
  return ordered;
};

const CLEAR_NOTIFICATIONS_KEY = '@pillarup_notification_center_cleared_at';

const isAfterClearCutoff = (timestamp, cutoff) => {
  if (!cutoff) return true;
  if (!timestamp) return true;
  const ms = new Date(timestamp).getTime();
  if (Number.isNaN(ms)) return true;
  return ms > cutoff;
};

const NotificationCenterScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const {
    themeColors,
    friendRequests,
    taskInvites,
    groupInvites,
    respondToFriendRequest,
    respondToTaskInvite,
    respondToGroupInvite,
    ensureFriendDataLoaded,
    ensureTaskInvitesLoaded,
    ensureGroupInvitesLoaded,
    authUser,
  } = useApp();
  const [respondingMap, setRespondingMap] = React.useState({});
  const [respondingTaskMap, setRespondingTaskMap] = React.useState({});
  const [respondingGroupMap, setRespondingGroupMap] = React.useState({});
  const [clearCutoff, setClearCutoff] = React.useState(null);
  const pendingRequests = friendRequests?.incoming || [];
  const responseNotifications = friendRequests?.responses || [];
  const pendingTaskInvites = taskInvites?.incoming || [];
  const taskInviteResponses = taskInvites?.responses || [];
  const pendingGroupInvites = groupInvites?.incoming || [];
  const groupInviteResponses = groupInvites?.responses || [];

  const storageKey = React.useMemo(
    () =>
      authUser?.id
        ? `${CLEAR_NOTIFICATIONS_KEY}_${authUser.id}`
        : CLEAR_NOTIFICATIONS_KEY,
    [authUser?.id]
  );

  React.useEffect(() => {
    let isMounted = true;
    const loadClearCutoff = async () => {
      try {
        const stored = await AsyncStorage.getItem(storageKey);
        if (!isMounted) return;
        if (!stored) {
          setClearCutoff(null);
          return;
        }
        const parsed = Number(stored);
        setClearCutoff(Number.isFinite(parsed) ? parsed : null);
      } catch (err) {
        if (isMounted) setClearCutoff(null);
      }
    };

    loadClearCutoff();
    return () => {
      isMounted = false;
    };
  }, [storageKey]);

  React.useEffect(() => {
    ensureFriendDataLoaded();
    ensureTaskInvitesLoaded();
    ensureGroupInvitesLoaded();
  }, [ensureFriendDataLoaded, ensureGroupInvitesLoaded, ensureTaskInvitesLoaded]);

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

  const handleRespondTaskInvite = async (inviteId, status) => {
    setRespondingTaskMap((prev) => ({ ...prev, [inviteId]: status }));
    try {
      await respondToTaskInvite(inviteId, status);
    } catch (err) {
      Alert.alert('Unable to update invite', err?.message || 'Please try again.');
    } finally {
      setRespondingTaskMap((prev) => ({ ...prev, [inviteId]: null }));
    }
  };

  const themedStyles = React.useMemo(() => createStyles(themeColors || colors), [themeColors]);

  const handleRespondGroup = async (inviteId, status) => {
    setRespondingGroupMap((prev) => ({ ...prev, [inviteId]: status }));
    try {
      await respondToGroupInvite(inviteId, status);
    } catch (err) {
      Alert.alert('Unable to update group invite', err?.message || 'Please try again.');
    } finally {
      setRespondingGroupMap((prev) => ({ ...prev, [inviteId]: null }));
    }
  };

  const filteredPendingRequests = React.useMemo(
    () => pendingRequests.filter((item) => isAfterClearCutoff(item?.created_at, clearCutoff)),
    [pendingRequests, clearCutoff]
  );
  const filteredResponseNotifications = React.useMemo(
    () =>
      responseNotifications.filter((item) =>
        isAfterClearCutoff(item?.responded_at || item?.updated_at || item?.created_at, clearCutoff)
      ),
    [responseNotifications, clearCutoff]
  );
  const filteredPendingTaskInvites = React.useMemo(
    () => pendingTaskInvites.filter((item) => isAfterClearCutoff(item?.created_at, clearCutoff)),
    [pendingTaskInvites, clearCutoff]
  );
  const filteredTaskInviteResponses = React.useMemo(
    () =>
      taskInviteResponses.filter((item) =>
        isAfterClearCutoff(item?.responded_at || item?.updated_at || item?.created_at, clearCutoff)
      ),
    [taskInviteResponses, clearCutoff]
  );
  const filteredPendingGroupInvites = React.useMemo(
    () => pendingGroupInvites.filter((item) => isAfterClearCutoff(item?.created_at, clearCutoff)),
    [pendingGroupInvites, clearCutoff]
  );
  const filteredGroupInviteResponses = React.useMemo(
    () =>
      groupInviteResponses.filter((item) =>
        isAfterClearCutoff(item?.responded_at || item?.updated_at || item?.created_at, clearCutoff)
      ),
    [groupInviteResponses, clearCutoff]
  );

  const totalNotifications =
    filteredPendingRequests.length +
    filteredResponseNotifications.length +
    filteredPendingTaskInvites.length +
    filteredTaskInviteResponses.length +
    filteredPendingGroupInvites.length +
    filteredGroupInviteResponses.length;

  const handleClearAll = React.useCallback(() => {
    if (!totalNotifications) return;
    Alert.alert(
      'Clear notifications',
      'This will hide all current notifications in your centre.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            const now = Date.now();
            setClearCutoff(now);
            try {
              await AsyncStorage.setItem(storageKey, String(now));
            } catch (err) {
            }
          },
        },
      ]
    );
  }, [storageKey, totalNotifications]);

  const groupedPending = React.useMemo(() => {
    const items = (filteredPendingRequests || []).map((item) => ({
      key: `pending-${item.id}`,
      component: (
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
      ),
      timestamp: item.created_at,
    }));
    return groupNotifications(items);
  }, [filteredPendingRequests, themedStyles, respondingMap]);

  const groupedResponses = React.useMemo(() => {
    const items = (filteredResponseNotifications || []).map((item) => ({
      key: `response-${item.id}`,
      component: (
        <View key={item.id} style={themedStyles.card}>
          <View style={[themedStyles.iconWrap, { backgroundColor: `${colors.primary}15` }]}>
            <Feather name={item.status === 'accepted' ? 'user-check' : 'user-minus'} size={20} color={colors.primary} />
          </View>
          <View style={themedStyles.textWrap}>
            <Text style={themedStyles.cardTitle}>
              {(item.toUser?.name || item.toUser?.username || 'Someone')}{' '}
              {item.status === 'accepted' ? 'accepted' : 'declined'} your request
            </Text>
            <Text style={themedStyles.cardBody}>
              @{item.toUser?.username || 'unknown'}
              {item.responded_at ? ` - ${formatTimeAgo(item.responded_at)}` : ''}
            </Text>
          </View>
        </View>
      ),
      timestamp: item.responded_at || item.updated_at || item.created_at,
    }));
    return groupNotifications(items);
  }, [filteredResponseNotifications, themedStyles]);

  const groupedTaskInvites = React.useMemo(() => {
    const items = (filteredPendingTaskInvites || []).map((item) => ({
      key: `task-invite-${item.id}`,
      component: (
        <View key={item.id} style={themedStyles.card}>
          <View style={[themedStyles.iconWrap, { backgroundColor: `${colors.tasks}15` }]}>
            <Feather name="clipboard" size={20} color={colors.tasks} />
          </View>
          <View style={themedStyles.textWrap}>
            <Text style={themedStyles.cardTitle}>
              {(item.fromUser?.name || item.fromUser?.username || 'Someone')} invited you to a task
            </Text>
            <Text style={themedStyles.cardBody}>
              {item.task?.title || 'Task'}
              {item.created_at ? ` - ${formatTimeAgo(item.created_at)}` : ''}
            </Text>
            <View style={themedStyles.actionRow}>
              <TouchableOpacity
                onPress={() => handleRespondTaskInvite(item.id, 'accepted')}
                style={themedStyles.primaryButton}
                disabled={!!respondingTaskMap[item.id]}
              >
                {respondingTaskMap[item.id] === 'accepted' ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={themedStyles.primaryButtonText}>Accept</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleRespondTaskInvite(item.id, 'declined')}
                style={themedStyles.secondaryButton}
                disabled={!!respondingTaskMap[item.id]}
              >
                {respondingTaskMap[item.id] === 'declined' ? (
                  <ActivityIndicator color={themedStyles.subduedText} size="small" />
                ) : (
                  <Text style={themedStyles.secondaryButtonText}>Decline</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ),
      timestamp: item.created_at,
    }));
    return groupNotifications(items);
  }, [filteredPendingTaskInvites, themedStyles, respondingTaskMap]);

  const groupedTaskResponses = React.useMemo(() => {
    const items = (filteredTaskInviteResponses || []).map((item) => ({
      key: `task-response-${item.id}`,
      component: (
        <View key={item.id} style={themedStyles.card}>
          <View style={[themedStyles.iconWrap, { backgroundColor: `${colors.tasks}15` }]}>
            <Feather name={item.status === 'accepted' ? 'check-circle' : 'x-circle'} size={20} color={colors.tasks} />
          </View>
          <View style={themedStyles.textWrap}>
            <Text style={themedStyles.cardTitle}>
              {(item.toUser?.name || item.toUser?.username || 'Someone')}{' '}
              {item.status === 'accepted' ? 'accepted' : 'declined'} your task invite
            </Text>
            <Text style={themedStyles.cardBody}>
              {item.task?.title || 'Task'}
              {item.responded_at ? ` - ${formatTimeAgo(item.responded_at)}` : ''}
            </Text>
          </View>
        </View>
      ),
      timestamp: item.responded_at || item.updated_at || item.created_at,
    }));
    return groupNotifications(items);
  }, [filteredTaskInviteResponses, themedStyles]);

  const groupedGroupInvites = React.useMemo(() => {
    const items = (filteredPendingGroupInvites || []).map((item) => ({
      key: `group-invite-${item.id}`,
      component: (
        <View key={item.id} style={themedStyles.card}>
          <View style={[themedStyles.iconWrap, { backgroundColor: `${colors.primary}15` }]} />
          <View style={themedStyles.textWrap}>
            <Text style={themedStyles.cardTitle}>
              {(item.fromUser?.name || item.fromUser?.username || 'Someone')} invited you to{' '}
              {item.group?.name || 'a group'}
            </Text>
            <Text style={themedStyles.cardBody}>
              {item.created_at ? `Sent ${formatTimeAgo(item.created_at)}` : ''}
            </Text>
            <View style={themedStyles.actionRow}>
              <TouchableOpacity
                onPress={() => handleRespondGroup(item.id, 'accepted')}
                style={themedStyles.primaryButton}
                disabled={!!respondingGroupMap[item.id]}
              >
                {respondingGroupMap[item.id] === 'accepted' ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={themedStyles.primaryButtonText}>Join</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleRespondGroup(item.id, 'declined')}
                style={themedStyles.secondaryButton}
                disabled={!!respondingGroupMap[item.id]}
              >
                {respondingGroupMap[item.id] === 'declined' ? (
                  <ActivityIndicator color={themedStyles.subduedText} size="small" />
                ) : (
                  <Text style={themedStyles.secondaryButtonText}>Decline</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ),
      timestamp: item.created_at,
    }));
    return groupNotifications(items);
  }, [filteredPendingGroupInvites, themedStyles, respondingGroupMap]);

  const groupedGroupResponses = React.useMemo(() => {
    const items = (filteredGroupInviteResponses || []).map((item) => ({
      key: `group-response-${item.id}`,
      component: (
        <View key={item.id} style={themedStyles.card}>
          <View style={[themedStyles.iconWrap, { backgroundColor: `${colors.primary}15` }]} />
          <View style={themedStyles.textWrap}>
            <Text style={themedStyles.cardTitle}>
              {(item.toUser?.name || item.toUser?.username || 'Someone')}{' '}
              {item.status === 'accepted' ? 'joined' : 'declined'} {item.group?.name || 'your group'}
            </Text>
            <Text style={themedStyles.cardBody}>
              {item.responded_at ? `Updated ${formatTimeAgo(item.responded_at)}` : ''}
            </Text>
          </View>
        </View>
      ),
      timestamp: item.responded_at || item.updated_at || item.created_at,
    }));
    return groupNotifications(items);
  }, [filteredGroupInviteResponses, themedStyles]);

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
        <TouchableOpacity
          style={[
            themedStyles.clearButton,
            totalNotifications === 0 && themedStyles.clearButtonDisabled,
          ]}
          onPress={handleClearAll}
          disabled={totalNotifications === 0}
          accessibilityLabel="Clear notifications"
        >
          <Ionicons name="trash-outline" size={20} color={themedStyles.iconColor} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={themedStyles.scroll}
        contentContainerStyle={themedStyles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={themedStyles.sectionLabel}>Friend requests</Text>
        {filteredPendingRequests.length === 0 ? (
          <View style={themedStyles.placeholderBox}>
            <Ionicons name="notifications-outline" size={20} color={themedStyles.subduedText} />
            <Text style={themedStyles.placeholderText}>
              No new notifications. Friend requests and task invites will appear here.
            </Text>
          </View>
        ) : (
          groupedPending.map((group) => (
            <View key={group.label}>
              <Text style={themedStyles.groupLabel}>{group.label}</Text>
              {group.data.map((n) => n.component)}
            </View>
          ))
        )}

        <Text style={[themedStyles.sectionLabel, { marginTop: spacing.lg }]}>Task invites</Text>
        {filteredPendingTaskInvites.length === 0 ? (
          <View style={themedStyles.placeholderBox}>
            <Feather name="clipboard" size={20} color={themedStyles.subduedText} />
            <Text style={themedStyles.placeholderText}>
              No task invites right now.
            </Text>
          </View>
        ) : (
          groupedTaskInvites.map((group) => (
            <View key={group.label}>
              <Text style={themedStyles.groupLabel}>{group.label}</Text>
              {group.data.map((n) => n.component)}
            </View>
          ))
        )}

        <Text style={[themedStyles.sectionLabel, { marginTop: spacing.lg }]}>Group invites</Text>
        {filteredPendingGroupInvites.length === 0 ? (
          <View style={themedStyles.placeholderBox}>
            <Ionicons name="people-outline" size={20} color={themedStyles.subduedText} />
            <Text style={themedStyles.placeholderText}>No group invites right now.</Text>
          </View>
        ) : (
          groupedGroupInvites.map((group) => (
            <View key={group.label}>
              <Text style={themedStyles.groupLabel}>{group.label}</Text>
              {group.data.map((n) => n.component)}
            </View>
          ))
        )}

        <Text style={[themedStyles.sectionLabel, { marginTop: spacing.lg }]}>Updates</Text>
        {filteredResponseNotifications.length === 0 ? (
          <View style={themedStyles.placeholderBox}>
            <Ionicons name="information-circle-outline" size={20} color={themedStyles.subduedText} />
            <Text style={themedStyles.placeholderText}>
              When someone responds to your friend request, it will appear here.
            </Text>
          </View>
        ) : (
          groupedResponses.map((group) => (
            <View key={group.label}>
              <Text style={themedStyles.groupLabel}>{group.label}</Text>
              {group.data.map((n) => n.component)}
            </View>
          ))
        )}

        <Text style={[themedStyles.sectionLabel, { marginTop: spacing.lg }]}>Task updates</Text>
        {filteredTaskInviteResponses.length === 0 ? (
          <View style={themedStyles.placeholderBox}>
            <Ionicons name="information-circle-outline" size={20} color={themedStyles.subduedText} />
            <Text style={themedStyles.placeholderText}>
              When someone responds to your task invite, it will appear here.
            </Text>
          </View>
        ) : (
          groupedTaskResponses.map((group) => (
            <View key={group.label}>
              <Text style={themedStyles.groupLabel}>{group.label}</Text>
              {group.data.map((n) => n.component)}
            </View>
          ))
        )}

        <Text style={[themedStyles.sectionLabel, { marginTop: spacing.lg }]}>Group updates</Text>
        {filteredGroupInviteResponses.length === 0 ? (
          <View style={themedStyles.placeholderBox}>
            <Ionicons name="information-circle-outline" size={20} color={themedStyles.subduedText} />
            <Text style={themedStyles.placeholderText}>
              When someone responds to your group invite, it will appear here.
            </Text>
          </View>
        ) : (
          groupedGroupResponses.map((group) => (
            <View key={group.label}>
              <Text style={themedStyles.groupLabel}>{group.label}</Text>
              {group.data.map((n) => n.component)}
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
    clearButton: {
      width: 44,
      height: 44,
      borderRadius: borderRadius.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: themeColors?.inputBackground || colors.inputBackground,
    },
    clearButtonDisabled: {
      opacity: 0.4,
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
    groupLabel: {
      ...typography.caption,
      color: subdued,
      marginBottom: spacing.xs,
      marginTop: spacing.xs,
    },
  });
};

export default NotificationCenterScreen;
