import React from 'react';
import {
  View,
  Modal as RNModal,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Text,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { supabase } from '../utils/supabaseClient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, shadows, borderRadius, spacing, typography } from '../utils/theme';
import { useApp } from '../context/AppContext';

const Modal = ({
  visible,
  onClose,
  title,
  children,
  showCloseButton = true,
  fullScreen = false,
}) => {
  const { themeColors } = useApp();
  const styles = React.useMemo(() => createStyles(themeColors), [themeColors]);
  const insets = useSafeAreaInsets();
  const bottomInset = insets.bottom > 0 ? insets.bottom : spacing.lg;
  const contentBottomPadding = bottomInset + spacing.xl;
  const headerTopOffset = fullScreen ? Math.max(insets.top, spacing.lg) : 0;
  const keyboardBehavior =
    Platform.OS === 'ios' ? 'padding' : fullScreen ? 'padding' : 'height';
  const contentTopPadding = 0;

  return (
    <RNModal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, fullScreen && styles.overlayFullScreen]}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>

        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <KeyboardAvoidingView
            behavior={keyboardBehavior}
            keyboardVerticalOffset={fullScreen ? insets.top : 0}
            style={[
              styles.modalContainer,
              fullScreen && styles.fullScreen,
              {
                paddingBottom: bottomInset,
                backgroundColor: themeColors.background,
              },
            ]}
          >
            <View
              style={[
                styles.header,
                fullScreen && { marginTop: headerTopOffset },
              ]}
            >
              <Text style={styles.title}>{title}</Text>
              {showCloseButton && (
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={onClose}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
            {fullScreen ? (
              <ScrollView
                style={[styles.content, styles.fullScreenContent]}
                contentContainerStyle={[
                  styles.fullScreenContentContainer,
                  { paddingBottom: contentBottomPadding, paddingTop: contentTopPadding },
                ]}
                showsVerticalScrollIndicator
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                nestedScrollEnabled
                overScrollMode="always"
                scrollEventThrottle={16}
              >
                {children}
              </ScrollView>
            ) : (
              <ScrollView
                style={styles.content}
                contentContainerStyle={{
                  paddingBottom: contentBottomPadding,
                  paddingTop: contentTopPadding,
                }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {children}
              </ScrollView>
            )}
          </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
      </View>
    </RNModal>
  );
};

const createStyles = (themeColors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    overlayFullScreen: {
      justifyContent: 'flex-start',
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
    },
    modalContainer: {
      backgroundColor: themeColors?.background || colors.card,
      borderTopLeftRadius: borderRadius.xl,
      borderTopRightRadius: borderRadius.xl,
      maxHeight: '90%',
      ...shadows.large,
    },
    fullScreen: {
      flex: 1,
      borderTopLeftRadius: 0,
      borderTopRightRadius: 0,
      maxHeight: '100%',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.xl,
      paddingBottom: spacing.md,
    },
    title: {
      ...typography.h3,
    },
    closeButton: {
      padding: spacing.xs,
    },
    content: {
      paddingHorizontal: spacing.xl,
    },
    fullScreenContent: {
      flex: 1,
    },
    fullScreenContentContainer: {
      flexGrow: 1,
      minHeight: '100%',
    },
  });

export default Modal;
