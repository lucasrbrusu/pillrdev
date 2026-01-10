import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { colors, spacing, borderRadius, typography, shadows } from '../utils/theme';
import { Card, Modal, Button, Input } from '../components';
import { useApp } from '../context/AppContext';

const dedupeById = (list = []) => {
  const seen = new Set();
  const deduped = [];
  list.forEach((item) => {
    const rawId = item?.id ?? item?.user_id;
    if (!rawId) return;
    const id = String(rawId).trim();
    if (!id || seen.has(id)) return;
    seen.add(id);
    deduped.push({ ...item, id });
  });
  return deduped;
};

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
    groups,
    groupInvites,
    ensureGroupDataLoaded,
    searchUsersByUsername,
    sendFriendRequest,
    respondToFriendRequest,
    respondToGroupInvite,
    getFriendRelationship,
    isUserOnline,
    refreshFriendData,
    createGroup,
    isPremiumUser,
    themeName,
  } = useApp();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [actionState, setActionState] = useState({});
  const [activeTab, setActiveTab] = useState('friends');
  const [tabDirection, setTabDirection] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedFriendIds, setSelectedFriendIds] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [inviteResponding, setInviteResponding] = useState({});
  const tabTranslate = React.useRef(new Animated.Value(0)).current;
  const tabOpacity = React.useRef(new Animated.Value(1)).current;

  useEffect(() => {
    refreshFriendData();
    ensureGroupDataLoaded();
  }, [refreshFriendData, ensureGroupDataLoaded]);

  useEffect(() => {
    tabTranslate.setValue(tabDirection * 24);
    tabOpacity.setValue(0);
    Animated.parallel([
      Animated.timing(tabTranslate, {
        toValue: 0,
        duration: 240,
        useNativeDriver: true,
      }),
      Animated.timing(tabOpacity, {
        toValue: 1,
        duration: 240,
        useNativeDriver: true,
      }),
    ]).start();
  }, [activeTab, tabDirection, tabOpacity, tabTranslate]);

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

  const dedupedFriends = useMemo(() => dedupeById(friends), [friends]);
  const dedupedResults = useMemo(() => dedupeById(results), [results]);
  const dataset = useMemo(
    () => (query.trim() ? dedupedResults : dedupedFriends),
    [query, dedupedResults, dedupedFriends]
  );
  const uniqueOnlineFriends = useMemo(() => dedupeById(onlineFriends), [onlineFriends]);
  const isDark = themeName === 'dark';
  const friendsCount = dedupedFriends.length;
  const groupsList = groups || [];
  const groupsCount = groupsList.length;
  const groupInvitesIncoming = groupInvites?.incoming || [];
  const friendsGradient = isDark ? ['#B12BFF', '#F23F8D'] : ['#C43BFF', '#F03C8B'];
  const groupsGradient = isDark ? ['#1274E8', '#0FB0D7'] : ['#2F80FF', '#17B5D8'];
  const segmentIconColor = isDark ? '#C7C9D9' : themeColors?.text || colors.text;
  const friendTagIconColor = isDark ? '#6EE7B7' : '#16A34A';
  const inviteIconColor = isDark ? '#93C5FD' : '#3B82F6';
  const groupGradients = [
    ['#C43BFF', '#F03C8B'],
    ['#2F80FF', '#17B5D8'],
    ['#16A34A', '#22C55E'],
    ['#F97316', '#F43F5E'],
  ];
  const themedStyles = useMemo(
    () => createStyles(themeColors || colors, isDark),
    [themeColors, isDark]
  );

  const setLoading = (key, value) => {
    setActionState((prev) => ({ ...prev, [key]: value }));
  };

  const handleOpenGroups = () => {
    if (activeTab === 'groups') return;
    setTabDirection(1);
    setActiveTab('groups');
  };

  const handleOpenFriends = () => {
    if (activeTab === 'friends') return;
    setTabDirection(-1);
    setActiveTab('friends');
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

  const toggleFriendSelection = (id) => {
    setSelectedFriendIds((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) return;
    setSubmitting(true);
    try {
      await createGroup({ name: groupName.trim(), inviteUserIds: selectedFriendIds });
      setGroupName('');
      setSelectedFriendIds([]);
      setShowCreate(false);
    } catch (err) {
      Alert.alert('Unable to create group', err?.message || 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRespondInvite = async (inviteId, status) => {
    setInviteResponding((prev) => ({ ...prev, [inviteId]: status }));
    try {
      await respondToGroupInvite(inviteId, status);
    } catch (err) {
      Alert.alert('Unable to update invite', err?.message || 'Please try again.');
    } finally {
      setInviteResponding((prev) => ({ ...prev, [inviteId]: null }));
    }
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

  const renderFriendRow = (user, isLast) => {
    const relationship = getFriendRelationship(user.id);
    const loadingState = actionState[user.id];
    const statusText = isUserOnline(user.id)
      ? 'Online'
      : user.lastSeen
        ? `Last seen ${formatRelative(user.lastSeen)}`
        : '';

    return (
      <View key={user.id} style={[themedStyles.friendRow, isLast && themedStyles.friendRowLast]}>
        <TouchableOpacity
          style={themedStyles.friendInfo}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('FriendProfile', { friendId: user.id })}
        >
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
        </TouchableOpacity>

        <View style={themedStyles.friendActions}>
          {relationship.isFriend ? (
            <View style={themedStyles.friendTag}>
              <Ionicons name="checkmark-circle" size={14} color={friendTagIconColor} />
              <Text style={themedStyles.friendTagText}>Friends</Text>
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

  const renderGroupRow = (group, index) => {
    const gradient = groupGradients[index % groupGradients.length];
    const memberCount = group.members?.length || 1;
    return (
      <TouchableOpacity
        key={group.id}
        style={themedStyles.groupRow}
        onPress={() => navigation.navigate('GroupDetail', { groupId: group.id })}
        activeOpacity={0.85}
      >
        <LinearGradient colors={gradient} style={themedStyles.groupAvatar}>
          <Ionicons name="people" size={18} color="#FFFFFF" />
        </LinearGradient>
        <View style={themedStyles.groupInfo}>
          <Text style={themedStyles.groupName}>{group.name}</Text>
          <Text style={themedStyles.groupMeta}>
            {memberCount} member{memberCount === 1 ? '' : 's'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={themedStyles.subduedText} />
      </TouchableOpacity>
    );
  };

  const renderInviteCard = (invite) => {
    const responding = inviteResponding[invite.id];
    return (
      <View key={invite.id} style={themedStyles.inviteCard}>
        <View style={themedStyles.inviteIcon}>
          <Ionicons name="mail-outline" size={18} color={inviteIconColor} />
        </View>
        <View style={themedStyles.inviteBody}>
          <Text style={themedStyles.inviteTitle}>
            {invite.fromUser?.name || invite.fromUser?.username || 'Someone'} invited you
          </Text>
          <Text style={themedStyles.inviteMeta}>{invite.group?.name || 'Group'}</Text>
          <View style={themedStyles.inviteActions}>
            <TouchableOpacity
              style={themedStyles.actionPrimary}
              disabled={!!responding}
              onPress={() => handleRespondInvite(invite.id, 'accepted')}
            >
              <Text style={themedStyles.actionPrimaryText}>
                {responding === 'accepted' ? '...' : 'Accept'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={themedStyles.actionGhost}
              disabled={!!responding}
              onPress={() => handleRespondInvite(invite.id, 'declined')}
            >
              <Text style={themedStyles.actionGhostText}>
                {responding === 'declined' ? '...' : 'Decline'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const showSearch = activeTab === 'friends';

  return (
    <View style={[themedStyles.container, { paddingTop: insets.top || spacing.lg }]}>
      <View style={themedStyles.header}>
        <TouchableOpacity
          style={themedStyles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <Ionicons name="chevron-back" size={22} color={themedStyles.headerIcon} />
        </TouchableOpacity>
        <Text style={themedStyles.headerTitle}>Social</Text>
        <View style={themedStyles.headerSpacer} />
      </View>

      {showSearch && (
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
      )}

      <View style={[themedStyles.segmentedControl, !showSearch && themedStyles.segmentedControlTop]}>
        <TouchableOpacity
          activeOpacity={0.9}
          style={themedStyles.segmentButtonActive}
          onPress={handleOpenFriends}
        >
          {activeTab === 'friends' ? (
            <LinearGradient
              colors={friendsGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={themedStyles.segmentFill}
            >
              <Ionicons name="people" size={18} color="#FFFFFF" />
              <Text style={themedStyles.segmentActiveText}>Friends</Text>
              <View style={themedStyles.segmentBadgeActive}>
                <Text style={themedStyles.segmentBadgeActiveText}>{friendsCount}</Text>
              </View>
            </LinearGradient>
          ) : (
            <View style={themedStyles.segmentFillInactive}>
              <Ionicons name="people" size={18} color={segmentIconColor} />
              <Text style={themedStyles.segmentText}>Friends</Text>
              <View style={themedStyles.segmentBadge}>
                <Text style={themedStyles.segmentBadgeText}>{friendsCount}</Text>
              </View>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.9}
          style={themedStyles.segmentButton}
          onPress={handleOpenGroups}
        >
          {activeTab === 'groups' ? (
            <LinearGradient
              colors={groupsGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={themedStyles.segmentFill}
            >
              <Ionicons name="people-outline" size={18} color="#FFFFFF" />
              <Text style={themedStyles.segmentActiveText}>Groups</Text>
              <View style={themedStyles.segmentBadgeActive}>
                <Text style={themedStyles.segmentBadgeActiveText}>{groupsCount}</Text>
              </View>
            </LinearGradient>
          ) : (
            <View style={themedStyles.segmentFillInactive}>
              <Ionicons name="people-outline" size={18} color={segmentIconColor} />
              <Text style={themedStyles.segmentText}>Groups</Text>
              <View style={themedStyles.segmentBadge}>
                <Text style={themedStyles.segmentBadgeText}>{groupsCount}</Text>
              </View>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={themedStyles.scroll}
        contentContainerStyle={themedStyles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: tabOpacity, transform: [{ translateX: tabTranslate }] }}>
          {activeTab === 'friends' ? (
            <>
              <Card style={themedStyles.sectionCard}>
                <View style={themedStyles.onlineHeader}>
                  <View style={themedStyles.onlineTitleRow}>
                    <View style={themedStyles.onlineIndicator} />
                    <Text style={themedStyles.cardTitle}>Online now</Text>
                  </View>
                  <Text style={themedStyles.cardMeta}>{uniqueOnlineFriends.length} online</Text>
                </View>
                {uniqueOnlineFriends.length === 0 ? (
                  <Text style={themedStyles.emptyText}>No friends online right now.</Text>
                ) : (
                  <View style={themedStyles.onlineRow}>
                    {uniqueOnlineFriends.map((friend) => (
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
                  dataset.map((user, index) => renderFriendRow(user, index === dataset.length - 1))
                )}
              </Card>
            </>
          ) : (
            <>
              <Card style={themedStyles.sectionCard}>
                <View style={themedStyles.groupHeader}>
                  <Text style={themedStyles.cardTitle}>Your groups</Text>
                  <View style={themedStyles.groupHeaderRight}>
                    <Text style={themedStyles.cardMeta}>{groupsCount} total</Text>
                    <TouchableOpacity
                      style={[
                        themedStyles.addButton,
                        !isPremiumUser && themedStyles.addButtonDisabled,
                      ]}
                      onPress={() => {
                        if (!isPremiumUser) {
                          navigation.navigate('Paywall', { source: 'groups' });
                          return;
                        }
                        setShowCreate(true);
                      }}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="add" size={18} color={segmentIconColor} />
                    </TouchableOpacity>
                  </View>
                </View>
                {groupsCount === 0 ? (
                  <Text style={themedStyles.emptyText}>
                    No groups yet. Create one to get started.
                  </Text>
                ) : (
                  groupsList.map((group, index) => renderGroupRow(group, index))
                )}
              </Card>

              <Card style={themedStyles.sectionCard}>
                <View style={themedStyles.cardHeader}>
                  <Text style={themedStyles.cardTitle}>Invitations</Text>
                  <Text style={themedStyles.cardMeta}>{groupInvitesIncoming.length} pending</Text>
                </View>
                {groupInvitesIncoming.length === 0 ? (
                  <View style={themedStyles.inviteEmpty}>
                    <View style={themedStyles.inviteEmptyIcon}>
                      <Ionicons name="mail-outline" size={28} color={inviteIconColor} />
                    </View>
                    <Text style={themedStyles.inviteEmptyText}>No invitations right now.</Text>
                  </View>
                ) : (
                  groupInvitesIncoming.map((invite) => renderInviteCard(invite))
                )}
              </Card>
            </>
          )}
        </Animated.View>
      </ScrollView>

      <Modal
        visible={showCreate}
        onClose={() => {
          setShowCreate(false);
          setGroupName('');
          setSelectedFriendIds([]);
        }}
        title="Create group"
        fullScreen={false}
      >
        <Input
          label="Group name"
          value={groupName}
          onChangeText={setGroupName}
          placeholder="e.g., Morning crew"
        />
        <Text style={themedStyles.subheading}>Invite friends (optional)</Text>
        {dedupedFriends.length === 0 ? (
          <Text style={themedStyles.emptyText}>Add friends to invite them here.</Text>
        ) : (
          dedupedFriends.map((friend) => {
            const selected = selectedFriendIds.includes(friend.id);
            return (
              <TouchableOpacity
                key={friend.id}
                style={[
                  themedStyles.inviteFriendRow,
                  selected && { borderColor: themeColors?.primary || colors.primary },
                ]}
                onPress={() => toggleFriendSelection(friend.id)}
              >
                <Text style={themedStyles.inviteFriendName}>
                  {friend.name || friend.username || 'Friend'}
                </Text>
                {selected ? (
                  <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                ) : (
                  <Ionicons name="ellipse-outline" size={18} color={themedStyles.subduedText} />
                )}
              </TouchableOpacity>
            );
          })
        )}
        <View style={themedStyles.modalActions}>
          <Button
            title="Cancel"
            variant="secondary"
            onPress={() => setShowCreate(false)}
            style={themedStyles.modalButton}
          />
          <Button
            title="Create"
            onPress={handleCreateGroup}
            disabled={!groupName.trim() || submitting}
            style={themedStyles.modalButton}
          />
        </View>
      </Modal>
    </View>
  );
};

const createStyles = (themeColorsParam = colors, isDark = false) => {
  const baseText = themeColorsParam?.text || colors.text;
  const subdued = themeColorsParam?.textSecondary || colors.textSecondary;
  const surface = isDark ? '#151924' : '#FFFFFF';
  const softSurface = isDark ? '#1C2030' : '#F7F4FF';
  const border = isDark ? '#2A2E3B' : '#ECE7F5';
  const segmentBackground = isDark ? '#1B1F2C' : '#F3EEFB';
  const mutedShadow = isDark
    ? { shadowOpacity: 0, shadowRadius: 0, shadowOffset: { width: 0, height: 0 }, elevation: 0 }
    : shadows.small;
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
      paddingBottom: spacing.sm,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: borderRadius.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: surface,
      borderWidth: 1,
      borderColor: border,
      ...mutedShadow,
    },
    headerTitle: {
      ...typography.h3,
      color: baseText,
    },
    headerSpacer: {
      width: 40,
      height: 40,
    },
    headerIcon: baseText,
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: spacing.lg,
      marginBottom: spacing.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.full,
      backgroundColor: surface,
      borderWidth: 1,
      borderColor: border,
      ...mutedShadow,
    },
    searchInput: {
      flex: 1,
      marginLeft: spacing.sm,
      ...typography.body,
      color: baseText,
    },
    segmentedControl: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: spacing.lg,
      marginBottom: spacing.lg,
      padding: 4,
      borderRadius: borderRadius.xl,
      backgroundColor: segmentBackground,
      borderWidth: 1,
      borderColor: border,
    },
    segmentedControlTop: {
      marginTop: spacing.sm,
    },
    segmentButtonActive: {
      flex: 1,
      borderRadius: borderRadius.lg,
      overflow: 'hidden',
    },
    segmentButton: {
      flex: 1,
      borderRadius: borderRadius.lg,
      overflow: 'hidden',
    },
    segmentFill: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      minHeight: 48,
      gap: spacing.sm,
    },
    segmentFillInactive: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      minHeight: 48,
      gap: spacing.sm,
      backgroundColor: surface,
      borderRadius: borderRadius.lg,
    },
    segmentText: {
      ...typography.body,
      color: baseText,
      fontWeight: '600',
    },
    segmentActiveText: {
      ...typography.body,
      color: '#FFFFFF',
      fontWeight: '700',
    },
    segmentBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: borderRadius.full,
      backgroundColor: surface,
      borderWidth: 1,
      borderColor: border,
    },
    segmentBadgeText: {
      ...typography.caption,
      color: baseText,
      fontWeight: '700',
    },
    segmentBadgeActive: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: borderRadius.full,
      backgroundColor: 'rgba(255,255,255,0.2)',
    },
    segmentBadgeActiveText: {
      ...typography.caption,
      color: '#FFFFFF',
      fontWeight: '700',
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
      borderRadius: borderRadius.xl,
      backgroundColor: surface,
      borderWidth: 1,
      borderColor: border,
      ...mutedShadow,
    },
    onlineHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    onlineTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    onlineIndicator: {
      width: 8,
      height: 8,
      borderRadius: borderRadius.full,
      backgroundColor: colors.success,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    groupHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    groupHeaderRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    addButton: {
      width: 32,
      height: 32,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: surface,
      borderWidth: 1,
      borderColor: border,
    },
    addButtonDisabled: {
      opacity: 0.45,
    },
    cardTitle: {
      ...typography.body,
      color: baseText,
      fontWeight: '700',
    },
    cardMeta: {
      ...typography.caption,
      color: subdued,
    },
    emptyText: {
      ...typography.bodySmall,
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
      borderColor: surface,
    },
    friendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.lg,
      backgroundColor: softSurface,
      borderWidth: 1,
      borderColor: border,
      marginBottom: spacing.sm,
    },
    friendRowLast: {
      marginBottom: 0,
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
      backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#E7F8EE',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.full,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(16, 185, 129, 0.35)' : '#CFF3DD',
    },
    friendTagText: {
      ...typography.bodySmall,
      color: isDark ? '#6EE7B7' : '#168A4E',
      fontWeight: '700',
    },
    inlineActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    actionPrimary: {
      backgroundColor: themeColorsParam?.primary || colors.primary,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.md,
      borderRadius: borderRadius.full,
      minWidth: 84,
      alignItems: 'center',
    },
    actionPrimaryText: {
      ...typography.bodySmall,
      color: '#ffffff',
      fontWeight: '700',
    },
    actionGhost: {
      backgroundColor: surface,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.md,
      borderRadius: borderRadius.full,
      borderWidth: 1,
      borderColor: border,
      minWidth: 84,
      alignItems: 'center',
    },
    actionGhostText: {
      ...typography.bodySmall,
      color: baseText,
      fontWeight: '600',
    },
    groupRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.lg,
      backgroundColor: isDark ? '#1A2233' : '#F3FAFF',
      borderWidth: 1,
      borderColor: isDark ? '#26324A' : '#DCEFFD',
      marginBottom: spacing.sm,
    },
    groupAvatar: {
      width: 42,
      height: 42,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.md,
    },
    groupInfo: {
      flex: 1,
    },
    groupName: {
      ...typography.body,
      color: baseText,
      fontWeight: '700',
    },
    groupMeta: {
      ...typography.bodySmall,
      color: subdued,
      marginTop: 2,
    },
    inviteCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      padding: spacing.md,
      borderRadius: borderRadius.lg,
      backgroundColor: softSurface,
      borderWidth: 1,
      borderColor: border,
      marginBottom: spacing.sm,
    },
    inviteIcon: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : '#E8F1FF',
      marginRight: spacing.md,
    },
    inviteBody: {
      flex: 1,
    },
    inviteTitle: {
      ...typography.bodySmall,
      color: baseText,
      fontWeight: '700',
    },
    inviteMeta: {
      ...typography.bodySmall,
      color: subdued,
      marginTop: 2,
      marginBottom: spacing.sm,
    },
    inviteActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    inviteEmpty: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.xl,
    },
    inviteEmptyIcon: {
      width: 56,
      height: 56,
      borderRadius: borderRadius.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(249, 115, 22, 0.15)' : '#FFF2E1',
      marginBottom: spacing.sm,
    },
    inviteEmptyText: {
      ...typography.bodySmall,
      color: subdued,
    },
    subheading: {
      ...typography.caption,
      color: subdued,
      marginTop: spacing.md,
      marginBottom: spacing.xs,
    },
    inviteFriendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderColor: border,
    },
    inviteFriendName: {
      ...typography.body,
      color: baseText,
    },
    modalActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: spacing.sm,
      marginTop: spacing.lg,
    },
    modalButton: {
      flex: 1,
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
