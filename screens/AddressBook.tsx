import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Alert, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '~/utils/supabase';
import { useUser } from '~/contexts/UserContext';

interface UserAddress {
  id: string;
  label?: string;
  full_name?: string;
  phone?: string;
  street_line1: string;
  street_line2?: string;
  landmark?: string;
  city: string;
  state: string;
  postal_code: string;
  country?: string;
  is_default?: boolean;
}

const AddressBook = () => {
  const navigation = useNavigation();
  const { userData } = useUser();
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [loading, setLoading] = useState(false);

  // Form state
  const [formVisible, setFormVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [label, setLabel] = useState('Home');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [landmark, setLandmark] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('India');
  const [isDefault, setIsDefault] = useState(false);

  const fetchAddresses = async () => {
    if (!userData?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('user_addresses')
      .select('*')
      .eq('user_id', userData.id)
      .order('created_at', { ascending: false });
    setLoading(false);
    if (error) {
      console.error('Fetch addresses error', error);
      return;
    }
    setAddresses(data as any);
  };

  useEffect(() => {
    fetchAddresses();
  }, [userData?.id]);

  const resetForm = () => {
    setEditingId(null);
    setLabel('Home');
    setFullName('');
    setPhone('');
    setLine1('');
    setLine2('');
    setLandmark('');
    setCity('');
    setStateName('');
    setPostalCode('');
    setCountry('India');
    setIsDefault(false);
  };

  const openCreate = () => {
    resetForm();
    setFormVisible(true);
  };

  const openEdit = (addr: UserAddress) => {
    setEditingId(addr.id);
    setLabel(addr.label || 'Home');
    setFullName(addr.full_name || '');
    setPhone(addr.phone || '');
    setLine1(addr.street_line1 || '');
    setLine2(addr.street_line2 || '');
    setLandmark(addr.landmark || '');
    setCity(addr.city || '');
    setStateName(addr.state || '');
    setPostalCode(addr.postal_code || '');
    setCountry(addr.country || 'India');
    setIsDefault(!!addr.is_default);
    setFormVisible(true);
  };

  const validate = () => {
    if (!fullName.trim()) return 'Name required';
    if (!phone.trim()) return 'Phone required';
    if (!line1.trim()) return 'Street address required';
    if (!city.trim()) return 'City required';
    if (!stateName.trim()) return 'State required';
    if (!postalCode.trim()) return 'Postal code required';
    return null;
  };

  const saveAddress = async () => {
    if (!userData?.id) return;
    const errMsg = validate();
    if (errMsg) {
      Alert.alert('Invalid Address', errMsg);
      return;
    }
    const payload = {
      user_id: userData.id,
      label,
      full_name: fullName,
      phone,
      street_line1: line1,
      street_line2: line2,
      landmark,
      city,
      state: stateName,
      postal_code: postalCode,
      country,
      is_default: isDefault,
    };
    let error;
    if (editingId) {
      const res = await supabase.from('user_addresses').update(payload).eq('id', editingId);
      error = res.error as any;
    } else {
      const res = await supabase.from('user_addresses').insert(payload);
      error = res.error as any;
    }
    if (error) {
      console.error('Save address error', error);
      Alert.alert('Error', 'Could not save address');
      return;
    }
    setFormVisible(false);
    resetForm();
    fetchAddresses();
  };

  const deleteAddress = async (id: string) => {
    Alert.alert('Delete Address', 'Are you sure you want to delete this address?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        const { error } = await supabase.from('user_addresses').delete().eq('id', id);
        if (error) {
          Alert.alert('Error', 'Could not delete');
          return;
        }
        fetchAddresses();
      }}
    ]);
  };

  const setDefaultAddress = async (id: string) => {
    if (!userData?.id) return;
    // First, unset others
    await supabase.from('user_addresses').update({ is_default: false }).eq('user_id', userData.id);
    await supabase.from('user_addresses').update({ is_default: true }).eq('id', id);
    fetchAddresses();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Address Book</Text>
        <TouchableOpacity onPress={openCreate} style={styles.addButton}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        {addresses.map(addr => (
          <View key={addr.id} style={styles.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Text style={styles.labelText}>{addr.label || 'Address'}</Text>
                <Text style={styles.nameText}>{addr.full_name} • {addr.phone}</Text>
              </View>
              {addr.is_default && (
                <View style={styles.defaultPill}><Text style={styles.defaultPillText}>Default</Text></View>
              )}
            </View>
            <Text style={styles.addressText}>
              {addr.street_line1}{addr.street_line2 ? `, ${addr.street_line2}` : ''}
            </Text>
            {!!addr.landmark && (<Text style={styles.addressText}>Landmark: {addr.landmark}</Text>)}
            <Text style={styles.addressText}>
              {addr.city}, {addr.state} {addr.postal_code}
            </Text>
            <View style={styles.cardActions}>
              {!addr.is_default && (
                <TouchableOpacity style={styles.actionPill} onPress={() => setDefaultAddress(addr.id)}>
                  <Text style={styles.actionPillText}>Set Default</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.actionPill} onPress={() => openEdit(addr)}>
                <Text style={styles.actionPillText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionPill, { backgroundColor: '#fee2e2' }]} onPress={() => deleteAddress(addr.id)}>
                <Text style={[styles.actionPillText, { color: '#b91c1c' }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
        {addresses.length === 0 && (
          <View style={{ padding: 16 }}>
            <Text style={{ textAlign: 'center', color: '#6B7280' }}>No addresses yet. Tap + to add one.</Text>
          </View>
        )}
      </ScrollView>

      <Modal visible={formVisible} transparent animationType="slide" onRequestClose={() => setFormVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{editingId ? 'Edit Address' : 'New Address'}</Text>
                <TouchableOpacity onPress={() => setFormVisible(false)}>
                  <Ionicons name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>
              <ScrollView style={{ padding: 16 }} contentContainerStyle={{ paddingBottom: 16 }}>
                <Text style={styles.inputLabel}>Label</Text>
                <TextInput style={styles.input} placeholder="Home / Work" value={label} onChangeText={setLabel} />

                <Text style={styles.inputLabel}>Full Name</Text>
                <TextInput style={styles.input} placeholder="Receiver's name" value={fullName} onChangeText={setFullName} />

                <Text style={styles.inputLabel}>Phone</Text>
                <TextInput style={styles.input} placeholder="Phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />

                <Text style={styles.inputLabel}>Street Address 1</Text>
                <TextInput style={styles.input} placeholder="House no, Street" value={line1} onChangeText={setLine1} />

                <Text style={styles.inputLabel}>Street Address 2 (Optional)</Text>
                <TextInput style={styles.input} placeholder="Area / Locality" value={line2} onChangeText={setLine2} />

                <Text style={styles.inputLabel}>Landmark (Optional)</Text>
                <TextInput style={styles.input} placeholder="Nearby landmark" value={landmark} onChangeText={setLandmark} />

                <View style={styles.row}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.inputLabel}>City</Text>
                    <TextInput style={styles.input} placeholder="City" value={city} onChangeText={setCity} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={styles.inputLabel}>State</Text>
                    <TextInput style={styles.input} placeholder="State" value={stateName} onChangeText={setStateName} />
                  </View>
                </View>

                <View style={styles.row}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.inputLabel}>Postal Code</Text>
                    <TextInput style={styles.input} placeholder="Pincode" value={postalCode} onChangeText={setPostalCode} keyboardType="numeric" />
                  </View>
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={styles.inputLabel}>Country</Text>
                    <TextInput style={styles.input} placeholder="Country" value={country} onChangeText={setCountry} />
                  </View>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
                  <TouchableOpacity onPress={() => setIsDefault(!isDefault)} style={styles.checkbox}>
                    {isDefault && <Ionicons name="checkmark" size={14} color="#fff" />}
                  </TouchableOpacity>
                  <Text style={{ marginLeft: 8, color: '#374151', fontWeight: '600' }}>Set as default address</Text>
                </View>
              </ScrollView>
              <View style={styles.modalFooter}>
                <TouchableOpacity style={styles.secondaryBtn} onPress={() => setFormVisible(false)}>
                  <Text style={styles.secondaryBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.primaryBtn} onPress={saveAddress}>
                  <Text style={styles.primaryBtnText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111' },
  backButton: { padding: 6 },
  addButton: { backgroundColor: '#F53F7A', padding: 8, borderRadius: 8 },
  card: { backgroundColor: '#fff', borderRadius: 12, marginHorizontal: 16, marginTop: 12, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  labelText: { fontSize: 14, fontWeight: '700', color: '#111' },
  nameText: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  addressText: { fontSize: 14, color: '#374151', marginTop: 6 },
  defaultPill: { backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  defaultPillText: { color: '#166534', fontWeight: '700', fontSize: 12 },
  cardActions: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 8 },
  actionPill: { backgroundColor: '#eef2ff', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  actionPillText: { color: '#3730a3', fontWeight: '700', fontSize: 12 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalCard: { backgroundColor: '#fff', borderRadius: 16, width: '100%', maxWidth: 480, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111' },
  inputLabel: { fontSize: 12, fontWeight: '700', color: '#6B7280', marginTop: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: '#111' },
  row: { flexDirection: 'row', marginTop: 4 },
  modalFooter: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderTopWidth: 1, borderTopColor: '#eee' },
  secondaryBtn: { flex: 1, marginRight: 8, paddingVertical: 12, borderRadius: 10, alignItems: 'center', backgroundColor: '#f3f4f6' },
  secondaryBtnText: { color: '#374151', fontWeight: '700' },
  primaryBtn: { flex: 1, marginLeft: 8, paddingVertical: 12, borderRadius: 10, alignItems: 'center', backgroundColor: '#F53F7A' },
  primaryBtnText: { color: '#fff', fontWeight: '700' },
  checkbox: { width: 18, height: 18, borderRadius: 4, backgroundColor: '#F53F7A', alignItems: 'center', justifyContent: 'center' },
});

export default AddressBook;


