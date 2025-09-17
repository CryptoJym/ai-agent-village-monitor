// Placeholder for heavy layout offload (optional)
export function computeLayout(
  nodes: Array<{ id: string }>,
): Array<{ id: string; x: number; y: number }> {
  // Naive grid layout for demonstration
  const cols = Math.ceil(Math.sqrt(nodes.length || 1));
  const spacing = 80;
  return nodes.map((n, i) => ({
    id: n.id,
    x: (i % cols) * spacing,
    y: Math.floor(i / cols) * spacing,
  }));
}
