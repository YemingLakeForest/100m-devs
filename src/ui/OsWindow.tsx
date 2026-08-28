import { useCallback, useRef, useState, type ReactNode } from 'react'
import { Panel, type PanelOrigin } from './Panel.tsx'
import { playUi } from './uiSfx.ts'
import { railGeometry, type RailGeometry } from './scrollRail.ts'

import '../styles/osWindow.css'

/**
 * The STUDIO_OS window — GDD §10.6a.
 *
 * Every overlay in the product wore its own chrome: the gallery drew a rule
 * under a two-line masthead, the paradigm tree put its balance beside an `h1`,
 * the term sheet led with a kicker, and the way out was a `BACK` here, a
 * `CLOSE` there, and on two of them nothing at all until you found the button
 * at the bottom of a scroll. Each was defensible alone. Together they read as
 * eleven screens from eleven products, which is precisely the failure
 * ART_DIRECTION §0 exists to prevent — *"assets that don't agree with each
 * other"* — arrived at through interface rather than through art.
 *
 * So there is one window, and it is the machine's:
 *
 *   - a **title bar** that names the process, `STUDIO_OS // GALLERY`, with a
 *     slot on the right for the one number the window is about;
 *   - a **close box** at the top right, in the corner every operating system
 *     ever built has put it, so the way out is found rather than hunted for;
 *   - a **scroll rail** down the inside edge that says whether there is more
 *     below (§10.6a rule 3, and `scrollRail.ts` for why it is drawn and not
 *     delegated to the platform).
 *
 * It is chrome, not a layout: what a window puts inside its body is still the
 * window's business. `.os-window__body` is the scroll viewport and nothing
 * else — and a window that already owns a viewport of its own points the rail
 * at it with `data-os-scroll` — so a board that pans, a wall that slides and a
 * table of terms all keep the composition they had.
 *
 * **`onClose` is optional, and its absence is a design statement rather than an
 * oversight.** §18.0a's incident card and §21.0a's term sheet cannot be
 * dismissed — the two buttons on the card *are* the exits, and both are
 * decisions. Those windows get the bar without the box. Drawing a close box and
 * disabling it would be worse than either: it advertises an exit that is not
 * there, which is the one thing a window frame must never do.
 */

export interface OsWindowProps {
  open: boolean
  /** The edge this window belongs to — passed straight through to {@link Panel}. */
  from?: PanelOrigin
  /** Dim and blur the simulation behind it (§10.6). */
  modal?: boolean
  /** Suppress the panel's own whoosh when a larger scored beat owns the moment. */
  silent?: boolean
  /**
   * The process name, after `STUDIO_OS //`. Upper case, because the bar is the
   * machine talking and the machine has only ever had one voice.
   */
  title: ReactNode
  /** The one figure this window is about — cash, BP, a count. Right of the title. */
  meta?: ReactNode
  /** Omit for a window with no exit but its own decisions. See the note above. */
  onClose?: () => void
  /** Pinned under the scroll, so a window's primary action never scrolls away. */
  footer?: ReactNode
  /** Extra classes for the outer `.ui-panel`, which is what positions the window. */
  className?: string
  /** Extra classes for the scrolling body, for windows that lay their own out. */
  bodyClassName?: string
  children: ReactNode
  onExited?: () => void
}

/**
 * Measure a scroller and keep {@link railGeometry} current.
 *
 * Everything here is a *subscription*, and that is deliberate rather than
 * stylistic. The rail has three inputs — the viewport's size, the content's
 * size, and where the scroll is — and every one of them changes outside React:
 * a rotated handset, a counter ticking over, a finger. Measuring on every
 * render instead would be a `setState` in an effect, which is a cascading
 * render on a surface that already re-renders six times a second.
 */
