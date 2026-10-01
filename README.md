# Sistema de caracoles

## Descripción

Aplicación Full-Stack de demostración con registro e inicio de sesión locales, un dashboard de carreras simuladas y una recarga de saldo contra un simulador de pagos llamado SnailPay.

La aplicación muestra cantidades con el símbolo `$`, sin asignar una moneda. Los datos de carreras y pagos son simulados.

## Stack y requisitos

Frontend:

- React 19, TypeScript, Vite 8, React Router, Recharts y Vitest.

Backend:

- Node.js 24.x, Express 5, TypeScript y Vitest.

El tooling de Vite requiere Node.js `^20.19.0 || >=22.12.0`. El desarrollo se validó con Node.js 24.21.0.

## Instalación

El frontend y el backend son proyectos npm independientes. Para una instalación reproducible desde los lockfiles:

```bash
cd backend
npm ci
```

```bash
cd frontend
npm ci
```

`npm install` puede usarse durante trabajo interactivo cuando sea necesario actualizar dependencias y su lockfile. Para clonar y ejecutar la versión existente, se recomienda `npm ci`.

## Ejecución local

Inicia primero el backend para que el proxy de Vite pueda atender las llamadas a `/api` y `/health`.

### Backend

En una primera terminal:

```bash
cd backend
npm run dev
```

El backend escucha en `http://127.0.0.1:3000`. La comprobación de salud está disponible en `GET /health`.

### Frontend

En una segunda terminal:

```bash
cd frontend
npm run dev
```

Vite sirve el frontend localmente en `http://localhost:5173` en la ejecución habitual. Durante desarrollo reenvía ambas rutas al backend local:

```text
POST /api/payments -> proxy de Vite -> Express en :3000
GET /health -> proxy de Vite -> Express en :3000
```

En producción, `VITE_API_URL` define la base pública del backend durante el build. El frontend construye a partir de ella `POST /api/payments` y `GET /health`; el proxy solo existe durante desarrollo.

## Pruebas y verificaciones

Backend:

```bash
cd backend
npm run test
npm run typecheck
npm run build
```

Frontend:

```bash
cd frontend
npm run test
npm run lint
npm run build
```

La suite contiene 50 pruebas en seis archivos: 18 en dos archivos de backend y 32 en cuatro archivos de frontend. Cubre escenarios de SnailPay, replay idempotente y concurrencia, conflicto HTTP 409, protección contra doble acreditación, CORS, compatibilidad de storage, clasificación de pagos, timeout, resolución de endpoints de pagos y health, y estadísticas deterministas del dashboard.

No existe una suite E2E completa de navegador ni se declara un porcentaje formal de cobertura.

## API

`GET /health` se usa para health checks y warm-up; no ejecuta lógica de negocio y responde:

```json
{ "status": "ok" }
```

`POST /api/payments` recibe `cardNumber`, `expiry`, `cvv`, `fullName`, `amount`, `payerId` y `payerEmail`. Sus resultados válidos son HTTP 200 para approved o rejected, HTTP 400 para una solicitud inválida, HTTP 409 para un conflicto de idempotencia y HTTP 500 para el error interno simulado.

## Escenarios de SnailPay

Todos los datos de tarjeta son ficticios. Los campos no indicados deben ser estructuralmente válidos.

| Escenario | Datos | Respuesta |
|---|---|---|
| Approved | Tarjeta `1234123412341234`, expiración `12/26`, CVV `543`, titular no vacío y monto mayor que `0` | HTTP 200, `status: approved` |
| Rejected | Tarjeta `4000000000000002` | HTTP 200, `status: rejected` |
| System error | Tarjeta `5000000000000005` | HTTP 500, `status: error` |
| Invalid request | Por ejemplo, monto `0` | HTTP 400, `status: error` |
| Slow / timeout | Fixture approved con monto `999.99` | El backend demora cerca de 10 s; el cliente vence cerca de 5 s y no acredita saldo |

Una tarjeta estructuralmente válida distinta de las fixtures especiales se rechaza. El escenario slow usa la fixture approved y conserva el resto de sus datos.

## Routing

`BrowserRouter` resuelve las rutas `/login`, `/register` y `/dashboard`. `ProtectedRoute` es una guarda declarativa de navegación cliente: no sustituye autorización backend y no monta Dashboard cuando falta una sesión válida.

