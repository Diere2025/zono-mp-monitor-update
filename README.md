# Zono MP Monitor: actualización 1.7.6

Requiere una instalación existente 1.7.5 o 1.7.6. Este paquete no es una extensión completa para instalar desde cero.

Corrige las referencias de Actividad que se guardaban como Hoy o Ayer cuando no se reconocía el encabezado de fecha. Reconoce encabezados DD/MM/YYYY y omite filas sin fecha comprobable. Mantiene las frecuencias y la configuración de cuentas, claves y reservas existentes. No corrige automáticamente referencias históricas ni modifica movimientos contables.

1. Descargar y extraer el ZIP completo.
2. En chrome://extensions, identificar la carpeta que tiene cargada Zono MP Monitor.
3. Ejecutar ACTUALIZAR.ps1 y proporcionar esa carpeta cuando se solicite. También se puede ejecutar desde PowerShell: & .\ACTUALIZAR.ps1 -ExtensionPath 'C:\ruta\a\la\extension'
4. El actualizador valida los archivos y guarda una copia de los cuatro archivos afectados en una carpeta de respaldo antes de reemplazarlos. No borra configuraciones de Chrome.
5. Pulsar Recargar en chrome://extensions y recargar las pestañas de Mercado Pago. Repetir en cada instalación que monitorea cuentas.

Si Chrome impide ejecutar scripts de PowerShell, no cambiar la política de seguridad: solicitar asistencia para aplicar la actualización. Para volver atrás, copiar los cuatro archivos del respaldo a la carpeta original y recargar la extensión.

Validación: pruebas de fechas sin encabezado, fechas explícitas, captura bancaria, refresco y equivalencia con el paquete interno probado. Esta publicación no actualiza Chrome automáticamente.
