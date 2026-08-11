import { useState } from 'react'
import {
  FOUNDER_ACCESSORIES,
  FOUNDER_BODIES,
  FOUNDER_BODY_COLOURS,
  FOUNDER_FACIAL_HAIR,
  FOUNDER_HAIR_COLOURS,
  FOUNDER_HEADS,
  FOUNDER_NAME_MAX,
  FOUNDER_SKINS,
  cleanFounderName,
  randomFounderLook,
  randomFounderName,
  writeFounderProfile,
  type FounderAccessory,
  type FounderBody,
  type FounderBodyColour,
  type FounderFacialHair,
  type FounderHairColour,
  type FounderHead,
  type FounderProfile,
  type FounderSkin,
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
  const [hairColour, setHairColour] = useState<FounderHairColour>(0)
  const [skin, setSkin] = useState<FounderSkin>(2)
  const [accessory, setAccessory] = useState<FounderAccessory>('none')
  const [facialHair, setFacialHair] = useState<FounderFacialHair>('none')
  const [body, setBody] = useState<FounderBody>('hoodie')
  const [bodyColour, setBodyColour] = useState<FounderBodyColour>(1)
  const validName = cleanFounderName(name)

  function randomiseLook() {
    const next = randomFounderLook()
    setHead(next.head)
    setHairColour(next.hairColour)
    setSkin(next.skin)
    setAccessory(next.accessory)
    setFacialHair(next.facialHair)
    setBody(next.body)
    setBodyColour(next.bodyColour)
  }

  function submit() {
    const profile = writeFounderProfile({
      name: validName,
      head,
      hairColour,
      skin,
      accessory,
      facialHair,
      body,
      bodyColour,
    })
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
        <FounderAvatar
          head={head}
          hairColour={hairColour}
          skin={skin}
          accessory={accessory}
          facialHair={facialHair}
          body={body}
          bodyColour={bodyColour}
        />
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

        <div className="founder-setup__traits">
          <fieldset>
            <legend>HAIR SHAPE</legend>
            <div className="founder-setup__options">
              {FOUNDER_HEADS.map((option, index) => (
                <button
                  type="button"
                  key={option.id}
                  className="founder-setup__option"
                  data-selected={head === option.id ? 'true' : 'false'}
                  aria-label={`Hair shape ${option.label}`}
                  onClick={() => setHead(option.id)}
                >
                  <span>0{index + 1}</span>{option.label}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>HAIR COLOUR</legend>
            <div className="founder-setup__options founder-setup__options--swatches">
              {FOUNDER_HAIR_COLOURS.map((option) => (
                <button
                  type="button"
                  key={option.id}
                  className="founder-setup__option founder-setup__swatch"
                  data-kind="hair"
                  data-swatch={option.id}
                  data-selected={hairColour === option.id ? 'true' : 'false'}
                  aria-label={`Hair colour ${option.label}`}
                  title={option.label}
                  onClick={() => setHairColour(option.id)}
                ><i /></button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>SKIN TONE</legend>
            <div className="founder-setup__options founder-setup__options--swatches">
              {FOUNDER_SKINS.map((option) => (
                <button
                  type="button"
                  key={option.id}
                  className="founder-setup__option founder-setup__swatch"
                  data-kind="skin"
                  data-swatch={option.id}
                  data-selected={skin === option.id ? 'true' : 'false'}
                  aria-label={option.label}
                  title={option.label}
                  onClick={() => setSkin(option.id)}
                ><i /></button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>ACCESSORY</legend>
            <div className="founder-setup__options founder-setup__options--three">
              {FOUNDER_ACCESSORIES.map((option) => (
                <button
                  type="button"
                  key={option.id}
                  className="founder-setup__option"
                  data-selected={accessory === option.id ? 'true' : 'false'}
                  onClick={() => setAccessory(option.id)}
                >{option.label}</button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>FACIAL HAIR</legend>
            <div className="founder-setup__options">
              {FOUNDER_FACIAL_HAIR.map((option) => (
                <button
                  type="button"
                  key={option.id}
                  className="founder-setup__option"
                  data-selected={facialHair === option.id ? 'true' : 'false'}
                  onClick={() => setFacialHair(option.id)}
                >{option.label}</button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>BODY SHAPE</legend>
            <div className="founder-setup__options">
              {FOUNDER_BODIES.map((option, index) => (
                <button
                  type="button"
                  key={option.id}
                  className="founder-setup__option"
                  data-selected={body === option.id ? 'true' : 'false'}
                  aria-label={`Body shape ${option.label}`}
                  onClick={() => setBody(option.id)}
                >
                  <span>0{index + 1}</span>{option.label}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>BODY COLOUR</legend>
            <div className="founder-setup__options founder-setup__options--swatches founder-setup__options--five">
              {FOUNDER_BODY_COLOURS.map((option) => (
                <button
                  type="button"
                  key={option.id}
                  className="founder-setup__option founder-setup__swatch"
                  data-kind="body"
                  data-swatch={option.id}
                  data-selected={bodyColour === option.id ? 'true' : 'false'}
                  aria-label={`Body colour ${option.label}`}
                  title={option.label}
                  onClick={() => setBodyColour(option.id)}
                ><i /></button>
              ))}
            </div>
          </fieldset>
        </div>

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