Sin sesión, `/login` muestra Login, `/register` muestra Registro y `/dashboard` o una ruta desconocida redirigen a `/login`. Con sesión válida, `/login`, `/register` y rutas desconocidas redirigen a `/dashboard`. Las redirecciones automáticas usan `replace` para no conservar vistas privadas en el historial.

Firebase Hosting reescribe los deep links al `index.html` de la SPA. Como el estado vive en LocalStorage y puede ser manipulado por el usuario, esta protección no constituye seguridad de servidor.

## Arquitectura y decisiones técnicas

### Organización por funcionalidad

El código se organiza por la funcionalidad que resuelve:

- `frontend/src/auth`: registro, login, logout, credenciales y protección de ruta.
- `frontend/src/dashboard`: datos deterministas y visualización.
- `frontend/src/payments`: formulario de recarga, cliente de SnailPay y actualización del wallet.
- `frontend/src/persistence`: lectura y escritura del estado local.
- `backend/src/payments`: simulador SnailPay e idempotencia en memoria.

No se añadieron controllers, services o repositories artificiales: el alcance actual no necesita esas capas.

El frontend tomó como base el scaffold estándar React + TypeScript de Vite. No se utilizó una plantilla visual externa ni una librería de componentes. Recharts se usa para las visualizaciones; la estructura funcional, formularios, dashboard, integración de pagos, estilos y accesibilidad se adaptaron o construyeron para esta solución.

### Persistencia y autenticación local

El estado se guarda bajo la clave de LocalStorage `app:v1`. Conceptualmente contiene `user`, `session`, `wallet.balanceCents`, `wallet.lastPayment` y `wallet.appliedIdempotencyKeys`.

El registro crea una credencial derivada con PBKDF2 y SHA-256, sal aleatoria y 600,000 iteraciones. Se persisten el algoritmo, las iteraciones, la sal y el `derivedKey`; la contraseña original y su confirmación no se guardan. Es una derivación no reversible, no cifrado.

El alcance local mantiene una única cuenta registrada. `registerUser` evita sobrescribir una cuenta existente; no existe soporte multiusuario real. Logout conserva `user` y `wallet`, y elimina `session`. Una implementación real movería usuarios, sesiones y persistencia al backend.

### Timeouts, warm-up y pagos

El pago usa `AbortController` y vence la espera cerca de 5 segundos. La fixture slow de SnailPay demora cerca de 10 segundos para el monto `999.99`. Abortar el fetch desde el frontend no garantiza detener el trabajo del servidor, por lo que la key de idempotencia se conserva para reintentar la misma operación sin editar campos.

Al montar Dashboard se ejecuta el flujo `useEffect -> warmUpBackend() -> GET /health`. El Dashboard renderiza inmediatamente y no espera esta llamada best effort, que busca adelantar un posible cold start del backend. Su timeout cliente es de 3 segundos e independiente del timeout de pago. Si falla, no cambia AppState, sesión, wallet ni UI; no hay retries, intervalos ni pings periódicos. En desarrollo, React StrictMode puede provocar dos GET /health; el endpoint es idempotente y no tiene efectos de negocio.

`submissionLock` y `isSubmitting` impiden doble clic o Enter simultáneos desde el mismo formulario durante una recarga en curso.

La `Idempotency-Key` identifica una operación lógica de recarga. Para la misma key y el mismo payload normalizado, el backend reutiliza la operación: los requests concurrentes comparten la Promise pendiente y los reintentos reciben el resultado ya disponible. Reutilizar la misma key con otro payload devuelve HTTP 409. El fingerprint usa SHA-256.

En LocalStorage, `appliedIdempotencyKeys` evita sumar dos veces el saldo si se recibe de nuevo una respuesta approved de la misma operación. El backend no modifica directamente el balance: el frontend acredita solo después de una respuesta approved válida. Las respuestas rejected y error, incluido el system error simulado, no incrementan el saldo; el timeout tampoco acredita.

### Dashboard simulado

El dashboard contiene seis caracoles y seis carreras simuladas deterministas: cuatro ganadas y dos perdidas. Las victorias por caracol se derivan del mismo dataset usado por los gráficos. Estos datos existen únicamente para la simulación visual; no hay lógica de apuestas ni ejecución de carreras.

## Configuración, CORS y CI/CD

