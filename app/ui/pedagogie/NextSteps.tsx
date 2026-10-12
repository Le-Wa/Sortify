import { NEXT_STEPS } from "./content";

/** Pendant qu'on presse les bacs : ce qui se passe ensuite. */
export function NextSteps() {
  return (
    <section className="tip">
      <span className="label">Et ensuite ?</span>
      <ol className="howto__steps" style={{ margin: 0 }}>
        {NEXT_STEPS.map((s, i) => (
          <li key={s.title}>
            <span className="mono">0{i + 1}</span>
            <span>
              <b>{s.title}</b> : {s.text}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
