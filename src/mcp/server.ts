import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { registerTools } from './tools.js'
import { registerResources } from './resources.js'

export async function startMcpServer() {
  const server = new McpServer({
    name: 'dream',
    version: '1.0.0',
  })

  registerTools(server)
  registerResources(server)

  const transport = new StdioServerTransport()
  await server.connect(transport)

  // Keep alive
  process.on('SIGINT', () => process.exit(0))
  process.on('SIGTERM', () => process.exit(0))
}
