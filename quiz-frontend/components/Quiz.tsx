'use client';

import { useState, useEffect } from 'react';

// Add custom styles for animations
const styles = `
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes slideIn {
    from { opacity: 0; transform: translateX(-20px); }
    to { opacity: 1; transform: translateX(0); }
  }
  @keyframes scaleIn {
    from { opacity: 0; transform: scale(0.9); }
    to { opacity: 1; transform: scale(1); }
  }
  @keyframes pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.05); }
  }
  @keyframes shimmer {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }
  .animate-fade-in {
    animation: fadeIn 0.5s ease-out;
  }
  .animate-slide-in {
    animation: slideIn 0.4s ease-out;
  }
  .animate-scale-in {
    animation: scaleIn 0.3s ease-out;
  }
  .animate-shimmer {
    animation: shimmer 2s infinite;
  }
`;

if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = styles;
  if (!document.head.querySelector('style[data-quiz-animations]')) {
    styleSheet.setAttribute('data-quiz-animations', 'true');
    document.head.appendChild(styleSheet);
  }
}

type QuizQuestion = {
  question: string;
  options: string[];
  correctAnswer: string;
};

type CodingChallenge = {
  title: string;
  prompt: string;
  language: string;
  starterCode: string;
};

type AssessmentContext = {
  token: string;
  platform: string;
  jobTitle?: string;
  jobDescription?: string;
  skills: string[];
  returnUrl: string;
};

// Seconds allowed for the coding question (~2 minutes)
const CODING_TIME_LIMIT = 120;

// Used only if AI generation fails (offline / API error)
const FALLBACK_CODING: CodingChallenge = {
  title: 'Reverse a String',
  prompt:
    'Write a function reverseString(s) that returns the input string reversed. Example: reverseString("hello") -> "olleh".',
  language: 'javascript',
  starterCode: 'function reverseString(s) {\n  // your code here\n}\n',
};

// Used only if AI generation fails (offline / API error)
const FALLBACK_QUESTIONS: QuizQuestion[] = [
  {
    question: 'What does HTML stand for?',
    options: [
      'Hyper Text Markup Language',
      'High Tech Modern Language',
      'Hyperlink Text Management Layer',
      'Home Tool Markup Language',
    ],
    correctAnswer: 'Hyper Text Markup Language',
  },
  {
    question: 'Which company developed the React JavaScript library?',
    options: ['Google', 'Meta (Facebook)', 'Microsoft', 'Amazon'],
    correctAnswer: 'Meta (Facebook)',
  },
  {
    question: 'What is the time complexity of binary search on a sorted array?',
    options: ['O(n)', 'O(n log n)', 'O(log n)', 'O(1)'],
    correctAnswer: 'O(log n)',
  },
  {
    question: 'Which protocol is used to securely transfer web pages?',
    options: ['FTP', 'HTTPS', 'SMTP', 'SSH'],
    correctAnswer: 'HTTPS',
  },
];

