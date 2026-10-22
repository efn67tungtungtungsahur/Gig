plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.gig.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.gig.app"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"
    }

    // Fester Schlüssel im Repo, damit neue Versionen sich einfach über die alte installieren lassen.
    signingConfigs {
        create("gig") {
            storeFile = file("gig.keystore")
            storePassword = "gigapp"
            keyAlias = "gig"
            keyPassword = "gigapp"
        }
    }

    buildTypes {
        getByName("debug") {
            signingConfig = signingConfigs.getByName("gig")
        }
        getByName("release") {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("gig")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}
