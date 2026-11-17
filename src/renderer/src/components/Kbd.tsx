export function Kbd({ keys }: { keys: readonly string[] }) {
  return (
    <span className="kbd">
      {keys.map((key, index) => (
        <kbd key={`${key}-${index}`}>{key}</kbd>
      ))}
    </span>
  )
}
