import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Session } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import type { GameAsset } from './types'

const mocks = vi.hoisted(() => ({
  currentSession: null as Session | null,
  generateOpenAiAssets: vi.fn(),
  listCloudAssets: vi.fn(),
  saveGeneratedAssets: vi.fn(),
  updateCloudFavorite: vi.fn(),
  unsubscribe: vi.fn(),
}))

vi.mock('./services/apiGeneration', () => ({
  generateOpenAiAssets: mocks.generateOpenAiAssets,
}))

vi.mock('./services/cloudLibrary', () => ({
  listCloudAssets: mocks.listCloudAssets,
  saveGeneratedAssets: mocks.saveGeneratedAssets,
  updateCloudFavorite: mocks.updateCloudFavorite,
}))

vi.mock('./services/supabaseClient', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: mocks.currentSession } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: mocks.unsubscribe } } })),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
    },
  },
}))

const generatedAsset: GameAsset = {
  id: 'seedream-test-1',
  name: '道具-绿色治疗药水瓶-1',
  categoryId: 'character',
  prompt: '绿色治疗药水瓶，清晰轮廓，禁止文字',
  styleId: 'pixel',
  paletteId: 'forest',
  size: '128x128',
  frameCount: 1,
  seed: 'guest-test',
  imageSrc: 'data:image/png;base64,iVBORw0KGgo=',
  frames: ['data:image/png;base64,iVBORw0KGgo='],
  createdAt: '2026-08-03T00:00:00.000Z',
  source: 'seedream',
  tags: ['道具', '像素风', '森林', '1 frames'],
  favorite: false,
  usage: 'Generated test asset',
}

const signedInSession = {
  access_token: 'test-access-token',
  refresh_token: 'test-refresh-token',
  expires_in: 3600,
  token_type: 'bearer',
  user: { id: 'test-user', email: 'tester@example.com' },
} as Session

describe('guest generation workflow', () => {
  beforeEach(() => {
    mocks.currentSession = null
    mocks.generateOpenAiAssets.mockReset()
    mocks.listCloudAssets.mockReset().mockResolvedValue([])
    mocks.saveGeneratedAssets.mockReset()
    mocks.updateCloudFavorite.mockReset()
    mocks.unsubscribe.mockReset()
  })

  it('allows a guest to generate without calling cloud persistence', async () => {
    mocks.currentSession = null
    mocks.generateOpenAiAssets.mockResolvedValue({ assets: [generatedAsset] })

    render(<App />)
    const generateButton = await screen.findByRole('button', { name: '生成素材' })
    await waitFor(() => expect(generateButton).toBeEnabled())

    await userEvent.click(generateButton)

    expect((await screen.findAllByText(generatedAsset.name)).length).toBeGreaterThan(0)
    expect(mocks.generateOpenAiAssets).toHaveBeenCalledTimes(1)
    expect(mocks.saveGeneratedAssets).not.toHaveBeenCalled()
  })

  it('preserves generated assets when cloud persistence fails', async () => {
    mocks.currentSession = signedInSession
    mocks.listCloudAssets.mockResolvedValue([])
    mocks.generateOpenAiAssets.mockResolvedValue({ assets: [generatedAsset] })
    mocks.saveGeneratedAssets.mockRejectedValue(new Error('Storage offline'))

    render(<App />)
    await userEvent.click(await screen.findByRole('button', { name: '生成素材' }))

    expect((await screen.findAllByText(generatedAsset.name)).length).toBeGreaterThan(0)
    expect(await screen.findByText(/生成成功，但云端保存失败/)).toBeInTheDocument()
  })
})
