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
    date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    time: date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
  }
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}

function getFirstDay(year: number, month: number) {
  return new Date(year, month - 1, 1).getDay()
}

function dayKey(y: number, mo: number, d: number): number {
  return y * 10000 + mo * 100 + d
}

interface DateTimePickerProps {
  label: string
  required?: boolean
  value: string
  onChange: (v: string) => void
  /**
   * Earliest selectable date+time, in the same `YYYY-MM-DDTHH:mm` local
   * format as `value`. Days strictly before min's day are disabled in the
   * calendar; on min's own day, the confirm button is disabled if the time
   * picker resolves to before min's time.
   */
  min?: string
  /** Compact trigger button — smaller padding for dense forms. */
  compact?: boolean
}

// Panel-height estimate for direction detection. Calendar view
// is the tallest at ~360px after compaction.
const PANEL_H = 360

type View = 'calendar' | 'year' | 'month'

export function DateTimePicker({ label, required, value, onChange, min, compact }: DateTimePickerProps) {
  const now = new Date()
  const parsed = parseValue(value)
  const minParsed = min ? parseValue(min) : null
  const minDayKey = minParsed ? minParsed.year * 10000 + minParsed.month * 100 + minParsed.day : null
  const minTime = minParsed ? minParsed.hour * 60 + minParsed.minute : 0

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
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0, width: 0, openUp: false })
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
      const panelWidth = 300
      const left = Math.min(r.left, window.innerWidth - panelWidth - 8)
      // Open upward only when there's clearly not enough room below AND
      // there's more room above. Otherwise default to opening down.
      const spaceBelow = window.innerHeight - r.bottom - 8
      const spaceAbove = r.top - 8
      const openUp = spaceBelow < PANEL_H && spaceAbove > spaceBelow
      const top = openUp
        ? Math.max(8, r.top - PANEL_H - 8)
        : r.bottom + 8
      setPanelPos({ top, left: Math.max(8, left), width: r.width, openUp })
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
      // Reject taps on disabled days. The grid button is also disabled, but
      // belt-and-suspenders: keyboard / programmatic taps could bypass UI state.
      if (minDayKey !== null && dayKey(viewYear, viewMonth, day) < minDayKey) return
      setSelYear(viewYear)
      setSelMonth(viewMonth)
      setSelDay(day)
      // If we landed on min's own day and the current time is before min's
      // time, snap the time forward so the commit produces a valid value.
      if (minParsed && dayKey(viewYear, viewMonth, day) === minDayKey) {
        const localH24 = ampm === 'AM' ? (hour === 12 ? 0 : hour) : (hour === 12 ? 12 : hour + 12)
        const localTime = localH24 * 60 + minute
        if (localTime < minTime) {
          const snapped12 = minParsed.hour % 12 === 0 ? 12 : minParsed.hour % 12
          const snappedAmpm: 'AM' | 'PM' = minParsed.hour >= 12 ? 'PM' : 'AM'
          setHour(snapped12)
          setMinute(minParsed.minute)
          setAmpm(snappedAmpm)
          commit(viewYear, viewMonth, day, snapped12, minParsed.minute, snappedAmpm)
          return
        }
      }
      commit(viewYear, viewMonth, day, hour, minute, ampm)
    },
    [viewYear, viewMonth, hour, minute, ampm, commit, minDayKey, minParsed, minTime]
  )

  // When `min` advances past the displayed month (e.g. user moves start
  // past end while the End picker is closed), snap the panel forward so a
  // sea of disabled days doesn't greet them when they reopen it. This is a
  // legitimate "external state pulled the view out from under us" sync —
  // the alternative (deriving view from min every render) would defeat
  // the prev/next navigation buttons.
  useEffect(() => {
    if (!minParsed) return
    if (viewYear * 100 + viewMonth < minParsed.year * 100 + minParsed.month) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setViewYear(minParsed.year)
      setViewMonth(minParsed.month)
    }
  }, [minParsed?.year, minParsed?.month, viewYear, viewMonth, minParsed])

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

  const isDayDisabled = (d: number) =>
    minDayKey !== null && dayKey(viewYear, viewMonth, d) < minDayKey
  const isMonthDisabled = (mo: number) =>
    minParsed !== null &&
    (viewYear < minParsed.year || (viewYear === minParsed.year && mo < minParsed.month))
  const isYearDisabled = (y: number) => minParsed !== null && y < minParsed.year
  // Inline warning when picked time is before `min` on min's own day. Disabled
  // days in the grid prevent the day-before-min case from being reachable via
  // the calendar; if it happens via external state the form-level validator
  // (end > start) catches it.
  const selH24 = ampm === 'AM' ? (hour === 12 ? 0 : hour) : (hour === 12 ? 12 : hour + 12)
  const selTime = selH24 * 60 + minute
  const onMinDay =
    minDayKey !== null && selDay > 0 && dayKey(selYear, selMonth, selDay) === minDayKey
  const timeBeforeMin = onMinDay && selTime < minTime

  const yearRange = Array.from({ length: 12 }, (_, i) => now.getFullYear() - 3 + i)
  const display = formatDisplay(value)

  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {label}
        {required && <span className="text-destructive">*</span>}
      </label>

      <button
        ref={buttonRef}
        type="button"
        onClick={openPicker}
        className={cn(
          'group relative flex w-full items-center gap-3 overflow-hidden rounded-2xl border-2 p-3.5 text-left transition-all duration-200',
          open
            ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10'
            : value
              ? 'border-primary/20 bg-linear-to-br from-primary/5 to-card hover:border-primary/40 hover:shadow-md hover:shadow-primary/8'
              : 'border-dashed border-border/70 bg-card hover:border-primary/40 hover:bg-accent/20',
        )}
      >
        {/* Subtle shine layer when filled */}
        {value && (
          <span className="pointer-events-none absolute inset-0 bg-linear-to-br from-primary/8 via-transparent to-transparent" />
        )}

        {/* Icon container */}
        <span className={cn(
          'relative flex size-10 shrink-0 items-center justify-center rounded-xl transition-all duration-200',
          value
            ? 'bg-primary text-primary-foreground shadow-md shadow-primary/30'
            : 'bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary',
        )}>
          <Calendar className="size-4" />
        </span>

        {/* Text */}
        {display ? (
          <span className="relative flex-1 min-w-0">
            <span className="block text-sm font-semibold leading-tight text-foreground">{display.date}</span>
            <span className="mt-0.5 flex items-center gap-1">
              <Clock className="size-3 text-primary/70" />
              <span className="text-xs font-semibold text-primary tabular-nums">{display.time}</span>
            </span>
          </span>
        ) : (
          <span className="relative flex-1 min-w-0">
            <span className="block text-[13px] font-medium text-muted-foreground">Select date</span>
            <span className="mt-0.5 block text-[11px] text-muted-foreground/50">Tap to pick</span>
          </span>
        )}
      </button>

      {mounted &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                ref={panelRef}
                initial={{ opacity: 0, y: panelPos.openUp ? 8 : -8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: panelPos.openUp ? 8 : -8, scale: 0.96 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                style={{ top: panelPos.top, left: panelPos.left, width: 300 }}
                className="fixed z-9999 max-w-[calc(100vw-16px)] overflow-hidden rounded-xl border border-border bg-card shadow-xl shadow-black/15"
              >
                {/* Header strip */}
                <div className="bg-linear-to-r from-teal-500/10 via-blue-500/5 to-transparent px-3 py-2 flex items-center justify-between border-b border-border">
                  {view === 'year' ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setView('calendar')}
                        className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <ChevronLeft className="size-3" /> Back
                      </button>
                      <span className="text-xs font-bold text-foreground">Select year</span>
                      <span className="w-8" />
                    </>
                  ) : view === 'month' ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setView('calendar')}
                        className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <ChevronLeft className="size-3" /> Back
                      </button>
                      <span className="text-xs font-bold text-foreground">Select month · {viewYear}</span>
                      <span className="w-8" />
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={prevMonth}
                        className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                      >
                        <ChevronLeft className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setView('year')}
                        className="group flex items-center gap-1 text-xs font-bold text-foreground hover:text-primary transition-colors"
                      >
                        <span>{MONTHS[viewMonth - 1]}</span>
                        <span className="text-muted-foreground group-hover:text-primary">{viewYear}</span>
                      </button>
                      <button
                        type="button"
                        onClick={nextMonth}
                        className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                      >
                        <ChevronRight className="size-3.5" />
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
                      className="grid grid-cols-4 gap-1 p-2 max-h-44 overflow-y-auto"
                    >
                      {yearRange.map((y) => {
                        const disabled = isYearDisabled(y)
                        return (
                          <button
                            key={y}
                            type="button"
                            disabled={disabled}
                            onClick={() => { if (disabled) return; setViewYear(y); setView('month') }}
                            className={cn(
                              'rounded-lg py-1.5 text-xs font-semibold transition-all',
                              disabled
                                ? 'cursor-not-allowed text-muted-foreground/40'
                                : viewYear === y
                                  ? 'bg-linear-to-br from-teal-500 to-blue-600 text-white shadow-sm'
                                  : 'text-foreground hover:bg-accent'
                            )}
                          >
                            {y}
                          </button>
                        )
                      })}
                    </motion.div>
                  ) : view === 'month' ? (
                    <motion.div
                      key="month"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.12 }}
                      className="grid grid-cols-3 gap-1 p-2"
                    >
                      {MONTHS.map((m, i) => {
                        const disabled = isMonthDisabled(i + 1)
                        return (
                          <button
                            key={m}
                            type="button"
                            disabled={disabled}
                            onClick={() => { if (disabled) return; setViewMonth(i + 1); setView('calendar') }}
                            className={cn(
                              'rounded-lg py-1.5 text-xs font-semibold transition-all',
                              disabled
                                ? 'cursor-not-allowed text-muted-foreground/40'
                                : viewMonth === i + 1 && viewYear === selYear
                                  ? 'bg-linear-to-br from-teal-500 to-blue-600 text-white shadow-sm'
                                  : 'text-foreground hover:bg-accent'
                            )}
                          >
                            {m.slice(0, 3)}
                          </button>
                        )
                      })}
                    </motion.div>
                  ) : (
                    <motion.div
                      key={`${viewYear}-${viewMonth}`}
                      initial={{ opacity: 0, x: monthDir * 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: monthDir * -20 }}
                      transition={{ duration: 0.12 }}
                      className="p-2"
                    >
                      {/* Day headers */}
                      <div className="grid grid-cols-7 mb-0.5">
                        {DAYS_SHORT.map((d) => (
                          <div key={d} className="flex h-6 items-center justify-center text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                            {d}
                          </div>
                        ))}
                      </div>
                      {/* Date grid */}
                      <div className="grid grid-cols-7 gap-y-0">
                        {cells.map((day, i) => {
                          const disabled = day !== null && isDayDisabled(day)
                          return (
                            <div key={i} className="flex h-7 items-center justify-center">
                              {day !== null && (
                                <button
                                  type="button"
                                  disabled={disabled}
                                  onClick={() => selectDay(day)}
                                  className={cn(
                                    'size-7 rounded-lg text-xs font-medium transition-all',
                                    disabled
                                      ? 'cursor-not-allowed text-muted-foreground/35 line-through decoration-1'
                                      : isSelected(day)
                                        ? 'bg-linear-to-br from-teal-500 to-blue-600 text-white shadow-md shadow-teal-500/30 scale-105'
                                        : 'hover:bg-accent text-foreground',
                                    !disabled && isToday(day) && !isSelected(day)
                                      ? 'ring-2 ring-teal-400/60 font-bold text-teal-600'
                                      : ''
                                  )}
                                >
                                  {day}
                                </button>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Time picker — values auto-commit; click outside closes the panel.
                    Spinner controls are hidden so the box stays clean; users edit by
                    typing or by tapping AM/PM. Tailwind arbitrary CSS handles the
                    cross-browser spinner suppression inline. */}
                <div className="border-t border-border bg-muted/30 px-3 py-3">
                  <p className="mb-2 flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    <Clock className="size-3" /> Time
                  </p>
                  <div className="flex items-stretch gap-2">
                    <div className="flex h-10 flex-1 items-center justify-center rounded-lg border border-input bg-card focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15 transition-colors">
                      <input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={12}
                        value={String(hour).padStart(2, '0')}
                        onChange={(e) => changeHour(Number(e.target.value))}
                        aria-label="Hour"
                        className="w-10 bg-transparent text-center text-base font-bold tabular-nums text-foreground outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none"
                      />
                      <span className="text-base font-bold text-muted-foreground/60 select-none">:</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={59}
                        step={5}
                        value={String(minute).padStart(2, '0')}
                        onChange={(e) => changeMinute(Number(e.target.value))}
                        aria-label="Minute"
                        className="w-10 bg-transparent text-center text-base font-bold tabular-nums text-foreground outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none"
                      />
                    </div>
                    <div className="flex h-10 shrink-0 items-center rounded-lg border border-input bg-card p-0.5">
                      {(['AM', 'PM'] as const).map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => toggleAmpm(v)}
                          aria-pressed={ampm === v}
                          className={cn(
                            'flex h-full items-center rounded-md px-3 text-xs font-bold transition-all',
                            ampm === v
                              ? 'bg-primary text-primary-foreground shadow-sm'
                              : 'text-muted-foreground hover:text-foreground'
                          )}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                  {timeBeforeMin && minParsed && (
                    <p className="mt-2 flex items-center gap-1 text-[10px] font-medium text-amber-600">
                      Earliest allowed:{' '}
                      {new Date(
                        minParsed.year,
                        minParsed.month - 1,
                        minParsed.day,
                        minParsed.hour,
                        minParsed.minute
                      ).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  )
}
