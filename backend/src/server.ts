import app from './app.js'

const configuredPort = Number(process.env.PORT)
// Render entrega PORT mediante entorno; localmente se conserva 3000 como valor predecible.
const port = Number.isInteger(configuredPort) && configuredPort > 0 && configuredPort <= 65_535
  ? configuredPort
  : 3000

// 0.0.0.0 permite que el proveedor alcance el proceso dentro de su contenedor.
app.listen(port, '0.0.0.0', () => {
  console.log(`Backend escuchando en http://localhost:${port}`)
})
