import { calligraphy, type LetteringProfile } from "./signature-calligraphy";
import { generate, type Signature } from "./signature-vectors";
type Recipe = {
  label: string;
  style: string;
  form?: "initial" | "surname" | "initials";
  profile: LetteringProfile;
};
const recipes: Recipe[] = [
  {
    label: "Classic autograph",
    style: "Calligraphy",
    profile: { layout: 0, ornament: 0 },
  },
  {
    label: "Everyday handwriting",
    style: "Personal",
    profile: { layout: 0, ornament: 0, tracking: 1.1 },
  },
  {
    label: "Statement initial",
    style: "Expressive",
    profile: { layout: 2, capital: 1.8, ornament: 2 },
  },
  {
    label: "Interlocked initials",
    style: "Signature monogram",
    profile: { layout: 0, ornament: 0 },
  },
  {
    label: "Continuous pen",
    style: "Fluent",
    profile: { layout: 0, ornament: 1 },
  },
  {
    label: "Two-line flourish",
    style: "Ornamental",
    profile: { layout: 1, ornament: 2 },
  },
  {
    label: "Personal initial",
    style: "Personal",
    form: "initial",
    profile: { layout: 2, capital: 1.65, ornament: 0 },
  },
  {
    label: "Script + handwriting",
    style: "Calligraphy",
    profile: { layout: 1, contrast: true, ornament: 0 },
  },
  {
    label: "Editorial surname",
    style: "Fluent",
    form: "surname",
    profile: { layout: 1, ornament: 0 },
  },
  {
    label: "Sweeping autograph",
    style: "Ornamental",
    profile: { layout: 0, ornament: 2, tracking: 0.98 },
  },
  {
    label: "Stacked monogram",
    style: "Signature monogram",
    profile: { layout: 1, ornament: 2 },
  },
  {
    label: "Minimal signature",
    style: "Fluent",
    form: "initial",
    profile: { layout: 0, ornament: 0 },
  },
  {
    label: "Name + personal note",
    style: "Expressive",
    profile: { layout: 1, contrast: true, ornament: 1 },
  },
  {
    label: "Framed initials",
    style: "Signature monogram",
    profile: { layout: 0, ornament: 3 },
  },
  {
    label: "Confident capitals",
    style: "Calligraphy",
    form: "initial",
    profile: { layout: 2, capital: 2.1, ornament: 1 },
  },
  {
    label: "Loose handwriting",
    style: "Personal",
    profile: { layout: 1, ornament: 2, tracking: 1.16 },
  },
];
export function signatureCollection(
  name: string,
  batch: number,
  seed: number,
  options: {
    style: string;
    rubric: boolean;
    slant: number;
    flourish: number;
    compact: number;
    stroke: number;
  },
): Signature[] {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return Array.from({ length: 8 }, (_, i) => {
    const index = (batch * 5 + i) % recipes.length,
      recipe = recipes[index];
    let value = name;
    if (recipe.form === "initial" && words.length > 1)
      value = words[0][0] + ". " + words.slice(1).join(" ");
    if (recipe.form === "surname" && words.length > 1)
      value = words.at(-1) + " " + words.slice(0, -1).join(" ");
    if (options.rubric || recipe.form === "initials")
      value = words.map((w) => w[0]).join(" ");
    const style =
      options.style === "Explore styles" ? recipe.style : options.style;
    const salt = (seed + batch * 977 + i * 157) >>> 0;
    const angle = options.slant + ((salt % 13) - 6) * 0.035;
    const mark = [
      "Calligraphy",
      "Personal",
      "Expressive",
      "Signature monogram",
      "Fluent",
      "Ornamental",
    ].includes(style)
      ? calligraphy(
          value,
          style,
          salt,
          angle,
          options.flourish,
          options.compact * (0.9 + (salt % 11) * 0.02),
          options.stroke,
          {
            ...recipe.profile,
            layout: options.rubric ? i % 3 : recipe.profile.layout,
          },
        )
      : generate(
          value,
          style,
          salt,
          angle,
          options.flourish,
          options.compact * (0.76 + i * 0.06),
          options.stroke,
        );
    return {
      ...mark,
      name,
      recipe: recipe.label,
      id: `collection-${batch}-${i}-${salt}`,
    };
  });
}
