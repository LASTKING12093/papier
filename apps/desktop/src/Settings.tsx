import { useState } from "react";
import { Dialog, Select } from "./components";
import { Mark } from "./Brand";
import { brand } from "../../../packages/design-system/brand";
import { Check } from "./icons";
import { FontPicker } from "./fonts";
import {
  usePreferences,
  setPreference,
  resetPreferences,
  type Preferences,
} from "./preferences";
import { clearRenderCache, download } from "./api";
export function Settings({
  theme,
  onTheme,
  onClose,
}: {
  theme: string;
  onTheme: (v: string) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState("Appearance"),
    [notice, setNotice] = useState("");
  const p = usePreferences();
  const categories = [
    "Appearance",
    "Motion",
    "Editing",
    "Documents",
    "Signatures",
    "OCR",
    "Shortcuts",
    "Performance",
    "Privacy",
    "Advanced",
    "About Papier",
  ];
  function toggle(
    key: "ambient" | "glass" | "snap",
    label: string,
    detail: string,
  ) {
    return (
      <label className="preference-row">
        <span>
          <strong>{label}</strong>
          <small>{detail}</small>
        </span>
        <input
          role="switch"
          type="checkbox"
          checked={p[key]}
          onChange={(e) => setPreference(key, e.target.checked)}
        />
      </label>
    );
  }
  function number(
    key: keyof Preferences,
    label: string,
    values: number[],
    unit = "",
  ) {
    return (
      <label className="preference-row">
        <span>{label}</span>
        <Select
          label={label}
          value={`${p[key]}${unit}`}
          options={values.map((v) => `${v}${unit}`)}
          onChange={(v) => setPreference(key, Number(v.replace(unit, "")))}
        />
      </label>
    );
  }
  return (
    <Dialog title={tab === "About Papier" ? tab : "Settings"} onClose={onClose}>
      <div className="preferences-layout oled-atmosphere">
        <nav aria-label="Settings categories">
          <span className="preferences-label">WORKSPACE</span>
          {categories.map((v, i) => (
            <button
              key={v}
              className={tab === v ? "active" : ""}
              onClick={() => {
                setTab(v);
                setNotice("");
              }}
            >
              <span aria-hidden="true" className="preference-index">
                {String(i + 1).padStart(2, "0")}
              </span>
              {v}
            </button>
          ))}
        </nav>
        <section className="preferences-content" key={tab}>
          {tab !== "About Papier" && (
            <>
              <span className="section-eyebrow">PAPIER / PREFERENCES</span>
              <h3>{tab}</h3>
            </>
          )}
          {tab === "Appearance" && (
            <>
              <p>A workspace shaped around your documents.</p>
              <div className="appearance-choices">
                {["Light", "Dark", "System"].map((v) => (
                  <button
                    aria-pressed={theme === v}
                    key={v}
                    onClick={() => onTheme(v)}
                  >
                    <span className={`theme-mini theme-${v.toLowerCase()}`}>
                      <i />
                      <b />
                      <em />
                    </span>
                    <span>
                      {v}
                      {theme === v && <Check size={12} />}
                    </span>
                  </button>
                ))}
              </div>
              {toggle(
                "glass",
                "Translucent menus",
                "Subtle transparency in menus and floating dialogs.",
              )}
              {toggle(
                "ambient",
                "Living light",
                "Pointer-responsive Home lighting and an animated Papier mark.",
              )}
            </>
          )}
          {tab === "Motion" && (
            <>
              <p>Expressive feedback. Immediate control.</p>
              <label className="preference-row">
                <span>
                  <strong>Motion language</strong>
                  <small>Papier controls motion independently of Windows.</small>
                </span>
                <Select
                  label="Motion language"
                  value={p.motion}
                  options={["Full", "Reduced"]}
                  onChange={(v) => setPreference("motion", v)}
                />
              </label>
              {toggle(
                "ambient",
                "Living light",
                "Pointer-responsive Home lighting and an animated Papier mark.",
              )}
              <div className="motion-preview">
                <Mark size={68} prism />
                <span>Light, momentum and tactile feedback</span>
              </div>
            </>
          )}
          {tab === "Editing" && (
            <>
              {toggle(
                "snap",
                "Smart alignment",
                "Snap objects to page margins and neighbouring objects. Hold Ctrl to bypass.",
              )}
              {number("nudge", "Arrow key nudge", [0.5, 1, 2, 5, 10], " pt")}
              <p className="small muted">
                Shift + arrow moves ten times the selected distance.
              </p>
              <label className="preference-row">
                <span>Default text font</span>
                <FontPicker
                  value={p.defaultFont}
                  label="Default text font"
                  original={false}
                  onChange={(v) => setPreference("defaultFont", v)}
                />
              </label>
              <p className="small muted">
                Used when adding text. Existing PDF fonts are preserved until
                you choose a replacement.
              </p>
            </>
          )}
          {tab === "Documents" && (
            <>
              {number(
                "zoom",
                "Opening zoom",
                [50, 75, 85, 100, 125, 150, 200],
                "%",
              )}
              <label className="preference-row">
                <span>Opening layout</span>
                <Select
                  label="Opening layout"
                  value={p.layout}
                  options={["Continuous", "Single page", "Two-page"]}
                  onChange={(v) => setPreference("layout", v)}
                />
              </label>
              <div className="preference-note">
                <strong>Recover your work</strong>
                <p>
                  Before each edit, Papier saves the previous document state for
                  recovery. Home shows recoverable sessions after a restart.
                </p>
              </div>
            </>
          )}
          {tab === "Signatures" && (
            <>
              <label className="preference-row">
                <span>Default ink</span>
                <input
                  type="color"
                  aria-label="Default signature ink"
                  value={p.signatureColor}
                  onChange={(e) =>
                    setPreference("signatureColor", e.target.value)
                  }
                />
              </label>
              {number(
                "signatureWidth",
                "Placement width",
                [120, 160, 180, 220, 260, 300],
                " pt",
              )}
              <p>
                Your signature library stays on this device. Fine-tune
                handwriting, ink and placement in Signature Studio.
              </p>
              <div className="preference-note">
                <strong>Visual signatures and certificates</strong>
                <p>
                  A drawn or generated signature is a visual mark. Certificate
                  signing is a separate desktop workflow.
                </p>
              </div>
            </>
          )}
          {tab === "OCR" && (
            <>
              <p>Offline recognition with bundled Tesseract.</p>
              <label className="preference-row">
                <span>Default language</span>
                <Select
                  label="Default OCR language"
                  value={p.ocrLanguage}
                  options={["eng", "por", "spa"]}
                  onChange={(v) => setPreference("ocrLanguage", v)}
                />
              </label>
              {number("ocrScale", "Recognition resolution", [2, 3, 4], "×")}
              {number(
                "ocrConfidence",
                "Minimum word confidence",
                [20, 40, 60, 80],
                "%",
              )}
              <p className="small muted">
                Higher resolution takes more time and memory. Higher confidence
                excludes more uncertain words.
              </p>
            </>
          )}
          {tab === "Shortcuts" && (
            <>
              <p>Move from intention to action.</p>
              <dl className="shortcut-list">
                {[
                  ["New document", "Ctrl N"],
                  ["Open PDF", "Ctrl O"],
                  ["Save / Save as", "Ctrl S / Ctrl Shift S"],
                  ["Command palette", "Ctrl K / Ctrl Shift P"],
                  ["Settings", "Ctrl ,"],
                  ["Find", "Ctrl F"],
                  ["Undo / redo", "Ctrl Z / Ctrl Shift Z"],
                  ["Copy / paste object", "Ctrl C / Ctrl V"],
                  ["Duplicate object", "Ctrl D"],
                  ["Nudge / larger nudge", "Arrow / Shift Arrow"],
                  ["Bypass snapping", "Ctrl + drag"],
                  ["Constrain proportions", "Shift + resize"],
                  ["Fit page", "Ctrl 0"],
                ].map(([a, b]) => (
                  <div key={a}>
                    <dt>{a}</dt>
                    <dd>
                      <kbd>{b}</kbd>
                    </dd>
                  </div>
                ))}
              </dl>
            </>
          )}
          {tab === "Performance" && (
            <>
              {number("renderScale", "Render pixel ratio", [1, 1.5, 2], "×")}
              {number("cachePages", "Cached page renders", [8, 16, 24, 48])}
              <p className="small muted">
                Pixel ratio is capped by the display. Lower values use less
                memory. New renders use your preference.
              </p>
              <button
                className="secondary"
                onClick={() => {
                  clearRenderCache();
                  setNotice("Page render cache cleared.");
                }}
              >
                Clear render cache
              </button>
            </>
          )}
          {tab === "Privacy" && (
            <>
              <h4>Your documents stay yours.</h4>
              <p>
                Editing, text recognition and signature generation happen on
                this device. Papier does not upload your documents.
              </p>
              <div className="preference-note">
                <strong>Recent documents</strong>
                <p>
                  Previews and imported working copies are stored locally.
                  Removing a recent item never deletes its original file.
                </p>
              </div>
              <div className="preference-note">
                <strong>Recovery copies</strong>
                <p>
                  Recovery copies are stored unencrypted on this device. Protect
                  your Windows account when working with sensitive documents.
                </p>
              </div>
            </>
          )}
          {tab === "Advanced" && (
            <>
              <p>Portable preferences and a clean starting point.</p>
              <button
                className="secondary full"
                onClick={() =>
                  void download(
                    JSON.stringify(
                      { version: 1, theme, preferences: p },
                      null,
                      2,
                    ),
                    "Papier preferences.json",
                    "application/json",
                    false,
                  )
                }
              >
                Export preferences…
              </button>
              <button
                className="secondary full"
                onClick={() => {
                  resetPreferences();
                  onTheme("Dark");
                  setNotice(
                    "Workspace preferences restored. Documents and signatures were kept.",
                  );
                }}
              >
                Restore workspace defaults
              </button>
              <p className="small muted">
                Resetting preferences keeps your documents, recent files and
                signature library.
              </p>
            </>
          )}
          {tab === "About Papier" && (
            <div className="about-papier">
              <Mark size={100} prism />
              <h1>Papier</h1>
              <p>Paperwork, reworked.</p>
              <small>Version {brand.version}</small>
              <p className="muted">Your documents stay yours.</p>
              <p className="small muted">
                Built with PDFium, qpdf, Tesseract, Tauri and React. License
                texts are included in the installed application's licenses
                directory.
              </p>
            </div>
          )}
          {notice && (
            <p role="status" className="preference-feedback">
              {notice}
            </p>
          )}
        </section>
      </div>
      <footer>
        <span className="muted">Saved on this device · Ctrl ,</span>
        <button className="secondary" onClick={onClose}>
          Done
        </button>
      </footer>
    </Dialog>
  );
}
