import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function reportFonts(env: NodeJS.ProcessEnv = process.env) {
  const names = {
    BodyRegular: "minion-regular",
    BodyBold: "minion-bold",
    HeadingRegular: "myriad-regular",
    HeadingBold: "myriad-bold",
  };
  if (env.CU_PDF_FONT_DIR) {
    const directory = resolve(env.CU_PDF_FONT_DIR),
      files: Record<string, string> = {};
    for (const [role, name] of Object.entries(names)) {
      const file = ["otf", "ttf"]
        .map((ext) => join(directory, `${name}.${ext}`))
        .find(existsSync);
      if (!file)
        throw new Error(
          `CU_PDF_FONT_DIR is missing ${name}.otf or .ttf. Supply licensed fonts for all four report roles.`,
        );
      files[role] = file;
    }
    return { configured: true, files, note: "" };
  }
  return {
    configured: false,
    files: {
      BodyRegular: fileURLToPath(
        new URL("../assets/fonts/NotoSerif-Regular.ttf", import.meta.url),
      ),
      BodyBold: fileURLToPath(
        new URL("../assets/fonts/NotoSerif-Bold.ttf", import.meta.url),
      ),
      HeadingRegular: fileURLToPath(
        new URL("../assets/fonts/NotoSans-Regular.ttf", import.meta.url),
      ),
      HeadingBold: fileURLToPath(
        new URL("../assets/fonts/NotoSans-Bold.ttf", import.meta.url),
      ),
    } as Record<string, string>,
    note: "Font note: This offline PDF uses Noto Serif and Noto Sans fallbacks. Configure licensed Minion and Myriad report fonts for CU typography.",
  };
}
