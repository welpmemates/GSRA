/**
 * Badge
 * Colorful backgrounds with black text
 * @param {string} children
 */
export default function Badge({ children }) {
  // Assign colors based on content
  const getColor = (text) => {
    const lower = text.toLowerCase();
    if (lower.includes('hot')) return {  border: '#E53E3E' }; // Red
    if (lower.includes('warm')) return {  border: '#D69E2E' }; // Yellow
    if (lower.includes('cold')) return {  border: '#38A169' }; // Green
    return { bg: '#A78BFA', border: '#805AD5' }; // Purple default
  };

  const colors = getColor(children);

  return (
    <span
      style={{
        display:      "inline-block",
        fontSize:     9,
        padding:      "3px 9px",
        borderRadius: 20,
        background:   colors.bg,
        color:        "#000000",
        border:       `1px solid ${colors.border}`,
        lineHeight:   1.4,
        fontWeight:   600,
      }}
    >
      {children}
    </span>
  );
}
