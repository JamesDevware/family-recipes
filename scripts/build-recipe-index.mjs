import fs from "node:fs/promises";
import path from "node:path";

const repoName = "family-recipes";
const recipesDir = path.join(process.cwd(), "recipes");
const outputFile = path.join(process.cwd(), "index.json");
const htmlOutputFile = path.join(process.cwd(), "index.html");

function extractJsonLd(html) {
    const match = html.match(
        /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i
    );

    if (!match) return null;

    return JSON.parse(match[1].trim());
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
}

function buildIndexHtml(recipes) {
    const recipeItems = recipes
        .map((recipe) => {
            const ingredients = recipe.ingredients.slice(0, 5).map((ingredient) => {
                return `<li>${escapeHtml(ingredient)}</li>`;
            }).join("\n                            ");

            const extraCount = recipe.ingredients.length - 5;
            const extraIngredients = extraCount > 0
                ? `\n                            <li>Plus ${extraCount} more ingredient${extraCount === 1 ? "" : "s"}</li>`
                : "";

            return `                <article class="recipe-card">
                    <h2><a href="${escapeHtml(recipe.htmlUrl)}">${escapeHtml(recipe.title)}</a></h2>
                    <p>${escapeHtml(recipe.description)}</p>
                    <ul>
                            ${ingredients}${extraIngredients}
                    </ul>
                </article>`;
        })
        .join("\n\n");

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />

    <title>Family Recipes</title>
    <meta name="description" content="A browsable index of family-friendly recipes." />

    <style>
        body {
            max-width: 960px;
            margin: 40px auto;
            padding: 0 20px;
            font-family: Arial, Helvetica, sans-serif;
            line-height: 1.6;
            color: #222;
            background: #fff;
        }

        h1, h2 {
            color: #111;
        }

        a {
            color: #0645ad;
        }

        .intro {
            margin-bottom: 28px;
        }

        .recipe-list {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
            gap: 18px;
        }

        .recipe-card {
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 16px;
            background: #fafafa;
        }

        .recipe-card h2 {
            margin-top: 0;
            font-size: 1.2rem;
        }

        .recipe-card ul {
            margin-bottom: 0;
            padding-left: 20px;
        }

        .recipe-card li {
            margin-bottom: 6px;
        }
    </style>
</head>
<body>

<h1>Family Recipes</h1>

<p class="intro">
    A browsable index of ${recipes.length} family-friendly recipe${recipes.length === 1 ? "" : "s"}.
</p>

<main class="recipe-list">
${recipeItems}
</main>

</body>
</html>
`;
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
        description: jsonLd.description ?? "",
        htmlUrl: relativePath,
        url: `/${repoName}/${relativePath}`,
        ingredients: jsonLd.recipeIngredient ?? [],
    });
}

recipes.sort((a, b) => a.title.localeCompare(b.title));

const jsonRecipes = recipes.map(({ title, url, ingredients }) => {
    return { title, url, ingredients };
});

await fs.writeFile(outputFile, JSON.stringify(jsonRecipes, null, 2) + "\n");
await fs.writeFile(htmlOutputFile, buildIndexHtml(recipes));

console.log(`Built index.json and index.html with ${recipes.length} recipe(s).`);
