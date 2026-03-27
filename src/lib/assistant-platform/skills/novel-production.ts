import { jsonSchema, tool, type ToolSet } from 'ai'
import { prisma } from '@/lib/prisma'
import type { AssistantRuntimeContext, AssistantSkillDefinition } from '../types'
import { renderAssistantSystemPrompt } from '../system-prompts'

interface ListProjectsToolInput {
  page?: number
  pageSize?: number
}

interface GetProjectWorkflowStatusToolInput {
  projectId: string
}

interface WorkflowStageStatus {
  completed: boolean
  count?: number
  note?: string
}

interface ProjectWorkflowStatus {
  projectId: string
  projectName: string
  stages: {
    episodesWithText: WorkflowStageStatus
    charactersCreated: WorkflowStageStatus
    locationsCreated: WorkflowStageStatus
    characterImagesGenerated: WorkflowStageStatus
    locationImagesGenerated: WorkflowStageStatus
    storyboardsGenerated: WorkflowStageStatus
    panelImagesGenerated: WorkflowStageStatus
    voiceLinesGenerated: WorkflowStageStatus
    voiceAudioGenerated: WorkflowStageStatus
    videoPanelsGenerated: WorkflowStageStatus
    episodeVideoReady: WorkflowStageStatus
  }
  nextStep: string
  progressPercent: number
}

function buildNovelProductionPrompt(_ctx: AssistantRuntimeContext): string {
  return renderAssistantSystemPrompt('novel-production')
}

