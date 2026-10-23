import type { EmittedFile } from '../../../core/target';

/**
 * Generates the build.gradle.kts file for the Compose design system library module.
 */
export function buildGradleKts(packageName: string): string {
  return `plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "${packageName}"
    compileSdk = 35

    defaultConfig {
        minSdk = 24
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
    }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2024.10.01")
    implementation(composeBom)
    androidTestImplementation(composeBom)

    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.runtime:runtime")
}
`;
}

/**
 * Generates the standard AndroidManifest.xml for the Compose library module.
 */
export function androidManifestXml(_packageName: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android" />
`;
}

/**
 * Generates quickstart documentation for integrating the Compose library module.
 */
export function readmeMd(packageName: string): string {
  return `# ${packageName}

Generated Jetpack Compose design system library. Produced by Varcast. Do not edit by hand.

## Getting Started

### 1. Include Module

Add this library module to your \`settings.gradle.kts\`:

\`\`\`kotlin
include(":designsystem")
project(":designsystem").projectDir = file("path/to/${packageName}")
\`\`\`

### 2. Add Dependency

Add the project dependency to your application's \`build.gradle.kts\`:

\`\`\`kotlin
dependencies {
    implementation(project(":designsystem"))
}
\`\`\`

## Usage

Wrap your root Composable with \`DesignSystemTheme\`:

\`\`\`kotlin
@Composable
fun App() {
    DesignSystemTheme {
        Surface(color = DesignSystemTheme.colors.backgroundPrimary) {
            Text(
                text = "Hello Compose",
                style = DesignSystemTheme.textStyles.heading1,
            )
        }
    }
}
\`\`\`

### Switching Modes at Runtime

Modes can be switched programmatically from anywhere using the \`AppTheme\` facade:

\`\`\`kotlin
// Instant mode switch
AppTheme.setColorTokensMode(ColorTokensMode.Dark)

// Animated mode transition (interpolated lerp)
AppTheme.setColorTokensMode(ColorTokensMode.Dark, durationMillis = 300)

// Configure global default transition duration
AppTheme.defaultDurationMillis = 200
\`\`\`
`;
}

/**
 * Emits all root static files for the Compose target.
 */
export function emitStaticFiles(packageName: string): EmittedFile[] {
  return [
    {
      path: 'build.gradle.kts',
      contents: buildGradleKts(packageName),
    },
    {
      path: 'src/main/AndroidManifest.xml',
      contents: androidManifestXml(packageName),
    },
    {
      path: 'README.md',
      contents: readmeMd(packageName),
    },
  ];
}
