# Social Authentication Setup Guide

This guide provides detailed instructions for configuring Google Sign-In and Facebook Login for the Chillax mobile app.

## Table of Contents

1. [Overview](#overview)
2. [Google Sign-In Setup](#google-sign-in-setup)
3. [Facebook Login Setup](#facebook-login-setup)
4. [Keycloak Configuration](#keycloak-configuration)
5. [Mobile App Configuration](#mobile-app-configuration)
6. [Testing](#testing)
7. [Troubleshooting](#troubleshooting)

---

## Overview

The Chillax app uses native social login SDKs for a seamless authentication experience:

- **Google Sign-In**: Uses the native Google Sign-In SDK (no browser popup)
- **Facebook Login**: Uses the native Facebook SDK (no browser popup)

The authentication flow:
1. User taps "Continue with Google/Facebook"
2. Native SDK handles authentication (shows account picker or Facebook login)
3. App receives an ID token (Google) or access token (Facebook)
4. App exchanges the social token with Keycloak for app-specific tokens
5. User is authenticated in the app

---

## Google Sign-In Setup

### Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. At the top of the page, click the project dropdown (next to "Google Cloud")
3. Click **New Project** in the popup
4. Enter:
   - **Project name**: `Chillax`
   - **Organization**: Select your organization or leave as "No organization"
5. Click **Create**
6. Wait for the project to be created, then select it from the project dropdown

### Step 2: Enable Google People API (Optional)

> **Note**: You do NOT need to enable "Google Identity Services API" - it doesn't exist as a separate API. Google Sign-In works automatically once you create OAuth credentials.

1. In the left sidebar, click **APIs & Services** → **Library**
2. Search for **Google People API**
3. Click on it and click **Enable** (this allows fetching additional profile info)

### Step 3: Configure OAuth Consent Screen

1. In the left sidebar, go to **APIs & Services** → **OAuth consent screen**
2. Select User Type:
   - **Internal**: Only for users within your Google Workspace organization
   - **External**: For any Google account user (select this for a public app)
3. Click **Create**
4. Fill in the **App information**:
   - **App name**: `Chillax`
   - **User support email**: Select your email from dropdown
   - **App logo**: Upload your logo (optional, can add later)
5. **App domain** (optional):
   - Application home page: Your website URL
   - Privacy policy link: Your privacy policy URL
   - Terms of service link: Your ToS URL
6. **Authorized domains**: Add your domain (e.g., `chillax.com`) - optional for testing
7. **Developer contact information**:
   - Add your email address(es)
8. Click **Save and Continue**

#### Scopes Page
1. Click **Add or Remove Scopes**
2. In the filter, search and select:
   - `.../auth/userinfo.email` (See your primary email address)
   - `.../auth/userinfo.profile` (See your personal info)
   - `openid` (Associate you with your personal info)
3. Click **Update**
4. Click **Save and Continue**

#### Test Users Page (for External apps)
1. Click **Add Users**
2. Add email addresses of test users (including your own)
3. Click **Add**
4. Click **Save and Continue**

#### Summary
1. Review your settings
2. Click **Back to Dashboard**

### Step 4: Create OAuth 2.0 Credentials

You need to create OAuth Client IDs for each platform:

#### 4.1 Web Application Client ID (Required for Keycloak)

1. In the left sidebar, go to **APIs & Services** → **Credentials**
2. Click **+ Create Credentials** at the top → **OAuth client ID**
3. **Application type**: Select **Web application**
4. **Name**: `Chillax Web Client` (or any descriptive name)
5. **Authorized JavaScript origins**: Click **+ Add URI**
   - Add your Keycloak URL: `https://your-keycloak-domain.com`
   - For local development: `http://localhost:8080`
6. **Authorized redirect URIs**: Click **+ Add URI**
   - Add: `https://your-keycloak-domain.com/realms/chillax/broker/google/endpoint`
   - For local: `http://localhost:8080/realms/chillax/broker/google/endpoint`
7. Click **Create**
8. **IMPORTANT**: A popup shows your credentials
   - **Copy and save the Client ID** (looks like: `xxxxx.apps.googleusercontent.com`)
   - **Copy and save the Client Secret** (you can only see this once!)
   - Click **Download JSON** to save a backup
9. Click **OK**

#### 4.2 Android Client ID

1. Click **+ Create Credentials** → **OAuth client ID**
2. **Application type**: Select **Android**
3. **Name**: `Chillax Android`
4. **Package name**: `com.chillax.app`
5. **SHA-1 certificate fingerprint**: Get this using keytool:

   **For debug keystore (development)**:
   ```bash
   # Windows (Command Prompt)
   keytool -list -v -keystore "%USERPROFILE%\.android\debug.keystore" -alias androiddebugkey -storepass android -keypass android

   # Windows (PowerShell)
   keytool -list -v -keystore "$env:USERPROFILE\.android\debug.keystore" -alias androiddebugkey -storepass android -keypass android

   # macOS/Linux
   keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
   ```

   **For release keystore (production)**:
   ```bash
   keytool -list -v -keystore your-release-key.keystore -alias your-alias
   # Enter your keystore password when prompted
   ```

   Look for the line starting with `SHA1:` and copy the fingerprint (e.g., `AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD`)

6. Click **Create**
7. Note: For Android, you don't need to download anything - the SDK automatically uses the credential that matches your package name + SHA-1

> **Tip**: Create separate Android credentials for debug and release keystores (they have different SHA-1 fingerprints)

#### 4.3 iOS Client ID

1. Click **+ Create Credentials** → **OAuth client ID**
2. **Application type**: Select **iOS**
3. **Name**: `Chillax iOS`
4. **Bundle ID**: `com.chillax.app`
5. **App Store ID**: Leave empty (add later when app is published)
6. **Team ID**: Your 10-character Apple Developer Team ID
   - Find it at [Apple Developer Portal](https://developer.apple.com/account) → Membership → Team ID
7. Click **Create**
8. **IMPORTANT**: After creation, click on the credential to view details
   - Find **iOS URL scheme** - this is your reversed client ID
   - It looks like: `com.googleusercontent.apps.xxxxx-yyyyy`
   - You'll need this for iOS Info.plist

### Step 5: Summary of Google Credentials

After completing the steps, you should have:

| Type | Client ID | Client Secret | Usage |
|------|-----------|---------------|-------|
| Web | `xxxxx.apps.googleusercontent.com` | `GOCSPX-xxxxx` | Keycloak config + `serverClientId` in app |
| Android | `yyyyy.apps.googleusercontent.com` | N/A | Automatic (matches package + SHA-1) |
| iOS | `zzzzz.apps.googleusercontent.com` | N/A | iOS URL scheme (reversed) |

**Important Notes**:
- The **Web Client ID** is used as `serverClientId` in your Flutter app
- The **Web Client Secret** is used in Keycloak (never in the mobile app)
- Android and iOS credentials are automatically matched by the SDK

---

## Facebook Login Setup

### Step 1: Create a Facebook App

1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Click **My Apps** → **Create App**
3. Select **Consumer** (or **None** if not available)
4. Click **Next**
5. Enter app details:
   - **App name**: `Chillax`
   - **App contact email**: Your email
6. Click **Create App**

### Step 2: Add Facebook Login Product

1. In your app dashboard, find **Add Products**
2. Find **Facebook Login** and click **Set Up**
3. Select **Android** first, then **iOS**

### Step 3: Configure Android

1. In Facebook Login settings for Android:
2. **Package Name**: `com.chillax.app`
3. **Default Activity Class Name**: `com.chillax.app.MainActivity`
4. **Key Hashes**: Generate and add your key hash

   **For debug keystore**:
   ```bash
   # Windows (using Git Bash or WSL)
   keytool -exportcert -alias androiddebugkey -keystore "%USERPROFILE%\.android\debug.keystore" -storepass android | openssl sha1 -binary | openssl base64

   # macOS/Linux
   keytool -exportcert -alias androiddebugkey -keystore ~/.android/debug.keystore -storepass android | openssl sha1 -binary | openssl base64
   ```

   **For release keystore**:
   ```bash
   keytool -exportcert -alias your-alias -keystore your-release-key.keystore | openssl sha1 -binary | openssl base64
   ```

5. Add the generated hash(es) to **Key Hashes**
6. Enable **Single Sign On**: Yes
7. Click **Save**

### Step 4: Configure iOS

1. In Facebook Login settings for iOS:
2. **Bundle ID**: `com.chillax.app`
3. Enable **Single Sign On**: Yes
4. Click **Save**

### Step 5: Get App Credentials

1. Go to **Settings** → **Basic**
2. Note down:
   - **App ID**: `123456789012345` (numeric)
   - **App Secret**: Click **Show** and copy the secret
3. Scroll down and click **+ Add Platform** if not already added:
   - Add **Android** with package name `com.chillax.app`
   - Add **iOS** with bundle ID `com.chillax.app`
4. Click **Save Changes**

### Step 6: Get Client Token

1. Go to **Settings** → **Advanced**
2. Find **Client Token** in the Security section
3. Copy the **Client Token** (different from App Secret)

### Step 7: Configure App Permissions

1. Go to **App Review** → **Permissions and Features**
2. Ensure these are available:
   - `email` - Should be available by default
   - `public_profile` - Should be available by default

### Step 8: Set App Mode

For testing:
1. Go to **Settings** → **Basic**
2. **App Mode**: Keep in **Development** mode for testing
3. Add test users in **Roles** → **Test Users**

For production:
1. Complete **App Review** requirements
2. Switch to **Live** mode

---

## Keycloak Configuration

### Prerequisites: Enable Token Exchange Feature

Token exchange must be enabled when starting Keycloak. Update your Keycloak startup command:

**For Development (using kc.bat or kc.sh)**:
```bash
# Windows
kc.bat start-dev --features="token-exchange,admin-fine-grained-authz"

# Linux/macOS
./kc.sh start-dev --features="token-exchange,admin-fine-grained-authz"
```

**For Docker**:
```yaml
services:
  keycloak:
    image: quay.io/keycloak/keycloak:latest
    command: start-dev --features="token-exchange,admin-fine-grained-authz"
    # ... rest of config
```

**For .NET Aspire (Ninja.AppHost)**:
If using Aspire's Keycloak integration, you may need to customize the Keycloak container to add these features.

### Step 1: Configure Google Identity Provider

1. Log in to **Keycloak Admin Console** (e.g., `http://localhost:8080/admin`)
2. Select the **chillax** realm from the dropdown (top-left)
3. In the left sidebar, go to **Identity Providers**
4. Click **Add provider** dropdown → Select **Google**
5. Configure the following:

   | Field | Value |
   |-------|-------|
   | Alias | `google` (keep default) |
   | Display Name | `Google` |
   | Enabled | ON |
   | Trust Email | ON |
   | Store Tokens | ON (important for token exchange) |
   | Stored Tokens Readable | ON |
   | Client ID | Your **Web** Client ID from Google Cloud Console |
   | Client Secret | Your **Web** Client Secret from Google Cloud Console |
   | Default Scopes | `openid profile email` |

6. Expand **Advanced Settings**:
   - **Sync Mode**: `import` or `force` (import creates user on first login)

7. Click **Save**

### Step 2: Configure Facebook Identity Provider

1. Go to **Identity Providers** → **Add provider** → **Facebook**
2. Configure:

   | Field | Value |
   |-------|-------|
   | Alias | `facebook` (keep default) |
   | Display Name | `Facebook` |
   | Enabled | ON |
   | Trust Email | ON |
   | Store Tokens | ON |
   | Stored Tokens Readable | ON |
   | Client ID | Your Facebook App ID |
   | Client Secret | Your Facebook App Secret |
   | Default Scopes | `email public_profile` |

3. Click **Save**

### Step 3: Configure Mobile App Client for Token Exchange

1. Go to **Clients** → Click on **mobile-app**
2. In the **Settings** tab, ensure:
   - **Client authentication**: OFF (public client)
   - **Standard flow**: ON
   - **Direct access grants**: ON

3. Go to the **Authorization** tab (if available):
   - Enable **Authorization**
   - Click **Save**

4. Go to the **Permissions** tab:
   - Toggle **Permissions Enabled** to ON

### Step 4: Create Token Exchange Permissions

This step allows the mobile-app client to exchange tokens from identity providers.

#### 4.1 Create a Client Policy

1. Go to **Realm Settings** → **Authorization** (or **Clients** → **realm-management** → **Authorization**)
2. Go to **Policies** tab → **Create policy** → **Client**
3. Configure:
   - **Name**: `mobile-app-policy`
   - **Clients**: Select `mobile-app`
   - **Logic**: Positive
4. Click **Save**

#### 4.2 Apply Policy to Token Exchange Permission

1. Go to **Clients** → **mobile-app** → **Permissions** tab
2. Click on **token-exchange**
3. In **Policies**, add `mobile-app-policy`
4. Click **Save**

#### 4.3 Enable Token Exchange on Identity Providers

1. Go to **Identity Providers** → **google** → **Permissions** tab
2. Toggle **Permissions Enabled** to ON
3. Click on **token-exchange** permission
4. Add `mobile-app-policy` to the policies
5. Click **Save**
6. Repeat for **facebook** identity provider

### Step 5: Configure First Broker Login Flow

This controls what happens when a user first logs in with a social provider:

1. Go to **Authentication** in the left sidebar
2. Find **first broker login** flow
3. The default configuration usually works well:
   - **Review Profile** (Optional): Lets users review/edit their profile
   - **Create User If Unique**: Creates a new Keycloak user if email doesn't exist
   - **Automatically Link Brokered Account**: Links to existing account if email matches

### Alternative: Using Realm Configuration JSON

If you prefer to configure via JSON, update `chillax-realm.json`:

```json
"identityProviders": [
  {
    "alias": "google",
    "displayName": "Google",
    "providerId": "google",
    "enabled": true,
    "trustEmail": true,
    "storeToken": true,
    "config": {
      "clientId": "YOUR_GOOGLE_WEB_CLIENT_ID.apps.googleusercontent.com",
      "clientSecret": "YOUR_GOOGLE_CLIENT_SECRET",
      "defaultScope": "openid profile email",
      "syncMode": "IMPORT"
    }
  },
  {
    "alias": "facebook",
    "displayName": "Facebook",
    "providerId": "facebook",
    "enabled": true,
    "trustEmail": true,
    "storeToken": true,
    "config": {
      "clientId": "YOUR_FACEBOOK_APP_ID",
      "clientSecret": "YOUR_FACEBOOK_APP_SECRET",
      "defaultScope": "email public_profile",
      "syncMode": "IMPORT"
    }
  }
]
```

Then re-import the realm or restart Keycloak with the updated configuration.

---

## Mobile App Configuration

### Android Configuration

#### 1. Update `android/app/build.gradle`

Ensure minimum SDK version is set:
```gradle
android {
    defaultConfig {
        minSdkVersion 21
        // ...
    }
}
```

#### 2. Create `android/app/src/main/res/values/strings.xml`

Create or update the file:
```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">Chillax</string>

    <!-- Facebook Login -->
    <string name="facebook_app_id">YOUR_FACEBOOK_APP_ID</string>
    <string name="fb_login_protocol_scheme">fbYOUR_FACEBOOK_APP_ID</string>
    <string name="facebook_client_token">YOUR_FACEBOOK_CLIENT_TOKEN</string>
</resources>
```

Replace:
- `YOUR_FACEBOOK_APP_ID` with your Facebook App ID (e.g., `123456789012345`)
- `YOUR_FACEBOOK_CLIENT_TOKEN` with your Facebook Client Token

#### 3. Update `android/app/src/main/AndroidManifest.xml`

Add inside `<application>` tag:
```xml
<application ...>
    <!-- Existing content -->

    <!-- Facebook Login -->
    <meta-data
        android:name="com.facebook.sdk.ApplicationId"
        android:value="@string/facebook_app_id"/>
    <meta-data
        android:name="com.facebook.sdk.ClientToken"
        android:value="@string/facebook_client_token"/>

    <activity
        android:name="com.facebook.FacebookActivity"
        android:configChanges="keyboard|keyboardHidden|screenLayout|screenSize|orientation"
        android:label="@string/app_name" />
    <activity
        android:name="com.facebook.CustomTabActivity"
        android:exported="true">
        <intent-filter>
            <action android:name="android.intent.action.VIEW" />
            <category android:name="android.intent.category.DEFAULT" />
            <category android:name="android.intent.category.BROWSABLE" />
            <data android:scheme="@string/fb_login_protocol_scheme" />
        </intent-filter>
    </activity>
</application>
```

### iOS Configuration

#### 1. Update `ios/Runner/Info.plist`

Add these entries inside the `<dict>` tag:

```xml
<!-- Google Sign-In -->
<key>CFBundleURLTypes</key>
<array>
    <!-- Existing URL scheme for deep links -->
    <dict>
        <key>CFBundleTypeRole</key>
        <string>Editor</string>
        <key>CFBundleURLName</key>
        <string>com.chillax.app</string>
        <key>CFBundleURLSchemes</key>
        <array>
            <string>com.chillax.app</string>
        </array>
    </dict>
    <!-- Google Sign-In URL scheme -->
    <dict>
        <key>CFBundleTypeRole</key>
        <string>Editor</string>
        <key>CFBundleURLSchemes</key>
        <array>
            <!-- Replace with your REVERSED_CLIENT_ID from Google iOS credential -->
            <string>com.googleusercontent.apps.YOUR_IOS_CLIENT_ID</string>
        </array>
    </dict>
    <!-- Facebook Login URL scheme -->
    <dict>
        <key>CFBundleTypeRole</key>
        <string>Editor</string>
        <key>CFBundleURLSchemes</key>
        <array>
            <string>fbYOUR_FACEBOOK_APP_ID</string>
        </array>
    </dict>
</array>

<!-- Facebook Login -->
<key>FacebookAppID</key>
<string>YOUR_FACEBOOK_APP_ID</string>
<key>FacebookClientToken</key>
<string>YOUR_FACEBOOK_CLIENT_TOKEN</string>
<key>FacebookDisplayName</key>
<string>Chillax</string>

<!-- Required for Facebook Login -->
<key>LSApplicationQueriesSchemes</key>
<array>
    <string>fbapi</string>
    <string>fb-messenger-share-api</string>
    <string>fbauth2</string>
    <string>fbshareextension</string>
</array>
```

Replace:
- `YOUR_IOS_CLIENT_ID` with the iOS client ID from Google (the part before `.apps.googleusercontent.com`, reversed)
- `YOUR_FACEBOOK_APP_ID` with your Facebook App ID
- `YOUR_FACEBOOK_CLIENT_TOKEN` with your Facebook Client Token

#### 2. Get the Reversed Client ID

The reversed client ID for Google Sign-In on iOS:
1. Your iOS Client ID looks like: `123456789-abcdefg.apps.googleusercontent.com`
2. The reversed version is: `com.googleusercontent.apps.123456789-abcdefg`

### App Configuration

Update `lib/core/config/app_config.dart`:

```dart
// Social login configuration
static const String googleServerClientId = 'YOUR_GOOGLE_WEB_CLIENT_ID.apps.googleusercontent.com';
```

Replace `YOUR_GOOGLE_WEB_CLIENT_ID` with your **Web** Client ID from Google Cloud Console.

---

## Testing

### Test Google Sign-In

1. Run the app on a physical device or emulator with Google Play Services
2. Tap "Continue with Google"
3. Select a Google account (must be a test user if app is in testing mode)
4. You should be redirected back to the app and logged in

### Test Facebook Login

1. Run the app on a physical device or emulator
2. Tap "Continue with Facebook"
3. Log in with a Facebook test user account
4. Grant permissions when prompted
5. You should be redirected back to the app and logged in

### Verify Token Exchange

Check the app logs for:
```
Attempting native social sign in with: google
Google sign in successful, got ID token
Exchanging google token with Keycloak
Token exchange response status: 200
```

---

## Troubleshooting

### Google Sign-In Issues

#### "Sign in failed" or "Error 10"
- **Cause**: SHA-1 fingerprint mismatch
- **Solution**:
  1. Verify the SHA-1 in Google Cloud Console matches your keystore
  2. For debug builds, use the debug keystore SHA-1
  3. For release builds, use the release keystore SHA-1

#### "Error 12500" (SIGN_IN_CANCELLED)
- **Cause**: User cancelled or configuration issue
- **Solution**: Check that the Web Client ID is correctly set in `serverClientId`

#### "Error 12501"
- **Cause**: User cancelled sign-in
- **Solution**: This is expected behavior when user cancels

#### iOS: Google Sign-In not working
- **Cause**: Missing or incorrect reversed client ID
- **Solution**: Ensure the URL scheme in Info.plist matches your iOS credential's reversed client ID

### Facebook Login Issues

#### "App not set up" error
- **Cause**: App is in Development mode and user is not a test user
- **Solution**:
  1. Add the user as a test user in Facebook Developer Console
  2. Or switch app to Live mode (requires app review)

#### Key hash mismatch
- **Cause**: The key hash doesn't match what's registered
- **Solution**:
  1. Generate the correct key hash for your keystore
  2. Add it to Facebook Developer Console
  3. Remember: debug and release use different keystores

#### "Facebook SDK not initialized"
- **Cause**: Missing Facebook configuration in Android/iOS
- **Solution**: Ensure all Facebook meta-data is in AndroidManifest.xml and Info.plist

### Keycloak Token Exchange Issues

#### "Invalid token" or 400 error
- **Cause**: Token exchange not properly configured
- **Solution**:
  1. Ensure identity providers are correctly configured in Keycloak
  2. Verify the social token is being passed correctly
  3. Check Keycloak server logs for detailed errors

#### "User not found"
- **Cause**: First-time social login user creation failed
- **Solution**:
  1. Check "First Broker Login" flow in Keycloak
  2. Ensure "Create User If Unique" is enabled

---

## Environment Variables

For production, use environment variables instead of hardcoding credentials:

### Flutter App

Build with:
```bash
flutter build apk --dart-define=GOOGLE_SERVER_CLIENT_ID=your-client-id
```

### Keycloak

Set these environment variables:
```bash
GOOGLE_CLIENT_ID=your-google-web-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
FACEBOOK_CLIENT_ID=your-facebook-app-id
FACEBOOK_CLIENT_SECRET=your-facebook-app-secret
```

---

## Security Checklist

- [ ] Never commit client secrets to version control
- [ ] Use different credentials for development and production
- [ ] Enable App Check (Firebase) for additional security
- [ ] Regularly rotate client secrets
- [ ] Monitor authentication logs for suspicious activity
- [ ] Enable 2FA on your Google Cloud and Facebook Developer accounts

---

## Quick Reference

| Platform | Credential | Where to Use |
|----------|------------|--------------|
| Google Web Client ID | Keycloak + `serverClientId` | `app_config.dart`, Keycloak |
| Google Web Client Secret | Keycloak only | Keycloak Admin Console |
| Google Android Client ID | Automatic | Just create it, SDK uses package+SHA1 |
| Google iOS Client ID | iOS URL scheme | `Info.plist` (reversed) |
| Facebook App ID | Android + iOS + Keycloak | `strings.xml`, `Info.plist`, Keycloak |
| Facebook App Secret | Keycloak only | Keycloak Admin Console |
| Facebook Client Token | Android + iOS | `strings.xml`, `Info.plist` |
