import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { Modal, Button, Input, PlatformScrollView, Card } from '../components';
import {
  borderRadius,
  spacing,
  typography,
  shadows,
} from '../utils/theme';

const formatNoteDate = (value) => {
  if (!value) return 'No date';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'No date';
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const NotesScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const {
    notes,
    addNote,
    updateNote,
    deleteNote,
    verifyNotePassword,
    setNotePassword,
    themeName,
    themeColors,
    ensureNotesLoaded,
  } = useApp();

  const isDark = themeName === 'dark';
  const palette = useMemo(
    () => ({
      background: isDark ? '#120F1B' : '#F6F2FB',
      card: isDark ? '#1F1A2D' : '#FFFFFF',
      cardBorder: isDark ? '#3C3551' : '#E8DDF7',
      mutedSurface: isDark ? '#1A1626' : '#F8F4FC',
      text: themeColors.text,
      textMuted: themeColors.textSecondary,
      textLight: themeColors.textLight,
      accent: themeColors.finance || themeColors.tasks || themeColors.primary,
      statA: isDark ? '#2A2340' : '#F2EFFF',
      statABorder: isDark ? '#463866' : '#E1DAFF',
      statB: isDark ? '#1D3246' : '#EAF6FF',
      statBBorder: isDark ? '#2D4E6D' : '#CFE7FF',
    }),
    [isDark, themeColors]
  );

  const notesTheme = useMemo(
    () => ({
      iconBg: palette.accent,
      iconColor: '#FFFFFF',
      rowBg: palette.mutedSurface,
      rowBorder: palette.cardBorder,
      lockBg: isDark ? '#2A2340' : '#EFE7FF',
      lockColor: isDark ? '#D8B4FE' : themeColors.primary,
      chevron: themeColors.textLight,
    }),
    [isDark, palette, themeColors]
  );

  const styles = useMemo(
    () => createStyles(themeColors, palette),
    [themeColors, palette]
  );

  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showNoteDetailModal, setShowNoteDetailModal] = useState(false);
  const [showNoteSecurityModal, setShowNoteSecurityModal] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [selectedNote, setSelectedNote] = useState(null);
  const [noteToUnlock, setNoteToUnlock] = useState(null);
  const [unlockedNoteIds, setUnlockedNoteIds] = useState([]);
  const [noteTitleDraft, setNoteTitleDraft] = useState('');
  const [noteContentDraft, setNoteContentDraft] = useState('');
  const [currentNotePassword, setCurrentNotePassword] = useState('');
  const [newNotePassword, setNewNotePassword] = useState('');
  const [confirmNotePassword, setConfirmNotePassword] = useState('');
  const [securityError, setSecurityError] = useState('');
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteBodyViewportHeight, setNoteBodyViewportHeight] = useState(0);
  const [noteTitleHeight, setNoteTitleHeight] = useState(0);
  const [noteContentMeasuredHeight, setNoteContentMeasuredHeight] = useState(0);
  const [isNoteEditing, setIsNoteEditing] = useState(false);
  const noteContentInputRef = useRef(null);

  const sortedNotes = useMemo(
    () =>
      [...(notes || [])].sort(
        (a, b) =>
          new Date(b.updatedAt || b.createdAt || 0) -
          new Date(a.updatedAt || a.createdAt || 0)
      ),
    [notes]
  );
  const totalLockedNotes = useMemo(
    () => sortedNotes.filter((note) => !!note.password).length,
    [sortedNotes]
  );
  const noteContentMinHeight = useMemo(() => {
    if (!noteBodyViewportHeight) return 260;
    const verticalPadding = spacing.md + spacing.xxxl;
    const availableHeight =
      noteBodyViewportHeight - noteTitleHeight - verticalPadding - spacing.md;
    return Math.max(260, availableHeight);
  }, [noteBodyViewportHeight, noteTitleHeight]);
  const noteContentHeight = useMemo(
    () => Math.max(noteContentMinHeight, noteContentMeasuredHeight + spacing.md),
    [noteContentMinHeight, noteContentMeasuredHeight]
  );

  useEffect(() => {
    ensureNotesLoaded();
  }, [ensureNotesLoaded]);

  const resetNoteForm = () => {
    setNoteTitle('');
    setNoteContent('');
  };

  const resetSecurityForm = () => {
    setCurrentNotePassword('');
    setNewNotePassword('');
    setConfirmNotePassword('');
    setSecurityError('');
  };

  const handleCreateNote = async () => {
    if (!noteTitle.trim()) return;
    await addNote({
      title: noteTitle.trim(),
      content: noteContent,
    });
    resetNoteForm();
    setShowNoteModal(false);
  };

  const closeNoteDetail = () => {
    setShowNoteDetailModal(false);
    setSelectedNote(null);
    setNoteTitleDraft('');
    setNoteContentDraft('');
    setNoteBodyViewportHeight(0);
    setNoteTitleHeight(0);
    setNoteContentMeasuredHeight(0);
    setIsNoteEditing(false);
  };

  const handleNotePress = (note) => {
    if (note.password && !unlockedNoteIds.includes(note.id)) {
      setNoteToUnlock(note);
      setShowUnlockModal(true);
      return;
    }
    setSelectedNote(note);
    setShowNoteDetailModal(true);
    setIsNoteEditing(false);
    setNoteTitleDraft(note.title || '');
    setNoteContentDraft(note.content || '');
  };

  const handleDeleteNote = () => {
    if (!selectedNote) return;
    Alert.alert(
      'Delete note',
      'Are you sure you want to delete this note?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteNote(selectedNote.id);
            closeNoteDetail();
          },
        },
      ]
    );
  };

  const handleSaveNote = async () => {
    if (!selectedNote) return;
    const updates = {
      title: noteTitleDraft || 'Untitled note',
      content: noteContentDraft,
    };
    await updateNote(selectedNote.id, updates);
    setSelectedNote((prev) => (prev ? { ...prev, ...updates } : prev));
    closeNoteDetail();
  };

  const handleUnlockNote = () => {
    if (!noteToUnlock) return;
    setShowUnlockModal(false);
    setShowNoteDetailModal(true);
    setSelectedNote(noteToUnlock);
    setIsNoteEditing(false);
    setNoteTitleDraft(noteToUnlock.title || '');
    setNoteContentDraft(noteToUnlock.content || '');
    setUnlockedNoteIds([...unlockedNoteIds, noteToUnlock.id]);
    setNoteToUnlock(null);
  };

  const handleSetNoteViewMode = () => {
    if (!isNoteEditing) return;
    setIsNoteEditing(false);
    Keyboard.dismiss();
  };

  const handleSetNoteEditMode = () => {
    if (isNoteEditing) return;
    setIsNoteEditing(true);
    setTimeout(() => {
      noteContentInputRef.current?.focus();
    }, 0);
  };

  const handleManageSecurity = (note) => {
    setSelectedNote(note);
    resetSecurityForm();
    setShowNoteSecurityModal(true);
  };

  const handleSaveNotePassword = async () => {
    if (!selectedNote) return;
    setSecurityError('');

    try {
      if (selectedNote.password && !currentNotePassword) {
        setSecurityError('Enter current password to change it.');
        return;
      }
      if (!newNotePassword) {
        setSecurityError('Enter a new password.');
        return;
      }
      if (newNotePassword !== confirmNotePassword) {
        setSecurityError('New passwords do not match.');
        return;
      }

      await setNotePassword(selectedNote.id, newNotePassword, currentNotePassword);
      setShowNoteSecurityModal(false);
      setUnlockedNoteIds(unlockedNoteIds.filter((id) => id !== selectedNote.id));
    } catch (err) {
      setSecurityError(err?.message || 'Unable to update password.');
    }
  };

  const handleRemoveNotePassword = async () => {
    if (!selectedNote) return;
    setSecurityError('');
    try {
      await setNotePassword(selectedNote.id, null, currentNotePassword);
      setShowNoteSecurityModal(false);
      setUnlockedNoteIds(unlockedNoteIds.filter((id) => id !== selectedNote.id));
    } catch (err) {
      setSecurityError(err?.message || 'Unable to remove password.');
    }
  };

  useEffect(() => {
    if (selectedNote) {
      setNoteTitleDraft(selectedNote.title || '');
      setNoteContentDraft(selectedNote.content || '');
    } else {
      setNoteTitleDraft('');
      setNoteContentDraft('');
    }
  }, [selectedNote]);

  useEffect(() => {
    const targetId = route.params?.noteId;
    if (!targetId) return;
    const targetNote = sortedNotes.find((n) => n.id === targetId);
    if (targetNote) {
      if (targetNote.password && !unlockedNoteIds.includes(targetNote.id)) {
        setNoteToUnlock(targetNote);
        setShowUnlockModal(true);
      } else {
        setSelectedNote(targetNote);
        setShowNoteDetailModal(true);
        setNoteTitleDraft(targetNote.title || '');
        setNoteContentDraft(targetNote.content || '');
      }
    }
    navigation.setParams?.({ noteId: undefined });
  }, [route.params?.noteId, sortedNotes, unlockedNoteIds, navigation]);

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top,
          backgroundColor: palette.background,
        },
      ]}
    >
      <PlatformScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        alwaysBounceVertical
        bounces
      >
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              style={[
                styles.headerBackButton,
                {
                  borderColor: palette.cardBorder,
                  backgroundColor: palette.card,
                },
              ]}
              onPress={() => navigation.goBack()}
              activeOpacity={0.85}
            >
              <Ionicons name="chevron-back" size={20} color={palette.text} />
            </TouchableOpacity>
            <View>
              <Text style={[styles.pageTitle, { color: palette.text }]}>Notes</Text>
              <Text style={[styles.pageSubtitle, { color: palette.textMuted }]}>
                Keep ideas, reminders, and details in one place
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.headerAddButton, { backgroundColor: palette.accent }]}
            onPress={() => setShowNoteModal(true)}
            activeOpacity={0.85}
          >
            <Ionicons name="add" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.statsRow}>
          <Card style={[styles.statCard, { backgroundColor: palette.statA, borderColor: palette.statABorder }]}>
            <Text style={styles.statValue}>{sortedNotes.length}</Text>
            <Text style={styles.statLabel}>Notes</Text>
          </Card>
          <Card style={[styles.statCard, { backgroundColor: palette.statB, borderColor: palette.statBBorder }]}>
            <Text style={styles.statValue}>{totalLockedNotes}</Text>
            <Text style={styles.statLabel}>Locked</Text>
          </Card>
        </View>

        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: palette.mutedSurface,
              borderColor: palette.cardBorder,
            },
          ]}
        >
          <Text style={styles.heroTitle}>Write once, find fast.</Text>
          <Text style={styles.heroSubtitle}>
            Open any note to edit, add security, or clean up finished notes.
          </Text>
        </View>

        <View
          style={[
            styles.sectionCard,
            { backgroundColor: palette.card, borderColor: palette.cardBorder },
          ]}
        >
          {sortedNotes.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="document-text-outline" size={46} color={palette.textLight} />
              <Text style={styles.emptyTitle}>No notes yet</Text>
              <Text style={styles.emptySubtitle}>Create your first note to get started.</Text>
              <Button
                title="Create Note"
                variant="secondary"
                icon="document-text-outline"
                onPress={() => setShowNoteModal(true)}
                style={styles.createNoteEmptyButton}
              />
            </View>
          ) : (
            sortedNotes.map((note) => (
              <View key={note.id} style={styles.noteRow}>
                <TouchableOpacity
                  style={[
                    styles.noteCard,
                    {
                      backgroundColor: notesTheme.rowBg,
                      borderColor: notesTheme.rowBorder,
                    },
                  ]}
                  onPress={() => handleNotePress(note)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.noteIcon, { backgroundColor: notesTheme.iconBg }]}>
                    <Feather name="file-text" size={18} color={notesTheme.iconColor} />
                  </View>
                  <View style={styles.noteInfo}>
                    <Text style={styles.noteTitle} numberOfLines={1}>
                      {note.title || 'Untitled note'}
                    </Text>
                    <View style={styles.noteMetaRow}>
                      <Text style={styles.noteMeta}>{formatNoteDate(note.updatedAt || note.createdAt)}</Text>
                      {note.password ? (
                        <View style={styles.lockBadge}>
                          <Ionicons name="lock-closed" size={11} color={notesTheme.lockColor} />
                          <Text style={[styles.lockBadgeText, { color: notesTheme.lockColor }]}>Locked</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={notesTheme.chevron} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.lockButton,
                    {
                      backgroundColor: notesTheme.lockBg,
                      borderColor: notesTheme.rowBorder,
                    },
                  ]}
                  onPress={() => handleManageSecurity(note)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={note.password ? 'lock-closed' : 'lock-open'}
                    size={17}
                    color={note.password ? notesTheme.lockColor : palette.textMuted}
                  />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      </PlatformScrollView>

      <Modal
        visible={showNoteModal}
        onClose={() => {
          setShowNoteModal(false);
          resetNoteForm();
        }}
        title="New Note"
        fullScreen
      >
        <View style={styles.noteForm}>
          <View style={styles.modalButtons}>
            <Button
              title="Cancel"
              variant="secondary"
              onPress={() => {
                setShowNoteModal(false);
                resetNoteForm();
              }}
              style={styles.modalButton}
            />
            <Button
              title="Create"
              onPress={handleCreateNote}
              disabled={!noteTitle.trim()}
              style={styles.modalButton}
            />
          </View>

          <Input
            value={noteTitle}
            onChangeText={setNoteTitle}
            placeholder="Title"
            style={styles.noteFieldContainer}
            inputStyle={styles.noteFieldInput}
            containerStyle={styles.noteFieldWrapper}
          />

          <Input
            value={noteContent}
            onChangeText={setNoteContent}
            placeholder="Start writing..."
            multiline
            numberOfLines={16}
            style={styles.noteFieldContainer}
            inputStyle={[styles.noteContentInput, styles.noteFieldInput]}
            containerStyle={styles.noteContentWrapper}
          />
        </View>
      </Modal>

      <Modal
        visible={showNoteDetailModal}
        onClose={closeNoteDetail}
        title=""
        fullScreen
        hideHeader
        showCloseButton={false}
        scrollEnabled={false}
      >
        {selectedNote && (
          <View style={styles.noteDetailContainer}>
            <View
              style={[
                styles.noteDetailHeader,
                { paddingTop: Math.max(insets.top, spacing.sm) },
              ]}
            >
              <TouchableOpacity
                onPress={closeNoteDetail}
                style={[styles.noteHeaderButton, styles.noteHeaderBackButton]}
                accessibilityLabel="Close note"
              >
                <Ionicons name="chevron-back" size={20} color={themeColors.text} />
              </TouchableOpacity>
              <View style={styles.noteHeaderActions}>
                <TouchableOpacity
                  onPress={isNoteEditing ? handleSetNoteViewMode : handleSetNoteEditMode}
                  style={styles.noteModeToggleButton}
                  accessibilityLabel={
                    isNoteEditing ? 'Switch to view mode' : 'Switch to edit mode'
                  }
                >
                  <Text style={styles.noteModeToggleText}>
                    {isNoteEditing ? 'View' : 'Edit'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleDeleteNote}
                  style={[styles.noteHeaderButton, styles.noteDeleteButton]}
                  accessibilityLabel="Delete note"
                >
                  <Ionicons name="trash-outline" size={19} color={themeColors.danger} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSaveNote}
                  style={[styles.noteHeaderButton, styles.noteDoneButton]}
                  accessibilityLabel="Save note"
                >
                  <Ionicons name="checkmark" size={20} color={themeColors.primary} />
                </TouchableOpacity>
              </View>
            </View>
            <PlatformScrollView
              style={styles.noteEditBody}
              contentContainerStyle={styles.noteEditBodyContent}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="none"
              keyboardAutoScrollEnabled={false}
              showsVerticalScrollIndicator={false}
              onLayout={(event) =>
                setNoteBodyViewportHeight(event?.nativeEvent?.layout?.height || 0)
              }
            >
              {isNoteEditing ? (
                <>
                  <TextInput
                    value={noteTitleDraft}
                    onChangeText={setNoteTitleDraft}
                    placeholder="Title"
                    placeholderTextColor={themeColors.textSecondary}
                    style={styles.noteEditTitle}
                    onLayout={(event) =>
                      setNoteTitleHeight(event?.nativeEvent?.layout?.height || 0)
                    }
                  />
                  <TextInput
                    ref={noteContentInputRef}
                    value={noteContentDraft}
                    onChangeText={setNoteContentDraft}
                    placeholder="Start writing..."
                    placeholderTextColor={themeColors.textSecondary}
                    style={[
                      styles.noteEditContent,
                      {
                        minHeight: noteContentMinHeight,
                        height: noteContentHeight,
                      },
                    ]}
                    multiline
                    textAlignVertical="top"
                    scrollEnabled={false}
                    onContentSizeChange={(event) => {
                      const nextHeight = event?.nativeEvent?.contentSize?.height || 0;
                      if (Math.abs(nextHeight - noteContentMeasuredHeight) > 1) {
                        setNoteContentMeasuredHeight(nextHeight);
                      }
                    }}
                  />
                </>
              ) : (
                <View style={styles.noteReadModeContainer}>
                  <Text style={styles.noteEditTitle}>
                    {noteTitleDraft?.trim() ? noteTitleDraft : 'Untitled note'}
                  </Text>
                  <Text
                    style={[
                      styles.noteReadContent,
                      !noteContentDraft?.trim() && styles.noteReadContentEmpty,
                    ]}
                  >
                    {noteContentDraft?.trim()
                      ? noteContentDraft
                      : 'No content yet.'}
                  </Text>
                </View>
              )}
            </PlatformScrollView>
          </View>
        )}
      </Modal>

      <Modal
        visible={showNoteSecurityModal}
        onClose={() => {
          setShowNoteSecurityModal(false);
          resetSecurityForm();
        }}
        title="Note Security"
        fullScreen
      >
        {selectedNote && (
          <>
            <Text style={styles.inputLabel}>Note</Text>
            <Text style={styles.detailTitle}>{selectedNote.title}</Text>
            <View style={styles.securitySection}>
              {selectedNote.password && (
                <Input
                  label="Current Password"
                  value={currentNotePassword}
                  onChangeText={setCurrentNotePassword}
                  secureTextEntry
                  placeholder="Enter current password"
                />
              )}
              <Input
                label="New Password"
                value={newNotePassword}
                onChangeText={setNewNotePassword}
                secureTextEntry
                placeholder="Enter new password"
              />
              <Input
                label="Confirm New Password"
                value={confirmNotePassword}
                onChangeText={setConfirmNotePassword}
                secureTextEntry
                placeholder="Re-enter new password"
              />
              {securityError ? <Text style={styles.errorText}>{securityError}</Text> : null}
              <View style={styles.modalButtons}>
                <Button
                  title="Cancel"
                  variant="secondary"
                  onPress={() => {
                    setShowNoteSecurityModal(false);
                    resetSecurityForm();
                  }}
                  style={styles.modalButton}
                />
                <Button
                  title="Save Password"
                  onPress={handleSaveNotePassword}
                  style={styles.modalButton}
                />
              </View>
              {selectedNote.password && (
                <Button
                  title="Remove Password"
                  variant="outline"
                  onPress={handleRemoveNotePassword}
                />
              )}
            </View>
          </>
        )}
      </Modal>

      <Modal
        visible={showUnlockModal}
        onClose={() => {
          setShowUnlockModal(false);
          setNoteToUnlock(null);
          setCurrentNotePassword('');
          setSecurityError('');
        }}
        title="Unlock Note"
      >
        {noteToUnlock && (
          <>
            <Text style={styles.detailTitle}>{noteToUnlock.title}</Text>
            <Input
              label="Password"
              value={currentNotePassword}
              onChangeText={setCurrentNotePassword}
              secureTextEntry
              placeholder="Enter password"
            />
            {securityError ? <Text style={styles.errorText}>{securityError}</Text> : null}
            <View style={styles.modalButtons}>
              <Button
                title="Cancel"
                variant="secondary"
                onPress={() => {
                  setShowUnlockModal(false);
                  setNoteToUnlock(null);
                  setCurrentNotePassword('');
                  setSecurityError('');
                }}
                style={styles.modalButton}
              />
              <Button
                title="Unlock"
                onPress={() => {
                  if (!verifyNotePassword(noteToUnlock.id, currentNotePassword)) {
                    setSecurityError('Incorrect password.');
                    return;
                  }
                  setSecurityError('');
                  handleUnlockNote();
                  setCurrentNotePassword('');
                }}
                style={styles.modalButton}
              />
            </View>
          </>
        )}
      </Modal>
    </View>
  );
};

