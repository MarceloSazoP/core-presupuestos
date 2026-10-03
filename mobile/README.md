# App móvil (Expo SDK 57, iPhone primero)

React Native + Expo Router. Sin reglas de negocio: captura y presenta, y todo lo decide la API (CLAUDE.md §6). Las pautas de código salen de CLAUDE.md §29.1 (skills `vercel-react-native-skills`, `mobile-app-ui-design`) y de la documentación del SDK 57.

## Qué hace hoy (hitos 1 y 2)

- **Ingreso**: nombre, teléfono y correo → confirmar y elegir SMS o correo → código de 6 dígitos → entra. La sesión queda en el Keychain (`expo-secure-store`), así la app abre sin señal.
- **Presupuestos**: lista (`GET /quotes`) con su estado y botón «Nuevo presupuesto» en la zona del pulgar.
- **Nuevo presupuesto** (Etapa 1): cliente, teléfono, correo y dirección opcionales, y el trabajo. Al crearlo, el servidor entrega el **código del presupuesto**.
- **Detalle**: muestra el código en grande, con **Copiar** y **Compartir**. Ese código se escribe en la web («Consultar presupuesto») para completar, editar o cerrar el presupuesto desde el computador. El secreto solo se entrega una vez: se guarda en el teléfono y, si se pierde, se genera uno nuevo.

- **Visita en terreno** (Etapa 2, en el detalle de un presupuesto pendiente): **notas** (se guardan al salir del campo), **medidas** (etiqueta y valor), **fotos** (cámara o galería, reducidas a JPEG de hasta 2048 px antes de subirlas) y **notas de voz** (hasta 5 min, se pueden escuchar y quitar). Todo es interno: no sale en el PDF. Por ahora requiere conexión.

Falta: ítems, finalizar y enviar desde la app, seguimiento y captura **sin conexión** (SQLite + cola de envíos).

## Probar en tu iPhone (gratis, con Expo Go)

1. Instala **Expo Go** desde la App Store. No hace falta cuenta de Apple Developer.
2. Con el computador y el iPhone en la **misma red Wi-Fi**, en `mobile/.env.local` pon la IP del computador (no `localhost`, que en el teléfono es el propio teléfono):

   ```
   EXPO_PUBLIC_API_URL=http://<IP-del-computador>:3013/api/v1
   ```

3. Levanta la API (`iniciar-api.bat`, o `cd backend && npm run dev`) y la app:

   ```bash
   cd mobile
   npm install
   npx expo start
   ```

4. Escanea el QR con la cámara del iPhone y ábrelo en Expo Go.
5. Sin cuentas de SMS ni correo configuradas, el código de verificación aparece en la consola de la API (`OTP_LOG_CODES=true` en `backend/.env`).

Si no conecta, revisa el cortafuegos de Windows: debe permitir a Node en redes privadas los puertos **3013** (API) y **8081** (Metro).

## Comandos

```bash
npm test          # lógica pura: teléfono y montos
npm run check     # tipos
npx expo lint     # lint
npx expo-doctor   # diagnóstico de dependencias y configuración
```

El movimiento y los gestos finos se validan en un build de release (`eas build`), no en Expo Go. Las builds propias en el teléfono y TestFlight sí requieren Apple Developer.
