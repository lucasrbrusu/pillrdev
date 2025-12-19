import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors, spacing, borderRadius, typography, shadows } from '../utils/theme';
import { Card } from '../components';
import { useApp } from '../context/AppContext';

const formatRelative = (value) => {
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

const getInitial = (name, username) => {
  const source = (name || username || '?').trim();
  return (source[0] || '?').toUpperCase();
};

const FriendsScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const {
    themeColors,
    friends,
    onlineFriends,
    friendRequests,
    searchUsersByUsername,
    sendFriendRequest,
    respondToFriendRequest,
    getFriendRelationship,
    isUserOnline,
    refreshFriendData,
    deleteFriend,
  } = useApp();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [actionState, setActionState] = useState({});

  useEffect(() => {
    refreshFriendData();
  }, [refreshFriendData]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setSearching(false);
      return undefined;
    }
    setSearching(true);
    const handle = setTimeout(async () => {
      try {
        const res = await searchUsersByUsername(trimmed);
        setResults(res);
      } catch (err) {
        Alert.alert('Search failed', err?.message || 'Please try again.');
      } finally {
        setSearching(false);
      }
    }, 120);

    return () => clearTimeout(handle);
  }, [query, searchUsersByUsername]);

  const dataset = query.trim() ? results : friends;
  const pendingIncoming = friendRequests?.incoming?.length || 0;
  const themedStyles = useMemo(() => createStyles(themeColors || colors), [themeColors]);

  const setLoading = (key, value) => {
    setActionState((prev) => ({ ...prev, [key]: value }));
  };

  const handleAdd = async (userId) => {
    setLoading(userId, 'adding');
    try {
      await sendFriendRequest(userId);
      Alert.alert('Friend request sent', 'They will see it in their notifications.');
    } catch (err) {
      Alert.alert('Unable to add friend', err?.message || 'Please try again.');
    } finally {
      setLoading(userId, null);
    }
  };

  const handleRespond = async (requestId, status, userId) => {
    const key = userId || requestId;
    setLoading(key, status);
    try {
      await respondToFriendRequest(requestId, status);
    } catch (err) {
      Alert.alert('Unable to update request', err?.message || 'Please try again.');
    } finally {
      setLoading(key, null);
    }
  };

  const handleDeleteFriend = (userId, displayName) => {
    if (!userId) return;
    Alert.alert(
      'Remove friend?',
      `Remove ${displayName || 'this user'} from your friends list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setLoading(userId, 'deleting');
            try {
              await deleteFriend(userId);
              await refreshFriendData();
            } catch (err) {
              Alert.alert('Unable to remove friend', err?.message || 'Please try again.');
            } finally {
              setLoading((prev) => ({ ...prev, [userId]: null }));
            }
          },
        },
      ]
    );
  };

  const renderAvatar = (user, size = 48) => {
    if (user.avatarUrl) {
      return <Image source={{ uri: user.avatarUrl }} style={{ width: size, height: size, borderRadius: borderRadius.full }} />;
    }
    return (
      <View
        style={[
          themedStyles.avatarFallback,
          { width: size, height: size, borderRadius: size / 2 },
        ]}
      >
        <Text style={themedStyles.avatarInitial}>{getInitial(user.name, user.username)}</Text>
      </View>
    );
  };

  const renderFriendRow = (user) => {
    const relationship = getFriendRelationship(user.id);
    const loadingState = actionState[user.id];
    const statusText = isUserOnline(user.id)
      ? 'Online'
      : user.lastSeen
        ? `Last seen ${formatRelative(user.lastSeen)}`
        : '';

    return (
      <View key={user.id} style={themedStyles.friendRow}>
        <View style={themedStyles.friendInfo}>
          {renderAvatar(user, 52)}
          <View style={themedStyles.friendTextWrap}>
            <Text style={themedStyles.friendName} numberOfLines={1}>
              {user.name || user.username || 'Unknown user'}
            </Text>
            <Text style={themedStyles.friendUsername}>
              {user.username ? `@${user.username}` : 'No username'}
            </Text>
            {statusText ? <Text style={themedStyles.friendStatus}>{statusText}</Text> : null}
          </View>
        </View>

        <View style={themedStyles.friendActions}>
          {relationship.isFriend ? (
              <View style={themedStyles.inlineActions}>
                <View style={themedStyles.friendTag}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                  <Text style={themedStyles.friendTagText}>Friends</Text>
                </View>
                <TouchableOpacity
                style={themedStyles.actionIconDestructive}
                  disabled={!!loadingState}
                  onPress={() => handleDeleteFriend(user.id, user.username || user.name)}
                >
                  {loadingState === 'deleting' ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Ionicons name="trash-outline" size={18} color="#fff" />
                  )}
                </TouchableOpacity>
              </View>
            ) : relationship.incoming ? (
              <View style={themedStyles.inlineActions}>
              <TouchableOpacity
                style={themedStyles.actionPrimary}
                disabled={!!loadingState}
                onPress={() => handleRespond(relationship.incoming.id, 'accepted', user.id)}
              >
                {loadingState === 'accepted' ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={themedStyles.actionPrimaryText}>Accept</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={themedStyles.actionGhost}
                disabled={!!loadingState}
                onPress={() => handleRespond(relationship.incoming.id, 'declined', user.id)}
              >
                {loadingState === 'declined' ? (
                  <ActivityIndicator color={themedStyles.subduedText} size="small" />
                ) : (
                  <Text style={themedStyles.actionGhostText}>Decline</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : relationship.outgoing ? (
            <View style={themedStyles.friendTag}>
              <Feather name="clock" size={14} color={themedStyles.subduedText} />
              <Text style={themedStyles.friendTagText}>Request sent</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={themedStyles.actionPrimary}
              disabled={!!loadingState}
              onPress={() => handleAdd(user.id)}
            >
              {loadingState ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={themedStyles.actionPrimaryText}>Add</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={[themedStyles.container, { paddingTop: insets.top || spacing.lg }]}>
      <View style={themedStyles.header}>
        <TouchableOpacity
          style={themedStyles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={22} color={themedStyles.iconColor} />
        </TouchableOpacity>
        <Text style={themedStyles.title}>Friends</Text>
        {pendingIncoming > 0 ? (
          <View style={themedStyles.badgePill}>
            <Text style={themedStyles.badgeText}>
              {`${pendingIncoming} request${pendingIncoming === 1 ? '' : 's'}`}
            </Text>
          </View>
        ) : (
          <View style={themedStyles.headerSpacer} />
        )}
      </View>

      <View style={themedStyles.searchBar}>
        <Ionicons name="search" size={18} color={themedStyles.subduedText} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search by username"
          placeholderTextColor={themedStyles.subduedText}
          style={themedStyles.searchInput}
        />
        {searching && <ActivityIndicator size="small" color={themedStyles.subduedText} />}
      </View>

      <ScrollView
        style={themedStyles.scroll}
        contentContainerStyle={themedStyles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Card style={themedStyles.sectionCard}>
          <View style={themedStyles.cardHeader}>
            <Text style={themedStyles.cardTitle}>Online now</Text>
            <Text style={themedStyles.cardMeta}>{onlineFriends.length} online</Text>
          </View>
          {onlineFriends.length === 0 ? (
            <Text style={themedStyles.emptyText}>No friends online right now.</Text>
          ) : (
            <View style={themedStyles.onlineRow}>
              {onlineFriends.map((friend) => (
                <View key={friend.id} style={themedStyles.onlineChip}>
                  {renderAvatar(friend, 44)}
                  <View style={themedStyles.onlineDot} />
                  <Text style={themedStyles.onlineChipName} numberOfLines={1}>
                    {friend.username || friend.name}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </Card>

        <Card style={themedStyles.sectionCard}>
          <View style={themedStyles.cardHeader}>
            <Text style={themedStyles.cardTitle}>
              {query.trim() ? 'Search results' : 'Friends'}
            </Text>
            <Text style={themedStyles.cardMeta}>{dataset.length} people</Text>
          </View>
          {dataset.length === 0 ? (
            <Text style={themedStyles.emptyText}>
              {query.trim()
                ? 'No users found with that username.'
                : 'No friends yet. Search above to add someone.'}
            </Text>
          ) : (
            dataset.map((user) => renderFriendRow(user))
          )}
        </Card>
      </ScrollView>
    </View>
  );
};

const createStyles = (themeColorsParam = colors) => {
  const baseText = themeColorsParam?.text || colors.text;
  const subdued = themeColorsParam?.textSecondary || colors.textSecondary;
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: themeColorsParam?.background || colors.background,
    },
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
      backgroundColor: themeColorsParam?.inputBackground || colors.inputBackground,
    },
    iconColor: baseText,
    title: {
      ...typography.h3,
      color: baseText,
    },
    badgePill: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.full,
      backgroundColor: themeColorsParam?.inputBackground || colors.inputBackground,
      borderWidth: 1,
      borderColor: themeColorsParam?.border || colors.border,
    },
    badgeText: {
      ...typography.caption,
      color: subdued,
      fontWeight: '700',
    },
    headerSpacer: {
      width: 44,
      height: 44,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: spacing.lg,
      marginBottom: spacing.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.full,
      backgroundColor: themeColorsParam?.inputBackground || colors.inputBackground,
      borderWidth: 1,
      borderColor: themeColorsParam?.border || colors.border,
      ...shadows.small,
    },
    searchInput: {
      flex: 1,
      marginLeft: spacing.sm,
      ...typography.body,
      color: baseText,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xxxl,
    },
    sectionCard: {
      marginBottom: spacing.md,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    cardTitle: {
      ...typography.h3,
      color: baseText,
    },
    cardMeta: {
      ...typography.caption,
      color: subdued,
    },
    emptyText: {
      ...typography.body,
      color: subdued,
    },
    onlineRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
    },
    onlineChip: {
      alignItems: 'center',
      width: 72,
    },
    onlineChipName: {
      ...typography.bodySmall,
      color: baseText,
      marginTop: spacing.xs,
      textAlign: 'center',
    },
    onlineDot: {
      position: 'absolute',
      right: -2,
      top: -2,
      width: 12,
      height: 12,
      borderRadius: borderRadius.full,
      backgroundColor: colors.success,
      borderWidth: 2,
      borderColor: themeColorsParam?.card || colors.card,
    },
    friendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderColor: themeColorsParam?.border || colors.border,
    },
    friendInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      marginRight: spacing.sm,
      gap: spacing.sm,
    },
    friendTextWrap: {
      flex: 1,
    },
    friendName: {
      ...typography.body,
      color: baseText,
      fontWeight: '700',
    },
    friendUsername: {
      ...typography.bodySmall,
      color: subdued,
    },
    friendStatus: {
      ...typography.caption,
      color: subdued,
      marginTop: 2,
    },
    friendActions: {
      alignItems: 'flex-end',
      justifyContent: 'center',
      minWidth: 120,
    },
    friendTag: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      backgroundColor: themeColorsParam?.inputBackground || colors.inputBackground,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.full,
      borderWidth: 1,
      borderColor: themeColorsParam?.border || colors.border,
    },
    friendTagText: {
      ...typography.bodySmall,
      color: subdued,
      fontWeight: '700',
    },
    inlineActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    actionPrimary: {
      backgroundColor: themeColorsParam?.primary || colors.primary,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: borderRadius.md,
      minWidth: 96,
      alignItems: 'center',
    },
    actionPrimaryText: {
      ...typography.body,
      color: '#ffffff',
      fontWeight: '700',
    },
    actionGhost: {
      backgroundColor: themeColorsParam?.inputBackground || colors.inputBackground,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: themeColorsParam?.border || colors.border,
      minWidth: 96,
      alignItems: 'center',
    },
    actionGhostText: {
      ...typography.body,
      color: baseText,
      fontWeight: '600',
    },
    actionIconDestructive: {
      backgroundColor: '#d9534f',
      padding: spacing.sm,
      borderRadius: borderRadius.full,
      alignItems: 'center',
      justifyContent: 'center',
      width: 44,
      height: 44,
    },
    avatarFallback: {
      backgroundColor: `${colors.primary}15`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarInitial: {
      ...typography.h4,
      color: baseText,
    },
    subduedText: subdued,
  });
};

export default FriendsScreen;
