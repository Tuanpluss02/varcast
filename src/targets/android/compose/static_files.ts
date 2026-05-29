import { FILE_HEADER, internalPackageLine, packageLine } from './emit_helpers';
import type { AndroidOptions } from '../options';

export function settingsGradleKts(options: AndroidOptions): string {
  return `pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "${options.packageName}"
`;
}

export function buildGradleKts(options: AndroidOptions): string {
  return `plugins {
    id("com.android.library") version "8.5.2"
    id("org.jetbrains.kotlin.android") version "1.9.25"
}

android {
    namespace = "${options.androidNamespace}"
    compileSdk = 35

    defaultConfig {
        minSdk = 23
    }

    buildFeatures {
        compose = true
    }

    composeOptions {
        kotlinCompilerExtensionVersion = "1.5.15"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }

    kotlinOptions {
        jvmTarget = "11"
    }
}

dependencies {
    implementation(platform("androidx.compose:compose-bom:2024.10.01"))
    implementation("androidx.compose.runtime:runtime")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-text")
    testImplementation(kotlin("test"))
}
`;
}

export function androidManifestXml(): string {
  return `<manifest xmlns:android="http://schemas.android.com/apk/res/android" />
`;
}

export function readmeMd(options: AndroidOptions): string {
  return `# ${options.packageName}

Generated Android Compose design system package. Do not edit by hand.

## Namespace

\`${options.androidNamespace}\`

The namespace is used for both Gradle \`android.namespace\` and generated Kotlin
\`package\` declarations.

## Setup

Import this folder as an Android library module or copy it into your app's
packages/modules directory.

## Usage

\`\`\`kotlin
import ${options.androidNamespace}.AppTheme
import ${options.androidNamespace}.DesignSystemWrapper

DesignSystemWrapper {
    val theme = AppTheme.current

    // Example:
    // Text(
    //     text = "Hello",
    //     color = theme.colorToken.textPrimary,
    //     style = theme.textStyles.bodyMedium,
    // )
}
\`\`\`

## Modes

\`\`\`kotlin
// Example, depending on the collections exported from Figma:
// AppTheme.setColorTokenMode(ColorTokenMode.DarkMode)
\`\`\`
`;
}

export function designSystemKt(namespace: string): string {
  return (
    FILE_HEADER +
    packageLine(namespace) +
    `import ${namespace}.internal.DesignSystemController\n\n` +
    `object DesignSystem {\n` +
    `    fun resetForTest() {\n` +
    `        DesignSystemController.instance.resetForTest()\n` +
    `    }\n` +
    `}\n`
  );
}

export function wrapperKt(namespace: string): string {
  return (
    FILE_HEADER +
    packageLine(namespace) +
    `import androidx.compose.runtime.Composable\n` +
    `import androidx.compose.runtime.CompositionLocalProvider\n` +
    `import androidx.compose.runtime.remember\n` +
    `import ${namespace}.internal.DesignSystemController\n` +
    `import ${namespace}.internal.LocalDesignSystemController\n\n` +
    `@Composable\n` +
    `fun DesignSystemWrapper(content: @Composable () -> Unit) {\n` +
    `    val controller = remember { DesignSystemController.instance }\n` +
    `    CompositionLocalProvider(LocalDesignSystemController provides controller) {\n` +
    `        content()\n` +
    `    }\n` +
    `}\n`
  );
}

export function lerpKt(namespace: string): string {
  return (
    FILE_HEADER +
    internalPackageLine(namespace) +
    `import androidx.compose.ui.graphics.Color\n\n` +
    `internal fun Float.lerpTo(other: Float, t: Float): Float = this + ((other - this) * t)\n\n` +
    `internal fun Color.lerpTo(other: Color, t: Float): Color = Color(\n` +
    `    red = red.lerpTo(other.red, t),\n` +
    `    green = green.lerpTo(other.green, t),\n` +
    `    blue = blue.lerpTo(other.blue, t),\n` +
    `    alpha = alpha.lerpTo(other.alpha, t),\n` +
    `)\n\n` +
    `internal fun String.lerpTo(other: String, t: Float): String = if (t < 0.5f) this else other\n\n` +
    `internal fun Boolean.lerpTo(other: Boolean, t: Float): Boolean = if (t < 0.5f) this else other\n`
  );
}

export function smokeTestKt(namespace: string): string {
  return (
    FILE_HEADER +
    packageLine(namespace) +
    `import kotlin.test.Test\n` +
    `import kotlin.test.assertNotNull\n\n` +
    `class SmokeTest {\n` +
    `    @Test\n` +
    `    fun designSystemExists() {\n` +
    `        assertNotNull(DesignSystem)\n` +
    `    }\n` +
    `}\n`
  );
}
