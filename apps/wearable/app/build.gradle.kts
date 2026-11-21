plugins {
    alias(libs.plugins.android.application)
}

android {
    namespace = "me.glycotwin.patient"
    compileSdk {
        version = release(37)
    }

    defaultConfig {
        applicationId = "me.glycotwin.patient"
        minSdk = 26
        targetSdk = 37
        versionCode = providers.gradleProperty("releaseCode").orElse("1").get().toInt()
        versionName = providers.gradleProperty("releaseName").orElse("1.0").get()

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildFeatures {
        buildConfig = true
    }

    buildTypes {
        release {
            optimization {
                enable = true
                packageScope = setOf("androidx.**", "kotlin.**", "kotlinx.**")
            }
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
}

dependencies {
    implementation(libs.androidx.appcompat)
    implementation(libs.androidx.core.ktx)
    implementation(libs.material)
    implementation(libs.play.services.wearable)
    testImplementation(libs.junit)
    androidTestImplementation(libs.androidx.espresso.core)
    androidTestImplementation(libs.androidx.junit)
}
