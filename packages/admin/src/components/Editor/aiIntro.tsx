import { message } from 'antd'
import { BytemdPlugin } from 'bytemd'
import { Brain } from 'lucide-react'
import { renderToStaticMarkup } from 'react-dom/server'

const icon = renderToStaticMarkup(<Brain size={16} />)

async function genIntroFromLLM(content: string): Promise<string | null> {
  try {
    const res = await fetch('/api/admin/ai/intro', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        token: (() => {
          try {
            return window.localStorage.getItem('token') || 'null'
          } catch {
            return 'null'
          }
        })(),
      },
      body: JSON.stringify({ content }),
    })
    const data = await res.json()
    if (!res.ok || data?.statusCode !== 200) {
      const msg = data?.message || 'AI 简介生成失败'
      throw new Error(msg)
    }
    const intro = data?.data?.intro?.trim()
    if (!intro) {
      message.error('AI 未返回内容')
      return null
    }
    return intro
  } catch (err) {
    message.error('AI 简介生成失败')
    return null
  }
}

export function aiIntro(setLoading: (loading: boolean) => void): BytemdPlugin {
  return {
    actions: [
      {
        title: 'AI生成简介',
        icon,
        handler: {
          type: 'action',
          async click(ctx) {
            try {
              setLoading(true)
              const md = (ctx as any)?.editor?.getValue?.() ?? ''
              if (!md) {
                message.warn('当前内容为空')
                return
              }
              const intro = await genIntroFromLLM(md)
              if (!intro) return
              const moreTag = '<!-- more -->'
              const idx = md.indexOf(moreTag)
              let rest = ''
              let next = ''
              if (idx >= 0) {
                rest = md.slice(idx) // 包含 more 及之后内容
                next = `${intro}\n\n${rest}`
              } else {
                next = `${intro}\n\n${moreTag}\n\n${md}`
              }
              ;(ctx as any)?.editor?.setValue?.(next)
              message.success('已生成并插入简介')
            } finally {
              setLoading(false)
            }
          },
        },
      },
    ],
  }
}
