export function LoadingSpinner(): React.JSX.Element {
  return (
    <span
      role="status"
      aria-label="Sedang memproses"
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  );
}
