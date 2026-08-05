/** Zero-padded positions for a group of generated tests: `["01", "02", "03"]`. */
export const testIter = (count: number, width = 2): string[] =>
  Array.from({ length: count }, (_unused, i) =>
    String(i + 1).padStart(width, "0"),
  );
