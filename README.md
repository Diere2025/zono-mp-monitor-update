# Zono MP Monitor 1.7.8

Actualizacion para instalaciones existentes de la version 1.7.7. Requiere Node.js.

    node ACTUALIZAR.cjs "C:\ruta\a\la\extension"

Luego recargar la extension en chrome://extensions y las pestanas de Mercado Pago.

Recupera el monitor de Actividades al restaurar ventanas, cerrar su pestana o detectar que el identificador anterior corresponde a otra pantalla. Reintenta la consulta de estado cada diez segundos y distingue otra pestana monitor de una conexion en recuperacion. Si otra pestana de Actividades sigue operativa, conserva esa seleccion; Activar aqui permite moverla. El navegador debe estar abierto, con la sesion iniciada y una pestana de Actividades disponible.

Solo modifica manifest.json, background.js y content.js, conservando su configuracion y los modulos de Movimientos y Reservas. Crea un respaldo antes de escribir; si no reconoce la instalacion, se detiene antes de modificar archivos. No contiene claves ni identificadores de cuentas. No modifica movimientos contables.
