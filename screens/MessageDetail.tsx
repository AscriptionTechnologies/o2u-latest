import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  SafeAreaView,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';

// Define the user type and route params type
export type MessageUser = {
  id: string;
  name: string;
  avatar: string;
  lastMessage?: string;
  time?: string;
  unread?: number;
  seen?: boolean;
  online?: boolean;
};

type MessageDetailRouteParams = {
  user: MessageUser;
};

const messages = [
  {
    id: '1',
    text: 'Hello, James wellcome to my consult session. How can I help you?',
    time: '20:15',
    fromMe: false,
  },
  {
    id: '2',
    text: 'Yes. thats why I make consult with you doc.',
    time: '20:15',
    fromMe: true,
  },
  {
    id: '3',
    text: 'I had nightmares for 3 days, is that a symptomp of mental disorder?',
    time: '20:15',
    fromMe: true,
  },
  {
    id: '4',
    text: 'Hahaha 😂, no. You\'re just tired from a lot of activities.',
    time: '20:15',
    fromMe: false,
  },
  {
    id: '5',
    text: 'You just need to rest, and calm your mind',
    time: '20:15',
    fromMe: false,
  },
];

const MessageDetail = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<{ params: MessageDetailRouteParams }, 'params'>>();
  const user = route.params?.user || {
    name: 'John Doe',
    avatar: 'https://randomuser.me/api/portraits/men/6.jpg',
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <SafeAreaView style={{ backgroundColor: '#fff' }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={28} color="#3DF45B" />
          </TouchableOpacity>
          <Image source={{ uri: user.avatar }} style={styles.avatar} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.headerName}>{user.name}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineText}>Online</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.headerIcon}>
            <Ionicons name="videocam-outline" size={26} color="#3DF45B" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIcon}>
            <Ionicons name="call-outline" size={26} color="#3DF45B" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
      {/* Chat Area */}
      <View style={styles.chatArea}>
        <FlatList
          data={messages}
          keyExtractor={item => item.id}
          renderItem={({ item, index }) => (
            <View style={{ alignItems: item.fromMe ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
              <View style={[styles.bubble, item.fromMe ? styles.bubbleMe : styles.bubbleOther]}> 
                <Text style={[styles.bubbleText, item.fromMe && { color: '#fff' }]}>{item.text}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                {item.fromMe && (
                  <MaterialCommunityIcons name="check-all" size={16} color="#3DF45B" style={{ marginRight: 4 }} />
                )}
                <Text style={styles.timeText}>{item.time}</Text>
              </View>
            </View>
          )}
          contentContainerStyle={{ padding: 18, paddingBottom: 32 }}
        />
      </View>
      {/* Input Bar */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={10}
      >
        <SafeAreaView>

        <View style={styles.inputBar}>
          <Ionicons name="happy-outline" size={26} color="#B0B6BE" style={{ marginHorizontal: 8 }} />
          <TextInput
            style={styles.input}
            placeholder="Write a message..."
            placeholderTextColor="#B0B6BE"
            />
          <Ionicons name="add-circle-outline" size={26} color="#B0B6BE" style={{ marginHorizontal: 4 }} />
          <Ionicons name="image-outline" size={26} color="#B0B6BE" style={{ marginHorizontal: 4 }} />
          {/* <Ionicons name="mic-outline" size={26} color="#B0B6BE" style={{ marginHorizontal: 4 }} /> */}
          <Ionicons name="send" size={26} color="#3DF45B" style={{ marginHorizontal: 4 }} />
        </View>
            </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#181C20',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingTop: 12,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginLeft: 12,
  },
  headerName: {
    color: '#181C20',
    fontSize: 20,
    fontWeight: 'bold',
  },
  onlineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3DF45B',
    marginRight: 6,
  },
  onlineText: {
    color: '#3DF45B',
    fontSize: 14,
    fontWeight: '500',
  },
  headerIcon: {
    marginLeft: 16,
  },
  chatArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginBottom: 2,
  },
  bubbleOther: {
    backgroundColor: '#23272F',
    alignSelf: 'flex-start',
  },
  bubbleMe: {
    backgroundColor: '#3DF45B',
    alignSelf: 'flex-end',
  },
  bubbleText: {
    color: '#fff',
    fontSize: 17,
    lineHeight: 24,
  },
  timeText: {
    color: '#B0B6BE',
    fontSize: 13,
    marginTop: 2,
  },
  typingText: {
    color: '#B0B6BE',
    fontSize: 15,
    marginLeft: 18,
    marginBottom: 8,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderTopWidth: 0,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  input: {
    flex: 1,
    fontSize: 17,
    color: '#fff',
    backgroundColor: 'transparent',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 18,
  },
});

export default MessageDetail; 