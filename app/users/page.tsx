'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Photo = {
  id: string
  photo_url: string
  order_index: number
}

type Profile = {
  id: string
  name: string
  nickname: string
  bio: string
  age_group: string
  gender: string
  avatar_url: string
  photos?: Photo[]
  activePost?: { id: string; date: string; shop: string } | null
  reviewAvg?: number | null
  reviewCount?: number
}

type Review = {
  id: string
  reviewer_id: string
  rating: 1 | 2 | 3
  comment: string
  created_at: string
  profiles: { name: string; nickname: string; avatar_url: string }
}

const RATINGS = [
  { value: 1, emoji: '😞', label: '悪い' },
  { value: 2, emoji: '😐', label: '普通' },
  { value: 3, emoji: '😊', label: '良い' },
] as const

function seededRandom(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0xffffffff
  }
}

function pickDailyUsers(users: Profile[], count: number): Profile[] {
  if (users.length <= count) return users
  const today = new Date().toISOString().slice(0, 10)
  const seed = today.split('-').reduce((acc, n) => acc * 100 + parseInt(n), 0)
  const rand = seededRandom(seed)
  const shuffled = [...users].sort(() => rand() - 0.5)
  return shuffled.slice(0, count)
}

function formatRelativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'たった今'
  if (mins < 60) return `${mins}分前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}時間前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}日前`
  const months = Math.floor(days / 30)
  return `${months}ヶ月前`
}

