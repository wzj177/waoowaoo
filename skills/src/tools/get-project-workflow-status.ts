import { query, queryOne } from '../db.js'
import type { ToolResult } from '../types.js'

export interface GetProjectWorkflowStatusInput {
  projectId: string
}

interface CountRow {
  cnt: number
}

async function count(sql: string, params: unknown[]): Promise<number> {
  const rows = await query<CountRow>(sql, params)
  return rows[0]?.cnt ?? 0
}

interface ProjectRow {
  id: string
  name: string
}

interface NpProjectRow {
  id: string
}

export async function getProjectWorkflowStatus(
  userId: string,
  input: GetProjectWorkflowStatusInput,
): Promise<ToolResult> {
  const { projectId } = input

  const project = await queryOne<ProjectRow>(
    'SELECT id, name FROM projects WHERE id = ? AND userId = ?',
    [projectId, userId],
  )

  if (!project) {
    return {
      projectId,
      projectName: '',
      stages: buildEmptyStages('项目不存在或无权访问'),
      nextStep: '项目不存在，请先创建项目',
      progressPercent: 0,
    }
  }

  const npProject = await queryOne<NpProjectRow>(
    'SELECT id FROM novel_promotion_projects WHERE projectId = ?',
    [projectId],
  )

  if (!npProject) {
    return {
      projectId,
      projectName: project.name,
      stages: buildEmptyStages('尚未初始化小说制作数据'),
      nextStep: '请在项目详情页中初始化小说制作流程',
      progressPercent: 0,
    }
  }

  const npId = npProject.id

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
    count(
      'SELECT COUNT(*) AS cnt FROM novel_promotion_episodes WHERE novelPromotionProjectId = ? AND novelText IS NOT NULL',
      [npId],
    ),
    count(
      'SELECT COUNT(*) AS cnt FROM novel_promotion_characters WHERE novelPromotionProjectId = ?',
      [npId],
    ),
    count(
      'SELECT COUNT(*) AS cnt FROM novel_promotion_locations WHERE novelPromotionProjectId = ?',
      [npId],
    ),
    count(
      `SELECT COUNT(*) AS cnt FROM character_appearances ca
       INNER JOIN novel_promotion_characters c ON ca.characterId = c.id
       WHERE c.novelPromotionProjectId = ? AND ca.imageUrl IS NOT NULL`,
      [npId],
    ),
    count(
      'SELECT COUNT(*) AS cnt FROM novel_promotion_locations WHERE novelPromotionProjectId = ? AND selectedImageId IS NOT NULL',
      [npId],
    ),
    count(
      `SELECT COUNT(*) AS cnt FROM novel_promotion_panels p
       INNER JOIN novel_promotion_storyboards sb ON p.storyboardId = sb.id
       INNER JOIN novel_promotion_episodes e ON sb.episodeId = e.id
       WHERE e.novelPromotionProjectId = ?`,
      [npId],
    ),
    count(
      `SELECT COUNT(*) AS cnt FROM novel_promotion_panels p
       INNER JOIN novel_promotion_storyboards sb ON p.storyboardId = sb.id
       INNER JOIN novel_promotion_episodes e ON sb.episodeId = e.id
       WHERE e.novelPromotionProjectId = ? AND p.imageUrl IS NOT NULL`,
      [npId],
    ),
    count(
      `SELECT COUNT(*) AS cnt FROM novel_promotion_voice_lines vl
       INNER JOIN novel_promotion_episodes e ON vl.episodeId = e.id
       WHERE e.novelPromotionProjectId = ?`,
      [npId],
    ),
    count(
      `SELECT COUNT(*) AS cnt FROM novel_promotion_voice_lines vl
       INNER JOIN novel_promotion_episodes e ON vl.episodeId = e.id
       WHERE e.novelPromotionProjectId = ? AND vl.audioUrl IS NOT NULL`,
      [npId],
    ),
    count(
      `SELECT COUNT(*) AS cnt FROM novel_promotion_panels p
       INNER JOIN novel_promotion_storyboards sb ON p.storyboardId = sb.id
       INNER JOIN novel_promotion_episodes e ON sb.episodeId = e.id
       WHERE e.novelPromotionProjectId = ? AND p.videoUrl IS NOT NULL`,
      [npId],
    ),
    count(
      'SELECT COUNT(*) AS cnt FROM novel_promotion_episodes WHERE novelPromotionProjectId = ? AND audioUrl IS NOT NULL',
      [npId],
    ),
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
}

function buildEmptyStages(note: string): Record<string, { completed: boolean; note?: string }> {
  const stageNames = [
    'episodesWithText',
    'charactersCreated',
    'locationsCreated',
    'characterImagesGenerated',
    'locationImagesGenerated',
    'storyboardsGenerated',
    'panelImagesGenerated',
    'voiceLinesGenerated',
    'voiceAudioGenerated',
    'videoPanelsGenerated',
    'episodeVideoReady',
  ]
  return Object.fromEntries(
    stageNames.map((name, i) => [name, { completed: false, ...(i === 0 ? { note } : {}) }]),
  )
}
