'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Calendar, ChevronLeft, ChevronRight, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const DAYS_SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function parseValue(val: string) {
  if (!val) return null
  const [datePart, timePart] = val.split('T')
  if (!datePart || !timePart) return null
  const [year, month, day] = datePart.split('-').map(Number)
  const [hour, minute] = timePart.split(':').map(Number)
  if (!year || !month || !day) return null
  return { year, month, day, hour: hour ?? 0, minute: minute ?? 0 }
}

function formatValue(year: number, month: number, day: number, hour: number, minute: number) {
  return [
    `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    `T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
  ].join('')
}

function formatDisplay(val: string) {
  const p = parseValue(val)
  if (!p) return null
  const date = new Date(p.year, p.month - 1, p.day, p.hour, p.minute)
  return {
    date: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
    time: date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
  }
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}

function getFirstDay(year: number, month: number) {
  return new Date(year, month - 1, 1).getDay()
}

interface DateTimePickerProps {
  label: string
  required?: boolean
  value: string
  onChange: (v: string) => void
}

type View = 'calendar' | 'year' | 'month'

export function DateTimePicker({ label, required, value, onChange }: DateTimePickerProps) {
  const now = new Date()
  const parsed = parseValue(value)

  const [open, setOpen] = useState(false)
  const [view, setView] = useState<View>('calendar')
  const [viewYear, setViewYear] = useState(parsed?.year ?? now.getFullYear())
  const [viewMonth, setViewMonth] = useState(parsed?.month ?? now.getMonth() + 1)
  const [selYear, setSelYear] = useState(parsed?.year ?? now.getFullYear())
  const [selMonth, setSelMonth] = useState(parsed?.month ?? now.getMonth() + 1)
  const [selDay, setSelDay] = useState(parsed?.day ?? 0)
  const [hour, setHour] = useState(parsed?.hour ?? 9)
  const [minute, setMinute] = useState(parsed?.minute ?? 0)
  const [ampm, setAmpm] = useState<'AM' | 'PM'>(parsed ? (parsed.hour >= 12 ? 'PM' : 'AM') : 'AM')
  const [monthDir, setMonthDir] = useState(1)

  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0, width: 0 })
  // Mounted-after-hydration flag so the portal only renders client-side.
  // The setState in effect is intentional to avoid SSR hydration mismatch.
  const [mounted, setMounted] = useState(false)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (
        buttonRef.current?.contains(e.target as Node) ||
        panelRef.current?.contains(e.target as Node)
      ) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const openPicker = useCallback(() => {
    if (buttonRef.current) {
      const r = buttonRef.current.getBoundingClientRect()
      const panelWidth = 360
      const left = Math.min(r.left, window.innerWidth - panelWidth - 8)
      setPanelPos({ top: r.bottom + 8, left: Math.max(8, left), width: r.width })
    }
    setOpen((v) => !v)
  }, [])

  const commit = useCallback(
    (y: number, mo: number, d: number, h: number, mi: number, ap: 'AM' | 'PM') => {
      let h24 = h
      if (ap === 'AM' && h === 12) h24 = 0
      else if (ap === 'PM' && h !== 12) h24 = h + 12
      onChange(formatValue(y, mo, d, h24, mi))
    },
    [onChange]
  )

  const selectDay = useCallback(
    (day: number) => {
      setSelYear(viewYear)
      setSelMonth(viewMonth)
      setSelDay(day)
      commit(viewYear, viewMonth, day, hour, minute, ampm)
    },
    [viewYear, viewMonth, hour, minute, ampm, commit]
  )

  const changeHour = (h: number) => {
    const clamped = Math.min(12, Math.max(1, h))
    setHour(clamped)
    if (selDay) commit(selYear, selMonth, selDay, clamped, minute, ampm)
  }

  const changeMinute = (m: number) => {
    const clamped = Math.min(59, Math.max(0, m))
    setMinute(clamped)
    if (selDay) commit(selYear, selMonth, selDay, hour, clamped, ampm)
  }

  const toggleAmpm = (v: 'AM' | 'PM') => {
    setAmpm(v)
    if (selDay) commit(selYear, selMonth, selDay, hour, minute, v)
  }

  const prevMonth = () => {
    setMonthDir(-1)
    if (viewMonth === 1) { setViewMonth(12); setViewYear((y) => y - 1) }
    else setViewMonth((m) => m - 1)
    setView('calendar')
  }

  const nextMonth = () => {
    setMonthDir(1)
    if (viewMonth === 12) { setViewMonth(1); setViewYear((y) => y + 1) }
    else setViewMonth((m) => m + 1)
    setView('calendar')
  }

  const firstDay = getFirstDay(viewYear, viewMonth)
  const daysInMonth = getDaysInMonth(viewYear, viewMonth)
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const isSelected = (d: number) => d === selDay && viewYear === selYear && viewMonth === selMonth
  const isToday = (d: number) =>
    d === now.getDate() && viewYear === now.getFullYear() && viewMonth === now.getMonth() + 1

  const yearRange = Array.from({ length: 12 }, (_, i) => now.getFullYear() - 3 + i)
  const display = formatDisplay(value)

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-1 text-sm font-semibold text-foreground">
        {label}
        {required && <span className="text-destructive">*</span>}
      </label>

      <button
        ref={buttonRef}
        type="button"
        onClick={openPicker}
        className={cn(
          'flex w-full items-center gap-2.5 rounded-xl border-2 bg-card px-3.5 py-2.5 text-sm transition-all text-left',
          open
            ? 'border-primary shadow-[0_0_0_4px_oklch(0.45_0.15_165/0.12)]'
            : 'border-input hover:border-primary/40',
          !value && 'text-muted-foreground'
        )}
      >
        <Calendar className="size-4 shrink-0 text-muted-foreground" />
        {display ? (
          <span className="flex flex-1 items-center gap-2 font-medium text-foreground">
            <span>{display.date}</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-primary">{display.time}</span>
          </span>
        ) : (
          <span className="flex-1">{`Pick ${label.toLowerCase()} date & time`}</span>
        )}
        <Clock className="size-4 shrink-0 text-muted-foreground" />
      </button>

      {mounted &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                ref={panelRef}
                initial={{ opacity: 0, y: -8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.96 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                style={{ top: panelPos.top, left: panelPos.left, width: 360 }}
                className="fixed z-9999 max-w-[calc(100vw-16px)] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-black/20"
              >
                {/* Header strip */}
                <div className="bg-linear-to-r from-teal-500/10 via-blue-500/5 to-transparent px-4 py-3 flex items-center justify-between border-b border-border">
                  {view === 'year' ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setView('calendar')}
                        className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <ChevronLeft className="size-3.5" /> Back
                      </button>
                      <span className="text-sm font-bold text-foreground">Select year</span>
                      <span className="w-10" />
                    </>
                  ) : view === 'month' ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setView('calendar')}
                        className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <ChevronLeft className="size-3.5" /> Back
                      </button>
                      <span className="text-sm font-bold text-foreground">Select month · {viewYear}</span>
                      <span className="w-10" />
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={prevMonth}
                        className="flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                      >
                        <ChevronLeft className="size-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setView('year')}
                        className="group flex items-center gap-1 text-sm font-bold text-foreground hover:text-primary transition-colors"
                      >
                        <span>{MONTHS[viewMonth - 1]}</span>
                        <span className="text-muted-foreground group-hover:text-primary">{viewYear}</span>
                      </button>
                      <button
                        type="button"
                        onClick={nextMonth}
                        className="flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                      >
                        <ChevronRight className="size-4" />
                      </button>
                    </>
                  )}
                </div>

                {/* Body */}
                <AnimatePresence mode="wait">
                  {view === 'year' ? (
                    <motion.div
                      key="year"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.12 }}
                      className="grid grid-cols-4 gap-1.5 p-3 max-h-52 overflow-y-auto"
                    >
                      {yearRange.map((y) => (
                        <button
                          key={y}
                          type="button"
                          onClick={() => { setViewYear(y); setView('month') }}
                          className={cn(
                            'rounded-xl py-2 text-sm font-semibold transition-all',
                            viewYear === y
                              ? 'bg-linear-to-br from-teal-500 to-blue-600 text-white shadow-sm'
                              : 'text-foreground hover:bg-accent'
                          )}
                        >
                          {y}
                        </button>
                      ))}
                    </motion.div>
                  ) : view === 'month' ? (
                    <motion.div
                      key="month"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.12 }}
                      className="grid grid-cols-3 gap-1.5 p-3"
                    >
                      {MONTHS.map((m, i) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => { setViewMonth(i + 1); setView('calendar') }}
                          className={cn(
                            'rounded-xl py-2 text-xs font-semibold transition-all',
                            viewMonth === i + 1 && viewYear === selYear
                              ? 'bg-linear-to-br from-teal-500 to-blue-600 text-white shadow-sm'
                              : 'text-foreground hover:bg-accent'
                          )}
                        >
                          {m.slice(0, 3)}
                        </button>
                      ))}
                    </motion.div>
                  ) : (
                    <motion.div
                      key={`${viewYear}-${viewMonth}`}
                      initial={{ opacity: 0, x: monthDir * 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: monthDir * -20 }}
                      transition={{ duration: 0.12 }}
                      className="p-3"
                    >
                      {/* Day headers */}
                      <div className="grid grid-cols-7 mb-1">
                        {DAYS_SHORT.map((d) => (
                          <div key={d} className="flex h-7 items-center justify-center text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                            {d}
                          </div>
                        ))}
                      </div>
                      {/* Date grid */}
                      <div className="grid grid-cols-7 gap-y-0.5">
                        {cells.map((day, i) => (
                          <div key={i} className="flex h-9 items-center justify-center">
                            {day !== null && (
                              <button
                                type="button"
                                onClick={() => selectDay(day)}
                                className={cn(
                                  'size-8 rounded-xl text-sm font-medium transition-all',
                                  isSelected(day)
                                    ? 'bg-linear-to-br from-teal-500 to-blue-600 text-white shadow-md shadow-teal-500/30 scale-105'
                                    : 'hover:bg-accent text-foreground',
                                  isToday(day) && !isSelected(day)
                                    ? 'ring-2 ring-teal-400/60 font-bold text-teal-600'
                                    : ''
                                )}
                              >
                                {day}
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Time picker */}
                <div className="border-t border-border bg-muted/30 px-4 py-3">
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    <Clock className="size-3" /> Time
                  </p>
                  <div className="flex items-center gap-1.5">
                    <div className="flex items-center rounded-xl border border-input bg-card px-0.5 py-0.5">
                      <button
                        type="button"
                        onClick={() => changeHour(hour - 1 < 1 ? 12 : hour - 1)}
                        className="flex size-6 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                      >
                        <ChevronLeft className="size-3.5" />
                      </button>
                      <input
                        type="number"
                        min={1}
                        max={12}
                        value={String(hour).padStart(2, '0')}
                        onChange={(e) => changeHour(Number(e.target.value))}
                        className="w-8 bg-transparent text-center text-sm font-bold outline-none text-foreground"
                      />
                      <button
                        type="button"
                        onClick={() => changeHour(hour + 1 > 12 ? 1 : hour + 1)}
                        className="flex size-6 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                      >
                        <ChevronRight className="size-3.5" />
                      </button>
                    </div>
                    <span className="text-base font-bold text-muted-foreground">:</span>
                    <div className="flex items-center rounded-xl border border-input bg-card px-0.5 py-0.5">
                      <button
                        type="button"
                        onClick={() => changeMinute(minute - 5 < 0 ? 55 : Math.floor((minute - 1) / 5) * 5)}
                        className="flex size-6 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                      >
                        <ChevronLeft className="size-3.5" />
                      </button>
                      <input
                        type="number"
                        min={0}
                        max={59}
                        value={String(minute).padStart(2, '0')}
                        onChange={(e) => changeMinute(Number(e.target.value))}
                        className="w-8 bg-transparent text-center text-sm font-bold outline-none text-foreground"
                      />
                      <button
                        type="button"
                        onClick={() => changeMinute(minute + 5 > 59 ? 0 : Math.ceil((minute + 1) / 5) * 5)}
                        className="flex size-6 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                      >
                        <ChevronRight className="size-3.5" />
                      </button>
                    </div>
                    <div className="ml-auto flex shrink-0 rounded-xl border border-input bg-card p-0.5 gap-0.5">
                      {(['AM', 'PM'] as const).map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => toggleAmpm(v)}
                          className={cn(
                            'rounded-lg px-2 py-1 text-xs font-bold transition-all min-w-9',
                            ampm === v
                              ? 'bg-linear-to-br from-teal-500 to-blue-600 text-white shadow-sm'
                              : 'text-muted-foreground hover:text-foreground'
                          )}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Confirm */}
                <div className="px-4 pb-4 pt-2">
                  <button
                    type="button"
                    disabled={!selDay}
                    onClick={() => setOpen(false)}
                    className={cn(
                      'w-full rounded-xl py-2.5 text-sm font-bold transition-all',
                      selDay
                        ? 'bg-linear-to-r from-teal-500 to-blue-600 text-white shadow-md shadow-teal-500/20 hover:opacity-90'
                        : 'bg-muted text-muted-foreground cursor-not-allowed'
                    )}
                  >
                    {selDay ? `Confirm — ${display?.date ?? ''}` : 'Select a date first'}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  )
}
