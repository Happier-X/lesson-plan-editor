import { createOpenAI } from '@ai-sdk/openai'
import { generateText, generateObject } from 'ai'
import { z } from 'zod'
import type { PptxContent, SlideContent } from './pptx-extractor'

/**
 * AI优化后的幻灯片内容
 */
export interface ImprovedSlideContent extends SlideContent {
  improvedTexts?: string[]  // AI清理优化后的文字
}

/**
 * 获取配置的 OpenAI 客户端
 */
function getOpenAIClient() {
  const config = useRuntimeConfig()

  const baseURL = config.public.openaiBaseUrl || 'https://api.openai.com/v1'
  const apiKey = config.public.openaiApiKey

  console.log('=== OpenAI 客户端配置 ===')
  console.log('Base URL:', baseURL)
  console.log('API Key:', apiKey ? `${apiKey.substring(0, 10)}...` : 'undefined')

  return createOpenAI({
    baseURL,
    apiKey
  })
}

/**
 * 使用AI提高PPT文字提取的准确性
 * AI会清理、修正和优化提取出的文字，使其更准确易读
 */
export async function improveTextExtraction(content: PptxContent): Promise<PptxContent> {
  const config = useRuntimeConfig()
  const openai = getOpenAIClient()
  const model = config.public.openaiModel || 'gpt-3.5-turbo'

  const improvedSlides: SlideContent[] = []

  for (const slide of content.slides) {
    if (slide.texts.length === 0) {
      improvedSlides.push(slide)
      continue
    }

    try {
      const prompt = `你是一个专业的文本清理助手。以下是从PPT幻灯片中提取的原始文字，可能存在断行、多余空格、特殊字符等问题。

请帮我清理和优化这些文字，要求：
1. 合并被断开的句子和段落
2. 去除多余的空白字符和特殊字符
3. 修正明显的格式问题
4. 保持原文的完整意思，不要添加或删除实质性内容
5. 保持文字的顺序和层次结构

原始文字：
${slide.texts.map((t, i) => `${i + 1}. ${t}`).join('\n')}`

      const { object } = await generateObject({
        model: openai(model),
        schema: z.object({
          cleanedTexts: z.array(z.string()).describe('清理后的文字数组')
        }),
        prompt,
        temperature: 0.1
      })

      improvedSlides.push({
        ...slide,
        texts: object.cleanedTexts || slide.texts
      })
    } catch (error) {
      console.error(`AI优化幻灯片 ${slide.slideNumber} 失败:`, error)
      improvedSlides.push(slide)
    }
  }

  return {
    ...content,
    slides: improvedSlides
  }
}

/**
 * 使用AI生成教案建议
 */
export async function generateLessonPlanSuggestions(content: PptxContent): Promise<string> {
  const config = useRuntimeConfig()
  const openai = getOpenAIClient()
  const model = config.public.openaiModel || 'gpt-3.5-turbo'

  const slidesText = content.slides.map(slide => `
幻灯片 ${slide.slideNumber}:
${slide.texts.join('\n')}
${slide.notes ? `备注: ${slide.notes}` : ''}
  `).join('\n---\n')

  const prompt = `基于以下PPT课件内容，请生成一份详细的教案建议，包括：
1. 课程目标
2. 教学重点和难点
3. 教学方法建议
4. 课堂活动设计
5. 时间分配建议

PPT内容:
${slidesText}

请提供专业、详细的教案建议。`

  try {
    const { text } = await generateText({
      model: openai(model),
      system: '你是一位经验丰富的教师，擅长根据课件内容设计高质量的教学方案。',
      prompt,
      temperature: 0.7
    })

    return text
  } catch (error) {
    console.error('生成教案建议失败:', error)
    throw new Error('AI生成教案建议失败')
  }
}

/**
 * 使用AI智能匹配PPT内容到Word模板字段
 */
export async function matchPptToTemplateFields(
  pptContent: PptxContent,
  templateFields: string[]
): Promise<Record<string, string>> {
  const config = useRuntimeConfig()
  const openai = getOpenAIClient()
  const model = config.public.openaiModel || 'gpt-3.5-turbo'

  // 整理PPT内容，限制长度避免token过多
  const slidesText = pptContent.slides.map(slide => {
    const texts = slide.texts.join('\n')
    const notes = slide.notes ? `\n备注: ${slide.notes}` : ''
    return `第${slide.slideNumber}页:\n${texts}${notes}`
  }).join('\n\n')

  // 限制内容长度
  const maxContentLength = 2000
  const truncatedContent = slidesText.length > maxContentLength
    ? slidesText.substring(0, maxContentLength) + '\n...'
    : slidesText

  console.log('=== 智能填充信息 ===')
  console.log('PPT 内容长度:', truncatedContent.length)
  console.log('模板字段:', templateFields)

  const prompt = `Based on the following PPT content, fill in the template fields.

PPT Content:
${truncatedContent}

Template Fields:
${templateFields.join(', ')}

Return a JSON object with each field as a key and appropriate content as the value.`

  try {
    // 动态构建 schema
    const schemaFields: Record<string, any> = {}
    for (const field of templateFields) {
      schemaFields[field] = z.string().describe(`${field}的内容`)
    }

    const { object } = await generateObject({
      model: openai(model),
      schema: z.object(schemaFields),
      system: 'You are a teaching assistant.',
      prompt,
      temperature: 0.5
    })

    console.log('AI 响应成功')

    // 确保所有模板字段都有值
    const filledData: Record<string, string> = {}
    for (const field of templateFields) {
      filledData[field] = object[field] || `请填写${field}`
    }

    return filledData
  } catch (error: any) {
    console.error('=== 智能填充失败 ===')
    console.error('错误:', error)
    throw new Error(`智能填充失败: ${error.message || '未知错误'}`)
  }
}