# Sistema de caracoles

## Descripción

Aplicación Full-Stack de demostración con registro e inicio de sesión locales, un dashboard de carreras simuladas y una recarga de saldo contra un simulador de pagos llamado SnailPay.

La aplicación muestra cantidades con el símbolo `$`, sin asignar una moneda. Los datos de carreras y pagos son simulados.

## Stack y requisitos

Frontend:

- React 19, TypeScript, Vite 8, Recharts y Vitest.

Backend:

- Express 5, TypeScript y Vitest.

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

Inicia primero el backend para que el proxy de Vite pueda atender las llamadas a `/api`.

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

Vite sirve el frontend localmente en `http://localhost:5173` en la ejecución habitual.

Durante desarrollo, el flujo de pagos es:

```text
fetch('/api/payments') -> proxy de Vite -> Express en :3000
```

El proxy está pensado para desarrollo. Un despliegue real debe configurar explícitamente el destino del API.

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

La suite contiene 47 pruebas en seis archivos: 18 en dos archivos de backend y 29 en cuatro archivos de frontend. Cubre escenarios de SnailPay, replay idempotente y concurrencia, conflicto HTTP 409, protección contra doble acreditación, CORS, compatibilidad de storage, clasificación de pagos, timeout y estadísticas deterministas del dashboard.

## Escenarios de SnailPay

Todos los datos de tarjeta son ficticios. Los campos no indicados deben ser estructuralmente válidos.

| Escenario | Datos | Respuesta |
|---|---|---|
| Approved | Tarjeta `1234123412341234`, expiración `12/26`, CVV `543`, titular no vacío y monto mayor que `0` | HTTP 200, `status: approved` |
| Rejected | Tarjeta `4000000000000002` | HTTP 200, `status: rejected` |
| System error | Tarjeta `5000000000000005` | HTTP 500, `status: error` |
| Invalid request | Por ejemplo, monto `0` | HTTP 400, `status: error` |
| Slow / timeout | Fixture approved con monto `999.99` | Backend demora cerca de 10 s; el cliente vence cerca de 5 s y no acredita saldo |

Una tarjeta estructuralmente válida distinta de las fixtures especiales se rechaza. El escenario slow usa la fixture approved y conserva el resto de sus datos.

## Arquitectura y decisiones técnicas

### Organización por funcionalidad

El código se organiza por la funcionalidad que resuelve:

- `frontend/src/auth`: registro, login, logout y credenciales.
- `frontend/src/dashboard`: datos deterministas y visualización.
- `frontend/src/payments`: formulario de recarga y cliente de SnailPay.
- `frontend/src/persistence`: lectura y escritura del estado local.
- `backend/src/payments`: simulador SnailPay.

No se añadieron controllers, services o repositories artificiales: el alcance actual no necesita esas capas.

El frontend tomó como base el scaffold estándar React + TypeScript de Vite. No se utilizó una plantilla visual externa ni una librería de componentes. Recharts se usa para las visualizaciones; la estructura funcional, formularios, dashboard, integración de pagos, estilos y accesibilidad se adaptaron o construyeron para esta solución.

### Persistencia y autenticación local

El estado se guarda bajo la clave de LocalStorage `app:v1`. Conceptualmente contiene `user`, `session`, `wallet.balanceCents`, `wallet.lastPayment` y `wallet.appliedIdempotencyKeys`.

El registro crea una credencial derivada con PBKDF2, HMAC-SHA-256, salt aleatoria y 600,000 iteraciones. Se persisten el algoritmo, las iteraciones, el salt y el `derivedKey`; la contraseña original y su confirmación no se guardan en texto plano.

La autenticación es una simulación local y no sustituye un sistema de identidad backend.

### Proxy de desarrollo

El formulario usa rutas relativas de API. Vite redirige `/api` al backend local en el puerto 3000, lo que evita configurar CORS para el entorno de desarrollo.

### Timeout, doble envío e idempotencia

El cliente usa `AbortController` y vence la espera cerca de 5 segundos. SnailPay dispone de una fixture slow que demora cerca de 10 segundos. Abortar la espera del cliente no garantiza detener el trabajo del servidor.

`submissionLock` y `isSubmitting` impiden doble clic o Enter simultáneos desde el mismo formulario durante una recarga en curso.

La `Idempotency-Key` identifica una operación lógica de recarga. Para la misma key y el mismo payload, el backend reutiliza la operación: los requests concurrentes comparten la ejecución pendiente y los reintentos reciben el resultado ya disponible. Reutilizar la misma key con otro payload devuelve HTTP 409.

Ante timeout, el formulario conserva la key para el reintento sin editar campos. Así, el backend no crea una segunda operación y puede reutilizar el estado pending o el resultado de la primera. En LocalStorage, `appliedIdempotencyKeys` evita sumar dos veces el saldo si se recibe de nuevo una respuesta approved de la misma operación.

El backend no modifica directamente el balance: el frontend acredita solo después de una respuesta approved válida. Las respuestas rejected y error, incluido el system error simulado, no incrementan el saldo; el timeout tampoco acredita. La idempotencia reproduce el resultado de la operación y no convierte un error en approved.

### Dashboard simulado

El dashboard contiene seis caracoles y seis carreras simuladas deterministas: cuatro ganadas y dos perdidas. Las victorias por caracol se derivan del mismo dataset usado por los gráficos. Estos datos existen únicamente para la simulación visual; no hay lógica de apuestas ni ejecución de carreras.

## Seguridad y datos ficticios

- Los datos de tarjeta son ficticios.
- `card_number` y CVV se devuelven y persisten únicamente por el alcance de la simulación.
- Una aplicación real no debería persistir ni devolver CVV.
- LocalStorage no proporciona seguridad equivalente a un backend.
- No existe un proveedor financiero real.
- La autenticación local y la credencial PBKDF2 no representan una solución de identidad productiva.

## Responsive y accesibilidad

La interfaz se construyó con un enfoque mobile-first y se validó manualmente a 360 px, 768 px y en escritorio. Incluye etiquetas asociadas a campos, foco visible, navegación por teclado, mensajes con `role="alert"` o `role="status"` y alternativas textuales visibles para los gráficos.

No se afirma una certificación WCAG ni una auditoría formal.

## Uso de IA y validación humana

ChatGPT y Codex se utilizaron para análisis, planificación, aprendizaje guiado, discusión de arquitectura, generación y adaptación de código, debugging, propuestas y creación de pruebas, revisión de diffs y documentación.

La participación de IA fue revisada mediante un proceso humano: cada incremento se explicó antes de implementarse, se tomaron decisiones de alcance, se ejecutaron tests, lint y build, se validaron flujos manualmente, se revisaron diffs y cada commit requirió autorización explícita. El detalle factual está en [AI_LOG.md](AI_LOG.md).

## Limitaciones conocidas

- La solución mantiene persistencia local; no se implementó una base de datos.
- La autenticación es local y no existe identidad backend.
- SnailPay es un simulador, no un proveedor de pagos real.
- La idempotencia del backend se conserva en memoria para una única instancia. Se pierde al reiniciar el proceso y no se comparte entre múltiples instancias; en producción requeriría almacenamiento durable y compartido, además de consulta o reconciliación de estado.
- La key pendiente del formulario no se persiste al recargar la página.
- No existe una suite E2E completa de navegador.
- No hay un despliegue activo ni URLs públicas configuradas; el workflow de GitHub Actions existe, pero los jobs de deployment siguen condicionados a `DEPLOY_ENABLED`.

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
