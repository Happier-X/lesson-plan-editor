import OpenAI from 'openai'
import type { PptxContent, SlideContent } from './pptx-extractor'

/**
 * AI优化后的幻灯片内容
 */
export interface ImprovedSlideContent extends SlideContent {
  improvedTexts?: string[]  // AI清理优化后的文字
}

/**
 * 初始化OpenAI客户端
 */
function getOpenAIClient() {
  const config = useRuntimeConfig()

  return new OpenAI({
    apiKey: config.public.openaiApiKey,
    baseURL: config.public.openaiBaseUrl,
  })
}

/**
 * 使用AI提高PPT文字提取的准确性
 * AI会清理、修正和优化提取出的文字，使其更准确易读
 */
export async function improveTextExtraction(content: PptxContent): Promise<PptxContent> {
  const client = getOpenAIClient()
  const config = useRuntimeConfig()

  const improvedSlides: SlideContent[] = []

  for (const slide of content.slides) {
    if (slide.texts.length === 0) {
      improvedSlides.push(slide)
      continue
    }

    try {
      const prompt = `
你是一个专业的文本清理助手。以下是从PPT幻灯片中提取的原始文字，可能存在断行、多余空格、特殊字符等问题。

请帮我清理和优化这些文字，要求：
1. 合并被断开的句子和段落
2. 去除多余的空白字符和特殊字符
3. 修正明显的格式问题
4. 保持原文的完整意思，不要添加或删除实质性内容
5. 保持文字的顺序和层次结构

原始文字：
${slide.texts.map((t, i) => `${i + 1}. ${t}`).join('\n')}

请按JSON格式返回清理后的文字数组：
{
  "cleanedTexts": ["清理后的文字1", "清理后的文字2", ...]
}
`

      const response = await client.chat.completions.create({
        model: config.public.openaiModel,
        messages: [
          {
            role: 'system',
            content: '你是一个专业的文本清理助手，擅长清理和优化从PPT中提取的文字，提高文字的准确性和可读性。你只清理格式问题，不改变文字的实质内容。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,  // 低温度以保持准确性
        response_format: { type: 'json_object' }
      })

      const result = JSON.parse(response.choices[0].message.content || '{}')

      improvedSlides.push({
        ...slide,
        texts: result.cleanedTexts || slide.texts  // 使用AI清理后的文字
      })
    } catch (error) {
      console.error(`AI优化幻灯片 ${slide.slideNumber} 失败:`, error)
      // 如果AI处理失败，保留原始内容
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
  const client = getOpenAIClient()
  const config = useRuntimeConfig()

  const slidesText = content.slides.map(slide => `
幻灯片 ${slide.slideNumber}:
${slide.texts.join('\n')}
${slide.notes ? `备注: ${slide.notes}` : ''}
  `).join('\n---\n')

  const prompt = `
基于以下PPT课件内容，请生成一份详细的教案建议，包括：
1. 课程目标
2. 教学重点和难点
3. 教学方法建议
4. 课堂活动设计
5. 时间分配建议

PPT内容:
${slidesText}

请提供专业、详细的教案建议。
`

  try {
    const response = await client.chat.completions.create({
      model: config.public.openaiModel,
      messages: [
        {
          role: 'system',
          content: '你是一位经验丰富的教师，擅长根据课件内容设计高质量的教学方案。'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
    })

    return response.choices[0].message.content || '无法生成教案建议'
  } catch (error) {
    console.error('生成教案建议失败:', error)
    throw new Error('AI生成教案建议失败')
  }
}