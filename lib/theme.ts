export const light = {
  bg: {
    page: "#FBFAF7",
    surface: "#FFFFFF",
    muted: "#F4F2EC",
    inset: "#EFEDE6"
  },
  text: {
    primary: "#1F1E1B",
    secondary: "#5C5A54",
    tertiary: "#8E8B82",
    inverse: "#FBFAF7"
  },
  border: {
    subtle: "rgba(31, 30, 27, 0.08)",
    medium: "rgba(31, 30, 27, 0.16)",
    strong: "rgba(31, 30, 27, 0.24)"
  },
  brand: {
    primary: "#8B5A3C",
    primarySoft: "#F0E4D9"
  },
  status: {
    done: { dot: "#3B6D11", soft: "#EAF3DE", text: "#27500A" },
    inDev: { dot: "#185FA5", soft: "#E6F1FB", text: "#0C447C" },
    readyForDev: { dot: "#5F5E5A", soft: "#F1EFE8", text: "#2C2C2A" },
    discovery: { dot: "#BA7517", soft: "#FAEEDA", text: "#633806" },
    experiment: { dot: "#534AB7", soft: "#EEEDFE", text: "#3C3489" },
    backlog: { dot: "#888780", soft: "#F1EFE8", text: "#444441" },
    blocked: { dot: "#A32D2D", soft: "#FCEBEB", text: "#791F1F" },
    unknown: { dot: "#B4B2A9", soft: "#F1EFE8", text: "#5F5E5A" }
  },
  type: {
    epic: { soft: "#EEEDFE", text: "#3C3489" },
    story: { soft: "#E6F1FB", text: "#0C447C" },
    task: { soft: "#F1EFE8", text: "#5F5E5A" }
  }
} as const;

export const dark = {
  bg: {
    page: "#1A1916",
    surface: "#23211D",
    muted: "#2C2A26",
    inset: "#19181550"
  },
  text: {
    primary: "#F2EFE8",
    secondary: "#A8A59C",
    tertiary: "#75726A",
    inverse: "#1A1916"
  },
  border: {
    subtle: "rgba(242, 239, 232, 0.08)",
    medium: "rgba(242, 239, 232, 0.14)",
    strong: "rgba(242, 239, 232, 0.20)"
  },
  brand: {
    primary: "#B0795A",
    primarySoft: "#3D2E22"
  },
  status: {
    done: { dot: "#97C459", soft: "#27500A", text: "#C0DD97" },
    inDev: { dot: "#85B7EB", soft: "#0C447C", text: "#B5D4F4" },
    readyForDev: { dot: "#B4B2A9", soft: "#444441", text: "#D3D1C7" },
    discovery: { dot: "#EF9F27", soft: "#633806", text: "#FAC775" },
    experiment: { dot: "#AFA9EC", soft: "#3C3489", text: "#CECBF6" },
    backlog: { dot: "#888780", soft: "#2C2C2A", text: "#B4B2A9" },
    blocked: { dot: "#F09595", soft: "#501313", text: "#F7C1C1" },
    unknown: { dot: "#888780", soft: "#2C2C2A", text: "#B4B2A9" }
  },
  type: {
    epic: { soft: "#3C3489", text: "#CECBF6" },
    story: { soft: "#0C447C", text: "#B5D4F4" },
    task: { soft: "#444441", text: "#D3D1C7" }
  }
} as const;

export const radii = {
  sm: "4px",
  md: "6px",
  lg: "10px",
  xl: "14px"
} as const;

function flatten(prefix: string, value: unknown): string[] {
  if (typeof value === "string") return [`--${prefix}: ${value};`];
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, child]) =>
    flatten(`${prefix}-${key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`, child)
  );
}

export function themeCssVariables(): string {
  return `:root{${flatten("color", light).join("")}${flatten("radius", radii).join("")}}.dark{${flatten("color", dark).join("")}}`;
}
