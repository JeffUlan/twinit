import chalk from "chalk";
import { execa } from "execa";
import fs from "fs-extra";
import pkg from "glob";
import inquirer from "inquirer";
import { Listr } from "listr2";
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";
import { COMMON_CSS_FILES, DEPS, DIRECTIVES } from "./constants.js";
import detectPackageManager from "./pacman.js";
const { glob } = pkg;

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function getGenericTasks(css: string) {
  const pacman = await detectPackageManager();
  return new Listr([
    {
      title: "Installing dependencies...",
      task: async () => await pacman.install([...DEPS]),
    },
    {
      title: "Initializing tailwind config...",
      task: async () => await execa("npx", ["tailwindcss", "init", "-p"]),
    },
    {
      title: "Adding tailwind directives...",
      task: async () => await copyDirectives(css),
    },
  ]);
}

export async function getCssFilePath() {
  for (const file of COMMON_CSS_FILES) {
    const p1 = path.join(process.cwd(), "src", file);
    const p2 = path.join(process.cwd(), "styles", file);
    if (fs.existsSync(p1)) {
      return p1;
    } else if (fs.existsSync(p2)) {
      return p2;
    }
  }

  const getFile = async () => {
    const { file } = await inquirer.prompt({
      type: "input",
      name: "file",
      message:
        "Failed to detect a css file. Please enter the relative path to your css file:",
    });
    if (fileExists(path.join(process.cwd(), file))) return file;
    return await getFile();
  };

  return await getFile();
}

export async function copyDirectives(file: string) {
  // Write tailwind directives to the index.css/globals.css file
  const directives = DIRECTIVES.trim();

  if (!fs.existsSync(file)) {
    // Create the file if it doesn't exist
    await fs.createFile(file);
    await fs.writeFile(file, directives);
  } else {
    const data = await fs.readFile(file, "utf8");
    if (!data.includes(directives)) {
      await fs.writeFile(file, directives + "\n\n" + data);
    }
  }
}

export async function injectGlob(globs: string[], cfgFile: string) {
  // Import tailwind config file and inject the globs in the `content` field
  const config = require(path.join(process.cwd(), cfgFile));
  const sources = config.content || [];
  //  add new sources but only if they don't already exist
  globs.forEach((glob) => {
    if (!sources.includes(glob)) {
      sources.push(glob);
    }
  });
  config.content = sources;
  await fs.writeFile(
    path.join(process.cwd(), cfgFile),
    `module.exports = ${JSON.stringify(config, null, 2)}`
  );
}

export function fileExists(file: string) {
  try {
    return fs.existsSync(path.join(process.cwd(), file));
  } catch (error) {
    return false;
  }
}

export function globExists(pattern: string) {
  try {
    return glob.sync(pattern).length > 0;
  } catch (error) {
    return false;
  }
}

export function showSuccess(msg = "") {
  console.log(
    `${chalk.green(
      "\n Success!"
    )} Tailwindcss has been initialized on your project.\n`
  );
  msg && console.log(msg);
  console.log(chalk.cyan(" Happy tailwind-ing, I guess!\n"));
}

export function getImplementedFrameworks() {
  const matches = glob.sync("../lib/*.js", {
    cwd: __dirname,
    absolute: true,
  });

  return matches.map((match) => path.basename(match, ".js"));
}
