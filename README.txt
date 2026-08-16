SIRRO - Base Funcional de Referencia PWA v0.14

Usuario demo: admin
Contraseña demo: sirro2026

Incluye:
- Catálogo maestro real de 191 establecimientos de Olancho.
- 189 unidades de salud + Hospital San Francisco + Hospital Hermano Pedro.
- Organización por los 23 municipios de Olancho y 6 ECOR.
- Código RUPS, tipo, municipio y ECOR por establecimiento.
- Inicio de sesión demo.
- Unidad de origen automática según usuario.
- Nueva referencia.
- Número de celular de contacto del paciente.
- Destino de US según ruta ECOR configurada; referencias hospitalarias permiten destinos de mayor complejidad.
- El selector muestra nombre, tipo y código RUPS.
- Flujo: ENVIADA → RECIBIDA → EVALUADA → RESPUESTA ENVIADA → CERRADA; desde hospital puede existir REFERENCIA SECUNDARIA hacia mayor complejidad.
- Referencia secundaria a Hospital San Francisco, Hospital Escuela, Hospital San Felipe u Otro, conservando trazabilidad.
- Seguimiento y auditoría local.
- Instalable como PWA cuando se sirve por HTTPS o localhost.

IMPORTANTE:
Esta versión usa almacenamiento local del navegador (localStorage). Aunque contiene el catálogo real de establecimientos, todavía NO debe utilizarse con información real de pacientes. Para producción se debe conectar a una base de datos segura, autenticación institucional, cifrado, copias de respaldo y control de permisos.

Para probar en una computadora:
1. Abra una terminal dentro de esta carpeta.
2. Ejecute: python3 -m http.server 8080
3. Abra: http://localhost:8080

Siguiente fase:
- Crear usuarios reales y perfiles por establecimiento.
- Backend seguro compartido.
- Reportes y panel regional.


v0.3: Añadido Monitoreo Regional organizado ECOR > Municipio > Establecimiento, con totales, pendientes, respondidas, referencias a Tegucigalpa y cerradas.

v0.4 — Usuarios y Permisos
- Múltiples usuarios individuales por ECOR, municipio, unidad de salud y hospital.
- Administrador Regional crea, activa y desactiva usuarios.
- Monitoreo automático según ámbito del usuario.
- Auditoría identifica usuario y fecha/hora de las acciones.
- Usuario de US/hospital puede generar referencias desde su establecimiento.
IMPORTANTE: esta versión sigue siendo un prototipo local. Las credenciales se almacenan en el navegador y NO es adecuada aún para datos reales de pacientes.

v0.5 — Revisión técnica y correcciones
- Perfiles Regional, ECOR y Municipio pasan a SOLO MONITOREO; ya no pueden cambiar estados clínicos.
- Solo el establecimiento/hospital de destino puede gestionar una referencia recibida.
- Generación de código RRO reforzada para evitar reutilización local de secuencias.
- Validación básica del celular de contacto.
- Cambio de contraseña del usuario actual.
- Exportación/importación de respaldo JSON para pruebas entre dispositivos (sin sincronización en tiempo real).
- PWA mejorada con iconos 192/512 y actualización de caché.
- Se mantiene explícita la limitación: almacenamiento local, no apto aún para pacientes reales ni operación multi-dispositivo centralizada.

v0.6 — Identidad visual y control de pruebas
- Logo de la Región Sanitaria Departamental de Olancho integrado en pantalla de ingreso, encabezado e icono PWA.
- Archivo ABRIR_SIRRO.html en la raíz del paquete para facilitar el ingreso después de descomprimir.
- Restablecer datos de prueba: elimina referencias y auditoría, conserva usuarios y catálogo.
- Restablecimiento total local: elimina usuarios, referencias y auditoría y recupera el administrador inicial.
- Ambas funciones de restablecimiento requieren perfil Administrador Regional y frase explícita de confirmación.
- Continúa siendo versión de validación local; el almacenamiento central definitivo sigue pendiente.

v0.8 — Correcciones de usuarios y consecutivo
- Cada referencia nueva obtiene un consecutivo local único, independiente del usuario o establecimiento.
- Al crear usuarios se exige confirmar la contraseña; ambas deben coincidir y tener mínimo 8 caracteres.
- Para usuarios de Unidad de Salud se selecciona primero Municipio y luego la Unidad de Salud filtrada por ese municipio.
- El Administrador Regional puede seleccionar uno o varios usuarios y activarlos, desactivarlos o eliminarlos.
- Si un usuario ya tiene actividad, la eliminación conserva su identidad histórica en auditoría y lo deja sin acceso.


v0.9 — Cierre de validación funcional
- La referencia secundaria cambia realmente el receptor y llega a la bandeja del nuevo hospital.
- La respuesta/contrarreferencia retorna al establecimiento de origen para que éste cierre el caso.
- Se impide saltar estados o cerrar antes de recibir una respuesta.
- "Otro" exige especificar destino o servicio/procedimiento.
- El indicador "A Tegucigalpa / tercer nivel" cuenta referencias secundarias dirigidas a Hospital Escuela o Hospital San Felipe, usando el historial y no un estado obsoleto.
- Caché PWA y documentación actualizadas a v0.9.