Variables de configuración:

- Frontend y variable de GitHub Actions: `VITE_API_URL`.
- Backend: `PORT`, `NODE_ENV` y `FRONTEND_ORIGIN`.
- Variables de GitHub Actions: `DEPLOY_ENABLED`, `VITE_API_URL` y `FIREBASE_PROJECT_ID`.
- Secrets de GitHub Actions: `RENDER_DEPLOY_HOOK_URL` y `FIREBASE_SERVICE_ACCOUNT`.

En desarrollo, CORS permite los orígenes locales configurados `localhost:5173` y `127.0.0.1:5173`. En producción solo acepta un `FRONTEND_ORIGIN` válido; no usa wildcard ni credentials. La configuración permite los métodos GET, POST y OPTIONS, junto con los headers `Content-Type` e `Idempotency-Key`.

GitHub Actions ejecuta el siguiente flujo al hacer push a `master`:

```text
backend-ci + frontend-ci
          -> si ambos pasan y DEPLOY_ENABLED=true
          -> deploy-backend a Render + deploy-frontend a Firebase Hosting
```

Los jobs usan Node 24 y `npm ci`; validan tests, typecheck del backend, lint del frontend y builds. La concurrencia conserva solo la ejecución de producción más reciente. El último flujo fue validado exitosamente.

## Deployment

- Repositorio: https://github.com/ojsg140789/omar-4817
- Frontend: https://omar-4817.web.app
- Backend: https://omar-4817-api.onrender.com
- Health: https://omar-4817-api.onrender.com/health

El frontend se publica en Firebase Hosting, el backend en Render y la automatización se realiza con GitHub Actions. Render usa el plan gratuito y puede suspenderse por inactividad; la primera petición posterior puede tardar más por cold start. El warm-up `/health` desde Dashboard busca reducir ese impacto, pero no garantiza disponibilidad inmediata ni mantiene el servicio activo permanentemente.

## Seguridad y datos ficticios

- Los datos de tarjeta son ficticios.
- `card_number` y CVV se devuelven y persisten únicamente por el alcance de la simulación.
- Una aplicación real no debería persistir ni devolver CVV; usaría tokenización mediante un proveedor de pagos.
- LocalStorage no proporciona seguridad equivalente a un backend.
- No existe un proveedor financiero real.
- La autenticación local, la credencial PBKDF2 y ProtectedRoute no representan una solución de identidad ni autorización productiva.

## Responsive y accesibilidad

La interfaz se construyó con un enfoque mobile-first y se validó manualmente a 360 px, 768 px y en escritorio. Incluye etiquetas asociadas a campos, foco visible, navegación por teclado, mensajes con `role="alert"` o `role="status"` y alternativas textuales visibles para los gráficos.

No se afirma una certificación WCAG ni una auditoría formal.

## Uso de IA y validación humana

ChatGPT y Codex se utilizaron para análisis, planificación, aprendizaje guiado, propuestas de arquitectura, implementación guiada, debugging, pruebas, routing, idempotencia, CI/CD, deployment, revisión de diffs y documentación.

El desarrollador tomó las decisiones de alcance, ejecutó comandos, configuró y revisó servicios externos, validó resultados y pruebas manuales, revisó diffs y autorizó cada commit. El detalle factual está en [AI_LOG.md](AI_LOG.md).

## Limitaciones conocidas

- La solución mantiene una cuenta y persistencia local; no se implementó una base de datos ni identidad backend.
- SnailPay es un simulador, no un proveedor de pagos real.
- La idempotencia del backend se conserva en memoria para una única instancia. Se pierde al reiniciar el proceso y no se comparte entre múltiples instancias; una solución durable requeriría almacenamiento compartido.
- La key pendiente del formulario no se persiste al recargar la página.
- No existe una suite E2E completa de navegador.
- Render puede experimentar cold start en el plan gratuito; el warm-up es best effort.

## Estructura del proyecto

```text
frontend/
  src/
    auth/
    dashboard/
    payments/
    persistence/

backend/
  src/
    payments/
```

## Proceso de desarrollo

El trabajo se organizó en incrementos pequeños por capacidad. Cada incremento tuvo explicación previa, verificación técnica, validación manual y revisión del diff antes de proponer un commit. El historial Git conserva los commits separados por esas capacidades.
