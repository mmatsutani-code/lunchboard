'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Availability = {
  id: string
  user_id: string
  date: string
  profiles: { name: string; nickname: string; avatar_url: string }
}

export default function CalendarPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [myDates, setMyDates] = useState<string[]>([])
  const [allAvailability, setAllAvailability] = useState<Availability[]>([])
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/login'); return }
      setUserId(data.user.id)
      loadData(data.user.id)
    })
  }, [])

  async function loadData(uid: string) {
    const { data } = await supabase
      .from('availability')
      .select('*, profiles(name, nickname, avatar_url)')
    setAllAvailability(data || [])
    setMyDates((data || []).filter((a: Availability) => a.user_id === uid).map((a: Availability) => a.date))
    setLoading(false)
  }

  async function toggleDate(dateStr: string) {
    if (!userId) return
    if (myDates.includes(dateStr)) {
      await supabase.from('availability').delete().eq('user_id', userId).eq('date', dateStr)
      setMyDates(prev => prev.filter(d => d !== dateStr))
      setAllAvailability(prev => prev.filter(a => !(a.user_id === userId && a.date === dateStr)))
    } else {
      const { data } = await supabase.from('availability').insert({ user_id: userId, date: dateStr }).select('*, profiles(name, nickname, avatar_url)').single()
      setMyDates(prev => [...prev, dateStr])
      if (data) setAllAvailability(prev => [...prev, data])
    }
  }

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    return { firstDay, daysInMonth, year, month }
  }

  const { firstDay, daysInMonth, year, month } = getDaysInMonth(currentMonth)
  const todayStr = new Date().toISOString().slice(0, 10)

  const dateStr = (day: number) => {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  const getUsersForDate = (dateStr: string) => {
    return allAvailability.filter(a => a.date === dateStr)
  }

  const displayName = (p: any) => p?.nickname || p?.name || '?'

  if (loading) return <div className="min-h-screen flex items-center justify-center">読み込み中...</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.push('/board')} className="text-gray-400 hover:text-gray-600">‹ 戻る</button>
          <h1 className="font-semibold text-lg">ランチカレンダー</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setCurrentMonth(new Date(year, month - 1, 1))}
              className="p-2 hover:bg-gray-100 rounded-lg text-gray-500">‹</button>
            <span className="font-semibold">{year}年{month + 1}月</span>
            <button onClick={() => setCurrentMonth(new Date(year, month + 1, 1))}
              className="p-2 hover:bg-gray-100 rounded-lg text-gray-500">›</button>
          </div>

          <div className="grid grid-cols-7 mb-2">
            {['日', '月', '火', '水', '木', '金', '土'].map((d, i) => (
              <div key={d} className={`text-center text-xs font-medium py-1 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'}`}>{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDay === 0 ? 0 : firstDay }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const ds = dateStr(day)
              const isToday = ds === todayStr
              const isMyDate = myDates.includes(ds)
              const usersForDate = getUsersForDate(ds)
              const otherUsers = usersForDate.filter(a => a.user_id !== userId)
              const isPast = ds < todayStr
              const dayOfWeek = new Date(ds).getDay()

              return (
                <button key={day} onClick={() => !isPast && toggleDate(ds)} disabled={isPast}
                  className={`relative p-1 rounded-lg min-h-14 flex flex-col items-center transition-colors ${isPast ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-50'} ${isMyDate ? 'bg-green-50 border border-green-300' : 'border border-transparent'} ${isToday ? 'ring-2 ring-green-400' : ''}`}>
                  <span className={`text-xs font-medium mb-1 ${dayOfWeek === 0 ? 'text-red-400' : dayOfWeek === 6 ? 'text-blue-400' : 'text-gray-700'}`}>
                    {day}
                  </span>
                  {isMyDate && <span className="text-xs text-green-600">✓</span>}
                  {otherUsers.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-0.5 mt-0.5">
                      {otherUsers.slice(0, 3).map((u, idx) => (
                        <div key={idx} className="w-4 h-4 rounded-full bg-green-200 flex items-center justify-center text-green-700 overflow-hidden"
                          style={{ fontSize: '8px' }}>
                          {u.profiles?.avatar_url
                            ? <img src={u.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                            : displayName(u.profiles)[0]
                          }
                        </div>
                      ))}
                      {otherUsers.length > 3 && <span style={{ fontSize: '8px' }} className="text-gray-400">+{otherUsers.length - 3}</span>}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <h2 className="font-medium text-sm mb-3 text-gray-700">みんなの空き日程</h2>
          {allAvailability.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">まだ登録がありません</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(
                allAvailability.reduce((acc: any, a) => {
                  if (!acc[a.date]) acc[a.date] = []
                  acc[a.date].push(a)
                  return acc
                }, {})
              ).sort(([a], [b]) => a.localeCompare(b)).map(([date, users]: [string, any]) => {
                const t = new Date(date)
                const fmt = `${t.getMonth()+1}月${t.getDate()}日（${'日月火水木金土'[t.getDay()]}）`
                return (
                  <div key={date} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                    <span className="text-sm text-gray-600 w-32 flex-shrink-0">{fmt}</span>
                    <div className="flex gap-1 flex-wrap">
                      {users.map((u: any, i: number) => (
                        <span key={i} className={`text-xs px-2 py-0.5 rounded-full ${u.user_id === userId ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                          {displayName(u.profiles)}
                        </span>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <p className="text-xs text-gray-400 text-center mt-4">日付をタップして空き日程を登録・解除できます</p>
      </div>
    </div>
  )
}