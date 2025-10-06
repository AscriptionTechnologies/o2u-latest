import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type RootStackParamList = {
  TermsAndConditions: undefined;
  PrivacyPolicy: undefined;
  RefundPolicy: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const HelpCenter = () => {
  const navigation = useNavigation<NavigationProp>();
  const [activeTab, setActiveTab] = useState('chat');
  const [message, setMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const handleBackPress = () => {
    navigation.goBack();
  };

  const handleSendMessage = () => {
    if (message?.trim()) {
      // Handle send message logic here
      setMessage('');
    }
  };

  const faqs = [
    {
      question: 'How do I track my order?',
      answer: "You can track your order by going to 'My Orders' section in your profile and clicking on the specific order you want to track.",
    },
    {
      question: 'What is your return policy?',
      answer: 'We accept returns within 30 days of delivery. Items must be in original condition with tags attached.',
    },
    {
      question: 'How do I change my delivery address?',
      answer: 'You can change your delivery address before shipping by contacting customer support or updating it from your order details if the option is available.',
    },
    {
      question: 'Do you ship internationally?',
      answer: 'Yes, we ship to most countries worldwide. Shipping costs and delivery times vary by location.',
    },
  ];

  const filteredFaqs = faqs.filter(faq =>
    faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
    faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderChatSupport = () => (
    <View style={styles.chatContainer}>
      <View style={styles.chatContent}>
        <Text style={styles.welcomeMessage}>Hello! How can I help you today?</Text>
      </View>
      
      <View style={styles.messageInputContainer}>
        <TextInput
          style={styles.messageInput}
          value={message}
          onChangeText={setMessage}
          placeholder="Type your message here..."
          placeholderTextColor="#999"
          multiline
        />
        <TouchableOpacity 
          style={styles.sendButton} 
          onPress={handleSendMessage}
          disabled={!message?.trim()}
        >
          <Ionicons name="send" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderFAQs = () => (
    <View style={styles.faqContainer}>
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search FAQs..."
          placeholderTextColor="#999"
        />
      </View>

      <ScrollView style={styles.faqList} showsVerticalScrollIndicator={false}>
        {filteredFaqs.map((faq, index) => (
          <View key={index} style={styles.faqItem}>
            <Text style={styles.faqQuestion}>{faq.question}</Text>
            <Text style={styles.faqAnswer}>{faq.answer}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );

  const renderPolicies = () => (
    <View style={styles.policiesContainer}>
      <ScrollView style={styles.policiesList} showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          style={styles.policyItem}
          onPress={() => navigation.navigate('TermsAndConditions')}
        >
          <View style={styles.policyContent}>
            <Ionicons name="document-text-outline" size={24} color="#F53F7A" />
            <View style={styles.policyText}>
              <Text style={styles.policyTitle}>Terms & Conditions</Text>
              <Text style={styles.policyDescription}>
                Read our terms and conditions for using the Only2U app
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#999" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.policyItem}
          onPress={() => navigation.navigate('PrivacyPolicy')}
        >
          <View style={styles.policyContent}>
            <Ionicons name="shield-checkmark-outline" size={24} color="#F53F7A" />
            <View style={styles.policyText}>
              <Text style={styles.policyTitle}>Privacy Policy</Text>
              <Text style={styles.policyDescription}>
                Learn how we collect, use, and protect your personal information
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#999" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.policyItem}
          onPress={() => navigation.navigate('RefundPolicy')}
        >
          <View style={styles.policyContent}>
            <Ionicons name="card-outline" size={24} color="#F53F7A" />
            <View style={styles.policyText}>
              <Text style={styles.policyTitle}>Refund Policy</Text>
              <Text style={styles.policyDescription}>
                Understand our return, refund, and exchange policies
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#999" />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help Center</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'chat' && styles.activeTab]}
          onPress={() => setActiveTab('chat')}
        >
          <Text style={[styles.tabText, activeTab === 'chat' && styles.activeTabText]}>
            Chat Support
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'faq' && styles.activeTab]}
          onPress={() => setActiveTab('faq')}
        >
          <Text style={[styles.tabText, activeTab === 'faq' && styles.activeTabText]}>
            FAQs
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'policies' && styles.activeTab]}
          onPress={() => setActiveTab('policies')}
        >
          <Text style={[styles.tabText, activeTab === 'policies' && styles.activeTabText]}>
            Policies
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {activeTab === 'chat' ? renderChatSupport() : activeTab === 'faq' ? renderFAQs() : renderPolicies()}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  headerSpacer: {
    width: 40,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: '#333',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
  },
  activeTabText: {
    color: '#fff',
  },
  content: {
    flex: 1,
    backgroundColor: '#fff',
  },
  chatContainer: {
    flex: 1,
    justifyContent: 'space-between',
  },
  chatContent: {
    flex: 1,
    padding: 20,
  },
  welcomeMessage: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  messageInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  messageInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#f8f9fa',
    marginRight: 12,
    maxHeight: 100,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F53F7A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  faqContainer: {
    flex: 1,
    padding: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 20,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  faqList: {
    flex: 1,
  },
  faqItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  faqQuestion: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F53F7A',
    marginBottom: 8,
  },
  faqAnswer: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  policiesContainer: {
    flex: 1,
    padding: 16,
  },
  policiesList: {
    flex: 1,
  },
  policyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  policyContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  policyText: {
    marginLeft: 16,
    flex: 1,
  },
  policyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  policyDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});

export default HelpCenter;
