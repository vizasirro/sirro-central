# SIRRO — Cambios aprobados 21-08-2026

## Regla de oro
Toda implementación debe agregar o mejorar sin eliminar, alterar ni dañar funciones, datos, permisos, rutas o flujos que ya funcionan. Verificar regresión antes de publicar.

## Búsqueda universal
- Todos los usuarios deben disponer en Inicio de una búsqueda grande y visible por número de referencia SIRRO.
- La búsqueda respeta alcance y permisos: conocer el código no amplía acceso.
- En Unidades de Salud se conserva **Nueva referencia**; coexistirá con **Buscar referencia SIRRO**.

## Flujo hospitalario por motivo
- Consulta Externa: atendido por especialista / cita futura / hospitalizado.
- Emergencia-Urgencia: atendido y egresado / hospitalizado.
- Hospitalización: hospitalizado / cita futura.
- Examen o procedimiento: realizado / cita futura.
- Atención materna: hospitalizada o conducta/seguimiento correspondiente.
- Toda cita futura requiere fecha y hora.
- Usar el término **Hospitalizado**, no “Ingresado”.
- Si queda hospitalizado, la referencia permanece activa y otro médico autorizado del mismo hospital puede continuarla: continúa hospitalizado / alta y contrarreferencia / referencia secundaria.
- Mientras permanezca hospitalizado no se contabiliza atraso de contrarreferencia.

## Tipos de usuario Hospital
- Médico especialista.
- Médico general.
- Licenciada(o) en Enfermería.
- Atención al Paciente / Citas.

### Médico especialista
Debe registrar especialidad obligatoria: Pediatría, Ginecología y Obstetricia, Medicina Interna, Cirugía General, Ortopedia y Traumatología u Otra especialidad. Si elige Otra, debe especificarla.

### Enfermería
Primer punto posible de recepción: busca número SIRRO, confirma llegada y el sistema registra automáticamente usuario, fecha y hora. Puede apoyar seguimiento operativo.

No puede por decisión propia: modificar diagnóstico, indicar hospitalización, emitir contrarreferencia médica, dar alta médica, realizar referencia secundaria, registrar rechazo clínico, indicar cita futura ni registrar conducta/decisión médica.

### Atención al Paciente / Citas
Gestiona especialmente referencias a Consulta Externa. Puede buscar la referencia, asignar cita y registrar especialidad/especialista cuando corresponda, fecha y hora. No toma decisiones clínicas.

## Tiempos administrativos y alertas
Valores iniciales aprobados, configurables únicamente por el Administrador Regional:
- Referencia urgente sin recepción: amarilla 1 hora / roja 2 horas.
- Referencia no urgente sin recepción: amarilla 12 horas / roja 24 horas.
- Paciente con llegada registrada pendiente de decisión médica: amarilla 2 horas / roja 4 horas.
- Consulta Externa pendiente de cita: amarilla 24 horas / roja 48 horas.
- Examen/procedimiento pendiente de realizar o programar: amarilla 24 horas / roja 48 horas.
- Alta hospitalaria pendiente de contrarreferencia: amarilla 12 horas / roja 24 horas.
- Referencia externa pendiente de cierre administrativo: 30 días.

El Administrador Regional podrá aumentar o disminuir estos tiempos según acuerdos con el personal hospitalario. Todo cambio debe dejar auditoría con valor anterior, valor nuevo, usuario, fecha y hora. Una cita futura no genera atraso antes de la fecha programada. Mientras el paciente permanezca hospitalizado no corre el tiempo de atraso de contrarreferencia.

## Seguimiento puerperal — regla fija no configurable
- Al alta: registrar que la paciente fue notificada para controles puerperales.
- Conserva documento de alta con el mismo código de referencia SIRRO.
- Primer contacto: 48–72 horas.
- Segundo contacto: 3–7 días.
- Tercer contacto: 40 días.
- Estos tres tiempos son **no negociables y no editables** por el Administrador Regional.
- Los tres contactos usan la referencia original; no crear referencias nuevas.
- Trazabilidad: referencia materna → atención/hospitalización → alta → notificación → primer contacto → segundo contacto → tercer contacto.

## Reportes aprobados
De la lista propuesta se aprobaron los números: 1, 2, 4, 5, 6, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 21, 23, 24, 26, 27, 28, 29, 30, 31, 32, 33, 34, 36, 37, 38, 39 y 40.

Incluyen referencias emitidas/recibidas, servicio-especialidad, origen, municipio, hospital, estado, pendientes, atrasos, alertas, tiempos de recepción/decisión/respuesta, cumplimiento y desempeño, tiempo para cita, cumplimiento de citas, hospitalizaciones y desenlaces, duración de hospitalización, referencias secundarias y fuera de Olancho, exámenes/procedimientos, atención materna, resultados de Emergencia, contrarreferencias, cierres, actividad de usuarios, actividad por tipo hospitalario, auditoría, usuarios y tablero ejecutivo regional.

Los reportes son de nivel Regional. El Administrador Regional tiene acceso completo. El perfil Auditor/Consulta solo podrá ver Reportes si el Administrador Regional activa el control **Reportes habilitados**; al estar habilitado se respetará su alcance autorizado (US, municipio, ECOR o departamento). Este perfil será solo lectura. Habilitar o deshabilitar reportes debe quedar auditado.

Filtros según corresponda: período, hospital, ECOR, municipio, establecimiento, especialidad, motivo y estado. Considerar exportación a Excel/PDF.

## Pendiente separado
La activación/configuración efectiva del correo institucional SIRRO.net permanece pendiente y no forma parte de esta implementación.