export default function UsersPage() {
  const [users, setUsers] = useState<Profile[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null)
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0)
  const [reviews, setReviews] = useState<Review[]>([])
  const [myRating, setMyRating] = useState<1 | 2 | 3 | null>(null)
  const [myComment, setMyComment] = useState('')
  const [reviewLoading, setReviewLoading] = useState(false)
  const [reviewError, setReviewError] = useState('')
  const [showReviewForm, setShowReviewForm] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/login'); return }
      setUserId(data.user.id)
    })
    loadUsers()
  }, [])

  async function loadUsers() {
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
    if (!data) { setLoading(false); return }

    const today = new Date().toISOString().slice(0, 10)
    const [{ data: activePosts }, { data: allReviews }] = await Promise.all([
      supabase.from('posts').select('id, user_id, date, shop').gte('date', today).order('date', { ascending: true }),
      supabase.from('reviews').select('target_id, rating'),
    ])

    const reviewStats: Record<string, { sum: number; count: number }> = {}
    allReviews?.forEach(r => {
      if (!reviewStats[r.target_id]) reviewStats[r.target_id] = { sum: 0, count: 0 }
      reviewStats[r.target_id].sum += r.rating
      reviewStats[r.target_id].count++
    })

    const usersWithData = await Promise.all(data.map(async user => {
      const { data: photos } = await supabase
        .from('profile_photos')
        .select('*')
        .eq('user_id', user.id)
        .order('order_index', { ascending: true })
      const activePost = activePosts?.find(p => p.user_id === user.id) || null
      const stats = reviewStats[user.id]
      return {
        ...user,
        photos: photos || [],
        activePost,
        reviewAvg: stats ? stats.sum / stats.count : null,
        reviewCount: stats?.count || 0,
      }
    }))
    setUsers(usersWithData)
    setLoading(false)
  }

  async function loadReviews(targetId: string) {
    const { data } = await supabase
      .from('reviews')
      .select('*, profiles(name, nickname, avatar_url)')
      .eq('target_id', targetId)
      .order('created_at', { ascending: false })
    setReviews((data as Review[]) || [])
  }

  function openModal(user: Profile) {
    setSelectedUser(user)
    setCurrentPhotoIndex(0)
    setReviews([])
    setMyRating(null)
    setMyComment('')
    setShowReviewForm(false)
    loadReviews(user.id)
  }

  useEffect(() => {
    if (!userId || reviews.length === 0) return
    const mine = reviews.find(r => r.reviewer_id === userId)
    if (mine) {
      setMyRating(mine.rating)
      setMyComment(mine.comment || '')
    }
  }, [reviews, userId])

  async function submitReview() {
    if (!myRating || !selectedUser || !userId) return
    setReviewLoading(true)
    setReviewError('')
    const { error } = await supabase.from('reviews').upsert(
      { reviewer_id: userId, target_id: selectedUser.id, rating: myRating, comment: myComment },
      { onConflict: 'reviewer_id,target_id' }
    )
    if (error) {
      setReviewError(error.message)
      setReviewLoading(false)
      return
    }
    await loadReviews(selectedUser.id)
    setShowReviewForm(false)
    setReviewLoading(false)
    loadUsers()
  }

  async function deleteReview() {
    if (!selectedUser || !userId) return
    const existing = reviews.find(r => r.reviewer_id === userId)
    if (!existing) return
    if (!confirm('口コミを削除しますか？')) return
    setReviewLoading(true)
    await supabase.from('reviews').delete().eq('id', existing.id)
    setMyRating(null)
    setMyComment('')
    setShowReviewForm(false)
    await loadReviews(selectedUser.id)
    setReviewLoading(false)
    loadUsers()
  }

  async function inviteToLunch(targetUserId: string) {
    const { data: room } = await supabase.from('rooms').insert({ post_id: null }).select().single()
    if (!room) return
    await supabase.from('room_members').insert([
      { room_id: room.id, user_id: userId },
      { room_id: room.id, user_id: targetUserId }
    ])
    await supabase.from('messages').insert({
      room_id: room.id, user_id: userId,
      text: `🍜 ランチに誘いました！都合のいい日を相談しましょう`
    })
    setSelectedUser(null)
    router.push(`/messages/${room.id}`)
  }

  const displayName = (u: any) => u?.nickname || u?.name || '?'

  const ratingCounts = RATINGS.map(r => ({
    ...r,
    count: reviews.filter(rv => rv.rating === r.value).length,
  }))

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 to-rose-100">
      <div className="text-4xl animate-bounce">👥</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-rose-50">
      <div className="bg-gradient-to-r from-pink-400 to-rose-400 shadow-lg px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={() => router.push('/board')} className="text-white/80 hover:text-white text-xl">‹</button>
          <h1 className="font-black text-white text-lg">メンバー一覧</h1>
          <span className="text-pink-100 text-sm">{users.length}人</span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5">

        {users.length > 0 && (() => {
          const picks = pickDailyUsers(users.filter(u => u.id !== userId), 3)
          return (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">✨</span>
                <h2 className="font-black text-gray-700">今日のおすすめ</h2>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">毎日更新</span>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {picks.map(user => (
                  <div key={user.id}
                    onClick={() => openModal(user)}
                    className="flex-shrink-0 w-28 cursor-pointer group">
                    <div className="relative w-28 h-28 rounded-2xl overflow-hidden bg-gradient-to-br from-pink-100 to-rose-200 shadow-md group-hover:shadow-lg transition-all">
                      {user.avatar_url ? (
                        <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-pink-400">
                          {(user.nickname || user.name)?.[0] || '?'}
                        </div>
                      )}
                      {user.activePost && (
                        <div className="absolute bottom-1 left-1 right-1 bg-green-500/90 text-white text-[10px] text-center rounded-lg py-0.5 font-bold">
                          🍱 募集中
                        </div>
                      )}
                    </div>
                    <div className="mt-1.5 text-center">
                      <div className="text-xs font-bold text-gray-700 truncate">{user.nickname || user.name}</div>
                      {user.age_group && <div className="text-[10px] text-gray-400">{user.age_group}</div>}
                      {(user.reviewCount || 0) > 0 && user.reviewAvg != null && (
                        <div className="text-[10px] text-gray-500 mt-0.5">
                          {RATINGS.find(r => r.value === Math.round(user.reviewAvg!))?.emoji} {user.reviewCount}件
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })()}

        <div className="grid grid-cols-2 gap-3">
          {users.map(user => {
            const isMe = user.id === userId
            return (
              <div key={user.id}
                onClick={() => openModal(user)}
                className="bg-white rounded-3xl shadow-md overflow-hidden cursor-pointer hover:shadow-lg transition-all transform hover:-translate-y-0.5">
                <div className="relative aspect-square bg-gradient-to-br from-pink-100 to-rose-200">
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-5xl font-bold text-pink-400">
                      {displayName(user)[0]}
                    </div>
                  )}
                  {isMe && (
                    <div className="absolute top-2 left-2 bg-pink-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                      自分
                    </div>
                  )}
                  {user.activePost && (
                    <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full font-bold animate-pulse">
                      🍱 募集中
                    </div>
                  )}
                  {(user.photos?.length || 0) > 0 && (
                    <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full">
                      📷 {(user.photos?.length || 0) + (user.avatar_url ? 1 : 0)}
                    </div>
                  )}
                  {(user.reviewCount || 0) > 0 && user.reviewAvg != null && (
                    <div className="absolute bottom-2 left-2 bg-white/80 backdrop-blur text-xs px-2 py-0.5 rounded-full font-semibold text-gray-700">
                      {RATINGS.find(r => r.value === Math.round(user.reviewAvg!))?.emoji} {user.reviewCount}
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <div className="font-bold text-gray-800 truncate">{displayName(user)}</div>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {user.age_group && <span className="text-xs bg-pink-50 text-pink-500 px-2 py-0.5 rounded-full">{user.age_group}</span>}
                    {user.gender && <span className="text-xs bg-rose-50 text-rose-500 px-2 py-0.5 rounded-full">{user.gender}</span>}
                  </div>
                  {user.bio && <p className="text-xs text-gray-400 mt-1 line-clamp-2">{user.bio}</p>}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {selectedUser && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center p-4"
          onClick={() => setSelectedUser(null)}>
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl max-h-[90vh] flex flex-col"
            onClick={e => e.stopPropagation()}>

            <div className="relative aspect-square bg-gradient-to-br from-pink-100 to-rose-200 flex-shrink-0">
              {(() => {
                const allPhotos = [
                  ...(selectedUser.avatar_url ? [selectedUser.avatar_url] : []),
                  ...(selectedUser.photos?.map(p => p.photo_url) || [])
                ]
                return allPhotos.length > 0 ? (
                  <>
                    <img src={allPhotos[currentPhotoIndex]} alt="" className="w-full h-full object-cover" />
                    {allPhotos.length > 1 && (
                      <>
                        <button onClick={() => setCurrentPhotoIndex(i => Math.max(0, i - 1))}
                          className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/40 text-white rounded-full flex items-center justify-center hover:bg-black/60">‹</button>
                        <button onClick={() => setCurrentPhotoIndex(i => Math.min(allPhotos.length - 1, i + 1))}
                          className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/40 text-white rounded-full flex items-center justify-center hover:bg-black/60">›</button>
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1">
                          {allPhotos.map((_, i) => (
                            <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all ${i === currentPhotoIndex ? 'bg-white scale-125' : 'bg-white/50'}`} />
                          ))}
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-8xl font-bold text-pink-300">
                    {displayName(selectedUser)[0]}
                  </div>
                )
              })()}
              <button onClick={() => setSelectedUser(null)}
                className="absolute top-3 right-3 w-8 h-8 bg-black/40 text-white rounded-full flex items-center justify-center hover:bg-black/60">✕</button>
            </div>

            <div className="overflow-y-auto">
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-black text-xl text-gray-800">{displayName(selectedUser)}</div>
                    <div className="flex gap-2 mt-1">
                      {selectedUser.age_group && <span className="text-xs bg-pink-50 text-pink-500 px-2 py-0.5 rounded-full font-semibold">{selectedUser.age_group}</span>}
                      {selectedUser.gender && <span className="text-xs bg-rose-50 text-rose-500 px-2 py-0.5 rounded-full font-semibold">{selectedUser.gender}</span>}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 items-end">
                    {selectedUser.activePost && (
                      <button onClick={() => { setSelectedUser(null); router.push(`/board?post=${selectedUser.activePost!.id}`) }}
                        className="bg-green-500 text-white px-4 py-2 rounded-2xl font-bold shadow-md hover:shadow-lg transition-all text-sm">
                        🍱 募集を見る
                      </button>
                    )}
                    {selectedUser.id !== userId && (
                      <button onClick={() => inviteToLunch(selectedUser.id)}
                        className="bg-gradient-to-r from-pink-400 to-rose-500 text-white px-4 py-2 rounded-2xl font-bold shadow-md hover:shadow-lg transition-all text-sm">
                        🍜 誘う
                      </button>
                    )}
                  </div>
                </div>
                {selectedUser.bio && (
                  <p className="text-sm text-gray-500 bg-pink-50 rounded-2xl px-4 py-3 mb-4">{selectedUser.bio}</p>
                )}

                <div className="border-t border-gray-100 pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-gray-700">口コミ</span>
                      <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{reviews.length}件</span>
                    </div>
                    {selectedUser.id !== userId && (
                      <div className="flex items-center gap-2">
                        {reviews.find(r => r.reviewer_id === userId) && !showReviewForm && (
                          <button onClick={deleteReview} disabled={reviewLoading}
                            className="text-xs text-red-400 hover:text-red-500 font-semibold disabled:opacity-50">
                            削除
                          </button>
                        )}
                        {!showReviewForm && (
                          <button onClick={() => setShowReviewForm(true)}
                            className="text-xs bg-pink-50 text-pink-500 px-3 py-1.5 rounded-full font-bold hover:bg-pink-100 transition-colors">
                            {reviews.find(r => r.reviewer_id === userId) ? '編集' : '+ 書く'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {reviews.length > 0 && (
                    <div className="mb-4 bg-gray-50 rounded-2xl p-3 space-y-2">
                      {ratingCounts.map(r => {
                        const pct = reviews.length > 0 ? Math.round((r.count / reviews.length) * 100) : 0
                        return (
                          <div key={r.value} className="flex items-center gap-2">
                            <span className="text-lg w-7 text-center">{r.emoji}</span>
                            <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-pink-400 to-rose-400 rounded-full transition-all duration-500"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-500 w-10 text-right font-semibold">{r.count}件</span>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {showReviewForm && (
                    <div className="bg-pink-50 rounded-2xl p-4 mb-4">
                      <p className="text-xs font-bold text-gray-600 mb-2">評価を選んでください</p>
                      <div className="flex gap-2 mb-3">
                        {RATINGS.map(r => (
                          <button key={r.value} onClick={() => setMyRating(r.value)}
                            className={`flex-1 flex flex-col items-center py-2 rounded-xl border-2 transition-all ${myRating === r.value ? 'border-pink-400 bg-white shadow-md scale-105' : 'border-transparent bg-white/60 hover:bg-white'}`}>
                            <span className="text-2xl">{r.emoji}</span>
                            <span className="text-xs text-gray-500 font-semibold">{r.label}</span>
                          </button>
                        ))}
                      </div>
                      <textarea
                        value={myComment}
                        onChange={e => setMyComment(e.target.value)}
                        placeholder="コメントを書く（任意）"
                        rows={2}
                        maxLength={200}
                        className="w-full text-sm border border-pink-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-300 bg-white resize-none mb-1"
                      />
                      <div className="text-right text-[10px] text-gray-400 mb-2">{myComment.length}/200</div>
                      {reviewError && (
                        <p className="text-xs text-red-500 mb-2">{reviewError}</p>
                      )}
                      <div className="flex gap-2">
                        <button onClick={() => { setShowReviewForm(false); setReviewError('') }}
                          className="flex-1 text-sm text-gray-500 bg-white rounded-xl py-2 font-semibold hover:bg-gray-50 transition-colors">
                          キャンセル
                        </button>
                        <button onClick={submitReview} disabled={!myRating || reviewLoading}
                          className="flex-1 text-sm bg-gradient-to-r from-pink-400 to-rose-500 text-white rounded-xl py-2 font-bold disabled:opacity-50 hover:shadow-md transition-all">
                          {reviewLoading ? '送信中...' : '送信'}
                        </button>
                      </div>
                    </div>
                  )}

                  {reviews.length === 0 ? (
                    <p className="text-sm text-center text-gray-300 py-4">まだ口コミがありません</p>
                  ) : (
                    <div className="space-y-3">
                      {reviews.map(review => (
                        <div key={review.id} className="flex gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-100 to-rose-200 flex items-center justify-center text-xs font-bold text-pink-500 flex-shrink-0 overflow-hidden">
                            {review.profiles?.avatar_url
                              ? <img src={review.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                              : (review.profiles?.nickname || review.profiles?.name)?.[0] || '?'}
                          </div>
                          <div className="flex-1 bg-gray-50 rounded-2xl px-3 py-2">
                            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                              <span className="text-xs font-bold text-gray-700">{displayName(review.profiles)}</span>
                              <span className="text-base">{RATINGS.find(r => r.value === review.rating)?.emoji}</span>
                              {review.reviewer_id === userId && (
                                <span className="text-[10px] text-pink-400 font-semibold">自分</span>
                              )}
                              <span className="text-[10px] text-gray-400 ml-auto">{formatRelativeTime(review.created_at)}</span>
                            </div>
                            {review.comment && <p className="text-xs text-gray-500">{review.comment}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}