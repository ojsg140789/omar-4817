import app from './app.js'

const configuredPort = Number(process.env.PORT)
const port = Number.isInteger(configuredPort) && configuredPort > 0 && configuredPort <= 65_535
  ? configuredPort
  : 3000

app.listen(port, '0.0.0.0', () => {
  console.log(`Backend escuchando en http://localhost:${port}`)
})
