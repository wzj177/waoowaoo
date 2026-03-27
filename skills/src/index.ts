import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { listProjects } from './tools/list-projects.js'
import { getProjectWorkflowStatus } from './tools/get-project-workflow-status.js'
import { createProject } from './tools/create-project.js'
import { closeDb } from './db.js'

function getUserId(): string {
  const userId = process.env.WAOOWAOO_USER_ID?.trim()
  if (!userId) {
    throw new Error('WAOOWAOO_USER_ID environment variable is required')
  }
  return userId
}

const TOOLS: Tool[] = [
  {
    name: 'list_projects',
    description: '列出当前用户的所有 waoowaoo 短剧项目，支持分页。',
    inputSchema: {
      type: 'object',
      properties: {
        page: {
          type: 'number',
          description: '页码，从 1 开始（默认 1）',
          minimum: 1,
        },
        pageSize: {
          type: 'number',
          description: '每页条数（默认 10，最大 50）',
          minimum: 1,
          maximum: 50,
        },
      },
    },
  },
  {
    name: 'get_project_workflow_status',
    description:
      '查询指定项目在 11 个制作阶段的完成情况，返回每阶段是否完成、整体进度百分比以及下一步操作建议。',
    inputSchema: {
      type: 'object',
      required: ['projectId'],
      properties: {
        projectId: {
          type: 'string',
          description: '项目 ID（可通过 list_projects 获取）',
        },
      },
    },
  },
  {
    name: 'create_project',
    description: '创建一个新的短剧项目。',
    inputSchema: {
      type: 'object',
      required: ['name'],
      properties: {
        name: {
          type: 'string',
          description: '项目名称（最多 100 个字符）',
          minLength: 1,
          maxLength: 100,
        },
        description: {
          type: 'string',
          description: '项目描述（可选，最多 500 个字符）',
          maxLength: 500,
        },
      },
    },
  },
]

const ListProjectsInputSchema = z.object({
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().min(1).max(50).optional(),
})

const GetProjectWorkflowStatusInputSchema = z.object({
  projectId: z.string().min(1),
})

const CreateProjectInputSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
})

async function main(): Promise<void> {
  const server = new Server(
    {
      name: 'waoowaoo-skills',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    },
  )

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS,
  }))

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params
    const userId = getUserId()

    try {
      if (name === 'list_projects') {
        const input = ListProjectsInputSchema.parse(args ?? {})
        const result = await listProjects(userId, input)
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        }
      }

      if (name === 'get_project_workflow_status') {
        const input = GetProjectWorkflowStatusInputSchema.parse(args ?? {})
        const result = await getProjectWorkflowStatus(userId, input)
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        }
      }

      if (name === 'create_project') {
        const input = CreateProjectInputSchema.parse(args ?? {})
        const result = await createProject(userId, input)
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        }
      }

      return {
        content: [{ type: 'text', text: `Unknown tool: ${name}` }],
        isError: true,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return {
        content: [{ type: 'text', text: `Tool error: ${message}` }],
        isError: true,
      }
    }
  })

  const transport = new StdioServerTransport()
  await server.connect(transport)

  process.on('SIGINT', async () => {
    await closeDb()
    await server.close()
    process.exit(0)
  })

  process.on('SIGTERM', async () => {
    await closeDb()
    await server.close()
    process.exit(0)
  })
}

main().catch((error) => {
  process.stderr.write(`Fatal error: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
})
