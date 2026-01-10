import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, borderRadius, typography, shadows } from '../utils/theme';
import { Card, Modal } from '../components';
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

const FriendProfileScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { friendId } = route.params || {};
  const {
    themeColors,
    friends,
    getFriendRelationship,
    deleteFriend,
    blockUser,
    unblockUser,
    submitFriendReport,
    isUserOnline,
    isUserBlocked,
    isBlockedByUser,
    getUserProfileById,
    groups,
  } = useApp();
  const insets = useSafeAreaInsets();
  const [profileData, setProfileData] = useState(
    () => friends.find((f) => f.id === friendId) || null
  );
  const [loadingProfile, setLoadingProfile] = useState(!friends.find((f) => f.id === friendId));
  const [blocking, setBlocking] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  const [reportDescription, setReportDescription] = useState('');
  const [reporting, setReporting] = useState(false);
  const [loadError, setLoadError] = useState('');

  const relationship = getFriendRelationship(friendId);
  const blocked = relationship?.blocked || isUserBlocked(friendId);
  const blockedBy = relationship?.blockedBy || isBlockedByUser(friendId);

  const themedStyles = useMemo(() => createStyles(themeColors || colors), [themeColors]);
  const isPremiumFriend = useMemo(() => {
    const plan = (profileData?.plan || '').toLowerCase();
    return plan === 'premium' || plan === 'pro';
  }, [profileData?.plan]);
  const mutualGroups = useMemo(
    () =>
      (groups || []).filter((group) =>
        Array.isArray(group?.members) && group.members.some((m) => m.id === friendId)
      ),
    [groups, friendId]
  );

  useEffect(() => {
    let isMounted = true;
    const loadProfile = async () => {
      if (!friendId) {
        setLoadingProfile(false);
        setLoadError('No user selected.');
        return;
      }
      setLoadError('');
      if (!profileData) setLoadingProfile(true);
      try {
        const remote = await getUserProfileById(friendId);
        if (isMounted && remote) {
          setProfileData((prev) => ({ ...prev, ...remote, id: friendId }));
        } else if (isMounted && !remote && !profileData) {
          setLoadError('Profile not found.');
        }
      } catch (err) {
        if (isMounted) setLoadError(err?.message || 'Unable to load profile.');
      } finally {
        if (isMounted) setLoadingProfile(false);
      }
    };

    loadProfile();
    return () => {
      isMounted = false;
    };
  }, [friendId, getUserProfileById]);

  const statusText = blocked
    ? 'Blocked'
    : isUserOnline(friendId)
      ? 'Online'
      : profileData?.lastSeen
        ? `Last seen ${formatRelative(profileData.lastSeen)}`
        : '';

  const handleDeleteFriend = () => {
    if (!friendId) return;
    Alert.alert(
      'Delete friend?',
      'Remove this user from your friends list?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteFriend(friendId);
              navigation.goBack();
            } catch (err) {
              Alert.alert('Unable to delete friend', err?.message || 'Please try again.');
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  const handleBlockToggle = () => {
    if (!friendId) return;
    const action = blocked ? 'Unblock' : 'Block';
    Alert.alert(
      `${action} user?`,
      blocked
        ? 'They will be able to find and add you again.'
        : 'They will no longer see you or add you as a friend.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action,
          style: blocked ? 'default' : 'destructive',
          onPress: async () => {
            setBlocking(true);
            try {
              if (blocked) {
                await unblockUser(friendId);
              } else {
                await blockUser(friendId);
              }
            } catch (err) {
              Alert.alert(`Unable to ${action.toLowerCase()}`, err?.message || 'Please try again.');
            } finally {
              setBlocking(false);
            }
          },
        },
      ]
    );
  };

  const handleSubmitReport = async () => {
    if (!friendId) return;
    const message = reportDescription.trim();
    if (!message) {
      Alert.alert('Describe the issue', 'Please include a few words about what happened.');
      return;
    }
    setReporting(true);
    try {
      await submitFriendReport(friendId, message);
      setReportDescription('');
      setReportVisible(false);
      Alert.alert('Report submitted', 'Thank you. We will review this.');
    } catch (err) {
      Alert.alert('Unable to submit report', err?.message || 'Please try again.');
    } finally {
      setReporting(false);
    }
  };

  const renderAvatar = () => {
    if (profileData?.avatarUrl) {
      return (
        <Image
          source={{ uri: profileData.avatarUrl }}
          style={{ width: 80, height: 80, borderRadius: borderRadius.full }}
        />
      );
    }
    return (
      <View style={[themedStyles.avatarFallback, { width: 80, height: 80, borderRadius: 40 }]}>
        <Text style={themedStyles.avatarInitial}>
          {getInitial(profileData?.name, profileData?.username)}
        </Text>
      </View>
    );
  };

  const detailRows = [
    { label: 'Name', value: profileData?.name },
    { label: 'Username', value: profileData?.username ? `@${profileData.username}` : 'Not set' },
  ];

  return (
    <View style={[themedStyles.container, { paddingTop: insets.top || spacing.lg }]}>
      <View style={themedStyles.header}>
        <TouchableOpacity
          style={themedStyles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={22} color={themedStyles.iconColor} />
        </TouchableOpacity>
        <Text style={themedStyles.title}>Friend&apos;s Profile</Text>
        <View style={themedStyles.headerSpacer} />
      </View>

      <ScrollView
        style={themedStyles.scroll}
        contentContainerStyle={themedStyles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loadingProfile ? (
          <View style={themedStyles.loadingState}>
            <ActivityIndicator size="large" color={themeColors?.primary || colors.primary} />
          </View>
        ) : loadError ? (
          <Text style={themedStyles.errorText}>{loadError}</Text>
        ) : (
          <>
            {blockedBy ? (
              <View style={themedStyles.notice}>
                <Feather name="slash" size={16} color={colors.danger || '#d9534f'} />
                <Text style={themedStyles.noticeText}>
                  This user has blocked you. You cannot interact with them.
                </Text>
              </View>
            ) : null}

            <Card style={themedStyles.sectionCard}>
              <View style={themedStyles.profileHeader}>
                {renderAvatar()}
                <View style={themedStyles.profileInfo}>
                  <View style={themedStyles.nameRow}>
                    <Text style={themedStyles.profileName} numberOfLines={1}>
                      {profileData?.name || profileData?.username || 'Unknown user'}
                    </Text>
                    {isPremiumFriend ? (
                      <View style={themedStyles.premiumBadge}>
                        <LinearGradient
                          colors={['rgba(255,255,255,0.6)', 'rgba(255,255,255,0.12)', 'rgba(255,255,255,0)']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={themedStyles.premiumBadgeShine}
                          pointerEvents="none"
                        />
                        <View style={themedStyles.premiumBadgeContent}>
                          <Ionicons name="star" size={12} color="#FFFFFF" />
                          <Text style={themedStyles.premiumBadgeText}>Premium</Text>
                        </View>
                      </View>
                    ) : null}
                  </View>
                  <Text style={themedStyles.profileHandle}>
                    {profileData?.username ? `@${profileData.username}` : 'No username'}
                  </Text>
                  {statusText ? <Text style={themedStyles.profileStatus}>{statusText}</Text> : null}
                </View>
              </View>
            </Card>

            <Card style={themedStyles.sectionCard}>
              <Text style={themedStyles.sectionTitle}>Details</Text>
              {detailRows.map((row) => (
                <View key={row.label} style={themedStyles.detailRow}>
                  <Text style={themedStyles.detailLabel}>{row.label}</Text>
                  <Text style={themedStyles.detailValue}>{row.value || 'Not available'}</Text>
                </View>
              ))}
            </Card>

            <Card style={themedStyles.sectionCard}>
              <Text style={themedStyles.sectionTitle}>Mutual groups</Text>
              {mutualGroups.length === 0 ? (
                <Text style={themedStyles.emptyText}>No mutual groups yet.</Text>
              ) : (
                mutualGroups.map((group) => (
                  <View key={group.id} style={themedStyles.detailRow}>
                    <Text style={themedStyles.detailLabel}>{group.name}</Text>
                    <Text style={themedStyles.detailValue}>{group.members?.length || 0} members</Text>
                  </View>
                ))
              )}
            </Card>

            <View style={themedStyles.actions}>
              <TouchableOpacity
                style={[themedStyles.secondaryButton, themedStyles.actionButton]}
                onPress={() => setReportVisible(true)}
              >
                <Feather name="flag" size={18} color={themedStyles.iconColor} />
                <Text style={themedStyles.secondaryButtonText}>Report</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  themedStyles.blockButton,
                  themedStyles.actionButton,
                  blocked && { backgroundColor: themeColors?.inputBackground || colors.inputBackground },
                ]}
                disabled={blocking}
                onPress={handleBlockToggle}
              >
                {blocking ? (
                  <ActivityIndicator color={blocked ? themedStyles.iconColor : '#fff'} size="small" />
                ) : (
                  <>
                    <Feather
                      name={blocked ? 'unlock' : 'slash'}
                      size={18}
                      color={blocked ? themedStyles.iconColor : '#fff'}
                    />
                    <Text style={blocked ? themedStyles.secondaryButtonText : themedStyles.blockButtonText}>
                      {blocked ? 'Unblock' : 'Block'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[themedStyles.deleteButton, themedStyles.actionButton]}
                disabled={deleting}
                onPress={handleDeleteFriend}
              >
                {deleting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Feather name="trash-2" size={18} color="#fff" />
                    <Text style={themedStyles.deleteButtonText}>Delete</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>

      <Modal
        visible={reportVisible}
        onClose={() => setReportVisible(false)}
        title="Report user"
      >
        <Text style={themedStyles.modalText}>
          Tell us what happened. Your report will be reviewed and forwarded to our team.
        </Text>
        <TextInput
          style={themedStyles.textArea}
          value={reportDescription}
          onChangeText={setReportDescription}
          placeholder="Write your report here..."
          placeholderTextColor={themedStyles.subduedText}
          multiline
        />
        <View style={themedStyles.modalActions}>
          <TouchableOpacity
            style={themedStyles.secondaryButton}
            onPress={() => {
              setReportDescription('');
              setReportVisible(false);
            }}
          >
            <Text style={themedStyles.secondaryButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[themedStyles.blockButton, { flex: 1 }]}
            disabled={reporting}
            onPress={handleSubmitReport}
          >
            {reporting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={themedStyles.blockButtonText}>Submit</Text>
            )}
          </TouchableOpacity>
        </View>
      </Modal>
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
    headerSpacer: {
      width: 44,
      height: 44,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xxxl,
    },
    loadingState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.xl,
    },
    errorText: {
      ...typography.body,
      color: colors.danger || '#d9534f',
      textAlign: 'center',
    },
    sectionCard: {
      marginBottom: spacing.md,
    },
    profileHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    profileInfo: {
      flex: 1,
      gap: spacing.xs,
    },
    profileName: {
      ...typography.h3,
      color: baseText,
    },
    profileHandle: {
      ...typography.body,
      color: subdued,
    },
    profileStatus: {
      ...typography.caption,
      color: subdued,
    },
    sectionTitle: {
      ...typography.h4,
      color: baseText,
      marginBottom: spacing.sm,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    premiumBadge: {
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      borderRadius: borderRadius.full,
      backgroundColor: '#F59E0B',
      position: 'relative',
      overflow: 'hidden',
      ...shadows.small,
    },
    premiumBadgeContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      zIndex: 1,
    },
    premiumBadgeShine: {
      position: 'absolute',
      top: -6,
      left: -18,
      width: '70%',
      height: '140%',
      transform: [{ rotate: '-12deg' }],
      opacity: 0.75,
    },
    premiumBadgeText: {
      ...typography.bodySmall,
      color: '#FFFFFF',
      fontWeight: '700',
    },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: spacing.xs,
      borderBottomWidth: 1,
      borderColor: themeColorsParam?.border || colors.border,
    },
    detailLabel: {
      ...typography.body,
      color: subdued,
    },
    detailValue: {
      ...typography.body,
      color: baseText,
      flexShrink: 1,
      textAlign: 'right',
      marginLeft: spacing.sm,
    },
    emptyText: {
      ...typography.body,
      color: subdued,
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
      flexWrap: 'wrap',
    },
    actionButton: {
      flex: 1,
      minWidth: 0,
      paddingVertical: spacing.md,
      minHeight: 48,
    },
    secondaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: themeColorsParam?.border || colors.border,
      backgroundColor: themeColorsParam?.inputBackground || colors.inputBackground,
    },
    secondaryButtonText: {
      ...typography.body,
      color: baseText,
      fontWeight: '700',
    },
    blockButton: {
      backgroundColor: colors.danger || '#d9534f',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: borderRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: spacing.xs,
    },
    blockButtonText: {
      ...typography.body,
      color: '#fff',
      fontWeight: '700',
    },
    deleteButton: {
      backgroundColor: '#b32020',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: borderRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: spacing.xs,
    },
    deleteButtonText: {
      ...typography.body,
      color: '#fff',
      fontWeight: '700',
    },
    modalText: {
      ...typography.body,
      color: baseText,
      marginBottom: spacing.sm,
    },
    textArea: {
      minHeight: 120,
      borderWidth: 1,
      borderColor: themeColorsParam?.border || colors.border,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      ...typography.body,
      color: baseText,
      backgroundColor: themeColorsParam?.inputBackground || colors.inputBackground,
      textAlignVertical: 'top',
    },
    modalActions: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    notice: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: `${colors.danger || '#d9534f'}15`,
      borderColor: colors.danger || '#d9534f',
      borderWidth: 1,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    noticeText: {
      ...typography.body,
      color: baseText,
      flex: 1,
    },
    avatarFallback: {
      backgroundColor: `${colors.primary}15`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarInitial: {
      ...typography.h2,
      color: baseText,
    },
    subduedText: subdued,
  });
};

export default FriendProfileScreen;
