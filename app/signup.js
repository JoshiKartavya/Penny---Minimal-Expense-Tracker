import { useState } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, Keyboard, TouchableWithoutFeedback, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { createUserWithEmailAndPassword, updateProfile, GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
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

export default function SignupScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  function suggestPassword() {
    const baseName = name ? name.split(' ')[0].replace(/[^a-zA-Z]/g, '') : 'User';
    const randNum = Math.floor(Math.random() * 900) + 100; // 100-999
    const specialChars = ['@', '#', '$', '&', '!'];
    const special = specialChars[Math.floor(Math.random() * specialChars.length)];
    const suggested = `${baseName.charAt(0).toUpperCase() + baseName.slice(1)}${special}${randNum}x`;
    setPassword(suggested);
    setShowPassword(true);
  }

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

      // Send Discord notification
      sendDiscordNotification(name, userCredential.user.email.toLowerCase());

      Alert.alert('Success', 'Account created successfully!');
      router.replace('/onboarding');
    } catch (error) {
      Alert.alert('Signup Error', error.message);
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
        
        // Send Discord notification
        sendDiscordNotification(userCredential.user.displayName || 'Google User', email);

        // If it's a completely new user from signup, route to onboarding
        router.replace('/onboarding');
      } else {
        router.replace('/(tabs)/');
      }

    } catch (error) {
      console.log('Google Sign-In Error:', error);
      Alert.alert('Google Sign-In Error', error.message || 'Something went wrong');
    }
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

          <View style={styles.labelRow}>
            <Text style={styles.label}>password</Text>
            <TouchableOpacity onPress={suggestPassword}>
              <Text style={styles.suggestText}>suggest strong password</Text>
            </TouchableOpacity>
          </View>
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
  
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 },
  suggestText: { fontSize: 11, fontWeight: '600', color: '#4A90E2', textTransform: 'lowercase' },
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
