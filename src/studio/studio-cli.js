import { createStudioServer, listenStudio } from './application/server.js'

function parseArguments(argv) {
  let port = 4173
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--help' || argument === '-h') return { help: true }
    if (argument === '--port') {
      port = Number(argv[++index])
    } else if (argument.startsWith('--port=')) {
      port = Number(argument.slice('--port='.length))
    } else {
      throw new Error(`Unknown option: ${argument}`)
    }
  }
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Port must be an integer from 0 to 65535')
  return { port }
}

try {
  const options = parseArguments(process.argv.slice(2))
  if (options.help) {
    console.log('BerryMark Studio\n\nUsage: npm run studio -- [--port 4173]\n\nOpen the printed loopback address in Chrome or Chromium. Stop with Ctrl+C.')
  } else {
    const server = createStudioServer()
    let closing = false
    const close = () => {
      if (closing) return
      closing = true
      console.log('\nStopping BerryMark Studio…')
      server.close(() => process.exit(0))
    }
    process.on('SIGINT', close)
    process.on('SIGTERM', close)
    try {
      const address = await listenStudio(server, { host: '127.0.0.1', port: options.port })
      const url = `http://127.0.0.1:${address.port}`
      console.log(`BerryMark Studio is ready at ${url}`)
      console.log('Open this exact address in Chrome on macOS or Chromium on Arch Linux.')
      console.log('Manuscripts remain on your computer. Press Ctrl+C to stop Studio.')
    } catch (error) {
      if (error?.code === 'EADDRINUSE') {
        console.error(`Port ${options.port} is already in use. Stop the other process or run: npm run studio -- --port ${options.port + 1}`)
      } else if (error?.code === 'EACCES') {
        console.error(`Studio cannot use port ${options.port}. Choose a port above 1024, for example: npm run studio -- --port 4174`)
      } else {
        console.error(`Studio could not start: ${error?.message ?? 'unknown startup error'}`)
      }
      process.exitCode = 1
    }
  }
} catch (error) {
  console.error(`${error.message}\nUsage: npm run studio -- [--port 4173]`)
  process.exitCode = 1
}
