# Ubicación y mapa de la dirección del trabajo

Estado: **prototipo (2026-10-06)**. Se prueba con usuarios antes de darlo por cerrado; si resulta bien, es la base de los recordatorios por ubicación (§6).

## 1. Qué hace

En «El trabajo» (al crear un presupuesto y en la parte *Visita*), debajo de la dirección hay un mapa. La persona puede:

1. **Ubicarse con el GPS**: «Usar mi ubicación» pone el pin donde está parada.
2. **Marcar un punto**: tocar el mapa o arrastrar el pin.
3. **Escribir la dirección con sugerencias**: al escribir se muestran direcciones; al elegir una, el mapa busca el punto y pone el pin.

El resultado son tres datos del presupuesto: `address` (texto), `latitude` y `longitude`. El contrato ya los acepta (*Contrato de API* §6, §12): van juntos o ninguno. No se guarda nada en segundo plano: solo lo que la persona confirma con «Listo».

## 2. Componentes

| Pieza | Qué usa | Costo |
|-------|---------|-------|
| GPS | `expo-location` (permiso «mientras se usa la app») | gratis |
| Mapa | `react-native-maps`: Google Maps en Android, Apple Maps en iPhone | gratis para apps móviles |
| Sugerencias de direcciones | *Places API (New)* de Google, **a través del backend** | por uso; con cupo gratis mensual |
| Dirección a partir del pin | geocodificación inversa del teléfono (`expo-location`) | gratis, con límites del sistema |
| Buscar una dirección escrita, sin sugerencias | geocodificación del teléfono (`expo-location`) | gratis, con límites del sistema |

`react-native-maps` funciona en Expo Go (Apple Maps en iPhone). Para publicar en Android hay que poner la clave de *Maps SDK for Android* en `app.json` (plugin `react-native-maps`) y restringirla por paquete y huella SHA-1.

## 3. Por qué el backend hace de intermediario con Places

La clave de Places no va dentro de la app: quien la extrajera podría gastar el cupo. El backend la guarda (`GOOGLE_PLACES_API_KEY`), exige sesión y limita las consultas por usuario. Si la clave no está configurada, los endpoints responden `503 PLACES_UNAVAILABLE` y la app sigue funcionando: se puede marcar el punto en el mapa o buscar la dirección escrita con el geocodificador del teléfono, sin sugerencias.

Las sugerencias se piden con una `session` (token de sesión de Places): agrupa lo que se escribe y el detalle del lugar elegido en una sola cobranza.

## 4. Privacidad

- Se pide el permiso de ubicación solo al tocar «Usar mi ubicación», con un texto claro.
- No hay seguimiento en segundo plano en esta etapa.
- La ubicación es un dato interno del profesional: **no sale en el PDF ni en la vista del cliente** mientras no se decida otra cosa.

## 5. Sin conexión

El GPS funciona sin internet y el punto viaja por la cola de envío como el resto del presupuesto (`PATCH /quotes/{id}` con `address`, `latitude`, `longitude`). Sin conexión no se ven las calles del mapa ni hay sugerencias: queda marcar el punto y las coordenadas.

## 6. Más adelante: recordatorios por ubicación

Si el prototipo resulta bien se evalúa un tipo de aviso «GPS»: avisar cuando la persona pase cerca de la dirección de un presupuesto pendiente. Con `expo-location` sería *geofencing*, que exige permiso de ubicación **siempre** (segundo plano) y tiene límites: 20 regiones activas en iPhone y 100 en Android, y no funciona si la app se cierra del todo en Android. Se decide aparte, con una definición funcional propia.

## 7. Qué se necesita

- Una cuenta de Google Cloud con tarjeta, y un proyecto con *Places API (New)* activada (clave del servidor, restringida por IP del VPS) y, para publicar en Android, *Maps SDK for Android* (clave de la app).
- Una alerta de gasto en Google Cloud.
