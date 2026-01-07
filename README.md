# PPT课件教案生成工具 ✨视觉增强版

一个专业的PPT内容提取和教案生成工具，支持**视觉AI分析**，能够"看懂"PPT中的图片、图表，生成更准确的护理教案。

## 🆕 最新功能：视觉增强

### 📸 图片提取与分析
- **自动提取PPT图片**：提取幻灯片中的所有嵌入图片
- **视觉AI分析**：AI可以"看到"并理解图片内容
- **多模态理解**：结合文字和图片生成更准确的教案

### 🤖 AI能看懂什么？
- 📊 图表和流程图
- 🔬 病理图片、解剖图等医学图像
- 📋 表格数据
- 🎨 示意图和关系图

## 功能特性

- ✅ **完整提取PPT内容**：原封不动提取幻灯片标题、内容和备注
- 🆕 **图片提取与预览**：提取并显示PPT中的所有图片
- 📋 **一键复制**：方便快速复制提取的内容
- 📄 **文档信息提取**：自动提取PPT的标题、作者、主题等元数据
- 📝 **Word模板管理**：上传并管理多个Word教案模板
- 🔧 **自定义占位符**：模板支持自定义字段占位符（如 {课程目标}、{教学重点}）
- 🆕 **AI视觉智能填充**：使用支持视觉的AI模型分析PPT内容（文字+图片）并智能填充
- 📥 **一键生成Word文档**：填充模板数据后一键生成并下载Word教案文档
- 🎨 **简洁美观的界面**：使用Nuxt UI和Tailwind CSS构建
- 🩺 **护理教案专用**：针对医学护理教案优化的格式和提示词

## 技术栈

- **前端框架**: Nuxt 4 + Vue 3
- **UI组件库**: Nuxt UI
- **样式**: Tailwind CSS
- **PPT解析**: adm-zip + xml2js（支持文字和图片提取）
- **Word处理**: docxtemplater + pizzip
- **AI能力**: Vercel AI SDK + OpenAI 兼容API
- **视觉支持**: 支持多模态AI模型（gpt-4o、gpt-4o-mini等）

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置环境变量

创建 `.env` 文件，配置OpenAI API（**需要支持视觉的模型**）：

```env
NUXT_PUBLIC_OPENAI_API_KEY=your_openai_api_key
NUXT_PUBLIC_OPENAI_BASE_URL=https://api.openai.com/v1
NUXT_PUBLIC_OPENAI_MODEL=gpt-4o-mini
```

**重要提示**：
- 要使用**视觉分析功能**，必须使用支持视觉的模型：
  - ✅ gpt-4o
  - ✅ gpt-4o-mini
  - ✅ gpt-4-vision-preview
  - ❌ gpt-3.5-turbo（不支持视觉）
- 如果不配置OpenAI，PPT提取和Word生成功能仍可正常使用，只是无法使用AI智能填充功能

### 3. 启动开发服务器

```bash
pnpm dev
```

访问 http://localhost:3000 开始使用。

### 4. 构建生产版本

```bash
pnpm build
pnpm preview
```

## 使用说明

### PPT内容提取

1. 点击上传区域选择 `.pptx` 格式的PPT文件
2. 点击"开始提取"按钮
3. 查看右侧的提取结果
4. 可以单独复制每页内容，也可以一键复制所有内容

### 提取内容说明

工具会完整提取以下内容：
- **幻灯片文本**：每张幻灯片上的所有文字内容，按顺序保留
- **备注内容**：幻灯片的备注信息
- **文档元数据**：PPT的标题、作者、主题等信息

### Word教案模板管理

#### 1. 创建模板

在Word中创建教案模板，使用 `{字段名}` 作为占位符。例如：

```
课程名称：{课程名称}
课程目标：
{课程目标}

教学重点：
{教学重点}

教学难点：
{教学难点}
```

#### 2. 上传模板

1. 点击"Word教案模板管理"区域的"展开"按钮
2. 在"上传新模板"区域选择Word模板文件（.docx格式）
3. 点击"上传模板"按钮
4. 系统会自动识别模板中的占位符

#### 3. 生成Word文档

**方式一：AI智能填充（推荐）**

1. 先上传并提取PPT内容
2. 在模板列表中点击选择一个模板
3. 点击"AI智能填充"按钮
4. AI会自动分析PPT内容，智能匹配并填充所有字段
5. 检查并调整填充内容（如需要）
6. 点击"生成Word文档"按钮下载

**方式二：手动填充**

1. 在模板列表中点击选择一个模板
2. 在"填充模板字段"区域手动填写所有字段内容
3. 点击"生成Word文档"按钮
4. 系统会自动下载生成的Word文档

#### 4. 管理模板

