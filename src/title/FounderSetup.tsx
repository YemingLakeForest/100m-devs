import { useState } from 'react'
import {
  FOUNDER_BODIES,
  FOUNDER_HEADS,
  FOUNDER_NAME_MAX,
  cleanFounderName,
  randomFounderLook,
  randomFounderName,
  writeFounderProfile,
  type FounderBody,
  type FounderHead,
  type FounderProfile,
} from '../game/founderProfile.ts'
import { Button } from '../ui/Button.tsx'
import { FounderAvatar } from '../ui/FounderAvatar.tsx'
import { Kw } from '../hud/Kw.tsx'

import '../styles/founderSetup.css'

export interface FounderSetupProps {
  onComplete: (profile: FounderProfile) => void
}

function Dice() {
  return (
    <span className="founder-setup__die" aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
      <i />
    </span>
  )
}

export function FounderSetup({ onComplete }: FounderSetupProps) {
  const [name, setName] = useState('')
  const [head, setHead] = useState<FounderHead>('crop')
  const [body, setBody] = useState<FounderBody>('hoodie')
  const validName = cleanFounderName(name)

  function randomiseLook() {
    const next = randomFounderLook()
    setHead(next.head)
    setBody(next.body)
  }

  function submit() {
    const profile = writeFounderProfile({ name: validName, head, body })
    if (profile) onComplete(profile)
  }

  return (
    <div className="founder-setup" role="dialog" aria-modal="true" aria-labelledby="founder-setup-title">
      <div className="founder-setup__scanlines" aria-hidden="true" />
      <header className="founder-setup__header">
        <span>STUDIO_OS // PERSONNEL</span>
        <span>PROFILE 00: MANAGEMENT</span>
      </header>

      <section className="founder-setup__preview">
        <div className="founder-setup__eyebrow">BUILD YOUR FOUNDER</div>
        <h1 id="founder-setup-title">WHO ARE YOU?</h1>
        <p>You still code. For now.</p>
        <FounderAvatar head={head} body={body} />
        <div className="founder-setup__badge">
          <span>ROLE</span>
          <b>MANAGER / <Kw kind="devs">DEVELOPER</Kw></b>
        </div>
      </section>

      <form
        className="founder-setup__form"
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        <label className="founder-setup__name-label" htmlFor="founder-name">
          YOUR NAME
        </label>
        <div className="founder-setup__name-row">
          <input
            id="founder-name"
            value={name}
            maxLength={FOUNDER_NAME_MAX}
            autoComplete="name"
            autoFocus
            placeholder="ENTER NAME_"
            onChange={(event) => setName(event.target.value)}
          />
          <Button
            className="founder-setup__dice-btn"
            aria-label="Randomise name"
            title="Randomise name"
            onClick={() => setName(randomFounderName())}
          >
            <Dice />
          </Button>
        </div>

        <fieldset>
          <legend>HEAD</legend>
          <div className="founder-setup__options">
            {FOUNDER_HEADS.map((option, index) => (
              <button
                type="button"
                key={option.id}
                className="founder-setup__option"
                data-selected={head === option.id ? 'true' : 'false'}
                onClick={() => setHead(option.id)}
              >
                <span>0{index + 1}</span>
                {option.label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend>BODY</legend>
          <div className="founder-setup__options">
            {FOUNDER_BODIES.map((option, index) => (
              <button
                type="button"
                key={option.id}
                className="founder-setup__option"
                data-selected={body === option.id ? 'true' : 'false'}
                onClick={() => setBody(option.id)}
              >
                <span>0{index + 1}</span>
                {option.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="founder-setup__actions">
          <Button className="founder-setup__random" onClick={randomiseLook}>
            <Dice /> RANDOMISE LOOK
          </Button>
          <Button className="founder-setup__continue" disabled={!validName} onClick={submit}>
            ENTER THE STUDIO
          </Button>
        </div>
      </form>
    </div>
  )
}
