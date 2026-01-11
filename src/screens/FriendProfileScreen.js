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
    themeName,
  } = useApp();
  const insets = useSafeAreaInsets();
  const isDark = themeName === 'dark';
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

  const profileTheme = useMemo(
    () => ({
      heroGradient: isDark ? ['#0F172A', '#312E81'] : ['#60A5FA', '#A855F7'],
      cardBg: isDark ? '#0B1020' : '#FFFFFF',
      cardBorder: isDark ? 'rgba(148, 163, 184, 0.25)' : '#E2E8F0',
      headerText: '#FFFFFF',
      headerSubText: 'rgba(255, 255, 255, 0.85)',
      iconBg: 'rgba(255, 255, 255, 0.2)',
      statusBg: isDark ? 'rgba(59, 130, 246, 0.18)' : '#DBEAFE',
      statusBorder: isDark ? 'rgba(59, 130, 246, 0.35)' : '#BFDBFE',
      statusText: isDark ? '#BFDBFE' : '#1E3A8A',
      secondaryBg: isDark ? '#111827' : '#F3F4F6',
      secondaryBorder: isDark ? '#1F2937' : '#E5E7EB',
      secondaryText: themeColors?.text || colors.text,
      blockGradient: isDark ? ['#EF4444', '#F97316'] : ['#FB7185', '#F97316'],
      deleteGradient: isDark ? ['#991B1B', '#EF4444'] : ['#DC2626', '#B91C1C'],
      reportGradient: isDark ? ['#7C2D12', '#DC2626'] : ['#FB923C', '#EF4444'],
      fieldBg: isDark ? '#111827' : '#F9FAFB',
      fieldBorder: isDark ? '#1F2937' : '#E5E7EB',
    }),
    [isDark, themeColors]
  );

  const reportTheme = useMemo(
    () => ({
      gradient: profileTheme.reportGradient,
      surface: profileTheme.cardBg,
      border: profileTheme.cardBorder,
      fieldBg: profileTheme.fieldBg,
      fieldBorder: profileTheme.fieldBorder,
      secondaryBg: profileTheme.secondaryBg,
      secondaryBorder: profileTheme.secondaryBorder,
      secondaryText: profileTheme.secondaryText,
      actionGradient: profileTheme.blockGradient,
      headerText: profileTheme.headerText,
      headerSubText: profileTheme.headerSubText,
      iconBg: profileTheme.iconBg,
      closeBg: 'rgba(255, 255, 255, 0.22)',
    }),
    [profileTheme]
  );

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

  const isOnline = !blocked && isUserOnline(friendId);
  const statusDotColor = blocked
    ? themeColors?.danger || colors.danger
    : isOnline
      ? themeColors?.success || colors.success
      : themeColors?.textLight || colors.textLight;
  const statusText = blocked
    ? 'Blocked'
    : isOnline
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
        <View style={[themedStyles.avatarFrame, { borderColor: profileTheme.statusBorder }]}>
          <Image
            source={{ uri: profileData.avatarUrl }}
            style={themedStyles.avatarImage}
          />
        </View>
      );
    }
    return (
      <View style={[themedStyles.avatarFrame, { borderColor: profileTheme.statusBorder }]}>
        <View style={themedStyles.avatarFallback}>
          <Text style={themedStyles.avatarInitial}>
            {getInitial(profileData?.name, profileData?.username)}
          </Text>
        </View>
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
        <Text style={themedStyles.title}>Friend Profile</Text>
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

            <View
              style={[
                themedStyles.heroCard,
                { backgroundColor: profileTheme.cardBg, borderColor: profileTheme.cardBorder },
              ]}
            >
              <LinearGradient colors={profileTheme.heroGradient} style={themedStyles.heroHeader}>
                <View style={themedStyles.heroHeaderRow}>
                  <View
                    style={[
                      themedStyles.heroIconBadge,
                      { backgroundColor: profileTheme.iconBg },
                    ]}
                  >
                    <Ionicons name="person" size={18} color={profileTheme.headerText} />
                  </View>
                  <View style={themedStyles.heroHeaderText}>
                    <Text style={[themedStyles.heroTitle, { color: profileTheme.headerText }]}>
                      Friend Profile
                    </Text>
                    <Text
                      style={[themedStyles.heroSubtitle, { color: profileTheme.headerSubText }]}
                    >
                      Stay connected and check progress
                    </Text>
                  </View>
                </View>
              </LinearGradient>
              <View style={themedStyles.heroBody}>
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
                            colors={[
                              'rgba(255,255,255,0.6)',
                              'rgba(255,255,255,0.12)',
                              'rgba(255,255,255,0)',
                            ]}
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
                    <View style={themedStyles.statusRow}>
                      {statusText ? (
                        <View
                          style={[
                            themedStyles.statusPill,
                            {
                              backgroundColor: profileTheme.statusBg,
                              borderColor: profileTheme.statusBorder,
                            },
                          ]}
                        >
                          <View
                            style={[
                              themedStyles.statusDot,
                              { backgroundColor: statusDotColor },
                            ]}
                          />
                          <Text
                            style={[
                              themedStyles.statusText,
                              { color: profileTheme.statusText },
                            ]}
                          >
                            {statusText}
                          </Text>
                        </View>
                      ) : null}
                      {mutualGroups.length > 0 ? (
                        <View
                          style={[
                            themedStyles.statusPill,
                            {
                              backgroundColor: profileTheme.statusBg,
                              borderColor: profileTheme.statusBorder,
                            },
                          ]}
                        >
                          <Ionicons
                            name="people"
                            size={12}
                            color={profileTheme.statusText}
                          />
                          <Text
                            style={[
                              themedStyles.statusText,
                              { color: profileTheme.statusText },
                            ]}
                          >
                            {mutualGroups.length} mutual
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </View>
              </View>
            </View>

            <Card
              style={[
                themedStyles.sectionCard,
                { backgroundColor: profileTheme.cardBg, borderColor: profileTheme.cardBorder },
              ]}
            >
              <View style={themedStyles.sectionHeaderRow}>
                <View
                  style={[
                    themedStyles.sectionIcon,
                    { backgroundColor: profileTheme.statusBg },
                  ]}
                >
                  <Ionicons name="information" size={16} color={profileTheme.statusText} />
                </View>
                <Text style={themedStyles.sectionTitle}>Details</Text>
              </View>
              {detailRows.map((row) => (
                <View key={row.label} style={themedStyles.detailRow}>
                  <Text style={themedStyles.detailLabel}>{row.label}</Text>
                  <Text style={themedStyles.detailValue}>{row.value || 'Not available'}</Text>
                </View>
              ))}
            </Card>

            <Card
              style={[
                themedStyles.sectionCard,
                { backgroundColor: profileTheme.cardBg, borderColor: profileTheme.cardBorder },
              ]}
            >
              <View style={themedStyles.sectionHeaderRow}>
                <View
                  style={[
                    themedStyles.sectionIcon,
                    { backgroundColor: profileTheme.statusBg },
                  ]}
                >
                  <Ionicons name="people" size={16} color={profileTheme.statusText} />
                </View>
                <Text style={themedStyles.sectionTitle}>Mutual groups</Text>
              </View>
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

            <View
              style={[
                themedStyles.actionCard,
                { backgroundColor: profileTheme.cardBg, borderColor: profileTheme.cardBorder },
              ]}
            >
              <View style={themedStyles.sectionHeaderRow}>
                <View
                  style={[
                    themedStyles.sectionIcon,
                    { backgroundColor: profileTheme.statusBg },
                  ]}
                >
                  <Ionicons name="shield-checkmark" size={16} color={profileTheme.statusText} />
                </View>
                <Text style={themedStyles.sectionTitle}>Actions</Text>
              </View>
              <View style={themedStyles.actions}>
                <TouchableOpacity
                  style={[
                    themedStyles.secondaryButton,
                    themedStyles.actionButton,
                    {
                      backgroundColor: profileTheme.secondaryBg,
                      borderColor: profileTheme.secondaryBorder,
                    },
                  ]}
                  onPress={() => setReportVisible(true)}
                >
                  <Feather name="flag" size={18} color={themedStyles.iconColor} />
                  <Text style={themedStyles.secondaryButtonText}>Report</Text>
                </TouchableOpacity>

                {blocked ? (
                  <TouchableOpacity
                    style={[
                      themedStyles.secondaryButton,
                      themedStyles.actionButton,
                      {
                        backgroundColor: profileTheme.secondaryBg,
                        borderColor: profileTheme.secondaryBorder,
                      },
                    ]}
                    disabled={blocking}
                    onPress={handleBlockToggle}
                  >
                    {blocking ? (
                      <ActivityIndicator color={themedStyles.iconColor} size="small" />
                    ) : (
                      <>
                        <Feather name="unlock" size={18} color={themedStyles.iconColor} />
                        <Text style={themedStyles.secondaryButtonText}>Unblock</Text>
                      </>
                    )}
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[themedStyles.gradientButton, themedStyles.actionButton]}
                    disabled={blocking}
                    onPress={handleBlockToggle}
                  >
                    <LinearGradient
                      colors={profileTheme.blockGradient}
                      style={themedStyles.gradientButtonInner}
                    >
                      {blocking ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <>
                          <Feather name="slash" size={18} color="#fff" />
                          <Text style={themedStyles.gradientButtonText}>Block</Text>
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[themedStyles.gradientButton, themedStyles.actionButton]}
                  disabled={deleting}
                  onPress={handleDeleteFriend}
                >
                  <LinearGradient
                    colors={profileTheme.deleteGradient}
                    style={themedStyles.gradientButtonInner}
                  >
                    {deleting ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <>
                        <Feather name="trash-2" size={18} color="#fff" />
                        <Text style={themedStyles.gradientButtonText}>Delete</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}
      </ScrollView>

      <Modal
        visible={reportVisible}
        onClose={() => setReportVisible(false)}
        title="Report user"
        hideHeader
        showCloseButton={false}
        containerStyle={{ backgroundColor: reportTheme.surface }}
      >
        <View
          style={[
            themedStyles.reportCard,
            { backgroundColor: reportTheme.surface, borderColor: reportTheme.border },
          ]}
        >
          <LinearGradient colors={reportTheme.gradient} style={themedStyles.reportHeader}>
            <View style={themedStyles.reportHeaderRow}>
              <View
                style={[
                  themedStyles.reportIconBadge,
                  { backgroundColor: reportTheme.iconBg },
                ]}
              >
                <Feather name="flag" size={18} color={reportTheme.headerText} />
              </View>
              <View style={themedStyles.reportHeaderText}>
                <Text style={[themedStyles.reportTitle, { color: reportTheme.headerText }]}>
                  Report user
                </Text>
                <Text
                  style={[themedStyles.reportSubtitle, { color: reportTheme.headerSubText }]}
                >
                  Help us keep the community safe
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={[themedStyles.reportCloseButton, { backgroundColor: reportTheme.closeBg }]}
              onPress={() => setReportVisible(false)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={18} color={reportTheme.headerText} />
            </TouchableOpacity>
          </LinearGradient>
          <View style={themedStyles.reportBody}>
            <Text style={themedStyles.reportText}>
              Tell us what happened. Your report will be reviewed and forwarded to our team.
            </Text>
            <TextInput
              style={[
                themedStyles.reportInput,
                { backgroundColor: reportTheme.fieldBg, borderColor: reportTheme.fieldBorder },
              ]}
              value={reportDescription}
              onChangeText={setReportDescription}
              placeholder="Write your report here..."
              placeholderTextColor={themedStyles.subduedText}
              multiline
            />
            <View style={themedStyles.reportActions}>
              <TouchableOpacity
                style={[
                  themedStyles.secondaryButton,
                  themedStyles.reportButton,
                  {
                    backgroundColor: reportTheme.secondaryBg,
                    borderColor: reportTheme.secondaryBorder,
                  },
                ]}
                onPress={() => {
                  setReportDescription('');
                  setReportVisible(false);
                }}
              >
                <Text style={themedStyles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[themedStyles.reportButton, themedStyles.reportPrimaryButton]}
                disabled={reporting}
                onPress={handleSubmitReport}
              >
                <LinearGradient
                  colors={reportTheme.actionGradient}
                  style={themedStyles.reportPrimaryInner}
                >
                  {reporting ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={themedStyles.reportPrimaryText}>Submit</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const createStyles = (themeColorsParam = colors) => {
  const baseText = themeColorsParam?.text || colors.text;
  const subdued = themeColorsParam?.textSecondary || colors.textSecondary;
  const accent = themeColorsParam?.primary || colors.primary;
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
      borderWidth: 1,
      borderColor: themeColorsParam?.border || colors.border,
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
      borderRadius: borderRadius.xl,
    },
    heroCard: {
      marginBottom: spacing.lg,
      borderRadius: borderRadius.xl,
      borderWidth: 1,
      overflow: 'hidden',
      ...shadows.medium,
    },
    heroHeader: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg,
      minHeight: 104,
      justifyContent: 'center',
    },
    heroHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    heroIconBadge: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.md,
    },
    heroHeaderText: {
      flex: 1,
    },
    heroTitle: {
      ...typography.h2,
    },
    heroSubtitle: {
      ...typography.bodySmall,
      marginTop: 2,
    },
    heroBody: {
      padding: spacing.lg,
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
    statusRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    statusPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      borderRadius: borderRadius.full,
      borderWidth: 1,
      paddingVertical: 4,
      paddingHorizontal: spacing.sm,
    },
    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    statusText: {
      ...typography.caption,
      fontWeight: '600',
    },
    sectionTitle: {
      ...typography.h3,
      color: baseText,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    sectionIcon: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.sm,
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
    actionCard: {
      borderRadius: borderRadius.xl,
      borderWidth: 1,
      padding: spacing.lg,
      marginBottom: spacing.lg,
    },
    actionButton: {
      flex: 1,
      minWidth: 0,
      paddingVertical: spacing.md,
      minHeight: 48,
      borderRadius: borderRadius.lg,
      overflow: 'hidden',
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
    gradientButton: {
      paddingVertical: 0,
      paddingHorizontal: 0,
      borderRadius: borderRadius.lg,
      overflow: 'hidden',
    },
    gradientButtonInner: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
    },
    gradientButtonText: {
      ...typography.body,
      color: '#FFFFFF',
      fontWeight: '700',
    },
    reportCard: {
      borderRadius: borderRadius.xl,
      borderWidth: 1,
      overflow: 'hidden',
      ...shadows.large,
    },
    reportHeader: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg,
      minHeight: 96,
      justifyContent: 'center',
    },
    reportHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    reportIconBadge: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.md,
    },
    reportHeaderText: {
      flex: 1,
    },
    reportTitle: {
      ...typography.h2,
      color: '#FFFFFF',
    },
    reportSubtitle: {
      ...typography.bodySmall,
      color: 'rgba(255, 255, 255, 0.85)',
      marginTop: 2,
    },
    reportCloseButton: {
      position: 'absolute',
      top: spacing.md,
      right: spacing.md,
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    reportBody: {
      padding: spacing.lg,
    },
    reportText: {
      ...typography.body,
      color: baseText,
      marginBottom: spacing.sm,
    },
    reportInput: {
      minHeight: 120,
      borderWidth: 1,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      ...typography.body,
      color: baseText,
      backgroundColor: themeColorsParam?.inputBackground || colors.inputBackground,
      textAlignVertical: 'top',
    },
    reportActions: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    reportButton: {
      flex: 1,
      borderRadius: borderRadius.lg,
      overflow: 'hidden',
    },
    reportPrimaryButton: {
      paddingVertical: 0,
    },
    reportPrimaryInner: {
      paddingVertical: spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    reportPrimaryText: {
      ...typography.body,
      color: '#FFFFFF',
      fontWeight: '700',
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
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: `${accent}15`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarFrame: {
      width: 90,
      height: 90,
      borderRadius: 45,
      borderWidth: 1.5,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: themeColorsParam?.card || colors.card,
    },
    avatarImage: {
      width: 80,
      height: 80,
      borderRadius: 40,
    },
    avatarInitial: {
      ...typography.h2,
      color: baseText,
    },
    subduedText: subdued,
  });
};

export default FriendProfileScreen;
