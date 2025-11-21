import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '~/utils/supabase';
import { useUser } from '~/contexts/UserContext';
import Toast from 'react-native-toast-message';
import { getGooglePlacesApiKey } from '~/utils/settings';

const AddAddress = () => {
  const navigation = useNavigation();
  const { userData } = useUser();

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

  // City/State/Country autocomplete (kept)
  const [placeQuery, setPlaceQuery] = useState('');
  const [placeResults, setPlaceResults] = useState<Array<{ description: string }>>([]);
  const placeDebounceRef = useRef<NodeJS.Timeout | null>(null);
  // Address line 1 autocomplete
  const [addrQuery, setAddrQuery] = useState('');
  const [addrResults, setAddrResults] = useState<Array<{ description: string; place_id: string }>>([]);
  const addrDebounceRef = useRef<NodeJS.Timeout | null>(null);

  const validate = () => {
    if (!fullName.trim()) return 'Name required';
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length !== 10) return 'Valid 10-digit phone required';
    if (!line1.trim()) return 'Street address required';
    if (!city.trim()) return 'City required';
    if (!stateName.trim()) return 'State required';
    if (!postalCode.trim()) return 'Postal code required';
    return null;
  };

  const saveAddress = async () => {
    const err = validate();
    if (err || !userData?.id) {
      Toast.show({ type: 'error', text1: 'Invalid Address', text2: err || 'Please login' });
      return;
    }
    const payload = {
      user_id: userData.id,
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
    const { error } = await supabase.from('user_addresses').insert(payload);
    if (error) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Could not save address' });
      return;
    }
    Toast.show({ type: 'success', text1: 'Address Saved' });
    navigation.goBack();
  };

  const queryPlaces = async (q: string) => {
    if (!q || q.length < 2) { setPlaceResults([]); return; }
    try {
      const apiKey = await getGooglePlacesApiKey();
      if (!apiKey) { setPlaceResults([]); return; }
      const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(q)}&types=(cities)&key=${apiKey}`;
      const resp = await fetch(url);
      const json = await resp.json();
      if (json.status !== 'OK') { setPlaceResults([]); return; }
      setPlaceResults(json.predictions.map((p: any) => ({ description: p.description })).slice(0, 8));
    } catch { setPlaceResults([]); }
  };

  useEffect(() => {
    if (placeDebounceRef.current) clearTimeout(placeDebounceRef.current);
    placeDebounceRef.current = setTimeout(() => queryPlaces(placeQuery), 250);
    return () => { if (placeDebounceRef.current) clearTimeout(placeDebounceRef.current); };
  }, [placeQuery]);

  // Address autocomplete under Street Address 1
  const queryAddress = async (q: string) => {
    if (!q || q.length < 3) { setAddrResults([]); return; }
    try {
      const apiKey = await getGooglePlacesApiKey();
      if (!apiKey) { setAddrResults([]); return; }
      const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(q)}&types=address&key=${apiKey}`;
      const resp = await fetch(url);
      const json = await resp.json();
      if (json.status !== 'OK') { setAddrResults([]); return; }
      setAddrResults(json.predictions.map((p: any) => ({ description: p.description, place_id: p.place_id })).slice(0, 8));
    } catch { setAddrResults([]); }
  };

  const fetchPlaceDetailsAndFill = async (placeId: string) => {
    try {
      const apiKey = await getGooglePlacesApiKey();
      if (!apiKey) return;
      const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=address_component,formatted_address,geometry&key=${apiKey}`;
      const resp = await fetch(url);
      const json = await resp.json();
      if (json.status !== 'OK') return;
      const comps: Array<any> = json.result.address_components || [];
      const pick = (type: string) => comps.find(c => (c.types || []).includes(type));
      const streetNumber = pick('street_number')?.long_name || '';
      const route = pick('route')?.long_name || '';
      const sublocality = pick('sublocality_level_1')?.long_name || '';
      const locality = pick('locality')?.long_name || pick('administrative_area_level_2')?.long_name || '';
      const admin1 = pick('administrative_area_level_1')?.long_name || '';
      const postal = pick('postal_code')?.long_name || '';
      const countryName = pick('country')?.long_name || '';
      const computedLine1 = [streetNumber, route].filter(Boolean).join(' ');
      if (computedLine1) setLine1(computedLine1);
      if (sublocality && !line2) setLine2(sublocality);
      if (locality) setCity(locality);
      if (admin1) setStateName(admin1);
      if (postal) setPostalCode(postal);
      if (countryName) setCountry(countryName);
    } catch {}
  };

  useEffect(() => {
    if (addrDebounceRef.current) clearTimeout(addrDebounceRef.current);
    addrDebounceRef.current = setTimeout(() => queryAddress(addrQuery), 250);
    return () => { if (addrDebounceRef.current) clearTimeout(addrDebounceRef.current); };
  }, [addrQuery]);

  return (
    <SafeAreaView style={styles.container} edges={['top','bottom']}>      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#111" />
        </TouchableOpacity>
        <Text style={styles.title}>Add New Address</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView 
          style={styles.form} 
          contentContainerStyle={{ paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.label}>Full Name *</Text>
          <TextInput style={styles.input} placeholder="Receiver's name" value={fullName} onChangeText={setFullName} />

          <Text style={styles.label}>Phone *</Text>
          <TextInput style={styles.input} placeholder="10-digit phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={10} />

          <Text style={styles.label}>Street Address 1 *</Text>
          <TextInput
            style={styles.input}
            placeholder="House no, Street"
            value={line1}
            onChangeText={(t) => { setLine1(t); setAddrQuery(t); }}
          />
          {(addrResults.length > 0) && (
            <View style={styles.autocompleteBox}>
              {addrResults.map((p, idx) => (
                <TouchableOpacity
                  key={`${p.place_id}-${idx}`}
                  style={styles.autocompleteItem}
                  onPress={async () => {
                    setLine1(p.description);
                    setAddrResults([]);
                    await fetchPlaceDetailsAndFill(p.place_id);
                  }}
                >
                  <Ionicons name="location-outline" size={16} color="#666" style={{ marginRight: 8 }} />
                  <Text style={styles.autocompleteText}>{p.description}</Text>
                </TouchableOpacity>
              ))}
              {/* Allow user to continue with typed details if Google isn't accurate */}
              <TouchableOpacity
                style={[styles.autocompleteItem, { justifyContent: 'center' }]}
                onPress={() => setAddrResults([])}
              >
                <Text style={[styles.autocompleteText, { fontWeight: '700', color: '#F53F7A' }]}>Use typed address instead</Text>
              </TouchableOpacity>
            </View>
          )}

          <Text style={styles.label}>Street Address 2</Text>
          <TextInput style={styles.input} placeholder="Area / Locality" value={line2} onChangeText={setLine2} />

          <Text style={styles.label}>Landmark</Text>
          <TextInput style={styles.input} placeholder="Nearby landmark" value={landmark} onChangeText={setLandmark} />

          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.label}>City *</Text>
              <TextInput style={styles.input} placeholder="Start typing city" value={city} onChangeText={(t) => { setCity(t); setPlaceQuery(t); }} />
            </View>
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={styles.label}>State *</Text>
              <TextInput style={styles.input} placeholder="State" value={stateName} onChangeText={(t) => { setStateName(t); setPlaceQuery(t); }} />
            </View>
          </View>

          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.label}>Postal Code *</Text>
              <TextInput style={styles.input} placeholder="Pincode" value={postalCode} onChangeText={setPostalCode} keyboardType="number-pad" />
            </View>
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={styles.label}>Country *</Text>
              <TextInput style={styles.input} placeholder="Country" value={country} onChangeText={(t) => { setCountry(t); setPlaceQuery(t); }} />
            </View>
          </View>

          {placeResults.length > 0 && (
            <View style={styles.autocompleteBox}>
              {placeResults.map((p, idx) => (
                <TouchableOpacity
                  key={`${p.description}-${idx}`}
                  style={styles.autocompleteItem}
                  onPress={() => {
                    const parts = p.description.split(',').map((s) => s.trim());
                    if (parts[0]) setCity(parts[0]);
                    if (parts[1]) setStateName(parts[1]);
                    if (parts[2]) setCountry(parts[2]);
                    setPlaceResults([]);
                    setPlaceQuery('');
                  }}
                >
                  <Ionicons name="location-outline" size={16} color="#666" style={{ marginRight: 8 }} />
                  <Text style={styles.autocompleteText}>{p.description}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
        <View style={styles.footer}>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.saveBtn} onPress={saveAddress}>
            <Text style={styles.saveText}>Save Address</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  title: { fontSize: 18, fontWeight: '700', color: '#111' },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  form: { paddingHorizontal: 16, paddingTop: 8 },
  label: { fontSize: 12, fontWeight: '700', color: '#6B7280', marginTop: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, color: '#111' },
  row: { flexDirection: 'row', marginTop: 4 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderTopWidth: 1, borderTopColor: '#eee', backgroundColor: '#fff' },
  cancelBtn: { flex: 1, marginRight: 8, paddingVertical: 14, borderRadius: 10, alignItems: 'center', backgroundColor: '#f3f4f6' },
  cancelText: { color: '#374151', fontWeight: '700' },
  saveBtn: { flex: 1, marginLeft: 8, paddingVertical: 14, borderRadius: 10, alignItems: 'center', backgroundColor: '#F53F7A' },
  saveText: { color: '#fff', fontWeight: '700' },
  autocompleteBox: { marginTop: 8, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, backgroundColor: '#fff' },
  autocompleteItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  autocompleteText: { color: '#374151', fontSize: 14 },
});

export default AddAddress;