v0.10 — Revisión profunda y perfil SOLO LECTURA
- Nuevo perfil SOLO LECTURA (Auditor / Consulta) con acceso regional a Inicio, Seguimiento, Monitoreo y Auditoría, sin crear ni modificar referencias, usuarios o configuración.
- Se añadió Ver detalle para consultar datos de la referencia e historial completo con notas/respuestas.
- Monitoreo regional incluye también los 2 hospitales.
- El indicador A Tegucigalpa / tercer nivel reconoce tanto referencias nuevas directas como referencias secundarias enviadas a Hospital Escuela o Hospital San Felipe.
- El indicador Respondidas conserva el conteo aun después del cierre, usando el historial.
- Cambio de contraseña exige confirmación.
- Restablecimiento total local también reinicia los consecutivos locales de prueba.
- Se reforzaron comprobaciones de permisos para acciones administrativas.


v0.11 — Base Funcional de Referencia
- La referencia secundaria actualiza el servicio/procedimiento vigente que ve el nuevo hospital receptor, conservando el servicio anterior en el historial.
- Rutas US normalizadas: ECOR Catacamas 1, Catacamas 2 y Culmí → Hospital Hermano Pedro; ECOR Juticalpa, Salamá y San Francisco de La Paz → Hospital San Francisco.
- Las referencias nuevas originadas en hospitales ya no pueden enviarse accidentalmente a una US.
- Respuesta/contrarreferencia exige contenido antes de enviarse.
- Referencia secundaria exige justificación clínica breve.
- Borrar datos de prueba reinicia el consecutivo local para iniciar una prueba limpia.

v0.12 — Base de Referencia + Evaluación R/R
- Módulo Evaluación R/R para Administrador Regional y SOLO LECTURA.
- Comparación de Hospital San Francisco y Hospital Hermano Pedro.
- Indicadores de recibidas, evaluadas, respondidas, referencia secundaria, pendientes ≥24/48 h y tiempos de proceso.
- Continúa siendo local: los indicadores corresponden a los datos guardados en el dispositivo.

v0.13 — BASE FUNCIONAL CANDIDATA DE REFERENCIA
- Respaldo JSON identificado correctamente como versión 0.13.
- Evaluación R/R por fecha real de cada evento: recepción, evaluación, respuesta y referencia secundaria.
- El Nivel R/R usa la cohorte de referencias evaluadas en el período y verifica cuáles ya cuentan con respuesta, evitando porcentajes mayores de 100% por cruces de mes.
- Promedios regionales/hospitalarios ponderados por el número real de casos, no por promedio simple entre hospitales.
- Validación estricta de respaldos antes de importar: usuarios/códigos duplicados, campos obligatorios, formatos, estados y establecimientos.
- Limpieza controlada de pruebas: elimina únicamente referencias/respuestas y movimientos asociados; conserva usuarios, establecimientos, perfiles, permisos y configuración.
- La limpieza requiere una clave especial configurada por el Administrador Regional; la clave se almacena localmente como hash SHA-256 en este prototipo.
- Se retiró del menú el restablecimiento total local para reducir el riesgo de borrar accidentalmente usuarios y estructura.
- Esta versión fue sometida a auditoría final antes de congelar la base.


v0.14 — BASE FUNCIONAL AUDITADA DE REFERENCIA
- Auditoría técnica final posterior a v0.13.
- Se evita el bloqueo de referencias enviadas a Hospital Escuela, Hospital San Felipe u Otro: el hospital interno que realizó la referencia puede registrar en SIRRO la respuesta/contrarreferencia recibida del establecimiento externo, con trazabilidad de quién la registró.
- El registro de respuesta externa devuelve el caso al establecimiento de origen para su cierre, sin atribuir la respuesta al hospital interno en los indicadores R/R.
- Validación de respaldos reforzada: Administrador Regional realmente activo, niveles/ámbitos válidos, identificadores seguros, contraseña mínima, campos clínicos obligatorios, fechas válidas, historial cronológico y concordancia entre estado actual y último movimiento.
- Se añade aviso visual permanente de AMBIENTE LOCAL DE PRUEBAS para reducir el riesgo de ingresar datos reales.
- Caché PWA, respaldo y rotulado actualizados a v0.14.
- Esta es la versión local recomendada para congelar como BASE FUNCIONAL AUDITADA y usar como referencia al construir SIRRO Central de Pruebas.

REQUISITOS YA APROBADOS PARA SIRRO CENTRAL
- Acceso multidispositivo con una misma cuenta y trazabilidad de sesiones.
- Cada usuario puede cambiar su contraseña, pero no su nombre de usuario.
- El Administrador no visualiza contraseñas; puede restablecer acceso con contraseña temporal.
- Notificaciones configurables por Hospital, Municipal y ECOR, mediante app, correo electrónico o ambos.
- Correo institucional como evidencia complementaria, sin datos clínicos sensibles, con registro de envío en auditoría.
- Alertas escalonadas primero al nivel inmediato superior y, si persisten, hasta el nivel Regional como última instancia.
- Separación estricta entre ambientes PRUEBAS y PRODUCCIÓN.
- La generación del código RRO, autenticación, permisos, auditoría, notificaciones y claves críticas deben residir en el servidor.

NOTA DE SEGURIDAD
Esta v0.13 sigue siendo una aplicación local de validación y debe utilizar exclusivamente datos ficticios. La seguridad real de credenciales, clave de reinicio, códigos únicos multiestablecimiento, correo, notificaciones y auditoría central corresponde a SIRRO Central.
