import React from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

const TermsAndConditions = () => {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms & Conditions</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Terms and Conditions</Text>
          <Text style={styles.lastUpdated}>Last updated: {new Date().toLocaleDateString()}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Acceptance of Terms</Text>
          <Text style={styles.text}>
            By accessing and using the Only2U mobile application, you accept and agree to be bound
            by the terms and provision of this agreement. If you do not agree to abide by the above,
            please do not use this service.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Use License</Text>
          <Text style={styles.text}>
            Permission is granted to temporarily download one copy of the Only2U app for personal,
            non-commercial transitory viewing only. This is the grant of a license, not a transfer
            of title, and under this license you may not:
          </Text>
          <Text style={styles.bulletPoint}>• Modify or copy the materials</Text>
          <Text style={styles.bulletPoint}>• Use the materials for any commercial purpose</Text>
          <Text style={styles.bulletPoint}>• Attempt to reverse engineer any software</Text>
          <Text style={styles.bulletPoint}>• Remove any copyright or proprietary notations</Text>
          <Text style={styles.bulletPoint}>• Transfer the materials to another person</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. User Account</Text>
          <Text style={styles.text}>
            To access certain features of the app, you must create an account. You are responsible
            for:
          </Text>
          <Text style={styles.bulletPoint}>• Providing accurate and complete information</Text>
          <Text style={styles.bulletPoint}>• Maintaining the security of your account</Text>
          <Text style={styles.bulletPoint}>• All activities that occur under your account</Text>
          <Text style={styles.bulletPoint}>• Notifying us immediately of any unauthorized use</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. User Conduct</Text>
          <Text style={styles.text}>You agree not to use the app to:</Text>
          <Text style={styles.bulletPoint}>• Violate any applicable laws or regulations</Text>
          <Text style={styles.bulletPoint}>• Infringe upon the rights of others</Text>
          <Text style={styles.bulletPoint}>• Upload harmful or malicious content</Text>
          <Text style={styles.bulletPoint}>• Attempt to gain unauthorized access</Text>
          <Text style={styles.bulletPoint}>• Interfere with the app's functionality</Text>
          <Text style={styles.bulletPoint}>
            • Use AI features to create deepfakes or misleading content
          </Text>
          <Text style={styles.bulletPoint}>• Use face swap features without proper consent</Text>
          <Text style={styles.bulletPoint}>• Impersonate others or create false identities</Text>
          <Text style={styles.bulletPoint}>• Share AI-generated content without permission</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. AI and Face Swap Features</Text>
          <Text style={styles.text}>
            Our app includes AI-powered face swap technology. When using these features:
          </Text>
          <Text style={styles.bulletPoint}>
            • You must only use your own face or faces you have explicit permission to use
          </Text>
          <Text style={styles.bulletPoint}>
            • You are responsible for obtaining consent from individuals whose faces you use
          </Text>
          <Text style={styles.bulletPoint}>
            • AI-generated content is for personal visualization only
          </Text>
          <Text style={styles.bulletPoint}>
            • You may not use face swap features to impersonate others
          </Text>
          <Text style={styles.bulletPoint}>
            • We reserve the right to remove inappropriate AI-generated content
          </Text>
          <Text style={styles.bulletPoint}>
            • Face swap results are not guaranteed to be accurate
          </Text>
          <Text style={styles.bulletPoint}>
            • You agree not to create or share deepfakes or misleading content
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6. User-Generated Content</Text>
          <Text style={styles.text}>
            When you upload content, including face swap images, reviews, or other user-generated
            content:
          </Text>
          <Text style={styles.bulletPoint}>• You retain ownership of your original content</Text>
          <Text style={styles.bulletPoint}>
            • You grant us a worldwide, non-exclusive license to use your content
          </Text>
          <Text style={styles.bulletPoint}>
            • You must not upload content that infringes on others' rights
          </Text>
          <Text style={styles.bulletPoint}>• We may moderate and remove inappropriate content</Text>
          <Text style={styles.bulletPoint}>
            • You are responsible for the accuracy and legality of your content
          </Text>
          <Text style={styles.bulletPoint}>
            • We may use your content for marketing and promotional purposes
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>7. Product Information</Text>
          <Text style={styles.text}>
            While we strive to provide accurate product information, we do not warrant that product
            descriptions, colors, information, or other content available on the app is accurate,
            complete, reliable, current, or error-free.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>8. Pricing and Payment</Text>
          <Text style={styles.text}>
            All prices are subject to change without notice. Payment must be made at the time of
            order placement. We reserve the right to refuse service to anyone for any reason.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>9. Intellectual Property</Text>
          <Text style={styles.text}>
            The app and its original content, features, and functionality are owned by Only2U and
            are protected by international copyright, trademark, patent, trade secret, and other
            intellectual property laws.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>10. Privacy Policy</Text>
          <Text style={styles.text}>
            Your privacy is important to us. Please review our Privacy Policy, which also governs
            your use of the app, to understand our practices.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>11. Disclaimers</Text>
          <Text style={styles.text}>
            The app is provided on an "as is" and "as available" basis. We make no warranties,
            expressed or implied, and hereby disclaim all warranties, including without limitation
            implied warranties of merchantability and fitness for a particular purpose.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>12. Limitation of Liability</Text>
          <Text style={styles.text}>
            In no event shall Only2U be liable for any damages arising out of the use or inability
            to use the app, even if we have been notified orally or in writing of the possibility of
            such damage.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>13. Modifications</Text>
          <Text style={styles.text}>
            We reserve the right to modify or discontinue the app at any time without notice. We
            shall not be liable to you or any third party for any modification, suspension, or
            discontinuance of the app.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>14. Governing Law</Text>
          <Text style={styles.text}>
            These terms shall be governed by and construed in accordance with the laws of the
            jurisdiction in which Only2U operates, without regard to its conflict of law provisions.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>15. Contact Information</Text>
          <Text style={styles.text}>
            If you have any questions about these Terms and Conditions, please contact us at:
          </Text>
          <Text style={styles.sectionTitle}>
            16. This business is a a unit of subhamsthu shopping mall pvt Ltd
          </Text>
          <Text style={styles.contactInfo}>Email: legal@only2u.com</Text>
          <Text style={styles.contactInfo}>Phone: +91 98111 50757</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#fff',
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  placeholder: {
    width: 34,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  lastUpdated: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 15,
  },
  text: {
    fontSize: 15,
    color: '#444',
    lineHeight: 22,
    marginBottom: 10,
  },
  bulletPoint: {
    fontSize: 15,
    color: '#444',
    lineHeight: 22,
    marginLeft: 10,
    marginBottom: 5,
  },
  contactInfo: {
    fontSize: 15,
    color: '#F53F7A',
    fontWeight: '500',
    marginTop: 5,
  },
});

export default TermsAndConditions;
