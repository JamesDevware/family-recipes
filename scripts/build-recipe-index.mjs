import fs from "node:fs/promises";
import path from "node:path";

const repoName = "family-recipes";
const recipesDir = path.join(process.cwd(), "recipes");
const outputFile = path.join(process.cwd(), "index.json");

function extractJsonLd(html) {
    const match = html.match(
        /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i
    );

    if (!match) return null;

    return JSON.parse(match[1].trim());
}

function normaliseIngredient(ingredient) {
    return ingredient
        .replace(/^\d+([./–-]\d+)?\s*/g, "")
        .replace(/^\d+\s?(g|kg|ml|l|tbsp|tsp|cloves?|large|small|medium)\s+/i, "")
        .replace(/\([^)]*\)/g, "")
        .replace(/,\s*.*/g, "")
        .trim()
        .toLowerCase();
}

async function getHtmlFiles(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    const files = await Promise.all(
        entries.map(async (entry) => {
            const fullPath = path.join(dir, entry.name);

            if (entry.isDirectory()) {
                return getHtmlFiles(fullPath);
            }

            if (entry.isFile() && entry.name.endsWith(".html")) {
                return [fullPath];
            }

            return [];
        })
    );

    return files.flat();
}

const files = await getHtmlFiles(recipesDir);

const recipes = [];

for (const file of files) {
    const html = await fs.readFile(file, "utf8");
    const jsonLd = extractJsonLd(html);

    if (!jsonLd || jsonLd["@type"] !== "Recipe") continue;

    const relativePath = path.relative(process.cwd(), file).replaceAll("\\", "/");

    recipes.push({
        title: jsonLd.name,
        url: `/${repoName}/${relativePath}`,
        ingredients: [...new Set((jsonLd.recipeIngredient ?? []).map(normaliseIngredient))]
            .filter(Boolean)
            .sort(),
    });
}

recipes.sort((a, b) => a.title.localeCompare(b.title));

await fs.writeFile(outputFile, JSON.stringify(recipes, null, 2) + "\n");

console.log(`Built index.json with ${recipes.length} recipe(s).`);