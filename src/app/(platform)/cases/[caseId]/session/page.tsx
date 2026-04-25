'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, X, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ChatContainer } from '@/components/conversation/chat-container'
import type { ClinicalCase, Conversation, Message } from '@/lib/types'
import casesData from '@/mock-data/cases.json'
import conversationsData from '@/mock-data/conversations.json'

// Mock AI responses for demo — keyed by rough message count to simulate progression
const mockResponses: Record<number, { role: Message['role']; content: string; stage: number }> = {
  1: {
    role: 'patient',
    content:
      'It\'s mainly my right eye, doctor. When I close my left eye and look at the clock on the wall, the numbers in the center look smudged and dark. With my left eye it\'s mostly fine. No pain at all.',
    stage: 1,
  },
  2: {
    role: 'mentor',
    content:
      'Good start. You\'ve identified key features: metamorphopsia, central scotoma, unilateral, painless vision loss with family history. Now, let\'s examine the fundus. What do you observe in this clinical image?',
    stage: 2,
  },
  3: {
    role: 'mentor',
    content:
      'Solid observation skills. You\'ve noted the subfoveal lesion and surrounding changes. Now, based on this 62-year-old woman with drusen, CNV, and painless central vision loss — what is your differential diagnosis, and why?',
    stage: 3,
  },
  4: {
    role: 'mentor',
    content:
      'Well-reasoned differential. You\'ve correctly prioritized wet AMD. Now, what investigations would you order to confirm the diagnosis and guide treatment?',
    stage: 4,
  },
  5: {
    role: 'mentor',
    content:
      'Excellent clinical plan. Let\'s reflect on this case. Mrs. Reddy asked you at the start: "Am I going blind?" How would you answer her now, and what has this case taught you about the doctor-patient relationship?',
    stage: 5,
  },
}

function createNewConversation(caseId: string): Conversation {
  const caseInfo = (casesData as unknown as ClinicalCase[]).find((c) => c.id === caseId)
  const patientName = caseInfo?.patientName || 'the patient'
  const patientAge = caseInfo?.patientAge || '62'

  return {
    id: `conv-new-${Date.now()}`,
    caseId,
    learnerId: 'usr-001',
    status: 'active',
    currentStage: 1,
    startedAt: new Date().toISOString(),
    messages: [
      {
        id: `msg-${Date.now()}-0`,
        role: 'patient',
        content: `I'm ${patientName}, ${patientAge} years old. Doctor, I'm very worried. Since two weeks the words in my newspaper look wavy, like they're underwater. Straight lines on the door frame appear bent. My mother went completely blind at my age from some eye disease. I live alone and I do all my own cooking and puja. Am I going blind, doctor?`,
        timestamp: new Date().toISOString(),
        stage: 1,
      },
    ],
  }
}

export default function SessionPage() {
  const params = useParams<{ caseId: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const isReview = searchParams.get('review') === 'true'

  const [caseData, setCaseData] = useState<ClinicalCase | null>(null)
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [isThinking, setIsThinking] = useState(false)
  const [responseCount, setResponseCount] = useState(0)

  useEffect(() => {
    const found = (casesData as unknown as ClinicalCase[]).find((c) => c.id === params.caseId)
    setCaseData(found || null)

    if (isReview) {
      // Load existing completed conversation
      const existing = (conversationsData as unknown as Conversation[]).find(
        (c) => c.caseId === params.caseId && c.status === 'completed'
      )
      if (existing) {
        setConversation(existing)
      } else {
        setConversation(createNewConversation(params.caseId))
      }
    } else {
      // Start a new conversation with the first patient message
      setConversation(createNewConversation(params.caseId))
    }
  }, [params.caseId, isReview])

  const handleSendMessage = useCallback(
    (content: string) => {
      if (!conversation || conversation.status === 'completed') return

      const learnerMsg: Message = {
        id: `msg-${Date.now()}-l`,
        role: 'learner',
        content,
        timestamp: new Date().toISOString(),
        stage: conversation.currentStage,
      }

      setConversation((prev) => {
        if (!prev) return prev
        return { ...prev, messages: [...prev.messages, learnerMsg] }
      })

      setIsThinking(true)
      const nextCount = responseCount + 1
      setResponseCount(nextCount)

      // Simulate AI response after delay
      setTimeout(() => {
        const mockResp = mockResponses[nextCount] || {
          role: 'mentor' as const,
          content:
            'That\'s a thoughtful response. Let\'s continue exploring this case. Can you elaborate on your reasoning?',
          stage: Math.min(nextCount, 5),
        }

        const aiMsg: Message = {
          id: `msg-${Date.now()}-ai`,
          role: mockResp.role,
          content: mockResp.content,
          timestamp: new Date().toISOString(),
          stage: mockResp.stage,
        }

        setConversation((prev) => {
          if (!prev) return prev
          return {
            ...prev,
            messages: [...prev.messages, aiMsg],
            currentStage: mockResp.stage,
          }
        })
        setIsThinking(false)
      }, 1500)
    },
    [conversation, responseCount]
  )

  if (!caseData || !conversation) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          Loading case...
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Top bar */}
      <div className="flex shrink-0 items-center justify-between border-b bg-card px-4 py-2.5 shadow-sm">
        <div className="flex items-center gap-3">
          <Link
            href={`/cases/${caseData.id}`}
            className="flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div className="h-6 w-px bg-border" />
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold text-foreground">
              {caseData.title}
            </h1>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <User className="size-3" />
              <span>{caseData.patientName}</span>
              {isReview && (
                <span className="ml-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                  REVIEW MODE
                </span>
              )}
            </div>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground hover:text-destructive"
          onClick={() => router.push(`/cases/${caseData.id}`)}
        >
          <X className="size-4" />
          <span className="hidden sm:inline">End Session</span>
        </Button>
      </div>

      {/* Chat container fills the rest */}
      <div className="flex-1 overflow-hidden">
        <ChatContainer
          conversation={conversation}
          onSendMessage={handleSendMessage}
          isThinking={isThinking}
        />
      </div>
    </div>
  )
}
