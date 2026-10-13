import java.util.Base64
import java.util.Properties
import java.io.FileInputStream

plugins {
    id("com.android.application")
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
    id("com.google.gms.google-services")
    id("com.google.firebase.crashlytics")
}

val keystorePropertiesFile = rootProject.file("key.properties")
val keystoreProperties = Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(FileInputStream(keystorePropertiesFile))
}

// The build's record (--dart-define-from-file=tenants/<slug>.json), which Flutter hands Gradle
// base64-encoded, one define each: the Maps SDK key goes into the manifest from here, so the
// record is the one place it is given. Absent, the manifest carries an empty key and the app
// draws the free map (lib/core/config/app_config.dart)
val dartDefines: Map<String, String> = (project.findProperty("dart-defines") as String?)
    ?.split(",")
    // Base64 imported, not spelled java.util.Base64: in a build script `java` is the Java plugin's settings
    ?.mapNotNull { encoded: String -> runCatching { String(Base64.getDecoder().decode(encoded)) }.getOrNull() }
    ?.mapNotNull { define: String -> define.split("=", limit = 2).takeIf { it.size == 2 }?.let { it[0] to it[1] } }
    ?.toMap()
    ?: emptyMap()

android {
    namespace = "com.chillax.client"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        isCoreLibraryDesugaringEnabled = true
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_17.toString()
    }

    defaultConfig {
        applicationId = "com.chillax.client"
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
        manifestPlaceholders["googleMapsKey"] = dartDefines["GOOGLE_MAPS_ANDROID_KEY"] ?: ""
    }

    signingConfigs {
        create("release") {
            if (keystorePropertiesFile.exists()) {
                keyAlias = keystoreProperties["keyAlias"] as String
                keyPassword = keystoreProperties["keyPassword"] as String
                storeFile = file(keystoreProperties["storeFile"] as String)
                storePassword = keystoreProperties["storePassword"] as String
            }
        }
    }

    buildTypes {
        release {
            signingConfig = if (keystorePropertiesFile.exists()) {
                signingConfigs.getByName("release")
            } else {
                signingConfigs.getByName("debug")
            }
        }
    }
}

dependencies {
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.4")
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("com.google.firebase:firebase-messaging:24.1.0")
}

flutter {
    source = "../.."
}
