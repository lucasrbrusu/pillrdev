import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { PlatformScrollView } from '../components';
import { useApp } from '../context/AppContext';
import { colors, spacing, borderRadius, typography } from '../utils/theme';

const GROUP_GRADIENT = ['#2F80FF', '#17B5D8'];
const GROUP_ACCENT = '#2F80FF';

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

const CreateGroupScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const {
    friends,
    createGroup,
    ensureFriendDataLoaded,
    themeColors,
    isPremiumUser,
  } = useApp();

  const [groupName, setGroupName] = useState('');
  const [selectedFriendIds, setSelectedFriendIds] = useState([]);
  const [showInvitePicker, setShowInvitePicker] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    ensureFriendDataLoaded();
  }, [ensureFriendDataLoaded]);

  const themedStyles = useMemo(() => createStyles(themeColors || colors), [themeColors]);
  const dedupedFriends = useMemo(() => dedupeById(friends), [friends]);
  const trimmedName = groupName.trim();
  const canSubmit = trimmedName.length > 0 && !submitting;

  const toggleInvitedFriend = (friendId) => {
    setSelectedFriendIds((prev) =>
      prev.includes(friendId) ? prev.filter((id) => id !== friendId) : [...prev, friendId]
    );
  };

  const handleCreateGroup = async () => {
    if (!trimmedName || submitting) return;
    if (!isPremiumUser) {
      navigation.navigate('Paywall', { source: 'groups' });
      return;
    }

    setSubmitting(true);
    try {
      const createdGroup = await createGroup({
        name: trimmedName,
        inviteUserIds: selectedFriendIds,
      });
      if (createdGroup?.id) {
        navigation.replace('GroupDetail', { groupId: createdGroup.id });
        return;
      }
      navigation.goBack();
    } catch (err) {
      Alert.alert('Unable to create group', err?.message || 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View
      style={[
        themedStyles.container,
        {
          paddingTop: insets.top + spacing.sm,
          backgroundColor: themeColors?.background || colors.background,
        },
      ]}
    >
      <View style={themedStyles.topRow}>
        <TouchableOpacity
          style={[
            themedStyles.iconButton,
            {
              borderColor: themeColors?.border || colors.border,
              backgroundColor: themeColors?.inputBackground || colors.inputBackground,
            },
          ]}
          onPress={() => navigation.goBack()}
          activeOpacity={0.85}
        >
          <Ionicons name="chevron-back" size={20} color={themeColors?.text || colors.text} />
        </TouchableOpacity>
        <Text style={[themedStyles.title, { color: themeColors?.text || colors.text }]}>
          New Group
        </Text>
        <View style={themedStyles.spacer} />
      </View>

      <PlatformScrollView
        style={themedStyles.scroll}
        contentContainerStyle={[
          themedStyles.body,
          {
            paddingBottom: spacing.xxxl + Math.max(insets.bottom, spacing.md),
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            themedStyles.sectionCard,
            {
              borderColor: themeColors?.border || colors.border,
              backgroundColor: themeColors?.card || colors.card,
            },
          ]}
        >
          <TextInput
            style={[
              themedStyles.input,
              {
                borderColor: themeColors?.border || colors.border,
                color: themeColors?.text || colors.text,
                backgroundColor: themeColors?.inputBackground || colors.inputBackground,
              },
            ]}
            placeholder="Group name"
            placeholderTextColor={themeColors?.textLight || colors.textLight}
            value={groupName}
            onChangeText={setGroupName}
            maxLength={60}
            autoCapitalize="words"
            returnKeyType="done"
          />
          <Text style={[themedStyles.helperText, { color: themeColors?.textSecondary || colors.textSecondary }]}>
            Choose a clear name so friends instantly recognize this group.
          </Text>
        </View>

        <View
          style={[
            themedStyles.sectionCard,
            {
              borderColor: themeColors?.border || colors.border,
              backgroundColor: themeColors?.card || colors.card,
            },
          ]}
        >
          <Text style={[themedStyles.sectionTitle, { color: themeColors?.text || colors.text }]}>
            Sharing
          </Text>
          <TouchableOpacity
            style={themedStyles.rowLine}
            onPress={() => setShowInvitePicker((prev) => !prev)}
            activeOpacity={0.85}
          >
            <Text style={[themedStyles.rowLabel, { color: themeColors?.text || colors.text }]}>
              Invite friends
            </Text>
            <Text style={[themedStyles.rowValue, { color: themeColors?.textSecondary || colors.textSecondary }]}>
              {selectedFriendIds.length ? `${selectedFriendIds.length} selected` : 'None'}
            </Text>
          </TouchableOpacity>

          {showInvitePicker ? (
            <View
              style={[
                themedStyles.inlineSheet,
                {
                  borderColor: themeColors?.border || colors.border,
                  backgroundColor: themeColors?.inputBackground || colors.inputBackground,
                },
              ]}
            >
              {!dedupedFriends.length ? (
                <Text style={[themedStyles.shareHint, { color: themeColors?.textLight || colors.textLight }]}>
                  No friends to invite yet.
                </Text>
              ) : (
                dedupedFriends.map((friend) => {
                  const invited = selectedFriendIds.includes(friend.id);
                  return (
                    <View key={friend.id} style={themedStyles.friendRow}>
                      <View style={themedStyles.friendTextWrap}>
                        <Text
                          style={[themedStyles.friendName, { color: themeColors?.text || colors.text }]}
                          numberOfLines={1}
                        >
                          {friend.name || friend.username || 'Friend'}
                        </Text>
                        <Text
                          style={[
                            themedStyles.friendUsername,
                            { color: themeColors?.textSecondary || colors.textSecondary },
                          ]}
                          numberOfLines={1}
                        >
                          {friend.username ? `@${friend.username}` : ''}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={[
                          themedStyles.friendAction,
                          {
                            borderColor: invited ? GROUP_ACCENT : themeColors?.border || colors.border,
                            backgroundColor: invited ? GROUP_ACCENT : themeColors?.card || colors.card,
                          },
                        ]}
                        onPress={() => toggleInvitedFriend(friend.id)}
                        activeOpacity={0.85}
                      >
                        <Text
                          style={[
                            themedStyles.friendActionText,
                            {
                              color: invited ? '#FFFFFF' : themeColors?.textSecondary || colors.textSecondary,
                            },
                          ]}
                        >
                          {invited ? 'Invited' : 'Invite'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                })
              )}
              <Text style={[themedStyles.shareHint, { color: themeColors?.textSecondary || colors.textSecondary }]}>
                Invites are sent after the group is created.
              </Text>
            </View>
          ) : null}
        </View>

        <TouchableOpacity
          style={[themedStyles.saveButton, !canSubmit && themedStyles.saveButtonDisabled]}
          onPress={handleCreateGroup}
          disabled={!canSubmit}
          activeOpacity={0.9}
        >
          <LinearGradient colors={GROUP_GRADIENT} style={themedStyles.saveButtonGradient}>
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={themedStyles.saveButtonText}>
                {isPremiumUser ? 'Create group' : 'Unlock with Premium'}
              </Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </PlatformScrollView>
    </View>
  );
};

const createStyles = (themeColorsParam = colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.md,
    },
    iconButton: {
      width: 38,
      height: 38,
      borderRadius: 19,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      ...typography.h3,
      fontWeight: '700',
    },
    spacer: {
      width: 38,
      height: 38,
    },
    scroll: {
      flex: 1,
    },
    body: {
      paddingHorizontal: spacing.lg,
    },
    sectionCard: {
      borderRadius: borderRadius.xl,
      borderWidth: 1,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    input: {
      borderWidth: 1,
      borderRadius: borderRadius.md,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      ...typography.body,
    },
    helperText: {
      ...typography.caption,
      marginTop: spacing.xs,
    },
    sectionTitle: {
      ...typography.body,
      fontWeight: '700',
      marginBottom: spacing.sm,
    },
    rowLine: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: themeColorsParam?.border || 'rgba(120,120,120,0.25)',
    },
    rowLabel: {
      ...typography.body,
      fontWeight: '600',
      flex: 1,
      marginRight: spacing.sm,
    },
    rowValue: {
      ...typography.bodySmall,
      fontWeight: '600',
    },
    inlineSheet: {
      borderWidth: 1,
      borderRadius: borderRadius.md,
      padding: spacing.sm,
      marginTop: spacing.sm,
    },
    friendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    friendTextWrap: {
      flex: 1,
      marginRight: spacing.sm,
    },
    friendName: {
      ...typography.body,
      fontWeight: '600',
    },
    friendUsername: {
      ...typography.caption,
      marginTop: 2,
    },
    friendAction: {
      borderWidth: 1,
      borderRadius: borderRadius.full,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.md,
    },
    friendActionText: {
      ...typography.bodySmall,
      fontWeight: '700',
    },
    shareHint: {
      ...typography.caption,
      marginTop: spacing.xs,
    },
    saveButton: {
      borderRadius: borderRadius.full,
      overflow: 'hidden',
      marginTop: spacing.sm,
      marginBottom: spacing.xl,
    },
    saveButtonDisabled: {
      opacity: 0.55,
    },
    saveButtonGradient: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
    },
    saveButtonText: {
      ...typography.body,
      color: '#FFFFFF',
      fontWeight: '700',
    },
  });

export default CreateGroupScreen;
