import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

const PrivacyPolicy = () => {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy Policy</Text>
          <Text style={styles.lastUpdated}>Last updated: {new Date().toLocaleDateString()}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Information We Collect</Text>
          <Text style={styles.text}>
            We collect information you provide directly to us, such as when you create an account, 
            make a purchase, use AI features, or contact us for support. This may include:
          </Text>
          <Text style={styles.bulletPoint}>• Personal information (name, email, phone number)</Text>
          <Text style={styles.bulletPoint}>• Payment information</Text>
          <Text style={styles.bulletPoint}>• Profile pictures and preferences</Text>
          <Text style={styles.bulletPoint}>• Body measurements and size preferences</Text>
          <Text style={styles.bulletPoint}>• Communication history</Text>
          <Text style={styles.bulletPoint}>• AI-generated content and face swap images</Text>
          <Text style={styles.bulletPoint}>• User-generated content and product reviews</Text>
          <Text style={styles.bulletPoint}>• Device information and usage analytics</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. How We Use Your Information</Text>
          <Text style={styles.text}>
            We use the information we collect to:
          </Text>
          <Text style={styles.bulletPoint}>• Provide and maintain our services</Text>
          <Text style={styles.bulletPoint}>• Process transactions and send confirmations</Text>
          <Text style={styles.bulletPoint}>• Personalize your experience</Text>
          <Text style={styles.bulletPoint}>• Send you updates and marketing communications</Text>
          <Text style={styles.bulletPoint}>• Respond to your comments and questions</Text>
          <Text style={styles.bulletPoint}>• Improve our services</Text>
          <Text style={styles.bulletPoint}>• Process AI face swap requests and generate personalized content</Text>
          <Text style={styles.bulletPoint}>• Moderate user-generated content and prevent misuse</Text>
          <Text style={styles.bulletPoint}>• Ensure compliance with our terms and applicable laws</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Information Sharing</Text>
          <Text style={styles.text}>
            We do not sell, trade, or otherwise transfer your personal information to third parties 
            without your consent, except in the following circumstances:
          </Text>
          <Text style={styles.bulletPoint}>• With service providers who assist in our operations</Text>
          <Text style={styles.bulletPoint}>• To comply with legal obligations</Text>
          <Text style={styles.bulletPoint}>• To protect our rights and safety</Text>
          <Text style={styles.bulletPoint}>• In connection with a business transfer</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. AI and Face Swap Features</Text>
          <Text style={styles.text}>
            Our app includes AI-powered face swap technology that allows you to visualize products 
            on your face. When using these features:
          </Text>
          <Text style={styles.bulletPoint}>• You must only use your own face or faces you have explicit permission to use</Text>
          <Text style={styles.bulletPoint}>• You are responsible for obtaining consent from individuals whose faces you use</Text>
          <Text style={styles.bulletPoint}>• We may store face swap images temporarily to provide the service</Text>
          <Text style={styles.bulletPoint}>• AI-generated content is for personal use only and may not be shared without permission</Text>
          <Text style={styles.bulletPoint}>• We reserve the right to remove content that violates our policies</Text>
          <Text style={styles.bulletPoint}>• Face swap images are processed securely and deleted after use</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. User-Generated Content</Text>
          <Text style={styles.text}>
            When you upload content, including face swap images and reviews:
          </Text>
          <Text style={styles.bulletPoint}>• You retain ownership of your original content</Text>
          <Text style={styles.bulletPoint}>• You grant us license to use, modify, and display your content</Text>
          <Text style={styles.bulletPoint}>• You must not upload content that infringes on others' rights</Text>
          <Text style={styles.bulletPoint}>• We may moderate and remove inappropriate content</Text>
          <Text style={styles.bulletPoint}>• You are responsible for the accuracy and legality of your content</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6. Data Security</Text>
          <Text style={styles.text}>
            We implement appropriate security measures to protect your personal information against 
            unauthorized access, alteration, disclosure, or destruction. However, no method of 
            transmission over the internet is 100% secure.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>7. Your Rights</Text>
          <Text style={styles.text}>
            You have the right to:
          </Text>
          <Text style={styles.bulletPoint}>• Access your personal information</Text>
          <Text style={styles.bulletPoint}>• Update or correct your information</Text>
          <Text style={styles.bulletPoint}>• Delete your account</Text>
          <Text style={styles.bulletPoint}>• Opt out of marketing communications</Text>
          <Text style={styles.bulletPoint}>• Request data portability</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>8. Cookies and Tracking</Text>
          <Text style={styles.text}>
            We use cookies and similar tracking technologies to enhance your experience, 
            analyze usage patterns, and provide personalized content.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>9. Children's Privacy</Text>
          <Text style={styles.text}>
            Our services are not intended for children under 13. We do not knowingly collect 
            personal information from children under 13.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>10. Changes to This Policy</Text>
          <Text style={styles.text}>
            We may update this privacy policy from time to time. We will notify you of any 
            changes by posting the new policy on this page and updating the "Last updated" date.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>11. Contact Us</Text>
          <Text style={styles.text}>
            If you have any questions about this privacy policy, please contact us at:
          </Text>
          <Text style={styles.contactInfo}>Email: privacy@only2u.com</Text>
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

export default PrivacyPolicy; 