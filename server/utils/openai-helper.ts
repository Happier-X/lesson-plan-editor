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
    const imageInfo = slide.images && slide.images.length > 0
      ? `\n[该页包含${slide.images.length}张图片]`
      : ''
    return `第${slide.slideNumber}页:\n${texts}${notes}${imageInfo}`
  }).join('\n\n')

  // 限制内容长度
  const maxContentLength = 4000
  const truncatedContent = slidesText.length > maxContentLength
    ? slidesText.substring(0, maxContentLength) + '\n...'
    : slidesText

  console.log('=== 智能填充信息 ===')
  console.log('PPT 内容长度:', truncatedContent.length)
  console.log('模板字段:', templateFields)

  // 收集所有图片（限制数量避免token过多）
  const allImages: string[] = []
  for (const slide of pptContent.slides) {
    if (slide.images && slide.images.length > 0) {
      // 每张幻灯片最多取前2张图片
      allImages.push(...slide.images.slice(0, 2))
    }
    // 总共最多20张图片
    if (allImages.length >= 20) break
  }

  console.log('提取的图片数量:', allImages.length)

  // 构建更详细的中文提示词
  const systemPrompt = `你是一位经验丰富的医学护理教学设计专家，擅长根据课件内容编写详细、专业的护理教案。

你的任务是根据提供的PPT课件内容（包括文字和图片），为教案模板的各个字段生成高质量、详细的内容。

${allImages.length > 0 ? `注意：你可以看到${allImages.length}张来自PPT的图片。请仔细观察图片中的：
- 图表、流程图、示意图等视觉内容
- 关键概念的图示说明
- 病理图片、解剖图等医学图像
- 表格数据
结合图片内容，让教案更加准确、专业和详细。` : ''}

重要要求：
1. 内容要详细充实，不要简单概括
2. 对于教学过程等字段，要包含：
   - 安全教育（2min）：如"上下楼梯靠右走，不追逐打闹"
   - 导入/复习导入（5-10min）：
     * 新授课：设计引入情境、案例或问题讨论
     * 复习课：列出"重点掌握"的知识点清单
   - 课堂呈现/新课讲授（20-30min）：
     * 详细列出知识点，使用①②③④⑤编号
     * 标注考点类型（选择题）（简答题）（重点）
     * 包含具体内容和要点
   - 巩固练习（5-10min）：设计3-5道选择题，包含ABCDE选项
   - 课堂小结（3-5min）：写成完整的叙述性段落，总结本节课要点
   - 作业布置（2-5min）：布置具体作业
3. 对于板书设计：
   - 简洁明了，使用符号（→）表示逻辑关系
   - 列出核心知识框架
   - 每个要点独立成行
4. 列表项要使用换行，每个要点独立成行
5. 护理措施要详细，使用①②③④⑤编号，每项包含具体内容
6. 保持专业的医学护理教学语言
7. 参考真实护理教案的写作风格和格式`

  const userPrompt = `请根据以下PPT课件内容${allImages.length > 0 ? '和图片' : ''}，为护理教案模板填充内容。

PPT课件内容：
${truncatedContent}

${allImages.length > 0 ? `\n你可以看到PPT中的${allImages.length}张图片，请仔细观察并结合图片内容生成教案。\n` : ''}
需要填充的教案字段：
${templateFields.map((f, i) => `${i + 1}. ${f}`).join('\n')}

填充要求：

【课题】
- 格式："第X章第X节 XXX病人的护理" 或 "第X章 XXX"

【教学目标】
- 分为三个维度，每个独立成行：
  1. 知识目标：掌握XXX；熟悉XXX；了解XXX
  2. 能力目标：能够XXX
  3. 情感目标：培养XXX意识/态度

【教材分析重点】
- 列出3-5个重点内容，每项独立成行
- 格式示例：
  重点内容一
  重点内容二

【教材分析难点】
- 列出2-4个难点内容，每项独立成行

【教材分析教具】
- 列出教学工具，如：教案、PPT、模型、教材等

【教学过程】（这是最重要的部分，要非常详细）
必须包含以下完整结构：

一、安全教育（2min）
上下楼梯靠右走，不追逐打闹，过马路注意安全

二、导入/复习导入（5-10min）
新授课：设计引入案例、小组讨论问题
复习课：列出"重点掌握"的知识点清单，例如：
重点掌握：
1. XXX的病理变化
2. XXX的临床表现
3. XXX的护理措施

三、课堂呈现/新课讲授（20-30min）
（根据课型选择"课堂呈现"或"新课讲授"）

新授课格式：
第一课时（30min）
一、概念及病理生理
1. 定义
2. 病因
3. 病理机制

第二课时（30min）
一、护理评估
1. 健康史
2. 身体状况
...

复习课格式：
1. 概述：一组以XXX为基本临床表现的XXX疾病
2. 身体状况
①XXX：详细描述（选择题）
②XXX：详细描述
③XXX：详细描述
3. 辅助检查
4. 治疗要点（以简答题的形式背过）
①XXX
②XXX（选择题）
③XXX
5. 常见护理诊断（重点+简答题考点）
①XXX
②XXX
6. 护理措施
①一般护理：详细内容
②病情观察：详细内容
③用药护理：详细内容
④对症护理：详细内容
⑤心理护理：详细内容
⑥健康指导：详细内容

四、巩固练习/练习巩固（5-10min）
设计3-5道选择题，格式如下：
1. XXX的主要临床表现不包括（  ）
A. XXX  B. XXX  C. XXX  D. XXX  E. XXX

2. XXX患者饮食应注意的是（  ）
A. XXX  B. XXX  C. XXX  D. XXX  E. XXX

五、课堂小结（3-5min）
写成完整的叙述性段落，总结本节课的要点，例如：
"本次课程我们全面学习了XXX。该病以XXX为主要表现，诊断时依靠XXX。治疗上，XXX。护理过程中，要XXX。还要注重XXX，给予患者足够的支持与鼓励。"

六、作业布置/课后作业（2-5min）
整理本章节重难点/整理课堂笔记，完成课后练习题

【板书设计】
简洁的知识框架，使用符号，每个要点独立成行：
1. 定义：XXX→XXX→XXX
2. 分类：XXX、XXX
3. 病情监测：XXX（正常值）
4. 急救：XXX原则
5. 治疗配合：XXX
6. 基础护理：XXX

格式要求：
1. 所有列表项必须换行
2. 使用①②③④⑤标注子项
3. 适当标注考点类型：（选择题）（简答题）（重点）
4. 课堂小结要写成完整段落，不是列表

请严格按照以上要求生成详细、专业、格式规范的护理教案内容。`

  try {
    // 动态构建 schema
    const schemaFields: Record<string, any> = {}
    for (const field of templateFields) {
      schemaFields[field] = z.string().describe(`${field}的详细内容，要求内容充实，格式规范，列表项独立成行`)
    }

    // 构建消息内容（支持多模态）
    const messageContent: any[] = [
      {
        type: 'text',
        text: userPrompt
      }
    ]

    // 如果有图片，添加到消息中
    if (allImages.length > 0) {
      console.log(`发送${allImages.length}张图片给AI进行视觉分析`)

      for (const imageBase64 of allImages) {
        messageContent.push({
          type: 'image',
          image: imageBase64
        })
      }
    }

    const { object } = await generateObject({
      model: openai(model),
      schema: z.object(schemaFields),
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: messageContent
        }
      ],
      temperature: 0.7,
      maxTokens: 4000
    })

    console.log('AI 响应成功')

    // 格式化处理：确保序号后换行
    const filledData: Record<string, string> = {}
    for (const field of templateFields) {
      let content = object[field] || `请填写${field}`

      // 处理序号换行
      content = formatListItems(content)

      filledData[field] = content
    }

    return filledData
  } catch (error: any) {
    console.error('=== 智能填充失败 ===')
    console.error('错误:', error)
    throw new Error(`智能填充失败: ${error.message || '未知错误'}`)
  }
}

