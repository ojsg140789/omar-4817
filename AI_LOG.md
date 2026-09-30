# Registro de uso de IA

Este registro resume el uso de ChatGPT y Codex durante el desarrollo. No sustituye la revisión del código, las verificaciones técnicas ni las decisiones humanas de alcance.

| Fase | Herramienta | Uso | Parte apoyada | Validación humana |
|---|---|---|---|---|
| Preparación | ChatGPT y Codex | Análisis, planificación y generación inicial | Frontend React + TypeScript con Vite y backend Express + TypeScript | Ejecución manual del frontend, comprobación de `/health`, build y typecheck |
| Autenticación | ChatGPT y Codex | Aprendizaje guiado, propuestas de implementación y revisión de diff | Registro local, PBKDF2, login, logout y restauración de sesión | Validación de formularios, sesión, LocalStorage y revisión previa a commit |
| Dashboard | ChatGPT y Codex | Diseño de estructura, generación y adaptación de código | Saldo, datos deterministas, gráficas y listas textuales | Validación manual de estadísticas, responsive inicial y flujos de sesión |
| SnailPay | ChatGPT y Codex | Discusión de contrato, implementación y debugging | Simulador, validación de request y respuestas reproducibles | Escenarios approved, rejected, invalid request y system error reproducidos |
| Integración de pagos | ChatGPT y Codex | Adaptación de frontend, persistencia y revisión de flujo | Formulario de recarga, acreditación local y `lastPayment` | Recargas aprobadas y rechazadas verificadas manualmente; revisión de diff |
| Errores y timeout | ChatGPT y Codex | Propuestas de manejo de estados y pruebas | Clasificación de errores, AbortController, timeout y doble envío | Escenarios de red, respuesta inválida, timeout y doble envío verificados manualmente |
| Idempotencia | ChatGPT y Codex | Análisis de diseño, propuestas de implementación, pruebas y revisión de diff | Separación entre submission lock e Idempotency-Key, requests concurrentes, replay, conflicto y protección local contra doble acreditación | Implementación revisada, 47 pruebas ejecutadas y decisiones validadas por el desarrollador; commit y push no se delegaron automáticamente |
| Pruebas | ChatGPT y Codex | Propuesta y creación de pruebas críticas | Vitest para SnailPay, pagos, storage y estadísticas | 47 pruebas ejecutadas, además de lint, typecheck y build |
| Responsive y accesibilidad | ChatGPT y Codex | Revisión de interfaz y adaptación de estilos | Layout adaptable, foco, autocompletado y semántica existente | Pruebas manuales en 360 px, 768 px, escritorio, zoom y teclado |
| Documentación | ChatGPT y Codex | Síntesis factual y redacción | README y este registro | Revisión de comandos, estructura, fixtures y límites; autorización explícita y commit de documentación realizados |

Las decisiones de alcance, la validación manual de interfaz y escenarios, la revisión de diffs y la autorización de commits fueron responsabilidad humana.
