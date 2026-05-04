import { useState } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, Keyboard, TouchableWithoutFeedback, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';

export default function SignupScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function handleSignup() {
    if (!email || !password || !name) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCredential.user, { displayName: name });
      
      // Save to Firestore so friends can search by email
      await setDoc(doc(db, 'users', userCredential.user.email.toLowerCase()), {
        uid: userCredential.user.uid,
        email: userCredential.user.email.toLowerCase(),
        name: name,
        createdAt: new Date().toISOString(),
      });

      Alert.alert('Success', 'Account created successfully!');
      router.replace('/onboarding');
    } catch (error) {
      Alert.alert('Signup Error', error.message);
    }
  }
  function handleGoogle() {
    Alert.alert(
      'Expo Go Limitation',
      'Google Sign-In requires a custom Dev Client. To test this, you must run "npx expo run:android" instead of "npm start".'
    );
  }
  function handleApple() {
    Alert.alert('Coming Soon', 'Apple sign-in will be wired up for iOS.');
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <Text style={styles.title}>create account</Text>
          <Text style={styles.subtitle}>start tracking and splitting together</Text>

          {/* Social login buttons */}
          <TouchableOpacity style={styles.socialBtn} onPress={handleGoogle} activeOpacity={0.7}>
            <Text style={styles.socialIcon}>G</Text>
            <Text style={styles.socialText}>continue with Google</Text>
          </TouchableOpacity>

          {Platform.OS === 'ios' && (
            <TouchableOpacity style={[styles.socialBtn, styles.appleBtn]} onPress={handleApple} activeOpacity={0.7}>
              <Text style={[styles.socialIcon, { color: '#fff' }]}>󰀄</Text>
              <Text style={[styles.socialText, { color: '#fff' }]}>continue with Apple</Text>
            </TouchableOpacity>
          )}

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <Text style={styles.label}>name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            placeholder="Your Name"
            placeholderTextColor="#ccc"
          />

          <Text style={styles.label}>email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholder="you@example.com"
            placeholderTextColor="#ccc"
          />

          <Text style={styles.label}>password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••••"
            placeholderTextColor="#ccc"
          />

          <TouchableOpacity style={styles.submitBtn} onPress={handleSignup} activeOpacity={0.8}>
            <Text style={styles.submitText}>sign up</Text>
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>have an account?</Text>
            <TouchableOpacity onPress={() => router.replace('/login')}>
              <Text style={styles.footerLink}>  log in</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  topBar: { paddingTop: 60, paddingHorizontal: 24, alignItems: 'flex-end' },
  closeBtn: { padding: 8 },
  closeText: { fontSize: 22, color: '#bbb', fontWeight: '400' },

  content: { flex: 1, paddingHorizontal: 32, justifyContent: 'center', paddingBottom: 40 },
  title: { fontSize: 30, fontWeight: '800', color: '#000', letterSpacing: -0.8, marginBottom: 6 },
  subtitle: { fontSize: 15, color: '#888', marginBottom: 36, lineHeight: 22 },

  socialBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#e8e8e8', borderRadius: 14,
    paddingVertical: 14, marginBottom: 12,
  },
  appleBtn: { backgroundColor: '#000', borderColor: '#000' },
  socialIcon: { fontSize: 16, fontWeight: '700', color: '#000', marginRight: 10, width: 20, textAlign: 'center' },
  socialText: { fontSize: 15, fontWeight: '500', color: '#000' },

  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: '#e8e8e8' },
  dividerText: { fontSize: 13, color: '#bbb', marginHorizontal: 12 },

  label: { fontSize: 11, fontWeight: '700', color: '#bbb', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  input: { fontSize: 17, color: '#000', borderBottomWidth: 1, borderBottomColor: '#eee', paddingVertical: 10, marginBottom: 24 },

  submitBtn: { backgroundColor: '#000', paddingVertical: 17, borderRadius: 30, alignItems: 'center', marginTop: 8 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 28 },
  footerText: { color: '#888', fontSize: 14 },
  footerLink: { color: '#000', fontSize: 14, fontWeight: '600' },
});
