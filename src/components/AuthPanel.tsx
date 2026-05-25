import { useState } from 'react'
import { LogIn, LogOut, UserPlus } from 'lucide-react'

interface AuthPanelProps {
  email: string | undefined
  isConfigured: boolean
  isBusy: boolean
  message: string
  onSignIn: (email: string, password: string) => Promise<void>
  onSignUp: (email: string, password: string) => Promise<void>
  onSignOut: () => Promise<void>
}

export function AuthPanel({ email, isConfigured, isBusy, message, onSignIn, onSignUp, onSignOut }: AuthPanelProps) {
  const [formEmail, setFormEmail] = useState('')
  const [password, setPassword] = useState('')
  const [localMessage, setLocalMessage] = useState<string>()

  async function runAuth(action: 'signin' | 'signup') {
    setLocalMessage(undefined)
    try {
      if (action === 'signin') {
        await onSignIn(formEmail.trim(), password)
      } else {
        await onSignUp(formEmail.trim(), password)
      }
      setPassword('')
    } catch (error) {
      setLocalMessage(error instanceof Error ? error.message : '认证失败')
    }
  }

  if (!isConfigured) {
    return (
      <section className="auth-panel" aria-label="Cloud account">
        <strong>云端保存未配置</strong>
        <span>补充 Supabase 环境变量后可启用登录和素材库同步。</span>
      </section>
    )
  }

  if (email) {
    return (
      <section className="auth-panel is-signed-in" aria-label="Cloud account">
        <div>
          <strong>{email}</strong>
          <span>{message}</span>
        </div>
        <button type="button" className="text-button auth-button" onClick={() => void onSignOut()} disabled={isBusy}>
          <LogOut size={15} />
          退出
        </button>
      </section>
    )
  }

  return (
    <section className="auth-panel" aria-label="Cloud account">
      <div>
        <strong>登录后自动保存</strong>
        <span>{localMessage ?? message}</span>
      </div>
      <div className="auth-fields">
        <input
          aria-label="邮箱"
          type="email"
          placeholder="email@example.com"
          value={formEmail}
          onChange={(event) => setFormEmail(event.target.value)}
        />
        <input
          aria-label="密码"
          type="password"
          placeholder="至少 6 位密码"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>
      <div className="auth-actions">
        <button type="button" className="text-button auth-button" onClick={() => void runAuth('signin')} disabled={isBusy}>
          <LogIn size={15} />
          登录
        </button>
        <button type="button" className="text-button auth-button" onClick={() => void runAuth('signup')} disabled={isBusy}>
          <UserPlus size={15} />
          注册
        </button>
      </div>
    </section>
  )
}