function useScrollRail(): [(el: HTMLDivElement | null) => void, RailGeometry, () => void] {
  const body = useRef<HTMLDivElement | null>(null)
  const [rail, setRail] = useState<RailGeometry>({
    overflow: false,
    top: 0,
    size: 1,
    more: false,
    less: false,
  })

  /*
   * The rail measures the body — unless the window brought its own viewport,
   * in which case it measures that.
   *
   * §11.4.1's board and §13.9's are *panned*, in two axes, and §10.11's receipt
   * is a panel beside a wall that must not scroll with it. Those windows mark
   * their real viewport with `data-os-scroll`. Resolved on every measurement
   * rather than latched at mount, because the marked element can arrive later
   * than the body does — an empty gallery has no receipt until the studio has
   * shipped something.
   */
  const viewport = useCallback(
    () => body.current?.querySelector<HTMLElement>('[data-os-scroll]') ?? body.current,
    [],
  )

  const measure = useCallback(() => {
    const node = viewport()
    if (!node) return
    const next = railGeometry(node.scrollTop, node.clientHeight, node.scrollHeight)
    // Written only when it actually moved. The gallery re-reads its money six
    // times a second and the paradigm tree re-renders on every purchase; a
    // rail that set state on each of those would re-render the window for a
    // thumb that had not moved a pixel.
    setRail((was) =>
      was.overflow === next.overflow &&
      was.more === next.more &&
      was.less === next.less &&
      Math.abs(was.top - next.top) < 0.001 &&
      Math.abs(was.size - next.size) < 0.001
        ? was
        : next,
    )
  }, [viewport])

  // A callback ref rather than an effect on mount: the body lives inside a
  // Panel that mounts and unmounts with the window, so there is no stable
  // moment after mount to hang the observers on that is not this one.
  const attach = useCallback(
    (node: HTMLDivElement | null) => {
      body.current = node
      if (!node) return
      // jsdom has neither observer that matters, and the geometry is pinned
      // directly in `scrollRail.test.ts` rather than through a fake one.
      if (typeof ResizeObserver === 'undefined') return

      const sizes = new ResizeObserver(measure)
      /*
       * The viewport *and everything laid out inside it*. `scrollHeight` is a
       * fact about the children, so observing only the box would miss the case
       * the rail exists for: content growing past the fold without the window
       * changing size at all — a hero levelling up, a release ledger gaining a
       * row, a guided line appearing.
       */
      const watch = () => {
        sizes.disconnect()
        const view = viewport()
        if (!view) return
        sizes.observe(view)
        for (const child of view.children) sizes.observe(child)
        measure()
      }
      watch()

      // Children arriving or leaving is the one change a ResizeObserver cannot
      // report, because the element it would report on does not exist yet.
      const tree =
        typeof MutationObserver === 'undefined'
          ? null
          : new MutationObserver((records) => {
              if (records.some((r) => r.type === 'childList')) watch()
              else measure()
            })
      tree?.observe(node, { childList: true, subtree: true, characterData: true })

      // Returned so React tears both down when the body goes away (React 19
      // ref cleanup); the bare `return` above is the "nothing to clean" case.
      return () => {
        sizes.disconnect()
        tree?.disconnect()
      }
    },
    [measure, viewport],
  )

  return [attach, rail, measure]
}

export function OsWindow({
  open,
  from = 'centre',
  modal = false,
  silent = false,
  title,
  meta,
  onClose,
  footer,
  className,
  bodyClassName,
  children,
  onExited,
}: OsWindowProps) {
  const [body, rail, measure] = useScrollRail()

  return (
    <Panel
      open={open}
      from={from}
      modal={modal}
      silent={silent}
      className={`os-frame${className ? ` ${className}` : ''}`}
      onExited={onExited}
    >
      <div className="os-window">
        <div className="os-window__bar">
          <span className="os-window__id">STUDIO_OS</span>
          <span className="os-window__sep" aria-hidden="true">
            //
          </span>
          <h2 className="os-window__title">{title}</h2>
          {meta !== undefined && <span className="os-window__meta">{meta}</span>}
          {onClose && (
            <button
              type="button"
              className="os-window__close"
              // Named `CLOSE` rather than `X`: the glyph is the drawing, and an
              // accessible name of "X" tells a screen reader nothing. It is
              // also the name the playthrough walk presses.
              aria-label="CLOSE"
              onPointerDown={() => playUi('click')}
              onClick={onClose}
            >
              <span aria-hidden="true">X</span>
            </button>
          )}
        </div>

        <div
          className={`os-window__body${bodyClassName ? ` ${bodyClassName}` : ''}`}
          ref={body}
          onScroll={measure}
          data-overflow={rail.overflow ? 'true' : 'false'}
        >
          {children}
        </div>

        {/*
          Outside the body, not inside it: a rail that scrolls with the content
          it is measuring is a rail that leaves the window. Hidden from the
          accessibility tree — it restates what the scroll container already
          reports, and saying it twice is noise in a screen reader.
        */}
        <div className="os-window__rail" data-on={rail.overflow ? 'true' : 'false'} aria-hidden="true">
          <span className="os-window__rail-track">
            <span
              className="os-window__thumb"
              style={{ top: `${rail.top * 100}%`, height: `${rail.size * 100}%` }}
            />
          </span>
          {/* The whole point of the rail, per §10.6a rule 3. */}
          <span className="os-window__more" data-on={rail.more ? 'true' : 'false'}>
            ▼
          </span>
        </div>

        {footer !== undefined && <div className="os-window__foot">{footer}</div>}
      </div>
    </Panel>
  )
}