function createNovelProductionTools(ctx: AssistantRuntimeContext): ToolSet {
  return {
    listProjects: tool({
      description: '列出当前用户的项目列表，帮助用户选择要操作的项目。',
      inputSchema: jsonSchema<ListProjectsToolInput>({
        type: 'object',
        additionalProperties: false,
        properties: {
          page: { type: 'number', minimum: 1 },
          pageSize: { type: 'number', minimum: 1, maximum: 50 },
        },
      }),
      execute: async (input) => {
        const page = input.page ?? 1
        const pageSize = input.pageSize ?? 10
        const skip = (page - 1) * pageSize

        const [total, projects] = await Promise.all([
          prisma.project.count({ where: { userId: ctx.userId } }),
          prisma.project.findMany({
            where: { userId: ctx.userId },
            orderBy: { updatedAt: 'desc' },
            skip,
            take: pageSize,
            select: {
              id: true,
              name: true,
              description: true,
              createdAt: true,
              updatedAt: true,
              mode: true,
            },
          }),
        ])

        return {
          projects: projects.map((p) => ({
            projectId: p.id,
            name: p.name,
            description: p.description,
            mode: p.mode,
            createdAt: p.createdAt.toISOString(),
            updatedAt: p.updatedAt.toISOString(),
          })),
          pagination: {
            page,
            pageSize,
            total,
            totalPages: Math.ceil(total / pageSize),
          },
        }
      },
    }),

    getProjectWorkflowStatus: tool({
      description:
        '获取指定项目的制作流程进度，包括每个阶段是否完成以及下一步建议。',
      inputSchema: jsonSchema<GetProjectWorkflowStatusToolInput>({
        type: 'object',
        additionalProperties: false,
        properties: {
          projectId: { type: 'string', minLength: 1 },
        },
        required: ['projectId'],
      }),
      execute: async (input): Promise<ProjectWorkflowStatus> => {
        const { projectId } = input

        const project = await prisma.project.findFirst({
          where: { id: projectId, userId: ctx.userId },
          select: { id: true, name: true },
        })

        if (!project) {
          return {
            projectId,
            projectName: '',
            stages: {
              episodesWithText: { completed: false, note: '项目不存在或无权访问' },
              charactersCreated: { completed: false },
              locationsCreated: { completed: false },
              characterImagesGenerated: { completed: false },
              locationImagesGenerated: { completed: false },
              storyboardsGenerated: { completed: false },
              panelImagesGenerated: { completed: false },
              voiceLinesGenerated: { completed: false },
              voiceAudioGenerated: { completed: false },
              videoPanelsGenerated: { completed: false },
              episodeVideoReady: { completed: false },
            },
            nextStep: '项目不存在，请先创建项目',
            progressPercent: 0,
          }
        }

        const novelProject = await prisma.novelPromotionProject.findUnique({
          where: { projectId },
          select: { id: true },
        })

        if (!novelProject) {
          return {
            projectId,
            projectName: project.name,
            stages: {
              episodesWithText: { completed: false, note: '尚未初始化小说制作数据' },
              charactersCreated: { completed: false },
              locationsCreated: { completed: false },
              characterImagesGenerated: { completed: false },
              locationImagesGenerated: { completed: false },
              storyboardsGenerated: { completed: false },
              panelImagesGenerated: { completed: false },
              voiceLinesGenerated: { completed: false },
              voiceAudioGenerated: { completed: false },
              videoPanelsGenerated: { completed: false },
              episodeVideoReady: { completed: false },
            },
            nextStep: '请在项目详情页中初始化小说制作流程',
            progressPercent: 0,
          }
        }

        const [
          episodesWithText,
          characters,
          locations,
          characterAppearancesWithImage,
          locationsWithImage,
          panels,
          panelsWithImage,
          voiceLines,
          voiceLinesWithAudio,
          panelsWithVideo,
          episodesWithAudio,
        ] = await Promise.all([
          prisma.novelPromotionEpisode.count({
            where: { novelPromotionProjectId: novelProject.id, novelText: { not: null } },
          }),
          prisma.novelPromotionCharacter.count({
            where: { novelPromotionProjectId: novelProject.id },
          }),
          prisma.novelPromotionLocation.count({
            where: { novelPromotionProjectId: novelProject.id },
          }),
          prisma.characterAppearance.count({
            where: {
              character: { novelPromotionProjectId: novelProject.id },
              imageUrl: { not: null },
            },
          }),
          prisma.novelPromotionLocation.count({
            where: {
              novelPromotionProjectId: novelProject.id,
              selectedImageId: { not: null },
            },
          }),
          prisma.novelPromotionPanel.count({
            where: { storyboard: { episode: { novelPromotionProjectId: novelProject.id } } },
          }),
          prisma.novelPromotionPanel.count({
            where: {
              storyboard: { episode: { novelPromotionProjectId: novelProject.id } },
              imageUrl: { not: null },
            },
          }),
          prisma.novelPromotionVoiceLine.count({
            where: { episode: { novelPromotionProjectId: novelProject.id } },
          }),
          prisma.novelPromotionVoiceLine.count({
            where: {
              episode: { novelPromotionProjectId: novelProject.id },
              audioUrl: { not: null },
            },
          }),
          prisma.novelPromotionPanel.count({
            where: {
              storyboard: { episode: { novelPromotionProjectId: novelProject.id } },
              videoUrl: { not: null },
            },
          }),
          prisma.novelPromotionEpisode.count({
            where: { novelPromotionProjectId: novelProject.id, audioUrl: { not: null } },
          }),
        ])

        const episodesWithTextDone = episodesWithText > 0
        const charactersDone = characters > 0
        const locationsDone = locations > 0
        const characterImagesDone = characters > 0 && characterAppearancesWithImage >= characters
        const locationImagesDone = locations > 0 && locationsWithImage >= locations
        const storyboardsDone = panels > 0
        const panelImagesDone = panels > 0 && panelsWithImage >= panels
        const voiceLinesDone = voiceLines > 0
        const voiceAudioDone = voiceLines > 0 && voiceLinesWithAudio >= voiceLines
        const videoPanelsDone = panels > 0 && panelsWithVideo >= panels
        const episodeVideoDone = episodesWithAudio > 0

        const completedCount = [
          episodesWithTextDone,
          charactersDone,
          locationsDone,
          characterImagesDone,
          locationImagesDone,
          storyboardsDone,
          panelImagesDone,
          voiceLinesDone,
          voiceAudioDone,
          videoPanelsDone,
          episodeVideoDone,
        ].filter(Boolean).length

        const progressPercent = Math.round((completedCount / 11) * 100)

        let nextStep: string
        if (!episodesWithTextDone) {
          nextStep = '第一步：请在项目中创建剧集并粘贴小说/剧本文本'
        } else if (!charactersDone) {
          nextStep = '第二步：请在"角色"页面中运行 AI 分析，提取角色列表'
        } else if (!locationsDone) {
          nextStep = '第三步：请在"场景"页面中运行 AI 分析，提取场景列表'
        } else if (!characterImagesDone) {
          nextStep = `第四步：请为所有角色生成图像（当前 ${characterAppearancesWithImage}/${characters} 已生成）`
        } else if (!locationImagesDone) {
          nextStep = `第五步：请为所有场景生成图像（当前 ${locationsWithImage}/${locations} 已生成）`
        } else if (!storyboardsDone) {
          nextStep = '第六步：请在剧集页面运行"故事转剧本"和"剧本转分镜"，生成分镜列表'
        } else if (!panelImagesDone) {
          nextStep = `第七步：请批量生成分镜图像（当前 ${panelsWithImage}/${panels} 已生成）`
        } else if (!voiceLinesDone) {
          nextStep = '第八步：请在"配音"页面运行"配音分析"，提取台词列表'
        } else if (!voiceAudioDone) {
          nextStep = `第九步：请批量生成配音（当前 ${voiceLinesWithAudio}/${voiceLines} 已生成）`
        } else if (!videoPanelsDone) {
          nextStep = `第十步：请批量生成视频片段（当前 ${panelsWithVideo}/${panels} 已生成）`
        } else if (!episodeVideoDone) {
          nextStep = '第十一步：请在剧集页面点击"生成最终视频"合成完整视频'
        } else {
          nextStep = '所有阶段已完成！可在"下载"页面导出视频或素材包'
        }

        return {
          projectId,
          projectName: project.name,
          stages: {
            episodesWithText: { completed: episodesWithTextDone, count: episodesWithText },
            charactersCreated: { completed: charactersDone, count: characters },
            locationsCreated: { completed: locationsDone, count: locations },
            characterImagesGenerated: {
              completed: characterImagesDone,
              count: characterAppearancesWithImage,
              note: `${characterAppearancesWithImage}/${characters}`,
            },
            locationImagesGenerated: {
              completed: locationImagesDone,
              count: locationsWithImage,
              note: `${locationsWithImage}/${locations}`,
            },
            storyboardsGenerated: { completed: storyboardsDone, count: panels },
            panelImagesGenerated: {
              completed: panelImagesDone,
              count: panelsWithImage,
              note: `${panelsWithImage}/${panels}`,
            },
            voiceLinesGenerated: { completed: voiceLinesDone, count: voiceLines },
            voiceAudioGenerated: {
              completed: voiceAudioDone,
              count: voiceLinesWithAudio,
              note: `${voiceLinesWithAudio}/${voiceLines}`,
            },
            videoPanelsGenerated: {
              completed: videoPanelsDone,
              count: panelsWithVideo,
              note: `${panelsWithVideo}/${panels}`,
            },
            episodeVideoReady: { completed: episodeVideoDone, count: episodesWithAudio },
          },
          nextStep,
          progressPercent,
        }
      },
    }),
  }
}

export const novelProductionSkill: AssistantSkillDefinition = {
  id: 'novel-production',
  systemPrompt: buildNovelProductionPrompt,
  tools: createNovelProductionTools,
  temperature: 0.2,
  maxSteps: 6,
}
