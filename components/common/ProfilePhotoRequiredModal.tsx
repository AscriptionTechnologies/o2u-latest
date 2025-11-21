import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

interface ProfilePhotoRequiredModalProps {
  visible: boolean;
  title?: string;
  description?: string;
  onDismiss: () => void;
  onUpload: () => void;
  uploadLabel?: string;
  dismissLabel?: string;
  icon?: string;
}

const ProfilePhotoRequiredModal: React.FC<ProfilePhotoRequiredModalProps> = ({
  visible,
  title = 'Profile Photo Required',
  description = 'Upload a clear photo of yourself to unlock Face Swap and other personalized magic.',
  onDismiss,
  onUpload,
  uploadLabel = 'Upload Photo',
  dismissLabel = 'Maybe Later',
  icon = 'camera-outline',
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <LinearGradient
            colors={['#FF8BC2', '#F53F7A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerGradient}
          >
            <View style={styles.iconBadge}>
              <Ionicons name={icon as any} size={36} color="#fff" />
            </View>
            <View style={styles.headerGlow} />
          </LinearGradient>

          <View style={styles.content}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.description}>{description}</Text>

            <View style={styles.actions}>
              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.secondaryButton}
                onPress={onDismiss}
              >
                <Text style={styles.secondaryLabel}>{dismissLabel}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.9}
                onPress={onUpload}
                style={styles.primaryButtonWrapper}
              >
                <LinearGradient
                  colors={['#FF8BC2', '#F53F7A']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.primaryButton}
                >
                  <Ionicons name="sparkles" size={16} color="#fff" style={styles.primaryIcon} />
                  <Text style={styles.primaryLabel}>{uploadLabel}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(245, 63, 122, 0.2)',
    shadowColor: '#F53F7A',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.25,
    shadowRadius: 40,
    elevation: 12,
  },
  headerGradient: {
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBadge: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    shadowColor: '#111',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 5,
  },
  headerGlow: {
    position: 'absolute',
    bottom: -32,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(245, 63, 122, 0.35)',
    opacity: 0.45,
  },
  content: {
    paddingHorizontal: 24,
    paddingVertical: 28,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#F53F7A',
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: 15,
    fontWeight: '500',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(245, 63, 122, 0.5)',
    paddingVertical: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  secondaryLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#F53F7A',
  },
  primaryButtonWrapper: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  primaryIcon: {
    marginRight: 8,
  },
  primaryLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});

export default ProfilePhotoRequiredModal;

