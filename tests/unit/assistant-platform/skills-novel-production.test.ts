import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AssistantRuntimeContext } from '@/lib/assistant-platform'

const prismaMock = vi.hoisted(() => ({
  project: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
  novelPromotionProject: {
    findUnique: vi.fn(),
  },
  novelPromotionEpisode: {
    count: vi.fn(),
  },
  novelPromotionCharacter: {
    count: vi.fn(),
  },
  novelPromotionLocation: {
    count: vi.fn(),
  },
  characterAppearance: {
    count: vi.fn(),
  },
  novelPromotionPanel: {
    count: vi.fn(),
  },
  novelPromotionVoiceLine: {
    count: vi.fn(),
  },
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

import { novelProductionSkill } from '@/lib/assistant-platform/skills/novel-production'

function buildRuntimeContext(): AssistantRuntimeContext {
  return {
    userId: 'user-1',
    assistantId: 'novel-production',
    context: {},
    analysisModelKey: 'openrouter::gpt-5-mini',
    resolvedModel: {
      providerId: 'openrouter',
      providerKey: 'openrouter',
      modelId: 'gpt-5-mini',
    },
  }
}

describe('assistant-platform novel-production skill', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('listProjects returns projects for the user', async () => {
    const now = new Date('2025-01-01T00:00:00Z')
    prismaMock.project.count.mockResolvedValue(2)
    prismaMock.project.findMany.mockResolvedValue([
      { id: 'proj-1', name: 'Project A', description: null, mode: 'novel-promotion', createdAt: now, updatedAt: now },
      { id: 'proj-2', name: 'Project B', description: 'desc', mode: 'novel-promotion', createdAt: now, updatedAt: now },
    ])

    const tools = novelProductionSkill.tools?.(buildRuntimeContext())
    expect(tools).toBeTruthy()
    const listTool = tools?.listProjects
    expect(listTool).toBeTruthy()
    if (!listTool?.execute) {
      throw new Error('listProjects.execute is required for test')
    }

    const result = await listTool.execute({ page: 1, pageSize: 10 }, {} as never)

    expect(result.projects).toHaveLength(2)
    expect(result.projects[0].projectId).toBe('proj-1')
    expect(result.projects[0].name).toBe('Project A')
    expect(result.pagination.total).toBe(2)
    expect(prismaMock.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1' } }),
    )
  })

  it('getProjectWorkflowStatus returns not-found status when project does not exist', async () => {
    prismaMock.project.findFirst.mockResolvedValue(null)

    const tools = novelProductionSkill.tools?.(buildRuntimeContext())
    const statusTool = tools?.getProjectWorkflowStatus
    if (!statusTool?.execute) {
      throw new Error('getProjectWorkflowStatus.execute is required for test')
    }

    const result = await statusTool.execute({ projectId: 'nonexistent' }, {} as never)

    expect(result.projectName).toBe('')
    expect(result.progressPercent).toBe(0)
    expect(result.nextStep).toContain('不存在')
  })

  it('getProjectWorkflowStatus identifies first step needed when episodes have no text', async () => {
    prismaMock.project.findFirst.mockResolvedValue({ id: 'proj-1', name: 'My Drama' })
    prismaMock.novelPromotionProject.findUnique.mockResolvedValue({ id: 'np-1' })
    // episodesWithText = 0, everything else = 0
    prismaMock.novelPromotionEpisode.count
      .mockResolvedValueOnce(0) // episodesWithText
      .mockResolvedValueOnce(0) // episodesWithAudio
    prismaMock.novelPromotionCharacter.count.mockResolvedValue(0)
    prismaMock.novelPromotionLocation.count
      .mockResolvedValueOnce(0) // total locations
      .mockResolvedValueOnce(0) // locationsWithImage
    prismaMock.characterAppearance.count.mockResolvedValue(0)
    prismaMock.novelPromotionPanel.count
      .mockResolvedValueOnce(0) // total panels
      .mockResolvedValueOnce(0) // panelsWithImage
      .mockResolvedValueOnce(0) // panelsWithVideo
    prismaMock.novelPromotionVoiceLine.count
      .mockResolvedValueOnce(0) // total voiceLines
      .mockResolvedValueOnce(0) // voiceLinesWithAudio

    const tools = novelProductionSkill.tools?.(buildRuntimeContext())
    const statusTool = tools?.getProjectWorkflowStatus
    if (!statusTool?.execute) {
      throw new Error('getProjectWorkflowStatus.execute is required for test')
    }

    const result = await statusTool.execute({ projectId: 'proj-1' }, {} as never)

    expect(result.projectName).toBe('My Drama')
    expect(result.stages.episodesWithText.completed).toBe(false)
    expect(result.nextStep).toContain('第一步')
    expect(result.progressPercent).toBe(0)
  })

  it('getProjectWorkflowStatus shows 100% progress when all stages complete', async () => {
    prismaMock.project.findFirst.mockResolvedValue({ id: 'proj-1', name: 'Completed Drama' })
    prismaMock.novelPromotionProject.findUnique.mockResolvedValue({ id: 'np-1' })
    prismaMock.novelPromotionEpisode.count
      .mockResolvedValueOnce(2) // episodesWithText
      .mockResolvedValueOnce(2) // episodesWithAudio
    prismaMock.novelPromotionCharacter.count.mockResolvedValue(3)
    prismaMock.novelPromotionLocation.count
      .mockResolvedValueOnce(2) // total locations
      .mockResolvedValueOnce(2) // locationsWithImage
    prismaMock.characterAppearance.count.mockResolvedValue(3)
    prismaMock.novelPromotionPanel.count
      .mockResolvedValueOnce(10) // total panels
      .mockResolvedValueOnce(10) // panelsWithImage
      .mockResolvedValueOnce(10) // panelsWithVideo
    prismaMock.novelPromotionVoiceLine.count
      .mockResolvedValueOnce(20) // total voiceLines
      .mockResolvedValueOnce(20) // voiceLinesWithAudio

    const tools = novelProductionSkill.tools?.(buildRuntimeContext())
    const statusTool = tools?.getProjectWorkflowStatus
    if (!statusTool?.execute) {
      throw new Error('getProjectWorkflowStatus.execute is required for test')
    }

    const result = await statusTool.execute({ projectId: 'proj-1' }, {} as never)

    expect(result.projectName).toBe('Completed Drama')
    expect(result.progressPercent).toBe(100)
    expect(result.stages.episodesWithText.completed).toBe(true)
    expect(result.stages.charactersCreated.completed).toBe(true)
    expect(result.stages.locationsCreated.completed).toBe(true)
    expect(result.stages.characterImagesGenerated.completed).toBe(true)
    expect(result.stages.locationImagesGenerated.completed).toBe(true)
    expect(result.stages.storyboardsGenerated.completed).toBe(true)
    expect(result.stages.panelImagesGenerated.completed).toBe(true)
    expect(result.stages.voiceLinesGenerated.completed).toBe(true)
    expect(result.stages.voiceAudioGenerated.completed).toBe(true)
    expect(result.stages.videoPanelsGenerated.completed).toBe(true)
    expect(result.stages.episodeVideoReady.completed).toBe(true)
    expect(result.nextStep).toContain('已完成')
  })
})
