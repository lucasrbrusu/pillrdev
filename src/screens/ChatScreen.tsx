import React, { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  TextStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { sendToAgent } from '../utils/agent';
import { borderRadius, colors, shadows, spacing, typography } from '../utils/theme';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
};

type ProposedAction = {
  type: string;
  payload: any;
};

const ChatScreen: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Hi there! Ask me anything about your routines, tasks, finances, or habits.',
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [proposedActions, setProposedActions] = useState<ProposedAction[]>([]);
  const listRef = useRef<FlatList<Message>>(null);
  const insets = useSafeAreaInsets();

  const styles = useMemo(() => createStyles(), []);

  const scrollToEnd = () => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  };

  const handleSend = async () => {
    const trimmed = inputText.trim();
    if (!trimmed || isSending) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: trimmed,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setIsSending(true);
    setError(null);

    try {
      const response = await sendToAgent(trimmed, conversationId);
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        text: response?.assistantText || 'I did not receive a response.',
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setProposedActions(response?.proposed_actions || []);

      const maybeConversationId = (response as any)?.conversationId;
      if (maybeConversationId) {
        setConversationId(maybeConversationId);
      }

      scrollToEnd();
    } catch (err: any) {
      setError(err?.message || 'Unable to reach the assistant right now.');
    } finally {
      setIsSending(false);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <View
      style={[
        styles.messageBubble,
        item.role === 'assistant' ? styles.assistantBubble : styles.userBubble,
      ]}
    >
      <Text
        style={[
          styles.messageText,
          item.role === 'assistant' ? styles.assistantText : styles.userText,
        ]}
      >
        {item.text}
      </Text>
    </View>
  );

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, spacing.md) },
      ]}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.header}>
          <Text style={styles.title}>AI Assistant</Text>
          <View style={styles.subtitleRow}>
            <Ionicons name="sparkles-outline" size={18} color={colors.primary} />
            <Text style={styles.subtitle}>Powered by your Supabase agent</Text>
          </View>
        </View>

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messagesContainer}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={scrollToEnd}
        />

        {proposedActions.length > 0 && (
          <View style={styles.actionsContainer}>
            <Text style={styles.actionsTitle}>Suggested actions</Text>
            <View style={styles.actionsRow}>
              {proposedActions.map((action, index) => (
                <View key={`${action.type}-${index}`} style={styles.actionChip}>
                  <Text style={styles.actionChipText}>{action.type}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.inputContainer}>
          <TextInput
            value={inputText}
            onChangeText={setInputText}
            placeholder="Type a message..."
            placeholderTextColor={colors.placeholder}
            style={styles.textInput}
            multiline
            onSubmitEditing={handleSend}
            blurOnSubmit={false}
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={!inputText.trim() || isSending}
            style={[
              styles.sendButton,
              (!inputText.trim() || isSending) && styles.sendButtonDisabled,
            ]}
          >
            {isSending ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Ionicons name="send" size={18} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const asTextStyle = (style: any): TextStyle => style as TextStyle;

const createStyles = () =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    flex: {
      flex: 1,
    },
    header: {
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.sm,
      paddingTop: spacing.md,
    },
    title: {
      ...asTextStyle(typography.h2),
    },
    subtitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: spacing.xs,
    },
    subtitle: {
      ...asTextStyle(typography.bodySmall),
      marginLeft: spacing.xs,
      color: colors.textSecondary,
    },
    messagesContainer: {
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.lg,
    },
    messageBubble: {
      padding: spacing.md,
      borderRadius: borderRadius.lg,
      marginBottom: spacing.sm,
      maxWidth: '90%',
      ...shadows.small,
    },
    userBubble: {
      alignSelf: 'flex-end',
      backgroundColor: colors.primary,
    },
    assistantBubble: {
      alignSelf: 'flex-start',
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    messageText: {
      ...asTextStyle(typography.body),
    },
    userText: {
      color: '#FFFFFF',
    },
    assistantText: {
      color: colors.text,
    },
    actionsContainer: {
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.md,
    },
    actionsTitle: {
      ...asTextStyle(typography.label),
      marginBottom: spacing.xs,
      color: colors.textSecondary,
    },
    actionsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginHorizontal: -spacing.xs,
    },
    actionChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      backgroundColor: colors.inputBackground,
      borderRadius: borderRadius.full,
      marginHorizontal: spacing.xs,
      marginBottom: spacing.xs,
    },
    actionChipText: {
      ...asTextStyle(typography.bodySmall),
      color: colors.text,
    },
    errorText: {
      color: colors.danger,
      ...asTextStyle(typography.bodySmall),
      paddingHorizontal: spacing.xl,
      marginBottom: spacing.xs,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
      backgroundColor: colors.background,
    },
    textInput: {
      flex: 1,
      minHeight: 44,
      maxHeight: 120,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: colors.inputBackground,
      borderRadius: borderRadius.lg,
      ...asTextStyle(typography.body),
    },
    sendButton: {
      width: 44,
      height: 44,
      borderRadius: borderRadius.full,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: spacing.sm,
      ...shadows.medium,
    },
    sendButtonDisabled: {
      backgroundColor: colors.navInactive,
    },
  });

export default ChatScreen;
