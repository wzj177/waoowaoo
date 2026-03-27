import { query } from '../db.js'
import type { ToolResult } from '../types.js'

export interface ListProjectsInput {
  page?: number
  pageSize?: number
}

interface ProjectRow {
  id: string
  name: string
  description: string | null
  mode: string
  createdAt: Date
  updatedAt: Date
}

interface CountRow {
  total: number
}

export async function listProjects(
  userId: string,
  input: ListProjectsInput,
): Promise<ToolResult> {
  const page = Math.max(1, input.page ?? 1)
  const pageSize = Math.min(50, Math.max(1, input.pageSize ?? 10))
  const offset = (page - 1) * pageSize

  const [countRows, projectRows] = await Promise.all([
    query<CountRow>(
      'SELECT COUNT(*) AS total FROM projects WHERE userId = ?',
      [userId],
    ),
    query<ProjectRow>(
      'SELECT id, name, description, mode, createdAt, updatedAt FROM projects WHERE userId = ? ORDER BY updatedAt DESC LIMIT ? OFFSET ?',
      [userId, pageSize, offset],
    ),
  ])

  const total = countRows[0]?.total ?? 0

  return {
    projects: projectRows.map((p) => ({
      projectId: p.id,
      name: p.name,
      description: p.description,
      mode: p.mode,
      createdAt: new Date(p.createdAt).toISOString(),
      updatedAt: new Date(p.updatedAt).toISOString(),
    })),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  }
}
