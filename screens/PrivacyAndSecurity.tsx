import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';

const PrivacyAndSecurity = () => {
  const { t } = useTranslation();
  return (
    <ScrollView style={{ backgroundColor: '#fff' }} contentContainerStyle={{ padding: 18 }}>
      <Text style={styles.title}>{t('privacy_and_security')}</Text>
      <Text style={styles.subtitle}>
        Your privacy and data security are important to us. Please read our policy below.
      </Text>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{t('privacy_policy')}</Text>
        <Text style={styles.text}>
          This is a dummy privacy policy for demonstration purposes. We are committed to protecting
          your personal information and your right to privacy. If you have any questions or concerns
          about our policy, or our practices with regards to your personal information, please
          contact us.
        </Text>
        <Text style={styles.text}>
          When you use our application, we may collect certain information about you, such as your
          name, email address, and usage data. This information is used solely for the purpose of
          providing and improving our services. We do not share your personal information with third
          parties except as necessary to provide our services or as required by law.
        </Text>
        <Text style={styles.text}>
          We use industry-standard security measures to protect your data. All sensitive information
          is encrypted and securely stored. You have the right to access, update, or delete your
          personal information at any time.
        </Text>
        <Text style={styles.text}>
          By using our application, you consent to our privacy policy and agree to its terms.
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#222',
    marginBottom: 2,
    marginTop: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#888',
    marginBottom: 18,
  },
  card: {
    backgroundColor: '#f7f7fa',
    borderRadius: 12,
    padding: 18,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e94f64',
    marginBottom: 10,
  },
  text: {
    fontSize: 15,
    color: '#444',
    marginBottom: 12,
    lineHeight: 22,
  },
});

export default PrivacyAndSecurity;