/**
 * 格式化列表项，确保序号后换行
 */
function formatListItems(text: string): string {
  if (!text) return text

  let formatted = text

  // 1. 先处理可能存在的Windows换行符
  formatted = formatted.replace(/\r\n/g, '\n')

  // 2. 处理数字序号后面直接跟内容的情况（1.内容 -> \n1.内容）
  // 但不处理已经有换行符的情况
  formatted = formatted.replace(/([^\n])(\d+\.)/g, '$1\n$2')

  // 3. 处理中文序号（一、二、三、等）
  formatted = formatted.replace(/([^\n])([一二三四五六七八九十]+、)/g, '$1\n$2')

  // 4. 处理括号序号（(1) (2) 等）
  formatted = formatted.replace(/([^\n])(\(\d+\))/g, '$1\n$2')

  // 5. 处理中文括号序号（（一）（二）等）
  formatted = formatted.replace(/([^\n])(（[一二三四五六七八九十]+）)/g, '$1\n$2')

  // 6. 处理带圈数字（①②③④⑤⑥⑦⑧⑨⑩）
  formatted = formatted.replace(/([^\n])([①②③④⑤⑥⑦⑧⑨⑩])/g, '$1\n$2')

  // 7. 处理可能的多个空格
  formatted = formatted.replace(/ {2,}/g, ' ')

  // 8. 清理多余的空行（超过2个连续换行符）
  formatted = formatted.replace(/\n{3,}/g, '\n\n')

  // 9. 去除开头和结尾的空白
  formatted = formatted.trim()

  return formatted
}