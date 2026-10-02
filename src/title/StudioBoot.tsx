import { useEffect, useRef, useState } from 'react'
import type { StageHandle } from '../render/stage.ts'
import { CutScene } from './CutScene.tsx'
import '../styles/studioStart.css'

export interface StudioBootProps {
  founderName: string
  projectName: string
  stage: StageHandle | null
  onDone: () => void
}

const LINES = ['const idea = "a tiny app";', 'const budget = 0;', 'const developer = "also me";']

/** §21 Act I [2026-10-02]: teach the real action in the real room. Reading
 * never spends a tap; only CODE contributes work to the player's first app. */
export function StudioBoot({ founderName, projectName, stage, onDone }: StudioBootProps) {
  const [step, setStep] = useState(0)
  const [prologue, setPrologue] = useState(true)
  const [lines, setLines] = useState(0)
  const actionRef = useRef<HTMLButtonElement>(null)

  useEffect(() => { stage?.focusFounder() }, [stage])
  useEffect(() => { actionRef.current?.focus() }, [step, prologue])

  function code() {
    if (!stage || stage.codeFounder() <= 0) return
    const next = lines + 1
    setLines(next)
    if (next === LINES.length) setStep(2)
  }

  if (prologue) return <CutScene pages={[
    'You had an idea for an app.',
    '“I could build that in a weekend.”',
    'Unfortunately, the computer\nrequires every single line of code.',
  ]} onDone={() => setPrologue(false)} />

  return (
    <section className="studio-start" aria-label="Your first app">
      <header className="studio-start__identity">
        <span>Day 1 · Your garage</span>
        <strong>{founderName}, founder / developer / unpaid intern</strong>
      </header>
      <div className="studio-start__you" aria-hidden="true">You. The entire engineering department.<br />⌄</div>
      <div className="studio-start__panel">
        <div className="studio-start__story">
          <span className="studio-start__chapter">{step + 1} / 3 · {['The brilliant idea', 'The typing part', 'The plan'][step]}</span>
          <h1>{['“How hard can one little app be?”', 'Apps do not write themselves. Yet.', 'Three lines down. A career to go.'][step]}</h1>
          <p>{[
            'You have a garage, a computer, and an app idea. Your budget went on the computer. Your development team is you.',
            'Press CODE three times. Each press adds real work to your app. The job title says founder. The job is still typing.',
            'Keep pressing CODE to finish the app. Build and Test run automatically; when it is ready, press SHIP! to launch it and earn money.',
          ][step]}</p>
          <button type="button" className="ui-btn" ref={actionRef} disabled={!stage} onClick={step === 0 ? () => setStep(1) : step === 1 ? code : onDone}>
            {step === 0 ? 'Let’s write this app' : step === 1 ? 'CODE' : 'Keep coding'}
          </button>
          <span className="studio-start__hint">{step === 1 ? `${lines} / 3 lines · click or press Enter on CODE` : step === 2 ? 'CODE stays on the right. More hands will help. Probably.' : 'One app. One developer. No “make app” button.'}</span>
        </div>
        <aside className="studio-start__editor" aria-label="First app coding progress">
          <div className="studio-start__filename">{projectName}<span>app.js</span></div>
          <pre aria-live="polite">{LINES.map((line, i) => <span key={line}><b>{i + 1}</b>{i < lines ? line : i === lines ? '▌' : ' '}{'\n'}</span>)}</pre>
          <p>{lines === 0 ? '// TODO: literally everything' : lines < 3 ? '// Excellent. Only the rest of the app left.' : '// Hiring plan: someone with a second keyboard.'}</p>
        </aside>
      </div>
    </section>
  )
}
