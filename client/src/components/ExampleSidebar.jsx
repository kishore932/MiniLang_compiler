const SECTION_ORDER = [
  { id: 'basics', label: 'Examples' },
  { id: 'control', label: 'Control Flow' },
  { id: 'errors', label: 'Errors' },
];

export default function ExampleSidebar({ examples, selectedExample, onSelect }) {
  return (
    <div className="example-sidebar" aria-label="Example programs">
      <div className="example-sidebar__header">
        <span>Examples</span>
        <strong>{examples.length}</strong>
      </div>

      {SECTION_ORDER.map((section) => {
        const items = examples.filter((example) => example.category === section.id);
        if (items.length === 0) return null;

        return (
          <section className="example-section" key={section.id}>
            <h3>{section.label}</h3>
            <div className="example-list">
              {items.map((example) => (
                <button
                  key={example.name}
                  type="button"
                  className={selectedExample === example.name ? 'example-item example-item--active' : 'example-item'}
                  onClick={() => onSelect(example)}
                >
                  <span className="example-index">{String(examples.findIndex((entry) => entry.name === example.name) + 1).padStart(2, '0')}</span>
                  <span className="example-copy">{example.name}</span>
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