export function Quiz() {
  const [quizStarted, setQuizStarted] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [quizComplete, setQuizComplete] = useState(false);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [coding, setCoding] = useState<CodingChallenge>(FALLBACK_CODING);
  const [codingStage, setCodingStage] = useState(false);
  const [codeAnswer, setCodeAnswer] = useState('');
  const [timeLeft, setTimeLeft] = useState(CODING_TIME_LIMIT);
  const [grading, setGrading] = useState(false);
  const [codeCorrect, setCodeCorrect] = useState(false);
  const [codeFeedback, setCodeFeedback] = useState('');

  // Assessment mode: when launched from the recruitment platform with a token,
  // questions are tailored to the job and results are reported back.
  const [assessment, setAssessment] = useState<AssessmentContext | null>(null);
  const [reported, setReported] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const platform = params.get('platform');
    if (!token || !platform) return;
    (async () => {
      try {
        const res = await fetch(`${platform}/api/assessment/context?token=${encodeURIComponent(token)}`);
        if (!res.ok) return;
        const ctx = await res.json();
        setAssessment({
          token,
          platform,
          jobTitle: ctx.jobTitle,
          jobDescription: ctx.jobDescription,
          skills: Array.isArray(ctx.skills) ? ctx.skills : [],
          returnUrl: `${platform}/candidate`,
        });
      } catch {
        // not in assessment mode / context unavailable
      }
    })();
  }, []);

  // Countdown timer for the coding stage; auto-submits when it hits 0.
  useEffect(() => {
    if (!codingStage) return;
    if (timeLeft <= 0) {
      finishCoding();
      return;
    }
    const id = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearTimeout(id);
  }, [codingStage, timeLeft]);

  const startQuiz = async () => {
    setLoading(true);
    setCurrentQuestion(0);
    setScore(0);
    setSelectedAnswer(null);
    setQuizComplete(false);
    setCodingStage(false);
    setCodeAnswer('');
    setTimeLeft(CODING_TIME_LIMIT);

    let generated: QuizQuestion[] = [];
    let generatedCoding: CodingChallenge | null = null;
    try {
      const res = assessment
        ? await fetch('/api/questions', {
            method: 'POST',
            cache: 'no-store',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jobTitle: assessment.jobTitle,
              jobDescription: assessment.jobDescription,
              skills: assessment.skills,
            }),
          })
        : await fetch('/api/questions', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.questions) && data.questions.length > 0) {
          generated = data.questions;
        }
        if (data?.coding?.title && data?.coding?.prompt) {
          generatedCoding = data.coding;
        }
      }
    } catch {
      // ignore — fall back to static content below
    }

    setQuestions(generated.length > 0 ? generated : FALLBACK_QUESTIONS);
    const challenge = generatedCoding ?? FALLBACK_CODING;
    setCoding(challenge);
    setCodeAnswer(challenge.starterCode);
    setLoading(false);
    setQuizStarted(true);
  };

  const handleAnswerSelect = (answer: string) => {
    if (selectedAnswer) return; // Already answered
    setSelectedAnswer(answer);
  };

  const handleNextQuestion = () => {
    const question = questions[currentQuestion];
    if (selectedAnswer === question.correctAnswer) {
      setScore(score + 1);
    }

    if (currentQuestion + 1 >= questions.length) {
      finishQuiz();
    } else {
      setCurrentQuestion(currentQuestion + 1);
      setSelectedAnswer(null);
    }
  };

  const finishQuiz = () => {
    const question = questions[currentQuestion];
    const finalScore = selectedAnswer === question.correctAnswer ? score + 1 : score;
    setScore(finalScore);
    // MCQs done -> move to the timed coding question.
    setTimeLeft(CODING_TIME_LIMIT);
    setCodingStage(true);
  };

  const finishCoding = async () => {
    if (grading || quizComplete) return; // guard against double submit (timer + click)
    setCodingStage(false);
    setGrading(true);

    let correct = false;
    let feedback = '';
    try {
      const res = await fetch('/api/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: coding.prompt,
          language: coding.language,
          code: codeAnswer,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        correct = Boolean(data?.correct);
        feedback = typeof data?.feedback === 'string' ? data.feedback : '';
      }
    } catch {
      // grading unavailable -> treat as incorrect
    }

    setCodeCorrect(correct);
    setCodeFeedback(feedback);
    const finalMcq = score; // already includes all MCQ points
    if (correct) setScore((s) => s + 1);
    setGrading(false);
    setQuizComplete(true);
    // Agent will detect quiz completion from screen share and announce the score

    // Assessment mode: report scores back to the recruitment platform.
    if (assessment && !reported) {
      setReported(true);
      const total = questions.length + 1;
      const finalScore = finalMcq + (correct ? 1 : 0);
      const overall = Math.round((finalScore / total) * 100);
      const technical = questions.length > 0 ? Math.round((finalMcq / questions.length) * 100) : 0;
      try {
        await fetch(`${assessment.platform}/api/assessment/result`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: assessment.token,
            overall,
            technical,
            coding: correct ? 100 : 0,
            proctoring_integrity: 100,
            ai_feedback: feedback,
          }),
        });
      } catch {
        // best-effort; HR can re-request the assessment if this fails
      }
    }
  };

  if (!quizStarted) {
    return (
      <div 
        className="flex items-center justify-center min-h-screen relative overflow-hidden"
        style={{
          background: 'transparent',
        }}
      >
        {/* Enhanced decorative background elements */}
        <div 
          className="absolute rounded-full mix-blend-screen opacity-30"
          style={{
            top: 0,
            left: 0,
            width: '384px',
            height: '384px',
            background: '#93c5fd',
            filter: 'blur(80px)',
            animation: 'pulse 3s ease-in-out infinite',
          }}
        ></div>
        <div 
          className="absolute rounded-full mix-blend-screen opacity-30"
          style={{
            top: 0,
            right: 0,
            width: '384px',
            height: '384px',
            background: '#c4b5fd',
            filter: 'blur(80px)',
            animation: 'pulse 3s ease-in-out infinite',
            animationDelay: '2s',
          }}
        ></div>
        <div 
          className="absolute rounded-full mix-blend-screen opacity-30"
          style={{
            bottom: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            width: '384px',
            height: '384px',
            background: '#a5b4fc',
            filter: 'blur(80px)',
            animation: 'pulse 3s ease-in-out infinite',
            animationDelay: '4s',
          }}
        ></div>
        
        <div 
          className="text-center relative z-10"
          style={{
            background: 'var(--surface-solid)',
            borderRadius: '24px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            padding: '40px',
            maxWidth: '500px',
            width: '100%',
            margin: '0 16px',
            border: '1px solid var(--border)',
          }}
        >
          <div 
            style={{
              fontSize: '128px',
              marginBottom: '32px',
              animation: 'pulse 2s ease-in-out infinite',
            }}
          >
            🧠
          </div>
          <h1 
            style={{
              fontSize: '72px',
              fontWeight: 900,
              marginBottom: '24px',
              background: 'var(--grad)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
              lineHeight: 1.2,
            }}
          >
            Tech Quiz
          </h1>
          <p
            style={{
              fontSize: '24px',
              color: '#cbd5e1',
              marginBottom: '48px',
              fontWeight: 600,
            }}
          >
            {loading ? 'Generating fresh questions…' : 'AI-generated tech questions, fresh every time.'}
          </p>
          <button
            onClick={startQuiz}
            disabled={loading}
            style={{
              padding: '24px 56px',
              background: 'var(--grad)',
              color: 'white',
              borderRadius: '16px',
              fontSize: '24px',
              fontWeight: 900,
              border: 'none',
              cursor: loading ? 'wait' : 'pointer',
              opacity: loading ? 0.7 : 1,
              boxShadow: '0 25px 50px -12px rgba(37, 99, 235, 0.5)',
              transition: 'all 0.3s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-8px) scale(1.05)';
              e.currentTarget.style.boxShadow = '0 30px 60px -12px rgba(37, 99, 235, 0.6)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.boxShadow = '0 25px 50px -12px rgba(37, 99, 235, 0.5)';
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px) scale(1)';
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = 'translateY(-8px) scale(1.05)';
            }}
          >
            {loading ? 'Loading…' : 'Start Quiz →'}
          </button>
        </div>
      </div>
    );
  }

  if (codingStage) {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    const isLow = timeLeft <= 30;

    return (
      <div
        className="flex items-center justify-center min-h-screen p-4 relative overflow-hidden"
        style={{
          background: 'transparent',
        }}
      >
        <div
          className="relative z-10"
          style={{
            background: 'var(--surface-solid)',
            borderRadius: '24px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            padding: '32px',
            maxWidth: '720px',
            width: '100%',
            border: '1px solid var(--border)',
          }}
        >
          {/* Header: title + timer */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '24px',
              gap: '16px',
            }}
          >
            <span
              style={{
                fontSize: '14px',
                fontWeight: 700,
                color: '#a5b4fc',
                background: 'rgba(99,102,241,0.16)',
                padding: '8px 16px',
                borderRadius: '9999px',
                border: '1px solid #c4b5fd',
              }}
            >
              Coding Challenge
            </span>
            <span
              style={{
                fontSize: '20px',
                fontWeight: 900,
                fontVariantNumeric: 'tabular-nums',
                color: isLow ? '#f87171' : '#22d3ee',
                background: isLow
                  ? 'linear-gradient(to right, #fee2e2, #fecaca)'
                  : 'rgba(34,211,238,0.14)',
                padding: '8px 18px',
                borderRadius: '9999px',
                border: `1px solid ${isLow ? '#fca5a5' : '#93c5fd'}`,
                animation: isLow ? 'pulse 1s ease-in-out infinite' : undefined,
              }}
            >
              ⏱ {minutes}:{seconds.toString().padStart(2, '0')}
            </span>
          </div>

          <h2
            style={{
              fontSize: '28px',
              fontWeight: 900,
              marginBottom: '12px',
              color: '#e6edf6',
              letterSpacing: '-0.5px',
            }}
          >
            {coding.title}
          </h2>
          <p
            style={{
              fontSize: '16px',
              color: '#cbd5e1',
              marginBottom: '20px',
              lineHeight: 1.5,
              fontWeight: 500,
              whiteSpace: 'pre-wrap',
            }}
          >
            {coding.prompt}
          </p>

          <div
            style={{
              fontSize: '13px',
              fontWeight: 700,
              color: '#94a3b8',
              marginBottom: '8px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Your solution ({coding.language})
          </div>
          <textarea
            value={codeAnswer}
            onChange={(e) => setCodeAnswer(e.target.value)}
            spellCheck={false}
            style={{
              width: '100%',
              minHeight: '260px',
              padding: '16px',
              borderRadius: '12px',
              border: '1px solid var(--border)',
              background: '#0f172a',
              color: '#e2e8f0',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
              fontSize: '14px',
              lineHeight: 1.6,
              resize: 'vertical',
              outline: 'none',
              boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.3)',
            }}
          />

          <button
            onClick={finishCoding}
            style={{
              width: '100%',
              marginTop: '20px',
              padding: '16px 32px',
              background: 'var(--grad)',
              color: 'white',
              borderRadius: '12px',
              fontSize: '18px',
              fontWeight: 900,
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 10px 20px rgba(37, 99, 235, 0.3)',
              transition: 'all 0.3s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)';
              e.currentTarget.style.boxShadow = '0 20px 40px rgba(37, 99, 235, 0.5)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.boxShadow = '0 10px 20px rgba(37, 99, 235, 0.3)';
            }}
          >
            Submit Code & Finish →
          </button>
          <p
            style={{
              textAlign: 'center',
              fontSize: '13px',
              color: '#9ca3af',
              marginTop: '12px',
              fontWeight: 500,
            }}
          >
            Auto-submits when the timer runs out.
          </p>
        </div>
      </div>
    );
  }

  if (grading) {
    return (
      <div
        className="flex items-center justify-center min-h-screen p-4"
        style={{ background: 'transparent' }}
      >
        <div
          className="text-center"
          style={{
            background: 'var(--surface-solid)',
            borderRadius: '24px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            padding: '48px',
            border: '1px solid var(--border)',
          }}
        >
          <div style={{ fontSize: '72px', marginBottom: '16px', animation: 'pulse 1.5s ease-in-out infinite' }}>
            🧪
          </div>
          <h2 style={{ fontSize: '28px', fontWeight: 900, color: '#e6edf6' }}>
            Evaluating your code…
          </h2>
        </div>
      </div>
    );
  }

  if (quizComplete) {
    const totalQuestions = questions.length + 1; // MCQs + coding question
    const percentage = Math.round((score / totalQuestions) * 100);
    const isPerfect = score === totalQuestions;
    const mcqScore = score - (codeCorrect ? 1 : 0);
    const isGood = percentage >= 75;
    
    return (
      <div 
        className="flex items-center justify-center min-h-screen relative overflow-hidden"
        style={{
          background: 'transparent',
        }}
      >
        {/* Enhanced decorative background elements */}
        <div 
          className="absolute rounded-full mix-blend-screen opacity-30"
          style={{
            top: 0,
            left: 0,
            width: '320px',
            height: '320px',
            background: '#93c5fd',
            filter: 'blur(80px)',
            animation: 'pulse 3s ease-in-out infinite',
          }}
        ></div>
        <div 
          className="absolute rounded-full mix-blend-screen opacity-30"
          style={{
            top: 0,
            right: 0,
            width: '320px',
            height: '320px',
            background: '#c4b5fd',
            filter: 'blur(80px)',
            animation: 'pulse 3s ease-in-out infinite',
            animationDelay: '2s',
          }}
        ></div>
        <div 
          className="absolute rounded-full mix-blend-screen opacity-30"
          style={{
            bottom: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            width: '320px',
            height: '320px',
            background: '#a5b4fc',
            filter: 'blur(80px)',
            animation: 'pulse 3s ease-in-out infinite',
            animationDelay: '4s',
          }}
        ></div>
        
        <div 
          className="text-center relative z-10"
          style={{
            background: 'var(--surface-solid)',
            borderRadius: '24px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            padding: '48px',
            maxWidth: '500px',
            width: '100%',
            margin: '0 16px',
            border: '1px solid var(--border)',
          }}
        >
          <div 
            style={{
              fontSize: '96px',
              marginBottom: '32px',
              animation: 'pulse 2s ease-in-out infinite',
            }}
          >
            {isPerfect ? '🎉' : isGood ? '👍' : '📚'}
          </div>
          <h2 
            style={{
              fontSize: '48px',
              fontWeight: 900,
              marginBottom: '32px',
              color: '#e6edf6',
            }}
          >
            Quiz Complete!
          </h2>
          <div style={{ marginBottom: '32px' }}>
            <div 
              style={{
                fontSize: '64px',
                fontWeight: 900,
                marginBottom: '16px',
                color: '#e6edf6',
              }}
            >
              {score}/{totalQuestions}
            </div>
            <div
              style={{
                fontSize: '48px',
                fontWeight: 700,
                background: isPerfect
                  ? 'linear-gradient(to right, #fbbf24, #f97316, #ef4444)'
                  : isGood
                  ? 'linear-gradient(to right, #2563eb, #9333ea)'
                  : 'linear-gradient(to right, #4b5563, #1f2937)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
              }}
            >
              {percentage}%
            </div>

            {/* Score breakdown: MCQs + coding */}
            <div
              style={{
                marginTop: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                textAlign: 'left',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 18px',
                  borderRadius: '12px',
                  background: 'rgba(148,163,184,0.1)',
                  border: '1px solid var(--border)',
                  fontWeight: 700,
                  color: '#cbd5e1',
                }}
              >
                <span>📝 Multiple Choice</span>
                <span>{mcqScore}/{questions.length}</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 18px',
                  borderRadius: '12px',
                  background: codeCorrect ? '#dcfce7' : '#fee2e2',
                  border: `1px solid ${codeCorrect ? '#86efac' : '#fca5a5'}`,
                  fontWeight: 700,
                  color: codeCorrect ? '#166534' : '#991b1b',
                }}
              >
                <span>💻 Coding Challenge</span>
                <span>{codeCorrect ? '1/1 ✓' : '0/1 ✗'}</span>
              </div>
              {codeFeedback && (
                <p style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 500, padding: '0 4px' }}>
                  {codeFeedback}
                </p>
              )}
            </div>
            {isPerfect && (
              <p style={{ fontSize: '20px', color: '#94a3b8', marginTop: '16px', fontWeight: 600 }}>
                Perfect Score! 🎊
              </p>
            )}
            {isGood && !isPerfect && (
              <p style={{ fontSize: '20px', color: '#94a3b8', marginTop: '16px', fontWeight: 600 }}>
                Great Job! 👏
              </p>
            )}
            {!isGood && (
              <p style={{ fontSize: '20px', color: '#94a3b8', marginTop: '16px', fontWeight: 600 }}>
                Keep Learning! 💪
              </p>
            )}
          </div>
          <button
            onClick={() => {
              if (assessment) {
                window.location.href = assessment.returnUrl;
              } else {
                window.close();
              }
            }}
            style={{
              padding: '20px 40px',
              background: 'var(--grad)',
              color: 'white',
              borderRadius: '16px',
              fontSize: '20px',
              fontWeight: 900,
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 25px 50px -12px rgba(37, 99, 235, 0.5)',
              transition: 'all 0.3s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-8px) scale(1.05)';
              e.currentTarget.style.boxShadow = '0 30px 60px -12px rgba(37, 99, 235, 0.6)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.boxShadow = '0 25px 50px -12px rgba(37, 99, 235, 0.5)';
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px) scale(1)';
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = 'translateY(-8px) scale(1.05)';
            }}
          >
            {assessment ? 'Return to portal →' : 'Close Tab'}
          </button>
        </div>
      </div>
    );
  }

  const question = questions[currentQuestion];
  const isCorrect = selectedAnswer === question.correctAnswer;

  return (
      <div 
        className="flex items-center justify-center min-h-screen p-4 relative overflow-hidden"
        style={{
          background: 'transparent',
        }}
      >
        {/* Enhanced background decoration */}
        <div 
          className="absolute rounded-full mix-blend-screen opacity-30"
          style={{
            top: 0,
            left: 0,
            width: '320px',
            height: '320px',
            background: '#93c5fd',
            filter: 'blur(80px)',
          }}
        ></div>
        <div 
          className="absolute rounded-full mix-blend-screen opacity-30"
          style={{
            bottom: 0,
            right: 0,
            width: '320px',
            height: '320px',
            background: '#c4b5fd',
            filter: 'blur(80px)',
          }}
        ></div>
        <div 
          className="absolute rounded-full mix-blend-screen opacity-20"
          style={{
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '384px',
            height: '384px',
            background: '#a5b4fc',
            filter: 'blur(80px)',
          }}
        ></div>
        
        {/* Modal-style card */}
        <div 
          className="relative z-10"
          style={{
            background: 'var(--surface-solid)',
            borderRadius: '24px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            padding: '32px',
            maxWidth: '480px',
            width: '100%',
            border: '1px solid var(--border)',
          }}
        >
          {/* Header with progress */}
          <div style={{ marginBottom: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <span 
                style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  color: '#cbd5e1',
                  background: 'rgba(148,163,184,0.12)',
                  padding: '8px 16px',
                  borderRadius: '9999px',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                  border: '1px solid #d1d5db',
                }}
              >
                Question {currentQuestion + 1} of {questions.length}
              </span>
              <span 
                style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  color: '#22d3ee',
                  background: 'rgba(34,211,238,0.14)',
                  padding: '8px 16px',
                  borderRadius: '9999px',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                  border: '1px solid #93c5fd',
                }}
              >
                Score: {score}/{questions.length}
              </span>
            </div>
            <div 
              style={{
                width: '100%',
                background: 'rgba(148,163,184,0.15)',
                borderRadius: '9999px',
                height: '20px',
                overflow: 'hidden',
                boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.1)',
              }}
            >
              <div
                style={{
                  background: 'var(--grad)',
                  height: '100%',
                  borderRadius: '9999px',
                  width: `${((currentQuestion + 1) / questions.length) * 100}%`,
                  transition: 'width 0.7s ease-out',
                  boxShadow: '0 4px 6px rgba(37, 99, 235, 0.3)',
                  position: 'relative',
                }}
              >
                <div 
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'rgba(255, 255, 255, 0.3)',
                    animation: 'pulse 2s ease-in-out infinite',
                  }}
                ></div>
              </div>
            </div>
          </div>

          {/* Question */}
          <h2 
            style={{
              fontSize: '32px',
              fontWeight: 900,
              marginBottom: '32px',
              color: '#e6edf6',
              lineHeight: 1.3,
              letterSpacing: '-0.5px',
            }}
          >
            {question.question}
          </h2>

          {/* Answer options */}
          <div style={{ marginBottom: '32px' }}>
            {question.options.map((option, index) => {
              const isSelected = selectedAnswer === option;
              const isCorrect = option === question.correctAnswer;
              const isWrong = isSelected && !isCorrect;
              
              let buttonStyle: React.CSSProperties = {
                width: '100%',
                textAlign: 'left',
                padding: '16px 24px',
                borderRadius: '12px',
                border: '3px solid',
                fontSize: '16px',
                fontWeight: 700,
                marginBottom: '12px',
                cursor: selectedAnswer ? 'default' : 'pointer',
                transition: 'all 0.3s ease',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
              };

              if (selectedAnswer) {
                if (isCorrect) {
                  buttonStyle.background = 'linear-gradient(to right, #dcfce7, #d1fae5)';
                  buttonStyle.borderColor = '#22c55e';
                  buttonStyle.color = '#166534';
                  buttonStyle.transform = 'scale(1.02)';
                  buttonStyle.boxShadow = '0 10px 15px rgba(34, 197, 94, 0.3)';
                } else if (isWrong) {
                  buttonStyle.background = 'linear-gradient(to right, #fee2e2, #fecaca)';
                  buttonStyle.borderColor = '#ef4444';
                  buttonStyle.color = '#991b1b';
                  buttonStyle.boxShadow = '0 8px 12px rgba(239, 68, 68, 0.3)';
                } else {
                  buttonStyle.background = 'rgba(255,255,255,0.03)';
                  buttonStyle.borderColor = 'var(--border)';
                  buttonStyle.color = '#64748b';
                }
              } else {
                buttonStyle.background = 'var(--surface-solid)';
                buttonStyle.borderColor = 'var(--border)';
                buttonStyle.color = '#e6edf6';
              }

              return (
                <button
                  key={index}
                  onClick={() => handleAnswerSelect(option)}
                  disabled={!!selectedAnswer}
                  style={buttonStyle}
                  onMouseEnter={(e) => {
                    if (!selectedAnswer) {
                      e.currentTarget.style.borderColor = '#22d3ee';
                      e.currentTarget.style.background = 'rgba(34,211,238,0.12)';
                      e.currentTarget.style.color = '#e6edf6';
                      e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)';
                      e.currentTarget.style.boxShadow = '0 12px 24px rgba(34, 211, 238, 0.25)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!selectedAnswer) {
                      e.currentTarget.style.borderColor = 'var(--border)';
                      e.currentTarget.style.background = 'var(--surface-solid)';
                      e.currentTarget.style.color = '#e6edf6';
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.25)';
                    }
                  }}
                >
                  <span 
                    style={{
                      marginRight: '16px',
                      fontSize: '18px',
                      fontWeight: 900,
                      width: '36px',
                      height: '36px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '8px',
                      ...(selectedAnswer && isCorrect
                        ? { background: '#22c55e', color: 'white', boxShadow: '0 2px 4px rgba(34, 197, 94, 0.3)' }
                        : selectedAnswer && isWrong
                        ? { background: '#ef4444', color: 'white', boxShadow: '0 2px 4px rgba(239, 68, 68, 0.3)' }
                        : { background: 'rgba(148,163,184,0.18)', color: '#cbd5e1' }
                      ),
                    }}
                  >
                    {String.fromCharCode(65 + index)}
                  </span>
                  <span>{option}</span>
                  {isCorrect && selectedAnswer && (
                    <span style={{ position: 'absolute', right: '20px', fontSize: '24px', color: '#22c55e', fontWeight: 900 }}>✓</span>
                  )}
                  {isWrong && (
                    <span style={{ position: 'absolute', right: '20px', fontSize: '24px', color: '#ef4444', fontWeight: 900 }}>✗</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Feedback and next button */}
          {selectedAnswer && (
            <div style={{ marginTop: '32px' }}>
              <div 
                style={{
                  padding: '20px',
                  borderRadius: '16px',
                  border: '3px solid',
                  marginBottom: '16px',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                  ...(isCorrect
                    ? {
                        background: 'linear-gradient(to right, #dcfce7, #d1fae5)',
                        borderColor: '#22c55e',
                        color: '#166534',
                      }
                    : {
                        background: 'linear-gradient(to right, #fee2e2, #fecaca)',
                        borderColor: '#ef4444',
                        color: '#991b1b',
                      }
                  ),
                }}
              >
                <p style={{ fontSize: '24px', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '32px' }}>{isCorrect ? '✓' : '✗'}</span>
                  <span>{isCorrect ? 'Correct!' : 'Incorrect'}</span>
                </p>
                {!isCorrect && (
                  <p style={{ fontSize: '14px', marginTop: '12px', fontWeight: 600, opacity: 0.95 }}>
                    The correct answer is: <strong style={{ fontSize: '16px', color: '#e6edf6' }}>{question.correctAnswer}</strong>
                  </p>
                )}
              </div>
              <button
                onClick={handleNextQuestion}
                style={{
                  width: '100%',
                  padding: '16px 32px',
                  background: 'var(--grad)',
                  color: 'white',
                  borderRadius: '12px',
                  fontSize: '18px',
                  fontWeight: 900,
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 10px 20px rgba(37, 99, 235, 0.3)',
                  transition: 'all 0.3s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-8px) scale(1.05)';
                  e.currentTarget.style.boxShadow = '0 30px 60px -12px rgba(37, 99, 235, 0.6)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0) scale(1)';
                  e.currentTarget.style.boxShadow = '0 25px 50px -12px rgba(37, 99, 235, 0.5)';
                }}
                onMouseDown={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px) scale(1)';
                }}
                onMouseUp={(e) => {
                  e.currentTarget.style.transform = 'translateY(-8px) scale(1.05)';
                }}
              >
                {currentQuestion + 1 >= questions.length ? 'Continue to Coding →' : 'Next Question →'}
              </button>
            </div>
          )}
        </div>
      </div>
  );
}
