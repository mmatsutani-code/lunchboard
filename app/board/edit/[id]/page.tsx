'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'

const GENRES = ['和食', 'イタリアン', 'フレンチ', '中華', 'タイ料理', 'ベトナム料理', 'カレー', '中東料理', 'お茶・カフェ', 'その他']

export default function EditPostPage() {
  const [date, setDate] = useState('')
  const [time, setTime] = useState('12:00')
  const [shop, setShop] = useState('')
  const [shopUrl, setShopUrl] = useState('')
  const [genre, setGenre] = useState('')
  const [slots, setSlots] = useState('4')
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const supabase = createClient()
  const router = useRouter()
  const { id } = useParams()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data } = await supabase.from('posts').select('*').eq('id', id).single()
      if (!data || data.user_id !== user.id) { router.push('/board'); return }
      setDate(data.date)
      setTime(data.time)
      setShop(data.shop)
      setShopUrl(data.shop_url || '')
      setGenre(data.genre || '')
      setSlots(String(data.slots))
      setComment(data.comment || '')
      setLoading(false)
    }
    load()
  }, [])

  async function handleSave() {
    setSaving(true)
    await supabase.from('posts').update({
      date, time, shop, shop_url: shopUrl, genre, slots: parseInt(slots), comment
    }).eq('id', id)
    router.push('/board')
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center">読み込み中...</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600">‹ 戻る</button>
          <h1 className="font-semibold text-lg">募集を編集する</h1>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm space-y-4">
          <div>
            <label className="text-sm text-gray-500 mb-1 block">日付</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full border rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
          </div>
          <div>
            <label className="text-sm text-gray-500 mb-1 block">時間</label>
            <select value={time} onChange={e => setTime(e.target.value)}
              className="w-full border rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400">
              <option>11:30</option>
              <option>12:00</option>
              <option>12:30</option>
              <option>13:00</option>
            </select>
          </div>
          <div>
            <label className="text-sm text-gray-500 mb-1 block">料理ジャンル</label>
            <div className="flex flex-wrap gap-2">
              {GENRES.map(g => (
                <button key={g} onClick={() => setGenre(g)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${genre === g ? 'bg-green-500 text-white border-green-500' : 'border-gray-200 text-gray-500 hover:border-green-300'}`}>
                  {g}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm text-gray-500 mb-1 block">お店・場所</label>
            <input type="text" value={shop} onChange={e => setShop(e.target.value)}
              className="w-full border rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
          </div>
          <div>
            <label className="text-sm text-gray-500 mb-1 block">お店情報（任意）</label>
            <input type="url" value={shopUrl} onChange={e => setShopUrl(e.target.value)}
              className="w-full border rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
          </div>
          <div>
            <label className="text-sm text-gray-500 mb-1 block">募集人数（自分含む）</label>
            <select value={slots} onChange={e => setSlots(e.target.value)}
              className="w-full border rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400">
              <option value="2">2人</option>
              <option value="3">3人</option>
              <option value="4">4人</option>
              <option value="5">5人</option>
            </select>
          </div>
          <div>
            <label className="text-sm text-gray-500 mb-1 block">コメント（任意）</label>
            <textarea value={comment} onChange={e => setComment(e.target.value)}
              className="w-full border rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 resize-none h-20" />
          </div>
          <button onClick={handleSave} disabled={saving || !date || !shop}
            className="w-full bg-green-500 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-green-600 disabled:opacity-50">
            {saving ? '保存中...' : '保存する'}
          </button>
        </div>
      </div>
    </div>
  )
}