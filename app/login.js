import { useState } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, Keyboard, TouchableWithoutFeedback, Alert, Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithCredential, sendPasswordResetEmail } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, getCountFromServer } from 'firebase/firestore';
// import { GoogleSignin } from '@react-native-google-signin/google-signin';
const GoogleSignin = {
  configure: () => {},
  hasPlayServices: async () => true,
  signIn: async () => { throw new Error('Google Sign-In is disabled in Expo Go preview. Please use Email/Password.'); }
};
import { auth, db } from '../firebaseConfig';
import { useAppContext } from './AppContext';

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
  const { colors, isDark } = useAppContext();
  const styles = createStyles(colors, isDark);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [forgotModalVisible, setForgotModalVisible] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');

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

  function handleForgotPassword() {
    setForgotModalVisible(true);
    setForgotEmail(email); // Pre-fill with entered email if any
  }

  async function sendResetEmail() {
    if (!forgotEmail) {
      Alert.alert('Email Required', 'Please enter your email address.');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, forgotEmail);
      Alert.alert('Email Sent', 'A password reset link has been sent to your email address.');
      setForgotModalVisible(false);
      setForgotEmail('');
    } catch (error) {
      Alert.alert('Error', error.message);
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
        
        // Brand new user, show onboarding
        router.replace('/onboarding');
      } else {
        // Existing user, go to dashboard
        router.replace('/(tabs)/');
      }
    } catch (error) {
      console.log('Google Sign-In Error:', error);
      Alert.alert('Google Sign-In Error', error.message || 'Something went wrong');
    }
  }

  return (
    <>
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
            placeholderTextColor={colors.textPlaceholder}
          />

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 }}>
            <Text style={[styles.label, { marginBottom: 0 }]}>password</Text>
            <TouchableOpacity onPress={handleForgotPassword}>
              <Text style={styles.forgotText}>forgot password?</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.textPlaceholder}
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

      {/* Forgot Password Modal */}
      <Modal visible={forgotModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>reset password</Text>
            <Text style={styles.modalSubtitle}>enter your email and we'll send you a secure link to reset your password.</Text>
            
            <Text style={styles.label}>email address</Text>
            <TextInput
              style={styles.input}
              value={forgotEmail}
              onChangeText={setForgotEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="you@example.com"
              placeholderTextColor={colors.textPlaceholder}
              autoFocus
            />
            
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setForgotModalVisible(false)}>
                <Text style={styles.cancelText}>cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={sendResetEmail}>
                <Text style={styles.saveText}>send link</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const createStyles = (colors, isDark) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  topBar: { paddingTop: 60, paddingHorizontal: 24, alignItems: 'flex-end' },
  closeBtn: { padding: 8 },
  closeText: { fontSize: 22, color: colors.textMuted, fontWeight: '400' },

  content: { flex: 1, paddingHorizontal: 32, justifyContent: 'center', paddingBottom: 40 },
  title: { fontSize: 30, fontWeight: '800', color: colors.text, letterSpacing: -0.8, marginBottom: 6 },
  subtitle: { fontSize: 15, color: colors.textSecondary, marginBottom: 36, lineHeight: 22 },

  socialBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border, borderRadius: 14,
    paddingVertical: 14, marginBottom: 12,
  },
  appleBtn: { backgroundColor: colors.primary, borderColor: colors.primary },
  socialIcon: { fontSize: 16, fontWeight: '700', color: colors.text, marginRight: 10, width: 20, textAlign: 'center' },
  socialText: { fontSize: 15, fontWeight: '500', color: colors.text },

  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  dividerText: { fontSize: 13, color: colors.textMuted, marginHorizontal: 12 },

  label: { fontSize: 11, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  input: { fontSize: 17, color: colors.text, borderBottomWidth: 1, borderBottomColor: colors.borderSecondary, paddingVertical: 10, marginBottom: 24 },
  
  passwordContainer: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.borderSecondary, marginBottom: 24 },
  passwordInput: { flex: 1, fontSize: 17, color: colors.text, paddingVertical: 10 },
  eyeBtn: { padding: 10, paddingRight: 0 },
  eyeEmoji: { fontSize: 16 },
  forgotText: { fontSize: 13, color: colors.danger, fontWeight: '500' },
  submitBtn: { backgroundColor: colors.primary, paddingVertical: 18, borderRadius: 24, alignItems: 'center', marginTop: 32 },
  submitText: { color: colors.primaryText, fontSize: 16, fontWeight: '600' },

  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 28 },
  footerText: { color: colors.textSecondary, fontSize: 14 },
  footerLink: { color: colors.text, fontSize: 14, fontWeight: '600' },

  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: colors.overlayDark, justifyContent: 'center', padding: 24 },
  modalSheet: { backgroundColor: colors.card, borderRadius: 28, paddingHorizontal: 28, paddingVertical: 32, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: isDark ? 0.3 : 0.1, shadowRadius: 20, elevation: 10 },
  modalTitle: { fontSize: 22, fontWeight: '800', color: colors.text, letterSpacing: -0.5, marginBottom: 8 },
  modalSubtitle: { fontSize: 14, color: colors.textSecondary, lineHeight: 20, marginBottom: 28 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 12, gap: 16 },
  cancelBtn: { paddingVertical: 12, paddingHorizontal: 16 },
  cancelText: { fontSize: 15, color: colors.textSecondary, fontWeight: '500' },
  saveBtn: { backgroundColor: colors.primary, paddingVertical: 14, paddingHorizontal: 24, borderRadius: 20 },
  saveText: { fontSize: 15, color: colors.primaryText, fontWeight: '600' },
});
