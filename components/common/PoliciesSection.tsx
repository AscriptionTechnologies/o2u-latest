import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
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

interface PoliciesSectionProps {
  title?: string;
  showTitle?: boolean;
  style?: any;
}

const PoliciesSection: React.FC<PoliciesSectionProps> = ({ 
  title = "Legal & Policies", 
  showTitle = true,
  style 
}) => {
  const navigation = useNavigation<NavigationProp>();

  const handleTermsAndConditions = () => {
    navigation.navigate('TermsAndConditions');
  };

  const handlePrivacyPolicy = () => {
    navigation.navigate('PrivacyPolicy');
  };

  const handleRefundPolicy = () => {
    navigation.navigate('RefundPolicy');
  };

  return (
    <View style={[styles.container, style]}>
      {showTitle && (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>
      )}
      
      <View style={styles.policiesContainer}>
        <TouchableOpacity style={styles.policyItem} onPress={handleTermsAndConditions}>
          <View style={styles.policyContent}>
            <Ionicons name="document-text-outline" size={20} color="#F53F7A" />
            <Text style={styles.policyText}>Terms & Conditions</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#999" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.policyItem} onPress={handlePrivacyPolicy}>
          <View style={styles.policyContent}>
            <Ionicons name="shield-checkmark-outline" size={20} color="#F53F7A" />
            <Text style={styles.policyText}>Privacy Policy</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#999" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.policyItem} onPress={handleRefundPolicy}>
          <View style={styles.policyContent}>
            <Ionicons name="card-outline" size={20} color="#F53F7A" />
            <Text style={styles.policyText}>Refund Policy</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#999" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  policiesContainer: {
    paddingVertical: 8,
  },
  policyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  policyContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  policyText: {
    fontSize: 15,
    color: '#333',
    marginLeft: 12,
    fontWeight: '500',
  },
});

export default PoliciesSection; 