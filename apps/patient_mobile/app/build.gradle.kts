plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
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
        buildConfigField("String", "API_BASE_URL", "\"https://api.glycotwin.me/api/v1/\"")
        manifestPlaceholders["allowCleartext"] = false

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        release {
            manifestPlaceholders["allowCleartext"] = false
            optimization {
                // The scoped optimizer in beta 1 produced an IllegalAccessError during AndroidX startup.
                enable = false
            }
        }
        debug {
            val debugApiUrl = project.findProperty("API_BASE_URL") as String? ?: "http://127.0.0.1:5050/api/v1/"
            buildConfigField("String", "API_BASE_URL", "\"$debugApiUrl\"")
            manifestPlaceholders["allowCleartext"] = true
        }
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
}

dependencies {
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.appcompat)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.core.ktx)
    implementation(libs.material)
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)
    implementation("androidx.compose.material:material-icons-extended")
    implementation(libs.retrofit)
    implementation(libs.retrofit.gson)
    implementation(libs.gson)
    implementation(libs.kotlinx.coroutines.android)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation("com.google.android.gms:play-services-wearable:19.0.0")
    implementation("androidx.health.connect:connect-client:1.1.0")
    testImplementation(libs.junit)
    androidTestImplementation(libs.androidx.espresso.core)
    androidTestImplementation(libs.androidx.junit)
}
