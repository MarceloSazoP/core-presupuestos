# CorePresupuesto Mobile - Build Instructions

Guía para generar builds de iOS y Android.

## Prerrequisitos

### Para desarrollo local
```bash
npm install -g eas-cli
eas login  # Necesitas cuenta en https://expo.dev/
```

### iOS
- Mac con Xcode (para desarrollo local)
- Apple ID para publicar en App Store
- Team ID de Apple Developer

### Android
- Android Studio (para desarrollo local)
- Google Play Console account para publicar

---

## Desarrollo Local

### Iniciar app en modo desarrollo
```bash
npx expo start
```

Luego:
- **iOS:** Presiona `i` (requiere Xcode)
- **Android:** Presiona `a` (requiere Android Emulator)

### Build de desarrollo local (con Xcode/Android Studio)
```bash
# iOS
npx expo run:ios

# Android
npx expo run:android
```

---

## Builds en la Nube con EAS

EAS permite compilar en la nube sin necesidad de Mac o configuraciones locales.

### 1. Build de Preview (para testing)

Genera APK (Android) e IPA ad-hoc (iOS):

```bash
# Android (genera APK para testing)
eas build --platform android --profile preview

# iOS (genera IPA para testing)
eas build --platform ios --profile preview
```

### 2. Build de Producción

Genera AAB (Android) e IPA oficial (iOS):

```bash
# Android (para Google Play Store)
eas build --platform android --profile production

# iOS (para Apple App Store)
eas build --platform ios --profile production
```

### 3. Ambas plataformas en paralelo
```bash
eas build --platform all --profile production
```

---

## Configuración por Plataforma

### iOS

#### 1. Configurar app.json
```json
{
  "expo": {
    "ios": {
      "bundleIdentifier": "com.corepresupuesto.app",
      "infoPlist": {
        "NSCameraUsageDescription": "...",
        "NSPhotoLibraryUsageDescription": "..."
      }
    }
  }
}
```

#### 2. Apple Developer Program
1. Enroll en https://developer.apple.com/
2. Crear App ID en Apple Developer
3. Generar certificados y provisioning profiles
4. Configuar en EAS:
   ```bash
   eas credentials
   ```

#### 3. Publicar en App Store
```bash
eas submit --platform ios --profile production
```

---

### Android

#### 1. Configurar app.json
```json
{
  "expo": {
    "android": {
      "package": "com.corepresupuesto.app",
      "permissions": [
        "android.permission.CAMERA",
        "android.permission.ACCESS_FINE_LOCATION"
      ]
    }
  }
}
```

#### 2. Google Play Console
1. Crear proyecto en https://play.google.com/console
2. Crear app entry
3. Configurar credenciales en EAS:
   ```bash
   eas credentials
   ```

#### 4. Publicar en Google Play
```bash
eas submit --platform android --profile production
```

---

## Over-The-Air Updates

Después de publicar, puedes enviar actualizaciones sin pasar por App Store:

```bash
# Actualizar código
git add .
git commit -m "Update feature"

# Publicar actualización
eas update --platform all
```

---

## Troubleshooting

### Error: "credentials not found"
```bash
eas credentials
# Selecciona la opción de crear nuevos credentials
```

### Error: "Build failed"
Chequear logs:
```bash
eas build --platform ios --profile production --wait  # ver logs en tiempo real
```

---

## Estructura de Builds

| Tipo | Plataforma | Archivo | Uso |
|------|-----------|---------|-----|
| Development | iOS | .app | Xcode local |
| Development | Android | .apk | Android Emulator |
| Preview | iOS | .ipa | TestFlight |
| Preview | Android | .apk | Email/Drive |
| Production | iOS | .ipa | App Store |
| Production | Android | .aab | Google Play |

---

## Documentación

- **Expo Build:** https://docs.expo.dev/eas-update/introduction/
- **EAS Submit:** https://docs.expo.dev/eas-submit/introduction/
- **EAS Update:** https://docs.expo.dev/eas-update/introduction/
- **iOS Publishing:** https://docs.expo.dev/build/internal-distribution/
- **Android Publishing:** https://docs.expo.dev/build-reference/android-builds/