const createStyles = (themeColors, palette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: palette.background,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: spacing.lg,
      paddingBottom: 120,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      marginRight: spacing.md,
    },
    headerBackButton: {
      width: 38,
      height: 38,
      borderRadius: 19,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.sm,
    },
    pageTitle: {
      ...typography.h1,
      fontSize: 34,
      fontWeight: '700',
    },
    pageSubtitle: {
      ...typography.bodySmall,
      marginTop: 2,
    },
    headerAddButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      ...shadows.small,
    },
    statsRow: {
      flexDirection: 'row',
      marginBottom: spacing.md,
    },
    statCard: {
      flex: 1,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      padding: spacing.md,
      marginHorizontal: 4,
    },
    statValue: {
      ...typography.h2,
      marginTop: 2,
      fontWeight: '700',
      color: palette.text,
    },
    statLabel: {
      ...typography.caption,
      marginTop: spacing.xs,
      color: palette.textMuted,
    },
    heroCard: {
      borderWidth: 1,
      borderRadius: borderRadius.xl,
      padding: spacing.lg,
      marginBottom: spacing.md,
    },
    heroTitle: {
      ...typography.h2,
      color: palette.text,
      fontWeight: '700',
    },
    heroSubtitle: {
      ...typography.bodySmall,
      color: palette.textMuted,
      marginTop: spacing.sm,
      lineHeight: 20,
    },
    sectionCard: {
      borderWidth: 1,
      borderRadius: borderRadius.xl,
      padding: spacing.md,
      marginBottom: spacing.xxxl,
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: spacing.xl,
    },
    emptyTitle: {
      ...typography.h3,
      color: palette.textMuted,
      marginTop: spacing.lg,
    },
    emptySubtitle: {
      ...typography.bodySmall,
      color: palette.textLight,
      marginTop: spacing.xs,
      textAlign: 'center',
    },
    createNoteEmptyButton: {
      marginTop: spacing.lg,
    },
    noteRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    noteCard: {
      flex: 1,
      borderWidth: 1,
      borderRadius: borderRadius.lg,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
    },
    noteIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    noteInfo: {
      flex: 1,
      marginLeft: spacing.md,
      marginRight: spacing.sm,
    },
    noteTitle: {
      ...typography.body,
      color: palette.text,
      fontWeight: '600',
    },
    noteMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: spacing.xs,
    },
    noteMeta: {
      ...typography.caption,
      color: palette.textMuted,
    },
    lockBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      marginLeft: spacing.sm,
    },
    lockBadgeText: {
      ...typography.caption,
      marginLeft: 4,
      fontWeight: '600',
    },
    lockButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      borderWidth: 1,
      marginLeft: spacing.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    noteForm: {
      flex: 1,
      justifyContent: 'flex-start',
      paddingBottom: spacing.xl,
      backgroundColor: palette.background,
      borderColor: palette.background,
      borderWidth: 1,
    },
    modalButtons: {
      flexDirection: 'row',
      marginTop: spacing.xl,
      marginBottom: spacing.lg,
    },
    modalButton: {
      flex: 1,
      marginHorizontal: spacing.xs,
    },
    noteFieldWrapper: {
      marginBottom: spacing.xs,
    },
    noteContentWrapper: {
      marginTop: spacing.xs,
      marginBottom: spacing.md,
    },
    noteFieldContainer: {
      backgroundColor: palette.background,
      borderWidth: 0,
      borderColor: palette.background,
      paddingHorizontal: 0,
    },
    noteFieldInput: {
      paddingVertical: spacing.md,
      color: palette.text,
    },
    noteContentInput: {
      minHeight: 240,
      textAlignVertical: 'top',
    },
    noteDetailContainer: {
      flex: 1,
      backgroundColor: themeColors.background,
    },
    noteDetailHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: spacing.xs,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: palette.cardBorder,
      backgroundColor: themeColors.background,
    },
    noteHeaderButton: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: themeColors.background,
    },
    noteHeaderBackButton: {
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: themeColors.background,
    },
    noteHeaderActions: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    noteDeleteButton: {
      marginRight: spacing.xs,
      borderWidth: 1,
      borderColor: themeColors.danger,
      backgroundColor: themeColors.background,
    },
    noteModeToggleButton: {
      minWidth: 54,
      height: 32,
      borderRadius: 16,
      paddingHorizontal: spacing.sm,
      borderWidth: 1,
      borderColor: themeColors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: `${themeColors.primary}1A`,
      marginRight: spacing.xs,
    },
    noteModeToggleText: {
      ...typography.caption,
      color: themeColors.primary,
      fontWeight: '600',
    },
    noteDoneButton: {
      borderWidth: 1,
      borderColor: themeColors.primary,
      backgroundColor: themeColors.background,
    },
    noteEditBody: {
      flex: 1,
      backgroundColor: themeColors.background,
    },
    noteEditBodyContent: {
      flexGrow: 1,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.xxxl,
      backgroundColor: themeColors.background,
    },
    noteEditTitle: {
      ...typography.h2,
      color: palette.text,
      marginBottom: spacing.md,
    },
    noteEditContent: {
      ...typography.body,
      color: palette.text,
      paddingVertical: spacing.sm,
      backgroundColor: themeColors.background,
      borderRadius: 0,
      minHeight: 0,
      lineHeight: 22,
    },
    noteReadModeContainer: {
      flexGrow: 1,
    },
    noteReadContent: {
      ...typography.body,
      color: palette.text,
      lineHeight: 22,
      paddingVertical: spacing.sm,
    },
    noteReadContentEmpty: {
      color: themeColors.textSecondary,
    },
    inputLabel: {
      ...typography.label,
      color: palette.text,
      marginBottom: spacing.sm,
    },
    detailTitle: {
      ...typography.h2,
      color: palette.text,
      marginBottom: spacing.sm,
    },
    securitySection: {
      marginTop: spacing.md,
    },
    errorText: {
      color: themeColors.danger,
      marginBottom: spacing.sm,
    },
  });

export default NotesScreen;
