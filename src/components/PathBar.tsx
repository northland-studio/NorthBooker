interface PathItem { id: string | null; name: string }

export default function PathBar({ path, onNavigate }: { path: PathItem[]; onNavigate: (id: string | null) => void }) {
  return (
    <div className="path-bar">
      {path.map((item, i) => (
        <span key={item.id ?? 'root'}>
          {i > 0 && <span className="path-sep">/</span>}
          <button className="path-item" onClick={() => onNavigate(item.id)}>
            {item.name}
          </button>
        </span>
      ))}
    </div>
  )
}
