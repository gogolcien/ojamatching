# Ojamatching

App móvil para organizar torneos desde el celular, sin conexión a
internet — "Ojamatching" (Ojama + Matching). Toda la información
(torneos, jugadores, rondas, resultados) se guarda localmente en el
dispositivo con SQLite (`expo-sqlite`); nada se envía a ningún servidor.

Es un proyecto **separado** de la página web `ligas-torneos`: no comparte
base de datos ni backend con ella. Solo se reutilizó la lógica pura (sin
dependencias de servidor) de pareo suizo, puntos y desempates.

## Generar el APK instalable (recomendado)

Así el organizador solo necesita descargar e instalar el `.apk`, sin usar
Expo Go ni tener Node instalado en el celular.

1. Crea una cuenta gratuita en [expo.dev](https://expo.dev) si no tienes una.
2. En la carpeta del proyecto:
   ```bash
   npm install
   npx eas-cli login
   npx eas-cli build --platform android --profile preview
   ```
3. Elige que EAS genere las credenciales de firma por ti (opción por
   defecto) cuando lo pregunte.
4. El build corre en la nube de Expo (gratis, ~10-15 min). Al terminar te
   da un link de descarga directa del `.apk`.
5. Comparte ese link (o el archivo) con cualquier organizador: lo abren en
   su Android, permiten "instalar de fuentes desconocidas" si se lo pide,
   y listo — la app queda instalada con su ícono y nombre "Ojamatching".

Cada vez que quieras generar una nueva versión del APK después de hacer
cambios, repites el paso 2 (`eas-cli build ...`).

> Nota iOS: un `.ipa` instalable directo (sin pasar por la App Store)
> requiere una cuenta de Apple Developer de pago y un proceso distinto
> (TestFlight o distribución ad-hoc). Si lo necesitas, dímelo y lo
> configuramos aparte.

## Probarla rápido durante el desarrollo (sin generar APK)

```bash
npm install
npx expo start
```

Escanea el código QR con la app **Expo Go** (Android/iOS). Útil mientras
seguimos ajustando cosas, pero requiere tener Expo Go instalado.

## Qué incluye esta versión

- **Pantalla de inicio**: lista de torneos guardados en el dispositivo, con
  botón para crear uno nuevo.
- **Crear torneo**: nombre, fecha y formato — Pareo suizo o Eliminación
  directa.
- **Registro**: alta de jugadores (con deck opcional), habilitar/inhabilitar,
  renombrar y editar deck, eliminar (antes de la ronda 1).
- **Pareos (formato suizo)**: misma lógica de tu web (`swiss.js` portado
  casi sin cambios) — pareo por puntaje, evita rivales repetidos,
  downpairing, AUTOWIN para el de menor puntaje. Incluye pareo manual
  (reacomodar mesas a mano) en la ronda que esté abierta.
- **Bracket (formato eliminación directa)**: sorteo aleatorio en ronda 1,
  solo tres resultados por mesa (Gana A / Gana B / Pierden ambos), el
  perdedor queda eliminado, y si ambos pierden el rival que le tocaba
  enfrentar al ganador de esa mesa pasa con AUTOWIN. Detecta al campeón
  automáticamente al resolver la mesa final. También admite pareo manual
  en cualquier ronda antes de capturar resultados.
- **Standings**: tabla de posiciones (distinta según el formato) con botón
  "Copiar nombres" en orden de posición.
- **Ícono y branding**: logo de Ojamatching como ícono de la app (iOS y
  Android) y en la pantalla de splash.

## Pendiente / siguiente iteración

- El ícono adaptativo de Android (`android-icon-foreground.png`) se generó
  automáticamente centrando tu logo con margen de seguridad — si al
  probarlo en el celular se ve muy chico o muy grande dentro de la forma
  (círculo/cuadrado redondeado, depende del launcher), dímelo y ajusto el
  tamaño.
- Compilar también un `.ipa` para iOS (requiere cuenta Apple Developer).

## Estructura del proyecto

```
lib/
  db.js         → apertura de SQLite + esquema de tablas
  repo.js       → funciones CRUD sobre la base local
  swiss.js      → lógica de pareo suizo (portada de la web)
  bracket.js    → lógica de eliminación directa (nueva)
  match.js      → normalización de nombres
  theme.js      → colores y espaciados (mismos que la web)
  useTournament.js → hook para cargar/recargar un torneo

app/
  index.js                  → lista de torneos
  new-tournament.js         → crear torneo (elige formato)
  tournament/[id]/index.js  → pantalla con las 3 pestañas

components/
  RegistroTab.js, PareosTab.js, BracketTab.js,
  StandingsTab.js, EliminationStandingsTab.js,
  ManualPairingEditor.js, ui.js
```
"# ojamatching" 
