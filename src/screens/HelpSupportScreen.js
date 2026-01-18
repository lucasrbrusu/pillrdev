import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { Card, Button } from '../components';
import { colors, spacing, typography } from '../utils/theme';

const WEBSITE_URL = 'https://pillarup.net';
const SUPPORT_EMAIL = 'pillarup@outlook.com';

const HelpSupportScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { themeColors, t } = useApp();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  const handleOpenLink = (url) => {
    Linking.openURL(url);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('Help & Support')}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>{t('Quick Links')}</Text>
          <Text style={styles.sectionSubtitle}>
            {t('Find more resources and updates on our website.')}
          </Text>
          <Button
            title="Visit PillarUp.net"
            icon="open-outline"
            variant="outline"
            onPress={() => handleOpenLink(WEBSITE_URL)}
            style={styles.linkButton}
            disableTranslation
            fullWidth
          />
        </Card>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>{t('Contact Support')}</Text>
          <Text style={styles.sectionSubtitle}>
            {t('Email us and we will get back to you soon.')}
          </Text>
          <Button
            title={SUPPORT_EMAIL}
            icon="mail-outline"
            variant="outline"
            onPress={() => handleOpenLink(`mailto:${SUPPORT_EMAIL}`)}
            disableTranslation
            fullWidth
          />
        </Card>
      </ScrollView>
    </View>
  );
};

const createStyles = (themeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: themeColors?.background || colors.background,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.xxl,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.lg,
    },
    backButton: {
      padding: spacing.xs,
    },
    headerTitle: {
      ...typography.h3,
    },
    headerSpacer: {
      width: 32,
    },
    card: {
      marginTop: spacing.md,
    },
    sectionTitle: {
      ...typography.h3,
      marginBottom: spacing.xs,
    },
    sectionSubtitle: {
      ...typography.bodySmall,
      color: colors.textSecondary,
      marginBottom: spacing.lg,
    },
    linkButton: {
      marginBottom: 0,
    },
  });

export default HelpSupportScreen;
