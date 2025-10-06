import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface OTPScreenProps {
  phone: string;
  name: string;
  onVerified: () => void;
}

const OTP_LENGTH = 6;

const OTPScreen: React.FC<OTPScreenProps> = ({ phone, name, onVerified }) => {
  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(''));
  const [error, setError] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  // Simulate sending OTP
  React.useEffect(() => {
    setResendTimer(30);
    const timer = setInterval(() => {
      setResendTimer((t) => (t > 0 ? t - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [phone]);

  const handleChange = (value: string, idx: number) => {
    if (!/^[0-9]?$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[idx] = value;
    setOtp(newOtp);
    if (value && idx < OTP_LENGTH - 1) {
      inputRefs.current[idx + 1]?.focus();
    }
    if (newOtp.every((d) => d.length === 1)) {
      setError('');
    }
  };

  const handleResend = () => {
    setResendTimer(30);
    setOtp(Array(OTP_LENGTH).fill(''));
    setError('');
    // Simulate resend
  };

  const handleVerify = () => {
    if (otp.join('').length !== OTP_LENGTH) {
      setError('Please enter the 6-digit OTP.');
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      // Simulate OTP check (always success for now)
      onVerified();
    }, 1200);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#F53F7A', }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Logo pill */}
      <View style={styles.logoPillWrap}>
        <View style={styles.logoPill}>
          <Text style={styles.logoText}>
            Only<Text style={{ color: '#F53F7A' }}>2</Text>U
          </Text>
        </View>
      </View>
      {/* Card */}
      <View style={{ flex: 1, justifyContent: 'center' }}>
      <View style={styles.card}>
        <Text style={styles.title}>Verify Your Number</Text>
        <Text style={styles.subtitle}>
          We've sent a 6-digit OTP to {phone}
        </Text>
        {/* OTP input */}
        <View style={styles.otpRow}>
          {otp.map((digit, idx) => (
            <TextInput
              key={idx}
              ref={ref => { inputRefs.current[idx] = ref; }}
              style={styles.otpInput}
              keyboardType="number-pad"
              maxLength={1}
              value={digit}
              onChangeText={v => handleChange(v, idx)}
              returnKeyType="next"
              autoFocus={idx === 0}
              onKeyPress={({ nativeEvent }) => {
                if (nativeEvent.key === 'Backspace' && !otp[idx] && idx > 0) {
                  inputRefs.current[idx - 1]?.focus();
                }
              }}
            />
          ))}
        </View>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {/* Resend OTP */}
        <TouchableOpacity
          style={styles.resendBtn}
          onPress={handleResend}
          disabled={resendTimer > 0}
        >
          <Text style={[styles.resendText, resendTimer > 0 && { opacity: 0.5 }]}>Resend OTP{resendTimer > 0 ? ` (${resendTimer})` : ''}</Text>
        </TouchableOpacity>
        {/* Verify button */}
        <TouchableOpacity
          // style={[styles.verifyBtn, (otp.join('').length !== OTP_LENGTH) && { opacity: 0.7 }]}
          style={styles.verifyBtn}
          onPress={handleVerify}
          // disabled={loading || otp.join('').length !== OTP_LENGTH}
        >
          <Text style={styles.verifyBtnText}>Verify & Proceed</Text>
          <Ionicons name="key-outline" size={18} color="#fff" style={{ marginLeft: 8 }} />
        </TouchableOpacity>
      </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  logoPillWrap: {
    alignItems: 'center',
    marginTop: 80,
    marginBottom: 32,
  },
  logoPill: {
    backgroundColor: '#fff',
    borderRadius: 40,
    paddingHorizontal: 40,
    paddingVertical: 18,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  logoText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginHorizontal: 16,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 17,
    color: '#5A6170',
    textAlign: 'center',
    marginBottom: 24,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 18,
  },
  otpInput: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFB6D1',
    backgroundColor: '#fff',
    fontSize: 24,
    color: '#F53F7A',
    textAlign: 'center',
  },
  resendBtn: {
    marginBottom: 18,
  },
  resendText: {
    color: '#F53F7A',
    fontWeight: '600',
    fontSize: 16,
    textAlign: 'center',
  },
  verifyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F53F7A',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 32,
    marginTop: 8,
    width: '100%',
    justifyContent: 'center',
  },
  verifyBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  errorText: {
    color: '#F53F7A',
    fontSize: 15,
    marginBottom: 8,
    textAlign: 'center',
  },
});

export default OTPScreen; 