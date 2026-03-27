import { query, queryOne } from '../db.js'
import type { ToolResult } from '../types.js'

export interface CreateProjectInput {
  name: string
  description?: string
}

interface InsertResult {
  insertId: bigint
}

interface ProjectRow {
  id: string
  name: string
  description: string | null
  mode: string
  createdAt: Date
}

export async function createProject(
  userId: string,
  input: CreateProjectInput,
): Promise<ToolResult> {
  const name = input.name.trim()
  if (!name) {
    return { error: 'name is required', projectId: null }
  }
  if (name.length > 100) {
    return { error: 'name must be 100 characters or less', projectId: null }
  }

  const description = input.description?.trim() ?? null
  if (description && description.length > 500) {
    return { error: 'description must be 500 characters or less', projectId: null }
  }

  const id = generateId()
  const now = new Date()

  // Insert base project
  await query<InsertResult>(
    'INSERT INTO projects (id, name, description, mode, userId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, name, description, 'novel-promotion', userId, now, now],
  )

  // Insert novel-promotion sub-record
  await query(
    'INSERT INTO novel_promotion_projects (id, projectId, createdAt, updatedAt) VALUES (?, ?, ?, ?)',
    [generateId(), id, now, now],
  )

  const project = await queryOne<ProjectRow>(
    'SELECT id, name, description, mode, createdAt FROM projects WHERE id = ?',
    [id],
  )

  return {
    projectId: id,
    name: project?.name ?? name,
    description: project?.description ?? description,
    mode: 'novel-promotion',
    createdAt: project ? new Date(project.createdAt).toISOString() : now.toISOString(),
  }
}

function generateId(): string {
  // RFC 4122 v4 UUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}
