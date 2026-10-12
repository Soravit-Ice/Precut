import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const slugs =
  "kanit prompt sarabun notosansthai notosansthailooped ibmplexsansthai ibmplexsansthailooped anuphan baijamjuree chakrapetch chonburi fahkwang itim mali mitr pridi sriracha taviraj athiti trirong krub k2d charm pattaya inter roboto montserrat poppins opensans lato nunito nunitosans oswald anton bebasneue rubik raleway barlow barlowcondensed worksans dmsans outfit playfairdisplay merriweather".split(
    " ",
  );
const root = "apps/desktop/public/fonts";
await mkdir(root, { recursive: true });
await mkdir("licenses/fonts", { recursive: true });
const pinned = await readFile(`${root}/manifest.json`, "utf8")
  .then(JSON.parse)
  .catch((e) => {
    if (e.code !== "ENOENT") throw e;
    return null;
  });
const revision =
  pinned?.revision ??
  (
    await (
      await fetch("https://api.github.com/repos/google/fonts/commits/main")
    ).json()
  ).sha;
if (!/^[a-f0-9]{40}$/.test(revision ?? ""))
  throw new Error("Cannot resolve font revision");
async function get(path) {
  const url = `https://raw.githubusercontent.com/google/fonts/${revision}/ofl/${path}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(url);
    if (response.ok) return Buffer.from(await response.arrayBuffer());
    if (attempt === 2)
      throw new Error(`Font asset HTTP ${response.status}: ${path}`);
  }
}
const fonts = [];
for (const [index, slug] of slugs.entries()) {
  const metadata = (await get(`${slug}/METADATA.pb`)).toString();
  const name = metadata.match(/^name: "([^"]+)"/m)?.[1];
  if (!name) throw new Error(`Invalid font metadata: ${slug}`);
  const files = [];
  const weights = new Set();
  for (const match of metadata.matchAll(/fonts \{([\s\S]*?)\n\}/g)) {
    const block = match[1];
    if (!/style: "normal"/.test(block)) continue;
    const filename = block.match(/filename: "([^"]+)"/)?.[1];
    const weight = Number(block.match(/weight: (\d+)/)?.[1]);
    if (!filename || !weight) throw new Error(`Invalid font face: ${slug}`);
    const relative = `${slug}/${filename}`;
    await mkdir(`${root}/${slug}`, { recursive: true });
    const prior = pinned?.fonts
      .find((f) => f.id === name)
      ?.files.find((f) => f.file === relative);
    let data = await readFile(`${root}/${relative}`).catch(() => null);
    const digest = (value) => createHash("sha256").update(value).digest("hex");
    if (!data || !prior || digest(data) !== prior.sha256) {
      data = await get(relative);
      await writeFile(`${root}/${relative}`, data);
    }
    files.push({ file: relative, weight, sha256: digest(data) });
    weights.add(weight);
  }
  const axis = [...metadata.matchAll(/axes \{([\s\S]*?)\n\}/g)].find((m) =>
    /tag: "wght"/.test(m[1]),
  );
  if (axis) {
    const min = Number(axis[1].match(/min_value: ([\d.]+)/)?.[1]);
    const max = Number(axis[1].match(/max_value: ([\d.]+)/)?.[1]);
    for (let w = Math.ceil(min / 100) * 100; w <= max; w += 100) weights.add(w);
  }
  if (!files.length) throw new Error(`No usable font faces: ${name}`);
  await writeFile(
    `licenses/fonts/${slug}-OFL.txt`,
    await get(`${slug}/OFL.txt`),
  );
  fonts.push({
    id: name,
    name,
    languages: index < 24 ? ["th", "en"] : ["en"],
    weights: [...weights].sort((a, b) => a - b),
    files,
  });
  console.log(`Prepared ${index + 1}/${slugs.length}: ${name}`);
}
await writeFile(
  `${root}/manifest.json`,
  JSON.stringify({ revision, fonts }, null, 2) + "\n",
);
await writeFile(
  "packages/shared/src/font-catalog.json",
  JSON.stringify(fonts, null, 2) + "\n",
);
