import { useState } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, Keyboard, TouchableWithoutFeedback, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, getCountFromServer } from 'firebase/firestore';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { auth, db } from '../firebaseConfig';

GoogleSignin.configure({
  webClientId: '420970137197-cccvrkmjo7hednf6eghcuvmoqatpmitb.apps.googleusercontent.com',
});

async function sendDiscordNotification(name, email) {
  try {
    const coll = collection(db, 'users');
    const snapshot = await getCountFromServer(coll);
    const totalUsers = snapshot.data().count;

    // Paste your Discord Webhook URL below!
    const webhookUrl = 'https://discord.com/api/webhooks/1500800425572696235/2_b-5g5aVIsHV7CG5vTk5SPGrwtWtbWBFuFjS5jWEDfnO9QYmuc-sDoNMojsqh2LcGoo';
    
    if (!webhookUrl || webhookUrl.includes('YOUR_DISCORD_WEBHOOK_URL_HERE')) return;

    let milestone = '';
    if (totalUsers === 1) milestone = '\n🚀 *First user! We have liftoff!*';
    else if (totalUsers % 5 === 0) milestone = `\n🌟 *Milestone reached! ${totalUsers} total users!*`;

    const message = `**🎉 NEW USER LOGIN! 🎉**\n> **Name:** ${name}\n> **Email:** ${email}\n***\n📈 **Total App Users: ${totalUsers}**${milestone}`;

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: message })
    });
  } catch (error) {
    console.log('Failed to send Discord notification:', error);
  }
}

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.replace('/(tabs)/'); // Redirect to wallet tab after login
    } catch (error) {
      Alert.alert('Login Error', error.message);
    }
  }
  async function handleGoogle() {
    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo.data ? userInfo.data.idToken : userInfo.idToken;
      
      if (!idToken) {
        throw new Error('No ID token found');
      }
      
      const credential = GoogleAuthProvider.credential(idToken);
      const userCredential = await signInWithCredential(auth, credential);
      
      // Ensure user exists in Firestore for split feature
      const email = userCredential.user.email.toLowerCase();
      const userRef = doc(db, 'users', email);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        await setDoc(userRef, {
          uid: userCredential.user.uid,
          email: email,
          name: userCredential.user.displayName || 'Google User',
          createdAt: new Date().toISOString(),
        });
        
        // Send Discord notification for new Google users logging in for the first time
        sendDiscordNotification(userCredential.user.displayName || 'Google User', email);
      }

      router.replace('/(tabs)/');
    } catch (error) {
      console.log('Google Sign-In Error:', error);
      Alert.alert('Google Sign-In Error', error.message || 'Something went wrong');
    }
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
        {/* Close button */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <Text style={styles.title}>welcome back</Text>
          <Text style={styles.subtitle}>log in to access split & sync</Text>

          {/* Social login buttons */}
          <TouchableOpacity style={styles.socialBtn} onPress={handleGoogle} activeOpacity={0.7}>
            <Text style={styles.socialIcon}>G</Text>
            <Text style={styles.socialText}>continue with Google</Text>
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Email / Password */}
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
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              placeholder="••••••••"
              placeholderTextColor="#ccc"
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
              <Text style={styles.eyeEmoji}>{showPassword ? '🫣' : '👁️'}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.submitBtn} onPress={handleLogin} activeOpacity={0.8}>
            <Text style={styles.submitText}>log in</Text>
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>no account?</Text>
            <TouchableOpacity onPress={() => router.replace('/signup')}>
              <Text style={styles.footerLink}>  sign up</Text>
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
  
  passwordContainer: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#eee', marginBottom: 24 },
  passwordInput: { flex: 1, fontSize: 17, color: '#000', paddingVertical: 10 },
  eyeBtn: { padding: 10, paddingRight: 0 },
  eyeEmoji: { fontSize: 18 },

  submitBtn: { backgroundColor: '#000', paddingVertical: 17, borderRadius: 30, alignItems: 'center', marginTop: 8 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 28 },
  footerText: { color: '#888', fontSize: 14 },
  footerLink: { color: '#000', fontSize: 14, fontWeight: '600' },
});
