# Zono MP Monitor 1.7.7

Actualizador de reservas para instalaciones 1.7.5 o 1.7.6. Requiere Node.js.

Ejecutar en una terminal:

    node ACTUALIZAR.cjs "C:\ruta\a\la\extension"

Luego recargar Zono MP Monitor en chrome://extensions y recargar las pestañas de Mercado Pago.

Reintenta la conexión al monitor, recupera una pestaña abierta si perdió la anterior y recarga lectores que no responden (como máximo una vez cada cinco minutos). Guardar configuración ya no produce una pausa permanente. La pausa manual sigue disponible. Debe permanecer abierta una pestaña de la reserva con la sesión iniciada.

Sólo actualiza manifest.json, reserve-monitor.js y reserve-reader.js; conserva el resto de la configuración y crea un respaldo. No contiene claves. No cambia movimientos contables.
