/** Affiché tout de suite au clic sur un onglet, pendant que la page arrive. */
export default function Loading() {
  return (
    <div className="skeleton" role="status" aria-label="Chargement">
      <span className="skeleton__title" />
      <span className="skeleton__block" />
      <span className="skeleton__line" />
      <span className="skeleton__line" />
      <span className="skeleton__line skeleton__line--short" />
    </div>
  );
}
