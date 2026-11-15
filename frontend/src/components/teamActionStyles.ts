/** Shared geometry for Homeowner Current Team actions, including Message's loading state. */
export const teamActionStyles = {
  tile: {
    width: 44, height: 44, flexShrink: 0, borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 2, paddingVertical: 4, flexDirection: "column",
    alignItems: "center", justifyContent: "center", gap: 3,
  },
  label: { fontSize: 8.5, lineHeight: 11, fontWeight: "500", textAlign: "center", flexShrink: 0 },
  iconSize: 17,
} as const;