- **查看模板**：模板列表显示所有已上传的模板及其占位符
- **选择模板**：点击模板卡片可以选择该模板进行填充
- **删除模板**：点击模板卡片右上角的删除图标可以删除模板

## 项目结构

```
lesson-plan-editor/
├── app/
│   ├── pages/
│   │   └── index.vue          # 主页面
│   └── app.vue                # 根组件
├── server/
│   ├── api/
│   │   ├── extract-pptx.post.ts      # PPT提取API
│   │   └── templates/
│   │       ├── upload.post.ts        # 模板上传API
│   │       ├── list.get.ts           # 模板列表API
│   │       ├── [id].delete.ts        # 模板删除API
│   │       ├── smart-fill.post.ts    # AI智能填充API
│   │       └── generate.post.ts      # 文档生成API
│   └── utils/
│       ├── pptx-extractor.ts         # PPT解析工具
│       ├── openai-helper.ts          # OpenAI辅助工具
│       └── template-manager.ts       # 模板管理工具
├── .templates/                # 模板存储目录（自动创建）
├── nuxt.config.ts            # Nuxt配置
└── package.json              # 项目依赖
```

## API说明

### POST /api/extract-pptx

提取PPT内容的API端点。

**请求参数（FormData）**:
- `file`: PPT文件（.pptx格式）

**响应**:
```json
{
  "success": true,
  "data": {
    "content": {
      "slides": [...],
      "totalSlides": 10,
      "metadata": {...}
    }
  }
}
```

### POST /api/templates/upload

上传Word模板。

**请求参数（FormData）**:
- `file`: Word模板文件（.docx格式）

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "1234567890",
    "name": "教案模板.docx",
    "uploadDate": "2025-01-06T...",
    "placeholders": ["课程目标", "教学重点", "教学难点"]
  }
}
```

### GET /api/templates/list

获取所有模板列表。

**响应**:
```json
{
  "success": true,
  "data": [...]
}
```

### DELETE /api/templates/:id

删除指定模板。

### POST /api/templates/smart-fill

使用AI智能填充模板字段。

**请求参数（JSON）**:
```json
{
  "templateId": "1234567890",
  "pptContent": {
    "slides": [...],
    "totalSlides": 10,
    "metadata": {...}
  }
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "课程目标": "根据PPT内容AI生成的内容",
    "教学重点": "根据PPT内容AI生成的内容",
    ...
  }
}
```

### POST /api/templates/generate

填充模板并生成Word文档。

**请求参数（JSON）**:
```json
{
  "templateId": "1234567890",
  "data": {
    "课程目标": "...",
    "教学重点": "...",
    "教学难点": "..."
  }
}
```

**响应**: Word文档文件流（application/vnd.openxmlformats-officedocument.wordprocessingml.document）

## 注意事项

- 仅支持 `.pptx` 格式的PPT文件（不支持旧版.ppt格式）
- 仅支持 `.docx` 格式的Word文件（不支持旧版.doc格式）
- 提取的PPT内容完全保留原始文字，不做任何修改
- 模板占位符格式为 `{字段名}`，必须严格使用单花括号
- AI智能填充需要配置OpenAI API密钥
- 建议使用Chrome或Edge浏览器以获得最佳体验

## 部署到 Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Happier-X/lesson-plan-editor)

### 步骤

1. **点击上面的按钮** 或访问 [Vercel](https://vercel.com)
2. **导入 Git 仓库**：连接你的 GitHub 账号并选择此仓库
3. **配置环境变量**（必需）：
   ```
   # OpenAI API 配置
   NUXT_PUBLIC_OPENAI_API_KEY=你的API密钥
   NUXT_PUBLIC_OPENAI_BASE_URL=https://api.openai.com/v1
   NUXT_PUBLIC_OPENAI_MODEL=gpt-4o-mini

   # Vercel Blob 存储（自动配置）
   BLOB_READ_WRITE_TOKEN=（Vercel 自动生成）
   ```
4. **启用 Vercel Blob**：
   - 在 Vercel 项目设置中，进入 Storage 选项卡
   - 点击 "Create Database" → 选择 "Blob"
   - Vercel 会自动配置 `BLOB_READ_WRITE_TOKEN` 环境变量
5. **部署**：点击 Deploy 按钮，等待构建完成

### 存储说明

- **本地开发**：模板文件保存在 `.templates/` 目录（文件系统）
- **Vercel 部署**：模板文件保存在 Vercel Blob 存储（对象存储）
- 代码会自动检测环境并使用对应的存储方式

### 注意事项

- 确保使用支持视觉的模型（gpt-4o、gpt-4o-mini）
- Vercel Blob 免费版提供 500MB 存储空间
- 部署后可以在 Vercel 控制台查看日志和修改环境变量

## License

MIT
